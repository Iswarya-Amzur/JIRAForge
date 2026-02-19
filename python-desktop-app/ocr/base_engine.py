"""
Abstract Base Class for OCR Engines

All OCR engine implementations must inherit from this class.
Implements the Strategy pattern for interchangeable OCR algorithms.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)


class BaseOCREngine(ABC):
    """
    Abstract base class for all OCR engines.
    
    Implements the Strategy pattern for interchangeable OCR algorithms.
    All concrete engine implementations must inherit from this class.
    
    Methods to implement:
        - get_name(): Return engine identifier
        - extract_text(image): Perform OCR on image
        - is_available(): Check if engine dependencies are available
    
    Optional methods to override:
        - get_capabilities(): Return engine capabilities dict
    """
    
    @abstractmethod
    def get_name(self) -> str:
        """
        Return the engine name (used for identification and logging).
        
        Returns:
            str: Engine name (e.g., 'paddle', 'tesseract', 'easyocr')
        """
        pass
    
    @abstractmethod
    def extract_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extract text from image.
        
        Args:
            image: numpy array (BGR or grayscale)
        
        Returns:
            dict with standardized fields:
                - text (str): Extracted text
                - confidence (float): Overall confidence 0.0-1.0
                - line_count (int): Number of text lines detected
                - success (bool): Whether extraction succeeded
                - error (str, optional): Error message if failed
                - boxes (list, optional): Bounding boxes for text regions
                - engine (str): Engine name that performed extraction
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this engine is available (dependencies installed and working).
        
        Should verify:
            1. Required Python packages are installed
            2. Required external tools are available (e.g., Tesseract binary)
            3. Required credentials/API keys are configured (for cloud engines)
        
        Returns:
            bool: True if engine can be used, False otherwise
        """
        pass
    
    def get_capabilities(self) -> Dict[str, Any]:
        """
        Return engine capabilities and features.
        
        Override this method to advertise specific capabilities.
        
        Returns:
            dict with capability flags:
                - gpu_support (bool): Can use GPU acceleration
                - languages (list): Supported language codes
                - confidence_scores (bool): Provides confidence scores
                - bounding_boxes (bool): Provides text bounding boxes
                - batch_processing (bool): Can process multiple images
                - async_processing (bool): Supports async operation
        """
        return {
            'gpu_support': False,
            'languages': ['en'],
            'confidence_scores': True,
            'bounding_boxes': False,
            'batch_processing': False,
            'async_processing': False
        }
    
    def _convert_image(self, image) -> np.ndarray:
        """
        Convert various image formats to numpy array.
        
        Args:
            image: PIL Image, numpy array, or file path
        
        Returns:
            numpy array in BGR format
        """
        if isinstance(image, str):
            # File path
            from PIL import Image as PILImage
            pil_img = PILImage.open(image)
            return np.array(pil_img)
        elif isinstance(image, Image.Image):
            # PIL Image
            return np.array(image)
        elif isinstance(image, np.ndarray):
            # Already numpy array
            return image
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")
    
    def _create_error_result(self, error_message: str) -> Dict[str, Any]:
        """
        Create standardized error result.
        
        Args:
            error_message: Description of what went wrong
        
        Returns:
            Standard result dict with success=False
        """
        return {
            'text': '',
            'confidence': 0.0,
            'line_count': 0,
            'success': False,
            'error': error_message,
            'engine': self.get_name()
        }
    
    def _create_success_result(
        self, 
        text: str, 
        confidence: float,
        boxes: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Create standardized success result.
        
        Args:
            text: Extracted text
            confidence: Overall confidence score
            boxes: Optional bounding boxes
        
        Returns:
            Standard result dict with success=True
        """
        result = {
            'text': text,
            'confidence': confidence,
            'line_count': len([line for line in text.split('\n') if line.strip()]),
            'success': True,
            'engine': self.get_name()
        }
        if boxes is not None:
            result['boxes'] = boxes
        return result
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name='{self.get_name()}', available={self.is_available()})>"
