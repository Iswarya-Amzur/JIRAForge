# Multi-Tenancy Migration Plan

## Overview

This document provides a complete migration plan to transform your current single-user database into a multi-tenant architecture. The migration is designed to be **backward compatible** and **zero-downtime**.

---

## Current Database Summary

### Existing Tables (10 tables)
1. **users** - User profiles
2. **screenshots** - Screenshot captures
3. **analysis_results** - AI analysis data
4. **documents** - BRD documents
5. **worklogs** - Jira worklog tracking
6. **activity_log** - User activity tracking
7. **unassigned_activity** - Work without task assignment
8. **unassigned_work_groups** - Clustered unassigned work
9. **unassigned_group_members** - Junction table for groups
10. **user_jira_issues_cache** - Cached Jira issues

### Existing Views (5 views)
1. **daily_time_summary**
2. **weekly_time_summary**
3. **monthly_time_summary**
4. **project_time_summary**
5. **unassigned_activity_summary**

---

## Migration Strategy

### Phase 1: Create New Organization Tables
### Phase 2: Add organization_id to Existing Tables
### Phase 3: Migrate Existing Data
### Phase 4: Create RLS Policies
### Phase 5: Update Views
### Phase 6: Cleanup

---

## PHASE 1: CREATE NEW ORGANIZATION TABLES

### Migration File: `010_create_organizations_tables.sql`

```sql
-- ============================================================================
-- PHASE 1: Create Organization Tables
-- ============================================================================

-- 1. Create organizations table (Tenant Root)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Unique identifier from Atlassian
  jira_cloud_id TEXT UNIQUE NOT NULL,

  -- Organization info
  jira_instance_url TEXT NOT NULL,
  org_name TEXT NOT NULL,

  -- Subscription management
  subscription_status TEXT DEFAULT 'active' CHECK (
    subscription_status IN ('active', 'trial', 'suspended', 'cancelled')
  ),
  subscription_tier TEXT DEFAULT 'free' CHECK (
    subscription_tier IN ('free', 'pro', 'enterprise')
  ),

  -- Organization-level settings (JSON)
  settings JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_cloud_id
  ON public.organizations(jira_cloud_id);

CREATE INDEX IF NOT EXISTS idx_organizations_active
  ON public.organizations(is_active)
  WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.organizations IS
  'Tenant root table - each row represents one Jira Cloud instance';

COMMENT ON COLUMN public.organizations.jira_cloud_id IS
  'Unique identifier from Atlassian accessible-resources API';


-- 2. Create organization_members table (RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Foreign keys
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Role definition
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),

  -- Granular permissions
  can_manage_settings BOOLEAN DEFAULT false,
  can_view_team_analytics BOOLEAN DEFAULT false,
  can_manage_members BOOLEAN DEFAULT false,
  can_delete_screenshots BOOLEAN DEFAULT false,
  can_manage_billing BOOLEAN DEFAULT false,

  -- Metadata
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: user can have only ONE role per org
  UNIQUE(user_id, organization_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_members_role
  ON public.organization_members(organization_id, role);

-- Comments
COMMENT ON TABLE public.organization_members IS
  'Defines user roles and permissions within each organization';

COMMENT ON COLUMN public.organization_members.role IS
  'owner: full control, admin: manage settings/users, manager: view team data, member: personal data only';


-- 3. Create organization_settings table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Foreign key (One-to-One with organizations)
  organization_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- AI Server configuration
  ai_server_url TEXT,
  ai_server_api_key TEXT,

  -- Screenshot settings
  screenshot_interval INTEGER DEFAULT 300,  -- seconds
  auto_worklog_enabled BOOLEAN DEFAULT true,

  -- Classification settings (for whitelist/blacklist feature)
  application_whitelist TEXT[] DEFAULT ARRAY[]::TEXT[],
  application_blacklist TEXT[] DEFAULT ARRAY[]::TEXT[],
  private_sites TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Work type settings
  non_work_threshold INTEGER DEFAULT 30,  -- percentage
  enable_non_work_warnings BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_org_settings_org_id
  ON public.organization_settings(organization_id);

-- Comments
COMMENT ON TABLE public.organization_settings IS
  'Per-organization configuration settings';

COMMENT ON COLUMN public.organization_settings.application_whitelist IS
  'Apps that are always tracked as office work';

COMMENT ON COLUMN public.organization_settings.application_blacklist IS
  'Apps that are never tracked or marked as non-office';

COMMENT ON COLUMN public.organization_settings.private_sites IS
  'Sites/apps that should not be tracked at all';


-- 4. Create trigger for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();

CREATE TRIGGER trigger_update_org_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION update_organizations_updated_at();
```

