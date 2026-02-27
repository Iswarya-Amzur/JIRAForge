"""
OCR Engines Package

Contains adapters for various OCR engines, all implementing BaseOCREngine.
"""
# Import engine classes for convenient access
from .paddle_engine import PaddleOCREngine
from .tesseract_engine import TesseractEngine

try:
    from .mock_engine import MockOCREngine
except ImportError:
    MockOCREngine = None

__all__ = [
    'PaddleOCREngine',
    'TesseractEngine',
]
if MockOCREngine is not None:
    __all__.append('MockOCREngine')
