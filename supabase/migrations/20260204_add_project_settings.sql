-- Migration: Add project_settings table for project-level configuration
-- This allows project admins to configure tracked statuses per project
-- Date: 2026-02-04

-- ============================================================================
-- CREATE PROJECT_SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_settings (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_key TEXT NOT NULL,                    -- Jira project key (e.g., "PROJ", "SCRUM")
    project_name TEXT,                            -- Jira project name for display
    
    -- Tracked statuses for time tracking
    -- These are the Jira status names that should be tracked for this project
    -- Default: only "In Progress" status
    tracked_statuses TEXT[] DEFAULT ARRAY['In Progress'],
    
    -- Metadata
    configured_by UUID REFERENCES public.users(id),  -- User who last configured
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one settings record per project per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_settings_org_project 
    ON public.project_settings(organization_id, project_key);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_settings_org_id 
    ON public.project_settings(organization_id);

CREATE INDEX IF NOT EXISTS idx_project_settings_project_key 
    ON public.project_settings(project_key);

-- ============================================================================
-- UPDATE TRIGGER
-- ============================================================================

-- Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION update_project_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_settings_updated_at ON public.project_settings;
CREATE TRIGGER trigger_project_settings_updated_at
    BEFORE UPDATE ON public.project_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_project_settings_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view project settings for their organization
DROP POLICY IF EXISTS "project_settings_select_org" ON public.project_settings;
CREATE POLICY "project_settings_select_org" ON public.project_settings
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id())
        )
    );

-- Policy: Admins can insert project settings for their organization
DROP POLICY IF EXISTS "project_settings_insert_admin" ON public.project_settings;
CREATE POLICY "project_settings_insert_admin" ON public.project_settings
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id()) 
            AND role IN ('admin', 'owner')
        )
    );

-- Policy: Admins can update project settings for their organization
DROP POLICY IF EXISTS "project_settings_update_admin" ON public.project_settings;
CREATE POLICY "project_settings_update_admin" ON public.project_settings
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id()) 
            AND role IN ('admin', 'owner')
        )
    );

-- Policy: Admins can delete project settings for their organization
DROP POLICY IF EXISTS "project_settings_delete_admin" ON public.project_settings;
CREATE POLICY "project_settings_delete_admin" ON public.project_settings
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id()) 
            AND role IN ('admin', 'owner')
        )
    );

-- Policy: Service role can do everything (for AI server and backend operations)
DROP POLICY IF EXISTS "project_settings_service_role" ON public.project_settings;
CREATE POLICY "project_settings_service_role" ON public.project_settings
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.project_settings IS 'Project-level settings configured by project admins';
COMMENT ON COLUMN public.project_settings.project_key IS 'Jira project key (e.g., PROJ, SCRUM)';
COMMENT ON COLUMN public.project_settings.tracked_statuses IS 'Array of Jira status names to track for time tracking';
COMMENT ON COLUMN public.project_settings.configured_by IS 'User ID of the admin who last configured these settings';
