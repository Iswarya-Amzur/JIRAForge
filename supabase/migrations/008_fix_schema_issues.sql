-- =====================================================
-- Migration: Fix Schema Issues
-- Description: Fixes timezone inconsistency, adds missing indexes,
--              and ensures data type precision
-- =====================================================

-- =====================================================
-- FIX 1: Timezone Issue in created_issues_log
-- =====================================================
-- Change created_at from timestamp without time zone to timestamp with time zone

ALTER TABLE public.created_issues_log
ALTER COLUMN created_at TYPE timestamp with time zone
USING created_at AT TIME ZONE 'UTC';

COMMENT ON COLUMN public.created_issues_log.created_at IS 'Timestamp when issue was created (UTC)';

-- =====================================================
-- FIX 2: Verify confidence_score Precision
-- =====================================================
-- Ensure confidence_score has proper precision (DECIMAL(3, 2))
-- Note: Must drop views first, alter column, then recreate views

DO $$
DECLARE
    needs_alter boolean := false;
    current_type text;
    current_precision integer;
BEGIN
    -- Check current column type
    SELECT data_type, numeric_precision INTO current_type, current_precision
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'analysis_results'
    AND column_name = 'confidence_score';
    
    -- Determine if we need to alter
    IF current_type != 'numeric' OR current_precision IS NULL OR current_precision != 3 THEN
        needs_alter := true;
    END IF;
    
    IF needs_alter THEN
        -- Drop dependent views first
        DROP VIEW IF EXISTS public.daily_time_summary CASCADE;
        DROP VIEW IF EXISTS public.weekly_time_summary CASCADE;
        DROP VIEW IF EXISTS public.monthly_time_summary CASCADE;
        DROP VIEW IF EXISTS public.project_time_summary CASCADE;
        
        -- Now alter the column
        ALTER TABLE public.analysis_results
        ALTER COLUMN confidence_score TYPE DECIMAL(3, 2);
        
        -- Recreate views (using UTC timezone fix from migration 007)
        CREATE OR REPLACE VIEW public.daily_time_summary AS
        SELECT
            ar.user_id,
            u.display_name as user_display_name,
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
        WHERE ar.work_type = 'office'
        GROUP BY ar.user_id, u.display_name, DATE(s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
        ORDER BY work_date DESC, ar.user_id, active_project_key, active_task_key;
        
        CREATE OR REPLACE VIEW public.weekly_time_summary AS
        SELECT
            ar.user_id,
            u.display_name as user_display_name,
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
        WHERE ar.work_type = 'office'
        GROUP BY ar.user_id, u.display_name, DATE_TRUNC('week', s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
        ORDER BY week_start DESC, ar.user_id, active_project_key, active_task_key;
        
        CREATE OR REPLACE VIEW public.monthly_time_summary AS
        SELECT
            ar.user_id,
            u.display_name as user_display_name,
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
        WHERE ar.work_type = 'office'
        GROUP BY ar.user_id, u.display_name, DATE_TRUNC('month', s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
        ORDER BY month_start DESC, ar.user_id, active_project_key, active_task_key;
        
        CREATE OR REPLACE VIEW public.project_time_summary AS
        SELECT
            ar.user_id,
            ar.active_project_key,
            SUM(ar.time_spent_seconds) AS total_seconds,
            COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
            COUNT(DISTINCT s.id) AS screenshot_count,
            MIN(s.timestamp) AS first_activity,
            MAX(s.timestamp) AS last_activity
        FROM public.analysis_results ar
        JOIN public.screenshots s ON s.id = ar.screenshot_id
        WHERE ar.is_active_work = TRUE AND ar.is_idle = FALSE AND ar.active_project_key IS NOT NULL
        GROUP BY ar.user_id, ar.active_project_key;
        
        -- Grant permissions
        GRANT SELECT ON public.daily_time_summary TO authenticated;
        GRANT SELECT ON public.weekly_time_summary TO authenticated;
        GRANT SELECT ON public.monthly_time_summary TO authenticated;
        GRANT SELECT ON public.project_time_summary TO authenticated;
        
        RAISE NOTICE '✓ confidence_score altered to DECIMAL(3, 2) and views recreated';
    ELSE
        RAISE NOTICE '✓ confidence_score already has correct type (DECIMAL(3, 2))';
    END IF;
END $$;

-- =====================================================
-- FIX 3: Add Missing Indexes
-- =====================================================

-- Index for work_type filtering
CREATE INDEX IF NOT EXISTS idx_analysis_results_work_type
ON public.analysis_results(work_type);

-- Index for unassigned work queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_unassigned
ON public.analysis_results(user_id, active_task_key)
WHERE active_task_key IS NULL;

-- Index for manual assignment queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_manual_assignment
ON public.analysis_results(manually_assigned, assignment_group_id);

-- Index for created issues lookup
CREATE INDEX IF NOT EXISTS idx_created_issues_user
ON public.created_issues_log(user_id, created_at DESC);

-- Indexes for unassigned work groups
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_user_id
ON public.unassigned_work_groups(user_id);

CREATE INDEX IF NOT EXISTS idx_unassigned_groups_is_assigned
ON public.unassigned_work_groups(is_assigned);

CREATE INDEX IF NOT EXISTS idx_unassigned_groups_created_at
ON public.unassigned_work_groups(created_at DESC);

-- Indexes for unassigned group members
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_group_id
ON public.unassigned_group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_activity_id
ON public.unassigned_group_members(unassigned_activity_id);

-- =====================================================
-- FIX 4: Add Performance Indexes
-- =====================================================

-- Composite index for filtering unassigned work by user and date
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_date_unassigned
ON public.analysis_results(user_id, created_at DESC)
WHERE active_task_key IS NULL AND work_type = 'office';

-- Index for assignment group queries
CREATE INDEX IF NOT EXISTS idx_analysis_results_assignment_group
ON public.analysis_results(assignment_group_id)
WHERE assignment_group_id IS NOT NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify timezone fix
DO $$
DECLARE
    col_type text;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'created_issues_log'
    AND column_name = 'created_at';
    
    IF col_type != 'timestamp with time zone' THEN
        RAISE EXCEPTION 'Timezone fix failed: created_at is still %', col_type;
    ELSE
        RAISE NOTICE '✓ Timezone fix successful: created_at is now timestamp with time zone';
    END IF;
END $$;

-- Verify indexes were created
DO $$
DECLARE
    index_count int;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    AND (
        indexname LIKE '%work_type%'
        OR indexname LIKE '%unassigned%'
        OR indexname LIKE '%manual_assignment%'
        OR indexname LIKE '%created_issues%'
        OR indexname LIKE '%assignment_group%'
    );
    
    IF index_count < 10 THEN
        RAISE WARNING 'Only % indexes found. Expected at least 10.', index_count;
    ELSE
        RAISE NOTICE '✓ Indexes created successfully: % indexes found', index_count;
    END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================

-- Run these queries to verify everything is correct:

-- 1. Check created_issues_log timezone
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'created_issues_log'
-- AND column_name = 'created_at';

-- 2. Check all indexes
-- SELECT tablename, indexname
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- 3. Check confidence_score type
-- SELECT column_name, data_type, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'analysis_results'
-- AND column_name = 'confidence_score';


