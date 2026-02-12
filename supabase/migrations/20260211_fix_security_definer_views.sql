-- Migration: Fix Security Advisor warnings
-- Date: 2026-02-11
-- Description: 
--   1. Changes all views from SECURITY DEFINER to SECURITY INVOKER
--      to ensure RLS policies are enforced for the querying user
--   2. Sets search_path on functions that were missing it
--      to prevent search_path injection attacks
--
-- Affected views (SECURITY DEFINER -> SECURITY INVOKER):
--   - activity_sessions
--   - daily_time_summary
--   - monthly_time_summary  
--   - project_time_summary
--   - team_analytics_summary
--   - team_work_type_analytics
--   - unassigned_activity_summary
--   - user_activity_summary
--   - weekly_time_summary
--   - work_type_analytics
--
-- Affected functions (mutable search_path):
--   - update_feedback_updated_at
--   - notify_screenshot_webhook
--   - update_app_releases_updated_at
--   - update_latest_release
--   - update_project_settings_updated_at
--   - update_worklog_sync_updated_at

-- ============================================================================
-- PART 1: Fix SECURITY DEFINER views
-- ============================================================================

-- Set all views to use SECURITY INVOKER (respects RLS of the calling user)
ALTER VIEW public.activity_sessions SET (security_invoker = on);
ALTER VIEW public.daily_time_summary SET (security_invoker = on);
ALTER VIEW public.monthly_time_summary SET (security_invoker = on);
ALTER VIEW public.project_time_summary SET (security_invoker = on);
ALTER VIEW public.team_analytics_summary SET (security_invoker = on);
ALTER VIEW public.team_work_type_analytics SET (security_invoker = on);
ALTER VIEW public.unassigned_activity_summary SET (security_invoker = on);
ALTER VIEW public.user_activity_summary SET (security_invoker = on);
ALTER VIEW public.weekly_time_summary SET (security_invoker = on);
ALTER VIEW public.work_type_analytics SET (security_invoker = on);

-- Add comment to document the security change
COMMENT ON VIEW public.activity_sessions IS 'User activity sessions with analysis data (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.daily_time_summary IS 'Daily time aggregation per user/project/task (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.monthly_time_summary IS 'Monthly time aggregation per user/project/task (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.project_time_summary IS 'Time aggregation by project (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.team_analytics_summary IS 'Team-level analytics aggregation (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.team_work_type_analytics IS 'Team work type distribution analytics (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.unassigned_activity_summary IS 'Summary of unassigned activity per user (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.user_activity_summary IS 'User activity summary stats (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.weekly_time_summary IS 'Weekly time aggregation per user/project/task (SECURITY INVOKER - respects RLS)';
COMMENT ON VIEW public.work_type_analytics IS 'Work type distribution analytics per user (SECURITY INVOKER - respects RLS)';

-- ============================================================================
-- PART 2: Fix function search_path warnings
-- ============================================================================

-- Set immutable search_path on functions that were missing it
-- Using empty string '' means functions must use fully qualified names (e.g., public.table_name)
-- This prevents search_path injection attacks

ALTER FUNCTION public.update_feedback_updated_at() SET search_path = '';
ALTER FUNCTION public.notify_screenshot_webhook() SET search_path = '';
ALTER FUNCTION public.update_app_releases_updated_at() SET search_path = '';
ALTER FUNCTION public.update_latest_release() SET search_path = '';
ALTER FUNCTION public.update_project_settings_updated_at() SET search_path = '';
ALTER FUNCTION public.update_worklog_sync_updated_at() SET search_path = '';
