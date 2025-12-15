-- ============================================================================
-- Migration: 018_fix_security_warnings.sql
-- Description: Fix security warnings from Supabase linter
-- Issues Fixed:
--   1. function_search_path_mutable: Set search_path on all functions
--   2. security_definer_view: Change views to SECURITY INVOKER
--   3. rls_disabled_in_public: Enable RLS on unassigned_group_members
-- Date: 2024-12-08
-- ============================================================================

-- ============================================================================
-- PART 1: Fix function search_path warnings
-- Adding SET search_path = '' to prevent search path injection attacks
-- ============================================================================

-- Fix get_current_user_id
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM public.users
    WHERE supabase_user_id = (SELECT auth.uid())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Fix get_current_user_organization_id
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM public.users
    WHERE supabase_user_id = (SELECT auth.uid())
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix update_cached_at_column
CREATE OR REPLACE FUNCTION public.update_cached_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cached_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix set_webhook_url (preserving original signature with 2 parameters)
CREATE OR REPLACE FUNCTION public.set_webhook_url(webhook_type TEXT, url TEXT)
RETURNS VOID AS $$
BEGIN
    IF webhook_type = 'screenshot' THEN
        EXECUTE format('ALTER DATABASE %I SET app.screenshot_webhook_url = %L', current_database(), url);
    ELSIF webhook_type = 'document' THEN
        EXECUTE format('ALTER DATABASE %I SET app.document_webhook_url = %L', current_database(), url);
    ELSE
        RAISE EXCEPTION 'Invalid webhook type: %. Must be "screenshot" or "document"', webhook_type;
    END IF;

    RAISE NOTICE 'Webhook URL set for %. Reconnect to database for changes to take effect.', webhook_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Fix update_organizations_updated_at
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix update_unassigned_groups_updated_at
CREATE OR REPLACE FUNCTION public.update_unassigned_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix user_has_permission
CREATE OR REPLACE FUNCTION public.user_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_org_id UUID;
  user_id UUID;
  has_perm BOOLEAN;
BEGIN
  user_id := public.get_current_user_id();
  user_org_id := public.get_current_user_organization_id();

  IF user_id IS NULL OR user_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check based on permission type
  CASE permission_name
    WHEN 'view_team_analytics' THEN
      SELECT can_view_team_analytics INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_settings' THEN
      SELECT can_manage_settings INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_members' THEN
      SELECT can_manage_members INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'delete_screenshots' THEN
      SELECT can_delete_screenshots INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_billing' THEN
      SELECT can_manage_billing INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    ELSE
      RETURN false;
  END CASE;

  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Fix user_is_admin
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_user_org_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := public.get_current_user_id();
  v_user_org_id := public.get_current_user_organization_id();

  IF v_user_id IS NULL OR v_user_org_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_user_role
  FROM public.organization_members
  WHERE organization_members.user_id = v_user_id AND organization_id = v_user_org_id;

  RETURN v_user_role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = '';

