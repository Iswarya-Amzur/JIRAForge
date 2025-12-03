# Multi-Tenancy Database Architecture

## Overview

This document describes the complete database architecture for implementing multi-tenancy in the BRD Time Tracker application. The tenant boundary is defined as a **Jira Cloud Instance** (identified by `jira_cloud_id`).

---

## Core Principle

**Every data table must have an `organization_id` column to ensure complete data isolation between tenants.**

---

## 1. ENTITY RELATIONSHIP DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANT ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐
│         organizations                │  ◄─── TENANT ROOT ENTITY
├──────────────────────────────────────┤
│ PK  id (UUID)                        │
│ UK  jira_cloud_id (TEXT)             │  ◄─── Unique Jira Cloud Instance ID
│     jira_instance_url (TEXT)         │       e.g., "acme-corp.atlassian.net"
│     org_name (TEXT)                  │       e.g., "Acme Corporation"
│     subscription_status (TEXT)       │       'active', 'suspended', 'cancelled'
│     subscription_tier (TEXT)         │       'free', 'pro', 'enterprise'
│     settings (JSONB)                 │       Org-specific configurations
│     created_at (TIMESTAMPTZ)         │
│     updated_at (TIMESTAMPTZ)         │
│     is_active (BOOLEAN)              │
└──────────────────┬───────────────────┘
                   │
                   │ 1:N (One org has many users)
                   │
                   ▼
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│              users                   │         │      organization_members            │
├──────────────────────────────────────┤         ├──────────────────────────────────────┤
│ PK  id (UUID)                        │◄────┐   │ PK  id (UUID)                        │
│ UK  atlassian_account_id (TEXT)      │     │   │ FK  user_id (UUID)                   │
│ FK  supabase_user_id (UUID)          │     └───│ FK  organization_id (UUID)           │
│ FK  organization_id (UUID) ───────┐  │         │     role (TEXT)                      │
│     email (TEXT)                  │  │         │       - 'owner'                      │
│     display_name (TEXT)           │  │         │       - 'admin'                      │
│     settings (JSONB)              │  │         │       - 'manager'                    │
│     is_active (BOOLEAN)           │  │         │       - 'member'                     │
│     created_at (TIMESTAMPTZ)      │  │         │     can_manage_settings (BOOLEAN)    │
│     updated_at (TIMESTAMPTZ)      │  │         │     can_view_team_analytics (BOOL)   │
│     last_sync_at (TIMESTAMPTZ)    │  │         │     can_manage_members (BOOLEAN)     │
└───────────────────────────────────┘  │         │     can_delete_screenshots (BOOL)    │
                   │                   │         │     joined_at (TIMESTAMPTZ)          │
                   │                   │         │ UNIQUE(user_id, organization_id)     │
                   │                   │         └──────────────────────────────────────┘
                   │                   │
                   │ 1:N               │                  ┌─────────────────────────────┐
                   │                   │                  │  organization_settings      │
                   │                   │                  ├─────────────────────────────┤
                   │                   │                  │ PK  id (UUID)               │
                   │                   └──────────────────┤ FK  organization_id (UUID)  │
                   │                                      │ UK  (organization_id)       │
                   │                                      │     ai_server_url (TEXT)    │
                   ▼                                      │     ai_server_api_key (TXT) │
┌──────────────────────────────────────┐                  │     screenshot_interval (INT)│
│          screenshots                 │                  │     auto_worklog_enabled    │
├──────────────────────────────────────┤                  │     application_whitelist[] │
│ PK  id (UUID)                        │                  │     application_blacklist[] │
│ FK  user_id (UUID)                   │                  │     private_sites[]         │
│ FK  organization_id (UUID) ──────────┼──────────┐       │     non_work_threshold (INT)│
│     timestamp (TIMESTAMPTZ)          │          │       │     created_at (TIMESTAMPTZ)│
│     storage_path (TEXT)              │          │       │     updated_at (TIMESTAMPTZ)│
│     window_title (TEXT)              │          │       └─────────────────────────────┘
│     application_name (TEXT)          │          │
│     status (TEXT)                    │          │
│       - 'pending'                    │          │
│       - 'processing'                 │          │
│       - 'analyzed'                   │          │
│       - 'failed'                     │          │
│       - 'deleted'                    │          │
│     metadata (JSONB)                 │          │
│     created_at (TIMESTAMPTZ)         │          │
└──────────────────┬───────────────────┘          │
                   │                              │
                   │ 1:1                          │
                   │                              │
                   ▼                              │
