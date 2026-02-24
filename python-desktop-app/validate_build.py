"""
Pre-Build Validation Script
Checks that all OCR components are in place before building the EXE
"""

import os
import sys
from pathlib import Path

def check_file_exists(path, description):
    """Check if a file exists and report"""
    if os.path.exists(path):
        print(f"✓ {description}: {path}")
        return True
    else:
        print(f"✗ {description}: {path} [NOT FOUND]")
        return False

def check_module_import(module_name):
    """Check if a module can be imported"""
    try:
        __import__(module_name)
        print(f"✓ Module '{module_name}' can be imported")
        return True
    except ImportError as e:
        print(f"✗ Module '{module_name}' import failed: {e}")
        return False

def main():
    print("="*80)
    print(" OCR BUILD VALIDATION")
    print("="*80)
    print()
    
    all_ok = True
    
    # 1. Check OCR module files (New Facade Architecture v2.0)
    print("[1/5] Checking OCR module files...")
    ocr_files = [
        ('ocr/__init__.py', 'OCR package initializer'),
        ('ocr/facade.py', 'OCR Facade (unified interface)'),
        ('ocr/config.py', 'OCR Configuration'),
        ('ocr/engine_factory.py', 'Engine Factory'),
        ('ocr/base_engine.py', 'Base Engine (Strategy pattern)'),
        ('ocr/image_processor.py', 'Image preprocessing'),
        ('ocr/auto_installer.py', 'Auto dependency installer'),
        ('ocr/engines/paddle_engine.py', 'PaddleOCR adapter'),
        ('ocr/engines/tesseract_engine.py', 'Tesseract adapter'),
        ('ocr/engines/mock_engine.py', 'Mock engine (testing)'),
    ]
    
    for file_path, desc in ocr_files:
        if not check_file_exists(file_path, desc):
            all_ok = False
    print()
    
    # 2. Check desktop_app.py integration
    print("[2/5] Checking desktop_app.py integration...")
    if check_file_exists('desktop_app.py', 'Main desktop app'):
        with open('desktop_app.py', 'r', encoding='utf-8') as f:
            content = f.read()
            
        checks = [
            ('from ocr import extract_text_from_image', 'OCR import statement'),
            ('extract_text_from_image(', 'OCR function call'),
            ("'extracted_text':", 'extracted_text field'),
            ("'ocr_confidence':", 'ocr_confidence field'),
            ("'ocr_method':", 'ocr_method field'),
        ]
        
        for search_str, desc in checks:
            if search_str in content:
                print(f"  ✓ Found: {desc}")
            else:
                print(f"  ✗ Missing: {desc}")
                all_ok = False
    else:
        all_ok = False
    print()
    
    # 3. Check .spec file
    print("[3/5] Checking desktop_app.spec build configuration...")
    if check_file_exists('desktop_app.spec', 'PyInstaller spec file'):
        with open('desktop_app.spec', 'r', encoding='utf-8') as f:
            spec_content = f.read()
        
        checks = [
            ('ocr_datas', 'OCR data collection'),
            ('paddleocr_models', 'PaddleOCR models collection'),
            ("'ocr.facade',", 'OCR Facade hiddenimport'),
            ("'ocr.config',", 'OCR Config hiddenimport'),
            ("'ocr.engine_factory',", 'Engine Factory hiddenimport'),
            ("'ocr.engines',", 'OCR Engines package hiddenimport'),
            ("'paddleocr',", 'PaddleOCR hiddenimport'),
            ("'cv2',", 'OpenCV hiddenimport'),
            ("'numpy',", 'NumPy hiddenimport'),
        ]
        
        for search_str, desc in checks:
            if search_str in spec_content:
                print(f"  ✓ Found: {desc}")
            else:
                print(f"  ✗ Missing: {desc}")
                all_ok = False
        
        # Check numpy is NOT in excludes
        if "'numpy'," in spec_content and "excludes=" in spec_content:
            # Check if numpy is in excludes list
            excludes_start = spec_content.find("excludes=[")
            excludes_end = spec_content.find("]", excludes_start)
            excludes_section = spec_content[excludes_start:excludes_end]
            
            if "'numpy'," in excludes_section:
                print(f"  ✗ numpy is in excludes list (will break OCR!)")
                all_ok = False
            else:
                print(f"  ✓ numpy NOT in excludes (good)")
    else:
        all_ok = False
    print()
    
    # 4. Check Python dependencies
    print("[4/5] Checking Python dependencies...")
    required_dependencies = [
        ('paddleocr', 'PaddleOCR - Primary OCR engine'),
        ('paddlepaddle', 'PaddlePaddle - Backend for PaddleOCR'),
        ('cv2', 'OpenCV - Image processing'),
        ('numpy', 'NumPy - Array operations'),
        ('PIL', 'Pillow - Image handling'),
    ]
    
    optional_dependencies = [
        ('pytesseract', 'Tesseract OCR - Fallback engine'),
        ('easyocr', 'EasyOCR - Alternative engine (large)'),
    ]
    
    print("  Required:")
    for module, desc in required_dependencies:
        if not check_module_import(module):
            print(f"    ⚠️  {desc}")
            all_ok = False
    
    print("  Optional:")
    for module, desc in optional_dependencies:
        if check_module_import(module):
            print(f"    ℹ️  {desc} - INSTALLED")
        else:
            print(f"    ℹ️  {desc} - Not installed (OK, not required)")
    print()
    
    # 5. Check PaddleOCR models
    print("[5/5] Checking PaddleOCR models...")
    paddleocr_cache = os.path.join(os.path.expanduser('~'), '.paddleocr')
    
    if os.path.exists(paddleocr_cache):
        model_dirs = [
            'whl/cls/ch_ppocr_mobile_v2.0_cls_infer',
            'whl/det/en/en_PP-OCRv3_det_infer',
            'whl/rec/en/en_PP-OCRv4_rec_infer',
        ]
        
        print(f"  ✓ PaddleOCR cache found: {paddleocr_cache}")
        
        for model_dir in model_dirs:
            full_path = os.path.join(paddleocr_cache, model_dir)
            if os.path.exists(full_path):
                # Count model files
                files = list(Path(full_path).glob('*.pd*'))
                print(f"    ✓ {model_dir} ({len(files)} files)")
            else:
                print(f"    ✗ {model_dir} [NOT FOUND]")
        
        print()
        print("  NOTE: Models will be bundled in EXE if present during build")
    else:
        print(f"  ⚠ PaddleOCR models not found at: {paddleocr_cache}")
        print(f"  NOTE: Models will be downloaded on first run of the EXE")
    print()
    
    # Summary
    print("="*80)
    if all_ok:
        print(" ✅ ALL CHECKS PASSED - Ready to build!")
        print("="*80)
        print()
        print("Build command:")
        print("  pyinstaller desktop_app.spec")
        print()
        return 0
    else:
        print(" ❌ SOME CHECKS FAILED - Fix issues before building")
        print("="*80)
        print()
        print("Fix the issues above, then run this script again.")
        print()
        return 1

if __name__ == '__main__':
    sys.exit(main())