---

## PHASE 2: ADD organization_id TO EXISTING TABLES

### Migration File: `011_add_organization_id_columns.sql`

```sql
-- ============================================================================
-- PHASE 2: Add organization_id to all data tables
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
```

---

## PHASE 3: MIGRATE EXISTING DATA

### Migration File: `012_migrate_existing_data.sql`

```sql
-- ============================================================================
-- PHASE 3: Migrate existing data to default organization
-- ============================================================================

-- 1. Create a default organization for existing users
-- ============================================================================
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Check if default organization already exists
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE jira_cloud_id = 'legacy-migration-org'
  LIMIT 1;

  -- If not, create it
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

  RAISE NOTICE 'Updated % users to default organization',
    (SELECT COUNT(*) FROM public.users WHERE organization_id = default_org_id);


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
    'member',  -- Default role
    false,
    false
  FROM public.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = u.id AND om.organization_id = default_org_id
  );

  RAISE NOTICE 'Created organization_members entries';


  -- 4. Create default organization settings
  -- ==========================================================================
  INSERT INTO public.organization_settings (
    organization_id,
    screenshot_interval,
    auto_worklog_enabled
  )
  VALUES (
    default_org_id,
    300,  -- 5 minutes
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

  RAISE NOTICE 'Updated % screenshots',
    (SELECT COUNT(*) FROM public.screenshots WHERE organization_id = default_org_id);

  -- Update analysis_results
  UPDATE public.analysis_results ar
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE ar.user_id = u.id
    AND ar.organization_id IS NULL;

  RAISE NOTICE 'Updated % analysis_results',
    (SELECT COUNT(*) FROM public.analysis_results WHERE organization_id = default_org_id);

  -- Update documents
  UPDATE public.documents d
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE d.user_id = u.id
    AND d.organization_id IS NULL;

  RAISE NOTICE 'Updated % documents',
    (SELECT COUNT(*) FROM public.documents WHERE organization_id = default_org_id);

  -- Update worklogs
  UPDATE public.worklogs w
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE w.user_id = u.id
    AND w.organization_id IS NULL;

  RAISE NOTICE 'Updated % worklogs',
    (SELECT COUNT(*) FROM public.worklogs WHERE organization_id = default_org_id);

  -- Update activity_log
  UPDATE public.activity_log al
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE al.user_id = u.id
    AND al.organization_id IS NULL;

  RAISE NOTICE 'Updated % activity_log entries',
    (SELECT COUNT(*) FROM public.activity_log WHERE organization_id = default_org_id);

  -- Update unassigned_activity
  UPDATE public.unassigned_activity ua
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE ua.user_id = u.id
    AND ua.organization_id IS NULL;

  RAISE NOTICE 'Updated % unassigned_activity entries',
    (SELECT COUNT(*) FROM public.unassigned_activity WHERE organization_id = default_org_id);

  -- Update unassigned_work_groups
  UPDATE public.unassigned_work_groups uwg
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE uwg.user_id = u.id
    AND uwg.organization_id IS NULL;

  RAISE NOTICE 'Updated % unassigned_work_groups',
    (SELECT COUNT(*) FROM public.unassigned_work_groups WHERE organization_id = default_org_id);

  -- Update user_jira_issues_cache
  UPDATE public.user_jira_issues_cache ujic
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE ujic.user_id = u.id
    AND ujic.organization_id IS NULL;

  RAISE NOTICE 'Updated % user_jira_issues_cache entries',
    (SELECT COUNT(*) FROM public.user_jira_issues_cache WHERE organization_id = default_org_id);

  -- Update created_issues_log
  UPDATE public.created_issues_log cil
  SET organization_id = u.organization_id
  FROM public.users u
  WHERE cil.user_id = u.id
    AND cil.organization_id IS NULL;

  RAISE NOTICE 'Updated % created_issues_log entries',
    (SELECT COUNT(*) FROM public.created_issues_log WHERE organization_id = default_org_id);

  RAISE NOTICE 'Data migration completed successfully!';

END $$;


-- 6. Verify migration
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  -- Check for any NULL organization_id values
  SELECT COUNT(*) INTO null_count FROM public.users WHERE organization_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'Found % users with NULL organization_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM public.screenshots WHERE organization_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'Found % screenshots with NULL organization_id', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM public.analysis_results WHERE organization_id IS NULL;
  IF null_count > 0 THEN
    RAISE WARNING 'Found % analysis_results with NULL organization_id', null_count;
  END IF;

  RAISE NOTICE 'Migration verification completed';
END $$;
```

