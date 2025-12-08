-- ============================================================================
-- Migration: 010_create_organizations_tables.sql
-- Description: Create organizations, organization_members, and organization_settings tables
-- Author: Multi-Tenancy Implementation
-- Date: 2024-12-04
-- ============================================================================

-- 1. Create organizations table (Tenant Root)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key (One-to-One with organizations)
  organization_id UUID UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- AI Server configuration
  ai_server_url TEXT,
  ai_server_api_key TEXT,

  -- Screenshot settings
  screenshot_interval INTEGER DEFAULT 300,  -- seconds
  auto_worklog_enabled BOOLEAN DEFAULT true,

  -- Classification settings (for future whitelist/blacklist feature)
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


-- 4. Create trigger functions for updated_at
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


-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Organizations tables created successfully';
  RAISE NOTICE 'Tables: organizations, organization_members, organization_settings';
END $$;
