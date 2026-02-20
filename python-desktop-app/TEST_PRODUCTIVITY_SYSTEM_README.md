# Test Script for Automated Productivity & Activity Tracking System

## Overview

This comprehensive test script validates the entire automated productivity and activity tracking system from capture to batch analysis.

## System Architecture Being Tested

### 1. **Capture & Classification Logic**
- **Step A: Local Lookup** - Checks `application_classifications` table for window title/process name
- **Step B: LLM Classification** - Falls back to LLM for unknown applications
- **Categories**: Productive, Non-Productive, Private, Unknown

### 2. **OCR Processing** (Productive Apps Only)
- **Primary Engine**: Default OCR engine from `.env`
- **Secondary Engine**: Automatic fallback if primary fails
- **Storage**: Extracted text saved in `ocr_text` column
- **Note**: Screenshots NOT captured for Non-Productive or Private apps (metadata only)

### 3. **Session & Time-Log Management**
- **JSON Records**: `{window_title + process_name + ocr_text + timelog}`
- **Tab Switching**: New tab creates new record
- **Return to Tab**: Updates existing record (no duplicates), appends timelog

### 4. **Batch Analysis & Reporting** (Every 5 Minutes)
- Gathers batch of JSON records
- Injects current Jira Issues as context
- Sends to LLM for analysis
- Stores final activity summary in database

## Test Coverage

### ✅ Classification Tests (`TestAppClassificationManager`)
- [x] Step A: Productive process classification
- [x] Step A: Non-productive process classification
- [x] Step A: Private process classification
- [x] Step A: Browser URL classification (productive)
- [x] Step A: Browser URL classification (non-productive)
- [x] Step A: Browser URL wildcard patterns (private)
- [x] Step B: Unknown process triggers LLM
- [x] Step B: Unknown browser URL triggers LLM

### 🔍 OCR Tests (`TestOCRProcessing`)
- [x] OCR on productive app using primary engine
- [x] OCR fallback when primary engine fails
- [x] OCR NOT called for non-productive apps
- [x] OCR NOT called for private apps

### ⏱️ Session Management Tests (`TestSessionManagement`)
- [x] New window creates JSON record
- [x] Tab switching creates new record
- [x] Return to previous tab updates existing (no duplicate)
- [x] Timelog accumulates across multiple visits

### 📊 Batch Analysis Tests (`TestBatchAnalysis`)
- [x] Batch upload occurs after 5 minutes
- [x] LLM receives context with current Jira issues
- [x] Active sessions cleared after successful upload
- [x] Productive records marked 'pending' for AI
- [x] Non-productive records marked 'analyzed' (no AI needed)

### 🔗 Integration Tests (`TestIntegrationFlow`)
- [x] Complete flow: capture → classify → OCR → session → batch
- [x] Multiple window switches with time accumulation
- [x] Batch preparation with Jira context

## Usage

### Run All Tests
```bash
python test_productivity_tracking_system.py
```

### Run Specific Test Categories

**Classification Tests Only:**
```bash
python test_productivity_tracking_system.py --classification
```

**OCR Tests Only:**
```bash
python test_productivity_tracking_system.py --ocr
```

**Session Management Tests Only:**
```bash
python test_productivity_tracking_system.py --session
```

**Batch Analysis Tests Only:**
```bash
python test_productivity_tracking_system.py --batch
```

**Integration Tests Only:**
```bash
python test_productivity_tracking_system.py --integration
```

### Run Multiple Categories
```bash
python test_productivity_tracking_system.py --classification --session --batch
```

## Prerequisites

### Required Dependencies
```bash
pip install pillow psutil requests python-dotenv supabase
```

### Optional (for OCR tests)
```bash
# For Paddle OCR (primary engine)
pip install paddlepaddle paddleocr

# For Tesseract OCR (fallback)
pip install pytesseract
# Also install Tesseract binary from: https://github.com/UB-Mannheim/tesseract/wiki

# For EasyOCR (alternative fallback)
pip install easyocr
```