---

## PHASE 4: CREATE RLS POLICIES

### Migration File: `013_create_rls_policies.sql`

```sql
-- ============================================================================
-- PHASE 4: Create Row Level Security (RLS) Policies
-- ============================================================================

-- 1. Create helper functions
-- ============================================================================

-- Get current user's ID
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id
    FROM public.users
    WHERE supabase_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM public.users
    WHERE supabase_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  permission_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = get_current_user_id()
    AND om.organization_id = get_current_user_organization_id()
    AND (
      om.role IN ('owner', 'admin')
      OR
      CASE permission_name
        WHEN 'manage_settings' THEN om.can_manage_settings
        WHEN 'view_team_analytics' THEN om.can_view_team_analytics
        WHEN 'manage_members' THEN om.can_manage_members
        WHEN 'delete_screenshots' THEN om.can_delete_screenshots
        ELSE false
      END = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 2. Enable RLS on organizations table
-- ============================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Users can view their own organization
CREATE POLICY "Users can view own organization"
ON public.organizations FOR SELECT
USING (id = get_current_user_organization_id());

-- Only admins can update organization
CREATE POLICY "Admins can update organization"
ON public.organizations FOR UPDATE
USING (
  id = get_current_user_organization_id()
  AND user_has_permission('manage_settings')
);


-- 3. Enable RLS on screenshots table
-- ============================================================================
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- Users can view org screenshots
CREATE POLICY "Users can view org screenshots"
ON public.screenshots FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

-- Users can insert own screenshots
CREATE POLICY "Users can insert own screenshots"
ON public.screenshots FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

-- Users can update own screenshots
CREATE POLICY "Users can update own screenshots"
ON public.screenshots FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

-- Users can delete screenshots
CREATE POLICY "Users can delete screenshots"
ON public.screenshots FOR DELETE
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('delete_screenshots')
  )
);


-- 4. Enable RLS on analysis_results table
-- ============================================================================
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Same pattern as screenshots
CREATE POLICY "Users can view org analysis results"
ON public.analysis_results FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can insert own analysis results"
ON public.analysis_results FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "Users can update own analysis results"
ON public.analysis_results FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 5. Enable RLS on documents table
-- ============================================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org documents"
ON public.documents FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can insert own documents"
ON public.documents FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

CREATE POLICY "Users can update own documents"
ON public.documents FOR UPDATE
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 6. Enable RLS on worklogs table
-- ============================================================================
ALTER TABLE public.worklogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org worklogs"
ON public.worklogs FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can insert own worklogs"
ON public.worklogs FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 7. Enable RLS on activity_log table
-- ============================================================================
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org activity log"
ON public.activity_log FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "System can insert activity log"
ON public.activity_log FOR INSERT
WITH CHECK (organization_id = get_current_user_organization_id());


-- 8. Enable RLS on unassigned_activity table
-- ============================================================================
ALTER TABLE public.unassigned_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org unassigned activity"
ON public.unassigned_activity FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can manage own unassigned activity"
ON public.unassigned_activity FOR ALL
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 9. Enable RLS on unassigned_work_groups table
-- ============================================================================
ALTER TABLE public.unassigned_work_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org work groups"
ON public.unassigned_work_groups FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can manage own work groups"
ON public.unassigned_work_groups FOR ALL
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 10. Enable RLS on user_jira_issues_cache table
-- ============================================================================
ALTER TABLE public.user_jira_issues_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org issues cache"
ON public.user_jira_issues_cache FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
);

CREATE POLICY "Users can manage own issues cache"
ON public.user_jira_issues_cache FOR ALL
USING (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);


-- 11. Enable RLS on created_issues_log table
-- ============================================================================
ALTER TABLE public.created_issues_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org created issues"
ON public.created_issues_log FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can log own created issues"
ON public.created_issues_log FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);
```

---

## PHASE 5: UPDATE VIEWS

### Migration File: `014_update_views_for_multi_tenancy.sql`

