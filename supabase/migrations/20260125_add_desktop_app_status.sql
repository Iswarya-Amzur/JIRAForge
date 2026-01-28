-- ============================================================================
-- Migration: Add Desktop App Status Tracking
-- ============================================================================
-- Adds fields to track whether the Desktop App is currently logged in and
-- the last heartbeat timestamp for detecting active sessions.
--
-- Created: 2026-01-25
-- ============================================================================

-- Add desktop_logged_in column to track if user is logged into Desktop App
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS desktop_logged_in BOOLEAN DEFAULT FALSE;

-- Add desktop_last_heartbeat to track last activity from Desktop App
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS desktop_last_heartbeat TIMESTAMPTZ;

-- Add desktop_app_version to track which version is being used (optional but useful)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS desktop_app_version TEXT;

-- Create index for efficient queries on logged-in users
CREATE INDEX IF NOT EXISTS idx_users_desktop_logged_in
ON public.users(desktop_logged_in)
WHERE desktop_logged_in = TRUE;

-- Create index for heartbeat queries
CREATE INDEX IF NOT EXISTS idx_users_desktop_last_heartbeat
ON public.users(desktop_last_heartbeat);

-- Add comment for documentation
COMMENT ON COLUMN public.users.desktop_logged_in IS 'Whether user is currently logged into the Desktop App';
COMMENT ON COLUMN public.users.desktop_last_heartbeat IS 'Last heartbeat timestamp from Desktop App (updated every 5 minutes)';
COMMENT ON COLUMN public.users.desktop_app_version IS 'Version of Desktop App being used';
