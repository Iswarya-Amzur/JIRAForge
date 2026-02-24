# 🚀 Quick Start Guide - Testing Productivity Tracking System

## Fastest Way to Run Tests

### Windows
```bash
cd python-desktop-app
run_tests.bat
```

### Linux/Mac
```bash
cd python-desktop-app
chmod +x run_tests.sh
./run_tests.sh
```

### Direct Python Execution
```bash
cd python-desktop-app
python test_productivity_tracking_system.py
```

---

## What Gets Tested?

### ✅ Full System Flow
```
Window Capture → Classification → OCR → Session Management → Batch Upload
```

### 📋 Test Categories (24 tests total)

| Category | Tests | What It Validates |
|----------|-------|-------------------|
| **Classification** | 8 | Local lookup + LLM fallback for productive/non-productive/private/unknown apps |
| **OCR** | 4 | Primary engine, fallback engine, and proper skip for non-productive/private |
| **Session** | 4 | JSON records, tab switching, timelog accumulation, no duplicates |
| **Batch** | 4 | 5-minute uploads, Jira context injection, session clearing |
| **Integration** | 4 | End-to-end flow from capture to batch analysis |

---

## Quick Commands

### Run Everything
```bash
python test_productivity_tracking_system.py
```

### Run Specific Categories
```bash
# Classification only
python test_productivity_tracking_system.py --classification

# OCR only
python test_productivity_tracking_system.py --ocr

# Session management only
python test_productivity_tracking_system.py --session

# Batch analysis only
python test_productivity_tracking_system.py --batch

# Integration tests only
python test_productivity_tracking_system.py --integration
```

### Run Multiple Categories
```bash
python test_productivity_tracking_system.py --classification --session --batch
```

---

## Expected Output

```
======================================================================
  PRODUCTIVITY & ACTIVITY TRACKING SYSTEM - TEST SUITE
======================================================================

📋 Loading Classification Tests...
🔍 Loading OCR Processing Tests...
⏱️  Loading Session Management Tests...
📊 Loading Batch Analysis Tests...
🔗 Loading Integration Tests...

----------------------------------------------------------------------

✓ Step A: Productive process classification works
✓ Step A: Non-productive process classification works
✓ Step A: Private process classification works
✓ Step A: Browser URL classification (productive) works
✓ OCR Primary Engine: method=paddle, text=Productive Work...
✓ New window creates JSON record in active_sessions
✓ Tab switching creates new JSON record
✓ Returning to previous tab updates existing record (no duplicate)
✓ Batch upload structure is correct
✓ Active sessions cleared after successful batch upload

...

======================================================================
  TEST SUMMARY
======================================================================
Tests run: 24
Successes: 24
Failures: 0
Errors: 0
======================================================================
```

---

## Prerequisites

### Minimal (Core Tests)
```bash
pip install pillow psutil requests python-dotenv supabase
```

### Full (Including OCR)
```bash
# Core
pip install pillow psutil requests python-dotenv supabase

# OCR Engines
pip install paddlepaddle paddleocr  # Primary
pip install pytesseract             # Fallback
pip install easyocr                 # Alternative
```

**Note**: OCR tests gracefully skip if engines not installed

---

## Test Details

### 1. Classification Tests
Validates that apps are correctly categorized:
- ✅ VSCode, PyCharm → **Productive**
- ✅ Steam, Spotify → **Non-Productive**
- ✅ Banking apps → **Private**
- ✅ Unknown apps → Trigger **LLM classification**
- ✅ Browser tabs use URL matching
- ✅ Wildcard patterns work (*.bank.*)

### 2. OCR Tests
Validates OCR behavior:
- ✅ Primary engine (Paddle) extracts text
- ✅ Fallback engine (Tesseract) activates on failure
- ✅ **OCR skipped** for Non-Productive apps
- ✅ **OCR skipped** for Private apps
- ✅ **OCR runs** for Productive apps only

### 3. Session Management Tests
Validates time tracking:
- ✅ New window → New JSON record
- ✅ Switch tab → New record
- ✅ Return to tab → Update existing (no duplicate)
- ✅ Time accumulates across visits
- ✅ Visit count increments correctly

