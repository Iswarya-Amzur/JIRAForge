-- Migration: Fix search_path for 5 functions flagged by Supabase Security Advisor
-- Date: 2026-02-12
-- Description: Sets immutable search_path on functions that were missing it.
--   Using ALTER FUNCTION (not CREATE OR REPLACE) to safely add the setting
--   without touching the function body.

ALTER FUNCTION public.update_latest_release() SET search_path = '';
ALTER FUNCTION public.update_app_releases_updated_at() SET search_path = '';
ALTER FUNCTION public.update_project_settings_updated_at() SET search_path = '';
ALTER FUNCTION public.update_feedback_updated_at() SET search_path = '';
ALTER FUNCTION public.notify_screenshot_webhook() SET search_path = '';

-- ============================================================================
-- Fix Performance Advisor warning: auth_rls_initplan on feedback table
-- ============================================================================
-- The migration 20260211_fix_rls_performance.sql was never applied to the
-- database. Including those fixes here.

-- Drop redundant service_role policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can manage all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Service role can manage all worklog_sync" ON public.worklog_sync;
DROP POLICY IF EXISTS "Service role can manage releases" ON public.app_releases;
DROP POLICY IF EXISTS "project_settings_service_role" ON public.project_settings;

-- Fix: wrap auth.jwt() in (select ...) so it's evaluated once per query, not per row
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
CREATE POLICY "Users can view their own feedback" ON public.feedback
    FOR SELECT USING (atlassian_account_id = (select auth.jwt() ->> 'sub'));

-- ============================================================================
-- Fix Performance Advisor warning: unindexed_foreign_keys
-- ============================================================================
-- Foreign key columns without indexes cause sequential scans when the
-- referenced row is deleted/updated (to check FK constraints).

CREATE INDEX IF NOT EXISTS idx_app_releases_created_by ON public.app_releases(created_by);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_project_settings_configured_by ON public.project_settings(configured_by);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_assigned_by ON public.unassigned_activity(assigned_by);
CREATE INDEX IF NOT EXISTS idx_unassigned_work_groups_assigned_by ON public.unassigned_work_groups(assigned_by);
CREATE INDEX IF NOT EXISTS idx_worklogs_analysis_result_id ON public.worklogs(analysis_result_id);
