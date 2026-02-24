"""
Text Extraction with Three-Layer Fallback Strategy
1. PaddleOCR (95-98% accuracy)
2. Tesseract OCR (85-90% accuracy)
3. Return empty (metadata analysis happens in AI server)
"""
import logging
from PIL import Image
import numpy as np

from .ocr_engine import OCREngine
from .image_processor import preprocess_image, resize_if_needed

logger = logging.getLogger(__name__)

# Confidence thresholds
PADDLE_MIN_CONFIDENCE = 0.50  # Below this, try Tesseract fallback
TESSERACT_MIN_CONFIDENCE = 0.60  # Below this, rely on metadata


def extract_text_from_image(img_input, window_title='', app_name='', use_preprocessing=True):
    """
    Extract text from image using three-layer fallback strategy
    
    Args:
        img_input: PIL Image, numpy array, or file path
        window_title (str): Window title for metadata fallback
        app_name (str): Application name for metadata fallback
        use_preprocessing (bool): Apply CLAHE/denoising/sharpening
        
    Returns:
        dict: {
            'text': str,              # Extracted text
            'confidence': float,      # Confidence score
            'method': str,            # 'paddle', 'tesseract', or 'metadata'
            'success': bool,
            'window_title': str,      # Metadata (always included)
            'app_name': str           # Metadata (always included)
        }
    """
    try:
        # Convert input to PIL Image
        if isinstance(img_input, str):
            img = Image.open(img_input)
        elif isinstance(img_input, np.ndarray):
            img = Image.fromarray(img_input)
        else:
            img = img_input
        
        # Preprocess if enabled
        if use_preprocessing:
            processed_img = preprocess_image(img)
        else:
            processed_img = np.array(img)
        
        # Resize if too large
        processed_img = resize_if_needed(processed_img)
        
        # Layer 1: Try PaddleOCR
        logger.info("Attempting PaddleOCR extraction...")
        paddle_result = _extract_with_paddle(processed_img)
        
        if paddle_result['success'] and paddle_result['confidence'] >= PADDLE_MIN_CONFIDENCE:
            logger.info(f"PaddleOCR succeeded (confidence: {paddle_result['confidence']:.2f})")
            return {
                'text': paddle_result['text'],
                'confidence': paddle_result['confidence'],
                'method': 'paddle',
                'success': True,
                'window_title': window_title,
                'app_name': app_name,
                'line_count': paddle_result.get('line_count', 0)
            }
        
        # Layer 2: Fallback to Tesseract
        logger.info("PaddleOCR below threshold, trying Tesseract...")
        tesseract_result = extract_text_with_tesseract(processed_img)
        
        if tesseract_result['success'] and tesseract_result['confidence'] >= TESSERACT_MIN_CONFIDENCE:
            logger.info(f"Tesseract succeeded (confidence: {tesseract_result['confidence']:.2f})")
            return {
                'text': tesseract_result['text'],
                'confidence': tesseract_result['confidence'],
                'method': 'tesseract',
                'success': True,
                'window_title': window_title,
                'app_name': app_name,
                'line_count': tesseract_result.get('line_count', 0)
            }
        
        # Layer 3: Return empty text (AI server will use metadata)
        logger.warning("Both OCR methods failed, relying on metadata analysis")
        return {
            'text': '',
            'confidence': 0.0,
            'method': 'metadata',
            'success': False,
            'window_title': window_title,
            'app_name': app_name,
            'line_count': 0
        }
        
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


def _extract_with_paddle(img):
    """
    Extract text using PaddleOCR
    
    Args:
        img: numpy array (preprocessed)
        
    Returns:
        dict: OCR result
    """
    try:
        ocr_engine = OCREngine(use_gpu=False, lang='en')
        result = ocr_engine.extract_text(img)
        return result
    except Exception as e:
        logger.error(f"PaddleOCR extraction failed: {e}")
        return {
            'text': '',
            'confidence': 0.0,
            'success': False,
            'error': str(e)
        }


def extract_text_with_tesseract(img):
    """
    Extract text using Tesseract OCR (fallback)
    
    Args:
        img: numpy array (preprocessed)
        
    Returns:
        dict: {
            'text': str,
            'confidence': float,
            'success': bool
        }
    """
    try:
        import pytesseract
        from PIL import Image
        
        # Convert numpy array to PIL Image
        if isinstance(img, np.ndarray):
            pil_img = Image.fromarray(img)
        else:
            pil_img = img
        
        # Extract text with confidence data
        data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT)
        
        # Filter out low-confidence words
        texts = []
        confidences = []
        
        for i, conf in enumerate(data['conf']):
            if conf > 0:  # Valid detection
                text = data['text'][i].strip()
                if text:
                    texts.append(text)
                    confidences.append(conf / 100.0)  # Convert to 0-1 scale
        
        if not texts:
            logger.warning("Tesseract found no text")
            return {
                'text': '',
                'confidence': 0.0,
                'success': False
            }
        
        # Reconstruct text with line breaks
        full_text = ' '.join(texts)
        avg_confidence = sum(confidences) / len(confidences)
        
        logger.info(f"Tesseract extracted {len(texts)} words (confidence: {avg_confidence:.2f})")
        
        return {
            'text': full_text,
            'confidence': avg_confidence,
            'success': True,
            'line_count': len(texts)
        }
        
    except ImportError:
        logger.error("pytesseract not installed")
        return {
            'text': '',
            'confidence': 0.0,
            'success': False,
            'error': 'pytesseract not installed'
        }
    except Exception as e:
        logger.error(f"Tesseract extraction failed: {e}")
        return {
            'text': '',
            'confidence': 0.0,
            'success': False,
            'error': str(e)
        }
