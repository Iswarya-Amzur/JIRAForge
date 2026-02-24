# OCR Continuous Test Guide

## Overview

The continuous OCR test (`test_ocr_continuous.py`) runs for 1 hour (configurable) and automatically captures screenshots whenever you switch windows or tabs. It's designed to test OCR functionality in real-world usage scenarios while tracking time spent on each activity.

## What It Does

1. **Detects Window Switches**: Monitors your active window every second
2. **Captures Screenshots**: Takes a screenshot when you switch to a new window/tab
3. **Stores Screenshots**: Saves both full screenshot and thumbnail as base64 in the database
4. **Extracts Text with OCR**: Uses the three-layer fallback system (PaddleOCR → Tesseract → Metadata)
5. **Tracks Time**: Calculates how long you spent on each window
6. **Saves Results**: Stores all data (including images) in the `ocr_test_results` table

## Quick Start

### Basic Usage (1 hour test)

```bash
cd python-desktop-app
python test_ocr_continuous.py
```

### Custom Duration

```bash
# 30 minute test
python test_ocr_continuous.py --duration 0.5

# 2 hour test
python test_ocr_continuous.py --duration 2.0

# 15 minute test
python test_ocr_continuous.py --duration 0.25
```

### Custom User ID

```bash
python test_ocr_continuous.py --user-id "12345678-1234-1234-1234-123456789abc"
```

## What to Expect

### During the Test

```
================================================================================
 🧪 CONTINUOUS OCR TEST - 1 HOUR WINDOW TRACKING
================================================================================

Test Configuration:
  Duration: 1 hour(s)
  User ID: 00000000-0000-0000-0000-000000000000
  Check Interval: 1 second
  Behavior: Capture screenshot on every window/tab switch

What will happen:
  • Detects when you switch windows or tabs
  • Captures screenshot of new window
  • Extracts text using OCR (PaddleOCR → Tesseract → Metadata)
  • Tracks time spent on previous window
  • Saves results to ocr_test_results table

⚠️  IMPORTANT: Use your computer normally - switch between apps/tabs
    The test will automatically capture changes.

Press Ctrl+C to stop early and see results.
================================================================================

📱 Initial window: chrome.exe - Gmail
   Waiting for window switches...

🔄 Switch #1 | Elapsed: 12.3m | Remaining: 47.7m
  From: chrome.exe - Gmail
  To:   Code.exe - desktop_app.py - Visual Studio Code
  Time on previous: 45.2s
  ✓ 🟢 PADDLE     | conf:0.87 | lines: 42 | time: 823ms [45.2s]
     Text: class TimeTracker: """Main application class""" def __init__(self):...

🔄 Switch #2 | Elapsed: 15.8m | Remaining: 44.2m
  From: Code.exe - desktop_app.py - Visual Studio Code
  To:   Slack.exe - #general - Slack
  Time on previous: 208.4s
  ✓ 🟢 PADDLE     | conf:0.92 | lines: 18 | time: 654ms [208.4s]
     Text: John Doe: Hey team, quick question about the deployment...
```

### End of Test

```
================================================================================
 📊 TEST STATISTICS
================================================================================

⏱️  Time:
  Total test duration: 60.0 minutes (3600 seconds)
  Planned duration: 1 hour(s)
  Completion: 100.0%

📸 Captures:
  Total screenshots: 47
  Window switches detected: 47
  Avg time per window: 76.6s

🔍 OCR Methods:
  🟢 PADDLE    :  38 ( 80.9%)
  🟡 TESSERACT :   6 ( 12.8%)
  🔵 METADATA  :   3 (  6.4%)

💾 Database:
  Table: ocr_test_results
  Records saved: 47

📋 Recent Results (last 5):
────────────────────────────────────────────────────────────────────────────────
  1. 🟢 paddle     | conf:0.91 | lines: 24 | Slack.exe - #general - Slack
  2. 🟢 paddle     | conf:0.85 | lines: 35 | chrome.exe - GitHub - Mozilla Firefox
  3. 🟡 tesseract  | conf:0.72 | lines: 12 | Terminal.exe - PowerShell
  4. 🟢 paddle     | conf:0.89 | lines: 28 | Code.exe - desktop_app.py - Visual Studio...
  5. 🟢 paddle     | conf:0.93 | lines: 31 | chrome.exe - Gmail

================================================================================
✅ Test data saved to Supabase ocr_test_results table
================================================================================
```

## How to Use the Test Effectively

### 1. Test Real-World Scenarios

**Do your normal work** during the test:
- Browse websites (read articles, documentation)
- Write code in your IDE
- Check emails
- Use Slack/Teams
- Work in Excel/Word documents
- Switch between different tabs in browser

### 2. Test Different Content Types

Switch between windows with:
- ✅ **High text density**: Code editors, documents, emails
- ✅ **Medium text**: Web pages, Slack messages
- ✅ **Low text**: Images, videos, design tools
- ✅ **Mixed content**: Dashboards, terminals

### 3. Monitor OCR Performance

