# OCR Testing Guide

Complete guide for testing OCR text extraction and Supabase integration.

---

## 📋 Prerequisites

### 1. Install Dependencies
```bash
cd python-desktop-app
pip install -r requirements.txt
```

### 2. Install Tesseract Binary
**Windows:**
```bash
# Option 1: Chocolatey
choco install tesseract

# Option 2: Manual download
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
# Add to PATH: C:\Program Files\Tesseract-OCR\tesseract.exe
```

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

Verify installation:
```bash
tesseract --version
```

### 3. Setup Supabase Test Table

Run the migration to create the `ocr_test_results` table:

**Option A: Supabase Dashboard**
1. Go to SQL Editor in Supabase dashboard
2. Copy contents of `supabase/migrations/20240218_create_ocr_test_table.sql`
3. Run the SQL

**Option B: Supabase CLI**
```bash
cd supabase
supabase migration up
```

### 4. Configure Environment Variables

Create or update `.env` file in `python-desktop-app/`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Test User IDs (for testing OCR)
TEST_USER_ID=00000000-0000-0000-0000-000000000001
TEST_ORG_ID=00000000-0000-0000-0000-000000000001
```

**Important:** Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key) to bypass RLS during testing.

---

## 🧪 Running Tests

### Quick Test (Recommended)
Simplest way to test OCR + Supabase:

```bash
cd python-desktop-app
python test_ocr_quick.py
```

**What it does:**
1. Takes a screenshot in 3 seconds (switch to a text window!)
2. Extracts text using OCR (PaddleOCR → Tesseract fallback)
3. Saves to `ocr_test_results` table
4. Verifies the save
5. Shows last 3 test results

**Expected output:**
```
📸 Taking screenshot in 3 seconds...
   (Switch to a window with text to test OCR)

[1/4] Capturing screenshot...
      ✓ Captured 1920x1080 pixels

[2/4] Extracting text with OCR...
      ✓ Method: paddle
      ✓ Confidence: 0.93
      ✓ Lines: 15
      ✓ Time: 847ms

      Extracted text preview (first 150 chars):
      "import os def upload_screenshot(): screenshot ..."

[3/4] Saving to Supabase...
      ✓ Saved with ID: 8a7b3c4d...

[4/4] Verifying save...
      ✓ Verified - record exists in database

📊 Last 3 tests in database:
   1. 2024-02-18 14:32:15 | paddle     | 0.93 | ✅
   2. 2024-02-18 14:28:42 | tesseract  | 0.78 | ✅
   3. 2024-02-18 14:25:10 | paddle     | 0.91 | ✅

✅ TEST COMPLETE
```

---

### Verbose Test (Detailed Logging)
For detailed debugging and analysis:

#### Test with current screenshot:
```bash
python test_ocr_verbose.py --screenshot
```

#### Test with existing image:
```bash
python test_ocr_verbose.py --file path/to/image.png
```

#### Test with custom name:
```bash
python test_ocr_verbose.py --screenshot --name "code_editor_test"
```

**Verbose output includes:**
- 📸 Screenshot/image details
- 🔍 OCR input parameters
- ⏱️ Processing time breakdown
- 📝 Full extracted text
- 💾 Supabase save payload
- ✓ Verification result
- 📊 Recent test history

---

## 📊 Viewing Results

### Supabase Dashboard
1. Go to Table Editor
2. Select `ocr_test_results` table
3. View all test results with filters

### SQL Queries

**View all tests:**
```sql
SELECT * FROM ocr_test_results ORDER BY created_at DESC LIMIT 10;
```

**View summary statistics:**
```sql
SELECT * FROM ocr_test_summary;
```

**View successful tests only:**
```sql
SELECT 
    created_at,
    ocr_method,
    ocr_confidence,
    ocr_line_count,
    processing_time_ms,
    window_title
FROM ocr_test_results
WHERE success = true
ORDER BY created_at DESC;
```

**Compare OCR methods:**
```sql
SELECT 
    ocr_method,
    COUNT(*) as total,
    AVG(ocr_confidence) as avg_confidence,
    AVG(processing_time_ms) as avg_time_ms,
    COUNT(CASE WHEN success THEN 1 END) as successful
FROM ocr_test_results
GROUP BY ocr_method;
```

**View extraction performance:**
```sql
SELECT 
    ocr_method,
    CASE 
        WHEN processing_time_ms < 500 THEN 'Fast (<0.5s)'
        WHEN processing_time_ms < 1000 THEN 'Normal (0.5-1s)'
        WHEN processing_time_ms < 2000 THEN 'Slow (1-2s)'
        ELSE 'Very Slow (>2s)'
    END as speed,
    COUNT(*) as count
