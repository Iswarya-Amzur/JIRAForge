# OCR Cross-Platform Compatibility Guide

## Overview

The JIRAForge OCR system is designed to work seamlessly across **Windows**, **Linux**, and **macOS** with automatic platform-specific dependency installation. The system detects your operating system and installs the correct packages for your platform.

## Supported Platforms

| Platform | Support Level | Notes |
|----------|---------------|-------|
| **Windows 10/11** | ✅ Full Support | All OCR engines supported |
| **Linux (Ubuntu/Debian)** | ✅ Full Support | GPU support available for PaddleOCR |
| **Linux (RHEL/CentOS)** | ✅ Full Support | GPU support available |
| **macOS (Intel)** | ✅ Full Support | CPU-only for OCR engines |
| **macOS (Apple Silicon M1/M2/M3)** | ✅ Full Support | Optimized for Apple Silicon |

## How Platform Detection Works

### Automatic OS Detection

The OCR auto-installer automatically detects your operating system and CPU architecture:

```python
from ocr.auto_installer import get_os_type, get_cpu_architecture, is_apple_silicon

os_type = get_os_type()  # Returns: 'windows', 'linux', or 'macos'
cpu_arch = get_cpu_architecture()  # Returns: 'x86_64', 'arm64', etc.
is_m1_mac = is_apple_silicon()  # True if running on Apple Silicon
```

### Platform-Specific Dependencies

The system automatically installs the correct packages for your platform:

#### PaddleOCR

| Platform | Package | Notes |
|----------|---------|-------|
| Windows | `paddlepaddle>=3.0.0b1` | Standard CPU version |
| Linux | `paddlepaddle>=3.0.0b1` | Standard CPU/GPU version |
| macOS (Intel) | `paddlepaddle>=3.0.0b1` | CPU-only |
| macOS (M1/M2) | `paddlepaddle>=3.0.0b1` | Optimized for ARM64 |

#### PyTorch (for EasyOCR)

| Platform | Package | Notes |
|----------|---------|-------|
| Windows | `torch>=2.0.0` | Standard CPU/CUDA version |
| Linux | `torch>=2.0.0` | Standard CPU/CUDA version |
| macOS (Intel) | `torch>=2.0.0` | CPU-only |
| macOS (M1/M2) | `torch>=2.0.0` | MPS (Metal) acceleration |

#### Tesseract

| Platform | Python Package | System Binary Required |
|----------|----------------|------------------------|
| Windows | `pytesseract>=0.3.10` | Yes - Manual install |
| Linux | `pytesseract>=0.3.10` | Yes - `apt-get install tesseract-ocr` |
| macOS | `pytesseract>=0.3.10` | Yes - `brew install tesseract` |

## Installation Instructions

### Automatic Installation (Recommended)

The OCR system automatically detects and installs dependencies when you configure an engine:

1. **Configure OCR engine in `.env`**:
   ```bash
   OCR_PRIMARY_ENGINE=paddle
   OCR_FALLBACK_ENGINES=tesseract
   ```

2. **Run the application**:
   ```bash
   python desktop_app.py
   ```

   The system will:
   - Detect your OS (Windows/Linux/macOS)
   - Detect your CPU architecture (x86_64/ARM64)
   - Install appropriate packages automatically
   - Show installation progress

### Manual Installation

If automatic installation fails, you can install dependencies manually:

#### Windows

```powershell
# PaddleOCR
pip install paddlepaddle>=3.0.0b1 paddleocr>=2.8.1 opencv-python>=4.10.0

# Tesseract
pip install pytesseract>=0.3.10
# Download Tesseract binary from: https://github.com/UB-Mannheim/tesseract/wiki

# EasyOCR
pip install torch>=2.0.0 torchvision>=0.15.0
pip install easyocr>=1.7.0
```

#### Linux (Ubuntu/Debian)

```bash
# PaddleOCR
pip install paddlepaddle>=3.0.0b1 paddleocr>=2.8.1 opencv-python>=4.10.0

# Tesseract
sudo apt-get update
sudo apt-get install tesseract-ocr tesseract-ocr-eng
pip install pytesseract>=0.3.10

# EasyOCR
pip install torch>=2.0.0 torchvision>=0.15.0
pip install easyocr>=1.7.0
```

#### macOS (Intel)

```bash
# PaddleOCR
pip install paddlepaddle>=3.0.0b1 paddleocr>=2.8.1 opencv-python>=4.10.0

# Tesseract
brew install tesseract
pip install pytesseract>=0.3.10

# EasyOCR
pip install torch>=2.0.0 torchvision>=0.15.0
pip install easyocr>=1.7.0
```

#### macOS (Apple Silicon M1/M2/M3)

