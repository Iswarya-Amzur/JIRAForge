-- ============================================================================
-- Migration: 016_fix_legacy_organization.sql
-- Description: Migrate data from legacy organization to the correct organization
-- Author: Multi-Tenancy Fix
-- Date: 2024-12-04
--
-- SITUATION:
-- - Legacy org was created by migration 012 with placeholder data
-- - Desktop app created new org with correct Jira Cloud ID
-- - Existing data is linked to legacy org, needs to be moved to correct org
-- ============================================================================

-- Step 1: Disable user-defined triggers that might interfere with migration
-- (Cannot disable system triggers in Supabase, so we target specific trigger)
ALTER TABLE public.analysis_results DISABLE TRIGGER trigger_auto_save_unassigned;

DO $$
DECLARE
  legacy_org_id UUID := '9f1063f4-b68d-4239-8948-c4e226f1f398';  -- Legacy org from migration 012
  correct_org_id UUID := '29a10bbb-964f-4492-b040-77c624070887';  -- Correct org from desktop app
  row_count INTEGER;
BEGIN
  -- Check if legacy org exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = legacy_org_id) THEN
    RAISE NOTICE 'Legacy organization not found. Migration may have already been applied.';
    RETURN;
  END IF;

  RAISE NOTICE 'Migrating data from legacy org % to correct org %', legacy_org_id, correct_org_id;

  -- 1. Update users
  UPDATE public.users
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % users', row_count;

  -- 2. Update screenshots
  UPDATE public.screenshots
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % screenshots', row_count;

  -- 3. Update analysis_results
  UPDATE public.analysis_results
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % analysis_results', row_count;

  -- 4. Update documents
  UPDATE public.documents
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % documents', row_count;

  -- 5. Update worklogs
  UPDATE public.worklogs
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % worklogs', row_count;

  -- 6. Update activity_log
  UPDATE public.activity_log
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % activity_log entries', row_count;

  -- 7. Update unassigned_activity
  UPDATE public.unassigned_activity
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % unassigned_activity entries', row_count;

  -- 8. Update unassigned_work_groups
  UPDATE public.unassigned_work_groups
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % unassigned_work_groups', row_count;

  -- 9. Update user_jira_issues_cache
  UPDATE public.user_jira_issues_cache
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % user_jira_issues_cache entries', row_count;

  -- 10. Update created_issues_log
  UPDATE public.created_issues_log
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % created_issues_log entries', row_count;

  -- 11. Update organization_members - move members to correct org
  -- First delete any existing membership in correct org (to avoid duplicates)
  DELETE FROM public.organization_members
  WHERE organization_id = correct_org_id
  AND user_id IN (SELECT user_id FROM public.organization_members WHERE organization_id = legacy_org_id);

  -- Then update legacy memberships to point to correct org
  UPDATE public.organization_members
  SET organization_id = correct_org_id
  WHERE organization_id = legacy_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE 'Updated % organization_members', row_count;

  -- 12. Delete legacy organization settings
  DELETE FROM public.organization_settings
  WHERE organization_id = legacy_org_id;
  RAISE NOTICE 'Deleted legacy organization settings';

  -- 13. Delete legacy organization
  DELETE FROM public.organizations
  WHERE id = legacy_org_id;
  RAISE NOTICE 'Deleted legacy organization';

  RAISE NOTICE 'Migration completed successfully!';
END $$;

-- Step 2: Re-enable the trigger
ALTER TABLE public.analysis_results ENABLE TRIGGER trigger_auto_save_unassigned;

-- Step 3: Fix the auto_save_unassigned_activity trigger to include organization_id
CREATE OR REPLACE FUNCTION auto_save_unassigned_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if task_key is NULL or empty
    IF (NEW.active_task_key IS NULL OR NEW.active_task_key = '') THEN
        -- Insert into unassigned_activity table
        INSERT INTO public.unassigned_activity (
            analysis_result_id,
            screenshot_id,
            user_id,
            organization_id,  -- Added for multi-tenancy
            timestamp,
            window_title,
            application_name,
            extracted_text,
            detected_jira_keys,
            confidence_score,
            time_spent_seconds,
            reason,
            metadata
        )
        SELECT
            NEW.id,
            NEW.screenshot_id,
            NEW.user_id,
            NEW.organization_id,  -- Get organization_id from analysis_results
            s.timestamp,
            s.window_title,
            s.application_name,
            NEW.extracted_text,
            NEW.detected_jira_keys,
            NEW.confidence_score,
            NEW.time_spent_seconds,
            CASE
                WHEN NEW.active_task_key IS NULL THEN 'no_task_key'
                WHEN NEW.active_task_key = '' THEN 'no_task_key'
                ELSE 'invalid_task_key'
            END,
            jsonb_build_object(
                'is_active_work', NEW.is_active_work,
                'is_idle', NEW.is_idle,
                'ai_model_version', NEW.ai_model_version,
                'active_project_key', NEW.active_project_key
            )
        FROM public.screenshots s
        WHERE s.id = NEW.screenshot_id
        ON CONFLICT (analysis_result_id) DO NOTHING; -- Prevent duplicates if trigger runs multiple times
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_save_unassigned_activity() IS 'Automatically saves analysis results with no task_key to unassigned_activity table (updated for multi-tenancy)';

-- Verify the results
SELECT 'organizations' as table_name, COUNT(*) as count FROM public.organizations
UNION ALL
SELECT 'users in correct org', COUNT(*) FROM public.users WHERE organization_id = '29a10bbb-964f-4492-b040-77c624070887'
UNION ALL
SELECT 'users in legacy org', COUNT(*) FROM public.users WHERE organization_id = '9f1063f4-b68d-4239-8948-c4e226f1f398'
UNION ALL
SELECT 'screenshots in correct org', COUNT(*) FROM public.screenshots WHERE organization_id = '29a10bbb-964f-4492-b040-77c624070887'
UNION ALL
SELECT 'screenshots in legacy org', COUNT(*) FROM public.screenshots WHERE organization_id = '9f1063f4-b68d-4239-8948-c4e226f1f398'
UNION ALL
SELECT 'analysis_results in correct org', COUNT(*) FROM public.analysis_results WHERE organization_id = '29a10bbb-964f-4492-b040-77c624070887'
UNION ALL
SELECT 'analysis_results in legacy org', COUNT(*) FROM public.analysis_results WHERE organization_id = '9f1063f4-b68d-4239-8948-c4e226f1f398';

-- Show all users and their organizations
SELECT u.id, u.email, u.display_name, u.organization_id, o.org_name, o.jira_instance_url
FROM public.users u
LEFT JOIN public.organizations o ON u.organization_id = o.id;

-- Show the organization details
SELECT id, jira_cloud_id, org_name, jira_instance_url, subscription_status, created_at
FROM public.organizations;
