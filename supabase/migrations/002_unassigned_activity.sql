-- =====================================================
-- UNASSIGNED ACTIVITY TABLE
-- =====================================================
-- Stores analysis results where AI couldn't identify a task key
-- These will be used for a future feature to manually assign tasks

CREATE TABLE IF NOT EXISTS public.unassigned_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Reference to original analysis and screenshot
    analysis_result_id UUID NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
    screenshot_id UUID NOT NULL REFERENCES public.screenshots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Screenshot details
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    window_title TEXT,
    application_name TEXT,

    -- Analysis details
    extracted_text TEXT,
    detected_jira_keys TEXT[], -- AI might have detected some keys but couldn't pick one
    confidence_score DECIMAL(3, 2),
    time_spent_seconds INTEGER DEFAULT 0,

    -- Why it's unassigned
    reason TEXT CHECK (reason IN ('no_task_key', 'invalid_task_key', 'low_confidence', 'manual_override')),

    -- For future manual assignment feature
    manually_assigned BOOLEAN DEFAULT FALSE,
    assigned_task_key TEXT,
    assigned_by UUID REFERENCES public.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicates
    UNIQUE(analysis_result_id)
);

-- Indexes
CREATE INDEX idx_unassigned_activity_user_id ON public.unassigned_activity(user_id);
CREATE INDEX idx_unassigned_activity_timestamp ON public.unassigned_activity(timestamp DESC);
CREATE INDEX idx_unassigned_activity_manually_assigned ON public.unassigned_activity(manually_assigned);
CREATE INDEX idx_unassigned_activity_screenshot_id ON public.unassigned_activity(screenshot_id);

COMMENT ON TABLE public.unassigned_activity IS 'Analysis results with no task key - for future manual assignment feature';

-- =====================================================
-- AUTO-SAVE TRIGGER FOR UNASSIGNED ACTIVITY
-- =====================================================
-- Automatically save to unassigned_activity when analysis has no task_key

CREATE OR REPLACE FUNCTION auto_save_unassigned_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if task_key is NULL or empty
    IF (NEW.active_task_key IS NULL OR NEW.active_task_key = '') THEN
        -- Insert into unassigned_activity table
        INSERT INTO public.unassigned_activity (
            analysis_result_id,
            screenshot_id,
            user_id,
            timestamp,
            window_title,
            application_name,
            extracted_text,
            detected_jira_keys,
            confidence_score,
            time_spent_seconds,
            reason,
            metadata
        )
        SELECT
            NEW.id,
            NEW.screenshot_id,
            NEW.user_id,
            s.timestamp,
            s.window_title,
            s.application_name,
            NEW.extracted_text,
            NEW.detected_jira_keys,
            NEW.confidence_score,
            NEW.time_spent_seconds,
            CASE
                WHEN NEW.active_task_key IS NULL THEN 'no_task_key'
                WHEN NEW.active_task_key = '' THEN 'no_task_key'
                ELSE 'invalid_task_key'
            END,
            jsonb_build_object(
                'is_active_work', NEW.is_active_work,
                'is_idle', NEW.is_idle,
                'ai_model_version', NEW.ai_model_version,
                'active_project_key', NEW.active_project_key
            )
        FROM public.screenshots s
        WHERE s.id = NEW.screenshot_id
        ON CONFLICT (analysis_result_id) DO NOTHING; -- Prevent duplicates if trigger runs multiple times
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on analysis_results table
DROP TRIGGER IF EXISTS trigger_auto_save_unassigned ON public.analysis_results;
CREATE TRIGGER trigger_auto_save_unassigned
    AFTER INSERT OR UPDATE ON public.analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION auto_save_unassigned_activity();

COMMENT ON FUNCTION auto_save_unassigned_activity() IS 'Automatically saves analysis results with no task_key to unassigned_activity table';

-- =====================================================
-- VIEW FOR UNASSIGNED ACTIVITY SUMMARY
-- =====================================================

CREATE OR REPLACE VIEW public.unassigned_activity_summary AS
SELECT
    u.user_id,
    COUNT(*) as total_unassigned,
    COUNT(CASE WHEN u.manually_assigned THEN 1 END) as assigned_count,
    COUNT(CASE WHEN NOT u.manually_assigned THEN 1 END) as pending_count,
    SUM(u.time_spent_seconds) as total_time_seconds,
    MIN(u.timestamp) as earliest_activity,
    MAX(u.timestamp) as latest_activity,
    COUNT(CASE WHEN u.reason = 'no_task_key' THEN 1 END) as no_key_count,
    COUNT(CASE WHEN u.reason = 'invalid_task_key' THEN 1 END) as invalid_key_count,
    COUNT(CASE WHEN u.reason = 'low_confidence' THEN 1 END) as low_confidence_count
FROM public.unassigned_activity u
GROUP BY u.user_id;

COMMENT ON VIEW public.unassigned_activity_summary IS 'Summary of unassigned activities per user';
