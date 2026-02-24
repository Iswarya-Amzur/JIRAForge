# Time Tracker Launcher Options

Multiple ways to start the app with automatic OCR dependency management.

## 🚀 Quick Start (Recommended)

### Windows Users (Easiest)
**Double-click** `launch.bat` - that's it!

### PowerShell Users
```powershell
.\launch.ps1
```

### Python Users
```bash
python launch.py
```

---

## 📋 All Available Methods

### **Method 1: Batch Script (Windows)**
```bash
launch.bat
```

**Pros:**
- ✅ Double-click to run (no terminal needed)
- ✅ Works on any Windows machine
- ✅ Automatically checks dependencies
- ✅ Shows errors if something fails

**Cons:**
- ❌ Windows only

---

### **Method 2: PowerShell Script**
```powershell
# Basic usage
.\launch.ps1

# Advanced options
.\launch.ps1 -SkipDeps        # Skip dependency check
.\launch.ps1 -DepsOnly        # Only check deps
.\launch.ps1 -Silent          # Silent mode
```

**Pros:**
- ✅ More control with parameters
- ✅ Better error handling
- ✅ Colored output
- ✅ Can be scripted/automated

**Cons:**
- ❌ May need to enable script execution:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

### **Method 3: Python Launcher**
```bash
# Basic usage
python launch.py

# Advanced options
python launch.py --skip-deps   # Skip dependency check
python launch.py --deps-only   # Only check deps
python launch.py --silent      # Silent mode
```

**Pros:**
- ✅ Cross-platform (Windows/Linux/Mac)
- ✅ Same interface as CLI tool
- ✅ Can be imported as module

**Cons:**
- ❌ Requires terminal/command prompt

---

### **Method 4: CLI Tool + Manual Start**
```bash
# Step 1: Check and install dependencies
python -m ocr.auto_installer

# Step 2: Start the app
python desktop_app.py
```

**Pros:**
- ✅ Most control
- ✅ Can check deps without starting app
- ✅ Good for debugging

**Cons:**
- ❌ Two separate commands
- ❌ More manual work

---

### **Method 5: Direct Start (No Dependency Check)**
```bash
python desktop_app.py
```

**Pros:**
- ✅ Fastest startup
- ✅ Clean, no extra steps

**Cons:**
- ❌ No automatic dependency installation
- ❌ Manual `pip install` needed when changing engines

---

## 🎯 Which Method Should I Use?

| Scenario | Recommended Method |
|----------|-------------------|
| **Just want it to work** | `launch.bat` (double-click) |
| **Developing/testing** | `python launch.py` |
| **Changed OCR engine in .env** | `python -m ocr.auto_installer` then `python desktop_app.py` |
| **Production/deployment** | `python desktop_app.py` (deps pre-installed) |
| **Debugging dependency issues** | `python -m ocr.auto_installer --check` |
| **Automation/CI/CD** | `.\launch.ps1 -Silent` or `python launch.py --silent` |

---

## 🔧 CLI Tool Reference

The auto-installer can be run standalone:

```bash
# Check configured engines and missing dependencies
python -m ocr.auto_installer --check

# Auto-install missing dependencies
python -m ocr.auto_installer

# Add new engine to .env and install it
python -m ocr.auto_installer --add easyocr --primary
python -m ocr.auto_installer --add tesseract --fallback

# Silent mode (no output)
python -m ocr.auto_installer --silent
```

---

## 📝 Workflow Examples

### **Scenario 1: Fresh Setup**
```bash
# 1. Clone repo
git clone https://github.com/AmzurATG/JIRAForge.git
cd JIRAForge/python-desktop-app

# 2. Configure OCR in .env
# OCR_PRIMARY_ENGINE=paddle

# 3. Run launcher (auto-installs paddle dependencies)
launch.bat
```

### **Scenario 2: Change OCR Engine**
```bash
# 1. Edit .env
# OCR_PRIMARY_ENGINE=easyocr

# 2. Run launcher (auto-installs easyocr dependencies)
python launch.py

# That's it! EasyOCR is now installed and ready to use
```

### **Scenario 3: Test Different Engines**
```bash
# Test with PaddleOCR
echo OCR_PRIMARY_ENGINE=paddle > .env
python launch.py --deps-only      # Install paddle deps
python -m tests.test_ocr_engines --engine paddle --screenshot

# Test with EasyOCR
echo OCR_PRIMARY_ENGINE=easyocr > .env
python launch.py --deps-only      # Install easyocr deps
python -m tests.test_ocr_engines --engine easyocr --screenshot

# Test with Tesseract
echo OCR_PRIMARY_ENGINE=tesseract > .env
python launch.py --deps-only      # Install tesseract deps
python -m tests.test_ocr_engines --engine tesseract --screenshot
```

### **Scenario 4: Production Deployment**
```bash
# Build environment has all dependencies pre-installed
# No auto-installer needed at runtime

# Option A: Install all engines upfront
pip install paddleocr paddlepaddle opencv-python
pip install easyocr torch torchvision
pip install pytesseract

# Option B: Use requirements.txt
pip install -r requirements.txt

# Start app directly (no launcher needed)
python desktop_app.py
```

### **Scenario 5: Debugging Dependency Issues**
```bash
# 1. Check what's configured and missing
python -m ocr.auto_installer --check

# Output:
# Configured engines: paddle, easyocr
# [PADDLE] ✅ All dependencies installed
# [EASYOCR] ⚠️  Missing: easyocr>=1.7.0

# 2. Install missing dependencies
python -m ocr.auto_installer

# 3. Verify installation
python -c "import easyocr; print('EasyOCR version:', easyocr.__version__)"

# 4. Test engine
python -m tests.test_ocr_engines --engine easyocr --screenshot
```

---

## 🐛 Troubleshooting

### **"Module not found: ocr.auto_installer"**
**Cause:** Running from wrong directory

**Solution:**
```bash
cd JIRAForge/python-desktop-app
python launch.py
```

### **"Permission denied" or "Access denied"**
**Cause:** Another instance is using the files, or insufficient permissions

**Solution:**
1. Close all Python/desktop_app processes
2. Run as administrator (if needed)
3. Try again

### **"opencv-python-headless conflicts with opencv-python"**
**Cause:** Both packages installed (from EasyOCR and PaddleOCR)

**Solution:**
```bash
# Remove headless version (keep regular opencv-python)
pip uninstall -y opencv-python-headless

# Reinstall EasyOCR (will use existing opencv-python)
python -m ocr.auto_installer --add easyocr
```

### **PowerShell Script Won't Run**
**Cause:** Execution policy blocks unsigned scripts

**Solution:**
```powershell
# Allow current user to run local scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then try again
.\launch.ps1
```

---

## 🎁 Bonus: Create Desktop Shortcut

**Windows:**
1. Right-click `launch.bat`
2. Send to → Desktop (create shortcut)
3. Rename to "Time Tracker"
4. Right-click shortcut → Properties → Change Icon (optional)

Now you can start the app from your desktop with one double-click!

---

## 📚 Summary

| Method | Command | Auto-Install | Platform | Best For |
|--------|---------|--------------|----------|----------|
| Batch Script | `launch.bat` | ✅ Yes | Windows | Daily use |
| PowerShell | `.\launch.ps1` | ✅ Yes | Windows | Advanced users |
| Python Launcher | `python launch.py` | ✅ Yes | All | Development |
| CLI + Manual | `python -m ocr.auto_installer` | ✅ Yes | All | Debugging |
| Direct Start | `python desktop_app.py` | ❌ No | All | Production |

**Recommendation:** Use `launch.bat` for daily use, `python launch.py` for development.