Watch the output to see:
- Which OCR method is used (🟢 PaddleOCR, 🟡 Tesseract, 🔵 Metadata)
- Confidence scores (higher is better)
- Line counts (how much text detected)
- Processing times (should be under 1-2 seconds)

### 4. Stop Early if Needed

Press `Ctrl+C` at any time to stop the test and see statistics for the data collected so far.

## Understanding the Output

### Window Switch Detection

```
🔄 Switch #1 | Elapsed: 12.3m | Remaining: 47.7m
  From: chrome.exe - Gmail
  To:   Code.exe - desktop_app.py - Visual Studio Code
  Time on previous: 45.2s
```

- **Switch #**: How many window switches detected
- **Elapsed/Remaining**: Test progress
- **From/To**: Previous and new window
- **Time on previous**: How long you spent on the previous window

### OCR Results

```
✓ 🟢 PADDLE     | conf:0.87 | lines: 42 | time: 823ms [45.2s]
   Text: class TimeTracker: """Main application class""" def __init__(self):...
```

- **✓/✗**: Success or failure
- **🟢/🟡/🔵**: Method (green=PaddleOCR, yellow=Tesseract, blue=Metadata)
- **conf**: Confidence score (0.0-1.0, higher is better)
- **lines**: Number of text lines detected
- **time**: Processing time in milliseconds
- **[45.2s]**: Duration on that window

## Analyzing Results

### Query in Supabase

```sql
-- View all results from continuous test
SELECT 
    created_at,
    application_name,
    window_title,
    ocr_method,
    ocr_confidence,
    ocr_line_count,
    processing_time_ms,
    test_notes  -- Contains duration
FROM ocr_test_results
WHERE test_name = 'continuous_1hr_test'
ORDER BY created_at DESC;

-- Summary by application
SELECT 
    application_name,
    COUNT(*) as switch_count,
    AVG(ocr_confidence) as avg_confidence,
    AVG(processing_time_ms) as avg_processing_ms,
    SUM(CAST(SPLIT_PART(test_notes, ' ', 2) AS FLOAT)) as total_time_seconds
FROM ocr_test_results
WHERE test_name = 'continuous_1hr_test'
GROUP BY application_name
ORDER BY switch_count DESC;

-- OCR method distribution
SELECT 
    ocr_method,
    COUNT(*) as count,
    ROUND(AVG(ocr_confidence)::numeric, 2) as avg_confidence,
    ROUND(AVG(processing_time_ms)::numeric, 0) as avg_time_ms
FROM ocr_test_results
WHERE test_name = 'continuous_1hr_test'
GROUP BY ocr_method
ORDER BY count DESC;
```

## Tips for Best Results

### ✅ DO:
- Use your computer normally - don't force artificial switches
- Switch between varied content types (code, web, docs, chat)
- Leave the test running in the background
- Check the console occasionally to verify it's working
- Review the statistics at the end

### ❌ DON'T:
- Rapidly switch windows to inflate numbers
- Focus only on one type of content
- Close windows needed by other apps
- Run multiple tests simultaneously
- Modify the test table schema during the test

## Troubleshooting

### "ERROR: Missing Supabase configuration"

Add to `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TEST_USER_ID=your_test_user_id
```

### No window switches detected

- **Cause**: Staying in the same window/tab
- **Solution**: Actually switch between different applications or browser tabs

### Low confidence scores

- **Cause**: Windows with little text, images, or videos
- **Solution**: This is expected - the test uses metadata fallback

### "win32gui not available"

- **Cause**: Missing Windows dependencies
- **Solution**: Install: `pip install pywin32 psutil`

## Integration with Desktop App

This test mimics the desktop app's window tracking behavior:
- Same window detection logic
- Same OCR extraction process  
- Same three-layer fallback system
- Same database fields

Use this test to validate OCR performance before rolling out changes to the desktop app.

## Next Steps

After running the test:

1. **Analyze Results**: Query the database to understand OCR performance
2. **Check Method Distribution**: Ensure PaddleOCR is handling 70-80% of captures
3. **Review Low-Confidence Cases**: Identify what content types struggle with OCR
4. **Optimize Settings**: Adjust thresholds if needed based on real data
5. **Document Findings**: Keep notes on typical confidence scores and processing times

## Configuration Options

All configurable via command line or environment variables:

| Option | Default | Description |
|--------|---------|-------------|
| `--duration` | 1.0 | Test duration in hours |
| `--user-id` | from .env | User ID for test records |
| `TEST_USER_ID` | 00000000-... | Default user ID in .env |

## Example Commands

```bash
# Quick 15-minute test
python test_ocr_continuous.py --duration 0.25

# Full 1-hour test with custom user
python test_ocr_continuous.py --user-id "abc123..." --duration 1.0

# Extended 2-hour test
python test_ocr_continuous.py --duration 2.0

# Stop anytime with Ctrl+C and get partial results
```

---

**Remember**: This test captures your screen content. Run it in a test environment or be mindful of sensitive information displayed during the test period.
