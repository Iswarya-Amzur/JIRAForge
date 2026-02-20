"""
Simple Test Script: Screenshot → Classification → OCR → Database Flow

This script tests the complete flow:
1. Takes a screenshot
2. Classifies the current window (productive/non-productive/private)
3. If productive, extracts text using OCR
4. Saves the result to activity_records table

Usage:
    python test_screenshot_ocr_flow.py
    python test_screenshot_ocr_flow.py --mock-productive  # Simulate productive app
"""

import os
import sys
import sqlite3
import argparse
from datetime import datetime, timezone
from PIL import ImageGrab, Image, ImageDraw, ImageFont

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import OCR facade
from ocr.facade import OCRFacade
from ocr.text_extractor import extract_text_from_image


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_active_window():
    """Get the currently active window title and process name."""
    try:
        import win32gui
        import win32process
        import psutil
        
        # Get active window
        hwnd = win32gui.GetForegroundWindow()
        window_title = win32gui.GetWindowText(hwnd)
        
        # Get process name
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            process = psutil.Process(pid)
            app_name = process.name()
        except:
            app_name = "unknown.exe"
        
        return window_title, app_name
    except ImportError:
        print("⚠ win32gui/psutil not installed. Install: pip install pywin32 psutil")
        return "Mock Window Title - VSCode", "code.exe"
    except Exception as e:
        print(f"⚠ Could not get active window: {e}")
        return "Mock Window Title - VSCode", "code.exe"


def classify_window(app_name, window_title):
    """
    Classify window as productive/non-productive/private.
    
    This is a simplified version for testing. In the real app,
    this uses AppClassificationManager with SQLite cache.
    
    DEPRECATED: These hardcoded lists are for testing only.
    Production code uses database-driven classification via application_classifications table.
    """
    app_lower = app_name.lower() if app_name else ''
    title_lower = window_title.lower() if window_title else ''
    
    # HARDCODED LISTS - FOR TESTING ONLY
    # Production uses AppClassificationManager with database lookups
    productive_apps = ['code.exe', 'pycharm', 'vscode', 'slack', 'teams', 'msedge.exe', 'chrome.exe']
    productive_urls = ['github', 'stackoverflow', 'jira', 'atlassian', 'gitlab']
    
    non_productive_apps = ['steam.exe', 'spotify.exe', 'discord.exe']
    non_productive_urls = ['youtube', 'facebook', 'twitter', 'reddit', 'netflix']
    
    private_apps = ['banking', 'wallet', 'finance']
    private_urls = ['bank', 'paypal', 'venmo', 'healthcare']
    
    # Check process name first
    for app in productive_apps:
        if app in app_lower:
            return 'productive'
    
    for app in non_productive_apps:
        if app in app_lower:
            return 'non_productive'
    
    for app in private_apps:
        if app in app_lower:
            return 'private'
    
    # Check window title (for browsers)
    for url in productive_urls:
        if url in title_lower:
            return 'productive'
    
    for url in non_productive_urls:
        if url in title_lower:
            return 'non_productive'
    
    for url in private_urls:
        if url in title_lower:
            return 'private'
    
    return 'unknown'


def create_mock_screenshot():
    """Create a mock screenshot with text for testing OCR."""
    print("\n📸 Creating mock screenshot...")
    
    # Create image with text
    img = Image.new('RGB', (1920, 1080), color='white')
    draw = ImageDraw.Draw(img)
    
    try:
        font = ImageFont.truetype("arial.ttf", 40)
    except:
        font = ImageFont.load_default()
    
    # Draw some text that OCR should detect
    text = """
    Productivity Tracking Test
    
    JIRA-123: Implement OCR feature
    - Extract text from screenshots
    - Save to activity_records table
    - Test the complete flow
    
    Status: In Progress
    Time: 2 hours 30 minutes
    """
    
    draw.text((100, 100), text, fill='black', font=font)
    
    return img


def save_to_activity_records(window_title, app_name, classification, ocr_result):
    """
    Save the activity record to Supabase.
    
    For this test script, we'll print the data that would be saved.
    In production, this would insert to Supabase activity_records table.
    """
    print("\n💾 Saving to activity_records table:")
    print("=" * 70)
    
    # Build the record (same structure as in desktop_app.py)
    record = {
        'window_title': window_title,
        'application_name': app_name,
        'classification': classification,
        'ocr_text': ocr_result['text'] if ocr_result else None,
        'ocr_method': ocr_result['method'] if ocr_result else None,
        'ocr_confidence': ocr_result['confidence'] if ocr_result else 0.0,
        'ocr_error_message': ocr_result.get('error_message') if ocr_result else None,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'total_time_seconds': 0,
        'visit_count': 1,
    }
    
    # Print record details
    for key, value in record.items():
        if key == 'ocr_text' and value:
            # Truncate long text for display
            display_value = value[:200] + '...' if len(value) > 200 else value
            print(f"  {key}: {display_value}")
        else:
            print(f"  {key}: {value}")
    
    print("=" * 70)
    
    # In production, you would do:
    # supabase.table('activity_records').insert(record).execute()
    
    return record


# ============================================================================
# MAIN TEST FLOW
# ============================================================================

