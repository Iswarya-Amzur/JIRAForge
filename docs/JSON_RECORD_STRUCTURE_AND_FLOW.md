# JSON Record Structure and Flow Analysis

## ✅ Batch Processing Verification Summary

**CONFIRMED:** The system performs batch uploads **every 5 minutes (300 seconds)** exactly as documented.

### How Batch Processing Works (Verified)

**Implementation Location:** `desktop_app.py` lines 6725-6726

**Timer Mechanism:**
```python
# Checked every loop iteration in the main tracking loop
if time.time() - self.last_batch_upload_time >= self.batch_upload_interval:
    self.upload_activity_batch()
```

**Key Facts:**
- ⏱️ **Fixed Interval:** 5 minutes (300 seconds) - hardcoded, not configurable
- 🔄 **Continuous Check:** Main loop checks every 1-10 seconds (varies by app state)
- ✅ **Trigger Accuracy:** Uploads within 1-10 seconds of 5-minute mark
- 🛑 **Respects State:** Only runs when tracking active AND user not idle
- 💾 **Offline Safe:** Records accumulate in SQLite until connection restored
- 🔒 **Atomic:** SQLite cleared only after successful Supabase upload

**9-Step Upload Process:**
1. Stop current timer (finalize time calculations)
2. Fetch all sessions from SQLite
3. Check if empty (skip if no activity)
4. Check connectivity (defer if offline)
5. Fetch Jira context (cached, 5-min TTL)
6. Build JSON records with metadata
7. Batch insert to Supabase (single transaction)
8. Clear SQLite sessions (only on success)
9. Reset batch timer (start next 5-min cycle)

**Edge Cases Handled:**
- ✅ User goes idle → Batch skipped until activity resumes
- ✅ Tracking paused → Batch skipped until resumed
- ✅ Network offline → Records queued, uploaded when online
- ✅ System sleep/hibernate → Session finalized, timer reset on wake
- ✅ Upload fails → Records stay in SQLite for next cycle

---

## Overview
The system creates JSON records for each unique window/tab session and manages time-logging through a SQLite-based session management system.

---

## 1. Session Record Creation

### 1.1 Database Table Structure (`active_sessions`)

The system uses a SQLite table to store session data locally before batch upload:

```sql
CREATE TABLE IF NOT EXISTS active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_title TEXT,                 -- Window title of the active app
    application_name TEXT,             -- Process name (e.g., "chrome.exe")
    classification TEXT,               -- productive/non_productive/private/unknown
    ocr_text TEXT,                     -- Extracted text from OCR
    ocr_method TEXT,                   -- OCR method used (paddleocr/tesseract/clipboard/none)
    ocr_confidence REAL,               -- OCR confidence score (0.0-1.0)
    ocr_error_message TEXT,            -- Any OCR error message
    total_time_seconds REAL DEFAULT 0, -- Accumulated time in this session
    visit_count INTEGER DEFAULT 1,     -- Number of times user returned to this window
    first_seen TEXT,                   -- ISO timestamp when first seen
    last_seen TEXT,                    -- ISO timestamp when last active
    timer_started_at TEXT,             -- Current timer start (NULL if paused)
    UNIQUE(window_title, application_name)  -- One record per unique window
)
```

### 1.2 Session Manager Implementation

**Location:** `desktop_app.py` - `ActiveSessionManager` class (lines 3050-3200)

**Key Methods:**

#### `on_window_switch(title, app_name, classification, ocr_result)`
This is called every time a user switches windows/tabs:

```python
# Window switch event structure
{
    'title': 'main.py - Visual Studio Code',
    'app': 'Code.exe',
    'classification': 'productive',  # or 'non_productive', 'private', 'unknown'
    'ocr_result': {
        'text': '# Python code snippet...',
        'method': 'paddleocr',           # or 'tesseract', 'clipboard', 'none'
        'confidence': 0.95,              # 0.0 to 1.0
        'error_message': None            # Error string if OCR failed
    }
}
```

**Logic Flow:**

1. **Stop Previous Timer:** If there was a previous active window, stops its timer and calculates elapsed time
2. **Check for Existing Session:** Queries SQLite for matching `(window_title, application_name)` pair
3. **Resume or Create:**
   - **If EXISTS:** Increments `visit_count`, updates `last_seen`, restarts timer
   - **If NEW:** Creates new record with `visit_count=1`, `total_time_seconds=0`
