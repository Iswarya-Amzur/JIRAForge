# Quick Start: Testing OCR Engines

## 🚀 Run Your First Test

```bash
# 1. Test all available engines
python -m tests.test_ocr_engines

# 2. Test specific engine
python -m tests.test_ocr_engines --engine paddle

# 3. List available engines
python -m tests.test_ocr_engines --list
```

## 🔧 Change OCR Engine

### Option 1: Update `.env` file

```bash
# Edit python-desktop-app/.env
OCR_PRIMARY_ENGINE=tesseract
OCR_FALLBACK_ENGINES=paddle,mock
```

Then run:
```bash
python -m tests.test_ocr_engines --engine tesseract
```

### Option 2: Set environment variable

**Windows (PowerShell):**
```powershell
$env:OCR_PRIMARY_ENGINE="paddle"
python -m tests.test_ocr_engines --engine paddle
```

**Linux/Mac:**
```bash
export OCR_PRIMARY_ENGINE=tesseract
python -m tests.test_ocr_engines --engine tesseract
```

### Option 3: Inline (one command)

**Windows (PowerShell):**
```powershell
$env:OCR_PRIMARY_ENGINE="demo"; python -m tests.test_ocr_engines --engine demo
```

**Linux/Mac:**
```bash
OCR_PRIMARY_ENGINE=mock python -m tests.test_ocr_engines --engine mock
```

## 📊 View Results in Database

Results are automatically stored in `ocr_test_results` table.

### Query via Supabase Dashboard

```sql
SELECT 
    created_at,
    ocr_method,
    ocr_confidence,
    processing_time_ms,
    success,
    extracted_text
FROM ocr_test_results
ORDER BY created_at DESC
LIMIT 10;
```

### Compare Engine Performance

```sql
SELECT 
    ocr_method,
    COUNT(*) as tests,
    AVG(ocr_confidence) as avg_confidence,
    AVG(processing_time_ms) as avg_time,
    SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as success_rate
FROM ocr_test_results
GROUP BY ocr_method
ORDER BY avg_confidence DESC;
```

## 🖼️ Test with Custom Images

```bash
# Use generated fixture
python -m tests.test_ocr_engines --image tests/fixtures/document.png

# Use your own screenshot
python -m tests.test_ocr_engines --image ~/Downloads/screenshot.png

# Test all engines with same image
python -m tests.test_ocr_engines --image tests/fixtures/multiline_text.png
```

## 🎨 Generate Test Images

```bash
# Create sample test images
python -m tests.generate_fixtures

# Images will be in: tests/fixtures/
# - simple_text.png
# - multiline_text.png
# - document.png
# - noisy_text.png
# ... and more
```

## ⚙️ Available Engines

| Engine | Install | Configuration |
|--------|---------|---------------|
| **paddle** | `pip install paddlepaddle paddleocr` | `OCR_PADDLE_MIN_CONFIDENCE=0.5` |
| **tesseract** | `pip install pytesseract` + [binary](https://github.com/tesseract-ocr/tesseract) | `OCR_TESSERACT_MIN_CONFIDENCE=0.6` |
| **mock** | Built-in (no install) | Always available |
| **demo** | Built-in (no install) | `OCR_DEMO_REVERSE_TEXT=true` |

### Check What's Installed

```bash
python -m tests.test_ocr_engines --list
```

Output:
```
📦 Available OCR Engines:
  ✅ paddle: PaddleOCREngine
  ✅ tesseract: TesseractEngine
  ✅ mock: MockOCREngine
  ✅ demo: DemoEngine
```

## 🐛 Troubleshooting

### "No OCR engines available"
```bash
pip install paddlepaddle paddleocr
```

### "Database error: ocr_method_check"
```bash
# Run migration to allow dynamic engine names
supabase db push
```

### "Missing Supabase configuration"
Add to `.env`:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

Or run without database:
```bash
python -m tests.test_ocr_engines --no-db
```

## 📚 Full Documentation

See [tests/README.md](README.md) for complete documentation.

## 💡 Common Test Scenarios

### Scenario 1: Compare All Engines
```bash
python -m tests.test_ocr_engines
```

### Scenario 2: Test Production Engine
```bash
python -m tests.test_ocr_engines --engine paddle --image tests/fixtures/document.png
```

### Scenario 3: Development (No Database)
```bash
python -m tests.test_ocr_engines --no-db
```

### Scenario 4: Benchmark Performance
```bash
python -m tests.test_ocr_engines > benchmark_$(date +%Y%m%d_%H%M%S).txt
```

---

**Need Help?** Check the [full README](README.md) or ask in the project chat.
