-- ============================================================================
-- Migration: Add created_as_user flag to worklog_sync
-- ============================================================================
-- Tracks whether each Jira worklog was created in a user's interactive context
-- (api.asUser() — shows the real user's name) or in a scheduled trigger context
-- (api.asApp() — shows the app name "Solutions ATG").
--
-- Used by syncCurrentUserWorklogs to detect and migrate app-created worklogs
-- to show under the user's real name the next time they open the Forge app.
--
-- All existing rows default to FALSE (they were created by the scheduled
-- trigger and will be migrated on next user login to the Forge app).
--
-- Created: 2026-02-27
-- ============================================================================

ALTER TABLE public.worklog_sync
ADD COLUMN IF NOT EXISTS created_as_user BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.worklog_sync.created_as_user IS
  'TRUE if the Jira worklog was created via api.asUser() in an interactive user context '
  '(worklog shows the real user''s name in Jira). '
  'FALSE if created via api.asApp() in a scheduled trigger context '
  '(worklog shows the app name "Solutions ATG"). '
  'When FALSE and a valid user session is available, the worklog will be '
  'deleted and recreated under the user''s real name.';