┌──────────────────────────────────────┐          │
│        analysis_results              │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  screenshot_id (UUID)             │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┤
│     active_task_key (TEXT)           │          │
│     active_project_key (TEXT)        │          │
│     confidence_score (DECIMAL)       │          │
│     work_type (TEXT)                 │          │
│       - 'office'                     │          │
│       - 'non-office'                 │          │
│       - 'private'                    │          │
│     detected_jira_keys (TEXT[])      │          │
│     is_active_work (BOOLEAN)         │          │
│     time_spent_seconds (INTEGER)     │          │
│     analysis_metadata (JSONB)        │          │
│     created_at (TIMESTAMPTZ)         │          │
└──────────────────┬───────────────────┘          │
                   │                              │
                   │ 1:0..1 (Optional)            │
                   │                              │
                   ▼                              │
┌──────────────────────────────────────┐          │
│       unassigned_activity            │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  analysis_result_id (UUID)        │          │
│ FK  screenshot_id (UUID)             │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┤
│     reason (TEXT)                    │          │
│       - 'no_task_key'                │          │
│       - 'invalid_task_key'           │          │
│       - 'low_confidence'             │          │
│       - 'manual_override'            │          │
│     manually_assigned (BOOLEAN)      │          │
│     assigned_task_key (TEXT)         │          │
│     created_at (TIMESTAMPTZ)         │          │
└──────────────────────────────────────┘          │
                                                  │
┌──────────────────────────────────────┐          │
│    unassigned_work_groups            │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┤
│     group_label (TEXT)               │          │
│     description (TEXT)               │          │
│     confidence (TEXT)                │          │
│       - 'high', 'medium', 'low'      │          │
│     session_indices (INTEGER[])      │          │
│     recommendation (JSONB)           │          │
│     created_at (TIMESTAMPTZ)         │          │
└──────────────────────────────────────┘          │
                                                  │
┌──────────────────────────────────────┐          │
│           documents                  │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┤
│     file_name (TEXT)                 │          │
│     file_type (TEXT)                 │          │
│       - 'pdf', 'docx', 'doc'         │          │
│     storage_path (TEXT)              │          │
│     processing_status (TEXT)         │          │
│       - 'uploaded'                   │          │
│       - 'extracting'                 │          │
│       - 'analyzing'                  │          │
│       - 'completed'                  │          │
│       - 'failed'                     │          │
│     extracted_text (TEXT)            │          │
│     parsed_requirements (JSONB)      │          │
│     project_key (TEXT)               │          │
│     created_issues (JSONB)           │          │
│     created_at (TIMESTAMPTZ)         │          │
└──────────────────────────────────────┘          │
                                                  │
┌──────────────────────────────────────┐          │
│            worklogs                  │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┤
│ FK  analysis_result_id (UUID)        │          │
│ UK  jira_worklog_id (TEXT)           │          │
│     jira_issue_key (TEXT)            │          │
│     time_spent_seconds (INTEGER)     │          │
│     started_at (TIMESTAMPTZ)         │          │
│     sync_status (TEXT)               │          │
│       - 'synced', 'pending', 'failed'│          │
│     created_at (TIMESTAMPTZ)         │          │
└──────────────────────────────────────┘          │
                                                  │
┌──────────────────────────────────────┐          │
│      user_jira_issues_cache          │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┤
│ UK  (user_id, issue_key, org_id)     │          │
│     issue_key (TEXT)                 │          │
│     summary (TEXT)                   │          │
│     status (TEXT)                    │          │
│     priority (TEXT)                  │          │
│     issue_type (TEXT)                │          │
│     project_key (TEXT)               │          │
│     updated (TIMESTAMPTZ)            │          │
└──────────────────────────────────────┘          │
                                                  │
