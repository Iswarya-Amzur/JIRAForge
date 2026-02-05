-- ============================================================================
-- Migration: Add Feedback Table + Storage Bucket
-- ============================================================================
-- Stores user feedback (bug reports, feature requests) submitted from the
-- desktop app. AI processes the feedback and creates Jira tickets automatically.
--
-- Created: 2026-02-06
-- ============================================================================

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User information
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    atlassian_account_id TEXT NOT NULL,
    user_email TEXT,
    user_display_name TEXT,
    organization_id UUID,
    jira_cloud_id TEXT,

    -- Feedback content
    category TEXT NOT NULL CHECK (category IN ('bug', 'feature_request', 'improvement', 'question', 'other')),
    title TEXT,
    description TEXT NOT NULL,

    -- Images
    image_paths TEXT[],
    image_count INTEGER DEFAULT 0,

    -- AI analysis results
    ai_summary TEXT,
    ai_priority TEXT,
    ai_labels TEXT[],
    ai_issue_type TEXT DEFAULT 'Task',

    -- Jira ticket info
    jira_issue_key TEXT,
    jira_issue_url TEXT,
    jira_creation_status TEXT DEFAULT 'pending',
    jira_creation_error TEXT,

    -- Metadata
    source TEXT DEFAULT 'desktop_app',
    app_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_user
ON public.feedback(atlassian_account_id);

CREATE INDEX IF NOT EXISTS idx_feedback_status
ON public.feedback(jira_creation_status);

CREATE INDEX IF NOT EXISTS idx_feedback_created
ON public.feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_category
ON public.feedback(category);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_feedback_updated_at ON public.feedback;
CREATE TRIGGER trigger_update_feedback_updated_at
BEFORE UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_feedback_updated_at();

-- Comments
COMMENT ON TABLE public.feedback IS 'User feedback submissions (bug reports, feature requests) from the desktop app';
COMMENT ON COLUMN public.feedback.category IS 'Feedback type: bug, feature_request, improvement, question, other';
COMMENT ON COLUMN public.feedback.jira_creation_status IS 'Status of Jira ticket creation: pending, processing, created, failed';
COMMENT ON COLUMN public.feedback.ai_summary IS 'AI-generated summary of the feedback for Jira ticket';

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own feedback" ON public.feedback
    FOR SELECT USING (atlassian_account_id = auth.jwt() ->> 'sub');

CREATE POLICY "Service role can manage all feedback" ON public.feedback
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Storage Bucket: feedback-images
-- ============================================================================
-- Private bucket for feedback screenshots/images
-- 5MB file size limit, allowed: PNG/JPEG/GIF/WebP

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'feedback-images',
    'feedback-images',
    FALSE,
    5242880,  -- 5MB
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for feedback-images bucket
CREATE POLICY "Service role can manage feedback images" ON storage.objects
    FOR ALL USING (bucket_id = 'feedback-images' AND auth.role() = 'service_role');
