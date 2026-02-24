-- ============================================================================
-- Migration: Extend project_settings with activity tracking columns
-- Date: 2026-02-21
--
-- Adds configuration columns for batch upload intervals, automatic worklog
-- creation, and non-work activity thresholds.
-- ============================================================================

-- Batch upload interval in seconds (how often the desktop app sends activity data)
ALTER TABLE public.project_settings ADD COLUMN IF NOT EXISTS batch_upload_interval INTEGER DEFAULT NULL;

-- Whether automatic worklog creation from activity records is enabled
ALTER TABLE public.project_settings ADD COLUMN IF NOT EXISTS auto_worklog_enabled BOOLEAN DEFAULT NULL;

-- Threshold in seconds for non-work activity before a session break is detected
ALTER TABLE public.project_settings ADD COLUMN IF NOT EXISTS non_work_threshold INTEGER DEFAULT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.project_settings.batch_upload_interval IS 'Batch upload interval in seconds for the desktop app activity data';
COMMENT ON COLUMN public.project_settings.auto_worklog_enabled IS 'Whether automatic worklog creation from activity records is enabled';
COMMENT ON COLUMN public.project_settings.non_work_threshold IS 'Threshold in seconds for non-work activity before a session break is detected';
