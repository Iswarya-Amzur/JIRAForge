-- =====================================================
-- Weekly Timesheet Verification Query
-- Week of Nov 23, 2025 (Sunday, Monday, Tuesday)
-- =====================================================

-- Query 1: Daily time breakdown by user for the week
-- This matches what's shown in the Weekly Timesheet
SELECT 
    COALESCE(u.display_name, u.email, 'User') AS team_member,
    dts.work_date,
    TO_CHAR(dts.work_date, 'DY') AS day_name,
    dts.total_seconds,
    -- Format time as hours and minutes (e.g., "3h 55m")
    CASE 
        WHEN dts.total_seconds >= 3600 THEN
            FLOOR(dts.total_seconds / 3600) || 'h ' || 
            FLOOR((dts.total_seconds % 3600) / 60) || 'm'
        ELSE
            FLOOR(dts.total_seconds / 60) || 'm'
    END AS formatted_time,
    dts.active_project_key,
    dts.active_task_key
FROM public.daily_time_summary dts
LEFT JOIN public.users u ON u.id = dts.user_id
WHERE dts.work_date >= '2025-11-23'::DATE 
  AND dts.work_date <= '2025-11-25'::DATE
  AND dts.work_date <= CURRENT_DATE  -- Only show dates up to today
ORDER BY dts.work_date, dts.user_id, dts.active_project_key, dts.active_task_key;

-- =====================================================
-- Query 2: Aggregated daily totals by user (matches the table view)
-- =====================================================
SELECT 
    COALESCE(u.display_name, u.email, 'User') AS team_member,
    dts.work_date,
    TO_CHAR(dts.work_date, 'DY') AS day_name,
    SUM(dts.total_seconds) AS total_seconds_per_day,
    -- Format time as hours and minutes
    CASE 
        WHEN SUM(dts.total_seconds) >= 3600 THEN
            FLOOR(SUM(dts.total_seconds) / 3600) || 'h ' || 
            FLOOR((SUM(dts.total_seconds) % 3600) / 60) || 'm'
        ELSE
            FLOOR(SUM(dts.total_seconds) / 60) || 'm'
    END AS formatted_time
FROM public.daily_time_summary dts
LEFT JOIN public.users u ON u.id = dts.user_id
WHERE dts.work_date >= '2025-11-23'::DATE 
  AND dts.work_date <= '2025-11-25'::DATE
  AND dts.work_date <= CURRENT_DATE
GROUP BY dts.user_id, u.display_name, u.email, dts.work_date
ORDER BY dts.work_date, team_member;

-- =====================================================
-- Query 3: Weekly totals by user (matches the TOTAL column)
-- =====================================================
SELECT 
    COALESCE(u.display_name, u.email, 'User') AS team_member,
    SUM(dts.total_seconds) AS total_seconds_week,
    -- Format time as hours and minutes
    CASE 
        WHEN SUM(dts.total_seconds) >= 3600 THEN
            FLOOR(SUM(dts.total_seconds) / 3600) || 'h ' || 
            FLOOR((SUM(dts.total_seconds) % 3600) / 60) || 'm'
        ELSE
            FLOOR(SUM(dts.total_seconds) / 60) || 'm'
    END AS formatted_total
FROM public.daily_time_summary dts
LEFT JOIN public.users u ON u.id = dts.user_id
WHERE dts.work_date >= '2025-11-23'::DATE 
  AND dts.work_date <= '2025-11-25'::DATE
  AND dts.work_date <= CURRENT_DATE
GROUP BY dts.user_id, u.display_name, u.email
ORDER BY total_seconds_week DESC;

-- =====================================================
-- Query 4: Daily totals across all users (matches Daily Totals row)
-- =====================================================
SELECT 
    dts.work_date,
    TO_CHAR(dts.work_date, 'DY') AS day_name,
    SUM(dts.total_seconds) AS total_seconds_per_day,
    -- Format time as hours and minutes
    CASE 
        WHEN SUM(dts.total_seconds) >= 3600 THEN
            FLOOR(SUM(dts.total_seconds) / 3600) || 'h ' || 
            FLOOR((SUM(dts.total_seconds) % 3600) / 60) || 'm'
        ELSE
            FLOOR(SUM(dts.total_seconds) / 60) || 'm'
    END AS formatted_time
FROM public.daily_time_summary dts
WHERE dts.work_date >= '2025-11-23'::DATE 
  AND dts.work_date <= '2025-11-25'::DATE
  AND dts.work_date <= CURRENT_DATE
GROUP BY dts.work_date
ORDER BY dts.work_date;

