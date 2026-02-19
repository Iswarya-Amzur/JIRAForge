import sys
import warnings

# Suppress the shm.dll warning
warnings.filterwarnings('ignore')

print("Testing EasyOCR import...")
try:
    import easyocr
    print(f"✅ EasyOCR version: {easyocr.__version__}")
    print(f"✅ EasyOCR location: {easyocr.__file__}")
    print("\n✅ SUCCESS: EasyOCR imported successfully despite torch warning")
    print("\nNote: The torch shm.dll warning is non-critical.")
    print("It only affects multiprocessing features, which EasyOCR doesn't use heavily.")
except Exception as e:
    print(f"❌ FAILED: {e}")
    sys.exit(1)
