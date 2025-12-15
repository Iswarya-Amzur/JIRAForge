-- ============================================================================
-- Migration: 020_fix_unassigned_activity_schema.sql
-- Description: Fix trigger and constraint issues in unassigned activity system
-- Issues Fixed:
--   1. Fix auto_save_unassigned_activity trigger that was incorrectly rewritten
--      in 018_fix_security_warnings.sql to reference non-existent columns
--   2. Fix duplicate key constraint on unassigned_group_members
-- Date: 2024-12-08
-- ============================================================================

-- ============================================================================
-- PART 1: Fix the auto_save_unassigned_activity trigger
-- The trigger in 018_fix_security_warnings.sql incorrectly referenced columns
-- (activity_description, work_category, duration_seconds) that don't exist in
-- the analysis_results table. This restores the correct logic from the original
-- 002_unassigned_activity.sql migration, with organization_id support added.
-- ============================================================================

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
            NEW.organization_id,  -- organization_id from analysis_results (added in 011 migration)
            s.timestamp,
            s.window_title,        -- From screenshots table (via JOIN)
            s.application_name,    -- From screenshots table (via JOIN)
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
                'active_project_key', NEW.active_project_key,
                'work_type', NEW.work_type
            )
        FROM public.screenshots s
        WHERE s.id = NEW.screenshot_id
        ON CONFLICT (analysis_result_id) DO NOTHING; -- Prevent duplicates if trigger runs multiple times
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

COMMENT ON FUNCTION public.auto_save_unassigned_activity() IS
  'Automatically saves analysis results with no task_key to unassigned_activity table';


-- ============================================================================
-- PART 2: Fix duplicate key constraint for unassigned_group_members
-- The original constraint (unassigned_group_members_unassigned_activity_id_key)
-- only allows each activity to be in ONE group ever. This causes errors when
-- the clustering service runs multiple times.
--
-- Solution: Change to (group_id, unassigned_activity_id) unique constraint.
-- This allows an activity to be in multiple groups from different clustering
-- runs, but prevents duplicates within the same group.
-- ============================================================================

-- First, drop the old unique constraint if it exists
ALTER TABLE public.unassigned_group_members
  DROP CONSTRAINT IF EXISTS unassigned_group_members_unassigned_activity_id_key;

-- Add a new unique constraint on (group_id, unassigned_activity_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unassigned_group_members_group_activity_unique'
  ) THEN
    ALTER TABLE public.unassigned_group_members
      ADD CONSTRAINT unassigned_group_members_group_activity_unique
      UNIQUE (group_id, unassigned_activity_id);
  END IF;
END $$;


-- ============================================================================
-- PART 3: Verification
-- ============================================================================

DO $$
DECLARE
  trigger_exists BOOLEAN;
  constraint_exists BOOLEAN;
BEGIN
  -- Check trigger function exists with correct structure
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'auto_save_unassigned_activity'
  ) INTO trigger_exists;

  -- Check new constraint exists
  SELECT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unassigned_group_members_group_activity_unique'
  ) INTO constraint_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 020 Complete';
  RAISE NOTICE '========================================';

  IF trigger_exists THEN
    RAISE NOTICE 'SUCCESS: auto_save_unassigned_activity trigger updated';
  ELSE
    RAISE WARNING 'WARNING: trigger function not found';
  END IF;

  IF constraint_exists THEN
    RAISE NOTICE 'SUCCESS: unassigned_group_members constraint updated';
  ELSE
    RAISE WARNING 'WARNING: new constraint not found';
  END IF;
END $$;
