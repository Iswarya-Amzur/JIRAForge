-- ============================================================================
-- JIRAForge PRODUCTION Migration
-- ============================================================================
-- Extracted from DEV: jvijitdewbypqbatfboi
-- Target: bzdoztgfozxkhkvctvdk
-- Generated: 2026-03-02T10:30:38.192041
-- ============================================================================


-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


-- FUNCTIONS
-- NOTE: 2 function(s) use pg_net for HTTP calls: notify_activity_webhook, notify_screenshot_webhook
-- These require pg_net extension to be enabled in your project
-- Go to Supabase Dashboard > Database > Extensions > Enable pg_net

CREATE OR REPLACE FUNCTION public.auto_save_unassigned_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    -- Check if task_key is NULL or empty
    IF (NEW.active_task_key IS NULL OR NEW.active_task_key = '') THEN
        -- Insert into unassigned_activity table
        INSERT INTO public.unassigned_activity (
            analysis_result_id,
            screenshot_id,
            user_id,
            organization_id,
            timestamp,
            window_title,
            application_name,
            extracted_text,
            detected_jira_keys,
            confidence_score,
            time_spent_seconds,  -- Now populated from screenshots.duration_seconds
            reason,
            metadata
        )
        SELECT
            NEW.id,
            NEW.screenshot_id,
            NEW.user_id,
            NEW.organization_id,
            s.timestamp,
            s.window_title,
            s.application_name,
            NEW.extracted_text,
            NEW.detected_jira_keys,
            NEW.confidence_score,
            COALESCE(s.duration_seconds, NEW.time_spent_seconds, 300),  -- Use screenshots.duration_seconds first, fallback to analysis_results.time_spent_seconds
            CASE
                WHEN NEW.active_task_key IS NULL THEN 'no_task_key'
                WHEN NEW.active_task_key = '' THEN 'no_task_key'
                ELSE 'invalid_task_key'
            END,
            jsonb_build_object(
                'is_active_work', NEW.is_active_work,
                'is_idle', NEW.is_idle,
                'ai_model_version', NEW.ai_model_version,
                'active_project_key', NEW.active_project_key,
                'work_type', NEW.work_type
            )
        FROM public.screenshots s
        WHERE s.id = NEW.screenshot_id
        ON CONFLICT (analysis_result_id) DO UPDATE SET
          -- Update time_spent_seconds if screenshot was updated
          time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, unassigned_activity.time_spent_seconds);
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_screenshot_duration()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.compute_activity_work_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.work_date IS NULL AND NEW.start_time IS NOT NULL THEN
        IF NEW.user_timezone IS NOT NULL AND NEW.user_timezone != '' THEN
            NEW.work_date = (NEW.start_time AT TIME ZONE NEW.user_timezone)::DATE;
        ELSE
            NEW.work_date = (NEW.start_time AT TIME ZONE 'UTC')::DATE;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_work_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    -- IMPORTANT: Only compute work_date if it's NOT already provided
    -- The desktop app sends the correct local date directly, so we should use that
    -- This trigger is a fallback for old desktop apps or missing data

    IF NEW.work_date IS NULL AND NEW.timestamp IS NOT NULL THEN
        -- Fallback: extract date from timestamp as stored
        -- Note: Since timestamps are stored without proper timezone context,
        -- we extract the date directly from the stored value
        NEW.work_date := DATE(NEW.timestamp);
    END IF;

    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN (
    SELECT id FROM public.users
    WHERE supabase_user_id = (SELECT auth.uid())
    LIMIT 1
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN (
    SELECT organization_id FROM public.users
    WHERE supabase_user_id = (SELECT auth.uid())
    LIMIT 1
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_tracking_settings(p_organization_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(screenshot_monitoring_enabled boolean, screenshot_interval_seconds integer, interval_tracking_enabled boolean, event_tracking_enabled boolean, track_window_changes boolean, track_idle_time boolean, idle_threshold_seconds integer, whitelist_enabled boolean, whitelisted_apps text[], blacklist_enabled boolean, blacklisted_apps text[], non_work_threshold_percent integer, flag_excessive_non_work boolean, private_sites_enabled boolean, private_sites text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_tracking_settings_for_project(p_organization_id uuid, p_project_key text)
 RETURNS TABLE(screenshot_monitoring_enabled boolean, screenshot_interval_seconds integer, tracking_mode text, event_tracking_enabled boolean, track_window_changes boolean, track_idle_time boolean, idle_threshold_seconds integer, whitelist_enabled boolean, whitelisted_apps text[], blacklist_enabled boolean, blacklisted_apps text[], non_work_threshold_percent integer, flag_excessive_non_work boolean, private_sites_enabled boolean, private_sites text[], jira_worklog_sync_enabled boolean, settings_source text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.notify_activity_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  pending_records jsonb;
  pending_count integer;
BEGIN
  -- Collect only 'pending' rows from the transition table into a JSON array.
  -- Non-productive and private records are inserted with status='analyzed'
  -- and don't need AI processing.
  SELECT jsonb_agg(row_to_json(r)), count(*)
    INTO pending_records, pending_count
    FROM new_rows r
   WHERE r.status = 'pending';

  -- Nothing to process — all records were pre-analyzed (non_productive/private)
  IF pending_count = 0 OR pending_records IS NULL THEN
    RETURN NULL;
  END IF;

  -- Single HTTP call with all pending records as a JSON array
  PERFORM net.http_post(
    url := 'https://jvijitdewbypqbatfboi.supabase.co/functions/v1/activity-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'activity_records',
      'record_count', pending_count,
      'records', pending_records
    )
  );

  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_screenshot_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://jvijitdewbypqbatfboi.supabase.co/functions/v1/screenshot-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'screenshots',
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_webhook_url(webhook_type text, url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF webhook_type = 'screenshot' THEN
        EXECUTE format('ALTER DATABASE %I SET app.screenshot_webhook_url = %L', current_database(), url);
    ELSIF webhook_type = 'document' THEN
        EXECUTE format('ALTER DATABASE %I SET app.document_webhook_url = %L', current_database(), url);
    ELSE
        RAISE EXCEPTION 'Invalid webhook type: %. Must be "screenshot" or "document"', webhook_type;
    END IF;

    RAISE NOTICE 'Webhook URL set for %. Reconnect to database for changes to take effect.', webhook_type;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_activity_records_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_app_classifications_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_app_releases_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_cached_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.cached_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_latest_release()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    -- If this new release is marked as latest, unmark all other releases for this platform
    IF NEW.is_latest = TRUE THEN
        UPDATE public.app_releases
        SET is_latest = FALSE, updated_at = NOW()
        WHERE platform = NEW.platform 
          AND id != NEW.id 
          AND is_latest = TRUE;
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_notification_cooldown(p_user_id uuid, p_notification_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.notification_cooldowns (user_id, notification_type, last_sent_at, sent_today_count, count_reset_date)
    VALUES (p_user_id, p_notification_type, NOW(), 1, CURRENT_DATE)
    ON CONFLICT (user_id, notification_type) DO UPDATE SET
        last_sent_at = NOW(),
        sent_today_count = CASE 
            WHEN notification_cooldowns.count_reset_date = CURRENT_DATE 
            THEN notification_cooldowns.sent_today_count + 1 
            ELSE 1 
        END,
        count_reset_date = CURRENT_DATE,
        updated_at = NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_notification_logs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_project_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tracking_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_unassigned_groups_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_worklog_sync_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_permission(permission_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  user_org_id UUID;
  user_id UUID;
  has_perm BOOLEAN;
BEGIN
  user_id := public.get_current_user_id();
  user_org_id := public.get_current_user_organization_id();

  IF user_id IS NULL OR user_org_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check based on permission type
  CASE permission_name
    WHEN 'view_team_analytics' THEN
      SELECT can_view_team_analytics INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_settings' THEN
      SELECT can_manage_settings INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_members' THEN
      SELECT can_manage_members INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'delete_screenshots' THEN
      SELECT can_delete_screenshots INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    WHEN 'manage_billing' THEN
      SELECT can_manage_billing INTO has_perm
      FROM public.organization_members
      WHERE organization_members.user_id = user_id AND organization_id = user_org_id;

    ELSE
      RETURN false;
  END CASE;

  RETURN COALESCE(has_perm, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_user_org_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := public.get_current_user_id();
  v_user_org_id := public.get_current_user_organization_id();

  IF v_user_id IS NULL OR v_user_org_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_user_role
  FROM public.organization_members
  WHERE organization_members.user_id = v_user_id AND organization_id = v_user_org_id;

  RETURN v_user_role IN ('owner', 'admin');
END;
$function$
;


-- TABLES
CREATE TABLE IF NOT EXISTS public.activity_log (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid, event_type text NOT NULL, event_data jsonb DEFAULT '{}'::jsonb, ip_address inet, user_agent text, created_at timestamp with time zone DEFAULT now(), organization_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.activity_records (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid NOT NULL, organization_id uuid, window_title text, application_name text, classification text, ocr_text text, total_time_seconds integer, visit_count integer DEFAULT 1, start_time timestamp with time zone, end_time timestamp with time zone, duration_seconds integer, batch_timestamp timestamp with time zone, batch_start timestamp with time zone, batch_end timestamp with time zone, work_date date, user_timezone text, project_key text, user_assigned_issue_key text, user_assigned_issues text, status text DEFAULT 'pending'::text, metadata jsonb DEFAULT '{}'::jsonb, retry_count integer DEFAULT 0, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), analyzed_at timestamp with time zone, ocr_method text, ocr_confidence real, ocr_error_message text);

CREATE TABLE IF NOT EXISTS public.analysis_results (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), screenshot_id uuid NOT NULL, user_id uuid NOT NULL, time_spent_seconds integer NOT NULL DEFAULT 0, active_task_key text, active_project_key text, confidence_score numeric, extracted_text text, detected_jira_keys text[], is_active_work boolean DEFAULT true, is_idle boolean DEFAULT false, analyzed_by text DEFAULT 'ai'::text, ai_model_version text, analysis_metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), worklog_created boolean DEFAULT false, worklog_id text, worklog_created_at timestamp with time zone, work_type text NOT NULL, manually_assigned boolean DEFAULT false, assignment_group_id uuid, organization_id uuid NOT NULL, reassigned_from text, reassigned_at timestamp with time zone);

CREATE TABLE IF NOT EXISTS public.app_releases (id uuid NOT NULL DEFAULT gen_random_uuid(), version text NOT NULL, platform text NOT NULL DEFAULT 'windows'::text, download_url text NOT NULL, file_size_bytes bigint, checksum text, release_notes text, min_supported_version text, is_mandatory boolean DEFAULT false, is_latest boolean DEFAULT true, is_active boolean DEFAULT true, published_at timestamp with time zone DEFAULT now(), created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), created_by uuid);

CREATE TABLE IF NOT EXISTS public.application_classifications (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), organization_id uuid, project_key text, identifier text NOT NULL, display_name text NOT NULL, classification text NOT NULL, match_by text NOT NULL, is_default boolean DEFAULT false, created_by text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.created_issues_log (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid, issue_key character varying(50) NOT NULL, issue_summary text, assignment_group_id uuid, session_count integer, total_time_seconds integer, created_at timestamp with time zone DEFAULT now(), organization_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.documents (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid NOT NULL, file_name text NOT NULL, file_type text NOT NULL, file_size_bytes bigint NOT NULL, storage_url text NOT NULL, storage_path text NOT NULL, processing_status text DEFAULT 'uploaded'::text, extracted_text text, parsed_requirements jsonb, project_key text, created_issues jsonb DEFAULT '[]'::jsonb, error_message text, created_at timestamp with time zone DEFAULT now(), processed_at timestamp with time zone, ai_model_version text, processing_metadata jsonb DEFAULT '{}'::jsonb, organization_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.feedback (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, atlassian_account_id text NOT NULL, user_email text, user_display_name text, organization_id uuid, jira_cloud_id text, category text NOT NULL, title text, description text NOT NULL, image_paths text[], image_count integer DEFAULT 0, ai_summary text, ai_priority text, ai_labels text[], ai_issue_type text DEFAULT 'Task'::text, jira_issue_key text, jira_issue_url text, jira_creation_status text DEFAULT 'pending'::text, jira_creation_error text, source text DEFAULT 'desktop_app'::text, app_version text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.notification_cooldowns (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, notification_type text NOT NULL, last_sent_at timestamp with time zone DEFAULT now(), cooldown_hours integer DEFAULT 24, sent_today_count integer DEFAULT 0, count_reset_date date DEFAULT CURRENT_DATE, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.notification_logs (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, organization_id uuid NOT NULL, notification_type text NOT NULL, email_address text NOT NULL, subject text NOT NULL, status text NOT NULL DEFAULT 'pending'::text, provider text, provider_message_id text, error_message text, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), sent_at timestamp with time zone, updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.notification_preferences (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, organization_id uuid NOT NULL, login_reminder_enabled boolean DEFAULT true, download_reminder_enabled boolean DEFAULT true, new_version_enabled boolean DEFAULT true, inactivity_alert_enabled boolean DEFAULT true, inactivity_threshold_hours numeric DEFAULT 3.5, work_hours_start time without time zone DEFAULT '09:00:00'::time without time zone, work_hours_end time without time zone DEFAULT '18:00:00'::time without time zone, work_days int4[] DEFAULT '{1,2,3,4,5}'::integer[], timezone text DEFAULT 'UTC'::text, max_daily_notifications integer DEFAULT 5, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.ocr_test_results (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, organization_id uuid, screenshot_id uuid, "timestamp" timestamp with time zone NOT NULL DEFAULT now(), window_title text, application_name text, extracted_text text, ocr_confidence numeric, ocr_method character varying(20), ocr_line_count integer DEFAULT 0, preprocessing_enabled boolean DEFAULT true, processing_time_ms integer, image_width integer, image_height integer, success boolean DEFAULT false, error_message text, test_name character varying(100), test_notes text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), screenshot_base64 text, thumbnail_base64 text);

CREATE TABLE IF NOT EXISTS public.organization_members (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, organization_id uuid NOT NULL, role text NOT NULL, can_manage_settings boolean DEFAULT false, can_view_team_analytics boolean DEFAULT false, can_manage_members boolean DEFAULT false, can_delete_screenshots boolean DEFAULT false, can_manage_billing boolean DEFAULT false, joined_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.organization_settings (id uuid NOT NULL DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, ai_server_url text, ai_server_api_key text, screenshot_interval integer DEFAULT 300, auto_worklog_enabled boolean DEFAULT true, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.organizations (id uuid NOT NULL DEFAULT gen_random_uuid(), jira_cloud_id text NOT NULL, jira_instance_url text NOT NULL, org_name text NOT NULL, subscription_status text DEFAULT 'active'::text, subscription_tier text DEFAULT 'free'::text, settings jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), is_active boolean DEFAULT true);

CREATE TABLE IF NOT EXISTS public.project_settings (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), organization_id uuid NOT NULL, project_key text NOT NULL, project_name text, tracked_statuses text[] DEFAULT ARRAY['In Progress'::text], configured_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), batch_upload_interval integer, auto_worklog_enabled boolean, non_work_threshold integer);

CREATE TABLE IF NOT EXISTS public.screenshots (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid NOT NULL, "timestamp" timestamp with time zone NOT NULL, storage_url text NOT NULL, storage_path text NOT NULL, thumbnail_url text, window_title text, application_name text, file_size_bytes bigint, status text DEFAULT 'pending'::text, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), analyzed_at timestamp with time zone, deleted_at timestamp with time zone, user_assigned_issues jsonb DEFAULT '[]'::jsonb, organization_id uuid NOT NULL, start_time timestamp with time zone, end_time timestamp with time zone, duration_seconds integer, retry_count integer DEFAULT 0, updated_at timestamp with time zone DEFAULT now(), project_key text, user_timezone text, work_date date);

CREATE TABLE IF NOT EXISTS public.tracking_settings (id uuid NOT NULL DEFAULT gen_random_uuid(), organization_id uuid, screenshot_monitoring_enabled boolean NOT NULL DEFAULT true, screenshot_interval_seconds integer NOT NULL DEFAULT 900, tracking_mode text NOT NULL DEFAULT 'interval'::text, event_tracking_enabled boolean NOT NULL DEFAULT false, track_window_changes boolean NOT NULL DEFAULT true, track_idle_time boolean NOT NULL DEFAULT true, idle_threshold_seconds integer NOT NULL DEFAULT 300, whitelist_enabled boolean NOT NULL DEFAULT true, whitelisted_apps text[] NOT NULL DEFAULT ARRAY['vscode'::text, 'code'::text, 'cursor'::text, 'sublime_text'::text, 'notepad++'::text, 'vim'::text, 'neovim'::text, 'atom'::text, 'chrome'::text, 'firefox'::text, 'edge'::text, 'brave'::text, 'safari'::text, 'opera'::text, 'slack'::text, 'teams'::text, 'discord'::text, 'zoom'::text, 'outlook'::text, 'thunderbird'::text, 'jira'::text, 'confluence'::text, 'github'::text, 'gitlab'::text, 'bitbucket'::text, 'figma'::text, 'sketch'::text, 'photoshop'::text, 'illustrator'::text, 'excel'::text, 'word'::text, 'powerpoint'::text, 'onenote'::text, 'terminal'::text, 'iterm'::text, 'powershell'::text, 'cmd'::text, 'postman'::text, 'insomnia'::text, 'dbeaver'::text, 'datagrip'::text], blacklist_enabled boolean NOT NULL DEFAULT true, blacklisted_apps text[] NOT NULL DEFAULT ARRAY['netflix'::text, 'primevideo'::text, 'hulu'::text, 'disneyplus'::text, 'hbomax'::text, 'youtube'::text, 'twitch'::text, 'tiktok'::text, 'facebook'::text, 'instagram'::text, 'twitter'::text, 'reddit'::text, 'pinterest'::text, 'whatsapp'::text, 'telegram'::text, 'signal'::text, 'messenger'::text, 'spotify'::text, 'applemusic'::text, 'amazonmusic'::text, 'steam'::text, 'epicgames'::text, 'origin'::text, 'battlenet'::text, 'discord'::text], non_work_threshold_percent integer NOT NULL DEFAULT 30, flag_excessive_non_work boolean NOT NULL DEFAULT true, private_sites_enabled boolean NOT NULL DEFAULT true, private_sites text[] NOT NULL DEFAULT ARRAY[]::text[], created_by uuid, updated_by uuid, created_at timestamp with time zone NOT NULL DEFAULT now(), updated_at timestamp with time zone NOT NULL DEFAULT now(), jira_worklog_sync_enabled boolean DEFAULT false, project_key text);

CREATE TABLE IF NOT EXISTS public.unassigned_activity (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), analysis_result_id uuid NOT NULL, screenshot_id uuid NOT NULL, user_id uuid NOT NULL, "timestamp" timestamp with time zone NOT NULL, window_title text, application_name text, extracted_text text, detected_jira_keys text[], confidence_score numeric, time_spent_seconds integer DEFAULT 0, reason text, manually_assigned boolean DEFAULT false, assigned_task_key text, assigned_by uuid, assigned_at timestamp with time zone, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), organization_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.unassigned_group_members (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), group_id uuid NOT NULL, unassigned_activity_id uuid NOT NULL, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.unassigned_work_groups (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid NOT NULL, group_label text NOT NULL, group_description text, confidence_level text, recommended_action text, suggested_issue_key text, recommendation_reason text, session_count integer NOT NULL DEFAULT 0, total_seconds integer NOT NULL DEFAULT 0, is_assigned boolean DEFAULT false, assigned_to_issue_key text, assigned_at timestamp with time zone, assigned_by uuid, clustering_metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), organization_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.user_jira_issues_cache (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid NOT NULL, issue_key text NOT NULL, summary text NOT NULL, status text NOT NULL, project_key text NOT NULL, issue_type text, updated_at timestamp with time zone DEFAULT now(), cached_at timestamp with time zone DEFAULT now(), organization_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.users (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), atlassian_account_id text NOT NULL, email text, display_name text, supabase_user_id uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), last_sync_at timestamp with time zone, is_active boolean DEFAULT true, settings jsonb DEFAULT '{}'::jsonb, organization_id uuid NOT NULL, desktop_logged_in boolean DEFAULT false, desktop_last_heartbeat timestamp with time zone, desktop_app_version text);

CREATE TABLE IF NOT EXISTS public.worklog_sync (id uuid NOT NULL DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id uuid NOT NULL, issue_key text NOT NULL, jira_worklog_id text NOT NULL, last_synced_seconds integer NOT NULL DEFAULT 0, started_at timestamp with time zone, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), created_as_user boolean NOT NULL DEFAULT false);

CREATE TABLE IF NOT EXISTS public.worklogs (id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(), user_id uuid NOT NULL, analysis_result_id uuid, jira_worklog_id text NOT NULL, jira_issue_key text NOT NULL, time_spent_seconds integer NOT NULL, started_at timestamp with time zone NOT NULL, description text, created_at timestamp with time zone DEFAULT now(), sync_status text DEFAULT 'synced'::text, error_message text, organization_id uuid NOT NULL);


-- CONSTRAINTS
DO $$ BEGIN
    ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_records ADD CONSTRAINT activity_records_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.analysis_results ADD CONSTRAINT analysis_results_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.app_releases ADD CONSTRAINT app_releases_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.application_classifications ADD CONSTRAINT application_classifications_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.created_issues_log ADD CONSTRAINT created_issues_log_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.feedback ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_cooldowns ADD CONSTRAINT notification_cooldowns_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.ocr_test_results ADD CONSTRAINT ocr_test_results_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_settings ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.project_settings ADD CONSTRAINT project_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.screenshots ADD CONSTRAINT screenshots_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.tracking_settings ADD CONSTRAINT tracking_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_group_members ADD CONSTRAINT unassigned_group_members_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_work_groups ADD CONSTRAINT unassigned_work_groups_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.user_jira_issues_cache ADD CONSTRAINT user_jira_issues_cache_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklog_sync ADD CONSTRAINT worklog_sync_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklogs ADD CONSTRAINT worklogs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.app_releases ADD CONSTRAINT app_releases_version_platform_key UNIQUE (version, platform);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_cooldowns ADD CONSTRAINT notification_cooldowns_user_id_notification_type_key UNIQUE (user_id, notification_type);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_user_id_organization_id_key UNIQUE (user_id, organization_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_settings ADD CONSTRAINT organization_settings_organization_id_key UNIQUE (organization_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_jira_cloud_id_key UNIQUE (jira_cloud_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_analysis_result_id_key UNIQUE (analysis_result_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_group_members ADD CONSTRAINT unassigned_group_members_group_activity_unique UNIQUE (group_id, unassigned_activity_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.user_jira_issues_cache ADD CONSTRAINT user_jira_issues_cache_user_org_issue_key UNIQUE (user_id, organization_id, issue_key);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_atlassian_account_id_key UNIQUE (atlassian_account_id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklog_sync ADD CONSTRAINT uq_worklog_sync_org_user_issue UNIQUE (organization_id, user_id, issue_key);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_records ADD CONSTRAINT activity_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'analyzed'::text, 'failed'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_records ADD CONSTRAINT activity_records_classification_check CHECK ((classification = ANY (ARRAY['productive'::text, 'non_productive'::text, 'private'::text, 'unknown'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.analysis_results ADD CONSTRAINT analysis_results_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric)));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.analysis_results ADD CONSTRAINT analysis_results_work_type_check CHECK ((work_type = ANY (ARRAY['office'::text, 'non-office'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.application_classifications ADD CONSTRAINT application_classifications_match_by_check CHECK ((match_by = ANY (ARRAY['process'::text, 'url'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.application_classifications ADD CONSTRAINT application_classifications_classification_check CHECK ((classification = ANY (ARRAY['productive'::text, 'non_productive'::text, 'private'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.documents ADD CONSTRAINT documents_file_type_check CHECK ((file_type = ANY (ARRAY['pdf'::text, 'docx'::text, 'doc'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.documents ADD CONSTRAINT documents_processing_status_check CHECK ((processing_status = ANY (ARRAY['uploaded'::text, 'extracting'::text, 'analyzing'::text, 'completed'::text, 'failed'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.feedback ADD CONSTRAINT feedback_category_check CHECK ((category = ANY (ARRAY['bug'::text, 'feature_request'::text, 'improvement'::text, 'question'::text, 'other'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_logs ADD CONSTRAINT valid_status CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'sent'::text, 'failed'::text, 'bounced'::text, 'skipped'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_logs ADD CONSTRAINT valid_notification_type CHECK ((notification_type = ANY (ARRAY['login_reminder'::text, 'download_reminder'::text, 'new_version'::text, 'inactivity_alert'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.ocr_test_results ADD CONSTRAINT ocr_test_results_ocr_method_check CHECK (((ocr_method IS NULL) OR (((ocr_method)::text ~* '^[a-z0-9_]+$'::text) AND (length((ocr_method)::text) <= 50))));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.ocr_test_results ADD CONSTRAINT ocr_test_results_ocr_confidence_check CHECK (((ocr_confidence >= (0)::numeric) AND (ocr_confidence <= (1)::numeric)));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'member'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_tier_check CHECK ((subscription_tier = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['active'::text, 'trial'::text, 'suspended'::text, 'cancelled'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.screenshots ADD CONSTRAINT screenshots_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'analyzed'::text, 'failed'::text, 'deleted'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.tracking_settings ADD CONSTRAINT tracking_settings_tracking_mode_check CHECK ((tracking_mode = ANY (ARRAY['interval'::text, 'event'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.tracking_settings ADD CONSTRAINT tracking_settings_idle_threshold_check CHECK (((idle_threshold_seconds >= 60) AND (idle_threshold_seconds <= 1800)));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.tracking_settings ADD CONSTRAINT tracking_settings_interval_check CHECK (((screenshot_interval_seconds >= 60) AND (screenshot_interval_seconds <= 3600)));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.tracking_settings ADD CONSTRAINT tracking_settings_threshold_check CHECK (((non_work_threshold_percent >= 0) AND (non_work_threshold_percent <= 100)));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_reason_check CHECK ((reason = ANY (ARRAY['no_task_key'::text, 'invalid_task_key'::text, 'low_confidence'::text, 'manual_override'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_work_groups ADD CONSTRAINT unassigned_work_groups_confidence_level_check CHECK ((confidence_level = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_work_groups ADD CONSTRAINT unassigned_work_groups_recommended_action_check CHECK ((recommended_action = ANY (ARRAY['assign_to_existing'::text, 'create_new_issue'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklogs ADD CONSTRAINT worklogs_sync_status_check CHECK ((sync_status = ANY (ARRAY['synced'::text, 'pending'::text, 'failed'::text])));
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_log ADD CONSTRAINT activity_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_records ADD CONSTRAINT activity_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.activity_records ADD CONSTRAINT activity_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.analysis_results ADD CONSTRAINT analysis_results_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.analysis_results ADD CONSTRAINT analysis_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.analysis_results ADD CONSTRAINT analysis_results_screenshot_id_fkey FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.app_releases ADD CONSTRAINT app_releases_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.application_classifications ADD CONSTRAINT application_classifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.created_issues_log ADD CONSTRAINT created_issues_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.created_issues_log ADD CONSTRAINT created_issues_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.documents ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.documents ADD CONSTRAINT documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.feedback ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_cooldowns ADD CONSTRAINT notification_cooldowns_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.notification_preferences ADD CONSTRAINT notification_preferences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.organization_settings ADD CONSTRAINT organization_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.project_settings ADD CONSTRAINT project_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.project_settings ADD CONSTRAINT project_settings_configured_by_fkey FOREIGN KEY (configured_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.screenshots ADD CONSTRAINT screenshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.screenshots ADD CONSTRAINT screenshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_analysis_result_id_fkey FOREIGN KEY (analysis_result_id) REFERENCES analysis_results(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_screenshot_id_fkey FOREIGN KEY (screenshot_id) REFERENCES screenshots(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_activity ADD CONSTRAINT unassigned_activity_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_group_members ADD CONSTRAINT unassigned_group_members_unassigned_activity_id_fkey FOREIGN KEY (unassigned_activity_id) REFERENCES unassigned_activity(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_group_members ADD CONSTRAINT unassigned_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES unassigned_work_groups(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_work_groups ADD CONSTRAINT unassigned_work_groups_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_work_groups ADD CONSTRAINT unassigned_work_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.unassigned_work_groups ADD CONSTRAINT unassigned_work_groups_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.user_jira_issues_cache ADD CONSTRAINT user_jira_issues_cache_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.user_jira_issues_cache ADD CONSTRAINT user_jira_issues_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_supabase_user_id_fkey FOREIGN KEY (supabase_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklogs ADD CONSTRAINT worklogs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklogs ADD CONSTRAINT worklogs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;
DO $$ BEGIN
    ALTER TABLE public.worklogs ADD CONSTRAINT worklogs_analysis_result_id_fkey FOREIGN KEY (analysis_result_id) REFERENCES analysis_results(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;


-- INDEXES
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON public.activity_log USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_org_id ON public.activity_log USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_batch_timestamp ON public.activity_records USING btree (batch_timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_org_user_work_date ON public.activity_records USING btree (organization_id, user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_activity_status ON public.activity_records USING btree (status);
CREATE INDEX IF NOT EXISTS idx_activity_user_timestamp ON public.activity_records USING btree (user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_activity_user_work_date ON public.activity_records USING btree (user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_analysis_results_assignment_group ON public.analysis_results USING btree (assignment_group_id) WHERE (assignment_group_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_analysis_results_manual_assignment ON public.analysis_results USING btree (manually_assigned, assignment_group_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_org_id ON public.analysis_results USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_org_user_date ON public.analysis_results USING btree (organization_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_org_work_type ON public.analysis_results USING btree (organization_id, work_type) WHERE (work_type = 'office'::text);
CREATE INDEX IF NOT EXISTS idx_analysis_results_reassigned ON public.analysis_results USING btree (reassigned_from) WHERE (reassigned_from IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_analysis_results_screenshot_id ON public.analysis_results USING btree (screenshot_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_unassigned ON public.analysis_results USING btree (user_id, active_task_key) WHERE (active_task_key IS NULL);
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_date_unassigned ON public.analysis_results USING btree (user_id, created_at DESC) WHERE ((active_task_key IS NULL) AND (work_type = 'office'::text));
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON public.analysis_results USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_work_type ON public.analysis_results USING btree (work_type);
CREATE INDEX IF NOT EXISTS idx_analysis_results_worklog ON public.analysis_results USING btree (worklog_created, user_id);
CREATE INDEX IF NOT EXISTS idx_app_releases_created_by ON public.app_releases USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_app_releases_latest ON public.app_releases USING btree (platform, is_latest) WHERE ((is_latest = true) AND (is_active = true));
CREATE INDEX IF NOT EXISTS idx_app_releases_platform ON public.app_releases USING btree (platform);
CREATE INDEX IF NOT EXISTS idx_app_releases_version ON public.app_releases USING btree (version, platform);
CREATE INDEX IF NOT EXISTS idx_app_class_classification ON public.application_classifications USING btree (classification);
CREATE INDEX IF NOT EXISTS idx_app_class_default ON public.application_classifications USING btree (is_default) WHERE (is_default = true);
CREATE INDEX IF NOT EXISTS idx_app_class_identifier ON public.application_classifications USING btree (identifier);
CREATE INDEX IF NOT EXISTS idx_app_class_match_by ON public.application_classifications USING btree (match_by);
CREATE INDEX IF NOT EXISTS idx_app_class_org ON public.application_classifications USING btree (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_class_unique_global ON public.application_classifications USING btree (identifier, match_by) WHERE ((organization_id IS NULL) AND (project_key IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_class_unique_org ON public.application_classifications USING btree (organization_id, identifier, match_by) WHERE ((organization_id IS NOT NULL) AND (project_key IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_class_unique_project ON public.application_classifications USING btree (organization_id, project_key, identifier, match_by) WHERE ((organization_id IS NOT NULL) AND (project_key IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_created_issues_log_org_id ON public.created_issues_log USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_created_issues_user ON public.created_issues_log USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_org_status ON public.documents USING btree (organization_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents USING btree (processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback USING btree (category);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback USING btree (jira_creation_status);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.feedback USING btree (atlassian_account_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_cooldowns_user_type ON public.notification_cooldowns USING btree (user_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_org_status ON public.notification_logs USING btree (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_pending ON public.notification_logs USING btree (status) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_type ON public.notification_logs USING btree (user_id, notification_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_test_created_at ON public.ocr_test_results USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_test_method ON public.ocr_test_results USING btree (ocr_method);
CREATE INDEX IF NOT EXISTS idx_ocr_test_timestamp ON public.ocr_test_results USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_ocr_test_user_id ON public.ocr_test_results USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.organization_members USING btree (organization_id, role);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_org_settings_org_id ON public.organization_settings USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations USING btree (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_organizations_cloud_id ON public.organizations USING btree (jira_cloud_id);
CREATE INDEX IF NOT EXISTS idx_project_settings_configured_by ON public.project_settings USING btree (configured_by);
CREATE INDEX IF NOT EXISTS idx_project_settings_org_id ON public.project_settings USING btree (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_settings_org_project ON public.project_settings USING btree (organization_id, project_key);
CREATE INDEX IF NOT EXISTS idx_screenshots_duration ON public.screenshots USING btree (user_id, duration_seconds) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_screenshots_org_id ON public.screenshots USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_org_project ON public.screenshots USING btree (organization_id, project_key, "timestamp" DESC) WHERE ((project_key IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_screenshots_org_time_range ON public.screenshots USING btree (organization_id, user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_screenshots_org_user_date ON public.screenshots USING btree (organization_id, user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_org_user_work_date ON public.screenshots USING btree (organization_id, user_id, work_date DESC) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_screenshots_retry ON public.screenshots USING btree (status, retry_count, updated_at) WHERE (status = 'failed'::text);
CREATE INDEX IF NOT EXISTS idx_screenshots_status ON public.screenshots USING btree (status);
CREATE INDEX IF NOT EXISTS idx_screenshots_time_range ON public.screenshots USING btree (user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON public.screenshots USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_timestamp ON public.screenshots USING btree (user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_work_date ON public.screenshots USING btree (user_id, work_date DESC) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_tracking_settings_org_project ON public.tracking_settings USING btree (organization_id, project_key);
CREATE INDEX IF NOT EXISTS idx_tracking_settings_organization_id ON public.tracking_settings USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_assigned_by ON public.unassigned_activity USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_manually_assigned ON public.unassigned_activity USING btree (manually_assigned);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_org_id ON public.unassigned_activity USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_screenshot_id ON public.unassigned_activity USING btree (screenshot_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_timestamp ON public.unassigned_activity USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_user_id ON public.unassigned_activity USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_activity_id ON public.unassigned_group_members USING btree (unassigned_activity_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_group_id ON public.unassigned_group_members USING btree (group_id);
CREATE UNIQUE INDEX IF NOT EXISTS unassigned_group_members_group_activity_unique ON public.unassigned_group_members USING btree (group_id, unassigned_activity_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_created_at ON public.unassigned_work_groups USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_is_assigned ON public.unassigned_work_groups USING btree (is_assigned);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_user_id ON public.unassigned_work_groups USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_work_groups_assigned_by ON public.unassigned_work_groups USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS idx_unassigned_work_groups_org_id ON public.unassigned_work_groups USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_cached_at ON public.user_jira_issues_cache USING btree (cached_at);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_status ON public.user_jira_issues_cache USING btree (status);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_user_id ON public.user_jira_issues_cache USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_user_updated ON public.user_jira_issues_cache USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_jira_issues_cache_org_id ON public.user_jira_issues_cache USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_atlassian_account_id ON public.users USING btree (atlassian_account_id);
CREATE INDEX IF NOT EXISTS idx_users_desktop_last_heartbeat ON public.users USING btree (desktop_last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_users_desktop_logged_in ON public.users USING btree (desktop_logged_in) WHERE (desktop_logged_in = true);
CREATE INDEX IF NOT EXISTS idx_users_org_active ON public.users USING btree (organization_id, is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON public.users USING btree (supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_worklog_sync_issue ON public.worklog_sync USING btree (issue_key);
CREATE INDEX IF NOT EXISTS idx_worklog_sync_org ON public.worklog_sync USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_worklog_sync_user ON public.worklog_sync USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_worklog_sync_org_user_issue ON public.worklog_sync USING btree (organization_id, user_id, issue_key);
CREATE INDEX IF NOT EXISTS idx_worklogs_analysis_result_id ON public.worklogs USING btree (analysis_result_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_jira_worklog_id ON public.worklogs USING btree (jira_worklog_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_org_id ON public.worklogs USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_org_user ON public.worklogs USING btree (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_started_at ON public.worklogs USING btree (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worklogs_user_id ON public.worklogs USING btree (user_id);


-- TRIGGERS
-- NOTE: Skipped 1 webhook triggers that require supabase_functions schema
-- Skipped: BRD Processing
-- To enable these, go to Supabase Dashboard > Database > Webhooks

CREATE TRIGGER on_activity_record_insert AFTER INSERT ON public.activity_records REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION notify_activity_webhook();
CREATE TRIGGER trigger_activity_compute_work_date BEFORE INSERT OR UPDATE ON public.activity_records FOR EACH ROW EXECUTE FUNCTION compute_activity_work_date();
CREATE TRIGGER trigger_activity_records_updated_at BEFORE UPDATE ON public.activity_records FOR EACH ROW EXECUTE FUNCTION update_activity_records_updated_at();
CREATE TRIGGER trigger_auto_save_unassigned AFTER INSERT OR UPDATE ON public.analysis_results FOR EACH ROW EXECUTE FUNCTION auto_save_unassigned_activity();
CREATE TRIGGER trigger_update_app_releases_updated_at BEFORE UPDATE ON public.app_releases FOR EACH ROW EXECUTE FUNCTION update_app_releases_updated_at();
CREATE TRIGGER trigger_update_latest_release AFTER INSERT OR UPDATE OF is_latest ON public.app_releases FOR EACH ROW WHEN ((new.is_latest = true)) EXECUTE FUNCTION update_latest_release();
CREATE TRIGGER trigger_app_classifications_updated_at BEFORE UPDATE ON public.application_classifications FOR EACH ROW EXECUTE FUNCTION update_app_classifications_updated_at();
CREATE TRIGGER trigger_update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at();
CREATE TRIGGER trigger_update_notification_logs_updated_at BEFORE UPDATE ON public.notification_logs FOR EACH ROW EXECUTE FUNCTION update_notification_logs_updated_at();
CREATE TRIGGER trigger_update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION update_notification_preferences_updated_at();
CREATE TRIGGER trigger_update_org_settings_updated_at BEFORE UPDATE ON public.organization_settings FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();
CREATE TRIGGER trigger_update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();
CREATE TRIGGER trigger_project_settings_updated_at BEFORE UPDATE ON public.project_settings FOR EACH ROW EXECUTE FUNCTION update_project_settings_updated_at();
CREATE TRIGGER on_screenshot_insert AFTER INSERT ON public.screenshots FOR EACH ROW WHEN ((new.status = 'pending'::text)) EXECUTE FUNCTION notify_screenshot_webhook();
CREATE TRIGGER trigger_calculate_duration BEFORE INSERT OR UPDATE ON public.screenshots FOR EACH ROW EXECUTE FUNCTION calculate_screenshot_duration();
CREATE TRIGGER trigger_compute_work_date BEFORE INSERT OR UPDATE ON public.screenshots FOR EACH ROW EXECUTE FUNCTION compute_work_date();
CREATE TRIGGER trigger_update_tracking_settings_updated_at BEFORE UPDATE ON public.tracking_settings FOR EACH ROW EXECUTE FUNCTION update_tracking_settings_updated_at();
CREATE TRIGGER trigger_update_unassigned_groups_updated_at BEFORE UPDATE ON public.unassigned_work_groups FOR EACH ROW EXECUTE FUNCTION update_unassigned_groups_updated_at();
CREATE TRIGGER update_user_jira_cache_cached_at BEFORE INSERT OR UPDATE ON public.user_jira_issues_cache FOR EACH ROW EXECUTE FUNCTION update_cached_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_worklog_sync_updated_at BEFORE UPDATE ON public.worklog_sync FOR EACH ROW EXECUTE FUNCTION update_worklog_sync_updated_at();


-- VIEWS
CREATE OR REPLACE VIEW public.activity_sessions AS  SELECT s.id,
    s.user_id,
    s.organization_id,
    s.start_time,
    s.end_time,
    COALESCE(s.duration_seconds, 300) AS duration_seconds,
    s.window_title,
    s.application_name,
    s."timestamp" AS captured_at,
    s.storage_path,
    s.thumbnail_url,
    s.project_key AS screenshot_project_key,
    ar.active_task_key,
    COALESCE(ar.active_project_key, s.project_key) AS project_key,
    ar.work_type,
    ar.confidence_score,
    ar.id AS analysis_result_id
   FROM (screenshots s
     LEFT JOIN analysis_results ar ON ((ar.screenshot_id = s.id)))
  WHERE (s.deleted_at IS NULL)
  ORDER BY s.start_time DESC;

CREATE OR REPLACE VIEW public.daily_time_summary AS  SELECT user_id,
    organization_id,
    user_display_name,
    work_date,
    project_key,
    task_key,
    work_type,
    sum(session_count) AS session_count,
    sum(total_seconds) AS total_seconds,
    round((sum(total_seconds) / 3600.0), 2) AS total_hours,
    avg(avg_confidence) AS avg_confidence
   FROM ( SELECT ar.user_id,
            ar.organization_id,
            u.display_name AS user_display_name,
            COALESCE(s.work_date, date((s."timestamp" AT TIME ZONE 'UTC'::text))) AS work_date,
            ar.active_project_key AS project_key,
            ar.active_task_key AS task_key,
            ar.work_type,
            count(*) AS session_count,
            sum(COALESCE(s.duration_seconds, ar.time_spent_seconds)) AS total_seconds,
            avg(ar.confidence_score) AS avg_confidence
           FROM ((analysis_results ar
             JOIN screenshots s ON ((ar.screenshot_id = s.id)))
             LEFT JOIN users u ON ((ar.user_id = u.id)))
          WHERE ((s.deleted_at IS NULL) AND (ar.work_type = 'office'::text))
          GROUP BY ar.user_id, ar.organization_id, u.display_name, COALESCE(s.work_date, date((s."timestamp" AT TIME ZONE 'UTC'::text))), ar.active_project_key, ar.active_task_key, ar.work_type
        UNION ALL
         SELECT act.user_id,
            act.organization_id,
            u.display_name AS user_display_name,
            act.work_date,
            act.project_key,
            act.user_assigned_issue_key AS task_key,
            'office'::text AS work_type,
            1 AS session_count,
            act.duration_seconds AS total_seconds,
            NULL::numeric AS avg_confidence
           FROM (activity_records act
             LEFT JOIN users u ON ((act.user_id = u.id)))
          WHERE ((act.classification = 'productive'::text) AND (act.status = 'analyzed'::text) AND (act.work_date IS NOT NULL))) combined
  GROUP BY user_id, organization_id, user_display_name, work_date, project_key, task_key, work_type
  ORDER BY work_date DESC, (sum(total_seconds)) DESC;

CREATE OR REPLACE VIEW public.monthly_time_summary AS  SELECT user_id,
    organization_id,
    user_display_name,
    (date_trunc('month'::text, (work_date)::timestamp without time zone))::date AS month_start,
    project_key,
    task_key,
    work_type,
    sum(session_count) AS session_count,
    sum(total_seconds) AS total_seconds,
    round((sum(total_seconds) / 3600.0), 2) AS total_hours,
    avg(avg_confidence) AS avg_confidence
   FROM ( SELECT ar.user_id,
            ar.organization_id,
            u.display_name AS user_display_name,
            COALESCE(s.work_date, date((s."timestamp" AT TIME ZONE 'UTC'::text))) AS work_date,
            ar.active_project_key AS project_key,
            ar.active_task_key AS task_key,
            ar.work_type,
            count(*) AS session_count,
            sum(COALESCE(s.duration_seconds, ar.time_spent_seconds)) AS total_seconds,
            avg(ar.confidence_score) AS avg_confidence
           FROM ((analysis_results ar
             JOIN screenshots s ON ((ar.screenshot_id = s.id)))
             LEFT JOIN users u ON ((ar.user_id = u.id)))
          WHERE ((s.deleted_at IS NULL) AND (ar.work_type = 'office'::text))
          GROUP BY ar.user_id, ar.organization_id, u.display_name, COALESCE(s.work_date, date((s."timestamp" AT TIME ZONE 'UTC'::text))), ar.active_project_key, ar.active_task_key, ar.work_type
        UNION ALL
         SELECT act.user_id,
            act.organization_id,
            u.display_name AS user_display_name,
            act.work_date,
            act.project_key,
            act.user_assigned_issue_key AS task_key,
            'office'::text AS work_type,
            1 AS session_count,
            act.duration_seconds AS total_seconds,
            NULL::numeric AS avg_confidence
           FROM (activity_records act
             LEFT JOIN users u ON ((act.user_id = u.id)))
          WHERE ((act.classification = 'productive'::text) AND (act.status = 'analyzed'::text) AND (act.work_date IS NOT NULL))) combined
  GROUP BY user_id, organization_id, user_display_name, (date_trunc('month'::text, (work_date)::timestamp without time zone)), project_key, task_key, work_type
  ORDER BY ((date_trunc('month'::text, (work_date)::timestamp without time zone))::date) DESC, (sum(total_seconds)) DESC;

CREATE OR REPLACE VIEW public.ocr_test_summary AS  SELECT ocr_method,
    count(*) AS total_tests,
    count(
        CASE
            WHEN success THEN 1
            ELSE NULL::integer
        END) AS successful_tests,
    round(avg(ocr_confidence), 2) AS avg_confidence,
    round(avg(processing_time_ms), 0) AS avg_processing_ms,
    round(avg(ocr_line_count), 0) AS avg_line_count,
    min(created_at) AS first_test,
    max(created_at) AS last_test
   FROM ocr_test_results
  GROUP BY ocr_method
  ORDER BY (count(*)) DESC;

CREATE OR REPLACE VIEW public.project_time_summary AS  SELECT COALESCE(ar.active_project_key, s.project_key) AS project_key,
    ar.organization_id,
    sum(COALESCE(s.duration_seconds, 300)) AS total_seconds,
    count(DISTINCT ar.user_id) AS unique_users,
    count(*) AS total_sessions,
    round(((sum(COALESCE(s.duration_seconds, 300)))::numeric / 3600.0), 2) AS total_hours
   FROM (analysis_results ar
     JOIN screenshots s ON ((ar.screenshot_id = s.id)))
  WHERE ((s.deleted_at IS NULL) AND (COALESCE(ar.active_project_key, s.project_key) IS NOT NULL))
  GROUP BY COALESCE(ar.active_project_key, s.project_key), ar.organization_id
  ORDER BY (sum(COALESCE(s.duration_seconds, 300))) DESC;

CREATE OR REPLACE VIEW public.team_analytics_summary AS  SELECT ar.organization_id,
    date(s."timestamp") AS work_date,
    count(DISTINCT ar.user_id) AS active_users,
    sum(COALESCE(s.duration_seconds, 300)) AS total_team_seconds,
    round(((sum(COALESCE(s.duration_seconds, 300)))::numeric / 3600.0), 2) AS total_team_hours,
    round((avg(COALESCE(s.duration_seconds, 300)) / 3600.0), 2) AS avg_hours_per_session,
    count(DISTINCT ar.active_task_key) AS unique_issues_worked,
    count(*) AS total_screenshots,
    count(DISTINCT COALESCE(ar.active_project_key, s.project_key)) AS active_projects,
    array_agg(DISTINCT COALESCE(ar.active_project_key, s.project_key)) FILTER (WHERE (COALESCE(ar.active_project_key, s.project_key) IS NOT NULL)) AS project_keys
   FROM (analysis_results ar
     JOIN screenshots s ON ((s.id = ar.screenshot_id)))
  WHERE ((ar.work_type = 'office'::text) AND (s.deleted_at IS NULL))
  GROUP BY ar.organization_id, (date(s."timestamp"))
  ORDER BY (date(s."timestamp")) DESC;

CREATE OR REPLACE VIEW public.team_work_type_analytics AS  SELECT ar.organization_id,
    date(s."timestamp") AS analysis_date,
    count(*) FILTER (WHERE (ar.work_type = 'office'::text)) AS office_screenshots,
    count(*) FILTER (WHERE (ar.work_type = 'non-office'::text)) AS non_office_screenshots,
    count(*) AS total_screenshots,
    round((((count(*) FILTER (WHERE (ar.work_type = 'office'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS office_percentage,
    round((((count(*) FILTER (WHERE (ar.work_type = 'non-office'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS non_office_percentage,
    count(DISTINCT ar.user_id) AS active_users
   FROM (analysis_results ar
     JOIN screenshots s ON ((s.id = ar.screenshot_id)))
  GROUP BY ar.organization_id, (date(s."timestamp"))
  ORDER BY (date(s."timestamp")) DESC;

CREATE OR REPLACE VIEW public.unassigned_activity_summary AS  SELECT ua.user_id,
    ua.organization_id,
    u.email AS user_email,
    u.display_name AS user_name,
    count(*) AS unassigned_count,
    sum(ua.time_spent_seconds) AS total_unassigned_seconds,
    round(((sum(ua.time_spent_seconds))::numeric / 3600.0), 2) AS total_unassigned_hours,
    count(*) FILTER (WHERE (ua.manually_assigned = true)) AS manually_assigned_count,
    count(*) FILTER (WHERE (ua.manually_assigned = false)) AS pending_assignment_count
   FROM (unassigned_activity ua
     JOIN users u ON ((u.id = ua.user_id)))
  GROUP BY ua.user_id, ua.organization_id, u.email, u.display_name
  ORDER BY (sum(ua.time_spent_seconds)) DESC;

CREATE OR REPLACE VIEW public.user_activity_summary AS  SELECT ar.user_id,
    ar.organization_id,
    sum(COALESCE(s.duration_seconds, 300)) AS total_seconds,
    count(*) AS total_screenshots,
    count(DISTINCT ar.active_task_key) AS unique_tasks,
    min(s."timestamp") AS first_activity,
    max(s."timestamp") AS last_activity
   FROM (analysis_results ar
     JOIN screenshots s ON ((ar.screenshot_id = s.id)))
  WHERE (s.deleted_at IS NULL)
  GROUP BY ar.user_id, ar.organization_id;

CREATE OR REPLACE VIEW public.weekly_time_summary AS  SELECT user_id,
    organization_id,
    user_display_name,
    (date_trunc('week'::text, (work_date)::timestamp without time zone))::date AS week_start,
    project_key,
    task_key,
    work_type,
    sum(session_count) AS session_count,
    sum(total_seconds) AS total_seconds,
    round((sum(total_seconds) / 3600.0), 2) AS total_hours,
    avg(avg_confidence) AS avg_confidence
   FROM ( SELECT ar.user_id,
            ar.organization_id,
            u.display_name AS user_display_name,
            COALESCE(s.work_date, date((s."timestamp" AT TIME ZONE 'UTC'::text))) AS work_date,
            ar.active_project_key AS project_key,
            ar.active_task_key AS task_key,
            ar.work_type,
            count(*) AS session_count,
            sum(COALESCE(s.duration_seconds, ar.time_spent_seconds)) AS total_seconds,
            avg(ar.confidence_score) AS avg_confidence
           FROM ((analysis_results ar
             JOIN screenshots s ON ((ar.screenshot_id = s.id)))
             LEFT JOIN users u ON ((ar.user_id = u.id)))
          WHERE ((s.deleted_at IS NULL) AND (ar.work_type = 'office'::text))
          GROUP BY ar.user_id, ar.organization_id, u.display_name, COALESCE(s.work_date, date((s."timestamp" AT TIME ZONE 'UTC'::text))), ar.active_project_key, ar.active_task_key, ar.work_type
        UNION ALL
         SELECT act.user_id,
            act.organization_id,
            u.display_name AS user_display_name,
            act.work_date,
            act.project_key,
            act.user_assigned_issue_key AS task_key,
            'office'::text AS work_type,
            1 AS session_count,
            act.duration_seconds AS total_seconds,
            NULL::numeric AS avg_confidence
           FROM (activity_records act
             LEFT JOIN users u ON ((act.user_id = u.id)))
          WHERE ((act.classification = 'productive'::text) AND (act.status = 'analyzed'::text) AND (act.work_date IS NOT NULL))) combined
  GROUP BY user_id, organization_id, user_display_name, (date_trunc('week'::text, (work_date)::timestamp without time zone)), project_key, task_key, work_type
  ORDER BY ((date_trunc('week'::text, (work_date)::timestamp without time zone))::date) DESC, (sum(total_seconds)) DESC;

CREATE OR REPLACE VIEW public.work_type_analytics AS  SELECT ar.user_id,
    ar.organization_id,
    date(s."timestamp") AS analysis_date,
    count(*) FILTER (WHERE (ar.work_type = 'office'::text)) AS office_screenshots,
    count(*) FILTER (WHERE (ar.work_type = 'non-office'::text)) AS non_office_screenshots,
    count(*) AS total_screenshots,
    round((((count(*) FILTER (WHERE (ar.work_type = 'office'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS office_percentage,
    round((((count(*) FILTER (WHERE (ar.work_type = 'non-office'::text)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS non_office_percentage,
    array_agg(DISTINCT s.application_name) FILTER (WHERE (s.application_name IS NOT NULL)) AS applications_used
   FROM (analysis_results ar
     JOIN screenshots s ON ((s.id = ar.screenshot_id)))
  GROUP BY ar.user_id, ar.organization_id, (date(s."timestamp"))
  ORDER BY (date(s."timestamp")) DESC;


-- RLS POLICIES
-- RLS STATUS SUMMARY:
-- Tables with RLS ENABLED (25): activity_log, activity_records, analysis_results, app_releases, application_classifications, created_issues_log, documents, feedback, notification_cooldowns, notification_logs, notification_preferences, ocr_test_results, organization_members, organization_settings, organizations, project_settings, screenshots, tracking_settings, unassigned_activity, unassigned_group_members, unassigned_work_groups, user_jira_issues_cache, users, worklog_sync, worklogs
-- Tables UNRESTRICTED (RLS enabled, no policies) (1): worklog_sync


ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.created_issues_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unassigned_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unassigned_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unassigned_work_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jira_issues_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklog_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_insert_own ON public.activity_log AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY activity_view_own_or_team ON public.activity_log AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY activity_records_insert_own ON public.activity_records AS PERMISSIVE FOR INSERT WITH CHECK ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)));
CREATE POLICY activity_records_select_org ON public.activity_records AS PERMISSIVE FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)))));
CREATE POLICY activity_records_select_own ON public.activity_records AS PERMISSIVE FOR SELECT USING ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)));
CREATE POLICY activity_records_service_role ON public.activity_records AS PERMISSIVE FOR ALL USING ((auth.role() = 'service_role'::text));
CREATE POLICY activity_records_update_own ON public.activity_records AS PERMISSIVE FOR UPDATE USING ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)));
CREATE POLICY analysis_insert_own ON public.analysis_results AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY analysis_update_own ON public.analysis_results AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY analysis_view_own_or_team ON public.analysis_results AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY "Anyone can view active releases" ON public.app_releases AS PERMISSIVE FOR SELECT USING ((is_active = true));
CREATE POLICY app_class_delete_admin ON public.application_classifications AS PERMISSIVE FOR DELETE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY app_class_insert_admin ON public.application_classifications AS PERMISSIVE FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY app_class_select_defaults ON public.application_classifications AS PERMISSIVE FOR SELECT USING (((is_default = true) AND (organization_id IS NULL)));
CREATE POLICY app_class_select_org ON public.application_classifications AS PERMISSIVE FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)))));
CREATE POLICY app_class_service_role ON public.application_classifications AS PERMISSIVE FOR ALL USING ((auth.role() = 'service_role'::text));
CREATE POLICY app_class_update_admin ON public.application_classifications AS PERMISSIVE FOR UPDATE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY created_issues_insert_own ON public.created_issues_log AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY created_issues_view_own_or_team ON public.created_issues_log AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY documents_delete_own ON public.documents AS PERMISSIVE FOR DELETE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY documents_insert_own ON public.documents AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY documents_update_own ON public.documents AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY documents_view_own_or_team ON public.documents AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY "Users can view their own feedback" ON public.feedback AS PERMISSIVE FOR SELECT USING ((atlassian_account_id = ( SELECT (auth.jwt() ->> 'sub'::text))));
CREATE POLICY "Service role full access to notification_cooldowns" ON public.notification_cooldowns AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to notification_logs" ON public.notification_logs AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own notification logs" ON public.notification_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Service role full access to notification_preferences" ON public.notification_preferences AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Service role has full access to OCR test results" ON public.ocr_test_results AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can insert own OCR test results" ON public.ocr_test_results AS PERMISSIVE FOR INSERT WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can view own OCR test results" ON public.ocr_test_results AS PERMISSIVE FOR SELECT USING ((user_id = auth.uid()));
CREATE POLICY admins_delete_members ON public.organization_members AS PERMISSIVE FOR DELETE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ( SELECT user_has_permission('manage_members'::text) AS user_has_permission)));
CREATE POLICY admins_insert_members ON public.organization_members AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ( SELECT user_has_permission('manage_members'::text) AS user_has_permission)));
CREATE POLICY admins_update_members ON public.organization_members AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ( SELECT user_has_permission('manage_members'::text) AS user_has_permission)));
CREATE POLICY users_view_org_members ON public.organization_members AS PERMISSIVE FOR SELECT USING ((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)));
CREATE POLICY admins_update_org_settings ON public.organization_settings AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ( SELECT user_has_permission('manage_settings'::text) AS user_has_permission)));
CREATE POLICY users_view_org_settings ON public.organization_settings AS PERMISSIVE FOR SELECT USING ((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)));
CREATE POLICY admins_update_organization ON public.organizations AS PERMISSIVE FOR UPDATE USING (((id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ( SELECT user_is_admin() AS user_is_admin)));
CREATE POLICY users_view_own_organization ON public.organizations AS PERMISSIVE FOR SELECT USING ((id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)));
CREATE POLICY project_settings_delete_admin ON public.project_settings AS PERMISSIVE FOR DELETE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY project_settings_insert_admin ON public.project_settings AS PERMISSIVE FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY project_settings_select_org ON public.project_settings AS PERMISSIVE FOR SELECT USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)))));
CREATE POLICY project_settings_update_admin ON public.project_settings AS PERMISSIVE FOR UPDATE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY screenshots_delete_own_or_admin ON public.screenshots AS PERMISSIVE FOR DELETE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('delete_screenshots'::text) AS user_has_permission))));
CREATE POLICY screenshots_insert_own ON public.screenshots AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY screenshots_update_own ON public.screenshots AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY screenshots_view_own_or_team ON public.screenshots AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY tracking_settings_delete_admin ON public.tracking_settings AS PERMISSIVE FOR DELETE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY tracking_settings_insert_admin ON public.tracking_settings AS PERMISSIVE FOR INSERT WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY tracking_settings_select_org_and_project ON public.tracking_settings AS PERMISSIVE FOR SELECT USING (((organization_id IS NULL) OR (organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id))))));
CREATE POLICY tracking_settings_update_admin ON public.tracking_settings AS PERMISSIVE FOR UPDATE USING ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))));
CREATE POLICY unassigned_activity_insert_own ON public.unassigned_activity AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY unassigned_activity_update_own ON public.unassigned_activity AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY unassigned_activity_view_own_or_team ON public.unassigned_activity AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY group_members_delete_own ON public.unassigned_group_members AS PERMISSIVE FOR DELETE USING ((group_id IN ( SELECT unassigned_work_groups.id
   FROM unassigned_work_groups
  WHERE ((unassigned_work_groups.organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (unassigned_work_groups.user_id = ( SELECT get_current_user_id() AS get_current_user_id))))));
CREATE POLICY group_members_insert_own ON public.unassigned_group_members AS PERMISSIVE FOR INSERT WITH CHECK ((group_id IN ( SELECT unassigned_work_groups.id
   FROM unassigned_work_groups
  WHERE ((unassigned_work_groups.organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (unassigned_work_groups.user_id = ( SELECT get_current_user_id() AS get_current_user_id))))));
CREATE POLICY group_members_update_own ON public.unassigned_group_members AS PERMISSIVE FOR UPDATE USING ((group_id IN ( SELECT unassigned_work_groups.id
   FROM unassigned_work_groups
  WHERE ((unassigned_work_groups.organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (unassigned_work_groups.user_id = ( SELECT get_current_user_id() AS get_current_user_id))))));
CREATE POLICY group_members_view_own_or_team ON public.unassigned_group_members AS PERMISSIVE FOR SELECT USING ((group_id IN ( SELECT unassigned_work_groups.id
   FROM unassigned_work_groups
  WHERE ((unassigned_work_groups.organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((unassigned_work_groups.user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))))));
CREATE POLICY unassigned_groups_insert_own ON public.unassigned_work_groups AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY unassigned_groups_update_own ON public.unassigned_work_groups AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY unassigned_groups_view_own_or_team ON public.unassigned_work_groups AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY jira_cache_insert_own ON public.user_jira_issues_cache AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY jira_cache_update_own ON public.user_jira_issues_cache AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY jira_cache_view_own_or_team ON public.user_jira_issues_cache AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY users_update_self ON public.users AS PERMISSIVE FOR UPDATE USING ((id = ( SELECT get_current_user_id() AS get_current_user_id)));
CREATE POLICY users_view_self_or_team ON public.users AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));
CREATE POLICY worklogs_insert_own ON public.worklogs AS PERMISSIVE FOR INSERT WITH CHECK (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY worklogs_update_own ON public.worklogs AS PERMISSIVE FOR UPDATE USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND (user_id = ( SELECT get_current_user_id() AS get_current_user_id))));
CREATE POLICY worklogs_view_own_or_team ON public.worklogs AS PERMISSIVE FOR SELECT USING (((organization_id = ( SELECT get_current_user_organization_id() AS get_current_user_organization_id)) AND ((user_id = ( SELECT get_current_user_id() AS get_current_user_id)) OR ( SELECT user_has_permission('view_team_analytics'::text) AS user_has_permission))));


-- STORAGE POLICIES
CREATE POLICY "Service role can manage feedback images" ON storage.objects AS PERMISSIVE FOR ALL USING (((bucket_id = 'feedback-images'::text) AND (auth.role() = 'service_role'::text)));
CREATE POLICY "Service role full access to documents" ON storage.objects AS PERMISSIVE FOR ALL TO service_role USING ((bucket_id = 'documents'::text)) WITH CHECK ((bucket_id = 'documents'::text));
CREATE POLICY "Service role full access to screenshots" ON storage.objects AS PERMISSIVE FOR ALL TO service_role USING ((bucket_id = 'screenshots'::text)) WITH CHECK ((bucket_id = 'screenshots'::text));
CREATE POLICY "Users can delete own documents" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can delete own screenshots" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'screenshots'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can update own documents" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid()))))) WITH CHECK (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can update own screenshots" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'screenshots'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid()))))) WITH CHECK (((bucket_id = 'screenshots'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can upload own documents" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can upload own screenshots" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'screenshots'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can view own documents" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));
CREATE POLICY "Users can view own screenshots" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'screenshots'::text) AND ((storage.foldername(name))[1] = ( SELECT (users.id)::text AS id
   FROM users
  WHERE (users.supabase_user_id = auth.uid())))));