┌──────────────────────────────────────┐          │
│       created_issues_log             │          │
├──────────────────────────────────────┤          │
│ PK  id (UUID)                        │          │
│ FK  user_id (UUID)                   │          │
│ FK  organization_id (UUID) ──────────┼──────────┘
│ FK  document_id (UUID)               │
│     jira_issue_key (TEXT)            │
│     issue_type (TEXT)                │
│     summary (TEXT)                   │
│     created_at (TIMESTAMPTZ)         │
└──────────────────────────────────────┘
```

---

## 2. TABLE DEFINITIONS WITH SQL

### **2.1 Organizations Table (Tenant Root)**

```sql
CREATE TABLE organizations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unique Tenant Identifier (from Atlassian)
  jira_cloud_id TEXT UNIQUE NOT NULL,

  -- Organization Info
  jira_instance_url TEXT NOT NULL,  -- e.g., "https://acme-corp.atlassian.net"
  org_name TEXT NOT NULL,            -- e.g., "Acme Corporation"

  -- Subscription Management
  subscription_status TEXT DEFAULT 'active' CHECK (
    subscription_status IN ('active', 'suspended', 'cancelled', 'trial')
  ),
  subscription_tier TEXT DEFAULT 'free' CHECK (
    subscription_tier IN ('free', 'pro', 'enterprise')
  ),

  -- Organization-level Settings (stored as JSON)
  settings JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_organizations_cloud_id ON organizations(jira_cloud_id);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE organizations IS 'Tenant root table - each row represents one Jira Cloud instance';
COMMENT ON COLUMN organizations.jira_cloud_id IS 'Unique identifier from Atlassian accessible-resources API';
```

---

### **2.2 Users Table (Updated)**

```sql
-- Add organization_id to existing users table
ALTER TABLE users
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Make it required after migration
ALTER TABLE users
  ADD CONSTRAINT users_must_have_org CHECK (organization_id IS NOT NULL);

