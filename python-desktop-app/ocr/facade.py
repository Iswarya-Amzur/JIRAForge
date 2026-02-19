"""
OCR Facade

Provides unified interface for text extraction with fallback support.
Implements the Facade pattern to hide complexity of multiple OCR engines.

This is the main entry point for OCR operations in the application.
Maintains backward compatibility with existing extract_text_from_image() function.
"""
import logging
from typing import Dict, Any, Optional, List
import numpy as np
from PIL import Image

from .config import OCRConfig, OCREngineConfig
from .engine_factory import EngineFactory
from .base_engine import BaseOCREngine
from .image_processor import preprocess_image, resize_if_needed

logger = logging.getLogger(__name__)


class OCRFacade:
    """
    Unified facade for OCR operations.
    
    Features:
        - Automatic engine selection based on configuration
        - Graceful fallback when engines fail
        - Preprocessing pipeline integration
        - Metadata fallback as last resort
    
    Usage:
        # Simple usage (uses environment config)
        facade = OCRFacade()
        result = facade.extract_text(image)
        
        # Custom configuration
        config = OCRConfig()
        config.primary_engine = 'tesseract'
        facade = OCRFacade(config)
        result = facade.extract_text(image)
    
    Configuration via environment:
        OCR_PRIMARY_ENGINE=paddle
        OCR_FALLBACK_ENGINES=tesseract,easyocr
        OCR_PADDLE_MIN_CONFIDENCE=0.5
    """
    
    def __init__(self, config: Optional[OCRConfig] = None):
        """
        Initialize OCR Facade.
        
        Args:
            config: OCR configuration (loads from environment if None)
        """
        self.config = config or OCRConfig.from_env()
        self._primary_engine: Optional[BaseOCREngine] = None
        self._fallback_engines: List[BaseOCREngine] = []
        
        # Initialize engines
        self._initialize_engines()
    
    def _initialize_engines(self):
        """Initialize primary and fallback engines"""
        
        # Try to create primary engine
        try:
            engine_config = self.config.get_engine_config(self.config.primary_engine)
            self._primary_engine = EngineFactory.get_or_create(
                self.config.primary_engine,
                config=engine_config
            )
            if self._primary_engine.is_available():
                logger.info(f"Primary OCR engine: {self.config.primary_engine}")
            else:
                logger.warning(
                    f"Primary engine '{self.config.primary_engine}' registered but not available. "
                    f"Install: {EngineFactory.get_package_suggestion(self.config.primary_engine)}"
                )
                self._primary_engine = None
        except ValueError as e:
            logger.warning(
                f"Primary OCR engine '{self.config.primary_engine}' not registered. "
                f"Install: {EngineFactory.get_package_suggestion(self.config.primary_engine)}. "
                f"Will use fallback engines."
            )
            self._primary_engine = None
        
        # Create fallback engines
        self._fallback_engines = []
        for engine_name in self.config.fallback_engines:
            try:
                engine_config = self.config.get_engine_config(engine_name)
                engine = EngineFactory.get_or_create(engine_name, config=engine_config)
                if engine.is_available():
                    self._fallback_engines.append(engine)
                    logger.debug(f"Fallback engine available: {engine_name}")
                else:
                    logger.debug(f"Fallback engine {engine_name} not available")
            except ValueError as e:
                logger.debug(f"Fallback engine {engine_name} not registered: {e}")
        
        # Log final configuration
        if not self._primary_engine and not self._fallback_engines:
            logger.warning(
                "No OCR engines available! Text extraction will use metadata fallback only. "
                "Install an OCR engine: pip install paddlepaddle paddleocr"
            )
    
    def extract_text(
        self,
        image,
        window_title: str = '',
        app_name: str = '',
        use_preprocessing: bool = True
    ) -> Dict[str, Any]:
        """
        Extract text from image using configured engines with fallback.
        
        Args:
            image: PIL Image, numpy array, or file path
            window_title: Window title (for metadata fallback)
            app_name: Application name (for metadata fallback)
            use_preprocessing: Apply image preprocessing
        
        Returns:
            Standardized result dict:
                - text (str): Extracted text
                - confidence (float): Overall confidence
                - method (str): Engine used ('paddle', 'tesseract', 'metadata')
                - success (bool): Whether extraction succeeded
                - window_title (str): Passed metadata
                - app_name (str): Passed metadata
                - line_count (int): Number of text lines
        """
        try:
            # Convert and preprocess image
            img_array = self._prepare_image(image, use_preprocessing)
            
            # Build list of engines to try
            engines_to_try = []
            if self._primary_engine and self._primary_engine.is_available():
                engines_to_try.append(self._primary_engine)
            engines_to_try.extend([e for e in self._fallback_engines if e.is_available()])
            
            # Try each engine in order
            for engine in engines_to_try:
                engine_name = engine.get_name()
                engine_config = self.config.get_engine_config(engine_name)
                min_confidence = engine_config.min_confidence
                
                logger.debug(f"Trying OCR engine: {engine_name}")
                
                try:
                    result = engine.extract_text(img_array)
                    
                    if result.get('success') and result.get('confidence', 0) >= min_confidence:
                        logger.info(
                            f"OCR succeeded with {engine_name} "
                            f"(confidence: {result['confidence']:.2f})"
                        )
                        return {
                            'text': result.get('text', ''),
                            'confidence': result.get('confidence', 0.0),
                            'method': engine_name,
                            'success': True,
                            'window_title': window_title,
                            'app_name': app_name,
                            'line_count': result.get('line_count', 0),
                            'boxes': result.get('boxes')
                        }
                    else:
                        logger.debug(
                            f"{engine_name} below threshold "
                            f"(conf: {result.get('confidence', 0):.2f} < {min_confidence})"
                        )
                        
                except Exception as e:
                    logger.warning(f"Engine {engine_name} failed: {e}")
                    continue
            
            # All engines failed - return metadata fallback
            logger.warning("All OCR engines failed or below threshold, using metadata fallback")
            return self._create_metadata_fallback(window_title, app_name)
            
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'method': 'error',
                'success': False,
                'error': str(e),
                'window_title': window_title,
                'app_name': app_name,
                'line_count': 0
            }
    
    def _prepare_image(self, image, use_preprocessing: bool) -> np.ndarray:
        """
        Convert and preprocess image for OCR.
        
        Args:
            image: PIL Image, numpy array, or file path
            use_preprocessing: Apply preprocessing
        
        Returns:
            Preprocessed numpy array
        """
        # Convert to PIL Image
        if isinstance(image, str):
            img = Image.open(image)
        elif isinstance(image, np.ndarray):
            img = Image.fromarray(image)
        else:
            img = image
        
        # Preprocess if enabled
        if use_preprocessing and self.config.use_preprocessing:
            processed = preprocess_image(img)
        else:
            processed = np.array(img)
        
        # Resize if needed
        processed = resize_if_needed(processed, max_dimension=self.config.max_image_dimension)
        
        return processed
    
    def _create_metadata_fallback(
        self,
        window_title: str,
        app_name: str
    ) -> Dict[str, Any]:
        """
        Create metadata fallback result when OCR fails.
        
        Args:
            window_title: Window title
            app_name: Application name
        
        Returns:
            Fallback result dict
        """
        return {
            'text': '',
            'confidence': 0.0,
            'method': 'metadata',
            'success': False,
            'window_title': window_title,
            'app_name': app_name,
            'line_count': 0
        }
    
    def get_available_engines(self) -> Dict[str, bool]:
        """
        Get available OCR engines and their status.
        
        Returns:
            Dict mapping engine name to availability
        """
        return EngineFactory.get_available_engines()
    
    def get_current_config(self) -> Dict[str, Any]:
        """
        Get current configuration as dictionary.
        
        Returns:
            Configuration dict
        """
        return self.config.to_dict()


