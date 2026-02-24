-- ============================================================================
-- Migration: Update summary views to include activity_records data
-- Date: 2026-02-22
--
-- Updates daily_time_summary, weekly_time_summary, and monthly_time_summary
-- views to UNION ALL old data from screenshots+analysis_results with new
-- data from activity_records. Activity records with classification='productive'
-- and status='analyzed' are included alongside existing office work data.
-- ============================================================================

-- ============================================================================
-- DROP existing views first — CREATE OR REPLACE cannot change column types
-- (session_count changes from BIGINT to NUMERIC due to SUM(BIGINT))
-- ============================================================================
DROP VIEW IF EXISTS public.monthly_time_summary;
DROP VIEW IF EXISTS public.weekly_time_summary;
DROP VIEW IF EXISTS public.daily_time_summary;

-- ============================================================================
-- View: Daily time summary (office work only)
-- ============================================================================
CREATE VIEW public.daily_time_summary AS
SELECT
    combined.user_id,
    combined.organization_id,
    combined.user_display_name,
    combined.work_date,
    combined.project_key,
    combined.task_key,
    combined.work_type,
    SUM(combined.session_count) AS session_count,
    SUM(combined.total_seconds) AS total_seconds,
    ROUND(SUM(combined.total_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
    AVG(combined.avg_confidence) AS avg_confidence
FROM (
    -- Legacy data from screenshots + analysis_results
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
        AVG(ar.confidence_score) AS avg_confidence
    FROM public.analysis_results ar
    JOIN public.screenshots s ON ar.screenshot_id = s.id
    LEFT JOIN public.users u ON ar.user_id = u.id
    WHERE s.deleted_at IS NULL
      AND ar.work_type = 'office'
    GROUP BY ar.user_id, ar.organization_id, u.display_name,
             COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC')),
             ar.active_project_key, ar.active_task_key, ar.work_type

    UNION ALL

    -- New data from activity_records
    SELECT
        act.user_id,
        act.organization_id,
        u.display_name AS user_display_name,
        act.work_date,
        act.project_key,
        act.user_assigned_issue_key AS task_key,
        'office' AS work_type,
        1 AS session_count,
        act.duration_seconds AS total_seconds,
        NULL::NUMERIC AS avg_confidence
    FROM public.activity_records act
    LEFT JOIN public.users u ON act.user_id = u.id
    WHERE act.classification = 'productive'
      AND act.status = 'analyzed'
      AND act.work_date IS NOT NULL
) combined
GROUP BY combined.user_id, combined.organization_id, combined.user_display_name,
         combined.work_date, combined.project_key, combined.task_key, combined.work_type
ORDER BY work_date DESC, total_seconds DESC;

-- ============================================================================
-- View: Weekly time summary (office work only)
-- ============================================================================
CREATE VIEW public.weekly_time_summary AS
SELECT
    combined.user_id,
    combined.organization_id,
    combined.user_display_name,
    DATE_TRUNC('week', combined.work_date::timestamp)::DATE AS week_start,
    combined.project_key,
    combined.task_key,
    combined.work_type,
    SUM(combined.session_count) AS session_count,
    SUM(combined.total_seconds) AS total_seconds,
    ROUND(SUM(combined.total_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
    AVG(combined.avg_confidence) AS avg_confidence
FROM (
    -- Legacy data from screenshots + analysis_results
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
        AVG(ar.confidence_score) AS avg_confidence
    FROM public.analysis_results ar
    JOIN public.screenshots s ON ar.screenshot_id = s.id
    LEFT JOIN public.users u ON ar.user_id = u.id
    WHERE s.deleted_at IS NULL
      AND ar.work_type = 'office'
    GROUP BY ar.user_id, ar.organization_id, u.display_name,
             COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC')),
             ar.active_project_key, ar.active_task_key, ar.work_type

    UNION ALL

    -- New data from activity_records
    SELECT
        act.user_id,
        act.organization_id,
        u.display_name AS user_display_name,
        act.work_date,
        act.project_key,
        act.user_assigned_issue_key AS task_key,
        'office' AS work_type,
        1 AS session_count,
        act.duration_seconds AS total_seconds,
        NULL::NUMERIC AS avg_confidence
    FROM public.activity_records act
    LEFT JOIN public.users u ON act.user_id = u.id
    WHERE act.classification = 'productive'
      AND act.status = 'analyzed'
      AND act.work_date IS NOT NULL
) combined
GROUP BY combined.user_id, combined.organization_id, combined.user_display_name,
         DATE_TRUNC('week', combined.work_date::timestamp),
         combined.project_key, combined.task_key, combined.work_type
ORDER BY week_start DESC, total_seconds DESC;

-- ============================================================================
-- View: Monthly time summary (office work only)
-- ============================================================================
CREATE VIEW public.monthly_time_summary AS
SELECT
    combined.user_id,
    combined.organization_id,
    combined.user_display_name,
    DATE_TRUNC('month', combined.work_date::timestamp)::DATE AS month_start,
    combined.project_key,
    combined.task_key,
    combined.work_type,
    SUM(combined.session_count) AS session_count,
    SUM(combined.total_seconds) AS total_seconds,
    ROUND(SUM(combined.total_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
    AVG(combined.avg_confidence) AS avg_confidence
FROM (
    -- Legacy data from screenshots + analysis_results
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
        AVG(ar.confidence_score) AS avg_confidence
    FROM public.analysis_results ar
    JOIN public.screenshots s ON ar.screenshot_id = s.id
    LEFT JOIN public.users u ON ar.user_id = u.id
    WHERE s.deleted_at IS NULL
      AND ar.work_type = 'office'
    GROUP BY ar.user_id, ar.organization_id, u.display_name,
             COALESCE(s.work_date, DATE(s.timestamp AT TIME ZONE 'UTC')),
             ar.active_project_key, ar.active_task_key, ar.work_type

    UNION ALL

    -- New data from activity_records
    SELECT
        act.user_id,
        act.organization_id,
        u.display_name AS user_display_name,
        act.work_date,
        act.project_key,
        act.user_assigned_issue_key AS task_key,
        'office' AS work_type,
        1 AS session_count,
        act.duration_seconds AS total_seconds,
        NULL::NUMERIC AS avg_confidence
    FROM public.activity_records act
    LEFT JOIN public.users u ON act.user_id = u.id
    WHERE act.classification = 'productive'
      AND act.status = 'analyzed'
      AND act.work_date IS NOT NULL
) combined
GROUP BY combined.user_id, combined.organization_id, combined.user_display_name,
         DATE_TRUNC('month', combined.work_date::timestamp),
         combined.project_key, combined.task_key, combined.work_type
ORDER BY month_start DESC, total_seconds DESC;

-- ============================================================================
-- Preserve SECURITY INVOKER setting
-- CREATE OR REPLACE VIEW resets view options, so we must re-apply
-- ============================================================================
ALTER VIEW public.daily_time_summary SET (security_invoker = on);
ALTER VIEW public.weekly_time_summary SET (security_invoker = on);
ALTER VIEW public.monthly_time_summary SET (security_invoker = on);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON VIEW public.daily_time_summary IS 'Daily time aggregation combining legacy screenshot analysis and activity records - SECURITY INVOKER';
COMMENT ON VIEW public.weekly_time_summary IS 'Weekly time aggregation combining legacy screenshot analysis and activity records - SECURITY INVOKER';
COMMENT ON VIEW public.monthly_time_summary IS 'Monthly time aggregation combining legacy screenshot analysis and activity records - SECURITY INVOKER';
