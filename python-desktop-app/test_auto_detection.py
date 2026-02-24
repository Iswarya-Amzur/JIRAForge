"""Test auto-detection of package names"""
import os

# Test WITHOUT specifying package - should auto-detect!
os.environ['OCR_PRIMARY_ENGINE'] = 'suryaocr'
# os.environ['OCR_SURYAOCR_PACKAGE'] = 'surya'  # ← NOT NEEDED anymore!

from ocr import EngineFactory, OCRConfig

print("="*80)
print("PACKAGE AUTO-DETECTION TEST")
print("="*80)

# Test 1: suryaocr (should map to 'surya')
print("\nTest 1: Create 'suryaocr' WITHOUT package config")
config = OCRConfig.from_env()
try:
    engine = EngineFactory.get_or_create('suryaocr', config=config.get_engine_config('suryaocr'))
    print(f"  ✓ Engine created: {engine}")
    print(f"  ✓ Package name used: {engine.package_name if hasattr(engine, 'package_name') else 'N/A'}")
    print(f"  ✓ Is available: {engine.is_available()}")
except Exception as e:
    print(f"  ✗ Failed: {e}")

# Test 2: Try various engine names
test_cases = [
    ('paddle', 'Should map to paddleocr'),
    ('tesseract', 'Should map to pytesseract'),
    ('easyocr', 'Should map to easyocr'),
    ('surya', 'Should map to surya'),
]

print("\n" + "="*80)
print("AUTO-DETECTION TEST CASES")
print("="*80)

for engine_name, description in test_cases:
    print(f"\nTest: {engine_name} - {description}")
    try:
        # Clear any previous config
        EngineFactory.clear_cache()
        
        # Try to create
        test_config = config.get_engine_config(engine_name)
        engine = EngineFactory.create(engine_name, config=test_config)
        
        if hasattr(engine, 'package_name'):
            print(f"  ✓ Detected package: {engine.package_name}")
            print(f"  ✓ Available: {engine.is_available()}")
        else:
            print(f"  ℹ Not a dynamic engine (built-in adapter)")
    except ValueError as e:
        print(f"  → Attempting dynamic creation...")
        # Will be created on demand
    except Exception as e:
        print(f"  ✗ Error: {e}")

print("\n" + "="*80)
