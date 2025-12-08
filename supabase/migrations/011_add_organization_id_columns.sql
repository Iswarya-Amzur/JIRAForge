-- ============================================================================
-- Migration: 011_add_organization_id_columns.sql
-- Description: Add organization_id column to all data tables
-- Author: Multi-Tenancy Implementation
-- Date: 2024-12-04
-- ============================================================================

-- 1. Add organization_id to users table
-- ============================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_users_organization_id
  ON public.users(organization_id);

CREATE INDEX IF NOT EXISTS idx_users_org_active
  ON public.users(organization_id, is_active)
  WHERE is_active = true;

COMMENT ON COLUMN public.users.organization_id IS
  'Organization this user belongs to';


-- 2. Add organization_id to screenshots table
-- ============================================================================
ALTER TABLE public.screenshots
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_screenshots_org_id
  ON public.screenshots(organization_id);

CREATE INDEX IF NOT EXISTS idx_screenshots_org_user_date
  ON public.screenshots(organization_id, user_id, timestamp DESC);

COMMENT ON COLUMN public.screenshots.organization_id IS
  'Organization this screenshot belongs to';


-- 3. Add organization_id to analysis_results table
-- ============================================================================
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_results_org_id
  ON public.analysis_results(organization_id);

CREATE INDEX IF NOT EXISTS idx_analysis_results_org_work_type
  ON public.analysis_results(organization_id, work_type)
  WHERE work_type = 'office';

CREATE INDEX IF NOT EXISTS idx_analysis_results_org_user_date
  ON public.analysis_results(organization_id, user_id, created_at DESC);

COMMENT ON COLUMN public.analysis_results.organization_id IS
  'Organization this analysis belongs to';


-- 4. Add organization_id to documents table
-- ============================================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_org_id
  ON public.documents(organization_id);

CREATE INDEX IF NOT EXISTS idx_documents_org_status
  ON public.documents(organization_id, processing_status);

COMMENT ON COLUMN public.documents.organization_id IS
  'Organization this document belongs to';


-- 5. Add organization_id to worklogs table
-- ============================================================================
ALTER TABLE public.worklogs
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_worklogs_org_id
  ON public.worklogs(organization_id);

CREATE INDEX IF NOT EXISTS idx_worklogs_org_user
  ON public.worklogs(organization_id, user_id);

COMMENT ON COLUMN public.worklogs.organization_id IS
  'Organization this worklog belongs to';


-- 6. Add organization_id to activity_log table
-- ============================================================================
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_activity_log_org_id
  ON public.activity_log(organization_id);

COMMENT ON COLUMN public.activity_log.organization_id IS
  'Organization this activity belongs to';


-- 7. Add organization_id to unassigned_activity table
-- ============================================================================
ALTER TABLE public.unassigned_activity
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_org_id
  ON public.unassigned_activity(organization_id);

COMMENT ON COLUMN public.unassigned_activity.organization_id IS
  'Organization this unassigned activity belongs to';


-- 8. Add organization_id to unassigned_work_groups table
-- ============================================================================
ALTER TABLE public.unassigned_work_groups
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_unassigned_work_groups_org_id
  ON public.unassigned_work_groups(organization_id);

COMMENT ON COLUMN public.unassigned_work_groups.organization_id IS
  'Organization this work group belongs to';


-- 9. Add organization_id to user_jira_issues_cache table
-- ============================================================================
ALTER TABLE public.user_jira_issues_cache
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update unique constraint to include org_id
ALTER TABLE public.user_jira_issues_cache
  DROP CONSTRAINT IF EXISTS user_jira_issues_cache_user_id_issue_key_key;

ALTER TABLE public.user_jira_issues_cache
  ADD CONSTRAINT user_jira_issues_cache_user_org_issue_key
  UNIQUE (user_id, organization_id, issue_key);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_jira_issues_cache_org_id
  ON public.user_jira_issues_cache(organization_id);

COMMENT ON COLUMN public.user_jira_issues_cache.organization_id IS
  'Organization this cached issue belongs to';


-- 10. Add organization_id to created_issues_log table
-- ============================================================================
ALTER TABLE public.created_issues_log
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_created_issues_log_org_id
  ON public.created_issues_log(organization_id);

COMMENT ON COLUMN public.created_issues_log.organization_id IS
  'Organization this issue creation belongs to';


-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  tables_with_org_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_with_org_id
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'organization_id'
    AND table_name IN (
      'users', 'screenshots', 'analysis_results', 'documents',
      'worklogs', 'activity_log', 'unassigned_activity',
      'unassigned_work_groups', 'user_jira_issues_cache', 'created_issues_log'
    );

  RAISE NOTICE 'organization_id column added to % tables', tables_with_org_id;

  IF tables_with_org_id = 10 THEN
    RAISE NOTICE 'SUCCESS: All 10 tables updated with organization_id';
  ELSE
    RAISE WARNING 'Expected 10 tables, but only % have organization_id', tables_with_org_id;
  END IF;
END $$;