```bash
# PaddleOCR (optimized for ARM64)
pip install paddlepaddle>=3.0.0b1 paddleocr>=2.8.1 opencv-python>=4.10.0

# Tesseract
brew install tesseract
pip install pytesseract>=0.3.10

# EasyOCR (with MPS acceleration)
pip install torch>=2.0.0 torchvision>=0.15.0
pip install easyocr>=1.7.0

# Note: Apple Silicon has optimized Metal Performance Shaders (MPS) support
```

## Platform-Specific Considerations

### Windows

#### ✅ Advantages
- All OCR engines fully supported
- Straightforward installation
- GPU support for PaddleOCR (NVIDIA CUDA)

#### ⚠️ Considerations
- **Tesseract**: Requires manual installation of system binary
  - Download from: https://github.com/UB-Mannheim/tesseract/wiki
  - Add to PATH or set `TESSDATA_PREFIX` environment variable
- **PyInstaller builds**: OCR models and Tesseract binary must be bundled

#### 🔧 Troubleshooting
```powershell
# If pytesseract can't find tesseract.exe
$env:TESSDATA_PREFIX = "C:\Program Files\Tesseract-OCR"

# Or set in Python code
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### Linux

#### ✅ Advantages
- Best platform for OCR development
- Easy system package installation (apt/yum)
- GPU support for CUDA-enabled systems
- Docker-friendly

#### ⚠️ Considerations
- **Tesseract**: Must install system package first
  ```bash
  sudo apt-get install tesseract-ocr tesseract-ocr-eng
  ```
- **GPU support**: Requires NVIDIA drivers and CUDA toolkit for PaddleOCR GPU
- **Headless servers**: May need `xvfb` for screenshot capture

#### 🔧 Troubleshooting
```bash
# Check Tesseract installation
tesseract --version

# Install additional languages
sudo apt-get install tesseract-ocr-fra  # French
sudo apt-get install tesseract-ocr-deu  # German

# For headless servers (screenshot capture)
sudo apt-get install xvfb
xvfb-run python desktop_app.py
```

### macOS

#### ✅ Advantages
- Clean Unix environment
- Homebrew package management
- **Apple Silicon (M1/M2/M3)**: Optimized PyTorch with MPS acceleration
- Good for development

#### ⚠️ Considerations
- **PaddleOCR**: No official GPU support on Apple Silicon (uses CPU/MPS)
- **Tesseract**: Must install via Homebrew
  ```bash
  brew install tesseract
  ```
- **Apple Silicon**: Some packages may need Rosetta 2 compatibility layer
- **Permissions**: May need to grant accessibility permissions for screenshot capture

#### 🔧 Apple Silicon Specific
```bash
# Verify Apple Silicon detection
python -c "from ocr.auto_installer import is_apple_silicon; print(f'Apple Silicon: {is_apple_silicon()}')"

# Check PyTorch MPS support
python -c "import torch; print(f'MPS Available: {torch.backends.mps.is_available()}')"

# Install with Apple Silicon optimizations
arch -arm64 pip install torch torchvision
```

#### 🔧 General macOS Troubleshooting
```bash
# Check Tesseract installation
which tesseract
tesseract --version

# Install additional languages
brew install tesseract-lang  # All languages

# Grant screenshot permissions
# System Preferences > Security & Privacy > Privacy > Screen Recording
# Add Terminal or Python to allowed apps
```

## Testing Cross-Platform Installation

### Verify Installation

```bash
# Run OCR dependency checker
cd python-desktop-app
python -m ocr.auto_installer --check

# Expected output:
# ======================================================================
#  🔍 Checking OCR Engine Dependencies
# ======================================================================
# Operating System: MACOS (arm64)
# Apple Silicon detected: Using optimized dependencies
# Configured engines: paddle, tesseract
# 
# [PADDLE]
#   ✅ All Python dependencies installed
# 
# [TESSERACT]
#   ✅ All Python dependencies installed
#   ✅ Tesseract binary found: /opt/homebrew/bin/tesseract
# ======================================================================
```

### Run OCR Tests

```bash
# Quick test
python -m tests.test_ocr_quick

# Test with screenshot
python -m tests.test_ocr_engines --screenshot

