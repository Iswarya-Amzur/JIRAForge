# Batch Processing Test Guide

Complete testing guide for validating JSON record creation and batch upload process.

---

## Quick Start

### 1. Install Dependencies

```bash
pip install supabase python-dotenv psutil
```

### 2. Ensure Desktop App Is Running

```bash
# Start the desktop app
python desktop_app.py

# Login with Jira OAuth
# Start tracking (make sure it's not paused)
```

### 3. Run the Test

```bash
# Recommended: Manual mode (you switch windows)
python test_batch_processing_real.py --manual

# OR: Monitoring mode (watch existing activity)
python test_batch_processing_real.py
```

---

## Test Files

### `test_batch_processing_real.py` - **15-Minute Complete Test**

**Purpose:** Comprehensive validation of the entire batch processing system

**Duration:** 15 minutes (3 complete batch cycles)

**What It Tests:**
- ✅ Real-time session tracking in SQLite `active_sessions` table
- ✅ Batch uploads every 5 minutes to Supabase
- ✅ JSON record structure validation
- ✅ SQLite clearing after successful upload
- ✅ Window switching and visit count tracking
- ✅ OCR data capture and storage
- ✅ Jira context injection
- ✅ Classification system (productive/non-productive)

**Usage:**

```bash
# Manual mode - You actively switch between applications
python test_batch_processing_real.py --manual

# Monitoring mode - Watches your normal activity
python test_batch_processing_real.py
```

**Expected Output:**

```
╔════════════════════════════════════════════════════════════════════════════╗
║                   BATCH PROCESSING VALIDATION TEST                         ║
║                         15-Minute Real Data Test                           ║
╚════════════════════════════════════════════════════════════════════════════╝

================================================================================
  PREFLIGHT CHECKS
================================================================================
[10:00:00] ✓ SQLite database found: offline_screenshots.db
[10:00:00] ✓ active_sessions table exists (0 current records)
[10:00:00] ✓ Supabase connection established
[10:00:00] ✓ Can query activity_records table
[10:00:00] ✓ Desktop app is running

TEST CONFIGURATION:
  Mode: MANUAL
  Duration: 15 minutes (3 batch cycles)
  Batch Interval: 5 minutes
  Expected Batches: 3

================================================================================
  STATUS UPDATE - 1 MIN ELAPSED (14 MIN REMAINING)
================================================================================

  Current Batch Cycle: 1/3
  Next Batch Upload In: ~4 minutes

  📊 SQLITE active_sessions TABLE:

  Found 2 session(s):

  [1] Window: PROJ-123: Implement OAuth Login - Jira
      App: chrome.exe
      Classification: productive
      Time: 45s (visits: 1)
      OCR: paddleocr (156 chars)

  [2] Window: main.py - Visual Studio Code
      App: Code.exe
      Classification: productive
      Time: 30s (visits: 1)
      OCR: paddleocr (89 chars)

  ☁️  SUPABASE activity_records TABLE (since test start):

  (no new records)

================================================================================
  STATUS UPDATE - 5 MIN ELAPSED (10 MIN REMAINING)
================================================================================
[10:05:02] 🚀 BATCH UPLOAD DETECTED! SQLite was cleared.

  Current Batch Cycle: 2/3
  Next Batch Upload In: ~5 minutes

  📊 SQLITE active_sessions TABLE:

  (empty)

  ☁️  SUPABASE activity_records TABLE (since test start):

  Found 5 record(s):

  [1] Window: PROJ-123: Implement OAuth Login - Jira
      App: chrome.exe
      Classification: productive | Status: pending
      Duration: 180s | Batch: 2026-02-20 10:05:00
      Jira Issues: PROJ-123, PROJ-124

  [2] Window: main.py - Visual Studio Code
      App: Code.exe
      Classification: productive | Status: pending
      Duration: 150s | Batch: 2026-02-20 10:05:00
      Jira Issues: PROJ-123, PROJ-124
```

---

### `test_batch_quick.py` - **Quick Validation (5 Minutes)**

**Purpose:** Fast validation that batch system is working

**Duration:** 5 minutes (1 batch cycle)

**Usage:**

```bash
python test_batch_quick.py
```

---

## Test Scenarios

### Scenario 1: Normal Operation (Recommended)

