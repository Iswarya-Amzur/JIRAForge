-- ============================================================================
-- Migration: Add activity_records table
-- Date: 2026-02-21
--
-- Stores classified application activity data from the desktop app.
-- Replaces screenshot-based tracking with lightweight activity records
-- containing window titles, application names, and classifications.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_records (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    window_title TEXT,
    application_name TEXT,
    classification TEXT CHECK (classification IN ('productive', 'non_productive', 'private', 'unknown')),
    ocr_text TEXT,
    ocr_method TEXT,
    ocr_confidence REAL,
    ocr_error_message TEXT,
    total_time_seconds INTEGER,
    visit_count INTEGER DEFAULT 1,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    batch_timestamp TIMESTAMPTZ,
    batch_start TIMESTAMPTZ,
    batch_end TIMESTAMPTZ,
    work_date DATE,
    user_timezone TEXT,
    project_key TEXT,
    user_assigned_issue_key TEXT,
    user_assigned_issues TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed')),
    metadata JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_activity_user_work_date ON public.activity_records(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_activity_org_user_work_date ON public.activity_records(organization_id, user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_activity_batch_timestamp ON public.activity_records(batch_timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_status ON public.activity_records(status);
CREATE INDEX IF NOT EXISTS idx_activity_user_timestamp ON public.activity_records(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_activity_project_key ON public.activity_records(project_key);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_activity_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_activity_records_updated_at ON public.activity_records;
CREATE TRIGGER trigger_activity_records_updated_at
    BEFORE UPDATE ON public.activity_records
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_records_updated_at();

-- Auto-compute work_date from start_time + user_timezone
CREATE OR REPLACE FUNCTION compute_activity_work_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.work_date IS NULL AND NEW.start_time IS NOT NULL THEN
        IF NEW.user_timezone IS NOT NULL AND NEW.user_timezone != '' THEN
            NEW.work_date = (NEW.start_time AT TIME ZONE NEW.user_timezone)::DATE;
        ELSE
            NEW.work_date = (NEW.start_time AT TIME ZONE 'UTC')::DATE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_activity_compute_work_date ON public.activity_records;
CREATE TRIGGER trigger_activity_compute_work_date
    BEFORE INSERT OR UPDATE ON public.activity_records
    FOR EACH ROW
    EXECUTE FUNCTION compute_activity_work_date();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.activity_records ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity records
DROP POLICY IF EXISTS "activity_records_select_own" ON public.activity_records;
CREATE POLICY "activity_records_select_own" ON public.activity_records
    FOR SELECT
    USING (
        user_id = (SELECT get_current_user_id())
    );

-- Users can insert their own activity records
DROP POLICY IF EXISTS "activity_records_insert_own" ON public.activity_records;
CREATE POLICY "activity_records_insert_own" ON public.activity_records
    FOR INSERT
    WITH CHECK (
        user_id = (SELECT get_current_user_id())
    );

-- Users can update their own activity records
DROP POLICY IF EXISTS "activity_records_update_own" ON public.activity_records;
CREATE POLICY "activity_records_update_own" ON public.activity_records
    FOR UPDATE
    USING (
        user_id = (SELECT get_current_user_id())
    );

-- Org members can read activity records in their organization
DROP POLICY IF EXISTS "activity_records_select_org" ON public.activity_records;
CREATE POLICY "activity_records_select_org" ON public.activity_records
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT get_current_user_id())
        )
    );

-- Service role can do everything (for AI server and backend operations)
DROP POLICY IF EXISTS "activity_records_service_role" ON public.activity_records;
CREATE POLICY "activity_records_service_role" ON public.activity_records
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.activity_records IS 'Classified application activity data from the desktop app';
COMMENT ON COLUMN public.activity_records.user_id IS 'Reference to the user who generated this activity';
COMMENT ON COLUMN public.activity_records.classification IS 'Activity classification: productive, non_productive, private, or unknown';
COMMENT ON COLUMN public.activity_records.ocr_text IS 'Optional OCR-extracted text from the application window';
COMMENT ON COLUMN public.activity_records.ocr_method IS 'OCR engine used for text extraction (e.g., paddle, tesseract, easyocr, metadata)';
COMMENT ON COLUMN public.activity_records.ocr_confidence IS 'Confidence score from OCR extraction (0.0 to 1.0)';
COMMENT ON COLUMN public.activity_records.ocr_error_message IS 'Error message if OCR extraction failed';
COMMENT ON COLUMN public.activity_records.work_date IS 'Local date for the activity, auto-computed from start_time + user_timezone';
COMMENT ON COLUMN public.activity_records.status IS 'Processing status: pending, processing, analyzed, or failed';
COMMENT ON COLUMN public.activity_records.metadata IS 'Additional metadata stored as JSON';
