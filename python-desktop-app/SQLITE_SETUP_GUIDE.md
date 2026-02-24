# SQLite Tables Setup Guide for Offline Activity Tracking

## Overview
This guide explains how to verify and manually create SQLite tables for offline activity tracking with OCR text storage.

## Quick Answer: Tables Are Auto-Created! ✅

**The tables are automatically created when you run `desktop_app.py`**. You don't need to do anything manually unless:
- Tables are missing or corrupted
- You want to reset the database
- You're testing in isolation

---

## Step-by-Step Verification

### Step 1: Run the Verification Script

```powershell
cd d:\Jiraforge-ocr\JIRAForge\python-desktop-app
python verify_sqlite_tables.py
```

This script will:
- ✅ Check if database exists
- ✅ Verify all tables are created
- ✅ Confirm `ocr_text` column exists in `active_sessions`
- ✅ Show sample data and record counts

### Step 2: Locate the Database File

The SQLite database is stored at:
```
%APPDATA%\TimeTracker\time_tracker_offline.db
```

To open it in PowerShell:
```powershell
# Get the path
$dbPath = "$env:APPDATA\TimeTracker\time_tracker_offline.db"
Write-Host "Database location: $dbPath"

# Check if it exists
if (Test-Path $dbPath) {
    Write-Host "✅ Database exists"
    # Show file size
    $size = (Get-Item $dbPath).Length / 1KB
    Write-Host "Size: $([math]::Round($size, 2)) KB"
} else {
    Write-Host "❌ Database not found. Run the app first."
}
```

### Step 3: Inspect Tables Using SQLite Browser (Optional)

**Option A: Download DB Browser for SQLite**
1. Download from: https://sqlitebrowser.org/
2. Install and open the database file
3. Navigate to the "Database Structure" tab
4. Verify these tables exist:
   - `active_sessions` (with `ocr_text` column)
   - `app_classifications_cache`
   - `offline_screenshots`
   - `project_settings_cache`

**Option B: Use SQLite CLI**
```powershell
# Install SQLite (if not already installed)
# winget install SQLite.SQLite

# Open database
cd $env:APPDATA\TimeTracker
sqlite3 time_tracker_offline.db

# List all tables
.tables

# Show active_sessions schema
.schema active_sessions

# Check for ocr_text column
PRAGMA table_info(active_sessions);

# Count records
SELECT COUNT(*) FROM active_sessions;

# Exit
.quit
```

---

## Manual Table Creation (If Needed)

### Method 1: Run SQL Script

```powershell
cd d:\Jiraforge-ocr\JIRAForge\python-desktop-app

# Make sure database exists
$dbPath = "$env:APPDATA\TimeTracker\time_tracker_offline.db"
$dbDir = Split-Path $dbPath
if (!(Test-Path $dbDir)) {
    New-Item -ItemType Directory -Path $dbDir -Force
}

# Run SQL script
sqlite3 $dbPath < create_sqlite_tables.sql
```

### Method 2: Run Desktop App (Automatic)

The easiest way is to simply run the desktop app:
```powershell
cd d:\Jiraforge-ocr\JIRAForge\python-desktop-app
python desktop_app.py
```

On startup, the app automatically:
1. Creates the database file if missing
2. Creates all required tables
3. Creates indexes for performance

---

## Verify OCR Text Storage

### Test 1: Check Table Schema
```sql
-- Open SQLite
sqlite3 %APPDATA%\TimeTracker\time_tracker_offline.db

-- Verify ocr_text column exists
PRAGMA table_info(active_sessions);

-- Expected output should include:
-- 4|ocr_text|TEXT|0||0
```

### Test 2: Monitor Real-Time Activity
```powershell
# Run the app with verbose logging
cd d:\Jiraforge-ocr\JIRAForge\python-desktop-app
python desktop_app.py

# Watch for these log messages:
# [PROD] VSCode — Main.jsx
# [OK] Loaded X app classifications into memory
# [BATCH] Uploaded X activity records (Y pending AI, Z pre-analyzed)
```

### Test 3: Query Activity Records
```sql
-- Open database
sqlite3 %APPDATA%\TimeTracker\time_tracker_offline.db

-- Check if OCR text is being captured
SELECT 
    application_name,
    window_title,
    classification,
    LENGTH(ocr_text) as ocr_length,
    ocr_text
FROM active_sessions
WHERE ocr_text IS NOT NULL
LIMIT 5;

-- Expected: You should see OCR text captured for productive apps
```

