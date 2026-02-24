# OCR Test Table Migration

## File: 20240218_create_ocr_test_table.sql

This migration creates a temporary table for testing OCR functionality separately from the main screenshots table.

## Purpose

Test OCR text extraction and Supabase integration without modifying production tables. Later, these columns will be added to the main `screenshots` table.

## What It Creates

### Table: `ocr_test_results`
Stores OCR test results with:
- User and organization IDs
- Window metadata (title, app name)
- OCR extracted text
- Confidence scores and method used
- Processing performance metrics
- Success/error tracking
- Test identification fields

### Indexes
- `idx_ocr_test_user_id` - Fast user queries
- `idx_ocr_test_timestamp` - Fast time-based queries
- `idx_ocr_test_method` - Fast method filtering
- `idx_ocr_test_created_at` - Fast recent results

### Row Level Security (RLS)
- Users can view/insert their own tests
- Service role has full access

### View: `ocr_test_summary`
Aggregated statistics by OCR method:
- Total tests
- Success rate
- Average confidence
- Average processing time
- Average line count

## How to Apply

### Option 1: Supabase Dashboard
1. Go to SQL Editor in Supabase
2. Copy contents of this file
3. Click "Run"

### Option 2: Supabase CLI
```bash
cd supabase
supabase migration up
```

### Option 3: Manual SQL
Connect to your database and run:
```bash
psql your_database_url < 20240218_create_ocr_test_table.sql
```

## Verify Installation

Check table exists:
```sql
SELECT * FROM ocr_test_results LIMIT 1;
```

Check view exists:
```sql
SELECT * FROM ocr_test_summary;
```

## Usage

Test scripts use this table:
- `python-desktop-app/test_ocr_quick.py`
- `python-desktop-app/test_ocr_verbose.py`

Example query:
```sql
SELECT 
    ocr_method,
    ocr_confidence,
    ocr_line_count,
    processing_time_ms,
    success
FROM ocr_test_results
ORDER BY created_at DESC
LIMIT 10;
```

## Migration to Production

After testing is complete, add these columns to the main `screenshots` table:
```sql
ALTER TABLE screenshots
ADD COLUMN extracted_text TEXT,
ADD COLUMN ocr_confidence DECIMAL(3,2),
ADD COLUMN ocr_method VARCHAR(20);
```

Then you can drop the test table:
```sql
DROP TABLE IF EXISTS ocr_test_results CASCADE;
```

## Notes

- Service role key required for test scripts (bypasses RLS)
- Test user IDs defined in `.env`: `TEST_USER_ID`, `TEST_ORG_ID`
- Processing time measured in milliseconds
- Confidence score ranges from 0.0 to 1.0

## Related Files

- [OCR_TESTING_QUICKSTART.md](../../docs/OCR_TESTING_QUICKSTART.md) - Quick start guide
- [OCR_TESTING_GUIDE.md](../../docs/OCR_TESTING_GUIDE.md) - Complete testing guide
- [test_ocr_quick.py](../../python-desktop-app/test_ocr_quick.py) - Quick test script
- [test_ocr_verbose.py](../../python-desktop-app/test_ocr_verbose.py) - Verbose test script
