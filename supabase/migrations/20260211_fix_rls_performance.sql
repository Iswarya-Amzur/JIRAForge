-- Migration: Fix Performance Advisor RLS warnings
-- Date: 2026-02-11
-- Description:
--   1. Drop redundant service_role RLS policies on feedback, worklog_sync,
--      app_releases, and project_settings. The Supabase service_role key
--      already bypasses RLS, so these policies never take effect and only
--      add per-row overhead + cause multiple_permissive_policies warnings.
--   2. Fix auth_rls_initplan on feedback "Users can view their own feedback"
--      by wrapping auth.jwt() in (select ...) so it's evaluated once per
--      query instead of per row.

-- ============================================================================
-- PART 1: Drop redundant service_role policies
-- ============================================================================
-- The service_role key has the bypassrls attribute in PostgreSQL, meaning
-- ALL RLS policies are skipped when using it. These policies:
--   - Never take effect with service_role (RLS bypassed)
--   - Always return FALSE for anon/authenticated (auth.role() != 'service_role')
--   - Cause multiple_permissive_policies overlaps with action-specific policies
--   - Cause auth_rls_initplan per-row evaluation of auth.role()

DROP POLICY IF EXISTS "Service role can manage all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Service role can manage all worklog_sync" ON public.worklog_sync;
DROP POLICY IF EXISTS "Service role can manage releases" ON public.app_releases;
DROP POLICY IF EXISTS "project_settings_service_role" ON public.project_settings;

-- ============================================================================
-- PART 2: Fix auth_rls_initplan on feedback user policy
-- ============================================================================
-- Wrap auth.jwt() in (select ...) so it's evaluated once per query, not per row.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
CREATE POLICY "Users can view their own feedback" ON public.feedback
    FOR SELECT USING (atlassian_account_id = (select auth.jwt() ->> 'sub'));
