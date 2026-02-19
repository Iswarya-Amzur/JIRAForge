# OCR Testing Setup - Quick Start

## ✅ What Was Created

### 1. **Supabase Test Table** 
[supabase/migrations/20240218_create_ocr_test_table.sql](../supabase/migrations/20240218_create_ocr_test_table.sql)

New table `ocr_test_results` with columns:
- `extracted_text` - OCR extracted text
- `ocr_confidence` - Confidence score (0.0-1.0)
- `ocr_method` - 'paddle', 'tesseract', or 'metadata'
- `ocr_line_count` - Number of lines detected
- `processing_time_ms` - Processing time in milliseconds
- `image_width`, `image_height` - Image dimensions
- `success` - Whether OCR succeeded
- `test_name` - Test identifier
- Plus window metadata, timestamps, etc.

### 2. **Quick Test Script** (Recommended)
[python-desktop-app/test_ocr_quick.py](../python-desktop-app/test_ocr_quick.py)

Simple script that:
- Takes screenshot in 3 seconds
- Extracts text with OCR
- Saves to Supabase
- Verifies save
- Shows recent tests

**Output includes:** Method, confidence, lines, time, preview, verification

### 3. **Verbose Test Script** (Detailed)
[python-desktop-app/test_ocr_verbose.py](../python-desktop-app/test_ocr_verbose.py)

Comprehensive script with detailed logging:
- Full input/output logging
- Complete extracted text
- Supabase payload details
- Verification results
- Recent test history

**Usage:**
```bash
python test_ocr_verbose.py --screenshot
python test_ocr_verbose.py --file image.png
python test_ocr_verbose.py --screenshot --name "my_test"
```

### 4. **Testing Guide**
[docs/OCR_TESTING_GUIDE.md](./OCR_TESTING_GUIDE.md)

Complete documentation with:
- Prerequisites & setup
- Step-by-step instructions
- Test scenarios
- SQL queries for analysis
- Troubleshooting guide
- Performance expectations

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Tesseract (if not already)
**Windows:**
```bash
choco install tesseract
# OR download from: https://github.com/UB-Mannheim/tesseract/wiki
```

Verify:
```bash
tesseract --version
```

### Step 2: Create Supabase Table
1. Open Supabase SQL Editor
2. Copy SQL from `supabase/migrations/20240218_create_ocr_test_table.sql`
3. Run the SQL

### Step 3: Configure .env
Update `python-desktop-app/.env`:

```env
# Supabase Configuration (for testing only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Test User IDs
TEST_USER_ID=00000000-0000-0000-0000-000000000001
TEST_ORG_ID=00000000-0000-0000-0000-000000000001
```

**Important:** Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key) to bypass RLS.

---

## ▶️ Run Your First Test

```bash
cd python-desktop-app
python test_ocr_quick.py
```

When prompted:
1. Wait 3 seconds
2. Switch to a window with text (code editor, browser, terminal)
3. Watch the test run automatically

Expected output:
```
📸 Taking screenshot in 3 seconds...

[1/4] Capturing screenshot...
      ✓ Captured 1920x1080 pixels

[2/4] Extracting text with OCR...
      ✓ Method: paddle
      ✓ Confidence: 0.93
      ✓ Lines: 15
      ✓ Time: 847ms
      
      Extracted text preview:
      "import os def upload_screenshot(): ..."

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

## 📊 View Results in Supabase

### Dashboard
1. Go to Table Editor
2. Select `ocr_test_results`
3. View all saved tests

### SQL Queries

**All tests:**
```sql
SELECT 
    created_at,
    ocr_method,
    ocr_confidence,
    ocr_line_count,
    LENGTH(extracted_text) as text_length,
    success
FROM ocr_test_results 
ORDER BY created_at DESC 
LIMIT 10;
```

**Summary statistics:**
```sql
SELECT * FROM ocr_test_summary;
```

**Compare methods:**
```sql
SELECT 
    ocr_method,
    COUNT(*) as total,
    AVG(ocr_confidence) as avg_confidence,
    AVG(processing_time_ms) as avg_time