### 4. Batch Analysis Tests
Validates 5-minute batch uploads:
- ✅ Batch contains all active sessions
- ✅ Productive records marked `pending` (need LLM)
- ✅ Non-productive records marked `analyzed` (no LLM)
- ✅ Jira issues included as context
- ✅ Sessions cleared after successful upload

### 5. Integration Tests
Validates complete flow:
- ✅ Capture → Classify → OCR → Session → Batch
- ✅ Multiple window switches tracked
- ✅ Time accumulates properly
- ✅ Batch prepared with Jira context

---

## Architecture Being Tested

```
┌─────────────────────────────────────────────────────────────┐
│  1. CAPTURE & CLASSIFICATION                                │
│     ┌──────────────┐                                        │
│     │ Window Event │                                        │
│     └──────┬───────┘                                        │
│            │                                                 │
│            ├─→ Step A: Local Lookup (SQLite cache)         │
│            │   └─→ Productive / Non-Productive / Private   │
│            │                                                 │
│            └─→ Step B: LLM Fallback (Unknown apps)         │
│                └─→ Update cache with result                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  2. OCR PROCESSING (Productive Apps Only)                   │
│     ┌─────────────┐                                         │
│     │ Screenshot  │                                         │
│     └──────┬──────┘                                         │
│            │                                                 │
│            ├─→ Primary Engine (Paddle)                     │
│            │   └─→ Success? Store text                     │
│            │                                                 │
│            └─→ Fallback Engine (Tesseract)                │
│                └─→ Success? Store text                     │
│                                                             │
│     ⛔ Skipped for: Non-Productive, Private                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  3. SESSION & TIME-LOG MANAGEMENT                           │
│     JSON Record: {window_title, process_name, ocr_text,    │
│                   timelog, visit_count}                     │
│                                                             │
│     ┌─────────────┐                                        │
│     │  New Tab?   │──Yes─→ Create new JSON record         │
│     └──────┬──────┘                                        │
│            │                                                │
│            No                                               │
│            │                                                │
│     ┌──────▼────────┐                                      │
│     │ Existing Tab? │──Yes─→ Update existing record       │
│     └───────────────┘        (append timelog)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  4. BATCH ANALYSIS & REPORTING (Every 5 Minutes)            │
│                                                             │
│     1. Gather all JSON records from active_sessions        │
│     2. Fetch user's assigned Jira issues                   │
│     3. Build batch payload with context                    │
│     4. Upload to Supabase (status: pending/analyzed)       │
│     5. AI Server analyzes productive records              │
│     6. Clear active_sessions table                         │
│                                                             │
│     Productive → status='pending' (needs LLM)             │
│     Non-Prod   → status='analyzed' (no LLM needed)        │
│     Private    → status='analyzed' (no LLM needed)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Test Fails: "ModuleNotFoundError: No module named 'desktop_app'"
**Solution**: Run from python-desktop-app directory
```bash
cd python-desktop-app
python test_productivity_tracking_system.py
```

### OCR Tests Skipped
**Solution**: This is expected if OCR engines not installed. Tests still pass.
To enable OCR tests:
```bash
pip install paddlepaddle paddleocr
```

### Database Lock Error
**Solution**: Close any running instances of the desktop app
```bash
# Windows
taskkill /F /IM python.exe

# Linux/Mac
pkill -f desktop_app.py
```

---

## Next Steps

After tests pass:
1. ✅ Review test output for any warnings
2. ✅ Check `TEST_PRODUCTIVITY_SYSTEM_README.md` for detailed docs
3. ✅ Run integration tests separately if needed
4. ✅ Add custom test cases for your specific workflows

---

## Files Created

| File | Purpose |
|------|---------|
| `test_productivity_tracking_system.py` | Main test suite (900+ lines) |
| `TEST_PRODUCTIVITY_SYSTEM_README.md` | Comprehensive documentation |
| `run_tests.bat` | Windows quick start script |
| `run_tests.sh` | Linux/Mac quick start script |
| `QUICKSTART_TESTING.md` | This file - quick reference |

---

## Support

📖 **Full Documentation**: `TEST_PRODUCTIVITY_SYSTEM_README.md`  
🏗️ **Architecture Guide**: `../docs/COMPLETE_ARCHITECTURE_GUIDE.md`  
🔧 **Troubleshooting**: `../docs/desktop-app_TROUBLESHOOTING.md`

---

**Ready to test?** Run `python test_productivity_tracking_system.py` now! 🚀