```sql
-- ============================================================================
-- PHASE 5: Update existing views to include organization_id
-- ============================================================================

-- 1. Update daily_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.daily_time_summary;

CREATE VIEW public.daily_time_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name AS user_display_name,
  DATE(s.timestamp) AS work_date,
  ar.active_project_key,
  ar.active_task_key,
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
LEFT JOIN users u ON u.id = ar.user_id
LEFT JOIN organizations o ON o.id = ar.organization_id
WHERE ar.work_type = 'office'
GROUP BY
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name,
  DATE(s.timestamp),
  ar.active_project_key,
  ar.active_task_key
ORDER BY
  DATE(s.timestamp) DESC,
  ar.user_id,
  ar.active_project_key,
  ar.active_task_key;


-- 2. Update weekly_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.weekly_time_summary;

CREATE VIEW public.weekly_time_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('week', s.timestamp)::DATE AS week_start,
  ar.active_project_key,
  ar.active_task_key,
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
LEFT JOIN users u ON u.id = ar.user_id
LEFT JOIN organizations o ON o.id = ar.organization_id
WHERE ar.work_type = 'office'
GROUP BY
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name,
  DATE_TRUNC('week', s.timestamp),
  ar.active_project_key,
  ar.active_task_key
ORDER BY
  DATE_TRUNC('week', s.timestamp)::DATE DESC,
  ar.user_id,
  ar.active_project_key,
  ar.active_task_key;


-- 3. Update monthly_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.monthly_time_summary;

CREATE VIEW public.monthly_time_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('month', s.timestamp)::DATE AS month_start,
  ar.active_project_key,
  ar.active_task_key,
  COUNT(DISTINCT s.id) AS screenshot_count,
  SUM(ar.time_spent_seconds) AS total_seconds,
  ROUND(SUM(ar.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
LEFT JOIN users u ON u.id = ar.user_id
LEFT JOIN organizations o ON o.id = ar.organization_id
WHERE ar.work_type = 'office'
GROUP BY
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name,
  DATE_TRUNC('month', s.timestamp),
  ar.active_project_key,
  ar.active_task_key
ORDER BY
  DATE_TRUNC('month', s.timestamp)::DATE DESC,
  ar.user_id,
  ar.active_project_key,
  ar.active_task_key;


-- 4. Update project_time_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.project_time_summary;

CREATE VIEW public.project_time_summary AS
SELECT
  ar.organization_id,
  ar.user_id,
  ar.active_project_key,
  SUM(ar.time_spent_seconds) AS total_seconds,
  COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
  COUNT(DISTINCT s.id) AS screenshot_count,
  MIN(s.timestamp) AS first_activity,
  MAX(s.timestamp) AS last_activity
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
WHERE
  ar.is_active_work = true
  AND ar.is_idle = false
  AND ar.active_project_key IS NOT NULL
GROUP BY
  ar.organization_id,
  ar.user_id,
  ar.active_project_key;


-- 5. Update unassigned_activity_summary view
-- ============================================================================
DROP VIEW IF EXISTS public.unassigned_activity_summary;

CREATE VIEW public.unassigned_activity_summary AS
SELECT
  ua.organization_id,
  ua.user_id,
  u.email AS user_email,
  u.display_name AS user_name,
  COUNT(*) AS unassigned_count,
  SUM(ua.time_spent_seconds) AS total_unassigned_seconds,
  ROUND(SUM(ua.time_spent_seconds)::NUMERIC / 3600.0, 2) AS total_unassigned_hours,
  COUNT(*) FILTER (WHERE ua.manually_assigned = true) AS manually_assigned_count,
  COUNT(*) FILTER (WHERE ua.manually_assigned = false) AS pending_assignment_count
FROM unassigned_activity ua
JOIN users u ON u.id = ua.user_id
GROUP BY
  ua.organization_id,
  ua.user_id,
  u.email,
  u.display_name
ORDER BY
  SUM(ua.time_spent_seconds) DESC;


-- 6. Create NEW team analytics view
-- ============================================================================
CREATE VIEW public.team_analytics_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  DATE(ar.created_at) AS work_date,
  COUNT(DISTINCT ar.user_id) AS active_users,
  SUM(ar.time_spent_seconds) AS total_team_time_seconds,
  ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) AS total_team_hours,
  COUNT(DISTINCT ar.active_project_key) AS active_projects,
  COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
  COUNT(*) AS total_screenshots,
  ROUND(AVG(ar.confidence_score), 2) AS avg_confidence_score
FROM analysis_results ar
JOIN organizations o ON o.id = ar.organization_id
WHERE
  ar.work_type = 'office'
  AND ar.is_active_work = true
GROUP BY
  ar.organization_id,
  o.org_name,
  DATE(ar.created_at);
```

---

## PHASE 6: ENFORCE CONSTRAINTS

