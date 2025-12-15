-- ============================================================================
-- TRACKING SETTINGS TABLE
-- Stores organization-level timesheet/tracking configuration
-- ============================================================================

-- Create the tracking_settings table
CREATE TABLE IF NOT EXISTS public.tracking_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  
  -- Screenshot Monitoring Settings
  screenshot_monitoring_enabled boolean NOT NULL DEFAULT true,
  screenshot_interval_seconds integer NOT NULL DEFAULT 900, -- 15 minutes default
  
  -- Tracking Mode: 'interval' or 'event'
  tracking_mode text NOT NULL DEFAULT 'interval',
  
  -- Event-based tracking settings (when tracking_mode = 'event')
  event_tracking_enabled boolean NOT NULL DEFAULT false,
  track_window_changes boolean NOT NULL DEFAULT true,
  track_idle_time boolean NOT NULL DEFAULT true,
  idle_threshold_seconds integer NOT NULL DEFAULT 300, -- 5 minutes
  
  -- Whitelisted Applications (work apps to track)
  whitelist_enabled boolean NOT NULL DEFAULT true,
  whitelisted_apps text[] NOT NULL DEFAULT ARRAY[
    'vscode', 'code', 'cursor', 'sublime_text', 'notepad++', 'vim', 'neovim', 'atom',
    'chrome', 'firefox', 'edge', 'brave', 'safari', 'opera',
    'slack', 'teams', 'discord', 'zoom',
    'outlook', 'thunderbird',
    'jira', 'confluence', 'github', 'gitlab', 'bitbucket',
    'figma', 'sketch', 'photoshop', 'illustrator',
    'excel', 'word', 'powerpoint', 'onenote',
    'terminal', 'iterm', 'powershell', 'cmd',
    'postman', 'insomnia', 'dbeaver', 'datagrip'
  ]::text[],
  
  -- Blacklisted Applications (non-work apps to exclude/flag)
  blacklist_enabled boolean NOT NULL DEFAULT true,
  blacklisted_apps text[] NOT NULL DEFAULT ARRAY[
    'netflix', 'primevideo', 'hulu', 'disneyplus', 'hbomax',
    'youtube', 'twitch', 'tiktok',
    'facebook', 'instagram', 'twitter', 'reddit', 'pinterest',
    'whatsapp', 'telegram', 'signal', 'messenger',
    'spotify', 'applemusic', 'amazonmusic',
    'steam', 'epicgames', 'origin', 'battlenet',
    'discord' -- Note: Discord can be both work and non-work
  ]::text[],
  
  -- Excessive non-work threshold (percentage)
  non_work_threshold_percent integer NOT NULL DEFAULT 30,
  flag_excessive_non_work boolean NOT NULL DEFAULT true,
  
  -- Private Sites/Apps (omit from tracking completely)
  private_sites_enabled boolean NOT NULL DEFAULT true,
  private_sites text[] NOT NULL DEFAULT ARRAY[]::text[],
  
  -- Metadata
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT tracking_settings_pkey PRIMARY KEY (id),
  CONSTRAINT tracking_settings_organization_id_key UNIQUE (organization_id),
  CONSTRAINT tracking_settings_tracking_mode_check CHECK (
    tracking_mode = ANY (ARRAY['interval'::text, 'event'::text])
  ),
  CONSTRAINT tracking_settings_interval_check CHECK (
    screenshot_interval_seconds >= 60 AND screenshot_interval_seconds <= 3600
  ),
  CONSTRAINT tracking_settings_threshold_check CHECK (
    non_work_threshold_percent >= 0 AND non_work_threshold_percent <= 100
  ),
  CONSTRAINT tracking_settings_idle_threshold_check CHECK (
    idle_threshold_seconds >= 60 AND idle_threshold_seconds <= 1800
  )
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tracking_settings_organization_id 
  ON public.tracking_settings USING btree (organization_id) TABLESPACE pg_default;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_tracking_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create (idempotent)
DROP TRIGGER IF EXISTS trigger_update_tracking_settings_updated_at ON public.tracking_settings;

CREATE TRIGGER trigger_update_tracking_settings_updated_at
  BEFORE UPDATE ON public.tracking_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tracking_settings_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view their organization's tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Admins can update their organization's tracking settings" ON public.tracking_settings;
