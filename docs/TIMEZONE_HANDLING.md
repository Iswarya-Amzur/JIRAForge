# Timezone Handling Documentation

## How Timezone Works - Simple Explanation

### The Problem It Solves

Imagine you're working in **India (IST, UTC+5:30)** and you work from **11 PM to 1 AM**. Without proper timezone handling:
- The system might think you worked on two different days (because midnight crossed in UTC)
- Or worse, your work might appear on the wrong day entirely

### The Solution - Three Key Pieces

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Desktop App    │ ──▶ │    Database     │ ──▶ │   Jira Panel    │
│  (Your Computer)│     │   (Supabase)    │     │  (Your Browser) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
   Detects your            Stores your            Shows times in
   timezone                local date             your timezone
```

---

### Step 1: Desktop App Captures Your Timezone

When the Python app takes a screenshot, it:

1. **Auto-detects your timezone** (e.g., "Asia/Kolkata" for India)
2. **Calculates today's date in YOUR time** (not UTC)
3. **Sends both to the server**

```python
# Example: You capture at 11:30 PM IST on Jan 31
{
  "timestamp": "2026-01-31T23:30:00+05:30",  # Precise moment
  "user_timezone": "Asia/Kolkata",            # Your timezone
  "work_date": "2026-01-31"                   # YOUR local date
}
```

**Key Point:** Even though it's already Feb 1 in UTC, your `work_date` stays Jan 31 because that's YOUR date.

---

### Step 2: Database Stores the Local Date

The database has a special `work_date` column that stores **your local date**, not the UTC date.

```sql
-- Screenshots table now has:
user_timezone  TEXT   -- "Asia/Kolkata"
work_date      DATE   -- 2026-01-31 (your local date)
timestamp      TIME   -- 2026-01-31T23:30:00+05:30 (exact moment)
```

**Why This Matters:**
- When you look at "Today's work" - it shows YOUR today
- When you look at "This week" - it groups by YOUR dates
- Your late-night sessions stay on the correct day

---

### Step 3: Frontend Shows Time in Your Browser's Timezone

When displaying times, the app uses your browser's built-in timezone:

```javascript
// Shows: "11:30 PM" if you're in IST
// Shows: "6:00 PM" if you're in UTC
new Date(timestamp).toLocaleTimeString()
```

---

### Visual Example

**Scenario:** Developer in India works late on Jan 31

| Event | UTC Time | India Time (IST) | What's Stored |
|-------|----------|------------------|---------------|
| Start work | 5:30 PM UTC | 11:00 PM IST | work_date: Jan 31 |
| Cross midnight | 6:30 PM UTC | 12:00 AM IST (Feb 1) | work_date: Jan 31 |
| Stop work | 7:30 PM UTC | 1:00 AM IST (Feb 1) | work_date: Jan 31 |

**Result:** All 2.5 hours are counted for **January 31** (the day you actually worked), not split across two days.

---

### The Fallback (For Old Data)

If the desktop app doesn't send timezone info (older versions), the database has a backup plan:

```sql
-- Automatically computes work_date from UTC if missing
CREATE FUNCTION compute_work_date() ...
  -- Uses UTC date as fallback
  NEW.work_date = (NEW.timestamp AT TIME ZONE 'UTC')::DATE;
```

---

### Summary in Plain English

| Component | What It Does |
|-----------|--------------|
| **Desktop App** | "Hey, I'm in India. It's Jan 31 here. Here's a screenshot." |
| **Database** | "Got it. I'll remember this is Jan 31's work for this user." |
| **Jira Panel** | "Showing all Jan 31 work... displaying times in your local timezone." |

---

### Files Involved

| File | Role |
|------|------|
| `python-desktop-app/desktop_app.py` | Detects timezone, sends `work_date` |
| `supabase/migrations/20260130_add_timezone_support.sql` | Database schema for timezone fields |
| `forge-app/src/services/issue/issueQueryService.js` | Queries using `work_date` |
| `forge-app/static/main/src/utils/timeFormatting.js` | Display formatting |

The key insight is: **dates are stored in YOUR timezone, times are displayed in YOUR timezone** - so everything matches your actual work day.

---

## Technical Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Python Desktop App                                          │
│ ├─ get_local_timezone_name() → IANA timezone              │
│ ├─ Sends: user_timezone, work_date, timestamp             │
│ └─ work_date = timestamp.date().isoformat()               │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS POST
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend (forge-app/src)                                     │
│ ├─ Receives: user_timezone, work_date, timestamp          │
│ ├─ Stores in: screenshots table                           │
│ └─ Trigger: compute_work_date() [fallback]               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase Database                                           │
│ ├─ screenshots table                                       │
│ │  ├─ user_timezone (TEXT) - IANA name                    │
│ │  ├─ work_date (DATE) - Local date                       │
│ │  ├─ timestamp (TIMESTAMPTZ) - Precise time              │
│ │  └─ [indexed: user_id, work_date]                       │
│ └─ daily_time_summary table                               │
│    ├─ work_date (DATE) - For aggregation                  │
│    └─ [ordered by: work_date DESC]                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ Backend Services │  │ Frontend (React) │
│                  │  │                  │
│ Analytics        │  │ Date Utils       │
│ ├─ Extract       │  │ ├─ normalizeDate │
│ │   work_date    │  │ ├─ formatDate    │
│ ├─ Group by      │  │ └─ formatTime    │
│ │   work_date    │  │                  │
│ └─ Filter by     │  │ Components       │
│    work_date     │  │ ├─ DayView       │
│                  │  │ ├─ Screenshots   │
│                  │  │ └─ Analytics     │
│                  │  │                  │
│                  │  │ Display          │
│                  │  │ └─ toLocaleString│
└──────────────────┘  │    (Browser TZ)  │
                      └──────────────────┘
```