# Global facade instance (lazy initialization)
_facade_instance: Optional[OCRFacade] = None


def get_facade(config: Optional[OCRConfig] = None) -> OCRFacade:
    """
    Get or create global OCRFacade instance.
    
    Args:
        config: Optional configuration (uses env if None)
    
    Returns:
        OCRFacade singleton instance
    """
    global _facade_instance
    
    if _facade_instance is None or config is not None:
        _facade_instance = OCRFacade(config)
    
    return _facade_instance


def extract_text_from_image(
    image,
    window_title: str = '',
    app_name: str = '',
    use_preprocessing: bool = True
) -> Dict[str, Any]:
    """
    Extract text from image - BACKWARD COMPATIBLE function.
    
    This is the main entry point that maintains compatibility with
    existing code while using the new facade architecture.
    
    Args:
        image: PIL Image, numpy array, or file path
        window_title: Window title for metadata fallback
        app_name: Application name for metadata fallback
        use_preprocessing: Apply image preprocessing
    
    Returns:
        dict: {
            'text': str,              # Extracted text
            'confidence': float,      # Confidence score
            'method': str,            # 'paddle', 'tesseract', or 'metadata'
            'success': bool,
            'window_title': str,      # Metadata (always included)
            'app_name': str,          # Metadata (always included)
            'line_count': int         # Number of text lines
        }
    
    Example:
        from ocr import extract_text_from_image
        
        result = extract_text_from_image(screenshot, window_title='Chrome')
        if result['success']:
            print(f"Extracted: {result['text']}")
    """
    facade = get_facade()
    return facade.extract_text(
        image,
        window_title=window_title,
        app_name=app_name,
        use_preprocessing=use_preprocessing
    )


def reset_facade():
    """Reset global facade instance (useful for testing)"""
    global _facade_instance
    _facade_instance = None
