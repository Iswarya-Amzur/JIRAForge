-- =====================================================
-- CLEANUP SCRIPT - KEEP ONLY SCRUM-5
-- =====================================================
-- Sets all Jira keys to NULL except SCRUM-5
-- Run each section in Supabase SQL Editor

-- =====================================================
-- STEP 1: REVIEW WHAT WILL BE CLEANED
-- =====================================================

-- See all current keys in database
SELECT
    active_task_key,
    COUNT(*) as count,
    SUM(time_spent_seconds) / 3600.0 as total_hours
FROM public.analysis_results
WHERE active_task_key IS NOT NULL
  AND active_task_key != ''
GROUP BY active_task_key
ORDER BY count DESC;

-- Preview: What will be set to NULL (everything except SCRUM-5)
SELECT
    active_task_key,
    COUNT(*) as will_be_cleaned
FROM public.analysis_results
WHERE active_task_key IS NOT NULL
  AND active_task_key != ''
  AND active_task_key != 'SCRUM-5'
GROUP BY active_task_key;

-- Preview: What will be KEPT (SCRUM-5 only)
SELECT
    'SCRUM-5' as will_be_kept,
    COUNT(*) as count
FROM public.analysis_results
WHERE active_task_key = 'SCRUM-5';

-- =====================================================
-- STEP 2: CLEANUP - SET ALL TO NULL EXCEPT SCRUM-5
-- =====================================================

-- Set all keys to NULL except SCRUM-5
UPDATE public.analysis_results
SET
    active_task_key = NULL,
    active_project_key = NULL
WHERE active_task_key IS NOT NULL
  AND active_task_key != ''
  AND active_task_key != 'SCRUM-5';

-- Also clean up empty strings
UPDATE public.analysis_results
SET active_task_key = NULL
WHERE active_task_key = '';

UPDATE public.analysis_results
SET active_project_key = NULL
WHERE active_project_key = '';

-- Clean up orphaned project keys
UPDATE public.analysis_results
SET active_project_key = NULL
WHERE active_task_key IS NULL
  AND active_project_key IS NOT NULL;

-- =====================================================
-- STEP 3: VERIFY RESULTS
-- =====================================================

-- Should show only SCRUM-5 and NULL now
SELECT
    CASE
        WHEN active_task_key = 'SCRUM-5' THEN 'SCRUM-5 ✓'
        WHEN active_task_key IS NULL THEN 'Unassigned'
        ELSE 'ERROR - Still has invalid key!'
    END as status,
    COUNT(*) as count,
    SUM(time_spent_seconds) / 3600.0 as total_hours
FROM public.analysis_results
GROUP BY status
ORDER BY status;

-- Final summary
SELECT
    'Total Records' as metric,
    COUNT(*) as value
FROM public.analysis_results
UNION ALL
SELECT
    'SCRUM-5 (Valid)',
    COUNT(*)
FROM public.analysis_results
WHERE active_task_key = 'SCRUM-5'
UNION ALL
SELECT
    'Unassigned (NULL)',
    COUNT(*)
FROM public.analysis_results
WHERE active_task_key IS NULL;

-- =====================================================
-- DONE!
-- =====================================================
-- Your database now has only:
-- - SCRUM-5 (valid key)
-- - NULL (unassigned - automatically goes to unassigned_activity via trigger)
