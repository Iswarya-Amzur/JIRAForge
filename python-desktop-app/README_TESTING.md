# Testing Tools for Batch Processing & JSON Records

Complete test suite for validating the batch processing system and JSON record creation.

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
pip install supabase python-dotenv psutil

# Ensure desktop app is running
python desktop_app.py

# Make sure you're logged in and tracking is active
```

### Run Your First Test (5 Minutes)

```bash
python test_batch_quick.py
```

This will validate that batch processing is working in just 5 minutes.

---

## 📦 Testing Tools Overview

### 1. **inspect_databases.py** - Quick Data Viewer ⚡

**Purpose:** Instant snapshot of current database state

**Usage:**
```bash
# Single check
python inspect_databases.py

# Watch mode (auto-refresh every 10 seconds)
python inspect_databases.py --watch

# Detailed view with OCR text and Jira issues
python inspect_databases.py --detailed

# Custom refresh interval
python inspect_databases.py --watch --interval 5
```

**When to use:**
- Quick check of what's in databases right now
- Debug why batch upload isn't happening
- Monitor active sessions in real-time
- Verify data structure

**Example Output:**
```
╔════════════════════════════════════════════════════════════════════════════╗
║                         DATABASE INSPECTOR                                 ║
╚════════════════════════════════════════════════════════════════════════════╝

  Inspection Time: 2026-02-20 10:15:30
  SQLite DB: offline_screenshots.db

================================================================================
  📊 SQLITE active_sessions TABLE
================================================================================
  ✓ Found 3 active session(s)

  [1] PROJ-123: Implement OAuth Login - Jira
      App: chrome.exe
      Classification: productive | OCR Method: paddleocr
      Time: 180s | Visits: 2
      First Seen: 2026-02-20 10:10:00 | Last Seen: 2026-02-20 10:13:00

  [2] main.py - Visual Studio Code
      App: Code.exe
      Classification: productive | OCR Method: paddleocr
      Time: 120s | Visits: 1
      First Seen: 2026-02-20 10:13:00 | Last Seen: 2026-02-20 10:15:00
```

---

### 2. **test_batch_quick.py** - 5-Minute Validation ⏱️

**Purpose:** Fast verification that batch system is working

**Usage:**
```bash
python test_batch_quick.py
```

**What it does:**
- Monitors databases for 5 minutes
- Checks at 1, 2, 3, 4, 5 minute marks
- Validates batch upload at 5-minute mark
- Verifies SQLite clearing after upload
- Shows final pass/fail verdict

**Timeline:**
```
0:00 → Test starts
1:00 → Checkpoint 1 (show SQLite state)
2:00 → Checkpoint 2
3:00 → Checkpoint 3
4:00 → Checkpoint 4
5:00 → Checkpoint 5 (BATCH UPLOAD SHOULD OCCUR)
5:30 → Final results
```

**When to use:**
- Quick smoke test after code changes
- Verify setup is correct before longer tests
- Debug batch upload issues
- Daily validation

---

### 3. **test_batch_processing_real.py** - Complete 15-Min Test 🎯

**Purpose:** Comprehensive validation of entire system

**Usage:**
```bash
# Manual mode (recommended) - you switch windows
python test_batch_processing_real.py --manual

# Monitoring mode - watches your activity
python test_batch_processing_real.py
```

**What it tests:**
- 3 complete batch cycles (5, 10, 15 minute marks)
- Window switching and visit count tracking
- OCR capture for productive apps
- Classification system (productive/non-productive/private)
- Jira context injection
- SQLite → Supabase data flow
- Offline resilience
- Data integrity

**Status Updates:**
- Updates every minute
- Shows SQLite and Supabase state
- Detects batch uploads automatically
- Final comprehensive report

**When to use:**
- Before releasing new features
- Comprehensive system validation
- Regression testing
- Performance testing

---

## 📋 Test Scenarios

### Scenario 1: First-Time Setup Validation

**Goal:** Verify everything is configured correctly

**Steps:**
```bash
# 1. Check databases are accessible
python inspect_databases.py

# 2. Run quick test
python test_batch_quick.py

