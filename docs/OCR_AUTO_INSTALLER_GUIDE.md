# OCR Auto-Installer - Developer Guide

## Overview
The auto-installer automatically detects and installs missing OCR engine dependencies when you update your `.env` file. This eliminates manual `pip install` commands during development.

## How It Works

### 1. Automatic Installation (Integrated)
When you run the desktop app, it automatically checks for missing dependencies:

```bash
python desktop_app.py
```

**Output:**
```
[INFO] Checking OCR dependencies...
[INFO] Configured engines: paddle, tesseract
[INFO] Installing missing package: paddlepaddle>=3.0.0b1
[INFO] Successfully installed: paddlepaddle>=3.0.0b1
[INFO] Installed dependencies: paddlepaddle>=3.0.0b1, paddleocr>=2.8.1
[INFO] Already installed: pytesseract>=0.3.10
```

### 2. Manual Installation (CLI)
You can also run the installer manually:

```bash
# Check what's configured and missing
python -m ocr.auto_installer --check

# Add a new engine to .env and install it
python -m ocr.auto_installer --add easyocr --primary

# Add as fallback engine
python -m ocr.auto_installer --add tesseract --fallback
```

## Development Workflow

### Scenario 1: Switch Primary Engine
**You want to try EasyOCR instead of PaddleOCR**

1. Edit `.env`:
```env
OCR_PRIMARY_ENGINE=easyocr
OCR_FALLBACK_ENGINES=paddle,tesseract
```

2. Run app or installer:
```bash
python desktop_app.py
# OR
python -m ocr.auto_installer
```

3. Auto-installer detects `easyocr` is configured but not installed
4. Installs: `easyocr>=1.7.0`, `torch>=2.0.0`, `torchvision>=0.15.0`
5. Engine is immediately available

### Scenario 2: Add New Fallback Engine
**You want to add Tesseract as a backup**

```bash
python -m ocr.auto_installer --add tesseract --fallback
```

This:
- Updates `.env`: `OCR_FALLBACK_ENGINES=paddle,tesseract`
- Installs: `pytesseract>=0.3.10`
- Adds to engine list automatically

### Scenario 3: Testing Different Engines
**You want to test all engines one by one**

```bash
# Test EasyOCR
echo OCR_PRIMARY_ENGINE=easyocr > .env
python desktop_app.py  # Auto-installs easyocr deps
python -m tests.test_ocr_engines --engine easyocr --screenshot

# Test PaddleOCR
echo OCR_PRIMARY_ENGINE=paddle > .env
python desktop_app.py  # Checks paddle deps
python -m tests.test_ocr_engines --engine paddle --screenshot

# Test Tesseract
echo OCR_PRIMARY_ENGINE=tesseract > .env
python desktop_app.py  # Checks tesseract deps
python -m tests.test_ocr_engines --engine tesseract --screenshot
```

## Supported Engines

### 1. PaddleOCR (Recommended)
**Dependencies:**
- `paddlepaddle>=3.0.0b1` (Deep learning framework)
- `paddleocr>=2.8.1` (OCR engine)
- `opencv-python>=4.10.0` (Image processing)

**Pros:**
- High accuracy (92-97%)
- Multi-language support
- Free and open source
- No external binaries needed

**Cons:**
- Large installation (~500MB)
- Slower startup

**Config:**
```env
OCR_PRIMARY_ENGINE=paddle
OCR_PADDLE_LANGUAGE=en
OCR_PADDLE_MIN_CONFIDENCE=0.85
```

### 2. Tesseract
**Dependencies:**
- `pytesseract>=0.3.10` (Python wrapper)
- External binary: `tesseract.exe` + language files

**Pros:**
- Fast processing
- Mature and stable
- Wide language support

**Cons:**
- Requires external installation
- Lower accuracy (75-88%)
- Complex setup

**Config:**
```env
OCR_PRIMARY_ENGINE=tesseract
OCR_TESSERACT_LANGUAGE=eng
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
TESSDATA_PREFIX=C:\Program Files\Tesseract-OCR\tessdata
```

**Installation:**
1. Install Python package (auto-installer handles this):
   ```bash
   python -m ocr.auto_installer --add tesseract
   ```

2. Download binary from: https://github.com/UB-Mannheim/tesseract/wiki
3. Set paths in `.env` (see above)

### 3. EasyOCR
**Dependencies:**
- `easyocr>=1.7.0` (OCR engine)
- `torch>=2.0.0` (PyTorch framework)
- `torchvision>=0.15.0` (Computer vision)

