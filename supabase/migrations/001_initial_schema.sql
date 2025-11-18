-- BRD Automate & Time Tracker - Initial Database Schema
-- This migration creates all core tables for the application

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
-- Stores user information linked to Atlassian accounts
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atlassian_account_id TEXT UNIQUE NOT NULL,
    email TEXT,
    display_name TEXT,
    supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::JSONB
);

-- Index for faster lookups by Atlassian account ID
CREATE INDEX idx_users_atlassian_account_id ON public.users(atlassian_account_id);
CREATE INDEX idx_users_supabase_user_id ON public.users(supabase_user_id);

-- =====================================================
-- SCREENSHOTS TABLE
-- =====================================================
-- Stores metadata for captured screenshots
CREATE TABLE IF NOT EXISTS public.screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_url TEXT,
    window_title TEXT,
    application_name TEXT,
    file_size_bytes BIGINT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed', 'deleted')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient querying
CREATE INDEX idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX idx_screenshots_timestamp ON public.screenshots(timestamp DESC);
CREATE INDEX idx_screenshots_status ON public.screenshots(status);
CREATE INDEX idx_screenshots_user_timestamp ON public.screenshots(user_id, timestamp DESC);

-- =====================================================
-- ANALYSIS_RESULTS TABLE
-- =====================================================
-- Stores AI analysis results for screenshots
CREATE TABLE IF NOT EXISTS public.analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    screenshot_id UUID NOT NULL REFERENCES public.screenshots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    active_task_key TEXT,
    active_project_key TEXT,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    extracted_text TEXT,
    detected_jira_keys TEXT[],
    is_active_work BOOLEAN DEFAULT TRUE,
    is_idle BOOLEAN DEFAULT FALSE,
    analyzed_by TEXT DEFAULT 'ai',
    ai_model_version TEXT,
    analysis_metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    worklog_created BOOLEAN DEFAULT FALSE,
    worklog_id TEXT,
    worklog_created_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for analysis results
CREATE INDEX idx_analysis_results_screenshot_id ON public.analysis_results(screenshot_id);
CREATE INDEX idx_analysis_results_user_id ON public.analysis_results(user_id);
CREATE INDEX idx_analysis_results_task_key ON public.analysis_results(active_task_key);
CREATE INDEX idx_analysis_results_project_key ON public.analysis_results(active_project_key);
CREATE INDEX idx_analysis_results_worklog ON public.analysis_results(worklog_created, user_id);

-- =====================================================
-- DOCUMENTS TABLE
-- =====================================================
-- Stores BRD documents and their processing status
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'doc')),
    file_size_bytes BIGINT NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    processing_status TEXT DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'extracting', 'analyzing', 'completed', 'failed')),
    extracted_text TEXT,
    parsed_requirements JSONB,
    project_key TEXT,
    created_issues JSONB DEFAULT '[]'::JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    ai_model_version TEXT,
    processing_metadata JSONB DEFAULT '{}'::JSONB
);

-- Indexes for documents
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_status ON public.documents(processing_status);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX idx_documents_project_key ON public.documents(project_key);

-- =====================================================
-- WORKLOGS TABLE
-- =====================================================
-- Stores worklog entries created by the system (for tracking purposes)
CREATE TABLE IF NOT EXISTS public.worklogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    analysis_result_id UUID REFERENCES public.analysis_results(id) ON DELETE SET NULL,
    jira_worklog_id TEXT NOT NULL,
    jira_issue_key TEXT NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
    error_message TEXT
);

-- Indexes for worklogs
CREATE INDEX idx_worklogs_user_id ON public.worklogs(user_id);
CREATE INDEX idx_worklogs_issue_key ON public.worklogs(jira_issue_key);
CREATE INDEX idx_worklogs_started_at ON public.worklogs(started_at DESC);
CREATE INDEX idx_worklogs_jira_worklog_id ON public.worklogs(jira_worklog_id);

-- =====================================================
-- ACTIVITY_LOG TABLE
-- =====================================================
-- Stores user activity and system events for debugging and analytics
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for activity log
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_event_type ON public.activity_log(event_type);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR ANALYTICS
-- =====================================================

-- View for daily time summary per user
CREATE OR REPLACE VIEW public.daily_time_summary AS
SELECT
    ar.user_id,
    DATE(s.timestamp) AS work_date,
    ar.active_project_key,
    ar.active_task_key,
    SUM(ar.time_spent_seconds) AS total_seconds,
    COUNT(DISTINCT s.id) AS screenshot_count,
    COUNT(DISTINCT CASE WHEN ar.worklog_created THEN ar.id END) AS worklogs_created
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE AND ar.is_idle = FALSE
GROUP BY ar.user_id, DATE(s.timestamp), ar.active_project_key, ar.active_task_key;

-- View for weekly time summary per user
CREATE OR REPLACE VIEW public.weekly_time_summary AS
SELECT
    ar.user_id,
    DATE_TRUNC('week', s.timestamp) AS week_start,
    ar.active_project_key,
    ar.active_task_key,
    SUM(ar.time_spent_seconds) AS total_seconds,
    COUNT(DISTINCT DATE(s.timestamp)) AS active_days,
    COUNT(DISTINCT s.id) AS screenshot_count
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE AND ar.is_idle = FALSE
GROUP BY ar.user_id, DATE_TRUNC('week', s.timestamp), ar.active_project_key, ar.active_task_key;

-- View for project time summary
CREATE OR REPLACE VIEW public.project_time_summary AS
SELECT
    ar.user_id,
    ar.active_project_key,
    SUM(ar.time_spent_seconds) AS total_seconds,
    COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
    COUNT(DISTINCT s.id) AS screenshot_count,
    MIN(s.timestamp) AS first_activity,
    MAX(s.timestamp) AS last_activity
FROM public.analysis_results ar
JOIN public.screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE AND ar.is_idle = FALSE AND ar.active_project_key IS NOT NULL
GROUP BY ar.user_id, ar.active_project_key;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.users IS 'Stores user accounts linked to Atlassian and Supabase auth';
COMMENT ON TABLE public.screenshots IS 'Metadata for captured screenshots from desktop app';
COMMENT ON TABLE public.analysis_results IS 'AI analysis results determining time spent and active tasks';
COMMENT ON TABLE public.documents IS 'BRD documents uploaded for automatic Jira issue creation';
COMMENT ON TABLE public.worklogs IS 'Tracking table for worklogs created in Jira';
COMMENT ON TABLE public.activity_log IS 'System activity and audit log';
