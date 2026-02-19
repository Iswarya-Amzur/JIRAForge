"""
Dynamic OCR Engine Adapter

Automatically creates engine adapters for any OCR library configured in .env
No need to manually create engine files - just configure and it works!

Supports common OCR library patterns:
- Libraries with extract_text() or recognize() methods
- Libraries that return text directly or in structured format
- Automatic confidence score detection

Usage:
    # In .env:
    OCR_PRIMARY_ENGINE=suryaocr
    OCR_SURYAOCR_PACKAGE=surya
    OCR_SURYAOCR_MODEL=vikp/surya_rec
    
    # System automatically creates adapter and uses it!
"""

import importlib
import logging
from typing import Dict, Any, Optional
import numpy as np
from PIL import Image

from ..base_engine import BaseOCREngine

logger = logging.getLogger(__name__)


class DynamicOCREngine(BaseOCREngine):
    """
    Dynamic OCR engine that adapts to any OCR library.
    
    Automatically detects library interface and provides standardized access.
    Configured via environment variables:
        OCR_<ENGINE>_PACKAGE=package_name
        OCR_<ENGINE>_CLASS=ClassName (optional)
        OCR_<ENGINE>_METHOD=method_name (default: tries common methods)
    """
    
    # Common OCR library method names
    COMMON_METHODS = [
        'extract_text',
        'recognize',
        'ocr',
        'detect_and_recognize',
        'read',
        'readtext',
        'process',
    ]
    
    def __init__(
        self,
        engine_name: str,
        package_name: str,
        class_name: Optional[str] = None,
        method_name: Optional[str] = None,
        use_gpu: bool = False,
        language: str = 'en',
        min_confidence: float = 0.5,
        **extra_params
    ):
        """
        Initialize dynamic OCR engine.
        
        Args:
            engine_name: Engine identifier (e.g., 'suryaocr')
            package_name: Python package to import (e.g., 'surya')
            class_name: Class to instantiate (if None, tries common patterns)
            method_name: OCR method to call (if None, auto-detects)
            use_gpu: Use GPU acceleration
            language: OCR language
            min_confidence: Minimum confidence threshold
            **extra_params: Engine-specific parameters
        """
        self.engine_name = engine_name
        self.package_name = package_name
        self.class_name = class_name
        self.method_name = method_name
        self.use_gpu = use_gpu
        self.language = language
        self.min_confidence = min_confidence
        self.extra_params = extra_params
        
        self._ocr_instance = None
        self._ocr_method = None
        self._initialized = False
    
    def get_name(self) -> str:
        """Return engine identifier"""
        return self.engine_name
    
    def is_available(self) -> bool:
        """Check if the OCR package is installed"""
        try:
            importlib.import_module(self.package_name)
            return True
        except ImportError:
            logger.debug(f"Package '{self.package_name}' not installed for {self.engine_name}")
            return False
    
    def _initialize(self):
        """Lazy initialization of OCR library"""
        if self._initialized:
            return
        
        try:
            # Import the package
            module = importlib.import_module(self.package_name)
            logger.debug(f"Imported package: {self.package_name}")
            
            # Find the OCR class
            if self.class_name:
                # User specified class name
                ocr_class = getattr(module, self.class_name)
            else:
                # Try common class patterns
                ocr_class = self._find_ocr_class(module)
            
            if ocr_class:
                # Instantiate with parameters
                init_params = self._build_init_params()
                self._ocr_instance = ocr_class(**init_params)
                logger.info(f"Initialized {self.engine_name} with class {ocr_class.__name__}")
            else:
                # No class needed - module-level functions
                self._ocr_instance = module
                logger.info(f"Using {self.engine_name} module-level API")
            
            # Find the OCR method
            if self.method_name:
                self._ocr_method = getattr(self._ocr_instance, self.method_name)
            else:
                self._ocr_method = self._find_ocr_method(self._ocr_instance)
            
            if not self._ocr_method:
                raise ValueError(f"Could not find OCR method for {self.engine_name}")
            
            self._initialized = True
            logger.info(f"Dynamic engine ready: {self.engine_name}")
            
        except Exception as e:
            logger.error(f"Failed to initialize {self.engine_name}: {e}")
            self._initialized = False
    
    def _find_ocr_class(self, module):
        """Try to find the OCR class in the module"""
        # Common OCR class name patterns
        common_patterns = [
            f"{self.engine_name}OCR",
            f"{self.engine_name.capitalize()}OCR",
            "OCR",
            "Reader",
            "Recognizer",
            "Detector",
        ]
        
        for pattern in common_patterns:
            if hasattr(module, pattern):
                return getattr(module, pattern)
        
        # Look for any class with OCR/Reader/Recognizer in name
        for attr_name in dir(module):
            if any(keyword in attr_name.lower() for keyword in ['ocr', 'reader', 'recognizer']):
                attr = getattr(module, attr_name)
                if isinstance(attr, type):  # It's a class
                    return attr
        
        return None
    
    def _find_ocr_method(self, instance):
        """Auto-detect the OCR method"""
        # Try common method names
        for method_name in self.COMMON_METHODS:
            if hasattr(instance, method_name):
                return getattr(instance, method_name)
        
        return None
    
    def _build_init_params(self) -> Dict[str, Any]:
        """Build initialization parameters for the OCR class"""
        params = {}
        
        # Common parameter mappings
        if self.use_gpu:
            # Try different GPU parameter names
            for gpu_param in ['use_gpu', 'gpu', 'device']:
                if gpu_param in self.extra_params or gpu_param == 'use_gpu':
                    params[gpu_param] = True if gpu_param == 'use_gpu' else 'cuda'
        
        if self.language:
            # Try different language parameter names
            for lang_param in ['lang', 'language', 'languages']:
                if lang_param in self.extra_params or lang_param in ['lang', 'language']:
                    params[lang_param] = self.language
                    break
        
        # Add all extra parameters
        params.update(self.extra_params)
        
        return params
    
    def extract_text(self, image: np.ndarray) -> Dict[str, Any]:
        """
        Extract text using the dynamic OCR engine.
        
        Args:
            image: numpy array (BGR or RGB)
        
        Returns:
            Standardized result dict
        """
        if not self.is_available():
            return self._create_error_result(
                f"{self.engine_name} not available. "
                f"Install: pip install {self.package_name}"
            )
        
        # Initialize if needed
        self._initialize()
        
        if not self._initialized or not self._ocr_method:
            return self._create_error_result(
                f"Failed to initialize {self.engine_name}"
            )
        
        try:
            # Convert image to format the library expects
            img_input = self._convert_image(image)
            
            # Call the OCR method
            result = self._ocr_method(img_input)
            
            # Parse the result into standardized format
            return self._parse_result(result)
            
        except Exception as e:
            logger.error(f"{self.engine_name} extraction failed: {e}")
            return self._create_error_result(str(e))
    
    def _parse_result(self, result) -> Dict[str, Any]:
        """
        Parse OCR result into standardized format.
        
        Handles various result formats:
        - String: "extracted text"
        - Dict: {'text': '...', 'confidence': 0.9}
        - List: [('text1', 0.9), ('text2', 0.8)]
        - List of dicts: [{'text': '...', 'conf': 0.9}, ...]
        """
        try:
            # Case 1: Plain string
            if isinstance(result, str):
                return self._create_success_result(
                    text=result,
                    confidence=0.95  # Assume high confidence if not provided
                )
            
            # Case 2: Dictionary with text
            if isinstance(result, dict):
                text = result.get('text', result.get('content', ''))
                confidence = result.get('confidence', result.get('conf', result.get('score', 0.95)))
                boxes = result.get('boxes', result.get('bounding_boxes'))
                
                return self._create_success_result(
                    text=text,
                    confidence=float(confidence),
                    boxes=boxes
                )
            
            # Case 3: List of results
            if isinstance(result, list) and result:
                texts = []
                confidences = []
                boxes = []
                
                for item in result:
                    if isinstance(item, tuple):
                        # (text, confidence) or (bbox, text, confidence)
                        if len(item) == 2:
                            texts.append(str(item[0]))
                            confidences.append(float(item[1]))
                        elif len(item) >= 3:
                            boxes.append(item[0])
                            texts.append(str(item[1]))
                            confidences.append(float(item[2]))
                    
                    elif isinstance(item, dict):
                        # {'text': '...', 'confidence': 0.9}
                        texts.append(str(item.get('text', item.get('content', ''))))
                        confidences.append(float(item.get('confidence', item.get('conf', 0.95))))
                        if 'box' in item or 'bbox' in item:
                            boxes.append(item.get('box', item.get('bbox')))
                    
                    elif isinstance(item, str):
                        texts.append(item)
                        confidences.append(0.95)
                
                if texts:
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.95
                    return self._create_success_result(
                        text='\n'.join(texts),
                        confidence=avg_confidence,
                        boxes=boxes if boxes else None
                    )
            
            # Unknown format
            logger.warning(f"Unknown result format from {self.engine_name}: {type(result)}")
            return self._create_error_result(f"Unknown result format: {type(result)}")
            
        except Exception as e:
            logger.error(f"Failed to parse {self.engine_name} result: {e}")
            return self._create_error_result(f"Parse error: {e}")