FROM ocr_test_results
WHERE success = true
GROUP BY ocr_method;
```

---

## 🧪 Test Different Scenarios

Run multiple tests with different content types:

### 1. Code Editor
```bash
# Open VS Code with code visible
python test_ocr_quick.py
```
Expected: High confidence (>0.90)

### 2. Web Browser
```bash
# Open browser with readable text
python test_ocr_quick.py
```
Expected: Medium-high (0.75-0.90)

### 3. Terminal
```bash
# Open terminal with commands
python test_ocr_quick.py
```
Expected: High confidence (>0.85)

### 4. Document
```bash
# Open PDF/Word with text
python test_ocr_quick.py
```
Expected: Medium (0.60-0.80)

### 5. Image File (Verbose)
```bash
python test_ocr_verbose.py --file screenshot.png --name "specific_test"
```
Expected: Full detailed logging

---

## 🐛 Troubleshooting

### Error: "pytesseract not found"
**Solution:** Install Tesseract binary (Step 1 above)

### Error: "Missing Supabase configuration"
**Solution:** Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env`

### Error: "relation 'ocr_test_results' does not exist"
**Solution:** Run the SQL migration (Step 2 above)

### Error: "row-level security policy violation"
**Solution:** Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key)

### OCR confidence always low (<0.5)
**Possible causes:**
- Poor image quality
- Non-English text (change language in `ocr/ocr_engine.py`)
- Wrong preprocessing settings

---

## 📈 What Success Looks Like

### Good Results ✅
- **PaddleOCR success**: 70-80% of tests
- **Confidence**: 0.80-0.98 for clear text
- **Processing time**: 500-1500ms
- **Lines detected**: Matches actual content
- **Text accuracy**: 90%+ readable text extracted

### Expected Behavior ✅
- **Fallback to Tesseract**: 15-25% of tests (normal)
- **Metadata fallback**: <5% (images with no text)
- **Some OCR errors**: Normal for mixed content
- **Variable confidence**: Normal across different windows

---

## 📚 Full Documentation

For complete details, see:
- **[OCR_TESTING_GUIDE.md](./OCR_TESTING_GUIDE.md)** - Comprehensive testing guide
- **[OCR_IMPLEMENTATION_COMPLETE.md](./OCR_IMPLEMENTATION_COMPLETE.md)** - Implementation overview
- **[PADDLE_OCR_INTEGRATION_PLAN.md](./PADDLE_OCR_INTEGRATION_PLAN.md)** - Original plan

---

## ✅ Next Steps After Testing

Once you've run 10-20 successful tests:

1. **Analyze results** - Check confidence scores, processing times
2. **Tune thresholds** - Adjust if needed in `ocr/text_extractor.py`
3. **Verify accuracy** - Compare extracted text with actual screenshots
4. **Plan migration** - Add columns to main `screenshots` table
5. **Update AI server** - Implement text analysis instead of Vision API

---

## 💡 Tips

1. **Test different content** - Code, documents, websites, terminals
2. **Check processing time** - Should be under 2 seconds for 1920x1080
3. **Monitor confidence** - Should be >0.80 for clear text
4. **Watch for fallbacks** - Tesseract fallback is normal
5. **Use verbose script** - When debugging specific issues

---

## 🎯 Summary

You now have:
- ✅ Separate test table (`ocr_test_results`)
- ✅ Quick test script (simple, fast)
- ✅ Verbose test script (detailed logging)
- ✅ Complete documentation
- ✅ SQL queries for analysis

**Ready to test!** Run `python test_ocr_quick.py` and see OCR in action.

Questions? Check [OCR_TESTING_GUIDE.md](./OCR_TESTING_GUIDE.md) for troubleshooting.
