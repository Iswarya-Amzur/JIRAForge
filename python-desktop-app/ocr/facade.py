"""
OCR Facade

Provides unified interface for text extraction with fallback support.
Implements the Facade pattern to hide complexity of multiple OCR engines.

This is the main entry point for OCR operations in the application.
Maintains backward compatibility with existing extract_text_from_image() function.
"""
import logging
import time
from typing import Dict, Any, Optional, List
import numpy as np
from PIL import Image

from .config import OCRConfig, OCREngineConfig
from .engine_factory import EngineFactory
from .base_engine import BaseOCREngine
from .image_processor import preprocess_image, preprocess_screenshot, resize_if_needed

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
    
    # For productivity classification, we don't need every line from a code editor.
    # The first N lines are enough to determine what the user is working on.
    MAX_OCR_LINES = 40

    def extract_text(
        self,
        image,
        window_title: str = '',
        app_name: str = '',
        use_preprocessing: bool = True,
        screenshot_mode: bool = False,
        max_lines: int = 0
    ) -> Dict[str, Any]:
        """
        Extract text from image using configured engines with fallback.
        
        Args:
            image: PIL Image, numpy array, or file path
            window_title: Window title (for metadata fallback)
            app_name: Application name (for metadata fallback)
            use_preprocessing: Apply image preprocessing (full pipeline)
            screenshot_mode: Use lightweight preprocessing optimized for screen captures.
                Skips expensive denoising/CLAHE/sharpening and downscales instead.
            max_lines: Maximum text lines to return (0 = unlimited).
                Helps cap processing time for text-heavy screenshots.
        
        Returns:
            Standardized result dict
        """
        effective_max_lines = max_lines or self.MAX_OCR_LINES

        try:
            total_start = time.perf_counter()
            # Convert image to PIL once; preprocessing is done per-engine
            # because different engines need different formats
            pil_image = self._load_image(image)

            engines_to_try = []
            if self._primary_engine and self._primary_engine.is_available():
                engines_to_try.append(self._primary_engine)
            engines_to_try.extend([e for e in self._fallback_engines if e.is_available()])
            
            for engine in engines_to_try:
                engine_name = engine.get_name()
                engine_config = self.config.get_engine_config(engine_name)
                min_confidence = engine_config.min_confidence
                
                logger.debug(f"Trying OCR engine: {engine_name}")

                # Preprocess per-engine: Tesseract needs grayscale+CLAHE,
                # PaddleOCR works best with raw RGB
                prep_start = time.perf_counter()
                img_array = self._prepare_image(
                    pil_image, use_preprocessing, screenshot_mode,
                    engine_hint=engine_name
                )
                prep_ms = (time.perf_counter() - prep_start) * 1000.0
                
                try:
                    infer_start = time.perf_counter()
                    # Skip angle classification for screenshot-mode PaddleOCR.
                    # This removes unnecessary per-line overhead for horizontal screen text.
                    if screenshot_mode and engine_name == 'paddle':
                        result = engine.extract_text(img_array, skip_angle_cls=True)
                    else:
                        result = engine.extract_text(img_array)
                    infer_ms = (time.perf_counter() - infer_start) * 1000.0
                    
                    if result.get('success') and result.get('confidence', 0) >= min_confidence:
                        text = result.get('text', '')
                        line_count = result.get('line_count', 0)

                        if effective_max_lines and line_count > effective_max_lines:
                            text_lines = text.split('\n')[:effective_max_lines]
                            text = '\n'.join(text_lines)
                            line_count = len(text_lines)

                        logger.info(
                            f"OCR succeeded with {engine_name} "
                            f"(confidence: {result['confidence']:.2f}, lines: {line_count}, "
                            f"prep: {prep_ms:.1f}ms, infer: {infer_ms:.1f}ms, "
                            f"total: {(time.perf_counter() - total_start) * 1000.0:.1f}ms)"
                        )
                        return {
                            'text': text,
                            'confidence': result.get('confidence', 0.0),
                            'method': engine_name,
                            'success': True,
                            'prep_ms': prep_ms,
                            'infer_ms': infer_ms,
                            'total_ms': (time.perf_counter() - total_start) * 1000.0,
                            'window_title': window_title,
                            'app_name': app_name,
                            'line_count': line_count,
                            'boxes': result.get('boxes')
                        }
                    else:
                        logger.debug(
                            f"{engine_name} below threshold "
                            f"(conf: {result.get('confidence', 0):.2f} < {min_confidence}, "
                            f"prep: {prep_ms:.1f}ms, infer: {infer_ms:.1f}ms)"
                        )
                        
                except Exception as e:
                    logger.warning(f"Engine {engine_name} failed: {e}")
                    continue
            
            logger.warning("All OCR engines failed or below threshold, using metadata fallback")
            fallback = self._create_metadata_fallback(window_title, app_name)
            fallback['total_ms'] = (time.perf_counter() - total_start) * 1000.0
            return fallback
            
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'method': 'error',
                'success': False,
                'error': str(e),
                'total_ms': (time.perf_counter() - total_start) * 1000.0 if 'total_start' in locals() else None,
                'window_title': window_title,
                'app_name': app_name,
                'line_count': 0
            }

    def _load_image(self, image) -> Image.Image:
        """Convert any image input to PIL Image."""
        if isinstance(image, str):
            return Image.open(image)
        elif isinstance(image, np.ndarray):
            return Image.fromarray(image)
        return image
    
    def _prepare_image(
        self, image: Image.Image, use_preprocessing: bool,
        screenshot_mode: bool = False, engine_hint: str = ''
    ) -> np.ndarray:
        """
        Preprocess image for a specific OCR engine.

        In screenshot_mode, applies engine-appropriate lightweight preprocessing:
          - PaddleOCR: just downscale (has own neural preprocessing)
          - Tesseract: downscale + grayscale + CLAHE (~15ms, no denoising)
        
        In document mode (use_preprocessing=True), runs the full heavy pipeline
        regardless of engine (grayscale, CLAHE, denoise, sharpen).

        Args:
            image: PIL Image
            use_preprocessing: Apply full preprocessing (for scanned docs)
            screenshot_mode: Use lightweight screenshot preprocessing
            engine_hint: Engine name for engine-specific preprocessing
        
        Returns:
            Preprocessed numpy array
        """
        if screenshot_mode:
            return preprocess_screenshot(image, engine_hint=engine_hint)
        elif use_preprocessing and self.config.use_preprocessing:
            processed = preprocess_image(image)
        else:
            processed = np.array(image)
        
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
    use_preprocessing: bool = True,
    screenshot_mode: bool = False,
    max_lines: int = 0
) -> Dict[str, Any]:
    """
    Extract text from image - BACKWARD COMPATIBLE function.
    
    This is the main entry point that maintains compatibility with
    existing code while using the new facade architecture.
    
    Args:
        image: PIL Image, numpy array, or file path
        window_title: Window title for metadata fallback
        app_name: Application name for metadata fallback
        use_preprocessing: Apply full image preprocessing (for scanned docs)
        screenshot_mode: Use lightweight preprocessing for screen captures.
            Skips expensive denoising/CLAHE/sharpening (~300-800ms savings).
        max_lines: Maximum text lines to return (0 = use default cap of 40)
    
    Returns:
        dict with text, confidence, method, success, line_count, etc.
    
    Example:
        from ocr import extract_text_from_image
        
        # For live screen captures (fast):
        result = extract_text_from_image(screenshot, screenshot_mode=True)
        
        # For scanned documents (thorough):
        result = extract_text_from_image(document_scan, use_preprocessing=True)
    """
    facade = get_facade()
    return facade.extract_text(
        image,
        window_title=window_title,
        app_name=app_name,
        use_preprocessing=use_preprocessing,
        screenshot_mode=screenshot_mode,
        max_lines=max_lines
    )


def reset_facade():
    """Reset global facade instance (useful for testing)"""
    global _facade_instance
    _facade_instance = None
