# Fix for Random Project Keys (UTF, GPT, PROJ, GW)

## Problem
The AI analysis was creating random project keys like "UTF", "GPT", "PROJ", "GW" that don't match any real Jira issues. This happened because:
1. The OCR was detecting text that **looks like** Jira keys (e.g., "UTF-8", "GPT-4") but aren't real issues
2. Old analysis results were stored before proper validation was added
3. Project keys were being derived from unvalidated text patterns

## Solution Applied

### 1. **Stricter Validation in AI Server** ✅
Updated `ai-server/src/services/screenshot-service.js` to:
- ONLY use task keys that exist in user's assigned Jira issues
- Add double-validation for all inferred task keys
- Add detailed logging to track where task keys come from
- Prevent creating project keys from OCR text that isn't validated

### 2. **Database Cleanup Script** ✅
Created `ai-server/cleanup-invalid-analysis.sql` to remove old invalid data

## How to Apply the Fix

### Step 1: Restart the AI Server
```bash
cd C:\Users\VishnuK\Desktop\jira1\ai-server
# If running via npm:
npm restart
# Or if running directly:
node src/index.js
```

### Step 2: Clean Up Invalid Data in Database

**Option A: Preview Invalid Data First (Recommended)**
```sql
-- Run this in your Supabase SQL Editor to see what will be cleaned up
SELECT
  ar.id,
  ar.active_task_key,
  ar.project_key,
  ar.created_at
FROM analysis_results ar
WHERE ar.project_key IN ('UTF', 'GPT', 'PROJ', 'GW', 'API', 'HTTP', 'JSON', 'XML', 'SQL')
ORDER BY ar.created_at DESC;
```

**Option B: Clean Up Suspicious Project Keys**
```sql
-- Run this in Supabase SQL Editor to set invalid project keys to NULL
UPDATE analysis_results
SET
  active_task_key = NULL,
  project_key = NULL,
  confidence_score = 0
WHERE project_key IN ('UTF', 'GPT', 'PROJ', 'GW', 'API', 'HTTP', 'JSON', 'XML', 'SQL', 'CSS', 'HTML');
```

**Option C: Clean Up All Invalid Task Keys**
```sql
-- This removes task keys that don't match any assigned issues
UPDATE analysis_results ar
SET
  active_task_key = NULL,
  project_key = NULL,
  confidence_score = 0
WHERE ar.active_task_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_jira_issues_cache ujic
    WHERE ujic.user_id = ar.user_id
      AND ujic.issue_key = ar.active_task_key
  );
```

### Step 3: Update Jira Issues Cache
Make sure your assigned Jira issues are cached in the database:
1. Open your Forge app in Jira
2. Go to Settings tab
3. Click "Refresh Issues Cache" (or use the getCurrentUser endpoint)

Alternatively, from the Forge app:
```bash
cd C:\Users\VishnuK\Desktop\jira1\forge-app
# The desktop app should automatically cache issues, but you can also trigger it manually
```

### Step 4: Verify the Fix
After cleanup, check your Time Analytics dashboard:
- You should only see **SCRUM** project in the "TIME BY PROJECT" section
- All other random project keys (UTF, GPT, PROJ, GW) should be gone

## How It Works Now

### Before (OLD - BROKEN):
1. Desktop app captures screenshot with OCR text "Using UTF-8 encoding for GPT-4 API"
2. AI server extracts "UTF-8" and "GPT-4" as potential Jira keys
3. Creates analysis with `project_key: "UTF"` and `project_key: "GPT"`
4. ❌ These don't match any real Jira issues!

### After (NEW - FIXED):
1. Desktop app captures screenshot and sends user's assigned issues: `["SCRUM-5", "SCRUM-6"]`
2. AI server extracts "UTF-8" and "GPT-4" as potential Jira keys
3. **Validates** against assigned issues: ❌ "UTF-8" not in assigned issues, ❌ "GPT-4" not in assigned issues
4. Tries to match window title/text to assigned issues
5. Either finds a match (e.g., "SCRUM-5") or sets `task_key: null`
6. ✅ NEVER creates project keys from unvalidated text!

## Expected Behavior Going Forward

**Scenario 1: Working on SCRUM-5**
- Screenshot shows "SCRUM-5" in window title or screen
- ✅ Analysis result: `task_key: "SCRUM-5"`, `project_key: "SCRUM"`

**Scenario 2: Working on code, no Jira key visible**
- Screenshot shows VS Code with "Login Page" code
- Matches window title to issue summary "SCRUM-6: testing my issues"
- ✅ Analysis result: `task_key: "SCRUM-6"`, `project_key: "SCRUM"`

**Scenario 3: Working on something with no match**
- Screenshot shows YouTube or random browsing
- Can't match to any assigned issue
- ✅ Analysis result: `task_key: null`, `project_key: null`, `is_idle: true`

**Scenario 4: Screenshot contains "UTF-8" text**
- Screenshot shows technical docs mentioning "UTF-8 encoding"
- AI extracts "UTF-8" but it's NOT in assigned issues
- ✅ Analysis result: Ignores "UTF-8", tries other matching methods, may result in `task_key: null` if no match found

## Monitoring

Check the AI server logs to see validation in action:
```bash
# Watch AI server logs
cd C:\Users\VishnuK\Desktop\jira1\ai-server
npm run dev
```

Look for these log messages:
- ✅ `"Using detected Jira key from assigned issues"` - Found valid match
- ⚠️ `"Detected Jira keys not in user's assigned issues"` - Found keys but they don't match
- ⚠️ `"Heuristic inference returned key not in assigned issues, ignoring"` - Inference was wrong
- ℹ️ `"No task key could be inferred from context"` - Couldn't match to any issue

## Questions?

If you still see random project keys:
1. Check that the AI server was restarted with the new code
2. Verify the database cleanup was run
3. Make sure user_jira_issues_cache table has your assigned issues
4. Check AI server logs for validation messages
