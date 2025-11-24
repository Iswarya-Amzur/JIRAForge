-- =====================================================
-- MIGRATION: Add work_type column to replace is_active_work and is_idle
-- =====================================================
-- This migration adds a new work_type column that simplifies work classification
-- to just two categories: 'office' and 'non-office'
--
-- Important: Idle detection is now handled by the desktop app (auto-pause/resume)
-- so we only store actual work activities in the database.

-- =====================================================
-- STEP 1: Add work_type column
-- =====================================================

ALTER TABLE public.analysis_results
ADD COLUMN IF NOT EXISTS work_type TEXT
CHECK (work_type IN ('office', 'non-office'));

-- =====================================================
-- STEP 2: Migrate existing data
-- =====================================================
-- Map old is_active_work values to new work_type:
-- - is_active_work = TRUE AND is_idle = FALSE → 'office'
-- - is_active_work = FALSE → 'non-office'
-- - is_idle = TRUE → 'non-office' (historical data only, new data won't have idle)

UPDATE public.analysis_results
SET work_type = CASE
    WHEN is_active_work = TRUE AND is_idle = FALSE THEN 'office'
    WHEN is_active_work = FALSE OR is_idle = TRUE THEN 'non-office'
    ELSE 'non-office' -- Default fallback
END
WHERE work_type IS NULL;

-- Make work_type NOT NULL now that all rows have values
ALTER TABLE public.analysis_results
ALTER COLUMN work_type SET NOT NULL;

-- =====================================================
-- STEP 3: Update daily_time_summary view
-- =====================================================
-- This view is used by the Time Analytics frontend
-- Change filter from is_active_work = TRUE to work_type = 'office'

DROP VIEW IF EXISTS public.daily_time_summary;

CREATE OR REPLACE VIEW public.daily_time_summary AS
SELECT
    ar.user_id,
    DATE(s.timestamp) as work_date,
    ar.active_project_key as project_key,
    ar.active_task_key as task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.work_type = 'office'  -- Only count office work
GROUP BY ar.user_id, DATE(s.timestamp), ar.active_project_key, ar.active_task_key
ORDER BY work_date DESC, ar.user_id, project_key, task_key;

-- =====================================================
-- STEP 4: Update weekly_time_summary view
-- =====================================================

DROP VIEW IF EXISTS public.weekly_time_summary;

CREATE OR REPLACE VIEW public.weekly_time_summary AS
SELECT
    ar.user_id,
    DATE_TRUNC('week', s.timestamp)::DATE as week_start,
    ar.active_project_key as project_key,
    ar.active_task_key as task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.work_type = 'office'  -- Only count office work
GROUP BY ar.user_id, DATE_TRUNC('week', s.timestamp)::DATE, ar.active_project_key, ar.active_task_key
ORDER BY week_start DESC, ar.user_id, project_key, task_key;

-- =====================================================
-- STEP 5: Update monthly_time_summary view
-- =====================================================

DROP VIEW IF EXISTS public.monthly_time_summary;

CREATE OR REPLACE VIEW public.monthly_time_summary AS
SELECT
    ar.user_id,
    DATE_TRUNC('month', s.timestamp)::DATE as month_start,
    ar.active_project_key as project_key,
    ar.active_task_key as task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.work_type = 'office'  -- Only count office work
GROUP BY ar.user_id, DATE_TRUNC('month', s.timestamp)::DATE, ar.active_project_key, ar.active_task_key
ORDER BY month_start DESC, ar.user_id, project_key, task_key;

-- =====================================================
-- STEP 6: Create index on work_type for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_analysis_results_work_type
ON public.analysis_results(work_type);

-- =====================================================
-- STEP 7: Update unassigned_activity_summary view
-- =====================================================
-- Update to use work_type

DROP VIEW IF EXISTS public.unassigned_activity_summary;

CREATE OR REPLACE VIEW public.unassigned_activity_summary AS
SELECT
    ua.user_id,
    u.email as user_email,
    u.display_name as user_name,
    COUNT(*) as unassigned_count,
    SUM(ua.time_spent_seconds) as total_unassigned_seconds,
    ROUND(SUM(ua.time_spent_seconds) / 3600.0, 2) as total_unassigned_hours,
    COUNT(*) FILTER (WHERE ua.manually_assigned = TRUE) as manually_assigned_count,
    COUNT(*) FILTER (WHERE ua.manually_assigned = FALSE) as pending_assignment_count
FROM public.unassigned_activity ua
JOIN public.users u ON u.id = ua.user_id
GROUP BY ua.user_id, u.email, u.display_name
ORDER BY total_unassigned_seconds DESC;

-- =====================================================
-- OPTIONAL STEP 8: Drop old columns (COMMENTED OUT)
-- =====================================================
-- Only run this after verifying everything works with work_type
-- Uncomment these lines when you're ready to remove the old columns

-- ALTER TABLE public.analysis_results DROP COLUMN IF EXISTS is_active_work;
-- ALTER TABLE public.analysis_results DROP COLUMN IF EXISTS is_idle;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify migration results
SELECT
    work_type,
    COUNT(*) as count,
    SUM(time_spent_seconds) / 3600.0 as total_hours
FROM public.analysis_results
GROUP BY work_type
ORDER BY work_type;

-- Compare old vs new classification
SELECT
    is_active_work,
    is_idle,
    work_type,
    COUNT(*) as count
FROM public.analysis_results
GROUP BY is_active_work, is_idle, work_type
ORDER BY is_active_work, is_idle, work_type;

-- Verify daily_time_summary view works
SELECT
    work_date,
    COUNT(*) as activities,
    SUM(total_seconds) as total_seconds,
    SUM(total_hours) as total_hours
FROM public.daily_time_summary
WHERE work_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY work_date
ORDER BY work_date DESC;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. The old is_active_work and is_idle columns are kept for now
--    for backward compatibility and verification
-- 2. Once verified, you can drop them using the commented SQL in STEP 8
-- 3. Desktop app will now handle idle detection (5 min timeout)
--    and auto-pause tracking, so no 'idle' records will be created
-- 4. AI analysis will classify screenshots as 'office' or 'non-office'
--    using GPT-4 Vision instead of hardcoded rules
