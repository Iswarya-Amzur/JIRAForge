"""
Image Preprocessing for OCR
CLAHE, denoising, sharpening for better text extraction
"""
import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)


def preprocess_image(img_input, target_dpi=300):
    """
    Preprocess image for better OCR accuracy
    
    Steps:
    1. Convert to grayscale
    2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    3. Denoise
    4. Sharpen
    5. Optional upscale if too small
    
    Args:
        img_input: PIL Image or numpy array
        target_dpi (int): Target DPI for upscaling
        
    Returns:
        numpy array: Preprocessed image
    """
    try:
        # Convert PIL Image to numpy array if needed
        if isinstance(img_input, Image.Image):
            img = np.array(img_input)
        else:
            img = img_input.copy()
        
        # Convert to grayscale if needed
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        else:
            gray = img
        
        # CLAHE - improve contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(enhanced, None, h=10)
        
        # Sharpen
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]])
        sharpened = cv2.filter2D(denoised, -1, kernel)
        
        # Resize if too small (< 150 DPI equivalent)
        min_dimension = 1000  # Pixels
        height, width = sharpened.shape
        if min(height, width) < min_dimension:
            scale = min_dimension / min(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            sharpened = cv2.resize(sharpened, (new_width, new_height), 
                                 interpolation=cv2.INTER_CUBIC)
            logger.info(f"Upscaled image from {width}x{height} to {new_width}x{new_height}")
        
        return sharpened
        
    except Exception as e:
        logger.error(f"Image preprocessing failed: {e}")
        # Return original grayscale if preprocessing fails
        if isinstance(img_input, Image.Image):
            return cv2.cvtColor(np.array(img_input), cv2.COLOR_RGB2GRAY)
        return img_input


def resize_if_needed(img, max_dimension=4096):
    """
    Resize image if too large (reduces memory usage)
    
    Args:
        img: Numpy array
        max_dimension (int): Maximum width/height
        
    Returns:
        numpy array: Resized image (if needed)
    """
    try:
        height, width = img.shape[:2]
        
        if max(height, width) <= max_dimension:
            return img
        
        # Calculate scale
        scale = max_dimension / max(height, width)
        new_width = int(width * scale)
        new_height = int(height * scale)
        
        resized = cv2.resize(img, (new_width, new_height), 
                           interpolation=cv2.INTER_AREA)
        logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        return resized
        
    except Exception as e:
        logger.error(f"Image resize failed: {e}")
        return img
