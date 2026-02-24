-- Create OCR Test Table (Temporary for Testing)
-- This table will be used to test OCR functionality separately
-- Later, these columns will be merged into the main screenshots table

CREATE TABLE IF NOT EXISTS ocr_test_results (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User and organization (multi-tenancy)
    user_id UUID NOT NULL,
    organization_id UUID,
    
    -- Link to original screenshot (optional)
    screenshot_id UUID,
    
    -- Timestamp
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Window metadata
    window_title TEXT,
    application_name TEXT,
    
    -- OCR extracted data
    extracted_text TEXT,
    ocr_confidence DECIMAL(3,2) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
    ocr_method VARCHAR(20) CHECK (ocr_method IN ('paddle', 'tesseract', 'metadata', 'error', 'unknown')),
    ocr_line_count INTEGER DEFAULT 0,
    
    -- Processing info
    preprocessing_enabled BOOLEAN DEFAULT TRUE,
    processing_time_ms INTEGER,
    image_width INTEGER,
    image_height INTEGER,
    
    -- Success/error tracking
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    
    -- Test metadata
    test_name VARCHAR(100),
    test_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to existing table (for screenshot storage)
-- These ALTER TABLE statements will add columns if the table already exists
DO $$ 
BEGIN
    -- Add screenshot_base64 column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ocr_test_results' 
        AND column_name = 'screenshot_base64'
    ) THEN
        ALTER TABLE ocr_test_results ADD COLUMN screenshot_base64 TEXT;
    END IF;
    
    -- Add thumbnail_base64 column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ocr_test_results' 
        AND column_name = 'thumbnail_base64'
    ) THEN
        ALTER TABLE ocr_test_results ADD COLUMN thumbnail_base64 TEXT;
    END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ocr_test_user_id 
ON ocr_test_results(user_id);

CREATE INDEX IF NOT EXISTS idx_ocr_test_timestamp 
ON ocr_test_results(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_test_method 
ON ocr_test_results(ocr_method);

CREATE INDEX IF NOT EXISTS idx_ocr_test_created_at 
ON ocr_test_results(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE ocr_test_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-runs)
DROP POLICY IF EXISTS "Users can view own OCR test results" ON ocr_test_results;
DROP POLICY IF EXISTS "Users can insert own OCR test results" ON ocr_test_results;
DROP POLICY IF EXISTS "Service role has full access to OCR test results" ON ocr_test_results;

-- RLS Policy: Users can only see their own test results
CREATE POLICY "Users can view own OCR test results"
    ON ocr_test_results
    FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own test results
CREATE POLICY "Users can insert own OCR test results"
    ON ocr_test_results
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RLS Policy: Service role can do anything (for desktop app using service key)
CREATE POLICY "Service role has full access to OCR test results"
    ON ocr_test_results
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE ocr_test_results IS 'Temporary table for testing OCR functionality. Will be merged into screenshots table later.';

-- Create a view for easy analysis
CREATE OR REPLACE VIEW ocr_test_summary AS
SELECT 
    ocr_method,
    COUNT(*) as total_tests,
    COUNT(CASE WHEN success THEN 1 END) as successful_tests,
    ROUND(AVG(ocr_confidence)::numeric, 2) as avg_confidence,
    ROUND(AVG(processing_time_ms)::numeric, 0) as avg_processing_ms,
    ROUND(AVG(ocr_line_count)::numeric, 0) as avg_line_count,
    MIN(created_at) as first_test,
    MAX(created_at) as last_test
FROM ocr_test_results
GROUP BY ocr_method
ORDER BY total_tests DESC;

COMMENT ON VIEW ocr_test_summary IS 'Summary statistics for OCR test results grouped by method.';
