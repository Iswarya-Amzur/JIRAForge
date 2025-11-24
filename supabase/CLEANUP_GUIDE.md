# Database Cleanup Guide

This guide explains how to clean up invalid Jira keys and set up automatic tracking of unassigned activities.

## What This Does

### 1. Unassigned Activity Table
Automatically saves all analysis results where AI couldn't identify a task key. This includes:
- Screenshots with no Jira key detected
- Screenshots with invalid Jira key format
- Screenshots with low confidence scores

**Use Case**: In the future, you can build a feature to manually assign these activities to the correct Jira issue.

### 2. Invalid Key Cleanup
Converts invalid Jira keys to NULL instead of keeping bad data:
- Invalid formats (not matching PROJ-123 pattern)
- Empty strings or whitespace
- Specific keys you identify as invalid (deleted tickets, test data, etc.)

## Setup Instructions

### Step 1: Apply the Migration

Open **Supabase SQL Editor** and run the migration:

1. Go to your Supabase project
2. Click on **SQL Editor**
3. Copy the contents of `migrations/002_unassigned_activity.sql`
4. Paste and click **Run**

This creates:
- ✅ `unassigned_activity` table
- ✅ Automatic trigger to save unassigned activities
- ✅ Summary view for reporting

### Step 2: Clean Up Invalid Keys

Open `cleanup_invalid_keys.sql` in SQL Editor and run each section **one at a time**:

#### Review What Will Be Cleaned
```sql
-- Run this first to see what keys exist
SELECT
    active_task_key,
    COUNT(*) as count
FROM public.analysis_results
WHERE active_task_key IS NOT NULL
GROUP BY active_task_key
ORDER BY count DESC;
```

#### Add Your Invalid Keys
Look at the results and identify invalid keys, then add them:
```sql
CREATE TEMP TABLE invalid_jira_keys AS
SELECT unnest(ARRAY[
    'DELETED-123',     -- Replace with your actual invalid keys
    'TEST-999',
    'OLDPROJECT-456'
]) AS invalid_key;
```

#### Clean Invalid Keys
```sql
-- Set specific invalid keys to NULL
UPDATE public.analysis_results
SET active_task_key = NULL,
    active_project_key = NULL
WHERE active_task_key IN (SELECT invalid_key FROM invalid_jira_keys);
```

#### Clean Invalid Formats
```sql
-- Set keys with wrong format to NULL (e.g., not PROJECT-123)
UPDATE public.analysis_results
SET active_task_key = NULL,
    active_project_key = NULL
WHERE active_task_key !~ '^[A-Z][A-Z0-9]+-[0-9]+$';
```

#### Move to Unassigned Activity
```sql
-- Move all NULL keys to unassigned_activity table
INSERT INTO public.unassigned_activity (...)
SELECT ... FROM public.analysis_results
WHERE active_task_key IS NULL;
```

### Step 3: Verify Results

Check the cleanup results:
```sql
-- Count of valid vs unassigned
SELECT
    CASE
        WHEN active_task_key IS NOT NULL THEN 'Valid'
        ELSE 'Unassigned'
    END as status,
    COUNT(*) as count
FROM public.analysis_results
GROUP BY status;

-- Unassigned activity summary
SELECT * FROM public.unassigned_activity_summary;
```

## How It Works Going Forward

### Automatic Behavior

After applying the migration, the system **automatically**:

1. **When AI analysis completes** with no task_key:
   ```
   Analysis Result:
   - active_task_key: NULL
   - time_spent_seconds: 300

   ↓ AUTOMATIC TRIGGER ↓

   Saved to unassigned_activity:
   - reason: 'no_task_key'
   - manually_assigned: false
   - Ready for future manual assignment
   ```

2. **When you update a key to NULL**:
   ```
   UPDATE analysis_results
   SET active_task_key = NULL
   WHERE active_task_key = 'INVALID-123';

   ↓ AUTOMATIC TRIGGER ↓

   Saved to unassigned_activity
   ```

### Manual Assignment (Future Feature)

The table is ready for your future feature. Fields included:

```sql
-- For manual assignment later
manually_assigned: false → true
assigned_task_key: NULL → 'PROJ-123'
assigned_by: user_id
assigned_at: timestamp
```

