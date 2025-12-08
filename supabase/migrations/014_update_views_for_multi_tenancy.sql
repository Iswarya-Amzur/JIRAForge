-- ============================================================================
-- Migration: 014_update_views_for_multi_tenancy.sql
-- Description: Update existing views and create team analytics view
-- Author: Multi-Tenancy Implementation
-- Date: 2024-12-04
-- ============================================================================

-- 1. Update daily_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.daily_time_summary CASCADE;

CREATE VIEW public.daily_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE(s.timestamp) AS work_date,
  ar.active_project_key,
  ar.active_task_key,
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE(s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY work_date DESC, ar.user_id, ar.active_project_key, ar.active_task_key;

COMMENT ON VIEW public.daily_time_summary IS
  'Daily work summary per user and organization';


-- 2. Update weekly_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.weekly_time_summary CASCADE;

CREATE VIEW public.weekly_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('week', s.timestamp)::DATE AS week_start,
  ar.active_project_key,
  ar.active_task_key,
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('week', s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY week_start DESC, ar.user_id, ar.active_project_key, ar.active_task_key;

COMMENT ON VIEW public.weekly_time_summary IS
  'Weekly work summary per user and organization';


-- 3. Update monthly_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.monthly_time_summary CASCADE;

CREATE VIEW public.monthly_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('month', s.timestamp)::DATE AS month_start,
  ar.active_project_key,
  ar.active_task_key,
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('month', s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY month_start DESC, ar.user_id, ar.active_project_key, ar.active_task_key;

COMMENT ON VIEW public.monthly_time_summary IS
  'Monthly work summary per user and organization';


-- 4. Update project_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.project_time_summary CASCADE;

CREATE VIEW public.project_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  ar.active_project_key,
  SUM(ar.time_spent_seconds) AS total_seconds,
  COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
  COUNT(DISTINCT s.id) AS screenshot_count,
  MIN(s.timestamp) AS first_activity,
  MAX(s.timestamp) AS last_activity
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = true
  AND ar.is_idle = false
  AND ar.active_project_key IS NOT NULL
GROUP BY ar.user_id, ar.organization_id, ar.active_project_key;

COMMENT ON VIEW public.project_time_summary IS
  'Project-level work summary per user and organization';


-- 5. Update unassigned_activity_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.unassigned_activity_summary CASCADE;

CREATE VIEW public.unassigned_activity_summary AS
SELECT
  ua.user_id,
  ua.organization_id,
  u.email AS user_email,
  u.display_name AS user_name,
  COUNT(*) AS unassigned_count,
  SUM(ua.time_spent_seconds) AS total_unassigned_seconds,
  ROUND(SUM(ua.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_unassigned_hours,
  COUNT(*) FILTER (WHERE ua.manually_assigned = true) AS manually_assigned_count,
  COUNT(*) FILTER (WHERE ua.manually_assigned = false) AS pending_assignment_count
FROM public.unassigned_activity ua
JOIN public.users u ON u.id = ua.user_id
GROUP BY ua.user_id, ua.organization_id, u.email, u.display_name
ORDER BY total_unassigned_seconds DESC;

COMMENT ON VIEW public.unassigned_activity_summary IS
  'Summary of unassigned work sessions per user and organization';


-- 6. Create NEW team_analytics_summary view (for admins)
-- ============================================================================
CREATE VIEW public.team_analytics_summary AS
SELECT
  ar.organization_id,
  DATE(s.timestamp) AS work_date,

  -- User metrics
  COUNT(DISTINCT ar.user_id) AS active_users,

  -- Time metrics
  SUM(ar.time_spent_seconds) AS total_team_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_team_hours,
  ROUND(AVG(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS avg_hours_per_session,

  -- Issue metrics
  COUNT(DISTINCT ar.active_task_key) AS unique_issues_worked,
  COUNT(*) AS total_screenshots,

  -- Project metrics
  COUNT(DISTINCT ar.active_project_key) AS active_projects,
  ARRAY_AGG(DISTINCT ar.active_project_key) FILTER (WHERE ar.active_project_key IS NOT NULL) AS project_keys

FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.work_type = 'office'
GROUP BY ar.organization_id, DATE(s.timestamp)
ORDER BY work_date DESC;

COMMENT ON VIEW public.team_analytics_summary IS
  'Team-level analytics for admins/managers to view organization performance';


-- 7. Create work_type_analytics view (office vs non-office breakdown)
-- ============================================================================
CREATE VIEW public.work_type_analytics AS
SELECT
  ar.user_id,
  ar.organization_id,
  DATE(s.timestamp) AS analysis_date,

  -- Work type breakdown
  COUNT(*) FILTER (WHERE ar.work_type = 'office') AS office_screenshots,
  COUNT(*) FILTER (WHERE ar.work_type = 'non-office') AS non_office_screenshots,
  COUNT(*) AS total_screenshots,

  -- Percentages
  ROUND(
    (COUNT(*) FILTER (WHERE ar.work_type = 'office')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS office_percentage,
  ROUND(
    (COUNT(*) FILTER (WHERE ar.work_type = 'non-office')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS non_office_percentage,

  -- Top applications (aggregated)
  ARRAY_AGG(DISTINCT s.application_name) FILTER (WHERE s.application_name IS NOT NULL) AS applications_used

FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
GROUP BY ar.user_id, ar.organization_id, DATE(s.timestamp)
ORDER BY analysis_date DESC;

COMMENT ON VIEW public.work_type_analytics IS
  'Work type classification analytics per user and organization';


-- 8. Create team_work_type_analytics view (team-level work type breakdown)
-- ============================================================================
CREATE VIEW public.team_work_type_analytics AS
SELECT
  ar.organization_id,
  DATE(s.timestamp) AS analysis_date,

  -- Team-wide work type breakdown
  COUNT(*) FILTER (WHERE ar.work_type = 'office') AS office_screenshots,
  COUNT(*) FILTER (WHERE ar.work_type = 'non-office') AS non_office_screenshots,
  COUNT(*) AS total_screenshots,

  -- Percentages
  ROUND(
    (COUNT(*) FILTER (WHERE ar.work_type = 'office')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS office_percentage,
  ROUND(
    (COUNT(*) FILTER (WHERE ar.work_type = 'non-office')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
    2
  ) AS non_office_percentage,

  -- Active users
  COUNT(DISTINCT ar.user_id) AS active_users

FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
GROUP BY ar.organization_id, DATE(s.timestamp)
ORDER BY analysis_date DESC;

COMMENT ON VIEW public.team_work_type_analytics IS
  'Team-level work type classification for admins';


-- ============================================================================
-- Grant permissions
-- ============================================================================

-- Grant SELECT on all views to authenticated users
GRANT SELECT ON public.daily_time_summary TO authenticated;
GRANT SELECT ON public.weekly_time_summary TO authenticated;
GRANT SELECT ON public.monthly_time_summary TO authenticated;
GRANT SELECT ON public.project_time_summary TO authenticated;
GRANT SELECT ON public.unassigned_activity_summary TO authenticated;
GRANT SELECT ON public.team_analytics_summary TO authenticated;
GRANT SELECT ON public.work_type_analytics TO authenticated;
GRANT SELECT ON public.team_work_type_analytics TO authenticated;


-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'daily_time_summary',
      'weekly_time_summary',
      'monthly_time_summary',
      'project_time_summary',
      'unassigned_activity_summary',
      'team_analytics_summary',
      'work_type_analytics',
      'team_work_type_analytics'
    );

  RAISE NOTICE 'Created/updated % views', view_count;

  IF view_count = 8 THEN
    RAISE NOTICE 'SUCCESS: All views created/updated (5 updated + 3 new)';
  ELSE
    RAISE WARNING 'Expected 8 views, found %', view_count;
  END IF;
END $$;
