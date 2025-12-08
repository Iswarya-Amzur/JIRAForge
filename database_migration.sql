-- ============================================================================
-- JIRA Time Tracker Database Migration Script
-- ============================================================================
-- This script recreates the complete database schema for the JIRA Time Tracker
-- application. Run this in your company's Supabase project SQL editor.
--
-- Created: 2025-12-02
-- Source: Personal Supabase account (jira project)
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Required Extensions
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions (if needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- STEP 2: Create Tables (in dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: users
-- Description: User accounts with Atlassian integration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atlassian_account_id TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    supabase_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------------------------
-- Table: screenshots
-- Description: Screenshot capture and storage
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    timestamp TIMESTAMPTZ NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_url TEXT,
    window_title TEXT,
    application_name TEXT,
    file_size_bytes BIGINT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed', 'deleted')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    analyzed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    user_assigned_issues JSONB DEFAULT '[]'::jsonb
);

-- ----------------------------------------------------------------------------
-- Table: analysis_results
-- Description: AI analysis results for screenshots
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    screenshot_id UUID NOT NULL REFERENCES public.screenshots(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    active_task_key TEXT,
    active_project_key TEXT,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
    extracted_text TEXT,
    detected_jira_keys TEXT[],
    is_active_work BOOLEAN DEFAULT true,
    is_idle BOOLEAN DEFAULT false,
    analyzed_by TEXT DEFAULT 'ai',
    ai_model_version TEXT,
    analysis_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    worklog_created BOOLEAN DEFAULT false,
    worklog_id TEXT,
    worklog_created_at TIMESTAMPTZ,
    work_type TEXT NOT NULL CHECK (work_type IN ('office', 'non-office')),
    manually_assigned BOOLEAN DEFAULT false,
    assignment_group_id UUID
);

COMMENT ON COLUMN public.analysis_results.manually_assigned IS 'True if this session was manually assigned by user (vs auto-assigned by AI)';
COMMENT ON COLUMN public.analysis_results.assignment_group_id IS 'UUID grouping sessions that were assigned together';

-- ----------------------------------------------------------------------------
-- Table: unassigned_activity
-- Description: Analysis results with no task key - for future manual assignment feature
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unassigned_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_result_id UUID NOT NULL UNIQUE REFERENCES public.analysis_results(id),
    screenshot_id UUID NOT NULL REFERENCES public.screenshots(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    timestamp TIMESTAMPTZ NOT NULL,
    window_title TEXT,
    application_name TEXT,
    extracted_text TEXT,
    detected_jira_keys TEXT[],
    confidence_score NUMERIC,
    time_spent_seconds INTEGER DEFAULT 0,
    reason TEXT CHECK (reason IN ('no_task_key', 'invalid_task_key', 'low_confidence', 'manual_override')),
    manually_assigned BOOLEAN DEFAULT false,
    assigned_task_key TEXT,
    assigned_by UUID REFERENCES public.users(id),
    assigned_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.unassigned_activity IS 'Analysis results with no task key - for future manual assignment feature';

-- ----------------------------------------------------------------------------
-- Table: unassigned_work_groups
-- Description: Stores AI-generated groups of similar unassigned work sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unassigned_work_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    group_label TEXT NOT NULL,
    group_description TEXT,
    confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
    recommended_action TEXT CHECK (recommended_action IN ('assign_to_existing', 'create_new_issue')),
    suggested_issue_key TEXT,
    recommendation_reason TEXT,
    session_count INTEGER NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    is_assigned BOOLEAN DEFAULT false,
    assigned_to_issue_key TEXT,
    assigned_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES public.users(id),
    clustering_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.unassigned_work_groups IS 'Stores AI-generated groups of similar unassigned work sessions';
COMMENT ON COLUMN public.unassigned_work_groups.confidence_level IS 'AI confidence in grouping: high, medium, or low';
COMMENT ON COLUMN public.unassigned_work_groups.recommended_action IS 'AI recommendation: assign_to_existing or create_new_issue';
COMMENT ON COLUMN public.unassigned_work_groups.clustering_metadata IS 'Additional clustering data from AI (session indices, etc.)';

-- ----------------------------------------------------------------------------
-- Table: unassigned_group_members
-- Description: Junction table linking unassigned activities to their groups
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unassigned_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.unassigned_work_groups(id),
    unassigned_activity_id UUID NOT NULL UNIQUE REFERENCES public.unassigned_activity(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.unassigned_group_members IS 'Junction table linking unassigned activities to their groups';

-- ----------------------------------------------------------------------------
-- Table: created_issues_log
-- Description: Tracks Jira issues created from grouped unassigned work
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.created_issues_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    issue_key VARCHAR(50) NOT NULL,
    issue_summary TEXT,
    assignment_group_id UUID,
    session_count INTEGER,
    total_time_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.created_issues_log IS 'Tracks Jira issues created from grouped unassigned work';
COMMENT ON COLUMN public.created_issues_log.created_at IS 'Timestamp when issue was created (UTC)';

-- ----------------------------------------------------------------------------
-- Table: user_jira_issues_cache
-- Description: Cache of user assigned Jira issues (In Progress/In Review) for AI analysis
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_jira_issues_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    issue_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL,
    project_key TEXT NOT NULL,
    issue_type TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    cached_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, issue_key)
);

COMMENT ON TABLE public.user_jira_issues_cache IS 'Cache of user assigned Jira issues (In Progress/In Review) for AI analysis';
COMMENT ON COLUMN public.user_jira_issues_cache.user_id IS 'Reference to users table';
COMMENT ON COLUMN public.user_jira_issues_cache.issue_key IS 'Jira issue key (e.g., PROJ-123)';
COMMENT ON COLUMN public.user_jira_issues_cache.summary IS 'Issue summary/title';
COMMENT ON COLUMN public.user_jira_issues_cache.status IS 'Current issue status';
COMMENT ON COLUMN public.user_jira_issues_cache.updated_at IS 'When the issue was last updated in Jira';
COMMENT ON COLUMN public.user_jira_issues_cache.cached_at IS 'When this entry was last cached';

-- ----------------------------------------------------------------------------
-- Table: worklogs
-- Description: JIRA worklog entries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worklogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    analysis_result_id UUID REFERENCES public.analysis_results(id),
    jira_worklog_id TEXT NOT NULL,
    jira_issue_key TEXT NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
    error_message TEXT
);

