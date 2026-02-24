# OCR Engine Test Suite

Comprehensive testing framework for JIRAForge OCR engines with automatic database storage.

## 📋 Overview

This test suite allows you to:
- **Test all OCR engines** (paddle, tesseract, mock, demo, custom)
- **Switch engines via environment variables** - no code changes needed
- **Automatically store results** in `ocr_test_results` table
- **Compare engine performance** with detailed metrics
- **Test with custom images** or auto-generated test images

## 🚀 Quick Start

### 1. Basic Usage

```bash
# Test all available engines
python -m tests.test_ocr_engines

# List available engines
python -m tests.test_ocr_engines --list

# Test specific engine
python -m tests.test_ocr_engines --engine paddle

# Test with custom image
python -m tests.test_ocr_engines --image path/to/screenshot.png

# Dry run (no database storage)
python -m tests.test_ocr_engines --no-db
```

### 2. Configuration

The test suite uses your `.env` file configuration:

```bash
# Supabase (required for database storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Test user IDs (optional, defaults to test UUIDs)
TEST_USER_ID=00000000-0000-0000-0000-000000000001
TEST_ORG_ID=00000000-0000-0000-0000-000000000001

# OCR Engine Configuration
OCR_PRIMARY_ENGINE=paddle
OCR_FALLBACK_ENGINES=tesseract,mock

# Engine-specific settings
OCR_PADDLE_MIN_CONFIDENCE=0.5
OCR_PADDLE_USE_GPU=false
OCR_TESSERACT_MIN_CONFIDENCE=0.6
```

## 📊 Test Output

### Console Output Example

```
================================================================================
 🚀 OCR ENGINE COMPREHENSIVE TEST SUITE
================================================================================

📦 Available Engines: 4
   • paddle: PaddleOCREngine
   • tesseract: TesseractEngine
   • mock: MockOCREngine
   • demo: DemoEngine

🧪 Running Tests...

================================================================================
 🧪 Testing: PADDLE
================================================================================
  📷 Image: 800x200 pixels
  [1/4] Extracting text with paddle...
        ✓ Method Used: paddle
        ✓ Confidence: 87.50%
        ✓ Success: ✅ Yes
        ✓ Processing Time: 1234ms
        ✓ Lines Detected: 3
        ✓ Text Preview: 'Testing paddle OCR Engine'
  [2/4] Encoding image data...
        ✓ Screenshot: 45678 bytes
        ✓ Thumbnail: 12345 bytes
  [3/4] Saving to ocr_test_results table...
        ✓ Saved with ID: 12abc34d...
  [4/4] Verifying database record...
        ✓ Verified - ocr_method 'paddle' stored correctly

================================================================================
 📊 TEST RESULTS SUMMARY
================================================================================

  Engine          Status     Method          Confidence     Time  Lines
  ------------------------------------------------------------------------------
  paddle          ✅ PASSED  paddle                87.50%  1234ms      3
  tesseract       ✅ PASSED  tesseract             76.20%   856ms      3
  mock            ✅ PASSED  mock                 100.00%     5ms      1
  demo            ✅ PASSED  demo                  95.00%    12ms      1

  Summary         Pass Rate  Avg Confidence  Avg Time
  ------------------------------------------------------------------------------
  4/4             100.0%     89.68%              527ms

 =============================================================================
 📋 RECENT DATABASE RECORDS (Last 10)
 =============================================================================

  Time                 Engine       Confidence     Time   Status Test
  ------------------------------------------------------------------------------
  2026-02-19 10:15:23  demo              95.00%     12ms       ✅ engine_test_demo
  2026-02-19 10:15:22  mock             100.00%      5ms       ✅ engine_test_mock
  2026-02-19 10:15:20  tesseract         76.20%    856ms       ✅ engine_test_tesseract
  2026-02-19 10:15:18  paddle            87.50%   1234ms       ✅ engine_test_paddle

================================================================================
 ✅ ALL TESTS PASSED - All engines working correctly!
================================================================================
```

## 🔧 Command-Line Options

