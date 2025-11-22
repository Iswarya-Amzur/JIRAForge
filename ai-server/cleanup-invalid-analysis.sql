-- Cleanup Script for Invalid Analysis Results
-- This script removes or updates analysis results that have project keys
-- that don't match any real Jira issues assigned to the user

-- Step 1: View invalid analysis results (for review before deletion)
-- These are results where the active_task_key doesn't match any user's assigned issues
SELECT
  ar.id,
  ar.user_id,
  ar.active_task_key,
  ar.project_key,
  ar.created_at,
  u.email
FROM analysis_results ar
LEFT JOIN users u ON ar.user_id = u.id
WHERE ar.is_active_work = true
  AND ar.active_task_key IS NOT NULL
  AND ar.project_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_jira_issues_cache ujic
    WHERE ujic.user_id = ar.user_id
      AND ujic.issue_key = ar.active_task_key
  )
ORDER BY ar.created_at DESC
LIMIT 100;

-- Step 2: Option A - Set invalid task keys to NULL (keeps the time tracking data but removes invalid task association)
-- Uncomment to execute:
/*
UPDATE analysis_results ar
SET
  active_task_key = NULL,
  project_key = NULL,
  confidence_score = 0,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{cleaned_invalid_task}',
    'true'::jsonb
  )
WHERE ar.is_active_work = true
  AND ar.active_task_key IS NOT NULL
  AND ar.project_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_jira_issues_cache ujic
    WHERE ujic.user_id = ar.user_id
      AND ujic.issue_key = ar.active_task_key
  );
*/

-- Step 3: Option B - Delete invalid analysis results entirely
-- WARNING: This will permanently delete analysis results with invalid task keys
-- Uncomment to execute:
/*
DELETE FROM analysis_results ar
WHERE ar.is_active_work = true
  AND ar.active_task_key IS NOT NULL
  AND ar.project_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_jira_issues_cache ujic
    WHERE ujic.user_id = ar.user_id
      AND ujic.issue_key = ar.active_task_key
  );
*/

-- Step 4: Clean up results with suspicious project keys (known patterns from OCR errors)
-- These are likely from text like "UTF-8", "GPT-4", etc. that got misidentified as Jira keys
SELECT
  COUNT(*) as count,
  project_key
FROM analysis_results
WHERE project_key IN ('UTF', 'GPT', 'PROJ', 'GW', 'API', 'HTTP', 'JSON', 'XML', 'SQL')
GROUP BY project_key
ORDER BY count DESC;

-- Step 5: Update suspicious project keys to NULL
-- Uncomment to execute:
/*
UPDATE analysis_results
SET
  active_task_key = NULL,
  project_key = NULL,
  confidence_score = 0,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{cleaned_suspicious_pattern}',
    'true'::jsonb
  )
WHERE project_key IN ('UTF', 'GPT', 'PROJ', 'GW', 'API', 'HTTP', 'JSON', 'XML', 'SQL', 'CSS', 'HTML');
*/

-- Step 6: Verify cleanup - Check remaining project keys
SELECT
  project_key,
  COUNT(*) as analysis_count,
  SUM(time_spent_seconds) / 3600.0 as total_hours
FROM analysis_results
WHERE is_active_work = true
  AND project_key IS NOT NULL
GROUP BY project_key
ORDER BY analysis_count DESC;