**Goal:** Test realistic usage pattern

**Steps:**
1. Start test in manual mode: `python test_batch_processing_real.py --manual`
2. Switch between applications naturally:
   - Open VS Code, work on code files
   - Switch to Chrome, open Jira issue tab
   - Check Slack messages
   - Return to VS Code
   - Open Stack Overflow for reference
   - Return to Jira to update issue
3. Observe status updates every minute
4. Verify batch uploads at 5, 10, and 15 minute marks

**Expected Results:**
- SQLite shows active sessions accumulating
- At 5-minute mark: SQLite clears, Supabase shows new records
- Visit counts increment when returning to same windows
- OCR text captured for productive apps
- No OCR for non-productive apps

---

### Scenario 2: Visit Count Validation

**Goal:** Verify that returning to same window increments visit_count

**Steps:**
1. Start test
2. Open Chrome with Jira tab
3. Wait 30 seconds
4. Switch to VS Code
5. Wait 30 seconds
6. Switch back to Chrome Jira tab (same tab)
7. Wait 30 seconds
8. Check SQLite: Chrome session should show visit_count = 2

**Expected Results:**
- Single Chrome/Jira session record
- Total time accumulates across both visits
- Visit count = 2

---

### Scenario 3: Classification Testing

**Goal:** Verify classification system works correctly

**Windows to Test:**
- **Productive:** VS Code, Jira, Stack Overflow, GitHub
- **Non-Productive:** YouTube, Gmail inbox, Social media
- **Private:** Banking sites (if configured)

**Expected Results:**
- Productive apps: OCR captured, status='pending'
- Non-productive apps: No OCR, status='analyzed'
- Private apps: Window title redacted, no OCR

---

### Scenario 4: Offline/Online Testing

**Goal:** Verify offline resilience

**Steps:**
1. Start test
2. After 3 minutes, disconnect network
3. At 5-minute mark: Batch upload should fail gracefully
4. Continue working (sessions accumulate)
5. At 7 minutes, reconnect network
6. At 10-minute mark: All accumulated sessions should upload

**Expected Results:**
- Sessions remain in SQLite when offline
- No data loss
- Automatic sync when connection restored

---

## Validation Checklist

Use this checklist to verify test success:

### ✅ SQLite Validation

- [ ] `active_sessions` table exists
- [ ] Sessions created on window switch
- [ ] Unique constraint works (no duplicates)
- [ ] `total_time_seconds` accumulates correctly
- [ ] `visit_count` increments on return
- [ ] `ocr_text` captured for productive apps
- [ ] `ocr_method` set (paddleocr/tesseract/clipboard)
- [ ] Table clears after successful upload

### ✅ Supabase Validation

- [ ] Records uploaded every 5 minutes
- [ ] All required fields present:
  - `window_title`
  - `application_name`
  - `classification`
  - `ocr_text`
  - `ocr_method`
  - `total_time_seconds`
  - `visit_count`
  - `batch_timestamp`
  - `status`
  - `user_assigned_issues`
  - `project_key`
- [ ] Status correct: 'pending' for productive, 'analyzed' for non-productive
- [ ] Jira context included (if user has issues)
- [ ] Timestamps in ISO 8601 format
- [ ] User ID and organization ID present

### ✅ Batch Upload Validation

- [ ] First batch at ~5 minutes
- [ ] Second batch at ~10 minutes
- [ ] Third batch at ~15 minutes
- [ ] SQLite cleared after each successful upload
- [ ] No duplicate uploads
- [ ] Failed uploads retry in next cycle

### ✅ Data Integrity

- [ ] No data loss
- [ ] Time calculations accurate
- [ ] Visit counts match actual returns
- [ ] OCR text matches window content
- [ ] Classification matches app type

---

## Troubleshooting

### Issue: "SQLite database not found"

**Solution:**
1. Make sure desktop app is running
2. Start tracking (click "Start Tracking" in system tray)
3. Database is created on first window switch

### Issue: "Supabase not connected"

