-- Migration: Fix search_path for update_worklog_sync_updated_at
-- Date: 2026-02-11
-- Description: Sets immutable search_path on update_worklog_sync_updated_at function
--   that was missed in the previous security fix migration (20260211_fix_security_definer_views.sql)

ALTER FUNCTION public.update_worklog_sync_updated_at() SET search_path = '';
