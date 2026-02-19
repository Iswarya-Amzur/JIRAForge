"""
OCR Engines Package

Contains adapters for various OCR engines, all implementing BaseOCREngine.
"""
# Import engine classes for convenient access
from .paddle_engine import PaddleOCREngine
from .tesseract_engine import TesseractEngine
from .mock_engine import MockOCREngine

__all__ = [
    'PaddleOCREngine',
    'TesseractEngine',
    'MockOCREngine',
]
