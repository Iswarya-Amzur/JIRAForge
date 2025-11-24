-- =====================================================
-- Migration: Add display_name to time summary views
-- Description: Updates daily_time_summary, weekly_time_summary,
--              and monthly_time_summary views to include user display names
-- =====================================================

-- =====================================================
-- STEP 1: Update daily_time_summary view to include display_name
-- =====================================================

DROP VIEW IF EXISTS public.daily_time_summary CASCADE;

CREATE OR REPLACE VIEW public.daily_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    DATE(s.timestamp) as work_date,
    ar.active_project_key,
    ar.active_task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'  -- Only count office work
GROUP BY ar.user_id, u.display_name, DATE(s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY work_date DESC, ar.user_id, active_project_key, active_task_key;

-- =====================================================
-- STEP 2: Update weekly_time_summary view to include display_name
-- =====================================================

DROP VIEW IF EXISTS public.weekly_time_summary CASCADE;

CREATE OR REPLACE VIEW public.weekly_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    DATE_TRUNC('week', s.timestamp)::date as week_start,
    ar.active_project_key,
    ar.active_task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'  -- Only count office work
GROUP BY ar.user_id, u.display_name, DATE_TRUNC('week', s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY week_start DESC, ar.user_id, active_project_key, active_task_key;

-- =====================================================
-- STEP 3: Update monthly_time_summary view to include display_name
-- =====================================================

DROP VIEW IF EXISTS public.monthly_time_summary CASCADE;

CREATE OR REPLACE VIEW public.monthly_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    DATE_TRUNC('month', s.timestamp)::date as month_start,
    ar.active_project_key,
    ar.active_task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'  -- Only count office work
GROUP BY ar.user_id, u.display_name, DATE_TRUNC('month', s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY month_start DESC, ar.user_id, active_project_key, active_task_key;

-- =====================================================
-- STEP 4: Grant permissions
-- =====================================================

GRANT SELECT ON public.daily_time_summary TO authenticated;
GRANT SELECT ON public.weekly_time_summary TO authenticated;
GRANT SELECT ON public.monthly_time_summary TO authenticated;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Run these queries after migration to verify:

-- 1. Check daily_time_summary includes display names
-- SELECT user_id, user_display_name, work_date, total_seconds
-- FROM daily_time_summary
-- LIMIT 10;

-- 2. Check weekly_time_summary includes display names
-- SELECT user_id, user_display_name, week_start, total_seconds
-- FROM weekly_time_summary
-- LIMIT 10;

-- 3. Check monthly_time_summary includes display names
-- SELECT user_id, user_display_name, month_start, total_seconds
-- FROM monthly_time_summary
-- LIMIT 10;