**Note**: OCR tests will be skipped gracefully if OCR engines are not installed.

## Test Database

Tests use temporary SQLite databases that are automatically created and cleaned up. No impact on production data.

## Test Output Example

```
======================================================================
  PRODUCTIVITY & ACTIVITY TRACKING SYSTEM - TEST SUITE
======================================================================

📋 Loading Classification Tests...
🔍 Loading OCR Processing Tests...
⏱️  Loading Session Management Tests...
📊 Loading Batch Analysis Tests...
🔗 Loading Integration Tests...

----------------------------------------------------------------------

test_step_a_productive_process_classification ... ✓ Step A: Productive process classification works
ok
test_step_a_non_productive_process_classification ... ✓ Step A: Non-productive process classification works
ok
test_step_a_private_process_classification ... ✓ Step A: Private process classification works
ok
...

======================================================================
  TEST SUMMARY
======================================================================
Tests run: 24
Successes: 24
Failures: 0
Errors: 0
======================================================================
```

## Mock Data

### Application Classifications
- **Productive**: vscode.exe, pycharm64.exe, slack.exe, teams.exe, jira.atlassian.net, github.com
- **Non-Productive**: steam.exe, spotify.exe, youtube.com, facebook.com
- **Private**: banking.exe, health.exe, *bank* (wildcard)

### Sample Sessions
Tests simulate various scenarios:
- Developer working in VSCode
- Reviewing pull requests on GitHub
- Switching between tabs
- Private banking activities
- Non-productive browsing

## Architecture Validation

This test suite validates:
1. ✅ No screenshots captured for Non-Productive/Private apps
2. ✅ OCR only runs on Productive/Unknown apps
3. ✅ Fallback OCR engine activates when primary fails
4. ✅ Tab switching creates new JSON records
5. ✅ Returning to previous tab updates existing record (no duplicates)
6. ✅ Timelogs accumulate across visits
7. ✅ Batch uploads every 5 minutes
8. ✅ Jira issues injected as context for LLM
9. ✅ Active sessions cleared after successful batch upload
10. ✅ Unknown apps trigger async LLM classification

## Troubleshooting

### Import Errors
If you see import errors for `desktop_app`, ensure you're running from the `python-desktop-app` directory:
```bash
cd python-desktop-app
python test_productivity_tracking_system.py
```

### OCR Tests Skipped
If OCR tests are skipped, it means OCR engines are not installed. This is expected for basic testing. Install OCR engines if you need to test OCR functionality:
```bash
pip install paddlepaddle paddleocr pytesseract easyocr
```

### Database Lock Errors
If you encounter database lock errors, ensure no other instances of the application are running:
```bash
# Windows
taskkill /F /IM python.exe /FI "WINDOWTITLE eq Time Tracker*"
```

## Extending Tests

To add new test cases:

1. **Add to existing test class** (for related functionality):
```python
def test_new_classification_scenario(self):
    """Test description"""
    classification, match_type = self.manager.classify('app.exe', 'Window')
    self.assertEqual(classification, 'expected')
    print("✓ New test passed")
```

2. **Create new test class** (for new functionality):
```python
class TestNewFeature(unittest.TestCase):
    def setUp(self):
        # Setup code
        pass
    
    def test_feature(self):
        # Test code
        pass
```

3. **Update test runner** to include new test class:
```python
if not test_categories or 'newfeature' in test_categories:
    suite.addTests(loader.loadTestsFromTestCase(TestNewFeature))
```

## CI/CD Integration

This test script can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/test.yml
name: Run Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: python python-desktop-app/test_productivity_tracking_system.py
```

## Support

For issues or questions about the test suite, please refer to:
- Main documentation: `docs/OCR_TESTING_GUIDE.md`
- Architecture guide: `docs/COMPLETE_ARCHITECTURE_GUIDE.md`
- Implementation details: `docs/IMPLEMENTATION_SUMMARY.md`

## License

This test script is part of the JIRAForge project and follows the same license.
