-- ============================================================================
-- Migration: 026_add_project_key_to_screenshots.sql
-- Description: Add project_key column to screenshots table
--              This allows tracking which project the user was working on
--              even when AI fails to detect a specific task
--
-- The project_key is captured from the user's assigned issues at screenshot time.
-- Views will use COALESCE(ar.active_project_key, s.project_key) to fall back
-- to the screenshot's project when AI detection fails.
-- ============================================================================

-- 1. Add project_key column to screenshots table
-- ============================================================================
ALTER TABLE public.screenshots
ADD COLUMN IF NOT EXISTS project_key TEXT;

COMMENT ON COLUMN public.screenshots.project_key IS
  'Project key from user assigned issues at capture time. Used as fallback when AI detection fails.';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_screenshots_project_key
ON public.screenshots(project_key)
WHERE project_key IS NOT NULL;

-- Combined index for team analytics queries
CREATE INDEX IF NOT EXISTS idx_screenshots_org_project
ON public.screenshots(organization_id, project_key, timestamp DESC)
WHERE project_key IS NOT NULL AND deleted_at IS NULL;

-- 2. Update daily_time_summary view with project_key fallback
-- ============================================================================
DROP VIEW IF EXISTS public.daily_time_summary CASCADE;

CREATE VIEW public.daily_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE(s.timestamp) AS work_date,
  COALESCE(ar.active_project_key, s.project_key) AS project_key,
  ar.active_task_key AS task_key,
  ar.work_type,
  COUNT(*) AS session_count,
  SUM(COALESCE(s.duration_seconds, 300)) AS total_seconds,
  ROUND(SUM(COALESCE(s.duration_seconds, 300))::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
LEFT JOIN public.users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE(s.timestamp),
         COALESCE(ar.active_project_key, s.project_key), ar.active_task_key, ar.work_type
ORDER BY work_date DESC, total_seconds DESC;

COMMENT ON VIEW public.daily_time_summary IS
  'Daily time summary with project_key fallback: uses AI-detected project, falls back to screenshot project_key';

-- 3. Update weekly_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.weekly_time_summary CASCADE;

CREATE VIEW public.weekly_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('week', s.timestamp)::DATE AS week_start,
  COALESCE(ar.active_project_key, s.project_key) AS project_key,
  ar.active_task_key AS task_key,
  ar.work_type,
  COUNT(*) AS session_count,
  SUM(COALESCE(s.duration_seconds, 300)) AS total_seconds,
  ROUND(SUM(COALESCE(s.duration_seconds, 300))::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
LEFT JOIN public.users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('week', s.timestamp),
         COALESCE(ar.active_project_key, s.project_key), ar.active_task_key, ar.work_type
ORDER BY week_start DESC, total_seconds DESC;

-- 4. Update monthly_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.monthly_time_summary CASCADE;

CREATE VIEW public.monthly_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('month', s.timestamp)::DATE AS month_start,
  COALESCE(ar.active_project_key, s.project_key) AS project_key,
  ar.active_task_key AS task_key,
  ar.work_type,
  COUNT(*) AS session_count,
  SUM(COALESCE(s.duration_seconds, 300)) AS total_seconds,
  ROUND(SUM(COALESCE(s.duration_seconds, 300))::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
LEFT JOIN public.users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('month', s.timestamp),
         COALESCE(ar.active_project_key, s.project_key), ar.active_task_key, ar.work_type
ORDER BY month_start DESC, total_seconds DESC;

-- 5. Update project_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.project_time_summary CASCADE;

CREATE VIEW public.project_time_summary AS
SELECT
  COALESCE(ar.active_project_key, s.project_key) AS project_key,
  ar.organization_id,
  SUM(COALESCE(s.duration_seconds, 300)) AS total_seconds,
  COUNT(DISTINCT ar.user_id) AS unique_users,
  COUNT(*) AS total_sessions,
  ROUND(SUM(COALESCE(s.duration_seconds, 300))::NUMERIC / 3600.0, 2) AS total_hours
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
WHERE s.deleted_at IS NULL
  AND COALESCE(ar.active_project_key, s.project_key) IS NOT NULL
GROUP BY COALESCE(ar.active_project_key, s.project_key), ar.organization_id
ORDER BY total_seconds DESC;

-- 6. Update user_activity_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.user_activity_summary CASCADE;

CREATE VIEW public.user_activity_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  SUM(COALESCE(s.duration_seconds, 300)) AS total_seconds,
  COUNT(*) AS total_screenshots,
  COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
  MIN(s.timestamp) AS first_activity,
  MAX(s.timestamp) AS last_activity
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id;

-- 7. Update team_analytics_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.team_analytics_summary CASCADE;

CREATE VIEW public.team_analytics_summary AS
SELECT
  ar.organization_id,
  DATE(s.timestamp) AS work_date,
  COUNT(DISTINCT ar.user_id) AS active_users,
  SUM(COALESCE(s.duration_seconds, 300)) AS total_team_seconds,
  ROUND(SUM(COALESCE(s.duration_seconds, 300))::NUMERIC / 3600.0, 2) AS total_team_hours,
  ROUND(AVG(COALESCE(s.duration_seconds, 300))::NUMERIC / 3600.0, 2) AS avg_hours_per_session,
  COUNT(DISTINCT ar.active_task_key) AS unique_issues_worked,
  COUNT(*) AS total_screenshots,
  COUNT(DISTINCT COALESCE(ar.active_project_key, s.project_key)) AS active_projects,
  ARRAY_AGG(DISTINCT COALESCE(ar.active_project_key, s.project_key))
    FILTER (WHERE COALESCE(ar.active_project_key, s.project_key) IS NOT NULL) AS project_keys
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.work_type = 'office'
  AND s.deleted_at IS NULL
GROUP BY ar.organization_id, DATE(s.timestamp)
ORDER BY work_date DESC;

-- 8. Update activity_sessions view
-- ============================================================================
DROP VIEW IF EXISTS public.activity_sessions CASCADE;

CREATE VIEW public.activity_sessions AS
SELECT
  s.id,
  s.user_id,
  s.organization_id,
  s.start_time,
  s.end_time,
  COALESCE(s.duration_seconds, 300) AS duration_seconds,
  s.window_title,
  s.application_name,
  s.timestamp AS captured_at,
  s.storage_path,
  s.thumbnail_url,
  s.project_key AS screenshot_project_key,
  ar.active_task_key,
  COALESCE(ar.active_project_key, s.project_key) AS project_key,
  ar.work_type,
  ar.confidence_score,
  ar.id AS analysis_result_id
FROM public.screenshots s
LEFT JOIN public.analysis_results ar ON ar.screenshot_id = s.id
WHERE s.deleted_at IS NULL
ORDER BY s.start_time DESC;

-- 9. Grant permissions
-- ============================================================================
GRANT SELECT ON public.daily_time_summary TO authenticated, anon;
GRANT SELECT ON public.weekly_time_summary TO authenticated, anon;
GRANT SELECT ON public.monthly_time_summary TO authenticated, anon;
GRANT SELECT ON public.project_time_summary TO authenticated, anon;
GRANT SELECT ON public.user_activity_summary TO authenticated, anon;
GRANT SELECT ON public.team_analytics_summary TO authenticated, anon;
GRANT SELECT ON public.activity_sessions TO authenticated, anon;

-- 10. Set security invoker
-- ============================================================================
ALTER VIEW public.daily_time_summary SET (security_invoker = on);
ALTER VIEW public.weekly_time_summary SET (security_invoker = on);
ALTER VIEW public.monthly_time_summary SET (security_invoker = on);
ALTER VIEW public.project_time_summary SET (security_invoker = on);
ALTER VIEW public.user_activity_summary SET (security_invoker = on);
ALTER VIEW public.team_analytics_summary SET (security_invoker = on);
ALTER VIEW public.activity_sessions SET (security_invoker = on);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '=== Migration 026 completed ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  1. Added project_key column to screenshots table';
  RAISE NOTICE '  2. Updated all time summary views to use:';
  RAISE NOTICE '     COALESCE(ar.active_project_key, s.project_key)';
  RAISE NOTICE '';
  RAISE NOTICE 'This means:';
  RAISE NOTICE '  - If AI detects a project, use that (ar.active_project_key)';
  RAISE NOTICE '  - Otherwise, use the project from screenshot (s.project_key)';
  RAISE NOTICE '';
  RAISE NOTICE 'Desktop app needs to be updated to send project_key with screenshots.';
END $$;