DROP POLICY IF EXISTS "Admins can insert tracking settings for their organization" ON public.tracking_settings;

-- Policy: Organization members can view their org's settings
-- Uses get_current_user_id() function from migration 013 for proper auth mapping
CREATE POLICY "Users can view their organization's tracking settings"
  ON public.tracking_settings
  FOR SELECT
  USING (
    organization_id IS NULL -- Global default (readable by all authenticated users)
    OR organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = get_current_user_id()
    )
  );

CREATE POLICY "Admins can update their organization's tracking settings"
  ON public.tracking_settings
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = get_current_user_id() 
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can insert tracking settings for their organization"
  ON public.tracking_settings
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = get_current_user_id() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get organization's tracking settings (with fallback to defaults)
CREATE OR REPLACE FUNCTION get_tracking_settings(p_organization_id uuid DEFAULT NULL)
RETURNS TABLE (
  screenshot_monitoring_enabled boolean,
  screenshot_interval_seconds integer,
  tracking_mode text,
  event_tracking_enabled boolean,
  track_window_changes boolean,
  track_idle_time boolean,
  idle_threshold_seconds integer,
  whitelist_enabled boolean,
  whitelisted_apps text[],
  blacklist_enabled boolean,
  blacklisted_apps text[],
  non_work_threshold_percent integer,
  flag_excessive_non_work boolean,
  private_sites_enabled boolean,
  private_sites text[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.screenshot_monitoring_enabled,
    ts.screenshot_interval_seconds,
    ts.tracking_mode,
    ts.event_tracking_enabled,
    ts.track_window_changes,
    ts.track_idle_time,
    ts.idle_threshold_seconds,
    ts.whitelist_enabled,
    ts.whitelisted_apps,
    ts.blacklist_enabled,
    ts.blacklisted_apps,
    ts.non_work_threshold_percent,
    ts.flag_excessive_non_work,
    ts.private_sites_enabled,
    ts.private_sites
  FROM public.tracking_settings ts
  WHERE ts.organization_id = p_organization_id
  LIMIT 1;
  
  -- If no org-specific settings found, return defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      true::boolean as screenshot_monitoring_enabled,
      900::integer as screenshot_interval_seconds,
      'interval'::text as tracking_mode,
      false::boolean as event_tracking_enabled,
      true::boolean as track_window_changes,
      true::boolean as track_idle_time,
      300::integer as idle_threshold_seconds,
      true::boolean as whitelist_enabled,
      ARRAY['vscode', 'code', 'chrome', 'slack', 'jira', 'github']::text[] as whitelisted_apps,
      true::boolean as blacklist_enabled,
      ARRAY['netflix', 'youtube', 'facebook', 'instagram', 'twitter']::text[] as blacklisted_apps,
      30::integer as non_work_threshold_percent,
      true::boolean as flag_excessive_non_work,
      true::boolean as private_sites_enabled,
      ARRAY[]::text[] as private_sites;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INSERT DEFAULT GLOBAL SETTINGS
-- ============================================================================

-- Insert a default row for global settings (organization_id = NULL)
INSERT INTO public.tracking_settings (
  organization_id,
  screenshot_monitoring_enabled,
  screenshot_interval_seconds,
  tracking_mode,
  whitelist_enabled,
  blacklist_enabled,
  private_sites_enabled
) VALUES (
  NULL,
  true,
  900,
  'interval',
  true,
  true,
  true
) ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.tracking_settings IS 'Organization-level time tracking and screenshot monitoring settings';
COMMENT ON COLUMN public.tracking_settings.tracking_mode IS 'interval: periodic screenshots, event: capture on activity changes';
COMMENT ON COLUMN public.tracking_settings.whitelisted_apps IS 'Applications that should be actively tracked (work applications)';
COMMENT ON COLUMN public.tracking_settings.blacklisted_apps IS 'Applications that indicate non-work activity';
COMMENT ON COLUMN public.tracking_settings.private_sites IS 'Sites/apps to completely omit from tracking (privacy)';
COMMENT ON COLUMN public.tracking_settings.non_work_threshold_percent IS 'Percentage of time on blacklisted apps before flagging user';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'tracking_settings table created successfully';
  RAISE NOTICE 'RLS policies applied';
  RAISE NOTICE 'Helper function get_tracking_settings() created';
END $$;
