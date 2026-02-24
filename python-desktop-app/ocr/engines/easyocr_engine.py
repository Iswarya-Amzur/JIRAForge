"""
EasyOCR Engine Implementation

Adapter for EasyOCR library - supports 80+ languages with high accuracy.
EasyOCR uses PyTorch deep learning models for text detection and recognition.

Configuration (via .env):
    OCR_EASYOCR_LANGUAGES=en                # Languages (comma-separated: en,fr,es)
    OCR_EASYOCR_MIN_CONFIDENCE=0.70        # Minimum confidence threshold (0.0-1.0)
    OCR_EASYOCR_GPU=false                  # Use GPU acceleration (true/false)
    OCR_EASYOCR_BATCH_SIZE=1               # Batch processing size
    OCR_EASYOCR_WIDTH_TH=0.5               # Width threshold for text detection
    OCR_EASYOCR_HEIGHT_TH=0.5              # Height threshold for text detection

Dependencies:
    - easyocr>=1.7.0
    - torch>=2.0.0
    - torchvision>=0.15.0
    - opencv-python (for image processing)

Installation:
    pip install easyocr torch torchvision

Usage:
    from ocr.engines.easyocr_engine import EasyOCREngine
    
    engine = EasyOCREngine()
    result = engine.extract_text(image)
"""

import logging
import numpy as np
from PIL import Image
from typing import Dict, List, Any, Optional, Tuple

from ocr.base_engine import BaseOCREngine

logger = logging.getLogger(__name__)


