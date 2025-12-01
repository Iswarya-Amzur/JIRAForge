-- ============================================
-- Unassigned Work Clustering Tables
-- ============================================
-- This migration creates tables to store AI-clustered groups of unassigned work sessions

-- Table 1: Store AI-generated groups of similar unassigned work
CREATE TABLE IF NOT EXISTS public.unassigned_work_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Group metadata from AI clustering
  group_label TEXT NOT NULL,
  group_description TEXT,
  confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),

  -- AI recommendation
  recommended_action TEXT CHECK (recommended_action IN ('assign_to_existing', 'create_new_issue')),
  suggested_issue_key TEXT,
  recommendation_reason TEXT,

  -- Group statistics
  session_count INTEGER NOT NULL DEFAULT 0,
  total_seconds INTEGER NOT NULL DEFAULT 0,

  -- Assignment tracking
  is_assigned BOOLEAN DEFAULT FALSE,
  assigned_to_issue_key TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE,
  assigned_by UUID REFERENCES users(id),

  -- Additional metadata
  clustering_metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: Junction table linking unassigned activities to groups
CREATE TABLE IF NOT EXISTS public.unassigned_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES unassigned_work_groups(id) ON DELETE CASCADE,
  unassigned_activity_id UUID NOT NULL REFERENCES unassigned_activity(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure each activity belongs to only one group
  UNIQUE(unassigned_activity_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_user_id ON unassigned_work_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_is_assigned ON unassigned_work_groups(is_assigned);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_created_at ON unassigned_work_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_group_id ON unassigned_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_activity_id ON unassigned_group_members(unassigned_activity_id);

-- Add updated_at trigger for unassigned_work_groups
CREATE OR REPLACE FUNCTION update_unassigned_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unassigned_groups_updated_at
  BEFORE UPDATE ON unassigned_work_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_unassigned_groups_updated_at();

-- Add comments for documentation
COMMENT ON TABLE unassigned_work_groups IS 'Stores AI-generated groups of similar unassigned work sessions';
COMMENT ON TABLE unassigned_group_members IS 'Junction table linking unassigned activities to their groups';
COMMENT ON COLUMN unassigned_work_groups.confidence_level IS 'AI confidence in grouping: high, medium, or low';
COMMENT ON COLUMN unassigned_work_groups.recommended_action IS 'AI recommendation: assign_to_existing or create_new_issue';
COMMENT ON COLUMN unassigned_work_groups.clustering_metadata IS 'Additional clustering data from AI (session indices, etc.)';
