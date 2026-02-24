-- ============================================================================
-- Migration: Change tracking_settings from organization-level to project-level
-- Date: 2026-02-20
--
-- This allows different projects within the same organization to have
-- different timesheet settings (whitelisted apps, blacklisted apps, private sites, etc.)
--
-- Use case: Project A (social media marketing) needs Twitter/Facebook as productive,
--           but Project B (internal tools) considers them non-productive.
-- ============================================================================

-- Step 1: Add project_key column (nullable initially for existing data)
ALTER TABLE public.tracking_settings 
ADD COLUMN IF NOT EXISTS project_key TEXT;

-- Step 2: Create index for project_key lookups
CREATE INDEX IF NOT EXISTS idx_tracking_settings_project_key 
ON public.tracking_settings(project_key);

-- Step 3: Create composite index for fast org+project lookups
CREATE INDEX IF NOT EXISTS idx_tracking_settings_org_project 
ON public.tracking_settings(organization_id, project_key);

-- Step 4: Drop the old unique constraint on organization_id
ALTER TABLE public.tracking_settings 
DROP CONSTRAINT IF EXISTS tracking_settings_organization_id_key;

-- Step 5: Add new unique constraint on (organization_id, project_key)
-- This allows one settings record per project per organization
-- NULL project_key = organization-wide default settings
CREATE UNIQUE INDEX IF NOT EXISTS tracking_settings_org_project_key 
ON public.tracking_settings(organization_id, project_key)
WHERE project_key IS NOT NULL;

-- Step 6: Allow only one org-level default (where project_key IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS tracking_settings_org_default_key 
ON public.tracking_settings(organization_id)
WHERE project_key IS NULL;

-- Step 7: Update RLS policies to include project-level access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their organization's tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Admins can update their organization's tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Admins can insert tracking settings for their organization" ON public.tracking_settings;

-- New policy: Users can view tracking settings for their organization (org-level or project-level)
CREATE POLICY "tracking_settings_select_org_and_project" ON public.tracking_settings
    FOR SELECT
    USING (
        (organization_id IS NULL) OR -- Global defaults
        (organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id())
        ))
    );

-- New policy: Admins can insert tracking settings for their organization or projects
CREATE POLICY "tracking_settings_insert_admin" ON public.tracking_settings
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id()) 
            AND role IN ('owner', 'admin')
        )
    );

-- New policy: Admins can update tracking settings for their organization or projects
CREATE POLICY "tracking_settings_update_admin" ON public.tracking_settings
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id()) 
            AND role IN ('owner', 'admin')
        )
    );

-- New policy: Admins can delete tracking settings
CREATE POLICY "tracking_settings_delete_admin" ON public.tracking_settings
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = (SELECT get_current_user_id()) 
            AND role IN ('owner', 'admin')
        )
    );

-- Step 8: Add comments
COMMENT ON COLUMN public.tracking_settings.project_key IS 'Jira project key for project-specific settings. NULL = organization-wide default.';

COMMENT ON TABLE public.tracking_settings IS 'Timesheet tracking settings. Can be configured per-project or organization-wide (when project_key IS NULL). Project-specific settings override organization defaults.';

-- Step 9: Create a helper function to get tracking settings with project fallback
CREATE OR REPLACE FUNCTION public.get_tracking_settings_for_project(
    p_organization_id UUID,
    p_project_key TEXT
)
RETURNS TABLE(
    screenshot_monitoring_enabled BOOLEAN,
    screenshot_interval_seconds INTEGER,
    tracking_mode TEXT,
    event_tracking_enabled BOOLEAN,
    track_window_changes BOOLEAN,
    track_idle_time BOOLEAN,
    idle_threshold_seconds INTEGER,
    whitelist_enabled BOOLEAN,
    whitelisted_apps TEXT[],
    blacklist_enabled BOOLEAN,
    blacklisted_apps TEXT[],
    non_work_threshold_percent INTEGER,
    flag_excessive_non_work BOOLEAN,
    private_sites_enabled BOOLEAN,
    private_sites TEXT[],
    jira_worklog_sync_enabled BOOLEAN,
    settings_source TEXT  -- 'project' or 'organization' or 'global'
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    project_settings RECORD;
    org_settings RECORD;
    global_settings RECORD;
BEGIN
    -- Try project-specific settings first
    IF p_project_key IS NOT NULL THEN
        SELECT * INTO project_settings
        FROM public.tracking_settings ts
        WHERE ts.organization_id = p_organization_id
          AND ts.project_key = p_project_key
        LIMIT 1;
        
        IF FOUND THEN
            RETURN QUERY
            SELECT 
                project_settings.screenshot_monitoring_enabled,
                project_settings.screenshot_interval_seconds,
                project_settings.tracking_mode,
                project_settings.event_tracking_enabled,
                project_settings.track_window_changes,
                project_settings.track_idle_time,
                project_settings.idle_threshold_seconds,
                project_settings.whitelist_enabled,
                project_settings.whitelisted_apps,
                project_settings.blacklist_enabled,
                project_settings.blacklisted_apps,
                project_settings.non_work_threshold_percent,
                project_settings.flag_excessive_non_work,
                project_settings.private_sites_enabled,
                project_settings.private_sites,
                project_settings.jira_worklog_sync_enabled,
                'project'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Fall back to organization-level settings
    SELECT * INTO org_settings
    FROM public.tracking_settings ts
    WHERE ts.organization_id = p_organization_id
      AND ts.project_key IS NULL
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY
        SELECT 
            org_settings.screenshot_monitoring_enabled,
            org_settings.screenshot_interval_seconds,
            org_settings.tracking_mode,
            org_settings.event_tracking_enabled,
            org_settings.track_window_changes,
            org_settings.track_idle_time,
            org_settings.idle_threshold_seconds,
            org_settings.whitelist_enabled,
            org_settings.whitelisted_apps,
            org_settings.blacklist_enabled,
            org_settings.blacklisted_apps,
            org_settings.non_work_threshold_percent,
            org_settings.flag_excessive_non_work,
            org_settings.private_sites_enabled,
            org_settings.private_sites,
            org_settings.jira_worklog_sync_enabled,
            'organization'::TEXT;
        RETURN;
    END IF;
    
    -- Fall back to global defaults
    SELECT * INTO global_settings
    FROM public.tracking_settings ts
    WHERE ts.organization_id IS NULL
      AND ts.project_key IS NULL
    LIMIT 1;
    
    IF FOUND THEN
        RETURN QUERY
        SELECT 
            global_settings.screenshot_monitoring_enabled,
            global_settings.screenshot_interval_seconds,
            global_settings.tracking_mode,
            global_settings.event_tracking_enabled,
            global_settings.track_window_changes,
            global_settings.track_idle_time,
            global_settings.idle_threshold_seconds,
            global_settings.whitelist_enabled,
            global_settings.whitelisted_apps,
            global_settings.blacklist_enabled,
            global_settings.blacklisted_apps,
            global_settings.non_work_threshold_percent,
            global_settings.flag_excessive_non_work,
            global_settings.private_sites_enabled,
            global_settings.private_sites,
            global_settings.jira_worklog_sync_enabled,
            'global'::TEXT;
        RETURN;
    END IF;
    
    -- No settings found at all - return empty
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_tracking_settings_for_project(UUID, TEXT) IS 'Get tracking settings for a project with fallback: project → organization → global defaults';
