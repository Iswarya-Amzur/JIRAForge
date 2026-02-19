"""
Demo OCR Engine - Example of how easy it is to add new engines!

Just create this file with a class ending in 'Engine' that inherits
from BaseOCREngine, and it's automatically discovered and registered.

No manual registration needed in engine_factory.py!
"""
import logging
from typing import Dict, Any
import numpy as np
from ..base_engine import BaseOCREngine
from ..config import OCREngineConfig

logger = logging.getLogger(__name__)


class DemoEngine(BaseOCREngine):
    """
    Demo OCR engine that reverses text (just for demonstration).
    
    This shows how simple it is to add a new engine - just:
        1. Create this file: engines/demo_engine.py
        2. Define DemoEngine(BaseOCREngine)
        3. Done! Auto-registered as 'demo'
    
    Configure via:
        OCR_PRIMARY_ENGINE=demo
        OCR_DEMO_MIN_CONFIDENCE=0.8
        OCR_DEMO_REVERSE_TEXT=true
    """
    
    def __init__(
        self,
        use_gpu: bool = False,
        language: str = 'en',
        min_confidence: float = 0.5,
        reverse_text: str = 'false',
        **extra_params
    ):
        """
        Initialize demo engine.
        
        Args:
            use_gpu: Ignored (demo engine doesn't use GPU)
            language: Ignored (demo engine is language-agnostic)
            min_confidence: Minimum confidence threshold
            reverse_text: Whether to reverse the demo text
            **extra_params: Additional parameters
        """
        # Create a config object for tracking
        from ..config import OCREngineConfig
        self.config = OCREngineConfig(
            name='demo',
            use_gpu=use_gpu,
            language=language,
            min_confidence=min_confidence,
            extra_params={'reverse_text': reverse_text, **extra_params}
        )
        
        self.reverse_text = str(reverse_text).lower() == 'true'
        logger.info(f"DemoEngine initialized (reverse={self.reverse_text})")
    
    def get_name(self) -> str:
        """Return engine identifier"""
        return 'demo'
    
    def is_available(self) -> bool:
        """Demo engine is always available (no dependencies)"""
        return True
    
    def extract_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        'Extract' text by generating demo output.
        
        Args:
            image: Input image (numpy array)
        
        Returns:
            Standardized result dict
        """
        try:
            # Generate demo text based on image dimensions
            height, width = image.shape[:2]
            demo_text = f"Demo OCR detected {width}x{height} image"
            
            # Reverse if configured
            if self.reverse_text:
                demo_text = demo_text[::-1]
            
            # Return success with high confidence
            return self._create_success_result(
                text=demo_text,
                confidence=0.95,
                boxes=None
            )
            
        except Exception as e:
            logger.error(f"Demo engine failed: {e}")
            return self._create_error_result(str(e))
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Return engine capabilities"""
        return {
            'languages': ['demo'],
            'supports_boxes': False,
            'supports_confidence': True,
            'supports_multiple_languages': False,
            'requires_gpu': False,
            'description': 'Demo engine for testing auto-registration'
        }
