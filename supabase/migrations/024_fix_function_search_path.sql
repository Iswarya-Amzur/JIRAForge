-- ============================================================================
-- Migration: 024_fix_function_search_path.sql
-- Description: Fix mutable search_path in functions for security
-- 
-- Issue: Functions without explicit search_path can be exploited by attackers
-- who manipulate the search_path to execute malicious code.
--
-- Fix: Add SET search_path = '' to make the search_path immutable.
-- ============================================================================

-- Fix update_tracking_settings_updated_at function
CREATE OR REPLACE FUNCTION public.update_tracking_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix calculate_screenshot_duration function
CREATE OR REPLACE FUNCTION public.calculate_screenshot_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- If start_time and end_time are set, calculate duration
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER;
  END IF;

  -- Set end_time from timestamp if not provided (backward compatibility)
  IF NEW.end_time IS NULL AND NEW.timestamp IS NOT NULL THEN
    NEW.end_time := NEW.timestamp;
  END IF;

  -- Set timestamp from end_time if not provided
  IF NEW.timestamp IS NULL AND NEW.end_time IS NOT NULL THEN
    NEW.timestamp := NEW.end_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix get_tracking_settings function
-- Must drop first because return type signature may differ
DROP FUNCTION IF EXISTS public.get_tracking_settings(uuid);

CREATE OR REPLACE FUNCTION public.get_tracking_settings(p_organization_id uuid DEFAULT NULL)
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  func_record RECORD;
  problem_funcs TEXT := '';
BEGIN
  FOR func_record IN 
    SELECT p.proname AS func_name
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_tracking_settings_updated_at',
        'get_tracking_settings',
        'calculate_screenshot_duration'
      )
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) AS config
        WHERE config LIKE 'search_path=%'
      ))
  LOOP
    problem_funcs := problem_funcs || func_record.func_name || ', ';
  END LOOP;
  
  IF problem_funcs != '' THEN
    RAISE WARNING 'Functions still with mutable search_path: %', RTRIM(problem_funcs, ', ');
  ELSE
    RAISE NOTICE 'All functions now have immutable search_path';
  END IF;
END $$;