# 3. If successful, run full test
python test_batch_processing_real.py --manual
```

**Expected:** All tests pass, data flows correctly

---

### Scenario 2: Daily Smoke Test

**Goal:** Quick verification system is working

**Steps:**
```bash
# Single command
python test_batch_quick.py
```

**Duration:** 5 minutes  
**Expected:** Batch upload at 5-minute mark, records in Supabase

---

### Scenario 3: Debugging "No Batch Uploads"

**Goal:** Figure out why batches aren't uploading

**Steps:**
```bash
# 1. Check current state
python inspect_databases.py --detailed

# 2. Watch in real-time
python inspect_databases.py --watch

# 3. Check desktop app logs
# Look for: "[BATCH]" messages

# 4. Verify preflight checks
python test_batch_quick.py
# Watch preflight section carefully
```

**Common Issues:**
- Desktop app not running → Start it
- Tracking paused → Resume tracking
- User idle → Move mouse/keyboard
- Network offline → Check connection
- SQLite database not created → Start tracking once

---

### Scenario 4: Visit Count Testing

**Goal:** Verify that returning to same window increments visit_count

**Steps:**
```bash
# 1. Start monitoring
python inspect_databases.py --watch

# 2. In another window:
#    - Open Chrome with Jira
#    - Wait 30 seconds
#    - Switch to VS Code
#    - Wait 30 seconds
#    - Return to Chrome Jira tab
#    - Wait 30 seconds

# 3. Check inspector - Chrome session should show:
#    visit_count: 2
#    total_time_seconds: ~60s (30s + 30s)
```

---

### Scenario 5: Classification Testing

**Goal:** Verify classification system works

**Test Windows:**

| Window | Expected Classification | Expected OCR |
|--------|------------------------|--------------|
| VS Code | productive | Yes |
| Jira | productive | Yes |
| GitHub | productive | Yes |
| Stack Overflow | productive | Yes |
| Gmail Inbox | non_productive | No |
| YouTube | non_productive | No |
| Banking site | private (if configured) | No |

**Steps:**
```bash
# 1. Start test
python test_batch_processing_real.py --manual

# 2. Switch between above windows
# 3. At 5-minute mark, check classifications in report
```

---

## 🔍 Interpreting Results

### ✅ Successful Test Indicators

- **SQLite:** Sessions accumulate, then clear after 5 minutes
- **Supabase:** New records appear after each batch
- **Visit Count:** Increments when returning to same window
- **OCR:** Text captured for productive apps
- **Classification:** Correct for each app type
- **Status:** 'pending' for productive, 'analyzed' for non-productive

### ⚠️ Warning Signs

- **Empty SQLite:** No activity being tracked
  - Check: Is desktop app running?
  - Check: Is tracking active (not paused)?
  - Check: Is user idle?

- **SQLite not clearing:** Batch uploads failing
  - Check: Network connection
  - Check: Supabase credentials
  - Check: Desktop app logs for errors

- **No Supabase records:** Upload not working
  - Check: `.env` file has valid credentials
  - Check: User is logged in (not anonymous)
  - Check: Network can reach Supabase

- **Wrong Classifications:** Classification rules outdated
  - Check: Manual classifications in Supabase
  - Check: AI server is running (for unknown apps)

---

## 📊 Understanding the Data Flow

```
┌─────────────────┐
│  USER ACTIVITY  │ → Window switches
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  DESKTOP APP (desktop_app)  │
│  - Detects window switch    │
│  - Classifies app           │
│  - Runs OCR (if productive) │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  SQLITE (active_sessions)   │ ← Real-time tracking
│  - Creates/updates session  │
│  - Accumulates time         │
│  - Tracks visits            │
└────────┬────────────────────┘
         │
         │ Every 5 minutes
         ▼
┌─────────────────────────────┐
│  BATCH UPLOAD PROCESS       │
│  1. Stop timer              │
│  2. Fetch sessions          │
│  3. Fetch Jira issues       │
│  4. Build JSON records      │
│  5. Upload to Supabase      │
│  6. Clear SQLite            │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  SUPABASE (activity_records)│ ← Permanent storage
│  - Stores batch records     │
│  - Status: pending/analyzed │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  AI SERVER (separate)       │
│  - Fetches pending records  │
│  - Analyzes with LLM        │
│  - Updates status           │
└─────────────────────────────┘
```

---

## 🛠️ Troubleshooting Guide

### Issue: "SQLite database not found"

**Cause:** Database not created yet

**Solution:**
```bash
# 1. Start desktop app
python desktop_app.py

