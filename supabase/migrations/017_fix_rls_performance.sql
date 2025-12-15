-- ============================================================================
-- Migration: 017_fix_rls_performance.sql
-- Description: Fix RLS performance warnings from Supabase linter
-- Issues Fixed:
--   1. auth_rls_initplan: Wrap auth functions in subselect for performance
--   2. multiple_permissive_policies: Remove duplicate policies from 002_rls_policies.sql
-- Date: 2024-12-08
-- ============================================================================

-- ============================================================================
-- PART 1: Remove duplicate policies from 002_rls_policies.sql
-- These are superseded by the multi-tenancy policies in 013_create_rls_policies.sql
-- ============================================================================

-- Drop users table duplicate policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- Drop screenshots table duplicate policies
DROP POLICY IF EXISTS "Users can view own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can insert own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can update own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can delete own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Service role can manage all screenshots" ON public.screenshots;

-- Drop analysis_results table duplicate policies
DROP POLICY IF EXISTS "Users can view own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can insert own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can update own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Service role can manage all analysis results" ON public.analysis_results;

-- Drop documents table duplicate policies
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Service role can manage all documents" ON public.documents;

-- Drop worklogs table duplicate policies
DROP POLICY IF EXISTS "Users can view own worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Users can insert own worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Service role can manage all worklogs" ON public.worklogs;

-- Drop activity_log table duplicate policies
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Service role can manage all activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Allow system to insert activity logs" ON public.activity_log;

-- Drop user_jira_issues_cache table duplicate policies
DROP POLICY IF EXISTS "Users can view own cached issues" ON public.user_jira_issues_cache;
DROP POLICY IF EXISTS "Service role can manage all cached issues" ON public.user_jira_issues_cache;


-- ============================================================================
-- PART 2: Recreate helper functions with subselect optimization
-- Using (select auth.uid()) instead of auth.uid() for better performance
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


-- ============================================================================
-- PART 3: Drop and recreate multi-tenancy policies with optimized auth calls
-- ============================================================================

-- 3.1 Organizations table
-- ============================================================================
DROP POLICY IF EXISTS "users_view_own_organization" ON public.organizations;
CREATE POLICY "users_view_own_organization"
ON public.organizations FOR SELECT
USING (id = (SELECT get_current_user_organization_id()));

DROP POLICY IF EXISTS "admins_update_organization" ON public.organizations;
CREATE POLICY "admins_update_organization"
ON public.organizations FOR UPDATE
USING (
  id = (SELECT get_current_user_organization_id())
  AND (SELECT user_is_admin())
);


-- 3.2 Organization members table
-- ============================================================================
DROP POLICY IF EXISTS "users_view_org_members" ON public.organization_members;
CREATE POLICY "users_view_org_members"
ON public.organization_members FOR SELECT
USING (organization_id = (SELECT get_current_user_organization_id()));

DROP POLICY IF EXISTS "admins_manage_members" ON public.organization_members;
CREATE POLICY "admins_manage_members"
ON public.organization_members FOR ALL
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (SELECT user_has_permission('manage_members'))
);


-- 3.3 Organization settings table
-- ============================================================================
DROP POLICY IF EXISTS "users_view_org_settings" ON public.organization_settings;
CREATE POLICY "users_view_org_settings"
ON public.organization_settings FOR SELECT
USING (organization_id = (SELECT get_current_user_organization_id()));

DROP POLICY IF EXISTS "admins_update_org_settings" ON public.organization_settings;
CREATE POLICY "admins_update_org_settings"
ON public.organization_settings FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (SELECT user_has_permission('manage_settings'))
);


-- 3.4 Users table
-- ============================================================================
DROP POLICY IF EXISTS "users_view_self_or_team" ON public.users;
CREATE POLICY "users_view_self_or_team"
ON public.users FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "users_update_self" ON public.users;
CREATE POLICY "users_update_self"
ON public.users FOR UPDATE
USING (id = (SELECT get_current_user_id()));


-- 3.5 Screenshots table
-- ============================================================================
DROP POLICY IF EXISTS "screenshots_view_own_or_team" ON public.screenshots;
CREATE POLICY "screenshots_view_own_or_team"
ON public.screenshots FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "screenshots_insert_own" ON public.screenshots;
CREATE POLICY "screenshots_insert_own"
ON public.screenshots FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "screenshots_delete_own_or_admin" ON public.screenshots;
CREATE POLICY "screenshots_delete_own_or_admin"
ON public.screenshots FOR DELETE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('delete_screenshots'))
  )
);