FROM ocr_test_results
WHERE success = true
GROUP BY ocr_method, speed
ORDER BY ocr_method, speed;
```

---

## 🧾 Test Scenarios

### 1. Code Editor Test
Test OCR on code:
```bash
# Open VS Code or any code editor with visible code
python test_ocr_quick.py
```

Expected: High confidence (>0.90), many lines detected

### 2. Browser Test
Test OCR on web page:
```bash
# Open browser with readable text
python test_ocr_quick.py
```

Expected: Medium-high confidence (0.75-0.90)

### 3. Terminal Test
Test OCR on terminal output:
```bash
# Open terminal with commands/output
python test_ocr_quick.py
```

Expected: High confidence (>0.85), monospace text

### 4. Mixed Content Test
Test OCR on document with images + text:
```bash
# Open PDF or Word document
python test_ocr_quick.py
```

Expected: Medium confidence (0.60-0.80), some false detections

### 5. Low Quality Test
Test fallback to Tesseract:
```bash
# Use a blurry or low-contrast image
python test_ocr_verbose.py --file blurry_image.png
```

Expected: May fallback to Tesseract method

### 6. No Text Test
Test metadata fallback:
```bash
# Open image viewer with photo (no text)
python test_ocr_quick.py
```

Expected: Low confidence, empty text, method='metadata'

---

## 🐛 Troubleshooting

### Error: "No module named 'ocr'"
**Cause:** Running from wrong directory
**Solution:**
```bash
cd python-desktop-app
python test_ocr_quick.py
```

### Error: "pytesseract not found"
**Cause:** Tesseract binary not installed or not in PATH
**Solution (Windows):**
1. Download installer: https://github.com/UB-Mannheim/tesseract/wiki
2. Install to `C:\Program Files\Tesseract-OCR`
3. Add to PATH or set in code:
```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### Error: "Missing Supabase configuration"
**Cause:** `.env` file missing or incomplete
**Solution:** Create `.env` with:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

### Error: "relation 'ocr_test_results' does not exist"
**Cause:** Migration not run
**Solution:** Run the SQL migration in Supabase dashboard

### Error: "new row violates row-level security policy"
**Cause:** Using anon key instead of service role key
**Solution:** Use `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### Warning: OCR confidence always < 0.5
**Cause:** 
- Poor image quality
- Wrong language setting
- Preprocessing issues

**Solution:**
1. Check image quality (resolution, contrast)
2. Change language in `ocr/ocr_engine.py`:
   ```python
   ocr = PaddleOCR(lang='en')  # Try 'ch', 'fr', etc.
   ```
3. Try disabling preprocessing:
   ```python
   result = extract_text_from_image(img, use_preprocessing=False)
   ```

### OCR taking > 5 seconds
**Cause:** Large image size or CPU-only processing
**Solution:**
1. Check image size - resize if > 4096px
2. Enable GPU (if available):
   ```python
   # In ocr/ocr_engine.py
   ocr = PaddleOCR(use_gpu=True)
   ```

---

## 📈 Performance Expectations

### Processing Time
- **Small images** (800x600): 300-500ms
- **Normal screenshots** (1920x1080): 500-1000ms
- **Large images** (4K): 1000-2000ms
- **Fallback to Tesseract**: +1000-2000ms

### Accuracy by Content Type
- **Code/Terminal**: 95-98% (monospace, clear)
- **Documents**: 90-95% (paragraphs, structured)
- **Websites**: 85-92% (mixed fonts, styles)
- **PDFs**: 80-90% (depends on quality)
- **Handwriting**: 40-60% (not optimized)

### Success Rate
- **PaddleOCR**: 70-80% of screenshots (high confidence)
- **Tesseract**: 15-25% of screenshots (PaddleOCR failed)
- **Metadata fallback**: <5% of screenshots (both failed)

---

## 🔍 Analyzing Test Results

### Python Script for Analysis
```python
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(
    os.getenv('SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

# Get summary
results = supabase.table('ocr_test_summary').select('*').execute()

for row in results.data:
    print(f"\n{row['ocr_method'].upper()}")
    print(f"  Total: {row['total_tests']}")
    print(f"  Success: {row['successful_tests']} ({row['successful_tests']/row['total_tests']*100:.1f}%)")
    print(f"  Avg Confidence: {row['avg_confidence']:.2f}")
    print(f"  Avg Time: {row['avg_processing_ms']}ms")
    print(f"  Avg Lines: {row['avg_line_count']}")
```

---

## 🎯 Next Steps

After testing is successful:

1. **Verify table structure** - Ensure all columns saving correctly
2. **Run 20+ tests** - Different content types, windows, scenarios
3. **Analyze performance** - Check processing times, confidence scores
4. **Tune thresholds** - Adjust confidence thresholds in `text_extractor.py` if needed
5. **Migrate to production** - Add columns to main `screenshots` table
6. **Update AI server** - Implement text analysis instead of Vision API

---

## 📚 Related Documentation

- [OCR_IMPLEMENTATION_COMPLETE.md](./OCR_IMPLEMENTATION_COMPLETE.md) - Implementation details
- [PADDLE_OCR_INTEGRATION_PLAN.md](./PADDLE_OCR_INTEGRATION_PLAN.md) - Original plan
- [python-desktop-app/ocr/](../python-desktop-app/ocr/) - OCR module source code

---

## ❓ Questions?

If you encounter issues:
1. Check logs in console (verbose output)
2. Verify table exists in Supabase
3. Check `.env` configuration
4. Test Tesseract separately: `tesseract --version`
5. Try simple image first before complex screenshots

Happy testing! 🎉
