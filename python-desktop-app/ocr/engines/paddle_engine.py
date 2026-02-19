"""
PaddleOCR Engine Adapter

Wraps PaddleOCR library to comply with BaseOCREngine interface.
Implements singleton pattern to avoid reloading expensive models.

Supports both PaddleOCR 2.x (legacy) and 3.x (new) APIs.
"""
import os
import numpy as np
from PIL import Image
import logging
from typing import Dict, Any, Optional

from ..base_engine import BaseOCREngine

logger = logging.getLogger(__name__)

# Check if PaddleOCR is available and detect version
_PADDLEOCR_AVAILABLE = False
_PADDLEOCR_VERSION = None
try:
    from paddleocr import PaddleOCR
    import paddleocr
    _PADDLEOCR_AVAILABLE = True
    _PADDLEOCR_VERSION = getattr(paddleocr, '__version__', '2.0.0')
    logger.debug(f"PaddleOCR version: {_PADDLEOCR_VERSION}")
except ImportError:
    logger.debug("PaddleOCR not installed. Install with: pip install paddlepaddle paddleocr")


class PaddleOCREngine(BaseOCREngine):
    """
    PaddleOCR engine adapter implementing BaseOCREngine interface.
    
    Uses singleton pattern to avoid reloading models on every instantiation.
    Wraps PaddleOCR's PP-OCRv5 models for text detection and recognition.
    
    Configuration via environment variables:
        OCR_PADDLE_USE_GPU: true/false (default: false)
        OCR_PADDLE_LANGUAGE: en, ch, etc. (default: en)
        OCR_PADDLE_MIN_CONFIDENCE: 0.0-1.0 (default: 0.5)
    
    Or via OCREngineConfig:
        config.engines['paddle'] = OCREngineConfig(
            name='paddle',
            use_gpu=True,
            language='ch'
        )
    """
    
    _instance: Optional['PaddleOCREngine'] = None
    _ocr = None  # PaddleOCR instance
    
    def __new__(cls, *args, **kwargs):
        """Singleton pattern - reuse model instance"""
        if cls._instance is None:
            cls._instance = super(PaddleOCREngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(
        self,
        use_gpu: bool = False,
        language: str = 'en',
        min_confidence: float = 0.5,
        **extra_params
    ):
        """
        Initialize PaddleOCR engine.
        
        Args:
            use_gpu: Use GPU acceleration
            language: OCR language ('en', 'ch', 'ja', etc.)
            min_confidence: Minimum confidence threshold (for filtering)
            **extra_params: Additional PaddleOCR parameters
        """
        if getattr(self, '_initialized', False):
            return
        
        self.use_gpu = use_gpu
        self.language = language
        self.min_confidence = min_confidence
        self.extra_params = extra_params
        
        if _PADDLEOCR_AVAILABLE:
            try:
                # Detect PaddleOCR version and use appropriate parameters
                major_version = int(_PADDLEOCR_VERSION.split('.')[0]) if _PADDLEOCR_VERSION else 2
                
                if major_version >= 3:
                    # PaddleOCR 3.x: uses use_textline_orientation
                    self._ocr = PaddleOCR(
                        use_textline_orientation=True,
                        lang=language
                    )
                else:
                    # PaddleOCR 2.x: uses use_angle_cls
                    self._ocr = PaddleOCR(
                        use_angle_cls=True,
                        lang=language,
                        show_log=False
                    )
                logger.info(f"PaddleOCR initialized (Lang: {language}, Version: {_PADDLEOCR_VERSION})")
            except Exception as e:
                logger.error(f"Failed to initialize PaddleOCR: {e}")
                self._ocr = None
        
        self._initialized = True
    
    def get_name(self) -> str:
        """Return engine identifier"""
        return 'paddle'
    
    def is_available(self) -> bool:
        """Check if PaddleOCR is installed and working"""
        if not _PADDLEOCR_AVAILABLE:
            return False
        return self._ocr is not None
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Return PaddleOCR capabilities"""
        return {
            'gpu_support': True,
            'languages': ['en', 'ch', 'japan', 'korean', 'french', 'german'],
            'confidence_scores': True,
            'bounding_boxes': True,
            'batch_processing': False,
            'async_processing': False,
            'angle_detection': True,
            'multi_line': True
        }
    
    def extract_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extract text from image using PaddleOCR.
        
        Args:
            image: numpy array (BGR or RGB)
        
        Returns:
            Standardized result dict
        """
        if not self.is_available():
            return self._create_error_result("PaddleOCR not available. Install: pip install paddlepaddle paddleocr")
        
        try:
            # Convert image if needed
            img_array = self._convert_image(image)
            
            # Detect version for API selection
            major_version = int(_PADDLEOCR_VERSION.split('.')[0]) if _PADDLEOCR_VERSION else 2
            
            lines = []
            confidences = []
            boxes = []
            
            if major_version >= 3:
                # PaddleOCR 3.x: Use predict() API
                try:
                    result_gen = self._ocr.predict(img_array)
                    result_list = list(result_gen)
                    
                    for res in result_list:
                        if hasattr(res, 'rec_texts'):
                            texts = res.rec_texts or []
                            scores = res.rec_scores or []
                            det_boxes = getattr(res, 'dt_polys', []) or []
                            
                            for i, text in enumerate(texts):
                                if text:
                                    lines.append(str(text))
                                    if i < len(scores):
                                        confidences.append(float(scores[i]))
                                    if i < len(det_boxes):
                                        boxes.append(det_boxes[i])
                except Exception as e:
                    logger.debug(f"PaddleOCR 3.x predict() failed: {e}, trying legacy ocr()")
                    major_version = 2  # Fall through to legacy API
            
            if major_version < 3 or not lines:
                # PaddleOCR 2.x: Use legacy ocr() API
                result = self._ocr.ocr(img_array, cls=True)
                
                if result and result[0]:
                    for line in result[0]:
                        if line and len(line) >= 2:
                            # Format: [box_coords, (text, confidence)]
                            text = line[1][0]
                            conf = line[1][1]
                            box = line[0]
                            
                            lines.append(str(text))
                            confidences.append(float(conf))
                            boxes.append(box)
            
            if not lines:
                logger.debug("PaddleOCR: No text extracted")
                return {
                    'text': '',
                    'confidence': 0.0,
                    'line_count': 0,
                    'success': False,
                    'engine': self.get_name()
                }
            
            # Combine text
            full_text = '\n'.join(lines)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            logger.debug(f"PaddleOCR: Extracted {len(lines)} lines (confidence: {avg_confidence:.2f})")
            
            return {
                'text': full_text,
                'confidence': avg_confidence,
                'line_count': len(lines),
                'success': True,
                'engine': self.get_name(),
                'boxes': boxes
            }
            
        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            return self._create_error_result(str(e))
    
    @classmethod
    def reset_instance(cls):
        """Reset singleton instance (useful for testing)"""
        cls._instance = None
        cls._ocr = None
