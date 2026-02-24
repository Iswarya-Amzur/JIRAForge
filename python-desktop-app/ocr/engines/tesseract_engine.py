"""
Tesseract OCR Engine Adapter

Wraps pytesseract library to comply with BaseOCREngine interface.
Requires Tesseract binary to be installed on the system.
"""
import numpy as np
from PIL import Image
import logging
from typing import Dict, Any, Optional
import os

from ..base_engine import BaseOCREngine

logger = logging.getLogger(__name__)

# Check if pytesseract is available
_TESSERACT_AVAILABLE = False
_tesseract = None
try:
    import pytesseract
    _tesseract = pytesseract
    _TESSERACT_AVAILABLE = True
except ImportError:
    logger.debug("pytesseract not installed. Install with: pip install pytesseract")


class TesseractEngine(BaseOCREngine):
    """
    Tesseract OCR engine adapter implementing BaseOCREngine interface.
    
    Requires:
        - pytesseract Python package: pip install pytesseract
        - Tesseract binary installed on system:
            - Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
            - Linux: apt install tesseract-ocr
            - macOS: brew install tesseract
    
    Configuration via environment variables:
        OCR_TESSERACT_LANGUAGE: eng, deu, fra, etc. (default: eng)
        OCR_TESSERACT_MIN_CONFIDENCE: 0.0-1.0 (default: 0.6)
        OCR_TESSERACT_PATH: Path to tesseract binary (optional)
    
    Or via OCREngineConfig:
        config.engines['tesseract'] = OCREngineConfig(
            name='tesseract',
            language='eng',
            extra_params={'tesseract_path': 'C:/Program Files/Tesseract-OCR/tesseract.exe'}
        )
    """
    
    _instance: Optional['TesseractEngine'] = None
    
    def __new__(cls, *args, **kwargs):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super(TesseractEngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(
        self,
        use_gpu: bool = False,  # Tesseract doesn't support GPU
        language: str = 'eng',
        min_confidence: float = 0.6,
        **extra_params
    ):
        """
        Initialize Tesseract engine.
        
        Args:
            use_gpu: Ignored (Tesseract doesn't support GPU)
            language: OCR language ('eng', 'deu', 'fra', etc.)
            min_confidence: Minimum confidence threshold
            **extra_params: Additional params (tesseract_path, config, etc.)
        """
        if getattr(self, '_initialized', False):
            return
        
        self.language = language
        self.min_confidence = min_confidence
        self.extra_params = extra_params
        
        # Set Tesseract path if provided
        tesseract_path = extra_params.get('tesseract_path') or os.getenv('TESSERACT_CMD') or os.getenv('OCR_TESSERACT_PATH')
        if tesseract_path and _TESSERACT_AVAILABLE:
            _tesseract.pytesseract.tesseract_cmd = tesseract_path
            logger.debug(f"Tesseract path set to: {tesseract_path}")
        
        # Set TESSDATA_PREFIX if provided (for language data files)
        tessdata_prefix = os.getenv('TESSDATA_PREFIX')
        if tessdata_prefix:
            os.environ['TESSDATA_PREFIX'] = tessdata_prefix
            logger.debug(f"TESSDATA_PREFIX set to: {tessdata_prefix}")
        
        self._initialized = True
        logger.info(f"Tesseract engine initialized (Lang: {language})")
    
    def get_name(self) -> str:
        """Return engine identifier"""
        return 'tesseract'
    
    def is_available(self) -> bool:
        """Check if Tesseract is installed and working"""
        if not _TESSERACT_AVAILABLE:
            return False
        
        try:
            # Try to get tesseract version to verify binary is accessible
            _tesseract.get_tesseract_version()
            return True
        except Exception as e:
            logger.debug(f"Tesseract not available: {e}")
            return False
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Return Tesseract capabilities"""
        return {
            'gpu_support': False,
            'languages': ['eng', 'deu', 'fra', 'spa', 'ita', 'por', 'rus', 'chi_sim', 'chi_tra', 'jpn', 'kor'],
            'confidence_scores': True,
            'bounding_boxes': True,
            'batch_processing': False,
            'async_processing': False,
            'page_segmentation_modes': True,
            'oem_modes': True
        }
    
    def extract_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extract text from image using Tesseract.
        
        Args:
            image: numpy array
        
        Returns:
            Standardized result dict
        """
        if not self.is_available():
            return self._create_error_result(
                "Tesseract not available. Install pytesseract and Tesseract binary."
            )
        
        try:
            # Convert to PIL Image for pytesseract
            if isinstance(image, np.ndarray):
                pil_image = Image.fromarray(image)
            else:
                pil_image = image
            
            # Build tesseract config
            custom_config = self.extra_params.get('config', '--oem 3 --psm 3')
            
            # Get detailed data with confidence scores
            data = _tesseract.image_to_data(
                pil_image,
                lang=self.language,
                config=custom_config,
                output_type=_tesseract.Output.DICT
            )
            
            # Extract text and confidence
            lines = []
            confidences = []
            boxes = []
            
            current_line = []
            current_line_conf = []
            last_line_num = -1
            
            for i, text in enumerate(data['text']):
                conf = int(data['conf'][i])
                line_num = data['line_num'][i]
                
                # Skip empty or low confidence
                if not text.strip() or conf < 0:
                    continue
                
                # New line detected
                if line_num != last_line_num and current_line:
                    lines.append(' '.join(current_line))
                    if current_line_conf:
                        confidences.append(sum(current_line_conf) / len(current_line_conf) / 100.0)
                    current_line = []
                    current_line_conf = []
                
                current_line.append(text)
                current_line_conf.append(conf)
                last_line_num = line_num
                
                # Store bounding box
                x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                boxes.append([[x, y], [x+w, y], [x+w, y+h], [x, y+h]])
            
            # Don't forget last line
            if current_line:
                lines.append(' '.join(current_line))
                if current_line_conf:
                    confidences.append(sum(current_line_conf) / len(current_line_conf) / 100.0)
            
            # Calculate overall confidence
            full_text = '\n'.join(lines)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            if not full_text.strip():
                return {
                    'text': '',
                    'confidence': 0.0,
                    'line_count': 0,
                    'success': False,
                    'engine': self.get_name()
                }
            
            logger.debug(f"Tesseract: Extracted {len(lines)} lines (confidence: {avg_confidence:.2f})")
            
            return {
                'text': full_text,
                'confidence': avg_confidence,
                'line_count': len(lines),
                'success': True,
                'engine': self.get_name(),
                'boxes': boxes
            }
            
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return self._create_error_result(str(e))
    
    @classmethod
    def reset_instance(cls):
        """Reset singleton instance (useful for testing)"""
        cls._instance = None
