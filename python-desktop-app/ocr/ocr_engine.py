"""
PaddleOCR Engine Wrapper
Handles text extraction from images using PP-OCRv5
Implements singleton pattern to avoid reloading models
"""
from paddleocr import PaddleOCR
import numpy as np
from PIL import Image
import logging
import os

logger = logging.getLogger(__name__)


class OCREngine:
    _instance = None  # Singleton to avoid reloading models
    
    def __new__(cls, use_gpu=False, lang='en'):
        """Singleton pattern - reuse model instance"""
        if cls._instance is None:
            cls._instance = super(OCREngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, use_gpu=False, lang='en'):
        """
        Initialize PaddleOCR engine (singleton)
        
        Args:
            use_gpu (bool): Use GPU acceleration
            lang (str): Language code ('en', 'ch', etc.)
        """
        if self._initialized:
            return
            
        try:
            self.ocr = PaddleOCR(
                use_angle_cls=True,      # Enable text angle detection
                lang=lang,               # Language
                use_gpu=use_gpu,         # GPU support
                show_log=False,          # Reduce verbosity
                det_model_dir=None,      # Use default PP-OCRv5 detection
                rec_model_dir=None,      # Use default PP-OCRv5 recognition
                cls_model_dir=None       # Use default angle classifier
            )
            self.use_gpu = use_gpu
            self.lang = lang
            self._initialized = True
            logger.info(f"PaddleOCR initialized (GPU: {use_gpu}, Lang: {lang})")
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {e}")
            raise
    
    def extract_text(self, img_input):
        """
        Extract text from image
        
        Args:
            img_input: PIL Image, numpy array, or file path
            
        Returns:
            dict: {
                'text': str,           # Extracted text
                'confidence': float,   # Average confidence
                'line_count': int,     # Number of text lines detected
                'success': bool
            }
        """
        try:
            # Convert PIL Image to numpy array if needed
            if isinstance(img_input, Image.Image):
                img_array = np.array(img_input)
            elif isinstance(img_input, str):
                img_array = np.array(Image.open(img_input))
            else:
                img_array = img_input
            
            # Run OCR
            result = self.ocr.ocr(img_array, cls=True)
            
            if not result or not result[0]:
                logger.warning("No text detected in image")
                return {
                    'text': '',
                    'confidence': 0.0,
                    'line_count': 0,
                    'success': False
                }
            
            # Extract text and confidence scores
            lines = []
            confidences = []
            
            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]  # Text content
                    conf = line[1][1]  # Confidence score
                    lines.append(text)
                    confidences.append(conf)
            
            # Combine text
            full_text = '\n'.join(lines)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            logger.info(f"OCR extracted {len(lines)} lines (confidence: {avg_confidence:.2f})")
            
            return {
                'text': full_text,
                'confidence': avg_confidence,
                'line_count': len(lines),
                'success': True
            }
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return {
                'text': '',
                'confidence': 0.0,
                'line_count': 0,
                'success': False,
                'error': str(e)
            }