4. **Update OCR Data:** Stores latest OCR text, method, confidence, and error (overwrites previous OCR data)

**Thread-Safety:** Uses `threading.Lock()` to prevent race conditions during concurrent window switches.

---

## 2. Tab Switching Behavior

### Scenario: User Switches Between Tabs

```
Time 0:00 → Opens Chrome (Tab A: Gmail)
Time 0:30 → Switches to Tab B (Jira)
Time 1:00 → Returns to Tab A (Gmail)
Time 1:30 → Switches to Tab B (Jira) again
```

**SQLite State After Each Switch:**

| Time  | Action         | `active_sessions` Table                                                      |
|-------|----------------|-------------------------------------------------------------------------------|
| 0:00  | Open Tab A     | 1 record: `(Gmail, chrome.exe, 0s, visit_count=1)`                           |
| 0:30  | Switch to B    | 2 records: `(Gmail, chrome.exe, 30s, visit_count=1)`, `(Jira, chrome.exe, 0s, visit_count=1)` |
| 1:00  | Return to A    | 2 records: `(Gmail, chrome.exe, 30s, visit_count=2)`, `(Jira, chrome.exe, 30s, visit_count=1)` |
| 1:30  | Switch to B    | 2 records: `(Gmail, chrome.exe, 60s, visit_count=2)`, `(Jira, chrome.exe, 30s, visit_count=2)` |

**Key Points:**
- **No Duplicate Records:** System uses `UNIQUE(window_title, application_name)` constraint
- **Accumulated Time:** Each return adds to `total_time_seconds` (not reset)
- **Visit Count Tracking:** Increments each time user returns to a previously seen window

---

## 3. Batch Upload Structure (Every 5 Minutes)

### 3.1 Upload Trigger Mechanism

**Location:** `desktop_app.py` - Main tracking loop (line 6725-6726)

The batch upload is triggered by a **time-based check** in the main tracking loop:

```python
# In tracking_loop() - runs continuously while app is active
while self.running:
    # ... other checks ...
    
    # Periodically upload activity batch (event-based tracking)
    if time.time() - self.last_batch_upload_time >= self.batch_upload_interval:
        self.upload_activity_batch()
```

**Trigger Interval:** Fixed at **300 seconds (5 minutes)** - hardcoded default

```python
# In __init__ method (line 3466)
self.batch_upload_interval = 300  # 5 min default
self.last_batch_upload_time = time.time()
```

**How the Timer Works:**
1. **Initialization:** `last_batch_upload_time` is set to current time when app starts
2. **Continuous Check:** Main loop checks every iteration (2-5 second sleep cycles)
3. **Trigger Condition:** When `current_time - last_batch_upload_time >= 300 seconds`
4. **Reset:** After upload completes, `last_batch_upload_time` is reset to current time
5. **Next Cycle:** Timer starts counting again from the reset time

