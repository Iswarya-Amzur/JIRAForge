# OCR Dynamic Flow Documentation

## Overview

The Time Tracker application uses a **dynamic OCR system** that supports multiple OCR engines with automatic fallback and configuration via environment variables. The system is **NOT hardcoded** to any specific OCR engine.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop App (desktop_app.py)             │
│                                                               │
│  ┌─────────────────────┐      ┌──────────────────────────┐ │
│  │ LocalOCRProcessor   │      │  upload_screenshot()     │ │
│  │ (Event-based)       │      │  (Interval-based)        │ │
│  │                     │      │                          │ │
│  │ capture_and_ocr() ──┼──────┼──> extract_text_from_image() │
│  └─────────────────────┘      └──────────────────────────┘ │
└────────────────────────┬──────────────────────────────────┘
                         │
                         v
┌─────────────────────────────────────────────────────────────┐
│              OCR Module (ocr/__init__.py)                     │
│                                                               │
│  extract_text_from_image()  ─────>  OCRFacade                │
│                                        │                      │
│                                        v                      │
│                              ┌─────────────────┐             │
│                              │ EngineFactory   │             │
│                              └────────┬────────┘             │
│                                       │                      │
│              ┌────────────────────────┼─────────────────┐    │
│              │                        │                 │    │
│              v                        v                 v    │
│      ┌──────────────┐        ┌──────────────┐  ┌──────────┐│
│      │ PaddleOCR    │        │ Tesseract    │  │ EasyOCR  ││
│      │ Engine       │        │ Engine       │  │ Engine   ││
│      └──────────────┘        └──────────────┘  └──────────┘│
│                                                               │
│      Dynamically loaded based on OCR_PRIMARY_ENGINE         │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Configuration (Environment Variables)

The OCR system is configured entirely through environment variables in `.env` file:

```bash
# Primary OCR Engine (first choice)
OCR_PRIMARY_ENGINE=paddle

# Fallback Engines (comma-separated, tried in order if primary fails)
OCR_FALLBACK_ENGINES=tesseract,mock

# Engine-specific settings
OCR_PADDLE_MIN_CONFIDENCE=0.5
OCR_PADDLE_USE_GPU=false
OCR_PADDLE_LANGUAGE=en

OCR_TESSERACT_MIN_CONFIDENCE=0.6
OCR_TESSERACT_LANGUAGE=eng
```

### 2. Dynamic Engine Discovery

The system automatically discovers and loads OCR engines:

1. **At startup**: `OCRConfig.from_env()` scans environment variables
2. **Detects engines**: Finds all `OCR_<ENGINE>_*` patterns
3. **Creates adapters**: `EngineFactory` dynamically creates engine adapters
4. **Verifies availability**: Checks if required packages are installed
5. **Builds fallback chain**: Primary → Fallback1 → Fallback2 → Metadata

### 3. Two OCR Flows in Desktop App

#### Flow A: Interval-based Screenshot Capture (Existing)

```python
# In TimeTracker.upload_screenshot()
def upload_screenshot(self, screenshot, window_info, use_previous_window=False):
    # ... screenshot preparation ...
    
    # Dynamic OCR extraction
    ocr_result = extract_text_from_image(
        screenshot, 
        window_title=window_info['title'], 
        app_name=window_info['app'],
        use_preprocessing=True
    )
    
    # Result contains:
    # - text: extracted text
    # - confidence: OCR confidence score
    # - method: which engine was used (paddle, tesseract, etc.)
    # - success: whether extraction succeeded
```

**When**: Every N minutes (configured by `CAPTURE_INTERVAL`)  
**Purpose**: Regular screenshot-based time tracking  
**OCR Configuration**: Uses `OCR_PRIMARY_ENGINE` from `.env`

#### Flow B: Event-based Activity Tracking (New)

```python
# In LocalOCRProcessor.capture_and_ocr()
class LocalOCRProcessor:
    def capture_and_ocr(self):
        # Capture current screen
        screenshot = ImageGrab.grab()
        
        # Use same dynamic OCR system
        ocr_result = extract_text_from_image(
            screenshot,
            window_title='',
            app_name='',
            use_preprocessing=True
        )
        
        # Extract text and log which engine was used
        if ocr_result.get('success'):
            text = ocr_result.get('text', '')
            method = ocr_result.get('method', 'unknown')
            print(f"[OCR] Event-based capture: {method}")
```

**When**: On window switch events (throttled to every 3 seconds)  
**Purpose**: Real-time activity classification  
**OCR Configuration**: Uses same `OCR_PRIMARY_ENGINE` from `.env`

## Key Features

### ✅ No Hardcoded OCR Engines

- **Before**: Code had hardcoded `pytesseract` calls
- **Now**: All OCR calls go through `extract_text_from_image()` facade
- **Result**: OCR engine can be changed via `.env` without code changes

### ✅ Automatic Fallback

If primary engine fails, system automatically tries fallback engines:

```
paddle (primary) → tesseract (fallback 1) → mock (fallback 2) → metadata
```

### ✅ Dynamic Engine Support

Add any OCR engine without modifying code:

```bash
# Add a new OCR engine (example: SuryaOCR)
OCR_PRIMARY_ENGINE=surya
OCR_SURYA_PACKAGE=surya
OCR_SURYA_MIN_CONFIDENCE=0.7
```