| Option | Description | Example |
|--------|-------------|---------|
| `--engine NAME` | Test specific engine only | `--engine paddle` |
| `--image PATH` | Use custom test image | `--image screenshot.png` |
| `--no-db` | Skip database storage (dry run) | `--no-db` |
| `--list` | List available engines and exit | `--list` |

## 🧪 Testing Different Engines

### Switch OCR Engine via Environment

The easiest way to test different engines:

```bash
# Method 1: Set environment variable before running
export OCR_PRIMARY_ENGINE=tesseract
python -m tests.test_ocr_engines --engine tesseract

# Method 2: Update .env file
# Edit .env: OCR_PRIMARY_ENGINE=paddle
python -m tests.test_ocr_engines --engine paddle

# Method 3: Inline environment variable (Linux/Mac)
OCR_PRIMARY_ENGINE=demo python -m tests.test_ocr_engines --engine demo

# Windows PowerShell
$env:OCR_PRIMARY_ENGINE="demo"; python -m tests.test_ocr_engines --engine demo
```

### Test All Engines at Once

```bash
# Tests paddle, tesseract, mock, demo (and any custom engines)
python -m tests.test_ocr_engines
```

## 📁 Database Storage

### ocr_test_results Table

All test results are automatically stored in the `ocr_test_results` table:

| Column | Description |
|--------|-------------|
| `id` | Unique record ID |
| `user_id` | Test user ID (from TEST_USER_ID env var) |
| `organization_id` | Test org ID (from TEST_ORG_ID env var) |
| `timestamp` | Test execution time |
| `ocr_method` | Engine used (paddle, tesseract, demo, etc.) |
| `ocr_confidence` | Confidence score (0.0-1.0) |
| `extracted_text` | OCR extracted text |
| `ocr_line_count` | Number of text lines detected |
| `screenshot_base64` | Full image (base64) |
| `thumbnail_base64` | Thumbnail image (base64) |
| `processing_time_ms` | Processing time in milliseconds |
| `success` | Boolean success flag |
| `error_message` | Error details if failed |
| `test_name` | Test identifier |
| `test_notes` | Test description |

### Query Recent Test Results

```sql
-- View recent test results
SELECT 
    created_at,
    ocr_method,
    ocr_confidence,
    processing_time_ms,
    success,
    test_name
FROM ocr_test_results
ORDER BY created_at DESC
LIMIT 10;

-- Compare engine performance
SELECT 
    ocr_method,
    COUNT(*) as total_tests,
    AVG(ocr_confidence) as avg_confidence,
    AVG(processing_time_ms) as avg_time_ms,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
FROM ocr_test_results
GROUP BY ocr_method
ORDER BY avg_confidence DESC;
```

## 🔍 Advanced Usage

### Testing Custom OCR Engine

1. Create your engine (e.g., `ocr/engines/custom_engine.py`)
2. Configure environment variables:
   ```bash
   OCR_PRIMARY_ENGINE=custom
   OCR_CUSTOM_API_KEY=your-key
   OCR_CUSTOM_ENDPOINT=https://api.example.com
   ```
3. Run test:
   ```bash
   python -m tests.test_ocr_engines --engine custom
   ```

### Testing with Specific Images

```bash
# Test with screenshot
python -m tests.test_ocr_engines --image ~/screenshots/test.png

# Test all engines with same image
python -m tests.test_ocr_engines --image sample.png

# Dry run with custom image (no DB storage)
python -m tests.test_ocr_engines --image test.png --no-db
```

### Batch Testing Script

Create a shell script to test multiple configurations:

```bash
#!/bin/bash
# test_all_configs.sh

echo "Testing PaddleOCR..."
OCR_PRIMARY_ENGINE=paddle python -m tests.test_ocr_engines --engine paddle

echo "Testing Tesseract..."
OCR_PRIMARY_ENGINE=tesseract python -m tests.test_ocr_engines --engine tesseract

echo "Testing Mock..."
OCR_PRIMARY_ENGINE=mock python -m tests.test_ocr_engines --engine mock

echo "All tests complete!"
```