**Important Notes:**
- ✅ Runs **ONLY when tracking is active** (not paused)
- ✅ Runs **ONLY when user is NOT idle** (respects idle detection)
- ✅ Timer is **independent of window switches** (doesn't reset on user activity)
- ✅ Works **offline** - records queued locally, uploaded when connection restored

### 3.2 Complete Batch Upload Process

**Method:** `upload_activity_batch()` (lines 5704-5796)

**Step-by-Step Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Stop Current Timer                                       │
│ - Ensures all accumulated time is calculated                    │
│ - Prevents race condition during upload                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Fetch All Sessions from SQLite                          │
│ - SELECT * FROM active_sessions                                 │
│ - Gets all unique window sessions since last batch             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Check if Empty                                          │
│ - If no sessions: skip upload, reset timer, exit               │
│ - Prevents unnecessary API calls during inactivity             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Check Connectivity                                      │
│ - If offline: keep records in SQLite, exit                     │
│ - Records accumulate until connection restored                 │
│ - Prevents data loss during network outages                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Fetch Jira Context (Cached)                            │
│ - get_user_project_key() - Gets user's current project         │
│ - self.user_issues - Cached Jira issues (5-min TTL)           │
│ - Reuses cached data if fresh (avoids API rate limits)        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Build JSON Records                                      │
│ - For each session in SQLite:                                  │
│   1. Determine status ('pending' or 'analyzed')                │
│   2. Add window metadata (title, app, classification)          │
│   3.4 Status Field Logic

```python
# Status determination (in upload_activity_batch method)
classification = s.get('classification', 'unknown')

if classification in ('non_productive', 'private'):
    status = 'analyzed'  # No AI needed, already classified
else:
    status = 'pending'   # AI server will analyze
```

**AI Analysis Trigger:**
- Records with `status = 'pending'` are processed by the separate **AI Server**
- The AI Server fetches pending records, analyzes them with the LLM, and updates status to `'analyzed'`

### 3.5 Batch Timing Examples

#### Visual Timeline: Complete 5-Minute Batch Cycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     5-MINUTE BATCH CYCLE TIMELINE                         │
└──────────────────────────────────────────────────────────────────────────┘

TIME     MAIN LOOP CHECK         ACTION TAKEN              SQLITE STATE
════════════════════════════════════════════════════════════════════════════

10:00:00 App starts              last_batch_upload_time    ┌─────────────┐
         batch_start_time        = 10:00:00                │ active_     │
         = 10:00:00              Timer starts              │ sessions    │
                                                           │ (empty)     │
                                                           └─────────────┘

10:00:05 Loop iteration          Check: 5 < 300            ┌─────────────┐
         (tracking active)       → Skip batch upload       │ 0 records   │
                                 Continue tracking...       └─────────────┘

10:00:20 User opens VS Code      Window switch detected    ┌─────────────┐
                                 → Create session #1       │ 1 record    │
                                 (VS Code, OCR captured)   │ - VS Code   │
                                                           └─────────────┘

10:01:00 Loop iteration          Check: 60 < 300           ┌─────────────┐
                                 → Skip batch upload       │ 1 record    │
                                                           └─────────────┘

10:01:30 User switches to        Window switch detected    ┌─────────────┐
         Chrome                  → Create session #2       │ 2 records   │
                                 (Chrome, OCR captured)    │ - VS Code   │
                                                           │ - Chrome    │
                                                           └─────────────┘

10:02:00 Loop iteration          Check: 120 < 300          ┌─────────────┐
                                 → Skip batch upload       │ 2 records   │
                                                           └─────────────┘

10:02:30 User returns to         Window switch detected    ┌─────────────┐
         VS Code                 → Resume session #1       │ 2 records   │
                                 (visit_count++, timer++)  │ - VS Code   │
                                                           │ - Chrome    │
                                                           └─────────────┘

10:03:00 Loop iteration          Check: 180 < 300          ┌─────────────┐
                                 → Skip batch upload       │ 2 records   │
                                                           └─────────────┘

10:04:00 Loop iteration          Check: 240 < 300          ┌─────────────┐
                                 → Skip batch upload       │ 2 records   │
                                                           └─────────────┘

10:05:00 Loop iteration          Check: 300 >= 300         ┌─────────────┐
         ⏰ BATCH TRIGGER!       ✅ TRIGGER BATCH UPLOAD   │ 2 records   │
                                                           └─────────────┘
         ┌──────────────────────────────────────────────────────────────┐
         │ BATCH UPLOAD PROCESS (Steps 1-9)                             │
         ├──────────────────────────────────────────────────────────────┤
         │ 1. Stop current timer (VS Code session)                      │
         │ 2. Fetch: SELECT * FROM active_sessions                      │
         │ 3. Found 2 records (VS Code, Chrome)                         │
         │ 4. Check connectivity: ✅ Online                              │
         │ 5. Fetch Jira issues: [{key: "PROJ-123", ...}]              │
         │ 6. Build JSON records with metadata                          │
         │ 7. INSERT INTO activity_records (2 records)                  │
         │ 8. ✅ Success! DELETE FROM active_sessions                    │
         │ 9. Reset: last_batch_upload_time = 10:05:00                 │
         │           batch_start_time = 10:05:00                        │
         └──────────────────────────────────────────────────────────────┘
                                                           ┌─────────────┐
                                                           │ active_     │
                                                           │ sessions    │
                                                           │ (empty)     │
                                                           └─────────────┘
10:05:01 Loop continues          Check: 1 < 300            ┌─────────────┐
         New batch cycle starts  → Skip batch upload       │ 0 records   │
                                                           └─────────────┘

10:06:00 User switches to        Window switch detected    ┌─────────────┐
         Terminal                → Create session #1       │ 1 record    │
                                 (New batch cycle)         │ - Terminal  │
                                                           └─────────────┘

10:10:00 Loop iteration          Check: 299 < 300          ┌─────────────┐
                                 → Skip batch upload       │ 1 record    │
                                                           └─────────────┘

10:10:01 Loop iteration          Check: 301 >= 300         ┌─────────────┐
         ⏰ BATCH TRIGGER!       ✅ TRIGGER BATCH UPLOAD   │ 1 record    │
                                 (Next cycle)              └─────────────┘

════════════════════════════════════════════════════════════════════════════
```

**Key Observations from Timeline:**
1. ⏱️ Main loop checks batch condition every iteration (1-10 seconds)
2. 📊 Sessions accumulate in SQLite between upload cycles
3. 🔄 Timer resets AFTER successful upload (not before)
4. 🎯 Exact trigger time varies by ±1-10 seconds based on loop sleep
5. 💾 SQLite persists data across cycles until upload succeeds

---

#### Example 1: Normal Operation (No Interruptions)
```
10:00:00 → App starts, batch_start_time = 10:00:00
10:00:30 → User opens VS Code
10:01:00 → User switches to Chrome
10:02:00 → User returns to VS Code
10:05:00 → BATCH UPLOAD TRIGGERED (300 seconds elapsed)
           - Uploads 2 records (VS Code, Chrome)
           - Clears SQLite active_sessions
           - Resets: last_batch_upload_time = 10:05:00
           - Resets: batch_start_time = 10:05:00
10:10:00 → NEXT BATCH UPLOAD (300 seconds after 10:05:00)
```

**Example 2: User Goes Idle Mid-Cycle**
```
10:00:00 → Batch timer starts
10:02:00 → User becomes idle (no keyboard/mouse activity for 5 minutes)
10:05:00 → Batch upload check: time.time() - last_batch_upload_time >= 300
           BUT: Check happens inside "if not self.is_idle" block
           RESULT: Batch upload SKIPPED while user is idle
10:07:00 → User returns (activity detected)
           - is_idle = False
           - Tracking resumes
10:10:00 → Batch upload check: 600 seconds elapsed since 10:00:00
           RESULT: Batch upload TRIGGERS immediately (overdue)
```

**Example 3: User Pauses Tracking**
```
10:00:00 → Batch timer starts
10:03:00 → User clicks "Pause" in system tray
           - tracking_active = False
           - Current session finalized
10:05:00 → Batch upload check happens, but...
           Code: if not self.tracking_active: continue
           RESULT: Batch upload SKIPPED while paused
10:08:00 → User clicks "Resume"
           - tracking_active = True
10:10:00 → Batch upload check: 600 seconds since 10:00:00
           RESULT: Batch upload TRIGGERS (accumulated sessions uploaded)
```

**Example 4: Network Offline**
```
10:00:00 → Batch timer starts
10:05:00 → Batch upload triggered, but network is offline
           - connectivity check fails
           - Records REMAIN in SQLite
           - Timer resets: last_batch_upload_time = 10:05:00
           - Log: "[BATCH] Offline — 5 records stay in SQLite for retry"
10:10:00 → Network still offline
           - New records added to existing ones
           - Total now: 10 records in SQLite
10:15:00 → Network back online
           - Batch upload successful
           - All 10 records uploaded
           - SQLite cleared
```

**Example 5: System Sleep/Hibernate**
```
10:00:00 → Batch timer starts
10:03:00 → User closes laptop (system suspends)
14:00:00 → User opens laptop (system resumes)
           - Loop detects large time gap (> 30 seconds)
           - Current session finalized with last_activity_time
           - All tracking state reset (including batch timer)
           - Log: "[INFO] System suspension detected"
14:00:01 → Fresh start
           - batch_start_time = 14:00:01
           - New session begins
14:05:01 → Batch upload triggered normally
``
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: Clear Local Sessions (On Success)                      │
│ - DELETE FROM active_sessions                                   │
│ - Clears ALL sessions atomically                               │
│ - Prevents duplicate uploads                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 9: Reset Batch Timer                                       │
│ - last_batch_upload_time = time.time()                         │
│ - batch_start_time = datetime.now(timezone.utc)               │
│ - Next batch cycle begins                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Error Handling:**
```python
try:
    # ... upload process ...
except Exception as e:
    print(f"[ERROR] Activity batch upload failed: {e}")
    print(f"     Records remain in SQLite for retry on next cycle")
    # Timer is still reset to prevent infinite loop
    self.last_batch_upload_time = time.time()
```

**Key Points:**
- ✅ **Atomic Operation:** SQLite sessions cleared ONLY after successful upload
- ✅ **Retry Logic:** Failed uploads remain in SQLite, retried in next cycle
- ✅ **No Data Loss:** Records persist locally until confirmed uploaded
- ✅ **Conflict Prevention:** Timer reset even on failure prevents rapid retries

### 3.3 JSON Record Structure Sent to Supabase

Each session in SQLite is converted to a JSON record with **enriched context**:

```json
{
  "user_id": "uuid-of-user",
  "organization_id": "uuid-of-organization",
  
  // Window & Application Metadata
  "window_title": "main.py - Visual Studio Code",
  "application_name": "Code.exe",
  "classification": "productive",
  
  // OCR Data (Latest Snapshot)
  "ocr_text": "def calculate_total():\n    return sum(items)",
  "ocr_method": "paddleocr",
  "ocr_confidence": 0.95,
  "ocr_error_message": null,
  
  // Time Tracking
  "total_time_seconds": 180,       // Total accumulated time
  "visit_count": 3,                // Number of times user returned
  "start_time": "2026-02-20T10:00:00Z",  // first_seen
  "end_time": "2026-02-20T10:03:00Z",    // last_seen
  "duration_seconds": 180,         // Same as total_time_seconds
  
  // Batch Metadata
  "batch_timestamp": "2026-02-20T10:05:00Z",
  "batch_start": "2026-02-20T10:00:00Z",
  "batch_end": "2026-02-20T10:05:00Z",
  "work_date": "2026-02-20",
  "user_timezone": "America/New_York",
  
  // Jira Context (Injected for AI Analysis)
  "project_key": "PROJ",
  "user_assigned_issues": "[{\"key\":\"PROJ-123\",\"summary\":\"Implement login\",\"status\":\"In Progress\",\"project\":\"PROJ\",\"description\":\"Add OAuth login feature\",\"labels\":[\"backend\",\"security\"]}]",
  
  // Analysis Status
  "status": "pending",  // 'pending' for AI analysis, 'analyzed' if non-productive/private
  
  // Tracking Metadata
  "metadata": {
    "tracking_mode": "event_based",
    "app_version": "1.2.0"
  }
}
```

### 3.3 Status Field Logic

```python
# Status determination
if classification in ('non_productive', 'private'):
    status = 'analyzed'  # No AI needed, already classified
else:
    status = 'pending'   # AI server will analyze
```

**AI Analysis Trigger:**
- Records with `status = 'pending'` are processed by the separate **AI Server**
- The AI Server fetches pending records, analyzes them with the LLM, and updates status to `'analyzed'`

---

## 4. Jira Issues Context Injection

### 4.1 How Jira Issues Are Fetched

**Location:** `desktop_app.py` - `fetch_jira_issues()` method (lines 4740-4900)

**API Endpoint:** 
```
POST https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search/jql
```

**JQL Query (Default):**
```jql
assignee = currentUser() 
AND Sprint in openSprints() 
AND statusCategory = "In Progress"
```

**Fetched Fields:**
- `summary` - Issue title
- `status` - Current status (e.g., "In Progress")
- `project` - Project key (e.g., "PROJ")
- `description` - Issue description (ADF format, extracted as plain text)
- `labels` - Issue labels/tags

**Caching Strategy:**
```python
self.user_issues = []               # Cached issues
self.issues_cache_time = None       # Last fetch timestamp
self.issues_cache_ttl = 300         # 5 minutes TTL
```

### 4.2 Jira Issues Format

```json
[
  {
    "key": "PROJ-123",
    "summary": "Implement OAuth login feature",
    "status": "In Progress",
    "project": "PROJ",
    "description": "Add OAuth 2.0 authentication flow using PKCE...",
    "labels": ["backend", "security", "sprint-12"]
  },
  {
    "key": "PROJ-124",
    "summary": "Design user profile page",
    "status": "In Progress",
    "project": "PROJ",
    "description": "Create responsive profile page with edit capabilities",
    "labels": ["frontend", "ui"]
  }
]
```

### 4.3 When Issues Are Injected

**At Batch Upload Time (Every 5 Minutes):**
```python
# In upload_activity_batch() method
'user_assigned_issues': json.dumps(self.user_issues) if self.user_issues else None
```

**Each record in the batch includes:**
1. User's current Jira issues (entire list, JSON-stringified)
2. User's project key (extracted from issues or projects cache)

This allows the LLM to correlate the user's work activities with their assigned tasks.

---

## 5. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTIVITY                                                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ WINDOW SWITCH EVENT                                              │
│ - Detect active window change                                   │
│ - Extract: window_title, application_name                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLASSIFICATION                                                   │
│ classify_window(app_name, window_title)                         │
│ → productive | non_productive | private | unknown               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ OCR PROCESSING (if productive/unknown)                          │
│ - Take screenshot                                               │
│ - Run OCR (PaddleOCR/Tesseract)                                │
│ - Extract: text, method, confidence, error_message             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SESSION MANAGER                                                  │
│ on_window_switch(title, app, classification, ocr_result)       │
│                                                                  │
│ 1. Stop previous timer                                          │
│ 2. Check if (window_title, app_name) exists in active_sessions │
│    - EXISTS: increment visit_count, resume timer               │
│    - NEW: create new record with visit_count=1                 │
│ 3. Update OCR data                                              │
│ 4. Start new timer                                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ SQLite: active_sessions                                          │
│ - Stores unique (window_title, application_name) pairs         │
│ - Accumulates total_time_seconds                               │
│ - Tracks visit_count                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ (Every 5 minutes)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ BATCH UPLOAD                                                     │
│ upload_activity_batch()                                         │
│                                                                  │
│ 1. Stop current timer                                           │
│ 2. Fetch all sessions from SQLite                              │
│ 3. Fetch Jira issues (cached, 5-min TTL)                       │
│ 4. Build JSON records with:                                    │
│    - Window metadata                                            │
│    - OCR data                                                   │
│    - Time tracking                                              │
│    - Jira context (user_assigned_issues + project_key)         │
│ 5. Insert batch to Supabase (activity_records table)           │
│ 6. Clear SQLite active_sessions                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase: activity_records                                       │
│ - One record per unique window session                          │
│ - Status: 'pending' (needs AI) or 'analyzed' (done)            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ AI SERVER (Separate Process)                                    │
│ - Polls for records with status='pending'                       │
│ - Sends batch to LLM with:                                      │
│   * Window titles                                               │
│   * OCR text                                                    │
│   * Jira issues (from user_assigned_issues field)              │
│ - LLM analyzes work performed                                   │
│ - Updates activity_records with analysis                        │
│ - Sets status='analyzed'                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Key Implementation Details

### 6.1 Timer Management

**Timer Start:**
```python
timer_started_at = datetime.now(timezone.utc).isoformat()
```

**Timer Stop (on window switch):**
```python
started = datetime.fromisoformat(timer_started_at)
ended = datetime.now(timezone.utc)
elapsed = (ended - started).total_seconds()
new_total = total_time_seconds + elapsed
```

**Timer States:**
- `timer_started_at = ISO timestamp` → Timer running
- `timer_started_at = NULL` → Timer paused (not current window)

### 6.2 OCR Data Handling

**OCR Methods (in priority order):**
1. **PaddleOCR** (default, highest accuracy)
2. **Tesseract** (fallback if PaddleOCR unavailable)
3. **Clipboard** (emergency fallback)
4. **None** (OCR failed or skipped)

**OCR Result Structure:**
```python
{
    'text': 'Extracted text content...',
    'method': 'paddleocr',
    'confidence': 0.95,
    'error_message': None  # or error string if failed
}
```

### 6.3 Classification Logic

**Sources (in priority order):**
1. **User Manual Classification** (stored in Supabase `application_classifications` table)
2. **AI Server Suggestion** (unknown apps sent to AI for classification)
3. **Hardcoded Rules** (default rules in `AppClassificationManager`)

**Classification Categories:**
- `productive` → Tracked, OCR enabled, AI analysis
- `non_productive` → Tracked, no OCR, no AI (pre-classified)
- `private` → Tracked, window title redacted, no OCR
- `unknown` → Tracked, OCR enabled, sent to AI for classification suggestion

### 6.4 Thread Safety

**Critical Sections Protected by Lock:**
- `on_window_switch()` - Prevents race conditions during rapid window switches
- `stop_current_timer()` - Ensures accurate time calculation
- `get_all_sessions()` - Prevents reading during write
- `clear_all()` - Atomic delete after successful upload

---

## 7. Example: Complete Session Lifecycle

### Scenario: User Works on Jira Task for 3 Minutes, Checks Email Twice

```
10:00:00 → Open Jira tab (PROJ-123)
10:01:00 → Switch to Gmail tab
10:01:30 → Back to Jira tab (PROJ-123)
10:02:00 → Switch to Gmail tab (again)
10:03:00 → Back to Jira tab (PROJ-123)
10:05:00 → BATCH UPLOAD TRIGGERED
```

### SQLite State at 10:05:00 (Before Upload)

```sql
SELECT * FROM active_sessions;
```

| id | window_title | application_name | classification | ocr_text | total_time_seconds | visit_count | first_seen | last_seen |
|----|--------------|------------------|----------------|----------|-------------------|-------------|-----------|-----------|
| 1  | PROJ-123 - Jira | chrome.exe | productive | "Implement OAuth..." | 150 | 3 | 10:00:00 | 10:03:00 |
| 2  | Inbox - Gmail | chrome.exe | non_productive | null | 90 | 2 | 10:01:00 | 10:02:00 |

### JSON Records Sent to Supabase at 10:05:00

```json
[
  {
    "window_title": "PROJ-123 - Jira",
    "application_name": "chrome.exe",
    "classification": "productive",
    "ocr_text": "Implement OAuth login\n\nStatus: In Progress\nAssignee: John Doe\n\nDescription:\nAdd OAuth 2.0 authentication using PKCE flow...",
    "ocr_method": "paddleocr",
    "ocr_confidence": 0.96,
    "total_time_seconds": 150,
    "visit_count": 3,
    "start_time": "2026-02-20T10:00:00Z",
    "end_time": "2026-02-20T10:03:00Z",
    "status": "pending",
    "user_assigned_issues": "[{\"key\":\"PROJ-123\",\"summary\":\"Implement OAuth login\",\"status\":\"In Progress\",\"project\":\"PROJ\"}]"
  },
  {
    "window_title": "Inbox - Gmail",
    "application_name": "chrome.exe",
    "classification": "non_productive",
    "ocr_text": null,
    "ocr_method": null,
    "ocr_confidence": null,
    "total_time_seconds": 90,
    "visit_count": 2,
    "start_time": "2026-02-20T10:01:00Z",
    "end_time": "2026-02-20T10:02:00Z",
    "status": "analyzed",
    "user_assigned_issues": "[{\"key\":\"PROJ-123\",\"summary\":\"Implement OAuth login\",\"status\":\"In Progress\",\"project\":\"PROJ\"}]"
  }
]
```

### After Upload (10:05:00)

1. **Supabase `activity_records` table:** 2 new records inserted
2. **SQLite `active_sessions` table:** Cleared (all records deleted)
3. **Desktop App State:**
   - `batch_start_time` reset to current time
   - Timer continues tracking current window (if any)

---

## 8. LLM Analysis Context

### What the AI Server Receives (Per Batch)

**Fetch Query:**
```sql
SELECT * FROM activity_records 
WHERE status = 'pending' 
AND user_id = ? 
ORDER BY batch_timestamp DESC
LIMIT 50
```

**LLM Prompt Context:**
```- HARDCODED (not configurable)
batch_upload_interval = 300  # 5 minutes (line 3466)

# Jira issues cache
issues_cache_ttl = 300  # 5 minutes (line 3433)

# Classification sync interval
classification_sync_interval = 1800  # 30 minutes (line 3469)

# Main loop sleep intervals
while self.running:
    # ... checks ...
    time.sleep(1)  # When paused
    time.sleep(5)  # When idle
    time.sleep(10) # When screenshot monitoring disabled
```

**Important Configuration Notes:**

1. **Batch Upload Interval (5 minutes):**
   - ❌ **NOT configurable** via Supabase settings
   - ✅ Hardcoded in `__init__` method
   - ✅ Fixed at 300 seconds for all users/projects
   - ⚠️ To change: Must modify source code and redeploy app

2. **Main Loop Timing:**
   - Loop runs continuously while app is active
   - Sleep duration varies based on app state:
     - 1 second: When tracking paused (responsive to auto-resume)
     - 5 seconds: When user is idle (reduces CPU usage)
     - 10 seconds: When screenshot monitoring disabled
     - ~2-5 seconds: During active tracking (varies with processing)

3. **Timing Accuracy:**
   - Batch upload triggers within **1-10 seconds** of 5-minute mark
   - Depends on main loop sleep duration at that moment
   - Example: If loop is sleeping 5s and batch is due at 10:05:00.0, 
     actual trigger might be 10:05:03.2 (next loop iteration)

4. **Settings Refresh:**
   - Tracking settings refreshed every 300 seconds (5 minutes)
   - Version check every 14,400 seconds (4 hours)
   - Notification check every 1,800 seconds (30 minutes)
   - Heartbeat sent every 14,400 seconds (4 hours)

**Admin Configuration (via Supabase `tracking_settings` table):**
- ✅ Screenshot interval: `screenshot_interval_seconds` (default: 900s = 15 min)
- ✅ Idle threshold: `idle_threshold_seconds` (default: 300s = 5 min)
- ✅ Tracking mode: `tracking_mode` ('interval' or 'event')
- ✅ Event tracking: `event_tracking_enabled` (boolean)
- ❌ Batch upload interval: **NOT configurable** (always 5 minutes)tication flow using PKCE...",
    "labels": ["backend", "security"]
  }
]