class EasyOCREngine(BaseOCREngine):
    """
    EasyOCR implementation with dynamic configuration.
    
    EasyOCR is a ready-to-use OCR library supporting 80+ languages.
    Uses deep learning models (CRAFT for detection, CRNN for recognition).
    
    Features:
        - High accuracy (88-94%)
        - Multi-language support (80+ languages)
        - Automatic text detection
        - Bounding box extraction
        - GPU acceleration support
    """
    
    def __init__(
        self,
        use_gpu: bool = False,
        language: str = 'en',
        min_confidence: float = 0.70,
        languages: Optional[str] = None,  # Comma-separated languages (overrides 'language')
        batch_size: int = 1,
        width_th: float = 0.5,
        height_th: float = 0.5,
        **extra_params
    ):
        """
        Initialize EasyOCR engine with configuration.
        
        Args:
            use_gpu: Use GPU acceleration (default: False)
            language: Primary OCR language (default: 'en')
            min_confidence: Minimum confidence threshold (default: 0.70)
            languages: Comma-separated languages (e.g., 'en,fr,es'), overrides language
            batch_size: Batch processing size (default: 1)
            width_th: Width threshold for text detection (default: 0.5)
            height_th: Height threshold for text detection (default: 0.5)
            **extra_params: Additional EasyOCR parameters
        """
        self._reader = None
        self._initialized = False
        
        # Store configuration
        self.use_gpu = use_gpu
        self.min_confidence = min_confidence
        self.extra_params = extra_params
        
        # Parse languages (comma-separated string to list)
        if languages:
            # Use 'languages' parameter if provided (comma-separated)
            self._languages = [lang.strip() for lang in languages.split(',')]
        else:
            # Use single 'language' parameter
            self._languages = [language]
        
        # Advanced settings
        self._batch_size = batch_size
        self._width_th = width_th
        self._height_th = height_th
        
        logger.info(f"EasyOCR engine configured: languages={self._languages}, gpu={self.use_gpu}")
    
    def get_name(self) -> str:
        """
        Get engine name.
        
        Returns:
            'easyocr'
        """
        return 'easyocr'
    
    def is_available(self) -> bool:
        """
        Check if EasyOCR is available.
        
        Returns:
            True if easyocr package can be imported, False otherwise
        """
        try:
            import easyocr
            return True
        except ImportError:
            logger.warning("EasyOCR not available. Install: pip install easyocr")
            return False
    
    def _initialize(self) -> bool:
        """
        Lazy initialization of EasyOCR reader.
        
        Returns:
            True if initialization successful, False otherwise
        """
        if self._initialized and self._reader is not None:
            return True
        
        try:
            import easyocr
            
            logger.info(f"Initializing EasyOCR reader (languages: {self._languages}, gpu: {self.use_gpu})...")
            
            # Initialize reader with configuration
            self._reader = easyocr.Reader(
                lang_list=self._languages,
                gpu=self.use_gpu,
                verbose=False  # Suppress verbose output
            )
            
            self._initialized = True
            logger.info("EasyOCR reader initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
            self._initialized = False
            return False
    
    def extract_text(self, image: Image.Image, **kwargs) -> Dict[str, Any]:
        """
        Extract text from image using EasyOCR.
        
        Args:
            image: PIL Image object
            **kwargs: Additional arguments (unused, for compatibility)
        
        Returns:
            Dictionary with keys:
                - text: Extracted text string
                - confidence: Average confidence score (0.0-1.0)
                - bounding_boxes: List of detected text regions
                - lines: List of individual text lines
                - success: Boolean indicating success
                - engine: Engine name
        """
        # Initialize reader if needed
        if not self._initialize():
            return {
                'text': '',
                'confidence': 0.0,
                'bounding_boxes': [],
                'lines': [],
                'success': False,
                'engine': self.get_name(),
                'error': 'Failed to initialize EasyOCR reader'
            }
        
        try:
            # Convert PIL image to numpy array
            img_array = np.array(image)
            
            # EasyOCR expects RGB format
            if img_array.ndim == 2:  # Grayscale
                img_array = np.stack([img_array] * 3, axis=-1)
            elif img_array.shape[2] == 4:  # RGBA
                img_array = img_array[:, :, :3]
            
            logger.debug(f"Processing image: {img_array.shape}")
            
            # Perform OCR
            # result format: [ ([top_left, top_right, bottom_right, bottom_left], text, confidence), ... ]
            results = self._reader.readtext(
                img_array,
                batch_size=self._batch_size,
                width_ths=self._width_th,
                height_ths=self._height_th
            )
            
            if not results:
                logger.warning("EasyOCR found no text in image")
                return {
                    'text': '',
                    'confidence': 0.0,
                    'bounding_boxes': [],
                    'lines': [],
                    'success': True,
                    'engine': self.get_name()
                }
            
            # Parse results
            lines = []
            bounding_boxes = []
            confidences = []
            
            for bbox, text, confidence in results:
                # Filter by minimum confidence
                if confidence >= self.min_confidence:
                    lines.append({
                        'text': text,
                        'confidence': float(confidence),
                        'bbox': self._normalize_bbox(bbox)
                    })
                    bounding_boxes.append(self._normalize_bbox(bbox))
                    confidences.append(float(confidence))
            
            # Combine all text
            full_text = '\n'.join([line['text'] for line in lines])
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            logger.info(f"EasyOCR extracted {len(lines)} lines (avg confidence: {avg_confidence:.2f})")
            
            return {
                'text': full_text,
                'confidence': avg_confidence,
                'bounding_boxes': bounding_boxes,
                'lines': lines,
                'success': True,
                'engine': self.get_name()
            }
            
        except Exception as e:
            logger.error(f"EasyOCR extraction failed: {e}", exc_info=True)
            return {
                'text': '',
                'confidence': 0.0,
                'bounding_boxes': [],
                'lines': [],
                'success': False,
                'engine': self.get_name(),
                'error': str(e)
            }
    
    def _normalize_bbox(self, bbox: List[List[float]]) -> Dict[str, int]:
        """
        Convert EasyOCR bounding box to standard format.
        
        EasyOCR format: [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
        Standard format: {x: int, y: int, width: int, height: int}
        
        Args:
            bbox: EasyOCR bounding box (4 points)
        
        Returns:
            Normalized bounding box dictionary
        """
        # Extract coordinates
        x_coords = [point[0] for point in bbox]
        y_coords = [point[1] for point in bbox]
        
        # Calculate bounding rectangle
        x = int(min(x_coords))
        y = int(min(y_coords))
        width = int(max(x_coords) - x)
        height = int(max(y_coords) - y)
        
        return {
            'x': x,
            'y': y,
            'width': width,
            'height': height
        }
    
    def get_capabilities(self) -> Dict[str, Any]:
        """
        Get engine capabilities and features.
        
        Returns:
            Dictionary describing capabilities
        """
        return {
            'name': self.get_name(),
            'version': self._get_version(),
            'description': 'EasyOCR - Ready-to-use OCR with 80+ language support',
            'features': {
                'multi_language': True,
                'bounding_boxes': True,
                'confidence_scores': True,
                'gpu_acceleration': self.use_gpu,
                'batch_processing': True
            },
            'supported_languages': self._languages,
            'language_count': '80+',
            'accuracy_range': '88-94%',
            'configuration': {
                'languages': ', '.join(self._languages),
                'min_confidence': self.min_confidence,
                'gpu': self.use_gpu,
                'batch_size': self._batch_size
            }
        }
    
    def _get_version(self) -> str:
        """Get EasyOCR version."""
        try:
            import easyocr
            return easyocr.__version__
        except (ImportError, AttributeError):
            return 'unknown'
    
    def __repr__(self) -> str:
        """String representation."""
        return f"EasyOCREngine(languages={self._languages}, gpu={self.use_gpu}, min_conf={self.min_confidence})"