-- Updated users table structure
CREATE TABLE users (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to Organization (TENANT)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Atlassian Identity
  atlassian_account_id TEXT UNIQUE NOT NULL,

  -- Supabase Auth Link
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User Info
  email TEXT,
  display_name TEXT,

  -- User-specific Settings
  settings JSONB DEFAULT '{}'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_atlassian_account_id ON users(atlassian_account_id);
CREATE INDEX idx_users_supabase_user_id ON users(supabase_user_id);

-- Composite index for common queries
CREATE INDEX idx_users_org_active ON users(organization_id, is_active)
  WHERE is_active = true;
```

---

### **2.3 Organization Members (RBAC)**

```sql
CREATE TABLE organization_members (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Role Definition
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member')),

  -- Granular Permissions
  can_manage_settings BOOLEAN DEFAULT false,
  can_view_team_analytics BOOLEAN DEFAULT false,
  can_manage_members BOOLEAN DEFAULT false,
  can_delete_screenshots BOOLEAN DEFAULT false,
  can_manage_billing BOOLEAN DEFAULT false,

  -- Metadata
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique Constraint: User can have only ONE role per org
  UNIQUE(user_id, organization_id)
);

-- Indexes
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

-- Comments
COMMENT ON TABLE organization_members IS 'Defines user roles and permissions within each organization';
COMMENT ON COLUMN organization_members.role IS 'owner: full control, admin: manage settings/users, manager: view team data, member: personal data only';
```

---

### **2.4 Organization Settings**

```sql
CREATE TABLE organization_settings (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Key (One-to-One with organizations)
  organization_id UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- AI Server Configuration
  ai_server_url TEXT,
  ai_server_api_key TEXT,

  -- Screenshot Settings
  screenshot_interval INTEGER DEFAULT 300,  -- seconds
  auto_worklog_enabled BOOLEAN DEFAULT true,

  -- Classification Settings (for whitelist/blacklist feature)
  application_whitelist TEXT[] DEFAULT ARRAY[]::TEXT[],
  application_blacklist TEXT[] DEFAULT ARRAY[]::TEXT[],
  private_sites TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Work Type Settings
  non_work_threshold INTEGER DEFAULT 30,  -- percentage
  enable_non_work_warnings BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_org_settings_org_id ON organization_settings(organization_id);

-- Comments
COMMENT ON TABLE organization_settings IS 'Per-organization configuration settings';
COMMENT ON COLUMN organization_settings.application_whitelist IS 'Apps that are always tracked as office work';
COMMENT ON COLUMN organization_settings.application_blacklist IS 'Apps that are never tracked or marked as non-office';
COMMENT ON COLUMN organization_settings.private_sites IS 'Sites/apps that should not be tracked at all';
```

---

### **2.5 Updated Data Tables (Add organization_id)**

#### **Screenshots Table**

```sql
-- Add organization_id to screenshots
ALTER TABLE screenshots
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_screenshots_org_id ON screenshots(organization_id);

-- Composite index for common queries
CREATE INDEX idx_screenshots_org_user_date ON screenshots(
  organization_id,
  user_id,
  timestamp DESC
);
```

#### **Analysis Results Table**

```sql
-- Add organization_id to analysis_results
ALTER TABLE analysis_results
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_analysis_results_org_id ON analysis_results(organization_id);
CREATE INDEX idx_analysis_results_org_work_type ON analysis_results(
  organization_id,
  work_type
) WHERE work_type = 'office';

-- Composite index for analytics
CREATE INDEX idx_analysis_results_org_user_date ON analysis_results(
  organization_id,
  user_id,
  created_at DESC
);
```

#### **Documents Table**

```sql
-- Add organization_id to documents
ALTER TABLE documents
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_documents_org_id ON documents(organization_id);
CREATE INDEX idx_documents_org_status ON documents(organization_id, processing_status);
```

#### **Worklogs Table**

```sql
-- Add organization_id to worklogs
ALTER TABLE worklogs
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_worklogs_org_id ON worklogs(organization_id);
CREATE INDEX idx_worklogs_org_user ON worklogs(organization_id, user_id);
```

#### **Unassigned Activity Table**

```sql
-- Add organization_id to unassigned_activity
ALTER TABLE unassigned_activity
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_unassigned_activity_org_id ON unassigned_activity(organization_id);
```

#### **Unassigned Work Groups Table**

```sql
-- Add organization_id to unassigned_work_groups
ALTER TABLE unassigned_work_groups
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_unassigned_work_groups_org_id ON unassigned_work_groups(organization_id);
```

#### **User Jira Issues Cache Table**

```sql
-- Add organization_id to user_jira_issues_cache
ALTER TABLE user_jira_issues_cache
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update unique constraint to include org_id
ALTER TABLE user_jira_issues_cache
  DROP CONSTRAINT IF EXISTS user_jira_issues_cache_user_id_issue_key_key;

ALTER TABLE user_jira_issues_cache
  ADD CONSTRAINT user_jira_issues_cache_user_org_issue_key
  UNIQUE (user_id, organization_id, issue_key);

-- Create index
CREATE INDEX idx_user_jira_issues_cache_org_id ON user_jira_issues_cache(organization_id);
```

#### **Created Issues Log Table**

```sql
-- Add organization_id to created_issues_log
ALTER TABLE created_issues_log
  ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX idx_created_issues_log_org_id ON created_issues_log(organization_id);
```

---

## 3. ROW LEVEL SECURITY (RLS) POLICIES

### **3.1 Helper Functions**

```sql
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
    FROM organization_members om
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
```

---

### **3.2 RLS Policies for Key Tables**

#### **Organizations Table**

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can view their own organization
CREATE POLICY "Users can view own organization"
ON organizations FOR SELECT
USING (
  id = get_current_user_organization_id()
);

-- Only owners/admins can update organization
CREATE POLICY "Admins can update organization"
ON organizations FOR UPDATE
USING (
  id = get_current_user_organization_id()
  AND user_has_permission('manage_settings')
);
```

---

#### **Screenshots Table**

```sql
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

-- Users can view own screenshots OR team screenshots if admin
CREATE POLICY "Users can view org screenshots"
ON screenshots FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    -- Can see own screenshots
    user_id = get_current_user_id()
    OR
    -- Can see all org screenshots if has permission
    user_has_permission('view_team_analytics')
  )
);

-- Users can insert own screenshots
CREATE POLICY "Users can insert own screenshots"
ON screenshots FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);

-- Users can delete own screenshots OR admins can delete any
CREATE POLICY "Users can delete screenshots"
ON screenshots FOR DELETE
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('delete_screenshots')
  )
);
```

---

#### **Analysis Results Table**

```sql
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Same pattern as screenshots
CREATE POLICY "Users can view org analysis results"
ON analysis_results FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can insert own analysis results"
ON analysis_results FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);
```

---

#### **Documents Table**

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org documents"
ON documents FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can insert own documents"
ON documents FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);
```

---

#### **Worklogs Table**

```sql
ALTER TABLE worklogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org worklogs"
ON worklogs FOR SELECT
USING (
  organization_id = get_current_user_organization_id()
  AND (
    user_id = get_current_user_id()
    OR user_has_permission('view_team_analytics')
  )
);

CREATE POLICY "Users can insert own worklogs"
ON worklogs FOR INSERT
WITH CHECK (
  organization_id = get_current_user_organization_id()
  AND user_id = get_current_user_id()
);
```

---

## 4. UPDATED VIEWS FOR ANALYTICS

### **4.1 Daily Time Summary (Org-Scoped)**

```sql
DROP VIEW IF EXISTS daily_time_summary;

CREATE VIEW daily_time_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name,
  DATE(ar.created_at AT TIME ZONE 'UTC') as work_date,
  SUM(ar.time_spent_seconds) as total_time_seconds,
  ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
  COUNT(DISTINCT ar.active_task_key) as unique_tasks,
  COUNT(*) as screenshot_count
FROM analysis_results ar
JOIN users u ON ar.user_id = u.id
JOIN organizations o ON ar.organization_id = o.id
WHERE ar.work_type = 'office'
  AND ar.is_active_work = true
GROUP BY ar.organization_id, o.org_name, ar.user_id, u.display_name, DATE(ar.created_at AT TIME ZONE 'UTC');

-- RLS on view
ALTER VIEW daily_time_summary SET (security_invoker = true);
```

---

### **4.2 Weekly Time Summary (Org-Scoped)**

```sql
DROP VIEW IF EXISTS weekly_time_summary;

CREATE VIEW weekly_time_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name,
  DATE_TRUNC('week', ar.created_at AT TIME ZONE 'UTC')::DATE as week_start,
  SUM(ar.time_spent_seconds) as total_time_seconds,
  ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
  COUNT(DISTINCT ar.active_task_key) as unique_tasks,
  COUNT(*) as screenshot_count
FROM analysis_results ar
JOIN users u ON ar.user_id = u.id
JOIN organizations o ON ar.organization_id = o.id
WHERE ar.work_type = 'office'
  AND ar.is_active_work = true
GROUP BY ar.organization_id, o.org_name, ar.user_id, u.display_name, DATE_TRUNC('week', ar.created_at AT TIME ZONE 'UTC')::DATE;

ALTER VIEW weekly_time_summary SET (security_invoker = true);
```

---

### **4.3 Monthly Time Summary (Org-Scoped)**

```sql
DROP VIEW IF EXISTS monthly_time_summary;

CREATE VIEW monthly_time_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  ar.user_id,
  u.display_name,
  DATE_TRUNC('month', ar.created_at AT TIME ZONE 'UTC')::DATE as month_start,
  SUM(ar.time_spent_seconds) as total_time_seconds,
  ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
  COUNT(DISTINCT ar.active_task_key) as unique_tasks,
  COUNT(*) as screenshot_count
FROM analysis_results ar
JOIN users u ON ar.user_id = u.id
JOIN organizations o ON ar.organization_id = o.id
WHERE ar.work_type = 'office'
  AND ar.is_active_work = true
GROUP BY ar.organization_id, o.org_name, ar.user_id, u.display_name, DATE_TRUNC('month', ar.created_at AT TIME ZONE 'UTC')::DATE;

ALTER VIEW monthly_time_summary SET (security_invoker = true);
```

---

### **4.4 NEW: Team Analytics View**

```sql
-- NEW: Team-level aggregation for managers/admins
CREATE VIEW team_analytics_summary AS
SELECT
  ar.organization_id,
  o.org_name,
  DATE(ar.created_at AT TIME ZONE 'UTC') as work_date,
  COUNT(DISTINCT ar.user_id) as active_users,
  SUM(ar.time_spent_seconds) as total_team_time_seconds,
  ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_team_hours,
  COUNT(DISTINCT ar.active_project_key) as active_projects,
  COUNT(DISTINCT ar.active_task_key) as unique_tasks,
  COUNT(*) as total_screenshots,
  ROUND(AVG(ar.confidence_score), 2) as avg_confidence_score
FROM analysis_results ar
JOIN organizations o ON ar.organization_id = o.id
WHERE ar.work_type = 'office'
  AND ar.is_active_work = true
GROUP BY ar.organization_id, o.org_name, DATE(ar.created_at AT TIME ZONE 'UTC');

ALTER VIEW team_analytics_summary SET (security_invoker = true);
```

---

## 5. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA ISOLATION FLOW                             │
└─────────────────────────────────────────────────────────────────────┘

1. USER AUTHENTICATION
   ├─ Desktop App: OAuth → Fetch accessible-resources → Select org
   ├─ Forge App: context.cloudId → Auto-detect org
   └─ Result: user_id + organization_id

2. DATA CREATION (Screenshot Upload)
   ├─ Desktop App uploads with { user_id, organization_id }
   ├─ RLS Policy checks: INSERT allowed if org matches user's org
   └─ Row stored: screenshots(id, user_id, organization_id, ...)

3. AI ANALYSIS
   ├─ Webhook payload includes { screenshot_id, organization_id }
   ├─ AI Server fetches: organization_settings(organization_id)
   ├─ Apply org-specific whitelist/blacklist rules
   ├─ Save: analysis_results(id, user_id, organization_id, ...)
   └─ RLS Policy ensures: Only same-org data readable

4. ANALYTICS QUERY (Forge App)
   ├─ User requests daily analytics
   ├─ Backend query:
   │    SELECT * FROM daily_time_summary
   │    WHERE organization_id = <current_user_org>
   │      AND (user_id = <current_user> OR <user_is_admin>)
   ├─ RLS Policy enforces: User can only see own org's data
   └─ Result: Org-isolated analytics

5. TEAM ANALYTICS (Admin View)
   ├─ Admin requests team analytics
   ├─ Permission check: user_has_permission('view_team_analytics')
   ├─ Query:
   │    SELECT * FROM team_analytics_summary
   │    WHERE organization_id = <current_user_org>
   ├─ RLS Policy allows: Admin sees all users in their org
   └─ Result: Team-level aggregated data
```

---

## 6. MIGRATION STRATEGY

### **Step 1: Create New Tables**

```sql
-- Create organizations table
-- Create organization_members table
-- Create organization_settings table
```

### **Step 2: Add organization_id Columns**

```sql
-- Add organization_id to all data tables (nullable initially)
ALTER TABLE users ADD COLUMN organization_id UUID;
ALTER TABLE screenshots ADD COLUMN organization_id UUID;
-- ... etc for all tables
```

### **Step 3: Migrate Existing Data**

```sql
-- Create a default organization for existing users
INSERT INTO organizations (jira_cloud_id, org_name, jira_instance_url)
VALUES (
  'legacy-migration-org',
  'Legacy Organization',
  'https://unknown.atlassian.net'
)
RETURNING id;

-- Let's say the returned id is stored in @legacy_org_id

-- Assign all existing users to this organization
UPDATE users
SET organization_id = '<legacy_org_id>'
WHERE organization_id IS NULL;

-- Propagate organization_id to all data tables
UPDATE screenshots s
SET organization_id = u.organization_id
FROM users u
WHERE s.user_id = u.id
  AND s.organization_id IS NULL;

UPDATE analysis_results ar
SET organization_id = u.organization_id
FROM users u
WHERE ar.user_id = u.id
  AND ar.organization_id IS NULL;

-- Repeat for all tables...
```

### **Step 4: Enforce Constraints**

```sql
-- Make organization_id NOT NULL after migration
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE screenshots ALTER COLUMN organization_id SET NOT NULL;
-- ... etc for all tables
```

### **Step 5: Enable RLS**

```sql
-- Enable RLS on all tables
-- Create policies
```

---

## 7. INDEXES SUMMARY

```sql
-- Organizations
CREATE INDEX idx_organizations_cloud_id ON organizations(jira_cloud_id);
CREATE INDEX idx_organizations_active ON organizations(is_active);

-- Users
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_org_active ON users(organization_id, is_active);

-- Organization Members
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

-- Screenshots
CREATE INDEX idx_screenshots_org_id ON screenshots(organization_id);
CREATE INDEX idx_screenshots_org_user_date ON screenshots(organization_id, user_id, timestamp DESC);

-- Analysis Results
CREATE INDEX idx_analysis_results_org_id ON analysis_results(organization_id);
CREATE INDEX idx_analysis_results_org_work_type ON analysis_results(organization_id, work_type);
CREATE INDEX idx_analysis_results_org_user_date ON analysis_results(organization_id, user_id, created_at DESC);

-- Documents
CREATE INDEX idx_documents_org_id ON documents(organization_id);
CREATE INDEX idx_documents_org_status ON documents(organization_id, processing_status);

-- Worklogs
CREATE INDEX idx_worklogs_org_id ON worklogs(organization_id);
CREATE INDEX idx_worklogs_org_user ON worklogs(organization_id, user_id);

-- Other tables...
CREATE INDEX idx_unassigned_activity_org_id ON unassigned_activity(organization_id);
CREATE INDEX idx_unassigned_work_groups_org_id ON unassigned_work_groups(organization_id);
CREATE INDEX idx_user_jira_issues_cache_org_id ON user_jira_issues_cache(organization_id);
CREATE INDEX idx_created_issues_log_org_id ON created_issues_log(organization_id);
```

---

## 8. VALIDATION QUERIES

```sql
-- Check if a user belongs to an organization
SELECT u.display_name, o.org_name, om.role
FROM users u
JOIN organizations o ON u.organization_id = o.id
LEFT JOIN organization_members om ON om.user_id = u.id AND om.organization_id = o.id
WHERE u.atlassian_account_id = '<accountId>';

-- Check data isolation: Count rows per organization
SELECT
  o.org_name,
  COUNT(DISTINCT u.id) as user_count,
  COUNT(DISTINCT s.id) as screenshot_count,
  COUNT(DISTINCT ar.id) as analysis_count,
  COUNT(DISTINCT d.id) as document_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
LEFT JOIN screenshots s ON s.organization_id = o.id
LEFT JOIN analysis_results ar ON ar.organization_id = o.id
LEFT JOIN documents d ON d.organization_id = o.id
GROUP BY o.org_name;

-- Check RLS: Try to query another org's data (should return empty)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<some_user_supabase_id>"}';

SELECT * FROM screenshots
WHERE organization_id != get_current_user_organization_id();
-- Should return 0 rows due to RLS
```

---

## 9. SUMMARY

### **Core Changes:**

1. ✅ **New Tables:** `organizations`, `organization_members`, `organization_settings`
2. ✅ **Updated Tables:** All data tables get `organization_id` column
3. ✅ **RLS Policies:** Rewritten to enforce org-level isolation
4. ✅ **Views:** Updated to include `organization_id` filtering
5. ✅ **Indexes:** Added for performance on org-scoped queries
6. ✅ **Helper Functions:** `get_current_user_organization_id()`, `user_has_permission()`

### **Data Isolation:**

- Every row in every data table has `organization_id`
- RLS ensures users can only access their organization's data
- Admins can see team data within their organization only
- Complete database-level isolation between tenants

### **RBAC:**

- Four roles: `owner`, `admin`, `manager`, `member`
- Granular permissions: `can_manage_settings`, `can_view_team_analytics`, etc.
- Permission checking via `user_has_permission()` function

### **Performance:**

- Indexes on `organization_id` for all tables
- Composite indexes for common query patterns
- Views use `security_invoker = true` for RLS

---

**This architecture provides production-ready, secure, and scalable multi-tenancy for your BRD Time Tracker application!** 🎉