=== Activity Records ===
1. Window: PROJ-123 - Jira
   App: chrome.exe
   Classification: productive
   Time: 150 seconds (2.5 minutes)
   Visit Count: 3
   OCR Text: "Implement OAuth login\n\nStatus: In Progress\n..."
   
2. Window: Inbox - Gmail
   App: chrome.exe
   Classification: non_productive
   Time: 90 seconds (1.5 minutes)
   Visit Count: 2
   
Analyze the user's work and provide:
1. What task was the user working on?
2. What progress was made?
3. Suggested Jira issue to log time to (if applicable)
4. Activity summary for reporting
```

**LLM Response (Stored in Database):**
```json
{
  "task_identified": "OAuth login implementation",
  "progress_summary": "User reviewed Jira issue PROJ-123 and implementation details",
  "suggested_issue": "PROJ-123",
  "billable_time_seconds": 150,
  "activity_summary": "Worked on OAuth login feature (PROJ-123)",
  "confidence": 0.89
}
```

---

## 9. Performance Considerations

### 9.1 Local SQLite Benefits

- **Low latency:** Window switches are instant (no network calls)
- **Offline support:** Tracking continues without internet
- **Atomic operations:** UNIQUE constraint prevents duplicates
- **Thread-safe:** Lock ensures consistency

### 9.2 Batch Upload Efficiency

- **Reduced API calls:** One Supabase insert per 5 minutes (vs. per-window-switch)
- **Bulk insert:** All sessions sent in single transaction
- **Cached Jira issues:** Only fetched once per 5 minutes
- **Status filtering:** AI only processes `status='pending'` records

### 9.3 Memory Footprint

- **Session cache:** Only current active sessions (cleared every 5 min)
- **Jira issues cache:** Small (typically <10 issues per user)
- **OCR text:** Limited to last snapshot per window (not historical)

---

## 10. Configuration & Defaults

```python
# Batch upload interval (configurable per project)
batch_upload_interval = 300  # 5 minutes

# Jira issues cache
issues_cache_ttl = 300  # 5 minutes

# Classification sync interval
classification_sync_interval = 1800  # 30 minutes
```

**Admin Override Locations:**
- Project-level settings in Supabase `project_tracking_settings` table
- User-level overrides in desktop app UI

---

## Summary

The JSON record system provides:

1. **Unique Session Tracking:** One record per unique `(window_title, application_name)` pair
2. **Time Accumulation:** Multiple visits add time to existing sessions (no duplicates)
3. **Rich Context:** OCR text, visit patterns, and Jira issues included
4. **Efficient Batching:** 5-minute cycles reduce network overhead
5. **AI-Ready:** Records include all context needed for LLM analysis
6. **Offline-First:** SQLite ensures tracking continues without connectivity

**Key Files:**
- `desktop_app.py` (lines 1685-1710): `active_sessions` table schema
- `desktop_app.py` (lines 3050-3200): `ActiveSessionManager` class
- `desktop_app.py` (lines 5700-5850): `upload_activity_batch()` method
- `desktop_app.py` (lines 4740-4900): `fetch_jira_issues()` method