**Pros:**
- High accuracy (88-94%)
- 80+ languages
- Easy to use

**Cons:**
- Very large installation (~2GB)
- Requires GPU for best performance
- Slower on CPU

**Config:**
```env
OCR_PRIMARY_ENGINE=easyocr
OCR_EASYOCR_LANGUAGES=en
OCR_EASYOCR_MIN_CONFIDENCE=0.70
OCR_EASYOCR_GPU=false
```

### 4. Mock Engine (Testing Only)
**Dependencies:** None

**Usage:** Returns "Mock OCR Text" with 95% confidence for testing.

```env
OCR_PRIMARY_ENGINE=mock
```

### 5. Demo Engine (Example Only)
**Dependencies:** None

**Usage:** Template for creating new OCR engines.

## Production vs Development

### Development Mode
✅ **Auto-installer is ACTIVE**
- Runs when you start `desktop_app.py` as a script
- Checks `.env` configuration
- Installs missing dependencies
- Shows detailed logs

### Production Mode (Bundled EXE)
❌ **Auto-installer is DISABLED**
- When running `desktop_app.exe` (built with PyInstaller)
- Dependencies are pre-bundled at build time
- No installation happens at runtime
- You can only switch between pre-bundled engines

**How to bundle engines for production:**

Edit `desktop_app.spec`:
```python
hiddenimports=[
    'paddleocr',
    'paddlepaddle',
    'pytesseract',
    'easyocr',
    'torch',
    'torchvision',
    # ... other imports
]
```

Build:
```bash
pyinstaller desktop_app.spec
```

## Engine Dependency Map

```python
ENGINE_DEPENDENCIES = {
    'paddle': [
        'paddlepaddle>=3.0.0b1',
        'paddleocr>=2.8.1',
        'opencv-python>=4.10.0'
    ],
    'tesseract': [
        'pytesseract>=0.3.10'
    ],
    'easyocr': [
        'easyocr>=1.7.0',
        'torch>=2.0.0',
        'torchvision>=0.15.0'
    ],
    'mock': [],  # No dependencies
    'demo': []   # No dependencies
}
```

## Adding New Engines

### Step 1: Create Engine File
Create `ocr/engines/myocr_engine.py`:

```python
from ocr.base_engine import BaseOCREngine

class MyOCREngine(BaseOCREngine):
    def get_name(self) -> str:
        return "myocr"
    
    def extract_text(self, image) -> dict:
        # Your OCR logic here
        return {
            'text': extracted_text,
            'confidence': 0.95,
            'bounding_boxes': []
        }
    
    def is_available(self) -> bool:
        try:
            import myocr_library
            return True
        except ImportError:
            return False
```

### Step 2: Add Dependencies
Edit `ocr/auto_installer.py`:

```python
ENGINE_DEPENDENCIES = {
    # ... existing engines ...
    'myocr': [
        'myocr-library>=1.0.0',
        'some-dependency>=2.0.0'
    ]
}
```

### Step 3: Configure in .env
```env
OCR_PRIMARY_ENGINE=myocr
OCR_MYOCR_API_KEY=your_key_here
OCR_MYOCR_MIN_CONFIDENCE=0.80
```

### Step 4: Test
```bash
# Install dependencies
python -m ocr.auto_installer --add myocr --primary

# Test engine
python -m tests.test_ocr_engines --engine myocr --screenshot
```

## Troubleshooting

### "Module not found" Error
**Problem:** Python can't find the OCR package

**Solution:**
```bash
# Check what's configured
python -m ocr.auto_installer --check

# Install manually
python -m ocr.auto_installer
```

### "Engine not available" Error
**Problem:** Dependency installed but engine still unavailable

**Causes:**
1. External binary missing (Tesseract)
2. Incompatible versions
3. Import error in engine code

**Debug:**
```python
from ocr.engine_factory import EngineFactory

# List all registered engines
print(EngineFactory.get_registered_engines())

# Check specific engine
engine = EngineFactory.create_engine('paddle')
print(engine.is_available())  # Should return True
```

### Auto-Installer Not Running
**Problem:** Dependencies not installing automatically

**Check:**
1. Are you in development mode? (Running as `.py` script)
2. Is auto_installer imported correctly?
3. Check console logs for errors

**Manual check:**
```bash
python -c "from ocr.auto_installer import is_development_mode; print(is_development_mode())"
# Should print: True (in development)
```

