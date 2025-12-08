-- ============================================================================
-- Migration: 012_migrate_existing_data.sql
-- Description: Migrate existing data to default organization
-- Author: Multi-Tenancy Implementation
-- Date: 2024-12-04
-- ============================================================================

DO $$
DECLARE
  default_org_id UUID;
  user_count INTEGER;
  screenshot_count INTEGER;
  analysis_count INTEGER;
BEGIN
  RAISE NOTICE 'Starting data migration...';

  -- 1. Create a default organization for existing users
  -- ==========================================================================
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE jira_cloud_id = 'legacy-migration-org'
  LIMIT 1;

  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (
      jira_cloud_id,
      org_name,
      jira_instance_url,
      subscription_status,
      subscription_tier
    ) VALUES (
      'legacy-migration-org',
      'Legacy Organization',
      'https://unknown.atlassian.net',
      'active',
      'free'
    )
    RETURNING id INTO default_org_id;

    RAISE NOTICE 'Created default organization with ID: %', default_org_id;
  ELSE
    RAISE NOTICE 'Default organization already exists with ID: %', default_org_id;
  END IF;


  -- 2. Assign all existing users to default organization
  -- ==========================================================================
  UPDATE public.users
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % users to default organization', user_count;


  -- 3. Create organization_members entries for existing users
  -- ==========================================================================
  INSERT INTO public.organization_members (
    user_id,
    organization_id,
    role,
    can_manage_settings,
    can_view_team_analytics
  )
  SELECT
    u.id,
    default_org_id,
    'member',
    false,
    false
  FROM public.users u
  WHERE u.organization_id = default_org_id
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = u.id AND om.organization_id = default_org_id
  );

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Created % organization_members entries', user_count;


  -- 4. Create default organization settings
  -- ==========================================================================
  INSERT INTO public.organization_settings (
    organization_id,
    screenshot_interval,
    auto_worklog_enabled
  )
  VALUES (
    default_org_id,
    300,
    true
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RAISE NOTICE 'Created organization settings';


  -- 5. Propagate organization_id to all data tables
  -- ==========================================================================

  -- Update screenshots
  UPDATE public.screenshots s
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE s.user_id = u.id
    AND s.organization_id IS NULL;

  GET DIAGNOSTICS screenshot_count = ROW_COUNT;
  RAISE NOTICE 'Updated % screenshots', screenshot_count;


  -- Update analysis_results
  UPDATE public.analysis_results ar
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE ar.user_id = u.id
    AND ar.organization_id IS NULL;

  GET DIAGNOSTICS analysis_count = ROW_COUNT;
  RAISE NOTICE 'Updated % analysis_results', analysis_count;


  -- Update documents
  UPDATE public.documents d
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE d.user_id = u.id
    AND d.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % documents', user_count;


  -- Update worklogs
  UPDATE public.worklogs w
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE w.user_id = u.id
    AND w.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % worklogs', user_count;


  -- Update activity_log
  UPDATE public.activity_log al
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE al.user_id = u.id
    AND al.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % activity_log entries', user_count;


  -- Update unassigned_activity
  UPDATE public.unassigned_activity ua
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE ua.user_id = u.id
    AND ua.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % unassigned_activity entries', user_count;


  -- Update unassigned_work_groups
  UPDATE public.unassigned_work_groups uwg
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE uwg.user_id = u.id
    AND uwg.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % unassigned_work_groups', user_count;


  -- Update user_jira_issues_cache
  UPDATE public.user_jira_issues_cache ujic
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE ujic.user_id = u.id
    AND ujic.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % user_jira_issues_cache entries', user_count;


  -- Update created_issues_log
  UPDATE public.created_issues_log cil
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE cil.user_id = u.id
    AND cil.organization_id IS NULL;

  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE 'Updated % created_issues_log entries', user_count;


  RAISE NOTICE 'Data migration completed successfully!';

END $$;


-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
  table_name TEXT;
  total_nulls INTEGER := 0;
BEGIN
  RAISE NOTICE 'Verifying migration...';

  FOR table_name IN
    SELECT unnest(ARRAY[
      'users', 'screenshots', 'analysis_results', 'documents',
      'worklogs', 'activity_log', 'unassigned_activity',
      'unassigned_work_groups', 'user_jira_issues_cache', 'created_issues_log'
    ])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE organization_id IS NULL', table_name)
    INTO null_count;

    IF null_count > 0 THEN
      RAISE WARNING 'Table % has % rows with NULL organization_id', table_name, null_count;
      total_nulls := total_nulls + null_count;
    END IF;
  END LOOP;

  IF total_nulls = 0 THEN
    RAISE NOTICE 'SUCCESS: All rows have organization_id assigned';
  ELSE
    RAISE WARNING 'Found % total rows with NULL organization_id across all tables', total_nulls;
  END IF;

  RAISE NOTICE 'Migration verification completed';
END $$;