-- Add UPDATE policy for screenshots (was missing in 013_create_rls_policies.sql)
DROP POLICY IF EXISTS "screenshots_update_own" ON public.screenshots;
CREATE POLICY "screenshots_update_own"
ON public.screenshots FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.6 Analysis results table
-- ============================================================================
DROP POLICY IF EXISTS "analysis_view_own_or_team" ON public.analysis_results;
CREATE POLICY "analysis_view_own_or_team"
ON public.analysis_results FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "analysis_insert_own" ON public.analysis_results;
CREATE POLICY "analysis_insert_own"
ON public.analysis_results FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "analysis_update_own" ON public.analysis_results;
CREATE POLICY "analysis_update_own"
ON public.analysis_results FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.7 Documents table
-- ============================================================================
DROP POLICY IF EXISTS "documents_view_own_or_team" ON public.documents;
CREATE POLICY "documents_view_own_or_team"
ON public.documents FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
CREATE POLICY "documents_insert_own"
ON public.documents FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "documents_update_own" ON public.documents;
CREATE POLICY "documents_update_own"
ON public.documents FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

-- Add DELETE policy for documents (was missing)
DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_delete_own"
ON public.documents FOR DELETE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.8 Worklogs table
-- ============================================================================
DROP POLICY IF EXISTS "worklogs_view_own_or_team" ON public.worklogs;
CREATE POLICY "worklogs_view_own_or_team"
ON public.worklogs FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "worklogs_insert_own" ON public.worklogs;
CREATE POLICY "worklogs_insert_own"
ON public.worklogs FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "worklogs_update_own" ON public.worklogs;
CREATE POLICY "worklogs_update_own"
ON public.worklogs FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.9 Activity log table
-- ============================================================================
DROP POLICY IF EXISTS "activity_view_own_or_team" ON public.activity_log;
CREATE POLICY "activity_view_own_or_team"
ON public.activity_log FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "activity_insert_own" ON public.activity_log;
CREATE POLICY "activity_insert_own"
ON public.activity_log FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.10 Unassigned activity table
-- ============================================================================
DROP POLICY IF EXISTS "unassigned_activity_view_own_or_team" ON public.unassigned_activity;
CREATE POLICY "unassigned_activity_view_own_or_team"
ON public.unassigned_activity FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "unassigned_activity_insert_own" ON public.unassigned_activity;
CREATE POLICY "unassigned_activity_insert_own"
ON public.unassigned_activity FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "unassigned_activity_update_own" ON public.unassigned_activity;
CREATE POLICY "unassigned_activity_update_own"
ON public.unassigned_activity FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.11 Unassigned work groups table
-- ============================================================================
DROP POLICY IF EXISTS "unassigned_groups_view_own_or_team" ON public.unassigned_work_groups;
CREATE POLICY "unassigned_groups_view_own_or_team"
ON public.unassigned_work_groups FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "unassigned_groups_insert_own" ON public.unassigned_work_groups;
CREATE POLICY "unassigned_groups_insert_own"
ON public.unassigned_work_groups FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "unassigned_groups_update_own" ON public.unassigned_work_groups;
CREATE POLICY "unassigned_groups_update_own"
ON public.unassigned_work_groups FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.12 User JIRA issues cache table
-- ============================================================================
DROP POLICY IF EXISTS "jira_cache_view_own_or_team" ON public.user_jira_issues_cache;
CREATE POLICY "jira_cache_view_own_or_team"
ON public.user_jira_issues_cache FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "jira_cache_insert_own" ON public.user_jira_issues_cache;
CREATE POLICY "jira_cache_insert_own"
ON public.user_jira_issues_cache FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);

DROP POLICY IF EXISTS "jira_cache_update_own" ON public.user_jira_issues_cache;
CREATE POLICY "jira_cache_update_own"
ON public.user_jira_issues_cache FOR UPDATE
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- 3.13 Created issues log table
-- ============================================================================
DROP POLICY IF EXISTS "created_issues_view_own_or_team" ON public.created_issues_log;
CREATE POLICY "created_issues_view_own_or_team"
ON public.created_issues_log FOR SELECT
USING (
  organization_id = (SELECT get_current_user_organization_id())
  AND (
    user_id = (SELECT get_current_user_id())
    OR (SELECT user_has_permission('view_team_analytics'))
  )
);

DROP POLICY IF EXISTS "created_issues_insert_own" ON public.created_issues_log;
CREATE POLICY "created_issues_insert_own"
ON public.created_issues_log FOR INSERT
WITH CHECK (
  organization_id = (SELECT get_current_user_organization_id())
  AND user_id = (SELECT get_current_user_id())
);


-- ============================================================================
-- PART 4: Add service role bypass policies
-- Service role should have full access for backend operations
-- Using a single policy per table with proper role check
-- ============================================================================

-- Note: Service role automatically bypasses RLS when using the service_role key
-- No explicit policies needed for service role access


-- ============================================================================
-- PART 5: Verification
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

  -- Check for multiple permissive policies on same table/role/action
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tablename, roles, cmd, COUNT(*) as cnt
    FROM pg_policies
    WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
    GROUP BY tablename, roles, cmd
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Policy Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total policies: %', policy_count;
  
  IF duplicate_count = 0 THEN
    RAISE NOTICE 'SUCCESS: No duplicate permissive policies found';
  ELSE
    RAISE WARNING 'WARNING: Found % table/role/action combinations with multiple policies', duplicate_count;
  END IF;
END $$;