### Dependencies Install But Don't Work
**Problem:** `pip install` succeeds but import fails

**Common causes:**
- **Tesseract:** Python package installs, but binary not installed
- **EasyOCR:** Needs GPU drivers (CUDA) for optimal performance
- **PaddleOCR:** May need specific version compatibility

**Solutions:**
- Tesseract: Install binary from official source
- EasyOCR: Set `OCR_EASYOCR_GPU=false` for CPU mode
- PaddleOCR: Check version compatibility in auto_installer.py

## Performance Comparison

| Engine | Accuracy | Speed | Size | External Binary |
|--------|----------|-------|------|-----------------|
| PaddleOCR | 92-97% | Medium | ~500MB | ❌ No |
| EasyOCR | 88-94% | Slow | ~2GB | ❌ No |
| Tesseract | 75-88% | Fast | ~50MB | ✅ Yes |
| Mock | 100% | Instant | 0KB | ❌ No |

**Recommendation:**
- **Primary:** PaddleOCR (best accuracy, no external deps)
- **Fallback:** Tesseract (fast, lightweight if binary installed)
- **Testing:** Mock (instant, no dependencies)

## Examples

### Example 1: Quick Start
```bash
# Clone repo and navigate to directory
cd JIRAForge/python-desktop-app

# Configure OCR in .env
echo OCR_PRIMARY_ENGINE=paddle > .env

# Run app (auto-installs paddle dependencies)
python desktop_app.py
```

### Example 2: Switch Engines Mid-Development
```bash
# Currently using PaddleOCR
python desktop_app.py  # Works fine

# Decide to try Tesseract
# Edit .env: OCR_PRIMARY_ENGINE=tesseract
python desktop_app.py  # Auto-checks tesseract deps

# Decide to try EasyOCR
# Edit .env: OCR_PRIMARY_ENGINE=easyocr
python desktop_app.py  # Auto-installs easyocr, torch, torchvision (~2GB)
```

### Example 3: Multi-Engine Fallback Chain
```env
OCR_PRIMARY_ENGINE=paddle
OCR_FALLBACK_ENGINES=easyocr,tesseract,mock
```

This creates a fallback chain:
1. Try PaddleOCR first
2. If fails → Try EasyOCR
3. If fails → Try Tesseract
4. If fails → Use Mock (always succeeds)

```bash
# Install all engines
python -m ocr.auto_installer --check
# Will install: paddle, easyocr, tesseract dependencies
```

## Best Practices

### 1. Start with Mock Engine
When developing OCR features, start with mock:
```env
OCR_PRIMARY_ENGINE=mock
```
- Instant testing
- No dependencies
- Focus on logic, not OCR accuracy

### 2. Use Fallback Chains
Always configure fallbacks:
```env
OCR_PRIMARY_ENGINE=paddle
OCR_FALLBACK_ENGINES=tesseract,mock
```
- Resilience: If primary fails, fallback works
- Testing: Can disable primary to test fallback

### 3. Test with Real Screenshots
```bash
# Generate test fixtures
python -m tests.generate_fixtures

# Test with real screen capture
python -m tests.test_ocr_engines --engine paddle --screenshot

# Test with specific image
python -m tests.test_ocr_engines --engine paddle --image screenshots/test.png
```

### 4. Monitor Database Results
Check `ocr_test_results` table:
```sql
SELECT 
    ocr_method,
    confidence,
    extracted_text,
    timestamp
FROM ocr_test_results
ORDER BY timestamp DESC
LIMIT 10;
```

### 5. Profile Performance
```bash
# Test all engines and compare
python -m tests.test_ocr_engines --engine paddle
python -m tests.test_ocr_engines --engine easyocr
python -m tests.test_ocr_engines --engine tesseract

# Check database for performance comparison
```

## Summary

✅ **Automatic during development** - Just run the app
✅ **Manual CLI available** - Fine-grained control
✅ **Production-safe** - Disabled in bundled EXE
✅ **Easy engine switching** - Change .env, dependencies auto-install
✅ **Comprehensive testing** - Built-in test suite

**Workflow:**
1. Edit `.env` → Change `OCR_PRIMARY_ENGINE`
2. Run `python desktop_app.py` → Auto-installer checks deps
3. Missing packages? → Auto-installs via pip
4. Engine available? → App uses it
5. Test: `python -m tests.test_ocr_engines --screenshot`
