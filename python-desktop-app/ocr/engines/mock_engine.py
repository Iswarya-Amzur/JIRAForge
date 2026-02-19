"""
Mock OCR Engine for Testing

Returns configurable results for unit tests.
Always available - no external dependencies.
"""
import logging
from typing import Dict, Any, Optional
import numpy as np

from ..base_engine import BaseOCREngine

logger = logging.getLogger(__name__)


class MockOCREngine(BaseOCREngine):
    """
    Mock OCR engine for testing purposes.
    
    Features:
        - Always available (no external dependencies)
        - Configurable mock results
        - Call count tracking for test assertions
        - Can simulate errors
    
    Usage in tests:
        engine = MockOCREngine(mock_text="Hello World", mock_confidence=0.95)
        result = engine.extract_text(some_image)
        assert result['text'] == "Hello World"
        assert engine.call_count == 1
    
    Inject via factory:
        EngineFactory.register('mock', MockOCREngine)
        # Then set OCR_PRIMARY_ENGINE=mock in tests
    """
    
    # Class-level storage for singleton pattern
    _instance: Optional['MockOCREngine'] = None
    
    def __new__(cls, *args, **kwargs):
        """Singleton pattern for consistency with other engines"""
        if cls._instance is None:
            cls._instance = super(MockOCREngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(
        self,
        mock_text: str = "Mock extracted text",
        mock_confidence: float = 0.95,
        mock_success: bool = True,
        mock_error: Optional[str] = None,
        **extra_params
    ):
        """
        Initialize mock engine with configurable results.
        
        Args:
            mock_text: Text to return from extract_text()
            mock_confidence: Confidence score to return
            mock_success: Whether extraction should succeed
            mock_error: Error message if simulating failure
            **extra_params: Ignored (for API compatibility)
        """
        if getattr(self, '_initialized', False):
            # Update mock values even if already initialized
            self._mock_text = mock_text
            self._mock_confidence = mock_confidence
            self._mock_success = mock_success
            self._mock_error = mock_error
            return
        
        self._mock_text = mock_text
        self._mock_confidence = mock_confidence
        self._mock_success = mock_success
        self._mock_error = mock_error
        self._call_count = 0
        self._last_image = None
        
        self._initialized = True
        logger.debug("MockOCREngine initialized")
    
    def get_name(self) -> str:
        """Return engine identifier"""
        return 'mock'
    
    def is_available(self) -> bool:
        """Mock engine is always available"""
        return True
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Return mock capabilities"""
        return {
            'gpu_support': False,
            'languages': ['en', 'mock'],
            'confidence_scores': True,
            'bounding_boxes': False,
            'batch_processing': False,
            'async_processing': False,
            'is_mock': True  # Flag to identify mock engine
        }
    
    def extract_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Return mock extraction result.
        
        Args:
            image: Image (stored for test inspection)
        
        Returns:
            Configured mock result
        """
        self._call_count += 1
        self._last_image = image
        
        logger.debug(f"MockOCREngine.extract_text called (count: {self._call_count})")
        
        # Simulate error if configured
        if self._mock_error:
            return {
                'text': '',
                'confidence': 0.0,
                'line_count': 0,
                'success': False,
                'error': self._mock_error,
                'engine': self.get_name()
            }
        
        # Return configured mock result
        return {
            'text': self._mock_text,
            'confidence': self._mock_confidence,
            'line_count': len([l for l in self._mock_text.split('\n') if l.strip()]),
            'success': self._mock_success,
            'engine': self.get_name()
        }
    
    # Test helper methods
    
    @property
    def call_count(self) -> int:
        """Number of times extract_text was called"""
        return self._call_count
    
    @property
    def last_image(self):
        """Last image passed to extract_text"""
        return self._last_image
    
    def set_mock_result(
        self,
        text: Optional[str] = None,
        confidence: Optional[float] = None,
        success: Optional[bool] = None,
        error: Optional[str] = None
    ):
        """
        Update mock result dynamically.
        
        Args:
            text: New mock text (None to keep current)
            confidence: New confidence (None to keep current)
            success: New success flag (None to keep current)
            error: New error message (None to keep current, '' to clear)
        """
        if text is not None:
            self._mock_text = text
        if confidence is not None:
            self._mock_confidence = confidence
        if success is not None:
            self._mock_success = success
        if error is not None:
            self._mock_error = error if error else None
    
    def reset_call_count(self):
        """Reset call counter to 0"""
        self._call_count = 0
        self._last_image = None
    
    @classmethod
    def reset_instance(cls):
        """Reset singleton instance completely"""
        cls._instance = None