---

## Key Timezone Handling Patterns

1. **Capture Layer (Desktop App):**
   - Auto-detects local IANA timezone using `tzlocal` library
   - Computes local work_date using Python's datetime
   - Sends both timezone name and local date to backend

2. **Storage Layer (Database):**
   - Stores original IANA timezone for reference
   - Stores local work_date (DATE type) for efficient grouping
   - Uses TIMESTAMPTZ for precise temporal data
   - Trigger function handles legacy/missing timezone data

3. **Query Layer (Backend):**
   - Queries use `work_date` field for date-based filtering
   - Converts timestamps to ISO strings when needed
   - Groups analytics by `work_date` for accuracy
   - Formats Jira timestamps in UTC for compatibility

4. **Display Layer (Frontend):**
   - Uses browser's `toLocaleString()` for timezone-aware display
   - Normalizes incoming work_date strings
   - Compares dates using local timezone
   - Supports multiple date formatting contexts

---

## Database Migration Details

**File: `supabase/migrations/20260130_add_timezone_support.sql`**

The migration adds comprehensive timezone support:

- **New Columns Added:**
  - `user_timezone TEXT` - Stores IANA timezone name (e.g., 'Asia/Kolkata', 'America/New_York')
  - `work_date DATE` - Stores the local work date (YYYY-MM-DD format) for proper date grouping

- **Database Function:** `compute_work_date()`
  - Auto-computes `work_date` from timestamp if not provided
  - Ensures sessions that cross midnight are attributed to the correct local date
  - Acts as fallback for legacy desktop apps

- **Indexes Created:**
  - `idx_screenshots_user_work_date` - For efficient date-based queries per user
  - `idx_screenshots_org_user_work_date` - For organization-level date queries

- **Backfill Strategy:** Existing records get UTC date as fallback since original timezone is unknown

---

## Desktop App Implementation

**File: `python-desktop-app/desktop_app.py`**

```python
def get_local_timezone_name():
    """Auto-detect user's IANA timezone name"""
    try:
        import tzlocal
        local_tz = tzlocal.get_localzone()
        return str(local_tz)  # e.g., 'Asia/Kolkata'
    except ImportError:
        # Fallback to Etc/GMT format for PostgreSQL AT TIME ZONE
        offset_seconds = -time.timezone if time.daylight == 0 else -time.altzone
        hours = abs(offset_seconds) // 3600
        sign = '+' if offset_seconds >= 0 else '-'
        return f"Etc/GMT{'-' if sign == '+' else '+'}{hours}"
```

**Data Sent with Each Screenshot:**
- `user_timezone`: IANA timezone name (auto-detected)
- `work_date`: Local date in ISO format (YYYY-MM-DD) computed from local timestamp
- `timestamp`: ISO format timestamp with UTC offset

---

## Frontend Formatting Utilities

**File: `forge-app/static/main/src/utils/timeFormatting.js`**

```javascript
export const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const formatTimeOfDay = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};
```

**Key Point:** Uses browser's local timezone for display via `toLocaleDateString()` and `toLocaleTimeString()`.

---

## Analytics Date Utilities

**File: `forge-app/static/main/src/components/tabs/time-analytics/dateUtils.js`**

```javascript
export function normalizeDate(workDate) {
  // Converts work_date to consistent YYYY-MM-DD string
  if (typeof workDate === 'string') return workDate.split('T')[0];
  if (workDate instanceof Date) return workDate.toISOString().split('T')[0];
  return String(workDate).split('T')[0];
}

export function formatLocalDate(d) {
  // Format date as YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

---

## Complete File Reference

**Core Timezone Files:**
1. `supabase/migrations/20260130_add_timezone_support.sql` - DB schema and triggers
2. `python-desktop-app/desktop_app.py` (Lines 18, 220-235, ~4580) - Desktop timezone capture
3. `forge-app/static/main/src/utils/timeFormatting.js` - Frontend formatting
4. `forge-app/static/main/src/components/tabs/time-analytics/dateUtils.js` - Analytics date handling
5. `forge-app/src/services/issue/issueQueryService.js` (Line 71, 151) - Backend queries

**Related Service Files:**
6. `forge-app/src/services/analytics/teamAnalyticsService.js` - Team analytics with date filtering
7. `forge-app/src/services/analytics/orgAnalyticsService.js` - Organization analytics with date filtering
8. `forge-app/src/utils/formatters.js` - Jira timestamp formatting (UTC)

**Display Files:**
9. `forge-app/static/main/src/components/modals/ScreenshotPreviewModal.js` - Screenshot time display
10. `forge-app/static/main/src/components/tabs/ScreenshotsTab.js` - Screenshot gallery with timestamps
