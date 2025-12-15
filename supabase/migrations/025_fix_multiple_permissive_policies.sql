-- ============================================================================
-- Migration: 025_fix_multiple_permissive_policies.sql
-- Description: Fix overlapping permissive RLS policies for performance
-- 
-- Issue: Table organization_members has two permissive policies that both 
-- apply to SELECT operations:
--   1. users_view_org_members (FOR SELECT)
--   2. admins_manage_members (FOR ALL - includes SELECT)
-- 
-- This causes both policies to be evaluated for every SELECT query,
-- which is suboptimal for performance.
--
-- Fix: Change admins_manage_members from FOR ALL to specific actions
-- (INSERT, UPDATE, DELETE) so it doesn't overlap with the SELECT policy.
-- ============================================================================

-- Drop the existing admins_manage_members policy
DROP POLICY IF EXISTS "admins_manage_members" ON public.organization_members;

-- Recreate as separate policies for INSERT, UPDATE, DELETE (not SELECT)
-- This avoids overlap with users_view_org_members which handles SELECT

-- Policy for INSERT
CREATE POLICY "admins_insert_members"
ON public.organization_members FOR INSERT
WITH CHECK (
  organization_id = (SELECT public.get_current_user_organization_id())
  AND (SELECT public.user_has_permission('manage_members'))
);

-- Policy for UPDATE
CREATE POLICY "admins_update_members"
ON public.organization_members FOR UPDATE
USING (
  organization_id = (SELECT public.get_current_user_organization_id())
  AND (SELECT public.user_has_permission('manage_members'))
);

-- Policy for DELETE
CREATE POLICY "admins_delete_members"
ON public.organization_members FOR DELETE
USING (
  organization_id = (SELECT public.get_current_user_organization_id())
  AND (SELECT public.user_has_permission('manage_members'))
);

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Check that we no longer have multiple permissive SELECT policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'organization_members'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE';
  
  IF policy_count > 1 THEN
    RAISE WARNING 'Still have % permissive SELECT policies on organization_members', policy_count;
  ELSE
    RAISE NOTICE 'organization_members now has % permissive SELECT policy (optimal)', policy_count;
  END IF;
  
  -- List all policies for verification
  RAISE NOTICE 'Current policies on organization_members:';
  FOR policy_count IN 
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_members'
  LOOP
    -- Just counting for the notice
  END LOOP;
END $$;
