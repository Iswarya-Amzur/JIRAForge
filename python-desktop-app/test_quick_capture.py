"""
Quick Capture Test - Simplified version

Captures your current screen, runs OCR, and saves to Supabase.
No prompts, no flags - just run it!

Usage:
    python test_quick_capture.py
"""

import subprocess
import sys

if __name__ == '__main__':
    print("🚀 Quick Capture: Screenshot → OCR → Supabase Save\n")
    
    # Run the full test with --yes flag (skip confirmation)
    result = subprocess.run([
        sys.executable,
        'test_screenshot_ocr_save.py',
        '--yes'
    ])
    
    sys.exit(result.returncode)
