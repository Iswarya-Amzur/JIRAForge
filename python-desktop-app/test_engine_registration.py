"""Test script to check engine registration and dynamic creation"""
import os
os.environ['OCR_PRIMARY_ENGINE'] = 'suryaocr'
os.environ['OCR_SURYAOCR_PACKAGE'] = 'surya'
os.environ['OCR_SURYAOCR_MIN_CONFIDENCE'] = '0.7'

from ocr import EngineFactory, OCRConfig

print("="*80)
print("ENGINE REGISTRATION TEST")
print("="*80)

# Check registered engines
registered = EngineFactory.get_registered_engines()
print(f"\n1. Registered engines: {registered}")

# Check configuration
config = OCRConfig.from_env()
print(f"\n2. Primary engine from config: {config.primary_engine}")
print(f"   Fallback engines: {config.fallback_engines}")

# Check engine config for suryaocr
if 'suryaocr' in config.engines:
    surya_config = config.engines['suryaocr']
    print(f"\n3. SuryaOCR config found:")
    print(f"   - name: {surya_config.name}")
    print(f"   - enabled: {surya_config.enabled}")
    print(f"   - min_confidence: {surya_config.min_confidence}")
    print(f"   - extra_params: {surya_config.extra_params}")
else:
    print("\n3. SuryaOCR config NOT found in config.engines")

# Try to create suryaocr engine
print(f"\n4. Attempting to create 'suryaocr' engine...")
try:
    engine = EngineFactory.get_or_create('suryaocr', config=config.get_engine_config('suryaocr'))
    print(f"   ✓ Engine created: {engine}")
    print(f"   ✓ Engine name: {engine.get_name()}")
    print(f"   ✓ Is available: {engine.is_available()}")
    
    # Check if it's now registered
    registered_after = EngineFactory.get_registered_engines()
    print(f"\n5. Registered engines after creation: {registered_after}")
    
except Exception as e:
    print(f"   ✗ Failed to create engine: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