-- ----------------------------------------------------------------------------
-- Table: documents
-- Description: Document uploads for requirement extraction
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'doc')),
    file_size_bytes BIGINT NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    processing_status TEXT DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'extracting', 'analyzing', 'completed', 'failed')),
    extracted_text TEXT,
    parsed_requirements JSONB,
    project_key TEXT,
    created_issues JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ,
    ai_model_version TEXT,
    processing_metadata JSONB DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------------------------
-- Table: activity_log
-- Description: User activity/audit logging
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- STEP 3: Create Indexes
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_atlassian_account_id ON public.users(atlassian_account_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON public.users(supabase_user_id);

-- Screenshots indexes
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON public.screenshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_status ON public.screenshots(status);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_timestamp ON public.screenshots(user_id, timestamp DESC);

-- Analysis results indexes
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON public.analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_screenshot_id ON public.analysis_results(screenshot_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_task_key ON public.analysis_results(active_task_key);
CREATE INDEX IF NOT EXISTS idx_analysis_results_project_key ON public.analysis_results(active_project_key);
CREATE INDEX IF NOT EXISTS idx_analysis_results_work_type ON public.analysis_results(work_type);
CREATE INDEX IF NOT EXISTS idx_analysis_results_worklog ON public.analysis_results(worklog_created, user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_unassigned ON public.analysis_results(user_id, active_task_key) WHERE active_task_key IS NULL;
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_date_unassigned ON public.analysis_results(user_id, created_at DESC) WHERE active_task_key IS NULL AND work_type = 'office';
CREATE INDEX IF NOT EXISTS idx_analysis_results_assignment_group ON public.analysis_results(assignment_group_id) WHERE assignment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analysis_results_manual_assignment ON public.analysis_results(manually_assigned, assignment_group_id);

-- Unassigned activity indexes
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_user_id ON public.unassigned_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_screenshot_id ON public.unassigned_activity(screenshot_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_timestamp ON public.unassigned_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_unassigned_activity_manually_assigned ON public.unassigned_activity(manually_assigned);

-- Unassigned work groups indexes
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_user_id ON public.unassigned_work_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_is_assigned ON public.unassigned_work_groups(is_assigned);
CREATE INDEX IF NOT EXISTS idx_unassigned_groups_created_at ON public.unassigned_work_groups(created_at DESC);

-- Unassigned group members indexes
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_group_id ON public.unassigned_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_activity_id ON public.unassigned_group_members(unassigned_activity_id);

-- User JIRA issues cache indexes
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_user_id ON public.user_jira_issues_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_issue_key ON public.user_jira_issues_cache(issue_key);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_status ON public.user_jira_issues_cache(status);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_cached_at ON public.user_jira_issues_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_user_jira_cache_user_updated ON public.user_jira_issues_cache(user_id, updated_at DESC);

-- Worklogs indexes
CREATE INDEX IF NOT EXISTS idx_worklogs_user_id ON public.worklogs(user_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_issue_key ON public.worklogs(jira_issue_key);
CREATE INDEX IF NOT EXISTS idx_worklogs_jira_worklog_id ON public.worklogs(jira_worklog_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_started_at ON public.worklogs(started_at DESC);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_project_key ON public.documents(project_key);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON public.activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Created issues log indexes
CREATE INDEX IF NOT EXISTS idx_created_issues_user ON public.created_issues_log(user_id, created_at DESC);

-- ============================================================================
-- STEP 4: Enable Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_jira_issues_cache ENABLE ROW LEVEL SECURITY;

-- Note: RLS is intentionally disabled on these tables:
-- - unassigned_activity
-- - created_issues_log
-- - unassigned_work_groups
-- - unassigned_group_members

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT
    USING (auth.uid() = supabase_user_id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    USING (auth.uid() = supabase_user_id)
    WITH CHECK (auth.uid() = supabase_user_id);

CREATE POLICY "Service role can manage all users" ON public.users
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- Screenshots policies
CREATE POLICY "Users can view own screenshots" ON public.screenshots
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can insert own screenshots" ON public.screenshots
    FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can update own screenshots" ON public.screenshots
    FOR UPDATE
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can delete own screenshots" ON public.screenshots
    FOR DELETE
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Service role can manage all screenshots" ON public.screenshots
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- Analysis results policies
CREATE POLICY "Users can view own analysis results" ON public.analysis_results
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can insert own analysis results" ON public.analysis_results
    FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can update own analysis results" ON public.analysis_results
    FOR UPDATE
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Service role can manage all analysis results" ON public.analysis_results
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- Worklogs policies
CREATE POLICY "Users can view own worklogs" ON public.worklogs
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can insert own worklogs" ON public.worklogs
    FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Service role can manage all worklogs" ON public.worklogs
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- Documents policies
CREATE POLICY "Users can view own documents" ON public.documents
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can insert own documents" ON public.documents
    FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can update own documents" ON public.documents
    FOR UPDATE
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()))
    WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can delete own documents" ON public.documents
    FOR DELETE
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Service role can manage all documents" ON public.documents
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- Activity log policies
CREATE POLICY "Users can view own activity logs" ON public.activity_log
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Allow system to insert activity logs" ON public.activity_log
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can manage all activity logs" ON public.activity_log
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- User JIRA issues cache policies
CREATE POLICY "Users can view own cached issues" ON public.user_jira_issues_cache
    FOR SELECT
    USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Service role can manage all cached issues" ON public.user_jira_issues_cache
    FOR ALL
    USING ((auth.jwt() ->> 'role') = 'service_role');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Next Steps:
-- 1. Verify all tables were created successfully
-- 2. Test RLS policies with your application
-- 3. Update your application's Supabase connection string to point to the new project
-- 4. Migrate any existing data if needed (not included in this script)
--
-- Note: This script only creates the schema structure. To migrate existing data,
-- you'll need to export data from the old database and import it into the new one.
-- ============================================================================