**Solution:**
1. Check `.env` file has correct credentials:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJxxx...
   ```
2. Verify credentials are valid
3. Check network connection

### Issue: "No batch uploads detected"

**Possible Causes:**
1. Desktop app is paused (check system tray icon)
2. User is idle (move mouse/keyboard to resume)
3. Less than 5 minutes elapsed
4. Desktop app crashed (restart it)

**Verification:**
```bash
# Check if desktop app is running
tasklist | findstr python  # Windows
ps aux | grep desktop_app  # Linux/Mac
```

### Issue: "Records missing required fields"

**Solution:**
1. Update desktop app to latest version
2. Check database schema migrations ran
3. Restart desktop app

### Issue: "No Jira issues in records"

**Possible Causes:**
1. User has no "In Progress" issues
2. Not logged in / OAuth token expired
3. Jira API rate limit hit

**Verification:**
- Check desktop app logs for Jira API errors
- Manually verify in Jira: do you have In Progress issues?

---

## Advanced Testing

### Custom Test Duration

Modify the test script to change duration:

```python
# In test_batch_processing_real.py
self.test_duration = 10 * 60  # 10 minutes instead of 15
```

### Faster Batch Interval (For Development)

⚠️ **Warning:** Requires modifying desktop app source

```python
# In desktop_app.py line 3466
self.batch_upload_interval = 60  # 1 minute (for testing only!)
```

Then run:
```bash
python test_batch_quick.py  # Will now test 1-minute batches
```

### Database Inspection

Manually inspect SQLite database:

```bash
# Install SQLite browser
# Windows: https://sqlitebrowser.org/

# Or use command line
sqlite3 "%LOCALAPPDATA%\TimeTracker\offline_screenshots.db"

sqlite> .tables
sqlite> SELECT * FROM active_sessions;
sqlite> .exit
```

---

## Expected Test Results

### Successful Test Output (Final Report)

```
================================================================================
  FINAL TEST REPORT
================================================================================

  Test Duration: 15 minutes
  Batches Detected: 3/3 expected

  Batch Upload Times (minutes into test):
    [1] 5 min 2 sec
    [2] 10 min 1 sec
    [3] 15 min 3 sec

  📊 FINAL SQLITE STATE:

  Found 2 session(s):
  [1] Window: test.py - Visual Studio Code
      App: Code.exe
      Classification: productive
      Time: 45s (visits: 1)
      OCR: paddleocr (234 chars)

  ☁️  FINAL SUPABASE STATE (all records from test):

  Found 18 record(s):
  [... detailed records ...]

  VALIDATION:
  [10:15:05] ✓ All 3 batch uploads detected
  [10:15:05] ✓ 18 records uploaded to Supabase
  [10:15:05] ✓ All required fields present in records
  [10:15:05] ✓ Jira context included in records
  [10:15:05] ⚠ 2 sessions still in SQLite (next batch pending)

================================================================================
  ✓ TEST PASSED - Batch processing is working correctly!
================================================================================
```

---

## Manual Verification

If you want to verify manually without running the test script:

### 1. Check SQLite

```bash
# Windows PowerShell
$dbPath = "$env:LOCALAPPDATA\TimeTracker\offline_screenshots.db"
sqlite3 $dbPath "SELECT window_title, application_name, total_time_seconds, visit_count FROM active_sessions;"
```

### 2. Check Supabase

Visit your Supabase dashboard:
```
https://app.supabase.com/project/YOUR_PROJECT/editor/TABLE_EDITOR:activity_records
```

Filter by recent `batch_timestamp` to see latest uploads.

### 3. Monitor Desktop App Logs

Desktop app prints batch upload status:
```
[BATCH] No activity records to upload
[BATCH] Uploaded 5 activity records (3 pending AI, 2 pre-analyzed)
[BATCH] Offline — 3 records stay in SQLite for retry
```

---

## Support

If tests fail:

1. **Check Desktop App Logs** - Most issues show up in console output
2. **Verify Preflight Checks** - Run test and check preflight section
3. **Review Database Schema** - Ensure migrations ran correctly
4. **Check Network** - Supabase must be reachable
5. **Verify OAuth** - User must be logged in with valid token

For more details, see:
- [JSON_RECORD_STRUCTURE_AND_FLOW.md](../docs/JSON_RECORD_STRUCTURE_AND_FLOW.md)
- [BATCH_PROCESS_VERIFICATION.md](../docs/BATCH_PROCESS_VERIFICATION.md)