The system will automatically:
1. Try to import the package
2. Detect available methods
3. Create an adapter
4. Use it for text extraction

### ✅ Per-Engine Configuration

Each engine can have custom settings:

```bash
OCR_PADDLE_USE_GPU=true          # Use GPU for PaddleOCR
OCR_TESSERACT_LANGUAGE=eng+fra   # Multiple languages for Tesseract
OCR_EASYOCR_GPU=false            # CPU-only for EasyOCR
```

## Testing OCR Configuration

### Verify Current Configuration

```bash
cd python-desktop-app
python
>>> from ocr import get_facade
>>> facade = get_facade()
>>> print(facade.get_current_config())
```

### Test Different Engines

1. **Change to Tesseract**:
   ```bash
   # In .env
   OCR_PRIMARY_ENGINE=tesseract
   ```

2. **Change to PaddleOCR with GPU**:
   ```bash
   # In .env
   OCR_PRIMARY_ENGINE=paddle
   OCR_PADDLE_USE_GPU=true
   ```

3. **Use multiple fallbacks**:
   ```bash
   # In .env
   OCR_PRIMARY_ENGINE=paddle
   OCR_FALLBACK_ENGINES=tesseract,easyocr,mock
   ```

### Run OCR Tests

```bash
# Quick test
python -m tests.test_ocr_quick

# Verbose test with all engines
python -m tests.test_ocr_verbose

# Test with screenshot
python -m tests.test_ocr_engines --screenshot
```

## Code Locations

### Main Entry Points

- **OCR Facade**: `ocr/facade.py` - Main OCR interface
- **Configuration**: `ocr/config.py` - Environment variable parsing
- **Engine Factory**: `ocr/engine_factory.py` - Dynamic engine creation
- **Engines**: `ocr/engines/` - Individual OCR engine adapters

### Desktop App Integration

- **Import**: `desktop_app.py:41` - `from ocr import extract_text_from_image`
- **Interval-based**: `desktop_app.py:5695` - `upload_screenshot()` method
- **Event-based**: `desktop_app.py:3233` - `LocalOCRProcessor.capture_and_ocr()`

## Environment Variables Reference

### Global Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `OCR_PRIMARY_ENGINE` | `paddle` | Primary OCR engine to use |
| `OCR_FALLBACK_ENGINES` | `tesseract` | Comma-separated fallback engines |
| `OCR_USE_PREPROCESSING` | `true` | Apply image preprocessing |
| `OCR_MAX_IMAGE_DIMENSION` | `4096` | Max image size (pixels) |

### Engine-Specific Settings

Pattern: `OCR_<ENGINE>_<SETTING>=value`

**PaddleOCR**:
- `OCR_PADDLE_MIN_CONFIDENCE=0.5` - Minimum confidence threshold
- `OCR_PADDLE_USE_GPU=false` - Use GPU acceleration
- `OCR_PADDLE_LANGUAGE=en` - OCR language

**Tesseract**:
- `OCR_TESSERACT_MIN_CONFIDENCE=0.6` - Minimum confidence threshold
- `OCR_TESSERACT_LANGUAGE=eng` - Tesseract language code

**EasyOCR**:
- `OCR_EASYOCR_MIN_CONFIDENCE=0.7` - Minimum confidence threshold
- `OCR_EASYOCR_LANGUAGES=en` - Comma-separated language codes
- `OCR_EASYOCR_GPU=false` - Use GPU acceleration

## Troubleshooting

### Issue: "No OCR engines available"

**Cause**: No OCR packages installed  
**Fix**: Install at least one OCR engine
```bash
pip install paddlepaddle paddleocr  # Or
pip install pytesseract              # Or
pip install easyocr
```

### Issue: OCR always returns empty text

**Cause**: Engine not available or confidence too high  
**Fix**: Check engine availability and lower confidence threshold
```bash
# In .env
OCR_PADDLE_MIN_CONFIDENCE=0.3  # Lower threshold
OCR_FALLBACK_ENGINES=tesseract,mock  # Add fallbacks
```

### Issue: Want to use custom OCR engine

**Solution**: Add dynamic engine configuration
```bash
# In .env
OCR_PRIMARY_ENGINE=myocr
OCR_MYOCR_PACKAGE=my_ocr_package
OCR_MYOCR_MIN_CONFIDENCE=0.6
```

## Migration Guide

### From Hardcoded to Dynamic OCR

If you have old code with hardcoded OCR:

❌ **Old (Hardcoded)**:
```python
import pytesseract
text = pytesseract.image_to_string(image)
```

✅ **New (Dynamic)**:
```python
from ocr import extract_text_from_image
result = extract_text_from_image(image)
text = result['text']
method = result['method']  # Which engine was used
```

## Best Practices

1. **Always use the facade**: Never import OCR engines directly
2. **Configure via .env**: Don't hardcode engine names in code
3. **Use fallbacks**: Always configure at least one fallback engine
4. **Test with different engines**: Verify the application works with multiple engines
5. **Log OCR method**: Track which engine was used for debugging

## Summary

✅ **No hardcoded OCR engines** - All OCR calls use the dynamic facade  
✅ **Environment-based configuration** - Change engines via `.env` file  
✅ **Automatic fallback** - Graceful degradation if primary engine fails  
✅ **Extensible** - Add new engines without code changes  
✅ **Per-engine settings** - Fine-tune each engine independently  

The OCR flow is **fully dynamic and configurable** through environment variables.
