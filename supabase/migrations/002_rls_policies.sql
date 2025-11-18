-- BRD Automate & Time Tracker - Row Level Security Policies
-- This migration implements RLS policies to ensure users can only access their own data

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USERS TABLE POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = supabase_user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = supabase_user_id)
WITH CHECK (auth.uid() = supabase_user_id);

-- Service role can manage all users (for backend operations)
CREATE POLICY "Service role can manage all users"
ON public.users
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- SCREENSHOTS TABLE POLICIES
-- =====================================================

-- Users can view their own screenshots
CREATE POLICY "Users can view own screenshots"
ON public.screenshots
FOR SELECT
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can insert their own screenshots
CREATE POLICY "Users can insert own screenshots"
ON public.screenshots
FOR INSERT
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can update their own screenshots (e.g., mark as deleted)
CREATE POLICY "Users can update own screenshots"
ON public.screenshots
FOR UPDATE
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
)
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can delete their own screenshots
CREATE POLICY "Users can delete own screenshots"
ON public.screenshots
FOR DELETE
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access
CREATE POLICY "Service role can manage all screenshots"
ON public.screenshots
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- ANALYSIS_RESULTS TABLE POLICIES
-- =====================================================

-- Users can view their own analysis results
CREATE POLICY "Users can view own analysis results"
ON public.analysis_results
FOR SELECT
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can insert their own analysis results
CREATE POLICY "Users can insert own analysis results"
ON public.analysis_results
FOR INSERT
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can update their own analysis results
CREATE POLICY "Users can update own analysis results"
ON public.analysis_results
FOR UPDATE
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
)
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access
CREATE POLICY "Service role can manage all analysis results"
ON public.analysis_results
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- DOCUMENTS TABLE POLICIES
-- =====================================================

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
ON public.documents
FOR SELECT
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents"
ON public.documents
FOR INSERT
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
ON public.documents
FOR UPDATE
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
)
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON public.documents
FOR DELETE
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access
CREATE POLICY "Service role can manage all documents"
ON public.documents
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- WORKLOGS TABLE POLICIES
-- =====================================================

-- Users can view their own worklogs
CREATE POLICY "Users can view own worklogs"
ON public.worklogs
FOR SELECT
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Users can insert their own worklogs
CREATE POLICY "Users can insert own worklogs"
ON public.worklogs
FOR INSERT
WITH CHECK (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access
CREATE POLICY "Service role can manage all worklogs"
ON public.worklogs
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- ACTIVITY_LOG TABLE POLICIES
-- =====================================================

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
ON public.activity_log
FOR SELECT
USING (
    user_id IN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access to activity logs
CREATE POLICY "Service role can manage all activity logs"
ON public.activity_log
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- System can insert activity logs (no user context needed for some events)
CREATE POLICY "Allow system to insert activity logs"
ON public.activity_log
FOR INSERT
WITH CHECK (true);

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Function to get current user's internal ID from Supabase auth
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM public.users WHERE supabase_user_id = auth.uid() LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;

-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================
-- Note: These will be created via Supabase Dashboard or separate storage policy file
-- Storage policies for 'screenshots' bucket:
--   - Users can upload to their own folder: user_id/*
--   - Users can read from their own folder
--   - Users can delete from their own folder

-- Storage policies for 'documents' bucket:
--   - Users can upload to their own folder: user_id/*
--   - Users can read from their own folder
--   - Users can delete from their own folder

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Users can view own profile" ON public.users IS
    'Allows users to view only their own user profile data';

COMMENT ON POLICY "Users can view own screenshots" ON public.screenshots IS
    'Ensures users can only view screenshots they have captured';

COMMENT ON POLICY "Service role can manage all screenshots" ON public.screenshots IS
    'Allows backend services (AI analysis, etc.) to manage all screenshots';