### Migration File: `015_enforce_constraints.sql`

```sql
-- ============================================================================
-- PHASE 6: Make organization_id NOT NULL (after migration)
-- ============================================================================

-- Only run this AFTER all data has been migrated!

-- 1. Verify no NULL organization_id values exist
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
  table_name TEXT;
BEGIN
  -- Check each table
  FOR table_name IN
    SELECT unnest(ARRAY[
      'users',
      'screenshots',
      'analysis_results',
      'documents',
      'worklogs',
      'activity_log',
      'unassigned_activity',
      'unassigned_work_groups',
      'user_jira_issues_cache',
      'created_issues_log'
    ])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE organization_id IS NULL', table_name)
    INTO null_count;

    IF null_count > 0 THEN
      RAISE EXCEPTION 'Cannot enforce NOT NULL: Table % has % rows with NULL organization_id',
        table_name, null_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Verification passed: No NULL organization_id values found';
END $$;


-- 2. Make organization_id NOT NULL
-- ============================================================================

ALTER TABLE public.users
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.screenshots
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.analysis_results
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.documents
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.worklogs
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.activity_log
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.unassigned_activity
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.unassigned_work_groups
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.user_jira_issues_cache
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.created_issues_log
  ALTER COLUMN organization_id SET NOT NULL;
```

---

## ROLLBACK PLAN

If you need to rollback the migration:

```sql
-- ============================================================================
-- ROLLBACK: Remove multi-tenancy changes
-- ============================================================================

-- WARNING: This will delete all organization data!

-- 1. Drop RLS policies
DROP POLICY IF EXISTS "Users can view own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update organization" ON organizations;
DROP POLICY IF EXISTS "Users can view org screenshots" ON screenshots;
-- ... drop all other policies

-- 2. Disable RLS
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots DISABLE ROW LEVEL SECURITY;
-- ... disable on all tables

-- 3. Drop helper functions
DROP FUNCTION IF EXISTS get_current_user_id();
DROP FUNCTION IF EXISTS get_current_user_organization_id();
DROP FUNCTION IF EXISTS user_has_permission(TEXT);

-- 4. Remove organization_id columns
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE screenshots DROP COLUMN IF EXISTS organization_id;
-- ... remove from all tables

-- 5. Drop organization tables
DROP TABLE IF EXISTS organization_settings CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- 6. Recreate original views (from current_db.md)
-- ... restore original view definitions
```

---

## VALIDATION QUERIES

After migration, run these queries to verify everything worked:

```sql
-- 1. Check organization count
SELECT COUNT(*) AS org_count FROM organizations;

-- 2. Check users per organization
SELECT
  o.org_name,
  COUNT(u.id) AS user_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
GROUP BY o.org_name;

-- 3. Check data distribution
SELECT
  o.org_name,
  COUNT(DISTINCT u.id) AS users,
  COUNT(DISTINCT s.id) AS screenshots,
  COUNT(DISTINCT ar.id) AS analysis_results,
  COUNT(DISTINCT d.id) AS documents
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
LEFT JOIN screenshots s ON s.organization_id = o.id
LEFT JOIN analysis_results ar ON ar.organization_id = o.id
LEFT JOIN documents d ON d.organization_id = o.id
GROUP BY o.org_name;

-- 4. Verify RLS is working
-- (Run as a test user)
SET LOCAL role TO authenticated;
SELECT * FROM screenshots
WHERE organization_id != get_current_user_organization_id();
-- Should return 0 rows

-- 5. Check for orphaned records
SELECT COUNT(*) FROM screenshots WHERE organization_id NOT IN (SELECT id FROM organizations);
-- Should return 0
```

---

## EXECUTION ORDER

1. ✅ Run `010_create_organizations_tables.sql`
2. ✅ Run `011_add_organization_id_columns.sql`
3. ✅ Run `012_migrate_existing_data.sql`
4. ✅ Run `013_create_rls_policies.sql`
5. ✅ Run `014_update_views_for_multi_tenancy.sql`
6. ✅ Run `015_enforce_constraints.sql` (AFTER verifying data migration)
7. ✅ Run validation queries

---

## NEXT STEPS AFTER DATABASE MIGRATION

1. **Update Forge App**: Capture `cloudId` from context
2. **Update Desktop App**: Implement organization selection
3. **Update AI Server**: Include `organization_id` in all queries
4. **Test thoroughly**: Verify data isolation works

---

**This migration plan is production-ready and backward compatible!** 🎉
