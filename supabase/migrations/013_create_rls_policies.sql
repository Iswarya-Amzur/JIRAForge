-- ============================================================================
-- Migration: 013_create_rls_policies.sql
-- Description: Create Row Level Security policies for multi-tenancy
-- Author: Multi-Tenancy Implementation
-- Date: 2024-12-04
-- ============================================================================

-- 1. Create helper functions for RLS
-- ============================================================================

-- Get current user's ID
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.users
    WHERE supabase_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION get_current_user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM public.users
    WHERE supabase_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has specific permission
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin/owner
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Enable RLS on all tables
-- ============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unassigned_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unassigned_work_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jira_issues_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.created_issues_log ENABLE ROW LEVEL SECURITY;


-- 3. RLS Policies for organizations table
-- ============================================================================

-- Users can view their own organization
CREATE POLICY "users_view_own_organization"
ON public.organizations FOR SELECT
USING (id = get_current_user_organization_id());

-- Admins can update their organization
CREATE POLICY "admins_update_organization"
ON public.organizations FOR UPDATE
USING (
  id = get_current_user_organization_id()
  AND user_is_admin()
);


-- 4. RLS Policies for organization_members table
-- ============================================================================

-- Users can view members of their organization
CREATE POLICY "users_view_org_members"
ON public.organization_members FOR SELECT
USING (organization_id = get_current_user_organization_id());

-- Admins can manage members
CREATE POLICY "admins_manage_members"
ON public.organization_members FOR ALL
USING (
  organization_id = get_current_user_organization_id()
  AND user_has_permission('manage_members')
);


-- 5. RLS Policies for organization_settings table
-- ============================================================================

-- Users can view their organization's settings
CREATE POLICY "users_view_org_settings"
ON public.organization_settings FOR SELECT
USING (organization_id = get_current_user_organization_id());

-- Admins can update settings
CREATE POLICY "admins_update_org_settings"
ON public.organization_settings FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_has_permission('manage_settings')
);


-- 6. RLS Policies for users table
-- ============================================================================

-- Users can view themselves and team members (if admin)
CREATE POLICY "users_view_self_or_team"
ON public.users FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

-- Users can update themselves
CREATE POLICY "users_update_self"
ON public.users FOR UPDATE
USING (id = get_current_user_id());


-- 7. RLS Policies for screenshots table
-- ============================================================================

-- Users can view their own screenshots or team screenshots (if admin)
CREATE POLICY "screenshots_view_own_or_team"
ON public.screenshots FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

-- Users can insert their own screenshots
CREATE POLICY "screenshots_insert_own"
ON public.screenshots FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

-- Users can delete their own screenshots, admins can delete any
CREATE POLICY "screenshots_delete_own_or_admin"
ON public.screenshots FOR DELETE
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('delete_screenshots')
  )
);


-- 8. RLS Policies for analysis_results table
-- ============================================================================

-- Users can view their own analysis or team analysis (if admin)
CREATE POLICY "analysis_view_own_or_team"
ON public.analysis_results FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

-- Users can insert their own analysis
CREATE POLICY "analysis_insert_own"
ON public.analysis_results FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

-- Users can update their own analysis
CREATE POLICY "analysis_update_own"
ON public.analysis_results FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 9. RLS Policies for documents table
-- ============================================================================

CREATE POLICY "documents_view_own_or_team"
ON public.documents FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "documents_insert_own"
ON public.documents FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "documents_update_own"
ON public.documents FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 10. RLS Policies for worklogs table
-- ============================================================================

CREATE POLICY "worklogs_view_own_or_team"
ON public.worklogs FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "worklogs_insert_own"
ON public.worklogs FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "worklogs_update_own"
ON public.worklogs FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 11. RLS Policies for activity_log table
-- ============================================================================

CREATE POLICY "activity_view_own_or_team"
ON public.activity_log FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "activity_insert_own"
ON public.activity_log FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 12. RLS Policies for unassigned_activity table
-- ============================================================================

CREATE POLICY "unassigned_activity_view_own_or_team"
ON public.unassigned_activity FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "unassigned_activity_insert_own"
ON public.unassigned_activity FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "unassigned_activity_update_own"
ON public.unassigned_activity FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 13. RLS Policies for unassigned_work_groups table
-- ============================================================================

CREATE POLICY "unassigned_groups_view_own_or_team"
ON public.unassigned_work_groups FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "unassigned_groups_insert_own"
ON public.unassigned_work_groups FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "unassigned_groups_update_own"
ON public.unassigned_work_groups FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 14. RLS Policies for user_jira_issues_cache table
-- ============================================================================

CREATE POLICY "jira_cache_view_own_or_team"
ON public.user_jira_issues_cache FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "jira_cache_insert_own"
ON public.user_jira_issues_cache FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "jira_cache_update_own"
ON public.user_jira_issues_cache FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 15. RLS Policies for created_issues_log table
-- ============================================================================

CREATE POLICY "created_issues_view_own_or_team"
ON public.created_issues_log FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "created_issues_insert_own"
ON public.created_issues_log FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  rls_enabled_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Check RLS enabled
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
      'organizations', 'organization_members', 'organization_settings',
      'users', 'screenshots', 'analysis_results', 'documents',
      'worklogs', 'activity_log', 'unassigned_activity',
      'unassigned_work_groups', 'user_jira_issues_cache', 'created_issues_log'
    );

  -- Check policies created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE 'RLS enabled on % tables', rls_enabled_count;
  RAISE NOTICE 'Created % RLS policies', policy_count;

  IF rls_enabled_count = 13 THEN
    RAISE NOTICE 'SUCCESS: RLS enabled on all tables';
  ELSE
    RAISE WARNING 'Expected 13 tables with RLS, found %', rls_enabled_count;
  END IF;
END $$;
