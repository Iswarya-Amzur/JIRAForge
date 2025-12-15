-- ============================================================================
-- Migration: 023_fix_security_definer_views.sql
-- Description: Fix SECURITY DEFINER views by enabling security_invoker
-- 
-- The views were recreated in migration 022_add_event_based_tracking.sql 
-- which undid the security fixes from 018_fix_security_warnings.sql.
-- This migration re-applies the security_invoker setting to all affected views.
--
-- Issue: Views with SECURITY DEFINER enforce permissions of the view creator
-- instead of the querying user, bypassing RLS policies.
-- 
-- Fix: Set security_invoker = on to respect RLS of the querying user.
-- ============================================================================

-- Fix weekly_time_summary view
ALTER VIEW IF EXISTS public.weekly_time_summary SET (security_invoker = on);

-- Fix activity_sessions view
ALTER VIEW IF EXISTS public.activity_sessions SET (security_invoker = on);

-- Fix project_time_summary view
ALTER VIEW IF EXISTS public.project_time_summary SET (security_invoker = on);

-- Fix team_analytics_summary view
ALTER VIEW IF EXISTS public.team_analytics_summary SET (security_invoker = on);

-- Fix daily_time_summary view
ALTER VIEW IF EXISTS public.daily_time_summary SET (security_invoker = on);

-- Fix monthly_time_summary view
ALTER VIEW IF EXISTS public.monthly_time_summary SET (security_invoker = on);

-- Fix user_activity_summary view
ALTER VIEW IF EXISTS public.user_activity_summary SET (security_invoker = on);

-- ============================================================================
-- Verification: Check that all views have security_invoker enabled
-- ============================================================================
DO $$
DECLARE
  view_record RECORD;
  problem_views TEXT := '';
BEGIN
  FOR view_record IN 
    SELECT c.relname AS view_name
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname IN (
        'weekly_time_summary',
        'activity_sessions', 
        'project_time_summary',
        'team_analytics_summary',
        'daily_time_summary',
        'monthly_time_summary',
        'user_activity_summary'
      )
      AND NOT COALESCE((
        SELECT option_value::boolean 
        FROM pg_options_to_table(c.reloptions) 
        WHERE option_name = 'security_invoker'
      ), false)
  LOOP
    problem_views := problem_views || view_record.view_name || ', ';
  END LOOP;
  
  IF problem_views != '' THEN
    RAISE WARNING 'Views still using SECURITY DEFINER: %', RTRIM(problem_views, ', ');
  ELSE
    RAISE NOTICE 'All views successfully updated to use SECURITY INVOKER';
  END IF;
END $$;