**Future UI Flow**:
1. User opens "Unassigned Activities" page
2. Sees list of screenshots with no task
3. Clicks "Assign to Issue"
4. Selects Jira issue from dropdown
5. System updates `unassigned_activity` record
6. Optionally: Create worklog for that issue

## Table Structure

### unassigned_activity

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| analysis_result_id | UUID | Link to original analysis |
| screenshot_id | UUID | Link to screenshot |
| user_id | UUID | Who took the screenshot |
| timestamp | Timestamp | When it was captured |
| window_title | Text | What app/window was active |
| application_name | Text | Application name |
| extracted_text | Text | Text from AI analysis |
| detected_jira_keys | Array | Keys AI found (if any) |
| time_spent_seconds | Integer | Time tracked |
| reason | Text | Why unassigned (no_task_key, invalid_task_key, etc.) |
| **manually_assigned** | Boolean | Has user assigned it? |
| **assigned_task_key** | Text | What issue was assigned |
| **assigned_by** | UUID | Who assigned it |
| **assigned_at** | Timestamp | When assigned |

## Example Queries

### View All Unassigned Activities
```sql
SELECT
    ua.timestamp,
    ua.window_title,
    ua.application_name,
    ua.time_spent_seconds / 60.0 as minutes,
    ua.reason,
    u.display_name as user_name
FROM public.unassigned_activity ua
JOIN public.users u ON u.id = ua.user_id
WHERE ua.manually_assigned = FALSE
ORDER BY ua.timestamp DESC
LIMIT 50;
```

### View Summary by User
```sql
SELECT * FROM public.unassigned_activity_summary;
```

### Find Specific User's Unassigned Time
```sql
SELECT
    DATE(ua.timestamp) as date,
    COUNT(*) as activities,
    SUM(ua.time_spent_seconds) / 3600.0 as hours
FROM public.unassigned_activity ua
WHERE ua.user_id = 'YOUR_USER_ID'
  AND ua.manually_assigned = FALSE
GROUP BY DATE(ua.timestamp)
ORDER BY date DESC;
```

### Manually Assign an Activity (Example)
```sql
UPDATE public.unassigned_activity
SET
    manually_assigned = TRUE,
    assigned_task_key = 'PROJ-123',
    assigned_by = 'ADMIN_USER_ID',
    assigned_at = NOW()
WHERE id = 'UNASSIGNED_ACTIVITY_ID';
```

## Common Patterns of Invalid Keys

The cleanup script automatically handles:

✅ **Wrong Format**
- `project-123` (lowercase)
- `PROJ 123` (space instead of dash)
- `PROJ_123` (underscore)
- `123-PROJ` (reversed)

✅ **Empty/Whitespace**
- `''` (empty string)
- `'   '` (just spaces)

✅ **Specific Invalid Keys**
- Keys from deleted Jira projects
- Test data keys
- Old project keys no longer in use

## Best Practices

1. **Review Before Cleaning**: Always run the SELECT queries first to see what will be affected

2. **Clean Gradually**: Start with obvious invalid patterns, then specific keys

3. **Keep Records**: The unassigned_activity table preserves all data, so nothing is lost

4. **Regular Maintenance**: Run cleanup monthly to catch new invalid keys

5. **Monitor Unassigned**: Check `unassigned_activity_summary` regularly to see patterns

## Safety Notes

⚠️ **Important**:
- The cleanup only sets keys to NULL, it doesn't delete any records
- All data is preserved in `unassigned_activity` table
- The trigger runs automatically - no manual work needed going forward
- You can always manually assign activities later

## Future Feature Ideas

With the `unassigned_activity` table, you can build:

1. **Manual Assignment UI** - Let users assign screenshots to issues
2. **Bulk Assignment** - Assign multiple screenshots at once
3. **Pattern Detection** - Learn from manual assignments
4. **Worklog Creation** - Create worklogs for manually assigned activities
5. **Productivity Insights** - Track non-Jira work time
6. **Context Suggestions** - Suggest issues based on window title/app

---

## Need Help?

If you have questions or need to customize the cleanup logic, just let me know!