# 2. Login and start tracking

# 3. Switch to any window
# Database will be created automatically

# 4. Verify
python inspect_databases.py
```

---

### Issue: "No batch uploads detected"

**Possible Causes:**

1. **Tracking is paused**
   ```bash
   # Check system tray icon
   # If paused, click "Resume Tracking"
   ```

2. **User is idle**
   ```bash
   # Move mouse or type something
   # System resumes automatically
   ```

3. **Desktop app not running**
   ```bash
   # Windows
   tasklist | findstr python
   
   # Check output for desktop_app.py
   # If not running, start it
   python desktop_app.py
   ```

4. **Less than 5 minutes of activity**
   ```bash
   # Check elapsed time in test
   # Wait for full 5 minutes
   ```

---

### Issue: "Supabase connection failed"

**Solution:**
```bash
# 1. Check .env file exists
ls .env

# 2. Check it has credentials
cat .env | grep SUPABASE

# Should show:
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_SERVICE_KEY=eyJxxx...

# 3. Test connection
python -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); print('✓ Connected' if create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_KEY')) else '✗ Failed')"
```

---

### Issue: "No OCR text captured"

**Possible Causes:**

1. **App classified as non-productive**
   - Non-productive apps don't get OCR
   - Check classification in desktop app

2. **OCR failed**
   - Check desktop app logs for OCR errors
   - Try different OCR method (PaddleOCR vs Tesseract)

3. **Private app**
   - Private apps intentionally skip OCR
   - Check privacy settings

**Verification:**
```bash
# Check OCR is working
python inspect_databases.py --detailed

# Look for ocr_text field
# Should have content for productive apps
```

---

## 📈 Expected Performance

### Timing Accuracy

- **Batch Upload:** Within ±1-10 seconds of 5-minute mark
- **Window Switch Detection:** Instant (<100ms)
- **OCR Processing:** 200-500ms per capture
- **Database Write:** <10ms

### Resource Usage

- **CPU:** <5% during active tracking
- **Memory:** ~100-200 MB
- **Disk:** ~1-5 MB per hour (SQLite + logs)
- **Network:** ~5-20 KB per batch upload

### Data Volumes

- **Sessions per 5-min batch:** Typically 3-10
- **JSON payload size:** 5-20 KB per batch
- **SQLite growth:** Minimal (cleared every 5 min)
- **Supabase records:** ~100-200 per day per user

---

## 🎯 Test Checklist

Before releasing changes:

- [ ] Run `python inspect_databases.py` - databases accessible
- [ ] Run `python test_batch_quick.py` - single batch works
- [ ] Run `python test_batch_processing_real.py --manual` - full test passes
- [ ] Verify visit count increments correctly
- [ ] Check OCR captures text for productive apps
- [ ] Verify classifications are correct
- [ ] Test offline/online transition
- [ ] Check Jira context is included
- [ ] Validate JSON structure in Supabase
- [ ] Review desktop app logs for errors

---

## 📚 Additional Resources

- **[TEST_BATCH_PROCESSING_GUIDE.md](TEST_BATCH_PROCESSING_GUIDE.md)** - Detailed testing scenarios
- **[../docs/JSON_RECORD_STRUCTURE_AND_FLOW.md](../docs/JSON_RECORD_STRUCTURE_AND_FLOW.md)** - Complete system documentation
- **[../docs/BATCH_PROCESS_VERIFICATION.md](../docs/BATCH_PROCESS_VERIFICATION.md)** - Technical verification report

---

## 🤝 Support

If tests fail:

1. **Review preflight checks** - Most common issues show up here
2. **Check desktop app logs** - Look for [ERROR] or [WARN] messages
3. **Use inspector tool** - `python inspect_databases.py --watch`
4. **Verify credentials** - Check `.env` file
5. **Test connectivity** - Ping Supabase URL

For detailed troubleshooting, see TEST_BATCH_PROCESSING_GUIDE.md
