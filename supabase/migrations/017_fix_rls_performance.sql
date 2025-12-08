-- ============================================================================
-- Migration: 017_fix_rls_performance.sql
-- Description: Fix RLS performance issues and remove duplicate policies
-- Author: Performance Optimization
-- Date: 2024-12-XX
-- ============================================================================
-- This migration addresses Supabase linter warnings:
-- 1. auth_rls_initplan: Wraps auth.uid() and auth.jwt() in subqueries for better performance
-- 2. multiple_permissive_policies: Removes duplicate policies from old migrations
-- ============================================================================

-- 1. Fix helper functions to use optimized auth calls
-- ============================================================================

-- Get current user's ID (optimized)
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.users
    WHERE supabase_user_id = (SELECT auth.uid())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's organization ID (optimized)
CREATE OR REPLACE FUNCTION get_current_user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM public.users
    WHERE supabase_user_id = (SELECT auth.uid())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has specific permission (optimized)
CREATE OR REPLACE FUNCTION user_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_org_id UUID;
  user_id UUID;
  has_perm BOOLEAN;
BEGIN
  user_id := get_current_user_id();
  user_org_id := get_current_user_organization_id();

  IF user_id IS NULL OR user_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check based on permission type
  CASE permission_name
    WHEN 'view_team_analytics' THEN
      SELECT can_view_team_analytics INTO has_perm
      FROM public.organization_members
      WHERE user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_settings' THEN
      SELECT can_manage_settings INTO has_perm
      FROM public.organization_members
      WHERE user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_members' THEN
      SELECT can_manage_members INTO has_perm
      FROM public.organization_members
      WHERE user_id = user_id AND organization_id = user_org_id;

    WHEN 'delete_screenshots' THEN
      SELECT can_delete_screenshots INTO has_perm
      FROM public.organization_members
      WHERE user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_billing' THEN
      SELECT can_manage_billing INTO has_perm
      FROM public.organization_members
      WHERE user_id = user_id AND organization_id = user_org_id;

    ELSE
      RETURN false;
  END CASE;

  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is admin/owner (optimized)
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
  user_org_id UUID;
  user_role TEXT;
BEGIN
  user_id := get_current_user_id();
  user_org_id := get_current_user_organization_id();

  IF user_id IS NULL OR user_org_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role
  FROM public.organization_members
  WHERE user_id = user_id AND organization_id = user_org_id;

  RETURN user_role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 2. Drop old duplicate policies from 002_rls_policies.sql and QUICK_SETUP.sql
-- ============================================================================
-- These policies conflict with the new multi-tenancy policies from 013_create_rls_policies.sql

-- Users table old policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- Screenshots table old policies
DROP POLICY IF EXISTS "Users can view own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can insert own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can update own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can delete own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Service role can manage all screenshots" ON public.screenshots;

-- Analysis results table old policies
DROP POLICY IF EXISTS "Users can view own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can insert own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can update own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Service role can manage all analysis results" ON public.analysis_results;

-- Documents table old policies
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Service role can manage all documents" ON public.documents;

-- Worklogs table old policies
DROP POLICY IF EXISTS "Users can view own worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Users can insert own worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Service role can manage all worklogs" ON public.worklogs;

-- Activity log table old policies
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Service role can manage all activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Allow system to insert activity logs" ON public.activity_log;

-- User jira issues cache old policies
DROP POLICY IF EXISTS "Users can view own cached issues" ON public.user_jira_issues_cache;
DROP POLICY IF EXISTS "Service role can manage all cached issues" ON public.user_jira_issues_cache;


-- 3. Add service role policies (optimized) for backend operations
-- ============================================================================
-- These policies allow the service role to bypass RLS for backend operations
-- Using (SELECT auth.jwt()) for performance optimization

-- Users table service role policy
CREATE POLICY "service_role_manage_users"
ON public.users FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Screenshots table service role policy
CREATE POLICY "service_role_manage_screenshots"
ON public.screenshots FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Analysis results table service role policy
CREATE POLICY "service_role_manage_analysis_results"
ON public.analysis_results FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Documents table service role policy
CREATE POLICY "service_role_manage_documents"
ON public.documents FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Worklogs table service role policy
CREATE POLICY "service_role_manage_worklogs"
ON public.worklogs FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Activity log table service role policy
CREATE POLICY "service_role_manage_activity_log"
ON public.activity_log FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- User jira issues cache service role policy
CREATE POLICY "service_role_manage_jira_cache"
ON public.user_jira_issues_cache FOR ALL
USING ((SELECT auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((SELECT auth.jwt() ->> 'role') = 'service_role');

-- Activity log system insert policy (for system events without user context)
CREATE POLICY "system_insert_activity_log"
ON public.activity_log FOR INSERT
WITH CHECK (true);


-- 4. Update existing policies that use direct auth calls
-- ============================================================================
-- Note: The policies from 013_create_rls_policies.sql use helper functions,
-- which we've already optimized above. However, we need to ensure the
-- organization_members policies are also optimized.

-- The organization_members policies use get_current_user_organization_id()
-- which we've already fixed, so they should be fine.

-- However, if there are any remaining direct auth.uid() calls in policies,
-- they would need to be updated here. Based on the migration 013, all
-- policies use helper functions, so no direct updates needed.


-- 5. Add missing update/delete policies for screenshots
-- ============================================================================
-- The new multi-tenancy policies might be missing some operations

-- Screenshots update policy (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'screenshots' 
    AND policyname = 'screenshots_update_own'
  ) THEN
    CREATE POLICY "screenshots_update_own"
    ON public.screenshots FOR UPDATE
    USING (
      organization_id = get_current_user_organization_id()
      AND user_id = get_current_user_id()
    )
    WITH CHECK (
      organization_id = get_current_user_organization_id()
      AND user_id = get_current_user_id()
    );
  END IF;
END $$;

-- Documents delete policy (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'documents' 
    AND policyname = 'documents_delete_own'
  ) THEN
    CREATE POLICY "documents_delete_own"
    ON public.documents FOR DELETE
    USING (
      organization_id = get_current_user_organization_id()
      AND user_id = get_current_user_id()
    );
  END IF;
END $$;

-- Worklogs update policy (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'worklogs' 
    AND policyname = 'worklogs_update_own'
  ) THEN
    CREATE POLICY "worklogs_update_own"
    ON public.worklogs FOR UPDATE
    USING (
      organization_id = get_current_user_organization_id()
      AND user_id = get_current_user_id()
    )
    WITH CHECK (
      organization_id = get_current_user_organization_id()
      AND user_id = get_current_user_id()
    );
  END IF;
END $$;


-- 6. Verification
-- ============================================================================
DO $$
DECLARE
  policy_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  -- Count total policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  -- Check for potential duplicates (same table, same role, same command)
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tablename, roles, cmd, COUNT(*) as cnt
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename, roles, cmd
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Total RLS policies: %', policy_count;
  
  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % potential duplicate policy groups (same table/role/command)', duplicate_count;
  ELSE
    RAISE NOTICE 'No duplicate policy groups detected';
  END IF;

  RAISE NOTICE 'Migration 017 completed successfully';
END $$;
