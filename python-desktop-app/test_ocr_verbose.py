"""
OCR Test Script with Verbose Logging
Tests OCR text extraction and Supabase table saving

Usage:
    python test_ocr_verbose.py --screenshot    # Take a new screenshot
    python test_ocr_verbose.py --file <path>   # Use existing image
    python test_ocr_verbose.py --current       # Capture current active window
"""

import os
import sys
import time
import argparse
import base64
from datetime import datetime, timezone
from io import BytesIO

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import Image, ImageGrab
from supabase import create_client, Client
from dotenv import load_dotenv
import json

# Import OCR module
from ocr import extract_text_from_image

# Windows-specific imports for window info
try:
    import win32gui
    import win32process
    import psutil
    WINDOWS_AVAILABLE = True
except ImportError:
    WINDOWS_AVAILABLE = False
    print("[WARN] Windows-specific modules not available - window info will be limited")


# ============================================================================
# Configuration
# ============================================================================

def load_config():
    """Load Supabase configuration from .env file"""
    load_dotenv()
    
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # Use service key to bypass RLS
    
    if not supabase_url or not supabase_key:
        print("[ERROR] Missing Supabase configuration in .env file")
        print("       Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return supabase_url, supabase_key


# ============================================================================
# Window Information
# ============================================================================

def get_active_window_info():
    """Get information about the currently active window"""
    if not WINDOWS_AVAILABLE:
        return {
            'title': 'Unknown (Windows APIs not available)',
            'app': 'Unknown',
            'pid': 0
        }
    
    try:
        hwnd = win32gui.GetForegroundWindow()
        window_title = win32gui.GetWindowText(hwnd)
        
        # Get process info
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        process = psutil.Process(pid)
        app_name = process.name()
        
        return {
            'title': window_title,
            'app': app_name,
            'pid': pid
        }
    except Exception as e:
        print(f"[WARN] Failed to get window info: {e}")
        return {
            'title': 'Unknown',
            'app': 'Unknown',
            'pid': 0
        }


# ============================================================================
# Image Capture
# ============================================================================

def capture_screenshot():
    """Capture a screenshot of the entire screen"""
    print("\n" + "="*80)
    print("📸 CAPTURING SCREENSHOT")
    print("="*80)
    
    try:
        print("[INFO] Taking screenshot in 3 seconds...")
        print("       Switch to the window you want to capture!")
        time.sleep(3)
        
        screenshot = ImageGrab.grab()
        window_info = get_active_window_info()
        
        print(f"[OK] Screenshot captured: {screenshot.size[0]}x{screenshot.size[1]}")
        print(f"     Window: {window_info['title']}")
        print(f"     App: {window_info['app']}")
        
        return screenshot, window_info
        
    except Exception as e:
        print(f"[ERROR] Failed to capture screenshot: {e}")
        return None, None


def load_image_file(filepath):
    """Load an image from a file"""
    print("\n" + "="*80)
    print("📁 LOADING IMAGE FILE")
    print("="*80)
    
    try:
        if not os.path.exists(filepath):
            print(f"[ERROR] File not found: {filepath}")
            return None, None
        
        print(f"[INFO] Loading image: {filepath}")
        image = Image.open(filepath)
        
        print(f"[OK] Image loaded: {image.size[0]}x{image.size[1]}")
        print(f"     Format: {image.format}")
        print(f"     Mode: {image.mode}")
        
        # Create window info based on filename
        window_info = {
            'title': f'Test Image: {os.path.basename(filepath)}',
            'app': 'File System',
            'pid': 0
        }
        
        return image, window_info
        
    except Exception as e:
        print(f"[ERROR] Failed to load image: {e}")
        return None, None


# ============================================================================
# OCR Extraction
# ============================================================================

def test_ocr_extraction(image, window_info, preprocessing=True):
    """Test OCR text extraction with verbose logging"""
    print("\n" + "="*80)
    print("🔍 OCR TEXT EXTRACTION")
    print("="*80)
    
    # Log input
    print("\n[INPUT]")
    print(f"  Image size: {image.size[0]}x{image.size[1]} pixels")
    print(f"  Image mode: {image.mode}")
    print(f"  Window title: {window_info['title']}")
    print(f"  Application: {window_info['app']}")
    print(f"  Preprocessing: {'Enabled' if preprocessing else 'Disabled'}")
    
    # Start timer
    start_time = time.time()
    
    print("\n[PROCESSING]")
    print("  Starting OCR extraction...")
    
    try:
        # Call OCR extraction
        ocr_result = extract_text_from_image(
            image,
            window_title=window_info['title'],
            app_name=window_info['app'],
            use_preprocessing=preprocessing
        )
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Log results
        print("\n[RESULTS]")
        print(f"  Success: {ocr_result.get('success', False)}")
        print(f"  Method: {ocr_result.get('method', 'unknown')}")
        print(f"  Confidence: {ocr_result.get('confidence', 0.0):.4f}")
        print(f"  Line count: {ocr_result.get('line_count', 0)}")
        print(f"  Processing time: {processing_time_ms}ms")
        
        extracted_text = ocr_result.get('text', '')
        if extracted_text:
            print(f"\n[EXTRACTED TEXT] ({len(extracted_text)} characters)")
            print("  " + "-"*76)
            # Show first 500 characters with line breaks preserved
            preview = extracted_text[:500]
            for line in preview.split('\n'):
                print(f"  {line}")
            if len(extracted_text) > 500:
                print(f"  ... ({len(extracted_text) - 500} more characters)")
            print("  " + "-"*76)
        else:
            print("\n[EXTRACTED TEXT]")
            print("  (empty - OCR failed or no text detected)")
        
        # Add metadata to result
        ocr_result['processing_time_ms'] = processing_time_ms
        ocr_result['image_width'] = image.size[0]
        ocr_result['image_height'] = image.size[1]
        
        return ocr_result
        
    except Exception as e:
        print(f"\n[ERROR] OCR extraction failed: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            'text': '',
            'confidence': 0.0,
            'method': 'error',
            'success': False,
            'error': str(e),
            'processing_time_ms': int((time.time() - start_time) * 1000),
            'image_width': image.size[0],
            'image_height': image.size[1]
        }


# ============================================================================
# Supabase Integration
# ============================================================================

def save_to_supabase(supabase: Client, image, ocr_result, window_info, test_name='manual_test'):
    """Save OCR test results to Supabase with verbose logging"""
    print("\n" + "="*80)
    print("💾 SAVING TO SUPABASE")
    print("="*80)
    
    try:
        # Get user_id from environment (for testing, use a test user ID)
        user_id = os.getenv('TEST_USER_ID', '00000000-0000-0000-0000-000000000001')
        organization_id = os.getenv('TEST_ORG_ID', '00000000-0000-0000-0000-000000000001')
        
        # Convert screenshot to base64 for storage
        img_buffer = BytesIO()
        image.save(img_buffer, format='PNG')
        img_bytes = img_buffer.getvalue()
        screenshot_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        # Create thumbnail and convert to base64
        thumbnail = image.copy()
        thumbnail.thumbnail((400, 300))
        thumb_buffer = BytesIO()
        thumbnail.save(thumb_buffer, format='JPEG', quality=70)
        thumb_bytes = thumb_buffer.getvalue()
        thumbnail_base64 = base64.b64encode(thumb_bytes).decode('utf-8')
        
        print(f"\n[IMAGE PROCESSING]")
        print(f"  Original size: {image.size[0]}x{image.size[1]}")
        print(f"  Screenshot size: {len(screenshot_base64)} chars (base64)")
        print(f"  Thumbnail size: {len(thumbnail_base64)} chars (base64)")
        
        # Prepare data
        data = {
            'user_id': user_id,
            'organization_id': organization_id,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'window_title': window_info['title'],
            'application_name': window_info['app'],
            'extracted_text': ocr_result.get('text', ''),
            'ocr_confidence': float(ocr_result.get('confidence', 0.0)),
            'ocr_method': ocr_result.get('method', 'unknown'),
            'ocr_line_count': ocr_result.get('line_count', 0),
            'screenshot_base64': screenshot_base64,
            'thumbnail_base64': thumbnail_base64,
            'preprocessing_enabled': True,
            'processing_time_ms': ocr_result.get('processing_time_ms', 0),
            'image_width': ocr_result.get('image_width', 0),
            'image_height': ocr_result.get('image_height', 0),
            'success': ocr_result.get('success', False),
            'error_message': ocr_result.get('error', None),
            'test_name': test_name
        }
        
        print("\n[DATA TO SAVE]")
        print(f"  Table: ocr_test_results")
        print(f"  User ID: {data['user_id']}")
        print(f"  Organization ID: {data['organization_id']}")
        print(f"  Window: {data['window_title']}")
        print(f"  App: {data['application_name']}")
        print(f"  Method: {data['ocr_method']}")
        print(f"  Confidence: {data['ocr_confidence']:.4f}")
        print(f"  Text length: {len(data['extracted_text'])} chars")
        print(f"  Success: {data['success']}")
        
        # Insert into Supabase
        print("\n[INSERTING]")
        print("  Sending data to Supabase...")
        
        result = supabase.table('ocr_test_results').insert(data).execute()
        
        if result.data:
            record = result.data[0]
            print("\n[SUCCESS] ✅")
            print(f"  Record ID: {record['id']}")
            print(f"  Created at: {record['created_at']}")
            print(f"  View in Supabase dashboard:")
            print(f"    Table: ocr_test_results")
            print(f"    ID: {record['id']}")
            
            return record['id']
        else:
            print("\n[ERROR] ❌")
            print("  Insert returned no data")
            print(f"  Response: {result}")
            return None
            
    except Exception as e:
        print("\n[ERROR] ❌ Failed to save to Supabase")
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
        return None


# ============================================================================
# Verification
# ============================================================================

def verify_save(supabase: Client, record_id):
    """Verify that the record was saved correctly"""
    print("\n" + "="*80)
    print("✓ VERIFICATION")
    print("="*80)
    
    try:
        print(f"\n[INFO] Fetching record: {record_id}")
        
        result = supabase.table('ocr_test_results').select('*').eq('id', record_id).execute()
        
        if result.data and len(result.data) > 0:
            record = result.data[0]
            
            print("\n[RECORD FOUND] ✅")
            print(f"  ID: {record['id']}")
            print(f"  Timestamp: {record['timestamp']}")
            print(f"  Window: {record['window_title']}")
            print(f"  App: {record['application_name']}")
            print(f"  Method: {record['ocr_method']}")
            print(f"  Confidence: {record['ocr_confidence']}")
            print(f"  Line count: {record['ocr_line_count']}")
            print(f"  Processing time: {record['processing_time_ms']}ms")
            print(f"  Success: {record['success']}")
            print(f"  Text length: {len(record['extracted_text']) if record['extracted_text'] else 0} chars")
            
            if record['extracted_text']:
                print(f"\n  First 200 chars of saved text:")
                preview = record['extracted_text'][:200]
                for line in preview.split('\n'):
                    print(f"    {line}")
                if len(record['extracted_text']) > 200:
                    print(f"    ... ({len(record['extracted_text']) - 200} more)")
            
            return True
        else:
            print("\n[ERROR] ❌ Record not found in database")
            return False
            
    except Exception as e:
        print(f"\n[ERROR] ❌ Verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# Query Recent Tests
# ============================================================================

def query_recent_tests(supabase: Client, limit=5):
    """Query and display recent test results"""
    print("\n" + "="*80)
    print("📊 RECENT TEST RESULTS")
    print("="*80)
    
    try:
        result = supabase.table('ocr_test_results').select('*').order('created_at', desc=True).limit(limit).execute()
        
        if result.data:
            print(f"\n[FOUND] {len(result.data)} recent test(s)\n")
            
            for i, record in enumerate(result.data, 1):
                print(f"Test #{i}:")
                print(f"  ID: {record['id']}")
                print(f"  Time: {record['created_at']}")
                print(f"  Method: {record['ocr_method']}")
                print(f"  Confidence: {record['ocr_confidence']:.2f}")
                print(f"  Success: {'✅' if record['success'] else '❌'}")
                print(f"  Window: {record['window_title'][:50]}...")
                print(f"  App: {record['application_name']}")
                print(f"  Text: {len(record['extracted_text']) if record['extracted_text'] else 0} chars")
                print()
        else:
            print("\n[INFO] No test results found")
            
    except Exception as e:
        print(f"\n[ERROR] Failed to query recent tests: {e}")


# ============================================================================
# Main Test Function
# ============================================================================

def run_test(image, window_info, supabase, test_name='manual_test'):
    """Run complete OCR test pipeline"""
    print("\n" + "="*80)
    print("🧪 OCR TEST PIPELINE")
    print("="*80)
    print(f"\nTest: {test_name}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run OCR extraction
    ocr_result = test_ocr_extraction(image, window_info, preprocessing=True)
    
    # Save to Supabase
    record_id = save_to_supabase(supabase, image, ocr_result, window_info, test_name)
    
    # Verify save
    if record_id:
        verify_save(supabase, record_id)
    
    # Show recent tests
    query_recent_tests(supabase, limit=3)
    
    print("\n" + "="*80)
    print("✅ TEST COMPLETE")
    print("="*80)


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description='Test OCR extraction and Supabase saving')
    parser.add_argument('--screenshot', action='store_true', help='Capture full screenshot')
    parser.add_argument('--current', action='store_true', help='Capture current active window')
    parser.add_argument('--file', type=str, help='Path to image file to test')
    parser.add_argument('--name', type=str, default='manual_test', help='Test name for identification')
    
    args = parser.parse_args()
    
    # Load configuration
    print("🔧 Loading configuration...")
    supabase_url, supabase_key = load_config()
    
    # Initialize Supabase client
    print("🔌 Connecting to Supabase...")
    supabase = create_client(supabase_url, supabase_key)
    print("[OK] Connected to Supabase")
    
    # Get image based on arguments
    image = None
    window_info = None
    
    if args.file:
        image, window_info = load_image_file(args.file)
    elif args.screenshot or args.current:
        image, window_info = capture_screenshot()
    else:
        # Default: capture screenshot
        print("\n[INFO] No option specified, using --screenshot")
        image, window_info = capture_screenshot()
    
    if image is None or window_info is None:
        print("\n[ERROR] Failed to get image")
        sys.exit(1)
    
    # Run test
    run_test(image, window_info, supabase, args.name)


if __name__ == '__main__':
    main()