def create_dynamic_engine(engine_name: str, config_params: Dict[str, Any]) -> Optional[DynamicOCREngine]:
    """
    Factory function to create a dynamic engine from configuration.
    
    Args:
        engine_name: Engine identifier
        config_params: Configuration parameters (from OCREngineConfig.extra_params)
    
    Returns:
        DynamicOCREngine instance or None if package not specified
    """
    package_name = config_params.get('package') or config_params.get('package_name')
    
    # Smart fallback: Try to guess package name from engine name
    if not package_name:
        package_name = _guess_package_name(engine_name)
        if package_name:
            logger.info(f"Auto-detected package '{package_name}' for engine '{engine_name}'")
        else:
            logger.warning(
                f"No package specified for {engine_name}. "
                f"Set OCR_{engine_name.upper()}_PACKAGE in .env or install matching package"
            )
            return None
    
    class_name = config_params.get('class') or config_params.get('class_name')
    method_name = config_params.get('method') or config_params.get('method_name')
    
    return DynamicOCREngine(
        engine_name=engine_name,
        package_name=package_name,
        class_name=class_name,
        method_name=method_name,
        **config_params
    )


def _guess_package_name(engine_name: str) -> Optional[str]:
    """
    Try to guess the Python package name from the engine name.
    
    Tries common patterns:
    - Exact match (engine_name itself)
    - Remove 'ocr' suffix/prefix
    - Add 'ocr' suffix
    - Common mappings
    
    Args:
        engine_name: Engine identifier
    
    Returns:
        Package name (best guess), or None if no good guess
    """
    # Common known mappings (highest priority)
    known_mappings = {
        'paddle': 'paddleocr',
        'paddleocr': 'paddleocr',
        'tesseract': 'pytesseract',
        'easyocr': 'easyocr',
        'suryaocr': 'surya-ocr',
        'surya': 'surya-ocr',
        'doctr': 'python-doctr',
        'trocr': 'transformers',
        'kerasocr': 'keras_ocr',
    }
    
    engine_lower = engine_name.lower()
    
    # 1. Check known mappings first
    if engine_lower in known_mappings:
        return known_mappings[engine_lower]
    
    # 2. Try the engine name as-is (if installed, great; if not, still return it)
    if _can_import(engine_name):
        return engine_name
    
    # 3. Try removing 'ocr' suffix
    if engine_lower.endswith('ocr'):
        base_name = engine_name[:-3]
        if _can_import(base_name):
            return base_name
        # Even if not installed, this is a good guess
        candidates = [base_name]
    else:
        candidates = []
    
    # 4. Try adding 'ocr' suffix
    with_ocr = f"{engine_name}ocr"
    if _can_import(with_ocr):
        return with_ocr
    candidates.append(with_ocr)
    
    # 5. Try py- prefix (pytesseract pattern)
    py_prefixed = f"py{engine_name}"
    if _can_import(py_prefixed):
        return py_prefixed
    candidates.append(py_prefixed)
    
    # 6. Try with underscore
    with_underscore = engine_name.replace('-', '_')
    if _can_import(with_underscore) and with_underscore != engine_name:
        return with_underscore
    
    # 7. Try with hyphen
    with_hyphen = engine_name.replace('_', '-')
    if _can_import(with_hyphen) and with_hyphen != engine_name:
        return with_hyphen
    
    # 8. Return best guess even if not installed
    # Prefer: name with 'ocr' removed > py-prefixed > as-is
    if candidates:
        logger.debug(f"Package not installed, returning best guess from: {candidates}")
        return candidates[0] if len(candidates) > 0 else engine_name
    
    # 9. Last resort: return engine name as-is
    logger.debug(f"No good guess for '{engine_name}', using as-is")
    return engine_name


def _can_import(package_name: str) -> bool:
    """Check if a package can be imported"""
    try:
        importlib.import_module(package_name)
        return True
    except (ImportError, ModuleNotFoundError):
        return False
