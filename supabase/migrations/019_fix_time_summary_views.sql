-- ============================================================================
-- Migration: 019_fix_time_summary_views.sql
-- Description: Fix time summary views to include ALL work types (not just office)
--              This allows calculating total time and breaking down by work_type
-- Author: Time Tracker Team
-- Date: 2024-12-08
-- ============================================================================

-- 1. Update daily_time_summary view - INCLUDE ALL WORK TYPES
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
  ar.work_type,  -- Include work_type so we can filter/group in queries
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
-- REMOVED: WHERE ar.work_type = 'office' -- Now includes ALL work types
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE(s.timestamp), ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY work_date DESC, ar.user_id, ar.active_project_key, ar.active_task_key;

COMMENT ON VIEW public.daily_time_summary IS
  'Daily work summary per user and organization - includes all work types';


-- 2. Update weekly_time_summary view - INCLUDE ALL WORK TYPES
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
  ar.work_type,  -- Include work_type so we can filter/group in queries
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
-- REMOVED: WHERE ar.work_type = 'office' -- Now includes ALL work types
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('week', s.timestamp), ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY week_start DESC, ar.user_id, ar.active_project_key, ar.active_task_key;

COMMENT ON VIEW public.weekly_time_summary IS
  'Weekly work summary per user and organization - includes all work types';


-- 3. Update monthly_time_summary view - INCLUDE ALL WORK TYPES
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
  ar.work_type,  -- Include work_type so we can filter/group in queries
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
-- REMOVED: WHERE ar.work_type = 'office' -- Now includes ALL work types
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('month', s.timestamp), ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY month_start DESC, ar.user_id, ar.active_project_key, ar.active_task_key;

COMMENT ON VIEW public.monthly_time_summary IS
  'Monthly work summary per user and organization - includes all work types';


-- 4. Update project_time_summary view - INCLUDE ALL WORK TYPES
-- ============================================================================
DROP VIEW IF EXISTS public.project_time_summary CASCADE;

CREATE VIEW public.project_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  ar.active_project_key,
  ar.work_type,  -- Include work_type so we can filter/group in queries
  SUM(ar.time_spent_seconds) AS total_seconds,
  COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
  COUNT(DISTINCT s.id) AS screenshot_count,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.active_project_key IS NOT NULL
-- REMOVED: AND ar.work_type = 'office' -- Now includes ALL work types
GROUP BY ar.user_id, ar.organization_id, ar.active_project_key, ar.work_type
ORDER BY total_seconds DESC;

COMMENT ON VIEW public.project_time_summary IS
  'Project time summary per user and organization - includes all work types';


-- 5. Grant permissions
-- ============================================================================
GRANT SELECT ON public.daily_time_summary TO authenticated;
GRANT SELECT ON public.weekly_time_summary TO authenticated;
GRANT SELECT ON public.monthly_time_summary TO authenticated;
GRANT SELECT ON public.project_time_summary TO authenticated;

GRANT SELECT ON public.daily_time_summary TO anon;
GRANT SELECT ON public.weekly_time_summary TO anon;
GRANT SELECT ON public.monthly_time_summary TO anon;
GRANT SELECT ON public.project_time_summary TO anon;


-- ============================================================================
-- USAGE EXAMPLES:
-- ============================================================================
--
-- Get TOTAL time (all work types):
-- SELECT SUM(total_seconds) FROM daily_time_summary WHERE user_id = '...'
--
-- Get OFFICE time only:
-- SELECT SUM(total_seconds) FROM daily_time_summary WHERE user_id = '...' AND work_type = 'office'
--
-- Get NON-OFFICE time only:
-- SELECT SUM(total_seconds) FROM daily_time_summary WHERE user_id = '...' AND work_type = 'non-office'
--
-- Get breakdown by work_type:
-- SELECT work_type, SUM(total_seconds) FROM daily_time_summary WHERE user_id = '...' GROUP BY work_type
-- ============================================================================