---

## Database Schema Reference

### active_sessions (Primary Table for Activity Tracking)
```sql
CREATE TABLE active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_title TEXT,
    application_name TEXT,
    classification TEXT,
    ocr_text TEXT,                    -- ⭐ OCR text stored here
    total_time_seconds REAL DEFAULT 0,
    visit_count INTEGER DEFAULT 1,
    first_seen TEXT,
    last_seen TEXT,
    timer_started_at TEXT,
    UNIQUE(window_title, application_name)
);
```

**Data Flow:**
1. Window switch detected → `process_window_event()` called
2. OCR captured → `ocr_processor.capture_and_ocr()`
3. Stored locally → `session_manager.on_window_switch(ocr_text)`
4. Batch upload every 5 min → `upload_activity_batch()`
5. Uploaded to Supabase → `activity_records.ocr_text`

---

## Troubleshooting

### Problem: Tables Don't Exist
**Solution:** Run the app once. Tables are auto-created on first run.
```powershell
python desktop_app.py
```

### Problem: ocr_text Column Missing
**Solution:** The app auto-creates it. If using an old database, drop and recreate:
```sql
-- Backup data first!
CREATE TABLE active_sessions_backup AS SELECT * FROM active_sessions;

-- Drop old table
DROP TABLE active_sessions;

-- Recreate with correct schema (will be auto-created on next app run)
-- Or run create_sqlite_tables.sql
```

### Problem: No OCR Text in Database
**Possible causes:**
1. OCR is only captured for productive/unknown apps (not for non_productive/private)
2. Event tracking might be disabled in settings
3. Tesseract/OCR engine not installed

**Check:**
```python
# In desktop_app.py, verify:
# 1. event_tracking_enabled = True
# 2. PYTESSERACT_AVAILABLE = True
# 3. classification_manager.classify() returns 'productive' or 'unknown'
```

### Problem: Database Locked Error
**Solution:** Close any SQLite browser/viewer and try again
```powershell
# Find processes using the database
Get-Process | Where-Object {$_.MainWindowTitle -like "*time_tracker*"}

# Or restart the app
```

---

## Testing OCR Capture End-to-End

### Test Script
```python
# test_ocr_capture.py
import sqlite3
import os
from datetime import datetime

db_path = os.path.join(os.getenv('APPDATA'), 'TimeTracker', 'time_tracker_offline.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check recent activity with OCR
cursor.execute("""
    SELECT 
        datetime(first_seen) as time,
        application_name,
        SUBSTR(window_title, 1, 40) as title,
        classification,
        CASE 
            WHEN ocr_text IS NULL THEN 'No OCR'
            WHEN LENGTH(ocr_text) = 0 THEN 'Empty'
            ELSE LENGTH(ocr_text) || ' chars'
        END as ocr_status,
        SUBSTR(ocr_text, 1, 50) as ocr_preview
    FROM active_sessions
    ORDER BY first_seen DESC
    LIMIT 10
""")

print("\n" + "="*80)
print("Recent Activity Records")
print("="*80)
for row in cursor.fetchall():
    print(f"{row[0]} | {row[1]:20s} | {row[3]:15s} | {row[4]:10s}")
    if row[5]:
        print(f"  OCR: {row[5]}...")

conn.close()
```

Run it:
```powershell
python test_ocr_capture.py
```

---

## Next Steps

1. ✅ **Verify tables exist** - Run `verify_sqlite_tables.py`
2. ✅ **Test the app** - Run `desktop_app.py` and switch between windows
3. ✅ **Check logs** - Look for `[PROD]` and `[BATCH]` messages
4. ✅ **Query database** - Verify OCR text is captured
5. ✅ **Monitor Supabase** - Check `activity_records` table for uploaded data

---

## Summary

- **Auto-created**: Tables are automatically created when you run `desktop_app.py`
- **Location**: `%APPDATA%\TimeTracker\time_tracker_offline.db`
- **OCR Storage**: `active_sessions.ocr_text` column stores extracted text
- **Batch Upload**: Every 5 minutes, data uploads to `activity_records` in Supabase
- **Verification**: Use `verify_sqlite_tables.py` to confirm setup

🎉 **You're all set!** The OCR text will be captured and stored automatically.
