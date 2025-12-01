-- =====================================================
-- Migration: Fix timezone issue in date calculations
-- Description: Ensures dates are calculated consistently using UTC
--              to prevent time from appearing on wrong days
-- =====================================================

-- =====================================================
-- STEP 1: Update daily_time_summary view to use UTC explicitly
-- =====================================================

DROP VIEW IF EXISTS public.daily_time_summary CASCADE;

CREATE OR REPLACE VIEW public.daily_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    -- Explicitly convert to UTC before extracting date to ensure consistency
    DATE(s.timestamp AT TIME ZONE 'UTC') as work_date,
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
GROUP BY ar.user_id, u.display_name, DATE(s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
ORDER BY work_date DESC, ar.user_id, active_project_key, active_task_key;

-- =====================================================
-- STEP 2: Update weekly_time_summary view to use UTC explicitly
-- =====================================================

DROP VIEW IF EXISTS public.weekly_time_summary CASCADE;

CREATE OR REPLACE VIEW public.weekly_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    -- Explicitly convert to UTC before truncating to week
    DATE_TRUNC('week', s.timestamp AT TIME ZONE 'UTC')::date as week_start,
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
GROUP BY ar.user_id, u.display_name, DATE_TRUNC('week', s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
ORDER BY week_start DESC, ar.user_id, active_project_key, active_task_key;

-- =====================================================
-- STEP 3: Update monthly_time_summary view to use UTC explicitly
-- =====================================================

DROP VIEW IF EXISTS public.monthly_time_summary CASCADE;

CREATE OR REPLACE VIEW public.monthly_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    -- Explicitly convert to UTC before truncating to month
    DATE_TRUNC('month', s.timestamp AT TIME ZONE 'UTC')::date as month_start,
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
GROUP BY ar.user_id, u.display_name, DATE_TRUNC('month', s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
ORDER BY month_start DESC, ar.user_id, active_project_key, active_task_key;

-- =====================================================
-- STEP 4: Grant permissions (if needed)
-- =====================================================

GRANT SELECT ON public.daily_time_summary TO authenticated;
GRANT SELECT ON public.weekly_time_summary TO authenticated;
GRANT SELECT ON public.monthly_time_summary TO authenticated;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Run these queries after migration to verify dates are correct:

-- 1. Check daily_time_summary with UTC dates
-- SELECT 
--     user_display_name,
--     work_date,
--     TO_CHAR(work_date, 'DY') as day_name,
--     total_seconds,
--     -- Compare with original timestamp to verify
--     (SELECT MIN(s.timestamp) FROM screenshots s 
--      JOIN analysis_results ar ON ar.screenshot_id = s.id 
--      WHERE DATE(s.timestamp AT TIME ZONE 'UTC') = dts.work_date 
--      LIMIT 1) as sample_timestamp
-- FROM daily_time_summary dts
-- WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'
-- ORDER BY work_date DESC, user_display_name
-- LIMIT 20;

-- 2. Check if dates match expected days
-- This should show dates that match the day of week you expect
-- SELECT 
--     work_date,
--     TO_CHAR(work_date, 'DY') as day_name,
--     SUM(total_seconds) as total_seconds
-- FROM daily_time_summary
-- WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'
-- GROUP BY work_date
-- ORDER BY work_date DESC;


