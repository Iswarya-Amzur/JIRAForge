-- Add user_assigned_issues column to screenshots table
-- This stores the list of "In Progress" Jira issues active at the time of the screenshot
-- Used by AI Server for context-aware task detection

ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS user_assigned_issues JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.screenshots.user_assigned_issues IS 'List of user assigned Jira issues at the time of screenshot';