-- =====================================================
-- Query 5: Pivot table view (matches the exact table structure)
-- Shows SUN, MON, TUE columns with totals
-- =====================================================
WITH daily_totals AS (
    SELECT 
        dts.user_id,
        COALESCE(u.display_name, u.email, 'User') AS team_member,
        dts.work_date,
        SUM(dts.total_seconds) AS total_seconds
    FROM public.daily_time_summary dts
    LEFT JOIN public.users u ON u.id = dts.user_id
    WHERE dts.work_date >= '2025-11-23'::DATE 
      AND dts.work_date <= '2025-11-25'::DATE
      AND dts.work_date <= CURRENT_DATE
    GROUP BY dts.user_id, u.display_name, u.email, dts.work_date
)
SELECT 
    team_member,
    -- Sunday (Nov 23)
    COALESCE(
        CASE 
            WHEN SUM(CASE WHEN work_date = '2025-11-23' THEN total_seconds END) >= 3600 THEN
                FLOOR(SUM(CASE WHEN work_date = '2025-11-23' THEN total_seconds END) / 3600) || 'h ' || 
                FLOOR((SUM(CASE WHEN work_date = '2025-11-23' THEN total_seconds END) % 3600) / 60) || 'm'
            WHEN SUM(CASE WHEN work_date = '2025-11-23' THEN total_seconds END) > 0 THEN
                FLOOR(SUM(CASE WHEN work_date = '2025-11-23' THEN total_seconds END) / 60) || 'm'
            ELSE NULL
        END,
        '-'
    ) AS sun,
    -- Monday (Nov 24)
    COALESCE(
        CASE 
            WHEN SUM(CASE WHEN work_date = '2025-11-24' THEN total_seconds END) >= 3600 THEN
                FLOOR(SUM(CASE WHEN work_date = '2025-11-24' THEN total_seconds END) / 3600) || 'h ' || 
                FLOOR((SUM(CASE WHEN work_date = '2025-11-24' THEN total_seconds END) % 3600) / 60) || 'm'
            WHEN SUM(CASE WHEN work_date = '2025-11-24' THEN total_seconds END) > 0 THEN
                FLOOR(SUM(CASE WHEN work_date = '2025-11-24' THEN total_seconds END) / 60) || 'm'
            ELSE NULL
        END,
        '-'
    ) AS mon,
    -- Tuesday (Nov 25)
    COALESCE(
        CASE 
            WHEN SUM(CASE WHEN work_date = '2025-11-25' THEN total_seconds END) >= 3600 THEN
                FLOOR(SUM(CASE WHEN work_date = '2025-11-25' THEN total_seconds END) / 3600) || 'h ' || 
                FLOOR((SUM(CASE WHEN work_date = '2025-11-25' THEN total_seconds END) % 3600) / 60) || 'm'
            WHEN SUM(CASE WHEN work_date = '2025-11-25' THEN total_seconds END) > 0 THEN
                FLOOR(SUM(CASE WHEN work_date = '2025-11-25' THEN total_seconds END) / 60) || 'm'
            ELSE NULL
        END,
        '-'
    ) AS tue,
    -- Total
    CASE 
        WHEN SUM(total_seconds) >= 3600 THEN
            FLOOR(SUM(total_seconds) / 3600) || 'h ' || 
            FLOOR((SUM(total_seconds) % 3600) / 60) || 'm'
        WHEN SUM(total_seconds) > 0 THEN
            FLOOR(SUM(total_seconds) / 60) || 'm'
        ELSE '0m'
    END AS total
FROM daily_totals
GROUP BY user_id, team_member
ORDER BY SUM(total_seconds) DESC;

-- =====================================================
-- Query 6: Raw data check - See all analysis results for the week
-- Use this to debug if times don't match
-- =====================================================
SELECT 
    s.timestamp,
    s.timestamp AT TIME ZONE 'UTC' AS timestamp_utc,
    DATE(s.timestamp) AS work_date,
    DATE(s.timestamp AT TIME ZONE 'UTC') AS work_date_utc,
    TO_CHAR(s.timestamp, 'DY') AS day_name,
    TO_CHAR(s.timestamp AT TIME ZONE 'UTC', 'DY') AS day_name_utc,
    ar.user_id,
    COALESCE(u.display_name, u.email, 'User') AS user_name,
    ar.active_project_key,
    ar.active_task_key,
    ar.time_spent_seconds,
    ar.work_type,
    ar.is_active_work,
    ar.is_idle
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
LEFT JOIN public.users u ON u.id = ar.user_id
WHERE DATE(s.timestamp) >= '2025-11-23'::DATE 
  AND DATE(s.timestamp) <= '2025-11-25'::DATE
  AND DATE(s.timestamp) <= CURRENT_DATE
  AND ar.work_type = 'office'  -- Only office work
ORDER BY s.timestamp DESC;

-- =====================================================
-- Query 7: Check daily_time_summary view directly
-- This is what the frontend uses
-- =====================================================
SELECT 
    user_id,
    user_display_name,
    work_date,
    TO_CHAR(work_date, 'DY') AS day_name,
    active_project_key,
    active_task_key,
    total_seconds,
    CASE 
        WHEN total_seconds >= 3600 THEN
            FLOOR(total_seconds / 3600) || 'h ' || 
            FLOOR((total_seconds % 3600) / 60) || 'm'
        ELSE
            FLOOR(total_seconds / 60) || 'm'
    END AS formatted_time
FROM public.daily_time_summary
WHERE work_date >= '2025-11-23'::DATE 
  AND work_date <= '2025-11-25'::DATE
  AND work_date <= CURRENT_DATE
ORDER BY work_date, user_id, active_project_key, active_task_key;