-- Fix auto_save_unassigned_activity (preserving original logic)
CREATE OR REPLACE FUNCTION public.auto_save_unassigned_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if task_key is NULL or empty
    IF (NEW.active_task_key IS NULL OR NEW.active_task_key = '') THEN
        -- Insert into unassigned_activity table
        INSERT INTO public.unassigned_activity (
            analysis_result_id,
            screenshot_id,
            user_id,
            organization_id,
            timestamp,
            window_title,
            application_name,
            activity_description,
            work_category,
            confidence_score,
            duration_seconds
        )
        SELECT
            NEW.id,
            NEW.screenshot_id,
            NEW.user_id,
            COALESCE(NEW.organization_id, s.organization_id),
            NEW.created_at,
            NEW.window_title,
            NEW.application_name,
            NEW.activity_description,
            NEW.work_category,
            NEW.confidence_score,
            COALESCE(
                (SELECT EXTRACT(EPOCH FROM (
                    NEW.created_at - 
                    COALESCE(
                        (SELECT ar.created_at 
                         FROM public.analysis_results ar 
                         WHERE ar.user_id = NEW.user_id 
                         AND ar.created_at < NEW.created_at 
                         ORDER BY ar.created_at DESC 
                         LIMIT 1),
                        NEW.created_at
                    )
                ))::INTEGER),
                300
            )
        FROM public.screenshots s
        WHERE s.id = NEW.screenshot_id
        ON CONFLICT (analysis_result_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';


-- ============================================================================
-- PART 2: Fix SECURITY DEFINER views
-- Change views to use SECURITY INVOKER (default) to respect RLS
-- ============================================================================

-- Fix daily_time_summary view
ALTER VIEW public.daily_time_summary SET (security_invoker = on);

-- Fix monthly_time_summary view
ALTER VIEW public.monthly_time_summary SET (security_invoker = on);

-- Fix unassigned_activity_summary view
ALTER VIEW public.unassigned_activity_summary SET (security_invoker = on);

-- Fix team_work_type_analytics view
ALTER VIEW public.team_work_type_analytics SET (security_invoker = on);

-- Fix work_type_analytics view
ALTER VIEW public.work_type_analytics SET (security_invoker = on);

-- Fix project_time_summary view
ALTER VIEW public.project_time_summary SET (security_invoker = on);

-- Fix weekly_time_summary view
ALTER VIEW public.weekly_time_summary SET (security_invoker = on);

-- Fix team_analytics_summary view
ALTER VIEW public.team_analytics_summary SET (security_invoker = on);


-- ============================================================================
-- PART 3: Enable RLS on unassigned_group_members table
-- ============================================================================

ALTER TABLE public.unassigned_group_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for unassigned_group_members
-- Users can view group members for groups they own or in their org
CREATE POLICY "group_members_view_own_or_team"
ON public.unassigned_group_members FOR SELECT
USING (
  group_id IN (
    SELECT id FROM public.unassigned_work_groups
    WHERE organization_id = (SELECT public.get_current_user_organization_id())
    AND (
      user_id = (SELECT public.get_current_user_id())
      OR (SELECT public.user_has_permission('view_team_analytics'))
    )
  )
);

-- Users can insert group members for their own groups
CREATE POLICY "group_members_insert_own"
ON public.unassigned_group_members FOR INSERT
WITH CHECK (
  group_id IN (
    SELECT id FROM public.unassigned_work_groups
    WHERE organization_id = (SELECT public.get_current_user_organization_id())
    AND user_id = (SELECT public.get_current_user_id())
  )
);

-- Users can update group members for their own groups
CREATE POLICY "group_members_update_own"
ON public.unassigned_group_members FOR UPDATE
USING (
  group_id IN (
    SELECT id FROM public.unassigned_work_groups
    WHERE organization_id = (SELECT public.get_current_user_organization_id())
    AND user_id = (SELECT public.get_current_user_id())
  )
);

-- Users can delete group members for their own groups
CREATE POLICY "group_members_delete_own"
ON public.unassigned_group_members FOR DELETE
USING (
  group_id IN (
    SELECT id FROM public.unassigned_work_groups
    WHERE organization_id = (SELECT public.get_current_user_organization_id())
    AND user_id = (SELECT public.get_current_user_id())
  )
);


-- ============================================================================
-- PART 4: Verification
-- ============================================================================
DO $$
DECLARE
  func_count INTEGER;
  view_count INTEGER;
  rls_disabled_count INTEGER;
BEGIN
  -- Check functions with mutable search_path
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_current_user_id', 'get_current_user_organization_id',
      'update_updated_at_column', 'update_cached_at_column',
      'set_webhook_url', 'update_organizations_updated_at',
      'update_unassigned_groups_updated_at', 'user_has_permission',
      'user_is_admin', 'auto_save_unassigned_activity'
    )
    AND p.proconfig IS NULL;

  -- Check RLS disabled tables
  SELECT COUNT(*) INTO rls_disabled_count
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename = 'unassigned_group_members'
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = t.tablename
        AND n.nspname = t.schemaname
        AND c.relrowsecurity = true
    );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Security Migration Complete';
  RAISE NOTICE '========================================';
  
  IF func_count = 0 THEN
    RAISE NOTICE 'SUCCESS: All functions have search_path set';
  ELSE
    RAISE WARNING 'WARNING: % functions still have mutable search_path', func_count;
  END IF;

  IF rls_disabled_count = 0 THEN
    RAISE NOTICE 'SUCCESS: RLS enabled on unassigned_group_members';
  ELSE
    RAISE WARNING 'WARNING: RLS still disabled on unassigned_group_members';
  END IF;
END $$;
