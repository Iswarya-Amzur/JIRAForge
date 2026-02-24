-- Update OCR Method Constraint to Support Dynamic Engine Names
-- This allows the new OCR facade to use any engine (paddle, tesseract, demo, mock, easyocr, etc.)
-- Migration created: 2026-02-19

-- Drop the old restrictive constraint
ALTER TABLE ocr_test_results 
DROP CONSTRAINT IF EXISTS ocr_test_results_ocr_method_check;

-- Add new constraint that allows any alphanumeric engine name
-- Still validates format (alphanumeric + underscore, max 50 chars)
ALTER TABLE ocr_test_results 
ADD CONSTRAINT ocr_test_results_ocr_method_check 
CHECK (
    ocr_method IS NULL 
    OR (
        ocr_method ~* '^[a-z0-9_]+$'  -- Alphanumeric + underscore only
        AND LENGTH(ocr_method) <= 50   -- Reasonable max length
    )
);

-- Update column comment
COMMENT ON COLUMN ocr_test_results.ocr_method IS 
'OCR engine used for extraction (paddle, tesseract, demo, mock, easyocr, etc.). Supports dynamic engine discovery.';

-- Validate existing data (should pass since current values are valid)
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM ocr_test_results
    WHERE ocr_method IS NOT NULL 
    AND NOT (ocr_method ~* '^[a-z0-9_]+$' AND LENGTH(ocr_method) <= 50);
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Found % records with invalid ocr_method values', invalid_count;
    ELSE
        RAISE NOTICE 'All existing ocr_method values are valid ✓';
    END IF;
END $$;

-- Optional: Add index on ocr_method if not exists (for filtering by engine)
CREATE INDEX IF NOT EXISTS idx_ocr_test_method 
ON ocr_test_results(ocr_method) 
WHERE ocr_method IS NOT NULL;

-- Show current distinct methods in the table
DO $$
DECLARE
    methods TEXT;
BEGIN
    SELECT string_agg(DISTINCT ocr_method, ', ' ORDER BY ocr_method) INTO methods
    FROM ocr_test_results;
    
    IF methods IS NOT NULL THEN
        RAISE NOTICE 'Current OCR methods in database: %', methods;
    ELSE
        RAISE NOTICE 'No OCR test records yet';
    END IF;
END $$;