## 🐛 Troubleshooting

### Problem: "No OCR engines available"

**Solution**: Install OCR engine dependencies:
```bash
# Install PaddleOCR
pip install paddlepaddle paddleocr

# Install Tesseract
pip install pytesseract
# Also install Tesseract binary: https://github.com/tesseract-ocr/tesseract

# Install EasyOCR
pip install easyocr
```

### Problem: "Database error: ocr_test_results_ocr_method_check"

**Solution**: Run the database migration to allow dynamic engine names:
```bash
# Run migration
supabase db push

# Or apply manually
psql -h db.xxx.supabase.co -p 5432 -U postgres -d postgres \
  -f supabase/migrations/20260219_update_ocr_method_constraint_dynamic.sql
```

### Problem: "Missing Supabase configuration"

**Solution**: Add to your `.env` file:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or run in dry-run mode:
```bash
python -m tests.test_ocr_engines --no-db
```

### Problem: Engine test fails but facade works

**Solution**: Check engine-specific configuration:
```bash
# View engine availability
python -m tests.test_ocr_engines --list

# Check logs for import errors
python -c "from ocr import EngineFactory; print(EngineFactory.get_available_engines())"
```

## 📈 Performance Benchmarking

### Compare Engine Speed

```bash
# Test all engines and compare processing times
python -m tests.test_ocr_engines > benchmark_results.txt

# Extract timing data
grep "Processing Time" benchmark_results.txt
```

### Test with Different Image Sizes

```bash
# Small image
python -m tests.test_ocr_engines --image small_400x200.png

# Medium image
python -m tests.test_ocr_engines --image medium_1920x1080.png

# Large image
python -m tests.test_ocr_engines --image large_3840x2160.png
```

## 🔗 Related Files

- **Test Script**: [tests/test_ocr_engines.py](test_ocr_engines.py)
- **OCR Facade**: [../ocr/facade.py](../ocr/facade.py)
- **Engine Factory**: [../ocr/engine_factory.py](../ocr/engine_factory.py)
- **Configuration**: [../ocr/config.py](../ocr/config.py)
- **Database Schema**: [../../supabase/migrations/20240218_create_ocr_test_table.sql](../../supabase/migrations/20240218_create_ocr_test_table.sql)
- **Migration**: [../../supabase/migrations/20260219_update_ocr_method_constraint_dynamic.sql](../../supabase/migrations/20260219_update_ocr_method_constraint_dynamic.sql)

## 📝 Writing Custom Tests

Create your own test script based on `test_ocr_engines.py`:

```python
from tests.test_ocr_engines import OCRTester
from PIL import Image

# Initialize tester
tester = OCRTester(save_to_db=True)

# Create custom image
img = Image.open('my_test_image.png')

# Test specific engine
tester.test_engine('paddle', test_image=img, test_name='my_custom_test')

# View results
print(tester.results)
```

## 🎯 Best Practices

1. **Run migration first**: Ensure database supports dynamic engine names
   ```bash
   supabase db push
   ```

2. **Test incrementally**: Test one engine at a time before running all
   ```bash
   python -m tests.test_ocr_engines --engine paddle
   ```

3. **Use dry-run for development**: Skip DB storage during development
   ```bash
   python -m tests.test_ocr_engines --no-db
   ```

4. **Save benchmark data**: Redirect output to file for comparison
   ```bash
   python -m tests.test_ocr_engines > results_$(date +%Y%m%d).txt
   ```

5. **Check engine availability**: Always verify engines are installed
   ```bash
   python -m tests.test_ocr_engines --list
   ```

## 📚 Additional Resources

- [OCR Facade Refactoring Plan](../../docs/OCR_FACADE_REFACTORING_PLAN.md)
- [OCR Method Storage Update](../../docs/OCR_METHOD_STORAGE_UPDATE.md)
- [Configuration Guide](../../docs/CONFIGURATION_GUIDE.md)

---

**Questions or Issues?** Check the main documentation or create an issue in the repository.
