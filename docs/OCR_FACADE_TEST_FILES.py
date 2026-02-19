"""
OCR Facade Pattern Test Suite
Comprehensive tests for the refactored OCR module

Run tests:
    pytest tests/test_ocr/ -v

Run with coverage:
    pytest tests/test_ocr/ --cov=ocr --cov-report=html
"""

# ==============================================================================
# Test 1: test_base_engine.py - Abstract Base Class Tests
# ==============================================================================
"""
tests/test_ocr/test_base_engine.py
"""

import pytest
import numpy as np
from PIL import Image
from abc import ABC

# Test that BaseOCREngine enforces interface
class TestBaseOCREngine:
    """Test the abstract base class"""
    
    def test_cannot_instantiate_directly(self):
        """BaseOCREngine should not be instantiatable"""
        from ocr.base_engine import BaseOCREngine
        
        with pytest.raises(TypeError):
            BaseOCREngine()
    
    def test_must_implement_get_name(self):
        """Subclasses must implement get_name()"""
        from ocr.base_engine import BaseOCREngine
        
        class IncompleteEngine(BaseOCREngine):
            def extract_text(self, image):
                return {}
            def is_available(self):
                return True
            # Missing: get_name()
        
        with pytest.raises(TypeError):
            IncompleteEngine()
    
    def test_must_implement_extract_text(self):
        """Subclasses must implement extract_text()"""
        from ocr.base_engine import BaseOCREngine
        
        class IncompleteEngine(BaseOCREngine):
            def get_name(self):
                return 'incomplete'
            def is_available(self):
                return True
            # Missing: extract_text()
        
        with pytest.raises(TypeError):
            IncompleteEngine()
    
    def test_must_implement_is_available(self):
        """Subclasses must implement is_available()"""
        from ocr.base_engine import BaseOCREngine
        
        class IncompleteEngine(BaseOCREngine):
            def get_name(self):
                return 'incomplete'
            def extract_text(self, image):
                return {}
            # Missing: is_available()
        
        with pytest.raises(TypeError):
            IncompleteEngine()
    
    def test_complete_implementation_works(self):
        """A complete implementation should work"""
        from ocr.base_engine import BaseOCREngine
        
        class CompleteEngine(BaseOCREngine):
            def get_name(self):
                return 'complete'
            def extract_text(self, image):
                return {'text': 'test', 'confidence': 1.0, 'success': True, 'line_count': 1}
            def is_available(self):
                return True
        
        engine = CompleteEngine()
        assert engine.get_name() == 'complete'
        assert engine.is_available() == True
    
    def test_convert_image_from_pil(self):
        """_convert_image should handle PIL Images"""
        from ocr.base_engine import BaseOCREngine
        
        class TestEngine(BaseOCREngine):
            def get_name(self): return 'test'
            def extract_text(self, img): return {}
            def is_available(self): return True
        
        engine = TestEngine()
        pil_img = Image.new('RGB', (100, 100), color='white')
        
        result = engine._convert_image(pil_img)
        
        assert isinstance(result, np.ndarray)
        assert result.shape == (100, 100, 3)
    
    def test_convert_image_from_numpy(self):
        """_convert_image should pass through numpy arrays"""
        from ocr.base_engine import BaseOCREngine
        
        class TestEngine(BaseOCREngine):
            def get_name(self): return 'test'
            def extract_text(self, img): return {}
            def is_available(self): return True
        
        engine = TestEngine()
        np_img = np.zeros((100, 100, 3), dtype=np.uint8)
        
        result = engine._convert_image(np_img)
        
        assert isinstance(result, np.ndarray)
        assert np.array_equal(result, np_img)
    
    def test_create_error_result(self):
        """_create_error_result should return standard error format"""
        from ocr.base_engine import BaseOCREngine
        
        class TestEngine(BaseOCREngine):
            def get_name(self): return 'test'
            def extract_text(self, img): return {}
            def is_available(self): return True
        
        engine = TestEngine()
        result = engine._create_error_result("Test error")
        
        assert result['text'] == ''
        assert result['confidence'] == 0.0
        assert result['line_count'] == 0
        assert result['success'] == False
        assert result['error'] == "Test error"
    
    def test_get_capabilities_default(self):
        """get_capabilities should return sensible defaults"""
        from ocr.base_engine import BaseOCREngine
        
        class TestEngine(BaseOCREngine):
            def get_name(self): return 'test'
            def extract_text(self, img): return {}
            def is_available(self): return True
        
        engine = TestEngine()
        caps = engine.get_capabilities()
        
        assert 'gpu_support' in caps
        assert 'languages' in caps
        assert 'confidence_scores' in caps


