-- Migration: Add columns for manual work assignment tracking
-- Run this in your Supabase SQL Editor

-- Add manually_assigned column to track if assignment was done by user
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS manually_assigned BOOLEAN DEFAULT FALSE;

-- Add assignment_group_id to track which sessions were grouped together
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS assignment_group_id UUID;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_analysis_results_unassigned
ON analysis_results(user_id, active_task_key)
WHERE active_task_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_results_manual_assignment
ON analysis_results(manually_assigned, assignment_group_id);

-- Create table to track created issues from unassigned work (optional but useful)
CREATE TABLE IF NOT EXISTS created_issues_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  issue_key VARCHAR(50) NOT NULL,
  issue_summary TEXT,
  assignment_group_id UUID,
  session_count INT,
  total_time_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for created issues lookup
CREATE INDEX IF NOT EXISTS idx_created_issues_user
ON created_issues_log(user_id, created_at DESC);

COMMENT ON COLUMN analysis_results.manually_assigned IS 'True if this session was manually assigned by user (vs auto-assigned by AI)';
COMMENT ON COLUMN analysis_results.assignment_group_id IS 'UUID grouping sessions that were assigned together';
COMMENT ON TABLE created_issues_log IS 'Tracks Jira issues created from grouped unassigned work';
