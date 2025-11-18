-- Quick Setup Script for Supabase
-- This combines all migrations into one file for easy setup
-- Run this in Supabase SQL Editor if you want to set everything up at once

-- =====================================================
-- MIGRATION 1: INITIAL SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
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

CREATE INDEX IF NOT EXISTS idx_users_atlassian_account_id ON public.users(atlassian_account_id);
CREATE INDEX IF NOT EXISTS idx_users_supabase_user_id ON public.users(supabase_user_id);

-- Screenshots table
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

CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON public.screenshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_status ON public.screenshots(status);
CREATE INDEX IF NOT EXISTS idx_screenshots_user_timestamp ON public.screenshots(user_id, timestamp DESC);

-- Analysis results table
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

CREATE INDEX IF NOT EXISTS idx_analysis_results_screenshot_id ON public.analysis_results(screenshot_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id ON public.analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_task_key ON public.analysis_results(active_task_key);
CREATE INDEX IF NOT EXISTS idx_analysis_results_project_key ON public.analysis_results(active_project_key);
CREATE INDEX IF NOT EXISTS idx_analysis_results_worklog ON public.analysis_results(worklog_created, user_id);

-- Documents table
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

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_project_key ON public.documents(project_key);

-- Worklogs table
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

CREATE INDEX IF NOT EXISTS idx_worklogs_user_id ON public.worklogs(user_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_issue_key ON public.worklogs(jira_issue_key);
CREATE INDEX IF NOT EXISTS idx_worklogs_started_at ON public.worklogs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worklogs_jira_worklog_id ON public.worklogs(jira_worklog_id);

-- Activity log table
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON public.activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Views
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
-- MIGRATION 2: RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can insert own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can update own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can delete own screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Service role can manage all screenshots" ON public.screenshots;
DROP POLICY IF EXISTS "Users can view own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can insert own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can update own analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Service role can manage all analysis results" ON public.analysis_results;
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Service role can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view own worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Users can insert own worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Service role can manage all worklogs" ON public.worklogs;
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Service role can manage all activity logs" ON public.activity_log;
DROP POLICY IF EXISTS "Allow system to insert activity logs" ON public.activity_log;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = supabase_user_id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = supabase_user_id) WITH CHECK (auth.uid() = supabase_user_id);
CREATE POLICY "Service role can manage all users" ON public.users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Screenshots policies
CREATE POLICY "Users can view own screenshots" ON public.screenshots FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can insert own screenshots" ON public.screenshots FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can update own screenshots" ON public.screenshots FOR UPDATE USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())) WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can delete own screenshots" ON public.screenshots FOR DELETE USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role can manage all screenshots" ON public.screenshots FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Analysis results policies
CREATE POLICY "Users can view own analysis results" ON public.analysis_results FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can insert own analysis results" ON public.analysis_results FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can update own analysis results" ON public.analysis_results FOR UPDATE USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())) WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role can manage all analysis results" ON public.analysis_results FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Documents policies
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())) WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role can manage all documents" ON public.documents FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Worklogs policies
CREATE POLICY "Users can view own worklogs" ON public.worklogs FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can insert own worklogs" ON public.worklogs FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role can manage all worklogs" ON public.worklogs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Activity log policies
CREATE POLICY "Users can view own activity logs" ON public.activity_log FOR SELECT USING (user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role can manage all activity logs" ON public.activity_log FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Allow system to insert activity logs" ON public.activity_log FOR INSERT WITH CHECK (true);

-- Helper function
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;

-- =====================================================
-- MIGRATION 3: STORAGE BUCKETS
-- =====================================================

-- Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'screenshots',
    'screenshots',
    false,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    52428800,
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop existing first)
DROP POLICY IF EXISTS "Users can upload own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to documents" ON storage.objects;

-- Screenshots bucket policies
CREATE POLICY "Users can upload own screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can view own screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can update own screenshots" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid())) WITH CHECK (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role full access to screenshots" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'screenshots') WITH CHECK (bucket_id = 'screenshots');

-- Documents bucket policies
CREATE POLICY "Users can upload own documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can update own documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid())) WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = (SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()));
CREATE POLICY "Service role full access to documents" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- This will show you what was created
SELECT 'Setup Complete!' as status;