def test_complete_flow(use_mock=False):
    """
    Test the complete screenshot → OCR → database flow.
    
    Args:
        use_mock: If True, use mock data. Otherwise, use real screen capture.
    """
    
    print("=" * 70)
    print("  SCREENSHOT → OCR → DATABASE FLOW TEST")
    print("=" * 70)
    
    # STEP 1: Get currently active window
    print("\n🪟 STEP 1: Get Active Window")
    print("-" * 70)
    
    if use_mock:
        window_title = "test_screenshot_ocr_flow.py - Visual Studio Code"
        app_name = "code.exe"
        print(f"  Window Title: {window_title} (MOCK)")
        print(f"  App Name: {app_name} (MOCK)")
    else:
        window_title, app_name = get_active_window()
        print(f"  Window Title: {window_title}")
        print(f"  App Name: {app_name}")
    
    # STEP 2: Classify the window
    print("\n🔍 STEP 2: Classify Window")
    print("-" * 70)
    
    classification = classify_window(app_name, window_title)
    print(f"  Classification: {classification}")
    
    # STEP 3: Capture screenshot
    print("\n📸 STEP 3: Capture Screenshot")
    print("-" * 70)
    
    if use_mock:
        screenshot = create_mock_screenshot()
        print("  Screenshot: Created mock image (1920x1080)")
    else:
        try:
            screenshot = ImageGrab.grab()
            print(f"  Screenshot: Captured ({screenshot.width}x{screenshot.height})")
        except Exception as e:
            print(f"  ⚠ Failed to capture screenshot: {e}")
            print("  Using mock screenshot instead...")
            screenshot = create_mock_screenshot()
    
    # STEP 4: Run OCR (only if productive)
    print("\n🔤 STEP 4: Extract Text with OCR")
    print("-" * 70)
    
    ocr_result = None
    
    if classification == 'productive':
        print("  Running OCR (productive app)...")
        
        try:
            # Use the OCR facade (respects .env configuration)
            result = extract_text_from_image(
                screenshot,
                window_title=window_title,
                app_name=app_name,
                use_preprocessing=True
            )
            
            ocr_result = {
                'text': result.get('text', ''),
                'method': result.get('method', 'unknown'),
                'confidence': result.get('confidence', 0.0),
                'error_message': None if result.get('success') else 'OCR failed'
            }
            
            print(f"  ✓ OCR completed")
            print(f"    Method: {ocr_result['method']}")
            print(f"    Confidence: {ocr_result['confidence']:.2f}")
            print(f"    Text Length: {len(ocr_result['text'])} characters")
            
            if ocr_result['text']:
                preview = ocr_result['text'][:150].replace('\n', ' ')
                print(f"    Preview: {preview}...")
            
        except Exception as e:
            print(f"  ✗ OCR failed: {e}")
            ocr_result = {
                'text': None,
                'method': 'error',
                'confidence': 0.0,
                'error_message': str(e)
            }
    
    elif classification in ('non_productive', 'private'):
        print(f"  ⊘ Skipping OCR ({classification} app)")
        ocr_result = {
            'text': None,
            'method': 'skipped',
            'confidence': 0.0,
            'error_message': f'Skipped for {classification} app'
        }
    
    else:  # unknown
        print(f"  ? Unknown classification - OCR would be attempted for admin classification")
        # In real system, unknown apps would still get OCR for admin to classify later
        try:
            result = extract_text_from_image(screenshot, use_preprocessing=True)
            ocr_result = {
                'text': result.get('text', ''),
                'method': result.get('method', 'unknown'),
                'confidence': result.get('confidence', 0.0),
                'error_message': None
            }
            print(f"    Method: {ocr_result['method']}")
        except Exception as e:
            print(f"  ✗ OCR failed: {e}")
            ocr_result = {'text': None, 'method': 'error', 'confidence': 0.0, 'error_message': str(e)}
    
    # STEP 5: Save to database
    print("\n💾 STEP 5: Save to Database")
    print("-" * 70)
    
    record = save_to_activity_records(window_title, app_name, classification, ocr_result)
    
    # SUMMARY
    print("\n✅ TEST COMPLETE")
    print("=" * 70)
    print(f"Window: {window_title[:50]}...")
    print(f"App: {app_name}")
    print(f"Classification: {classification}")
    print(f"OCR Method: {ocr_result['method'] if ocr_result else 'N/A'}")
    print(f"OCR Success: {'Yes' if ocr_result and ocr_result.get('text') else 'No'}")
    print("=" * 70)
    
    return record


# ============================================================================
# COMMAND LINE INTERFACE
# ============================================================================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Test screenshot → OCR → database flow'
    )
    parser.add_argument(
        '--mock-productive',
        action='store_true',
        help='Use mock data for a productive app (bypasses screen capture)'
    )
    parser.add_argument(
        '--mock-nonproductive',
        action='store_true',
        help='Use mock data for a non-productive app (no OCR)'
    )
    
    args = parser.parse_args()
    
    # Override mocks if specified
    if args.mock_nonproductive:
        print("\n[INFO] Using mock data for NON-PRODUCTIVE app")
        # Temporarily override classification function
        original_classify = classify_window
        classify_window = lambda app, title: 'non_productive'
    
    # Run the test
    try:
        record = test_complete_flow(use_mock=args.mock_productive or args.mock_nonproductive)
        print("\n✅ Test completed successfully!\n")
    except Exception as e:
        print(f"\n❌ Test failed: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
