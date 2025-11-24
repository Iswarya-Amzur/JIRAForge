-- =====================================================
-- TIME CALCULATION VERIFICATION QUERIES
-- =====================================================
-- These queries verify the time calculations shown in Time Analytics page

-- =====================================================
-- 1. TODAY'S, WEEK'S, AND MONTH'S TOTAL
-- =====================================================
-- This matches exactly what the Time Analytics page shows

WITH time_calculations AS (
    SELECT
        -- Today's Total
        SUM(CASE
            WHEN DATE(s.timestamp) = CURRENT_DATE
            THEN ar.time_spent_seconds
            ELSE 0
        END) as today_seconds,

        -- This Week's Total (Sunday to today)
        SUM(CASE
            WHEN DATE(s.timestamp) >= DATE_TRUNC('week', CURRENT_DATE)
            THEN ar.time_spent_seconds
            ELSE 0
        END) as week_seconds,

        -- This Month's Total
        SUM(CASE
            WHEN DATE_TRUNC('month', s.timestamp) = DATE_TRUNC('month', CURRENT_DATE)
            THEN ar.time_spent_seconds
            ELSE 0
        END) as month_seconds,

        -- All Time Total
        SUM(ar.time_spent_seconds) as all_time_seconds

    FROM public.analysis_results ar
    JOIN public.screenshots s ON s.id = ar.screenshot_id
    WHERE ar.is_active_work = TRUE
      AND ar.is_idle = FALSE
)
SELECT
    -- Today's Total
    CONCAT(
        FLOOR(today_seconds / 3600), 'h ',
        FLOOR((today_seconds % 3600) / 60), 'm'
    ) as "Today's Total",
    today_seconds as today_total_seconds,
    ROUND(today_seconds / 3600.0, 2) as today_hours,

    -- This Week's Total
    CONCAT(
        FLOOR(week_seconds / 3600), 'h ',
        FLOOR((week_seconds % 3600) / 60), 'm'
    ) as "This Week's Total",
    week_seconds as week_total_seconds,
    ROUND(week_seconds / 3600.0, 2) as week_hours,

    -- This Month's Total
    CONCAT(
        FLOOR(month_seconds / 3600), 'h ',
        FLOOR((month_seconds % 3600) / 60), 'm'
    ) as "This Month's Total",
    month_seconds as month_total_seconds,
    ROUND(month_seconds / 3600.0, 2) as month_hours,

    -- All Time Total
    CONCAT(
        FLOOR(all_time_seconds / 3600), 'h ',
        FLOOR((all_time_seconds % 3600) / 60), 'm'
    ) as "All Time Total",
    all_time_seconds as all_time_total_seconds,
    ROUND(all_time_seconds / 3600.0, 2) as all_time_hours

FROM time_calculations;

-- =====================================================
-- 2. BREAKDOWN BY TASK KEY (This Month)
-- =====================================================
-- See how much time spent on each task this month

SELECT
    COALESCE(ar.active_task_key, 'Unassigned') as task_key,
    COUNT(DISTINCT s.id) as screenshots,
    SUM(ar.time_spent_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(ar.time_spent_seconds) / 3600), 'h ',
        FLOOR((SUM(ar.time_spent_seconds) % 3600) / 60), 'm'
    ) as formatted_time,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as hours
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE
  AND ar.is_idle = FALSE
  AND DATE_TRUNC('month', s.timestamp) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY ar.active_task_key
ORDER BY total_seconds DESC;

-- =====================================================
-- 3. DAILY BREAKDOWN (This Month)
-- =====================================================
-- See time tracked per day this month

SELECT
    DATE(s.timestamp) as date,
    TO_CHAR(DATE(s.timestamp), 'Day') as day_name,
    COUNT(DISTINCT s.id) as screenshots,
    SUM(ar.time_spent_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(ar.time_spent_seconds) / 3600), 'h ',
        FLOOR((SUM(ar.time_spent_seconds) % 3600) / 60), 'm'
    ) as formatted_time,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as hours
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE
  AND ar.is_idle = FALSE
  AND DATE_TRUNC('month', s.timestamp) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY DATE(s.timestamp)
ORDER BY date DESC;

-- =====================================================
-- 4. USING DAILY_TIME_SUMMARY VIEW
-- =====================================================
-- This is how the frontend actually calculates (using the view)

SELECT
    'Today' as period,
    SUM(total_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(total_seconds) / 3600), 'h ',
        FLOOR((SUM(total_seconds) % 3600) / 60), 'm'
    ) as formatted_time
FROM public.daily_time_summary
WHERE work_date = CURRENT_DATE

UNION ALL

SELECT
    'This Week' as period,
    SUM(total_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(total_seconds) / 3600), 'h ',
        FLOOR((SUM(total_seconds) % 3600) / 60), 'm'
    ) as formatted_time
FROM public.daily_time_summary
WHERE work_date >= DATE_TRUNC('week', CURRENT_DATE)

UNION ALL

SELECT
    'This Month' as period,
    SUM(total_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(total_seconds) / 3600), 'h ',
        FLOOR((SUM(total_seconds) % 3600) / 60), 'm'
    ) as formatted_time
FROM public.daily_time_summary
WHERE TO_CHAR(work_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- =====================================================
-- 5. VERIFY ONLY SCRUM-5 EXISTS
-- =====================================================
-- Check that cleanup worked - should only show SCRUM-5 and NULL

SELECT
    CASE
        WHEN active_task_key = 'SCRUM-5' THEN 'SCRUM-5 ✓'
        WHEN active_task_key IS NULL THEN 'Unassigned'
        ELSE CONCAT('ERROR: ', active_task_key)
    END as task_status,
    COUNT(*) as count,
    SUM(time_spent_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(time_spent_seconds) / 3600), 'h ',
        FLOOR((SUM(time_spent_seconds) % 3600) / 60), 'm'
    ) as formatted_time
FROM public.analysis_results
WHERE is_active_work = TRUE
  AND is_idle = FALSE
GROUP BY task_status
ORDER BY task_status;

-- =====================================================
-- 6. SCRUM-5 DETAILED BREAKDOWN
-- =====================================================
-- See all SCRUM-5 time by day

SELECT
    DATE(s.timestamp) as date,
    COUNT(*) as activities,
    SUM(ar.time_spent_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(ar.time_spent_seconds) / 3600), 'h ',
        FLOOR((SUM(ar.time_spent_seconds) % 3600) / 60), 'm'
    ) as formatted_time,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as hours
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.active_task_key = 'SCRUM-5'
  AND ar.is_active_work = TRUE
  AND ar.is_idle = FALSE
GROUP BY DATE(s.timestamp)
ORDER BY date DESC;

-- =====================================================
-- 7. UNASSIGNED ACTIVITY TOTALS
-- =====================================================
-- See total unassigned time

SELECT
    'Unassigned Activities' as category,
    COUNT(*) as count,
    SUM(time_spent_seconds) as total_seconds,
    CONCAT(
        FLOOR(SUM(time_spent_seconds) / 3600), 'h ',
        FLOOR((SUM(time_spent_seconds) % 3600) / 60), 'm'
    ) as formatted_time,
    ROUND(SUM(time_spent_seconds) / 3600.0, 2) as hours
FROM public.unassigned_activity;