# Verbose test (all engines)
python -m tests.test_ocr_verbose
```

## System Requirements by Platform

### Windows

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10 | Windows 11 |
| CPU | Intel/AMD x86_64 | Intel Core i5 or better |
| RAM | 4 GB | 8 GB+ |
| Disk | 2 GB free | 5 GB+ free |
| Python | 3.8+ | 3.11+ |

### Linux

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 20.04 / Debian 10 | Ubuntu 22.04 / Debian 12 |
| CPU | x86_64 | Intel Core i5 or AMD Ryzen 5 |
| RAM | 4 GB | 8 GB+ |
| Disk | 2 GB free | 5 GB+ free |
| Python | 3.8+ | 3.11+ |
| GPU (optional) | NVIDIA CUDA 11.0+ | NVIDIA CUDA 12.0+ |

### macOS

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | macOS 11 Big Sur | macOS 14 Sonoma |
| CPU | Intel x86_64 or Apple M1 | Apple M2/M3 |
| RAM | 8 GB | 16 GB+ |
| Disk | 3 GB free | 10 GB+ free |
| Python | 3.8+ | 3.11+ |
| Homebrew | Latest | Latest |

## GPU Support

### NVIDIA CUDA (Windows/Linux)

For GPU-accelerated OCR on NVIDIA GPUs:

1. **Install NVIDIA drivers** (460.0 or newer)
2. **Install CUDA Toolkit** (11.0 or newer)
3. **Install cuDNN** (for PyTorch)
4. **Install GPU version of packages**:
   ```bash
   # PaddleOCR GPU
   pip install paddlepaddle-gpu
   
   # PyTorch GPU
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
   ```

### Apple Metal (macOS M1/M2/M3)

PyTorch automatically uses Metal Performance Shaders (MPS) on Apple Silicon:

```bash
# Verify MPS support
python -c "import torch; print(torch.backends.mps.is_available())"

# Use MPS in OCR engines (automatic)
OCR_PRIMARY_ENGINE=easyocr
OCR_EASYOCR_GPU=true  # Uses MPS on Apple Silicon
```

## Docker Support

### Multi-Platform Docker Images

Build for specific platforms:

```dockerfile
# Dockerfile (multi-platform)
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Install Python OCR packages
RUN pip install paddlepaddle paddleocr opencv-python pytesseract

# Copy application
COPY . /app
WORKDIR /app

CMD ["python", "desktop_app.py"]
```

Build for multiple architectures:

```bash
# Build for AMD64 (x86_64)
docker build --platform linux/amd64 -t jiraforge-ocr:amd64 .

# Build for ARM64 (Apple Silicon, Raspberry Pi)
docker build --platform linux/arm64 -t jiraforge-ocr:arm64 .

# Build multi-platform image
docker buildx build --platform linux/amd64,linux/arm64 -t jiraforge-ocr:latest .
```

## Common Issues and Solutions

### Issue: "No OCR engines available"

**Windows**:
```powershell
pip install paddlepaddle paddleocr opencv-python
```

**Linux**:
```bash
pip install paddlepaddle paddleocr opencv-python
```

**macOS**:
```bash
pip install paddlepaddle paddleocr opencv-python
```

### Issue: "Tesseract not found"

**Windows**:
1. Download from https://github.com/UB-Mannheim/tesseract/wiki
2. Install and add to PATH
3. Or set: `pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'`

**Linux**:
```bash
sudo apt-get install tesseract-ocr
```

**macOS**:
```bash
brew install tesseract
```

### Issue: "opencv conflict" (opencv-python vs opencv-python-headless)

The auto-installer automatically resolves this:

```bash
python -c "from ocr.auto_installer import resolve_opencv_conflict; resolve_opencv_conflict()"
```

### Issue: Apple Silicon "illegal hardware instruction"

Some packages need ARM64-specific builds:

```bash
# Reinstall with ARM64 architecture
arch -arm64 pip install --force-reinstall paddlepaddle torch
```

## Best Practices

### 1. **Use Virtual Environments**

Always use virtual environments to isolate dependencies:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```

### 2. **Test on Target Platform**

If deploying to a different platform, test on that platform:
- Windows → Test on Windows
- Linux → Test in Docker or Linux VM
- macOS → Test on macOS

### 3. **Pin Dependencies**

Use `requirements.txt` with pinned versions:

```txt
paddlepaddle==3.0.0b1
paddleocr==2.8.1
opencv-python==4.10.0.84
pytesseract==0.3.10
```

### 4. **Handle Missing System Binaries Gracefully**

Check for Tesseract before using:

```python
try:
    subprocess.run(['tesseract', '--version'], check=True)
    TESSERACT_AVAILABLE = True
except (subprocess.CalledProcessError, FileNotFoundError):
    TESSERACT_AVAILABLE = False
    print("Tesseract not installed - install it for better OCR accuracy")
```

### 5. **Document Platform-Specific Setup**

Include platform-specific instructions in your README:

```markdown
## Installation

### Windows
1. Install Tesseract from ...
2. Run `pip install -r requirements.txt`

### Linux
1. Run `sudo apt-get install tesseract-ocr`
2. Run `pip install -r requirements.txt`

### macOS
1. Run `brew install tesseract`
2. Run `pip install -r requirements.txt`
```

## Summary

✅ **Automatic platform detection** - System detects Windows/Linux/macOS automatically  
✅ **Platform-specific packages** - Installs correct packages for your OS  
✅ **Apple Silicon optimized** - Special handling for M1/M2/M3 Macs  
✅ **System binary checks** - Detects missing Tesseract and provides install instructions  
✅ **Docker support** - Multi-platform Docker images available  
✅ **GPU support** - NVIDIA CUDA on Windows/Linux, Metal MPS on macOS  

The OCR system is **fully cross-platform compatible** and handles all platform-specific requirements automatically!
