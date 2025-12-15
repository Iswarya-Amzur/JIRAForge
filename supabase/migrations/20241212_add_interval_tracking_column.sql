-- ============================================================================
-- ADD INTERVAL TRACKING ENABLED COLUMN
-- Allows both interval and event-based tracking to be enabled simultaneously
-- ============================================================================

-- Add the new column (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tracking_settings' 
    AND column_name = 'interval_tracking_enabled'
  ) THEN
    ALTER TABLE public.tracking_settings 
    ADD COLUMN interval_tracking_enabled boolean NOT NULL DEFAULT true;
    
    RAISE NOTICE 'Added interval_tracking_enabled column';
  ELSE
    RAISE NOTICE 'interval_tracking_enabled column already exists';
  END IF;
END $$;

-- Update existing rows to set interval_tracking_enabled based on tracking_mode
UPDATE public.tracking_settings
SET interval_tracking_enabled = (tracking_mode = 'interval' OR tracking_mode IS NULL)
WHERE interval_tracking_enabled IS NULL OR interval_tracking_enabled = true;

-- Add comment
COMMENT ON COLUMN public.tracking_settings.interval_tracking_enabled IS 'Enable interval-based screenshot capture at fixed intervals';

-- Update the get_tracking_settings function to include the new column
CREATE OR REPLACE FUNCTION get_tracking_settings(p_organization_id uuid DEFAULT NULL)
RETURNS TABLE (
  screenshot_monitoring_enabled boolean,
  screenshot_interval_seconds integer,
  interval_tracking_enabled boolean,
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
    ts.interval_tracking_enabled,
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
      true::boolean as interval_tracking_enabled,
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

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'interval_tracking_enabled column added/updated successfully';
  RAISE NOTICE 'get_tracking_settings function updated';
END $$;
