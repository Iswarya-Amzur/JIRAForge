-- ============================================================================
-- Migration: Add Worklog Sync Table + Tracking Settings Column
-- ============================================================================
-- Supports the "Jira Worklog Auto-Sync" feature. The scheduled sync job
-- creates/updates one Jira worklog per user per issue, tracked via the
-- worklog_sync mapping table. An admin toggle (jira_worklog_sync_enabled)
-- on tracking_settings controls whether the feature is active.
--
-- Created: 2026-02-08
-- ============================================================================

-- 1. Create worklog_sync mapping table
CREATE TABLE IF NOT EXISTS public.worklog_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    issue_key TEXT NOT NULL,

    -- Jira worklog reference
    jira_worklog_id TEXT NOT NULL,
    last_synced_seconds INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One worklog per user per issue per org
    CONSTRAINT uq_worklog_sync_org_user_issue UNIQUE (organization_id, user_id, issue_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_worklog_sync_org
ON public.worklog_sync(organization_id);

CREATE INDEX IF NOT EXISTS idx_worklog_sync_user
ON public.worklog_sync(user_id);

CREATE INDEX IF NOT EXISTS idx_worklog_sync_issue
ON public.worklog_sync(issue_key);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_worklog_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_worklog_sync_updated_at ON public.worklog_sync;
CREATE TRIGGER trigger_update_worklog_sync_updated_at
BEFORE UPDATE ON public.worklog_sync
FOR EACH ROW
EXECUTE FUNCTION public.update_worklog_sync_updated_at();

-- Comments
COMMENT ON TABLE public.worklog_sync IS 'Maps tracked time to Jira worklogs — one worklog per user per issue per org';
COMMENT ON COLUMN public.worklog_sync.jira_worklog_id IS 'Jira worklog ID returned from the REST API';
COMMENT ON COLUMN public.worklog_sync.last_synced_seconds IS 'Total seconds last pushed to Jira (used to detect changes)';

-- Enable RLS
ALTER TABLE public.worklog_sync ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role can manage all worklog_sync" ON public.worklog_sync
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 2. Ensure tracking_settings table exists, then add new column
-- ============================================================================
-- Create tracking_settings if it doesn't exist (matches current production schema)
CREATE TABLE IF NOT EXISTS public.tracking_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    screenshot_monitoring_enabled BOOLEAN NOT NULL DEFAULT true,
    screenshot_interval_seconds INTEGER NOT NULL DEFAULT 900,
    
    tracking_mode TEXT NOT NULL DEFAULT 'interval',
    event_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
    track_window_changes BOOLEAN NOT NULL DEFAULT true,
    track_idle_time BOOLEAN NOT NULL DEFAULT true,
    idle_threshold_seconds INTEGER NOT NULL DEFAULT 300,
    whitelist_enabled BOOLEAN NOT NULL DEFAULT true,
    whitelisted_apps TEXT[] NOT NULL DEFAULT ARRAY['vscode','code','cursor','chrome','firefox','edge','slack','teams','jira','confluence','github','terminal','postman'],
    blacklist_enabled BOOLEAN NOT NULL DEFAULT true,
    blacklisted_apps TEXT[] NOT NULL DEFAULT ARRAY['netflix','youtube','spotify','facebook','instagram','twitter','tiktok'],
    non_work_threshold_percent INTEGER NOT NULL DEFAULT 30,
    flag_excessive_non_work BOOLEAN NOT NULL DEFAULT true,
    private_sites_enabled BOOLEAN NOT NULL DEFAULT true,
    private_sites TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add the new column
ALTER TABLE public.tracking_settings
ADD COLUMN IF NOT EXISTS jira_worklog_sync_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.tracking_settings.jira_worklog_sync_enabled IS 'When true, the scheduled job auto-syncs tracked time to Jira worklogs';
