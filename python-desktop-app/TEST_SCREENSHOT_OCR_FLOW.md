# Screenshot → OCR → Database Flow Test

Simple test script to verify the complete activity tracking flow.

## What It Tests

1. **Window Capture**: Gets the currently active window title and process name
2. **Classification**: Determines if the app is productive/non-productive/private
3. **Screenshot**: Captures the screen (or uses mock)
4. **OCR Processing**: Extracts text using configured OCR engines (only for productive apps)
5. **Database Storage**: Shows what would be saved to `activity_records` table

## Quick Start

```bash
# Basic test (uses your current screen/window)
python test_screenshot_ocr_flow.py

# Test with mock data (simulates a productive app like VSCode)
python test_screenshot_ocr_flow.py --mock-productive

# Test with non-productive app (OCR should be skipped)
python test_screenshot_ocr_flow.py --mock-nonproductive
```

## Requirements

```bash
pip install pillow pywin32 psutil
```

Plus OCR engines (see your `.env` configuration):
- Paddle OCR: `pip install paddlepaddle paddleocr`
- Tesseract: `pip install pytesseract` + install Tesseract binary
- EasyOCR: `pip install easyocr`

## What to Expect

### Productive App (e.g., VSCode, Chrome on GitHub)
- ✅ Classification: `productive`
- ✅ Screenshot captured
- ✅ OCR runs using configured engines (paddle → tesseract → easyocr)
- ✅ Text extracted and saved with `ocr_method`, `ocr_confidence`

### Non-Productive App (e.g., Spotify, YouTube)
- ✅ Classification: `non_productive`
- ✅ Screenshot captured
- ⊘ OCR **skipped** (privacy/efficiency)
- ✅ Saved without `ocr_text`

### Private App (e.g., Banking)
- ✅ Classification: `private`
- ⊘ OCR **skipped** (privacy protection)
- ✅ Marked as private

## Output Example

```
======================================================================
  SCREENSHOT → OCR → DATABASE FLOW TEST
======================================================================

🪟 STEP 1: Get Active Window
----------------------------------------------------------------------
  Window Title: test_screenshot_ocr_flow.py - Visual Studio Code
  App Name: code.exe

🔍 STEP 2: Classify Window
----------------------------------------------------------------------
  Classification: productive

📸 STEP 3: Capture Screenshot
----------------------------------------------------------------------
  Screenshot: Captured (1920x1080)

🔤 STEP 4: Extract Text with OCR
----------------------------------------------------------------------
  Running OCR (productive app)...
  ✓ OCR completed
    Method: paddle
    Confidence: 0.87
    Text Length: 245 characters
    Preview: Productivity Tracking Test JIRA-123: Implement OCR...

💾 STEP 5: Save to Database
----------------------------------------------------------------------
Saving to activity_records table:
======================================================================
  window_title: test_screenshot_ocr_flow.py - Visual Studio Code
  application_name: code.exe
  classification: productive
  ocr_text: Productivity Tracking Test...
  ocr_method: paddle
  ocr_confidence: 0.87
  ocr_error_message: None
  timestamp: 2026-02-20T10:30:00.000Z
======================================================================

✅ TEST COMPLETE
```

## Configuration

The test respects your `.env` configuration:

```env
# Primary OCR engine
OCR_PRIMARY_ENGINE=paddle

# Fallback engines (comma-separated)
OCR_FALLBACK_ENGINES=tesseract,easyocr

# Engine-specific settings
OCR_PADDLE_MIN_CONFIDENCE=0.5
OCR_TESSERACT_MIN_CONFIDENCE=0.3
```

## Troubleshooting

### "Could not get active window"
- Install dependencies: `pip install pywin32 psutil`
- Or use mock mode: `python test_screenshot_ocr_flow.py --mock-productive`

### "OCR failed" or "DLL load failed"
- Check your OCR engines are installed correctly
- See `docs/OCR_TESTING_QUICKSTART.md` for installation guides
- Test will still complete and show what data would be saved

### "Screenshot capture failed"
- Use mock mode: `--mock-productive`
- Check PIL/Pillow is installed: `pip install pillow`

## Integration with Main System

This test script simulates what happens in `desktop_app.py`:

1. **AppClassificationManager**: Handles classification logic (simplified here)
2. **LocalOCRProcessor**: Uses OCR facade to extract text
3. **ActiveSessionManager**: Manages time tracking (not included in this test)
4. **Batch Upload**: Saves to Supabase `activity_records` table (prints here)

## Next Steps

After testing:
1. Run full system: `python desktop_app.py`
2. Check activity records in Supabase
3. Verify OCR text appears for productive apps
4. Verify `ocr_method` field shows which engine was used