# ==============================================================================
# Test 2: test_config.py - Configuration Tests
# ==============================================================================
"""
tests/test_ocr/test_config.py
"""

import pytest
import os
import tempfile
import json

class TestOCREngineConfig:
    """Test OCREngineConfig dataclass"""
    
    def test_default_values(self):
        """Test default configuration values"""
        from ocr.config import OCREngineConfig
        
        config = OCREngineConfig(name='test')
        
        assert config.name == 'test'
        assert config.enabled == True
        assert config.priority == 0
        assert config.min_confidence == 0.5
        assert config.use_gpu == False
        assert config.language == 'en'
    
    def test_custom_values(self):
        """Test custom configuration values"""
        from ocr.config import OCREngineConfig
        
        config = OCREngineConfig(
            name='paddle',
            enabled=True,
            priority=1,
            min_confidence=0.7,
            use_gpu=True,
            language='ch'
        )
        
        assert config.name == 'paddle'
        assert config.min_confidence == 0.7
        assert config.use_gpu == True
        assert config.language == 'ch'


class TestOCRConfig:
    """Test OCRConfig main configuration"""
    
    def test_default_config(self):
        """Test default configuration"""
        from ocr.config import OCRConfig
        
        config = OCRConfig()
        
        assert config.primary_engine == 'paddle'
        assert 'tesseract' in config.fallback_engines
        assert config.use_preprocessing == True
    
    def test_from_env_primary_engine(self):
        """Test loading primary engine from environment"""
        from ocr.config import OCRConfig
        
        os.environ['OCR_PRIMARY_ENGINE'] = 'tesseract'
        
        try:
            config = OCRConfig.from_env()
            assert config.primary_engine == 'tesseract'
        finally:
            del os.environ['OCR_PRIMARY_ENGINE']
    
    def test_from_env_fallback_engines(self):
        """Test loading fallback engines from environment"""
        from ocr.config import OCRConfig
        
        os.environ['OCR_FALLBACK_ENGINES'] = 'paddle,easyocr'
        
        try:
            config = OCRConfig.from_env()
            assert config.fallback_engines == ['paddle', 'easyocr']
        finally:
            del os.environ['OCR_FALLBACK_ENGINES']
    
    def test_from_env_preprocessing(self):
        """Test loading preprocessing setting from environment"""
        from ocr.config import OCRConfig
        
        os.environ['OCR_USE_PREPROCESSING'] = 'false'
        
        try:
            config = OCRConfig.from_env()
            assert config.use_preprocessing == False
        finally:
            del os.environ['OCR_USE_PREPROCESSING']
    
    def test_from_env_paddle_settings(self):
        """Test loading PaddleOCR settings from environment"""
        from ocr.config import OCRConfig
        
        os.environ['OCR_PADDLE_MIN_CONFIDENCE'] = '0.75'
        os.environ['OCR_PADDLE_USE_GPU'] = 'true'
        os.environ['OCR_PADDLE_LANGUAGE'] = 'ch'
        
        try:
            config = OCRConfig.from_env()
            paddle_config = config.engines['paddle']
            
            assert paddle_config.min_confidence == 0.75
            assert paddle_config.use_gpu == True
            assert paddle_config.language == 'ch'
        finally:
            del os.environ['OCR_PADDLE_MIN_CONFIDENCE']
            del os.environ['OCR_PADDLE_USE_GPU']
            del os.environ['OCR_PADDLE_LANGUAGE']
    
    def test_from_file(self):
        """Test loading configuration from JSON file"""
        from ocr.config import OCRConfig
        
        config_data = {
            'primary_engine': 'easyocr',
            'fallback_engines': ['paddle'],
            'use_preprocessing': False,
            'engines': {
                'easyocr': {
                    'min_confidence': 0.6,
                    'use_gpu': True,
                    'language': 'ja'
                }
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            temp_path = f.name
        
        try:
            config = OCRConfig.from_file(temp_path)
            
            assert config.primary_engine == 'easyocr'
            assert config.fallback_engines == ['paddle']
            assert config.use_preprocessing == False
            assert config.engines['easyocr'].min_confidence == 0.6
        finally:
            os.unlink(temp_path)
    
    def test_get_engine_config_existing(self):
        """Test getting existing engine config"""
        from ocr.config import OCRConfig
        
        config = OCRConfig.from_env()
        paddle_config = config.get_engine_config('paddle')
        
        assert paddle_config.name == 'paddle'
    
    def test_get_engine_config_nonexistent(self):
        """Test getting non-existent engine config returns default"""
        from ocr.config import OCRConfig
        
        config = OCRConfig()
        unknown_config = config.get_engine_config('unknown_engine')
        
        assert unknown_config.name == 'unknown_engine'
        assert unknown_config.enabled == True


# ==============================================================================
# Test 3: test_engine_factory.py - Factory Tests
# ==============================================================================
"""
tests/test_ocr/test_engine_factory.py
"""

import pytest

class TestEngineFactory:
    """Test the engine factory"""
    
    def test_register_engine(self):
        """Test registering a custom engine"""
        from ocr.engine_factory import EngineFactory
        from ocr.base_engine import BaseOCREngine
        
        class CustomEngine(BaseOCREngine):
            def get_name(self): return 'custom'
            def extract_text(self, img): return {'text': '', 'confidence': 0, 'success': False, 'line_count': 0}
            def is_available(self): return True
        
        EngineFactory.register('custom', CustomEngine)
        
        engine = EngineFactory.create('custom')
        assert engine.get_name() == 'custom'
        
        # Cleanup
        EngineFactory.unregister('custom')
    
    def test_create_unknown_engine_raises(self):
        """Test that creating unknown engine raises ValueError"""
        from ocr.engine_factory import EngineFactory
        
        with pytest.raises(ValueError) as exc_info:
            EngineFactory.create('nonexistent_engine')
        
        assert 'Unknown OCR engine' in str(exc_info.value)
    
    def test_get_or_create_caches_instance(self):
        """Test that get_or_create caches engine instances"""
        from ocr.engine_factory import EngineFactory
        from ocr.base_engine import BaseOCREngine
        
        class CachedEngine(BaseOCREngine):
            instance_count = 0
            def __init__(self, **kwargs):
                CachedEngine.instance_count += 1
            def get_name(self): return 'cached'
            def extract_text(self, img): return {'text': '', 'confidence': 0, 'success': False, 'line_count': 0}
            def is_available(self): return True
        
        EngineFactory.register('cached', CachedEngine)
        CachedEngine.instance_count = 0
        EngineFactory.clear_cache()
        
        engine1 = EngineFactory.get_or_create('cached')
        engine2 = EngineFactory.get_or_create('cached')
        
        assert engine1 is engine2
        assert CachedEngine.instance_count == 1
        
        # Cleanup
        EngineFactory.unregister('cached')
    
    def test_get_available_engines(self):
        """Test getting available engines"""
        from ocr.engine_factory import EngineFactory
        
        available = EngineFactory.get_available_engines()
        
        assert isinstance(available, dict)
        # At minimum, mock should be available
        assert 'mock' in available
        assert available['mock'] == True
    
    def test_clear_cache(self):
        """Test clearing engine cache"""
        from ocr.engine_factory import EngineFactory
        
        # Get an instance to cache it
        EngineFactory.get_or_create('mock')
        
        # Clear cache
        EngineFactory.clear_cache()
        
        # Verify cache is empty
        assert len(EngineFactory._instances) == 0
    
    def test_create_with_config(self):
        """Test creating engine with configuration"""
        from ocr.engine_factory import EngineFactory
        from ocr.config import OCREngineConfig
        
        config = OCREngineConfig(
            name='mock',
            use_gpu=True,
            language='ja'
        )
        
        engine = EngineFactory.create('mock', config=config)
        
        assert engine is not None


# ==============================================================================
# Test 4: test_mock_engine.py - Mock Engine Tests
# ==============================================================================
"""
tests/test_ocr/test_mock_engine.py
"""

import pytest
import numpy as np

class TestMockOCREngine:
    """Test the mock OCR engine for testing"""
    
    def test_default_mock_result(self):
        """Test default mock result"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine()
        image = np.zeros((100, 100), dtype=np.uint8)
        
        result = engine.extract_text(image)
        
        assert result['text'] == 'Mock extracted text'
        assert result['confidence'] == 0.95
        assert result['success'] == True
    
    def test_custom_mock_result(self):
        """Test custom mock result"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine(
            mock_text='Custom text',
            mock_confidence=0.5,
            mock_success=True
        )
        
        result = engine.extract_text(np.zeros((100, 100)))
        
        assert result['text'] == 'Custom text'
        assert result['confidence'] == 0.5
    
    def test_mock_error(self):
        """Test mock error result"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine(mock_error='Simulated failure')
        
        result = engine.extract_text(np.zeros((100, 100)))
        
        assert result['success'] == False
        assert result['error'] == 'Simulated failure'
    
    def test_call_count_tracking(self):
        """Test that call count is tracked"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine()
        
        assert engine.call_count == 0
        
        engine.extract_text(np.zeros((100, 100)))
        assert engine.call_count == 1
        
        engine.extract_text(np.zeros((100, 100)))
        assert engine.call_count == 2
    
    def test_set_mock_result(self):
        """Test dynamically changing mock result"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine()
        
        # Initial result
        result1 = engine.extract_text(np.zeros((100, 100)))
        assert result1['text'] == 'Mock extracted text'
        
        # Change mock result
        engine.set_mock_result(text='Changed text', confidence=0.8)
        
        result2 = engine.extract_text(np.zeros((100, 100)))
        assert result2['text'] == 'Changed text'
        assert result2['confidence'] == 0.8
    
    def test_is_available(self):
        """Test that mock engine is always available"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine()
        assert engine.is_available() == True
    
    def test_get_capabilities(self):
        """Test mock capabilities include is_mock flag"""
        from ocr.engines.mock_engine import MockOCREngine
        
        engine = MockOCREngine()
        caps = engine.get_capabilities()
        
        assert caps['is_mock'] == True


# ==============================================================================
# Test 5: test_facade.py - Facade Tests
# ==============================================================================
"""
tests/test_ocr/test_facade.py
"""

import pytest
import numpy as np
from PIL import Image
from unittest.mock import Mock, patch

class TestOCRFacade:
    """Test the OCR Facade"""
    
    @pytest.fixture
    def mock_config(self):
        """Create a mock configuration"""
        from ocr.config import OCRConfig, OCREngineConfig
        
        config = OCRConfig()
        config.primary_engine = 'mock'
        config.fallback_engines = []
        config.use_preprocessing = False
        config.engines['mock'] = OCREngineConfig(
            name='mock',
            min_confidence=0.5
        )
        return config
    
    def test_facade_initialization(self, mock_config):
        """Test facade initializes correctly"""
        from ocr.facade import OCRFacade
        
        facade = OCRFacade(mock_config)
        
        assert facade._primary_engine is not None
        assert facade._primary_engine.get_name() == 'mock'
    
    def test_extract_text_success(self, mock_config):
        """Test successful text extraction"""
        from ocr.facade import OCRFacade
        
        facade = OCRFacade(mock_config)
        image = Image.new('RGB', (100, 100), color='white')
        
        result = facade.extract_text(image)
        
        assert result['success'] == True
        assert result['method'] == 'mock'
        assert len(result['text']) > 0
    
    def test_extract_text_with_metadata(self, mock_config):
        """Test that metadata is preserved in result"""
        from ocr.facade import OCRFacade
        
        facade = OCRFacade(mock_config)
        image = Image.new('RGB', (100, 100), color='white')
        
        result = facade.extract_text(
            image,
            window_title='Test Window',
            app_name='test.exe'
        )
        
        assert result['window_title'] == 'Test Window'
        assert result['app_name'] == 'test.exe'
    
    def test_fallback_on_low_confidence(self):
        """Test fallback when primary engine returns low confidence"""
        from ocr.facade import OCRFacade
        from ocr.config import OCRConfig, OCREngineConfig
        from ocr.engine_factory import EngineFactory
        from ocr.engines.mock_engine import MockOCREngine
        
        # Create two mock engines with different results
        class PrimaryEngine(MockOCREngine):
            _instance = None
            def __init__(self, **kwargs):
                super().__init__(mock_confidence=0.3)  # Below threshold
            def get_name(self): return 'primary_mock'
        
        class FallbackEngine(MockOCREngine):
            _instance = None
            def __init__(self, **kwargs):
                super().__init__(mock_confidence=0.9, mock_text='Fallback text')
            def get_name(self): return 'fallback_mock'
        
        EngineFactory.register('primary_mock', PrimaryEngine)
        EngineFactory.register('fallback_mock', FallbackEngine)
        EngineFactory.clear_cache()
        
        config = OCRConfig()
        config.primary_engine = 'primary_mock'
        config.fallback_engines = ['fallback_mock']
        config.engines['primary_mock'] = OCREngineConfig(name='primary_mock', min_confidence=0.5)
        config.engines['fallback_mock'] = OCREngineConfig(name='fallback_mock', min_confidence=0.5)
        
        facade = OCRFacade(config)
        image = Image.new('RGB', (100, 100))
        
        result = facade.extract_text(image)
        
        # Should use fallback
        assert result['method'] == 'fallback_mock'
        assert result['text'] == 'Fallback text'
        
        # Cleanup
        EngineFactory.unregister('primary_mock')
        EngineFactory.unregister('fallback_mock')
    
    def test_metadata_fallback_when_all_fail(self):
        """Test metadata fallback when all OCR engines fail"""
        from ocr.facade import OCRFacade
        from ocr.config import OCRConfig, OCREngineConfig
        from ocr.engine_factory import EngineFactory
        from ocr.engines.mock_engine import MockOCREngine
        
        class FailingEngine(MockOCREngine):
            _instance = None
            def __init__(self, **kwargs):
                super().__init__(mock_confidence=0.1)  # Below all thresholds
            def get_name(self): return 'failing'
        
        EngineFactory.register('failing', FailingEngine)
        EngineFactory.clear_cache()
        
        config = OCRConfig()
        config.primary_engine = 'failing'
        config.fallback_engines = []
        config.engines['failing'] = OCREngineConfig(name='failing', min_confidence=0.5)
        
        facade = OCRFacade(config)
        image = Image.new('RGB', (100, 100))
        
        result = facade.extract_text(
            image, 
            window_title='Important Window',
            app_name='app.exe'
        )
        
        assert result['method'] == 'metadata'
        assert result['success'] == False
        assert result['window_title'] == 'Important Window'
        assert result['app_name'] == 'app.exe'
        
        EngineFactory.unregister('failing')
    
    def test_get_available_engines(self, mock_config):
        """Test getting available engines through facade"""
        from ocr.facade import OCRFacade
        
        facade = OCRFacade(mock_config)
        available = facade.get_available_engines()
        
        assert isinstance(available, dict)
        assert 'mock' in available
    
    def test_get_current_config(self, mock_config):
        """Test getting current configuration"""
        from ocr.facade import OCRFacade
        
        facade = OCRFacade(mock_config)
        config = facade.get_current_config()
        
        assert config['primary_engine'] == 'mock'
        assert 'engines' in config


class TestExtractTextFromImageFunction:
    """Test the convenience function"""
    
    def test_backward_compatible_function(self):
        """Test that extract_text_from_image works"""
        from ocr import extract_text_from_image
        
        image = Image.new('RGB', (100, 100), color='white')
        
        result = extract_text_from_image(image)
        
        assert 'text' in result
        assert 'confidence' in result
        assert 'method' in result
        assert 'success' in result
    
    def test_function_accepts_numpy_array(self):
        """Test that function accepts numpy arrays"""
        from ocr import extract_text_from_image
        
        image = np.zeros((100, 100, 3), dtype=np.uint8)
        
        result = extract_text_from_image(image)
        
        assert 'text' in result
    
    def test_function_accepts_file_path(self, tmp_path):
        """Test that function accepts file paths"""
        from ocr import extract_text_from_image
        
        # Create a temporary image file
        img = Image.new('RGB', (100, 100), color='white')
        img_path = tmp_path / 'test_image.png'
        img.save(img_path)
        
        result = extract_text_from_image(str(img_path))
        
        assert 'text' in result


# ==============================================================================
# Test 6: test_integration.py - End-to-End Tests
# ==============================================================================
"""
tests/test_ocr/test_integration.py
"""

import pytest
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os

class TestOCRIntegration:
    """End-to-end integration tests"""
    
    @pytest.fixture
    def text_image(self):
        """Create an image with actual text"""
        img = Image.new('RGB', (400, 200), color='white')
        draw = ImageDraw.Draw(img)
        
        # Try to use a system font, fallback to default
        try:
            font = ImageFont.truetype("arial.ttf", 36)
        except:
            font = ImageFont.load_default()
        
        draw.text((50, 50), "Hello World", fill='black', font=font)
        draw.text((50, 100), "OCR Test", fill='black', font=font)
        
        return img
    
    @pytest.fixture
    def empty_image(self):
        """Create an image with no text"""
        return Image.new('RGB', (100, 100), color='white')
    
    def test_full_extraction_pipeline(self, text_image):
        """Test complete extraction with real image"""
        from ocr import extract_text_from_image
        
        result = extract_text_from_image(text_image)
        
        assert 'text' in result
        assert 'confidence' in result
        assert 'method' in result
        assert result['method'] in ['paddle', 'tesseract', 'metadata', 'mock']
    
    def test_extraction_with_preprocessing(self, text_image):
        """Test extraction with preprocessing enabled"""
        from ocr import extract_text_from_image
        
        result = extract_text_from_image(text_image, use_preprocessing=True)
        
        assert 'text' in result
    
    def test_extraction_without_preprocessing(self, text_image):
        """Test extraction with preprocessing disabled"""
        from ocr import extract_text_from_image
        
        result = extract_text_from_image(text_image, use_preprocessing=False)
        
        assert 'text' in result
    
    def test_empty_image_handling(self, empty_image):
        """Test handling of image with no text"""
        from ocr import extract_text_from_image
        
        result = extract_text_from_image(empty_image)
        
        # Should not crash, may return empty or low confidence
        assert 'text' in result
        assert 'confidence' in result
    
    def test_engine_switching_via_config(self, text_image):
        """Test switching engines via configuration"""
        from ocr import OCRFacade, OCRConfig, OCREngineConfig
        
        # Test with mock as primary
        config = OCRConfig()
        config.primary_engine = 'mock'
        config.fallback_engines = []
        config.engines['mock'] = OCREngineConfig(name='mock', min_confidence=0.5)
        
        facade = OCRFacade(config)
        result = facade.extract_text(text_image)
        
        assert result['method'] == 'mock'
    
    def test_multiple_fallbacks(self, text_image):
        """Test multiple fallback engines"""
        from ocr import OCRFacade, OCRConfig, OCREngineConfig
        from ocr.engine_factory import EngineFactory
        from ocr.engines.mock_engine import MockOCREngine
        
        # Register mock engines with different confidence levels
        class Engine1(MockOCREngine):
            _instance = None
            def __init__(self, **kwargs): super().__init__(mock_confidence=0.3)
            def get_name(self): return 'engine1'
        
        class Engine2(MockOCREngine):
            _instance = None
            def __init__(self, **kwargs): super().__init__(mock_confidence=0.3)
            def get_name(self): return 'engine2'
        
        class Engine3(MockOCREngine):
            _instance = None
            def __init__(self, **kwargs): super().__init__(mock_confidence=0.9, mock_text='Engine3 worked')
            def get_name(self): return 'engine3'
        
        EngineFactory.register('engine1', Engine1)
        EngineFactory.register('engine2', Engine2)
        EngineFactory.register('engine3', Engine3)
        EngineFactory.clear_cache()
        
        config = OCRConfig()
        config.primary_engine = 'engine1'
        config.fallback_engines = ['engine2', 'engine3']
        config.engines = {
            'engine1': OCREngineConfig(name='engine1', min_confidence=0.5),
            'engine2': OCREngineConfig(name='engine2', min_confidence=0.5),
            'engine3': OCREngineConfig(name='engine3', min_confidence=0.5)
        }
        
        facade = OCRFacade(config)
        result = facade.extract_text(text_image)
        
        # Should skip engine1 and engine2, use engine3
        assert result['method'] == 'engine3'
        assert result['text'] == 'Engine3 worked'
        
        # Cleanup
        EngineFactory.unregister('engine1')
        EngineFactory.unregister('engine2')
        EngineFactory.unregister('engine3')


# ==============================================================================
# Test 7: test_paddle_engine.py - PaddleOCR Tests (if available)
# ==============================================================================
"""
tests/test_ocr/test_paddle_engine.py
"""

import pytest
import numpy as np
from PIL import Image

class TestPaddleOCREngine:
    """Test PaddleOCR adapter (requires PaddleOCR installed)"""
    
    @pytest.fixture
    def paddle_available(self):
        """Check if PaddleOCR is available"""
        try:
            from paddleocr import PaddleOCR
            return True
        except ImportError:
            return False
    
    @pytest.mark.skipif(
        not pytest.importorskip("paddleocr", reason="PaddleOCR not installed"),
        reason="PaddleOCR not installed"
    )
    def test_paddle_engine_initialization(self):
        """Test PaddleOCR engine initializes"""
        from ocr.engines.paddle_engine import PaddleOCREngine
        
        engine = PaddleOCREngine(use_gpu=False, language='en')
        
        assert engine.get_name() == 'paddle'
        assert engine.is_available() == True
    
    @pytest.mark.skipif(
        not pytest.importorskip("paddleocr", reason="PaddleOCR not installed"),
        reason="PaddleOCR not installed"
    )
    def test_paddle_engine_extraction(self):
        """Test PaddleOCR extraction"""
        from ocr.engines.paddle_engine import PaddleOCREngine
        
        engine = PaddleOCREngine()
        
        # Create test image with text
        img = Image.new('RGB', (200, 100), color='white')
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Test", fill='black')
        
        result = engine.extract_text(np.array(img))
        
        assert 'text' in result
        assert 'confidence' in result
        assert 'success' in result
    
    @pytest.mark.skipif(
        not pytest.importorskip("paddleocr", reason="PaddleOCR not installed"),
        reason="PaddleOCR not installed"
    )
    def test_paddle_engine_singleton(self):
        """Test PaddleOCR engine uses singleton pattern"""
        from ocr.engines.paddle_engine import PaddleOCREngine
        
        engine1 = PaddleOCREngine()
        engine2 = PaddleOCREngine()
        
        assert engine1 is engine2


# ==============================================================================
# Test 8: test_tesseract_engine.py - Tesseract Tests (if available)
# ==============================================================================
"""
tests/test_ocr/test_tesseract_engine.py
"""

import pytest
import numpy as np
from PIL import Image

class TestTesseractEngine:
    """Test Tesseract adapter (requires pytesseract installed)"""
    
    @pytest.mark.skipif(
        not pytest.importorskip("pytesseract", reason="pytesseract not installed"),
        reason="pytesseract not installed"
    )
    def test_tesseract_engine_initialization(self):
        """Test Tesseract engine initializes"""
        from ocr.engines.tesseract_engine import TesseractEngine
        
        engine = TesseractEngine(language='eng')
        
        assert engine.get_name() == 'tesseract'
    
    @pytest.mark.skipif(
        not pytest.importorskip("pytesseract", reason="pytesseract not installed"),
        reason="pytesseract not installed"
    )
    def test_tesseract_engine_extraction(self):
        """Test Tesseract extraction"""
        from ocr.engines.tesseract_engine import TesseractEngine
        
        engine = TesseractEngine()
        
        # Create test image with text
        img = Image.new('RGB', (200, 100), color='white')
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "Test", fill='black')
        
        result = engine.extract_text(np.array(img))
        
        assert 'text' in result
        assert 'confidence' in result


# ==============================================================================
# conftest.py - Pytest Configuration
# ==============================================================================
"""
tests/test_ocr/conftest.py
"""

import pytest
import sys
import os

# Add root directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

@pytest.fixture(autouse=True)
def reset_factory_cache():
    """Reset engine factory cache between tests"""
    from ocr.engine_factory import EngineFactory
    
    yield
    
    EngineFactory.clear_cache()

@pytest.fixture
def sample_text_image():
    """Create a sample image with text for testing"""
    from PIL import Image, ImageDraw
    
    img = Image.new('RGB', (400, 200), color='white')
    draw = ImageDraw.Draw(img)
    draw.text((50, 50), "Sample Text for OCR Testing", fill='black')
    draw.text((50, 100), "Multiple lines of text", fill='black')
    
    return img
