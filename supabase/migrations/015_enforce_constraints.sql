-- ============================================================================
-- Migration: 015_enforce_constraints.sql
-- Description: Enforce NOT NULL constraints on organization_id columns
-- Author: Multi-Tenancy Implementation
-- Date: 2024-12-04
-- ============================================================================

-- IMPORTANT: Run this migration ONLY after verifying that all data has been
-- migrated and all rows have valid organization_id values.

-- Pre-enforcement verification
DO $$
DECLARE
  null_count INTEGER;
  table_name TEXT;
  total_nulls INTEGER := 0;
  can_proceed BOOLEAN := true;
BEGIN
  RAISE NOTICE 'Pre-enforcement verification starting...';

  -- Check all tables for NULL organization_id
  FOR table_name IN
    SELECT unnest(ARRAY[
      'users', 'screenshots', 'analysis_results', 'documents',
      'worklogs', 'activity_log', 'unassigned_activity',
      'unassigned_work_groups', 'user_jira_issues_cache', 'created_issues_log'
    ])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE organization_id IS NULL', table_name)
    INTO null_count;

    IF null_count > 0 THEN
      RAISE WARNING 'Table % has % rows with NULL organization_id', table_name, null_count;
      total_nulls := total_nulls + null_count;
      can_proceed := false;
    ELSE
      RAISE NOTICE 'Table % - OK (no NULL values)', table_name;
    END IF;
  END LOOP;

  IF NOT can_proceed THEN
    RAISE EXCEPTION 'Cannot proceed with constraint enforcement. Found % total rows with NULL organization_id. Please run migration 012 first.', total_nulls;
  END IF;

  RAISE NOTICE 'Pre-verification passed. All tables have organization_id populated.';
END $$;


-- Enforce NOT NULL constraints on all tables
-- ============================================================================

-- 1. users table
ALTER TABLE public.users
  ALTER COLUMN organization_id SET NOT NULL;

-- 2. screenshots table
ALTER TABLE public.screenshots
  ALTER COLUMN organization_id SET NOT NULL;

-- 3. analysis_results table
ALTER TABLE public.analysis_results
  ALTER COLUMN organization_id SET NOT NULL;

-- 4. documents table
ALTER TABLE public.documents
  ALTER COLUMN organization_id SET NOT NULL;

-- 5. worklogs table
ALTER TABLE public.worklogs
  ALTER COLUMN organization_id SET NOT NULL;

-- 6. activity_log table
ALTER TABLE public.activity_log
  ALTER COLUMN organization_id SET NOT NULL;

-- 7. unassigned_activity table
ALTER TABLE public.unassigned_activity
  ALTER COLUMN organization_id SET NOT NULL;

-- 8. unassigned_work_groups table
ALTER TABLE public.unassigned_work_groups
  ALTER COLUMN organization_id SET NOT NULL;

-- 9. user_jira_issues_cache table
ALTER TABLE public.user_jira_issues_cache
  ALTER COLUMN organization_id SET NOT NULL;

-- 10. created_issues_log table
ALTER TABLE public.created_issues_log
  ALTER COLUMN organization_id SET NOT NULL;


-- ============================================================================
-- Post-enforcement verification
-- ============================================================================
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  RAISE NOTICE 'Post-enforcement verification starting...';

  -- Count NOT NULL constraints on organization_id
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'organization_id'
    AND is_nullable = 'NO'
    AND table_name IN (
      'users', 'screenshots', 'analysis_results', 'documents',
      'worklogs', 'activity_log', 'unassigned_activity',
      'unassigned_work_groups', 'user_jira_issues_cache', 'created_issues_log'
    );

  RAISE NOTICE 'Found % tables with NOT NULL constraint on organization_id', constraint_count;

  IF constraint_count = 10 THEN
    RAISE NOTICE 'SUCCESS: All 10 tables have NOT NULL constraint enforced';
  ELSE
    RAISE WARNING 'Expected 10 tables with NOT NULL, found %', constraint_count;
  END IF;
END $$;


-- ============================================================================
-- Final verification - Test data isolation
-- ============================================================================
DO $$
DECLARE
  org_count INTEGER;
  user_count INTEGER;
  screenshot_count INTEGER;
BEGIN
  RAISE NOTICE 'Final verification starting...';

  -- Count organizations
  SELECT COUNT(*) INTO org_count FROM public.organizations;
  RAISE NOTICE 'Total organizations: %', org_count;

  -- Count users
  SELECT COUNT(*) INTO user_count FROM public.users;
  RAISE NOTICE 'Total users: %', user_count;

  -- Count screenshots
  SELECT COUNT(*) INTO screenshot_count FROM public.screenshots;
  RAISE NOTICE 'Total screenshots: %', screenshot_count;

  -- Verify all users belong to an organization
  SELECT COUNT(*) INTO user_count
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = u.organization_id
  );

  IF user_count > 0 THEN
    RAISE WARNING 'Found % users with invalid organization_id', user_count;
  ELSE
    RAISE NOTICE 'All users have valid organization references';
  END IF;

  RAISE NOTICE 'Multi-tenancy migration completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update desktop app to register organizations';
  RAISE NOTICE '2. Update Forge app to filter by organization_id';
  RAISE NOTICE '3. Update AI server to use organization settings';
  RAISE NOTICE '4. Test end-to-end flow';
  RAISE NOTICE '========================================';
END $$;
