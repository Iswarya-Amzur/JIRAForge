-- ============================================================================
-- Migration: Fix timezone issue in summary views
-- Date: 2026-02-16
-- 
-- Problem: The daily_time_summary and weekly_time_summary views calculate 
-- work_date using UTC timezone from timestamp, causing mismatches with the 
-- frontend which queries using the user's local date.
--
-- Solution: Use the work_date column from screenshots table, which is set by
-- the desktop app using the user's local timezone.
-- ============================================================================

-- View: Daily time summary (office work only)
-- Changed: Use s.work_date directly instead of DATE(s.timestamp AT TIME ZONE 'UTC')
CREATE OR REPLACE VIEW public.daily_time_summary AS
SELECT
    ar.user_id,
    ar.organization_id,
    u.display_name AS user_display_name,
    COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC')) AS work_date,
    ar.active_project_key AS project_key,
    ar.active_task_key AS task_key,
    ar.work_type,
    COUNT(*) AS session_count,
    SUM(COALESCE(s.duration_seconds, ar.time_spent_seconds)) AS total_seconds,
    ROUND(SUM(COALESCE(s.duration_seconds, ar.time_spent_seconds))::NUMERIC / 3600.0, 2) AS total_hours,
    AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
LEFT JOIN public.users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
  AND ar.work_type = 'office'
GROUP BY ar.user_id, ar.organization_id, u.display_name, 
         COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC')), 
         ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY work_date DESC, total_seconds DESC;

-- View: Weekly time summary (office work only)
-- Changed: Calculate week_start from s.work_date instead of timestamp
CREATE OR REPLACE VIEW public.weekly_time_summary AS
SELECT
    ar.user_id,
    ar.organization_id,
    u.display_name AS user_display_name,
    DATE_TRUNC('week', COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC'))::timestamp)::DATE AS week_start,
    ar.active_project_key AS project_key,
    ar.active_task_key AS task_key,
    ar.work_type,
    COUNT(*) AS session_count,
    SUM(COALESCE(s.duration_seconds, ar.time_spent_seconds)) AS total_seconds,
    ROUND(SUM(COALESCE(s.duration_seconds, ar.time_spent_seconds))::NUMERIC / 3600.0, 2) AS total_hours,
    AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
LEFT JOIN public.users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
  AND ar.work_type = 'office'
GROUP BY ar.user_id, ar.organization_id, u.display_name, 
         DATE_TRUNC('week', COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC'))::timestamp), 
         ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY week_start DESC, total_seconds DESC;

-- View: Monthly time summary (office work only)
-- Changed: Calculate month_start from s.work_date instead of timestamp
CREATE OR REPLACE VIEW public.monthly_time_summary AS
SELECT
    ar.user_id,
    ar.organization_id,
    u.display_name AS user_display_name,
    DATE_TRUNC('month', COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC'))::timestamp)::DATE AS month_start,
    ar.active_project_key AS project_key,
    ar.active_task_key AS task_key,
    ar.work_type,
    COUNT(*) AS session_count,
    SUM(COALESCE(s.duration_seconds, ar.time_spent_seconds)) AS total_seconds,
    ROUND(SUM(COALESCE(s.duration_seconds, ar.time_spent_seconds))::NUMERIC / 3600.0, 2) AS total_hours,
    AVG(ar.confidence_score) AS avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON ar.screenshot_id = s.id
LEFT JOIN public.users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
  AND ar.work_type = 'office'
GROUP BY ar.user_id, ar.organization_id, u.display_name, 
         DATE_TRUNC('month', COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC'))::timestamp), 
         ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY month_start DESC, total_seconds DESC;

-- Preserve SECURITY INVOKER setting (was set by 20260211_fix_security_definer_views.sql)
-- CREATE OR REPLACE VIEW resets view options, so we must re-apply
ALTER VIEW public.daily_time_summary SET (security_invoker = on);
ALTER VIEW public.weekly_time_summary SET (security_invoker = on);
ALTER VIEW public.monthly_time_summary SET (security_invoker = on);

-- Add comments
COMMENT ON VIEW public.daily_time_summary IS 'Daily time aggregation using user local timezone (from work_date column) - SECURITY INVOKER';
COMMENT ON VIEW public.weekly_time_summary IS 'Weekly time aggregation using user local timezone (from work_date column) - SECURITY INVOKER';
COMMENT ON VIEW public.monthly_time_summary IS 'Monthly time aggregation using user local timezone (from work_date column) - SECURITY INVOKER';
