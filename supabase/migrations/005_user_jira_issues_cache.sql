-- User Jira Issues Cache Table
-- This table caches user's assigned Jira issues for faster AI analysis
-- Updated periodically from Forge app to keep in sync with Jira

-- =====================================================
-- USER_JIRA_ISSUES_CACHE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_jira_issues_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    issue_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL,
    project_key TEXT NOT NULL,
    issue_type TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one cache entry per user-issue combination
    UNIQUE(user_id, issue_key)
);

-- Indexes for efficient querying
CREATE INDEX idx_user_jira_cache_user_id ON public.user_jira_issues_cache(user_id);
CREATE INDEX idx_user_jira_cache_issue_key ON public.user_jira_issues_cache(issue_key);
CREATE INDEX idx_user_jira_cache_user_updated ON public.user_jira_issues_cache(user_id, updated_at DESC);
CREATE INDEX idx_user_jira_cache_status ON public.user_jira_issues_cache(status);

-- Index for cleanup queries (old cache entries)
CREATE INDEX idx_user_jira_cache_cached_at ON public.user_jira_issues_cache(cached_at);

-- Function to update cached_at timestamp
CREATE OR REPLACE FUNCTION update_cached_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cached_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cached_at on insert/update
CREATE TRIGGER update_user_jira_cache_cached_at
    BEFORE INSERT OR UPDATE ON public.user_jira_issues_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_cached_at_column();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE public.user_jira_issues_cache ENABLE ROW LEVEL SECURITY;

-- Users can view their own cached issues
CREATE POLICY "Users can view own cached issues"
ON public.user_jira_issues_cache
FOR SELECT
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role can manage all cached issues (for backend operations)
CREATE POLICY "Service role can manage all cached issues"
ON public.user_jira_issues_cache
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Comments
COMMENT ON TABLE public.user_jira_issues_cache IS 'Cache of user assigned Jira issues (In Progress/In Review) for AI analysis';
COMMENT ON COLUMN public.user_jira_issues_cache.user_id IS 'Reference to users table';
COMMENT ON COLUMN public.user_jira_issues_cache.issue_key IS 'Jira issue key (e.g., PROJ-123)';
COMMENT ON COLUMN public.user_jira_issues_cache.summary IS 'Issue summary/title';
COMMENT ON COLUMN public.user_jira_issues_cache.status IS 'Current issue status';
COMMENT ON COLUMN public.user_jira_issues_cache.cached_at IS 'When this entry was last cached';
COMMENT ON COLUMN public.user_jira_issues_cache.updated_at IS 'When the issue was last updated in Jira';

