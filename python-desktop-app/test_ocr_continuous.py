"""
Continuous OCR Test - 1 Hour Window Tracking
Captures screenshots when user switches windows/tabs and tracks time spent on each.
Tests OCR extraction and saves all results to ocr_test_results table.
"""

import os
import sys
import time
import base64
from datetime import datetime, timedelta, timezone
from io import BytesIO

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PIL import ImageGrab
from supabase import create_client
from dotenv import load_dotenv
from ocr import extract_text_from_image

# Windows-specific imports for window detection
try:
    import win32gui
    import win32process
    import psutil
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False
    print("[ERROR] win32gui/psutil not available - cannot detect window switches")
    sys.exit(1)

# Load environment
load_dotenv()

class ContinuousOCRTest:
    """Continuous OCR test that tracks window switches and time spent"""
    
    def __init__(self, duration_hours=1):
        self.duration_hours = duration_hours
        self.duration_seconds = duration_hours * 3600
        
        # Window tracking state
        self.current_window_key = None
        self.current_window_start_time = None
        self.current_window_title = None
        self.current_window_app = None
        
        # Statistics
        self.total_captures = 0
        self.total_switches = 0
        self.total_duration_tracked = 0.0
        self.method_stats = {
            'paddle': 0,
            'tesseract': 0,
            'metadata': 0,
            'error': 0
        }
        
        # Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            print("\n❌ ERROR: Missing Supabase configuration")
            print("   Add to .env file:")
            print("     SUPABASE_URL=your_url")
            print("     SUPABASE_SERVICE_ROLE_KEY=your_key")
            sys.exit(1)
        
        self.supabase = create_client(supabase_url, supabase_key)
        self.user_id = os.getenv('TEST_USER_ID', '00000000-0000-0000-0000-000000000000')
        
        print(f"\n{'='*80}")
        print(f" 🧪 CONTINUOUS OCR TEST - {duration_hours} HOUR WINDOW TRACKING")
        print(f"{'='*80}")
        print(f"\nTest Configuration:")
        print(f"  Duration: {duration_hours} hour(s)")
        print(f"  User ID: {self.user_id}")
        print(f"  Check Interval: 1 second")
        print(f"  Behavior: Capture screenshot on every window/tab switch")
        print(f"\nWhat will happen:")
        print(f"  • Detects when you switch windows or tabs")
        print(f"  • Captures screenshot of new window")
        print(f"  • Extracts text using OCR (PaddleOCR → Tesseract → Metadata)")
        print(f"  • Tracks time spent on previous window")
        print(f"  • Saves results to ocr_test_results table")
        print(f"\n⚠️  IMPORTANT: Use your computer normally - switch between apps/tabs")
        print(f"    The test will automatically capture changes.")
        print(f"\nPress Ctrl+C to stop early and see results.")
        print(f"{'='*80}\n")
    
    def get_active_window(self):
        """Get active window information"""
        if not WIN32_AVAILABLE:
            return None
        
        try:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
            
            # Get process name
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process = psutil.Process(pid)
            app_name = process.name()
            
            # Create unique window key (app + title) to detect switches
            window_key = f"{app_name}|||{title}"
            
            return {
                'window_key': window_key,
                'title': title,
                'app': app_name
            }
        except Exception as e:
            return None
    
    def capture_and_process(self, window_info, duration_seconds=None):
        """Capture screenshot, extract OCR text, and save to database"""
        try:
            # Capture screenshot
            screenshot = ImageGrab.grab()
            width, height = screenshot.size
            
            # Convert screenshot to base64 for storage
            img_buffer = BytesIO()
            screenshot.save(img_buffer, format='PNG')
            img_bytes = img_buffer.getvalue()
            screenshot_base64 = base64.b64encode(img_bytes).decode('utf-8')
            
            # Create thumbnail (400x300) and convert to base64
            thumbnail = screenshot.copy()
            thumbnail.thumbnail((400, 300))
            thumb_buffer = BytesIO()
            thumbnail.save(thumb_buffer, format='JPEG', quality=70)
            thumb_bytes = thumb_buffer.getvalue()
            thumbnail_base64 = base64.b64encode(thumb_bytes).decode('utf-8')
            
            # Extract text with OCR
            ocr_start_time = time.time()
            result = extract_text_from_image(
                screenshot,
                window_title=window_info['title'],
                app_name=window_info['app'],
                use_preprocessing=True
            )
            processing_time_ms = int((time.time() - ocr_start_time) * 1000)
            
            # Extract OCR results
            extracted_text = result.get('text', '')
            ocr_confidence = result.get('confidence', 0.0)
            ocr_method = result.get('method', 'unknown')
            ocr_line_count = result.get('line_count', 0)
            success = result.get('success', False)
            error_message = result.get('error')
            
            # Update statistics
            self.total_captures += 1
            if ocr_method in self.method_stats:
                self.method_stats[ocr_method] += 1
            
            # Prepare database record
            record = {
                'user_id': self.user_id,
                'organization_id': None,
                'screenshot_id': None,
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'window_title': window_info['title'],
                'application_name': window_info['app'],
                'extracted_text': extracted_text,
                'ocr_confidence': float(ocr_confidence),
                'ocr_method': ocr_method,
                'ocr_line_count': ocr_line_count,
                'screenshot_base64': screenshot_base64,
                'thumbnail_base64': thumbnail_base64,
                'preprocessing_enabled': True,
                'processing_time_ms': processing_time_ms,
                'image_width': width,
                'image_height': height,
                'success': success,
                'error_message': error_message,
                'test_name': f'continuous_1hr_test',
                'test_notes': f'Duration: {duration_seconds:.1f}s' if duration_seconds else None
            }
            
            # Save to database
            response = self.supabase.table('ocr_test_results').insert(record).execute()
            
            # Log result
            status_icon = "✓" if success else "✗"
            method_color = "🟢" if ocr_method == "paddle" else "🟡" if ocr_method == "tesseract" else "🔵"
            
            time_str = f" [{duration_seconds:.1f}s]" if duration_seconds else ""
            print(f"  {status_icon} {method_color} {ocr_method.upper():10s} | "
                  f"conf:{ocr_confidence:.2f} | lines:{ocr_line_count:3d} | "
                  f"time:{processing_time_ms:4d}ms{time_str}")
            
            if extracted_text and len(extracted_text) > 0:
                preview = extracted_text[:80].replace('\n', ' ')
                print(f"     Text: {preview}...")
            
            return True
            
        except Exception as e:
            print(f"  ✗ ERROR: {str(e)}")
            return False
    
    def run(self):
        """Run continuous test for specified duration"""
        start_time = time.time()
        end_time = start_time + self.duration_seconds
        check_interval = 1.0  # Check for window switches every second
        
        print(f"Starting continuous test at {datetime.now().strftime('%H:%M:%S')}")
        print(f"Will run until {datetime.fromtimestamp(end_time).strftime('%H:%M:%S')}")
        print(f"\n{'─'*80}\n")
        
        try:
            # Initial window detection
            window_info = self.get_active_window()
            if window_info:
                self.current_window_key = window_info['window_key']
                self.current_window_title = window_info['title']
                self.current_window_app = window_info['app']
                self.current_window_start_time = time.time()
                print(f"📱 Initial window: {window_info['app']} - {window_info['title'][:50]}")
                print(f"   Waiting for window switches...\n")
            
            while time.time() < end_time:
                # Check for window switch
                window_info = self.get_active_window()
                
                if window_info and window_info['window_key'] != self.current_window_key:
                    # Window switched!
                    self.total_switches += 1
                    
                    # Calculate time spent on previous window
                    if self.current_window_start_time:
                        duration = time.time() - self.current_window_start_time
                        self.total_duration_tracked += duration
                        
                        # Capture and process the NEW window
                        elapsed = time.time() - start_time
                        remaining = self.duration_seconds - elapsed
                        print(f"\n🔄 Switch #{self.total_switches} | Elapsed: {elapsed/60:.1f}m | Remaining: {remaining/60:.1f}m")
                        print(f"  From: {self.current_window_app} - {self.current_window_title[:40]}")
                        print(f"  To:   {window_info['app']} - {window_info['title'][:40]}")
                        print(f"  Time on previous: {duration:.1f}s")
                        
                        # Process the NEW window that just became active
                        self.capture_and_process(window_info, duration_seconds=duration)
                    
                    # Update current window tracking
                    self.current_window_key = window_info['window_key']
                    self.current_window_title = window_info['title']
                    self.current_window_app = window_info['app']
                    self.current_window_start_time = time.time()
                
                # Sleep before next check
                time.sleep(check_interval)
            
            # Test completed
            print(f"\n{'─'*80}\n")
            print(f"✅ Test completed successfully!")
            
        except KeyboardInterrupt:
            print(f"\n\n{'─'*80}")
            print(f"⚠️  Test stopped by user (Ctrl+C)")
            print(f"{'─'*80}\n")
        
        # Show final statistics
        self.show_statistics(start_time)
    
    def show_statistics(self, start_time):
        """Show test statistics"""
        total_time = time.time() - start_time
        
        print(f"\n{'='*80}")
        print(f" 📊 TEST STATISTICS")
        print(f"{'='*80}")
        print(f"\n⏱️  Time:")
        print(f"  Total test duration: {total_time/60:.1f} minutes ({total_time:.0f} seconds)")
        print(f"  Planned duration: {self.duration_hours} hour(s)")
        print(f"  Completion: {min(100, (total_time/self.duration_seconds)*100):.1f}%")
        
        print(f"\n📸 Captures:")
        print(f"  Total screenshots: {self.total_captures}")
        print(f"  Window switches detected: {self.total_switches}")
        print(f"  Avg time per window: {self.total_duration_tracked/max(1, self.total_switches):.1f}s")
        
        print(f"\n🔍 OCR Methods:")
        for method, count in sorted(self.method_stats.items(), key=lambda x: x[1], reverse=True):
            if count > 0:
                percentage = (count / max(1, self.total_captures)) * 100
                icon = "🟢" if method == "paddle" else "🟡" if method == "tesseract" else "🔵" if method == "metadata" else "🔴"
                print(f"  {icon} {method.upper():10s}: {count:3d} ({percentage:5.1f}%)")
        
        print(f"\n💾 Database:")
        print(f"  Table: ocr_test_results")
        print(f"  Records saved: {self.total_captures}")
        
        # Query recent results from database
        try:
            response = self.supabase.table('ocr_test_results') \
                .select('*') \
                .eq('user_id', self.user_id) \
                .eq('test_name', 'continuous_1hr_test') \
                .order('created_at', desc=True) \
                .limit(5) \
                .execute()
            
            if response.data and len(response.data) > 0:
                print(f"\n📋 Recent Results (last 5):")
                print(f"{'─'*80}")
                for i, record in enumerate(response.data, 1):
                    method = record.get('ocr_method', 'unknown')
                    conf = record.get('ocr_confidence', 0.0)
                    lines = record.get('ocr_line_count', 0)
                    app = record.get('application_name', 'Unknown')
                    title = record.get('window_title', 'Unknown')[:40]
                    
                    icon = "🟢" if method == "paddle" else "🟡" if method == "tesseract" else "🔵"
                    print(f"  {i}. {icon} {method:10s} | conf:{conf:.2f} | lines:{lines:3d} | {app} - {title}")
        except Exception as e:
            print(f"\n⚠️  Could not query recent results: {str(e)}")
        
        print(f"\n{'='*80}")
        print(f"✅ Test data saved to Supabase ocr_test_results table")
        print(f"{'='*80}\n")

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Continuous OCR test with window tracking')
    parser.add_argument('--duration', type=float, default=1.0,
                       help='Test duration in hours (default: 1.0)')
    parser.add_argument('--user-id', type=str,
                       help='User ID for test records (overrides TEST_USER_ID from .env)')
    
    args = parser.parse_args()
    
    # Override user ID if provided
    if args.user_id:
        os.environ['TEST_USER_ID'] = args.user_id
    
    # Create and run test
    test = ContinuousOCRTest(duration_hours=args.duration)
    test.run()

if __name__ == '__main__':
    main()
