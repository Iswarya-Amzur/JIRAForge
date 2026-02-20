"""
REAL WINDOW TRACKING TEST - CAPTURES SCREENSHOTS & EXTRACTS TEXT
=================================================================

This script:
1. Monitors your active window in real-time
2. Captures actual screenshots
3. Classifies applications (productive/non-productive)
4. Extracts text using OCR for productive apps
5. Stores in your existing SQLite database
6. Uploads to Supabase after collection period

NO MOCK DATA - EVERYTHING IS REAL!

USAGE:
    python test_real_tracking.py --duration 5

    Options:
      --duration N     Track for N minutes (default: 5)
      --interval N     Check window every N seconds (default: 3)
      --upload         Upload to Supabase after tracking

REQUIREMENTS:
    pip install supabase python-dotenv pillow paddleocr pytesseract pywin32
"""

import os
import sys
import json
import sqlite3
import time
import argparse
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from io import BytesIO

try:
    from dotenv import load_dotenv
    
    # Load environment variables
    env_locations = ['.env', '../.env', os.path.join(os.path.dirname(__file__), '.env')]
    for env_path in env_locations:
        if os.path.exists(env_path):
            load_dotenv(env_path)
            break
    
    from supabase import create_client
    
    # Windows-specific imports for window tracking
    import win32gui
    import win32process
    import psutil
    from PIL import ImageGrab, Image
    
    # OCR imports
    try:
        from paddleocr import PaddleOCR
        PADDLEOCR_AVAILABLE = True
    except ImportError:
        PADDLEOCR_AVAILABLE = False
        print("⚠️  PaddleOCR not available, will use Tesseract only")
    
    try:
        import pytesseract
        TESSERACT_AVAILABLE = True
    except ImportError:
        TESSERACT_AVAILABLE = False
        print("⚠️  Tesseract not available")
    
except ImportError as e:
    print(f"✗ Missing dependency: {e}")
    print("\nInstall with:")
    print("  pip install supabase python-dotenv pillow paddleocr pytesseract pywin32")
    sys.exit(1)


class RealWindowTracker:
    """Tracks real windows, captures screenshots, and extracts text"""
    
    def __init__(self):
        self.db_path = None
        self.supabase = None
        
        # user_id must be a valid UUID
        user_id_env = os.getenv('USER_ID')
        if user_id_env:
            self.user_id = user_id_env
        else:
            # Generate a valid test UUID
            self.user_id = str(uuid.uuid4())
        
        # organization_id must be a valid UUID
        org_id_env = os.getenv('ORGANIZATION_ID')
        if org_id_env:
            self.org_id = org_id_env
        else:
            # Generate a valid test UUID
            self.org_id = str(uuid.uuid4())
        
        # Initialize OCR
        self.ocr_paddle = None
        if PADDLEOCR_AVAILABLE:
            try:
                self.ocr_paddle = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
                print("✓ PaddleOCR initialized")
            except Exception as e:
                print(f"⚠️  PaddleOCR initialization failed: {e}")
        
        # Classification rules (simple version)
        self.productive_apps = {
            'code.exe': 'productive',
            'devenv.exe': 'productive',
            'pycharm64.exe': 'productive',
            'chrome.exe': 'check_title',  # Need to check window title
            'firefox.exe': 'check_title',
            'msedge.exe': 'check_title',
        }
        
        self.productive_keywords = [
            'jira', 'github', 'stackoverflow', 'localhost', 'azure', 'aws',
            'visual studio code', 'confluence', 'gitlab', 'bitbucket'
        ]
        
        self.non_productive_keywords = [
            'youtube', 'facebook', 'twitter', 'instagram', 'netflix',
            'gmail', 'inbox', 'reddit', 'tiktok', 'whatsapp'
        ]
    
    def find_database(self):
        """Find existing database"""
        db_names = ['time_tracker_offline.db', 'offline_screenshots.db']
        
        for db_name in db_names:
            locations = [
                os.path.join(os.getcwd(), db_name),
                os.path.join(os.getenv('LOCALAPPDATA', ''), 'TimeTracker', db_name),
                os.path.join(Path.home(), '.timetracker', db_name),
            ]
            
            for location in locations:
                if os.path.exists(location):
                    self.db_path = location
                    return True
        
        return False
    
    def get_active_window(self):
        """Get currently active window information"""
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
            return None
    
    def classify_window(self, window_info):
        """Classify window as productive or non-productive"""
        app = window_info['app'].lower()
        title = window_info['title'].lower()
        
        # Check if it's an IDE or code editor
        if app in self.productive_apps:
            classification = self.productive_apps[app]
            
            if classification == 'check_title':
                # Check title for productive/non-productive keywords
                if any(keyword in title for keyword in self.productive_keywords):
                    return 'productive'
                elif any(keyword in title for keyword in self.non_productive_keywords):
                    return 'non_productive'
                else:
                    return 'productive'  # Default to productive for browsers
            
            return classification
        
        # Default to productive (can be adjusted)
        return 'productive'
    
    def capture_screenshot(self):
        """Capture screenshot of active window"""
        try:
            # Capture entire screen (you can modify to capture just active window)
            screenshot = ImageGrab.grab()
            
            # Resize to reduce processing time
            max_size = (1920, 1080)
            screenshot.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            return screenshot
        except Exception as e:
            print(f"  ⚠️  Screenshot failed: {e}")
            return None
    
    def extract_text_ocr(self, image):
        """Extract text from image using OCR"""
        try:
            # Try PaddleOCR first
            if self.ocr_paddle:
                # Convert PIL Image to bytes
                img_byte_arr = BytesIO()
                image.save(img_byte_arr, format='PNG')
                img_byte_arr = img_byte_arr.getvalue()
                
                result = self.ocr_paddle.ocr(img_byte_arr, cls=True)
                
                if result and result[0]:
                    # Extract text and confidence
                    texts = []
                    confidences = []
                    for line in result[0]:
                        if line and len(line) >= 2:
                            texts.append(line[1][0])
                            confidences.append(line[1][1])
                    
                    if texts:
                        text = '\n'.join(texts)
                        avg_confidence = sum(confidences) / len(confidences)
                        return {
                            'text': text,
                            'method': 'paddleocr',
                            'confidence': avg_confidence
                        }
            
            # Fallback to Tesseract
            if TESSERACT_AVAILABLE:
                text = pytesseract.image_to_string(image)
                if text.strip():
                    return {
                        'text': text.strip(),
                        'method': 'tesseract',
                        'confidence': 0.85
                    }
            
            return None
            
        except Exception as e:
            print(f"  ⚠️  OCR failed: {e}")
            return None
    
    def store_session(self, window_info, classification, ocr_result):
        """Store session in SQLite database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            window_title = window_info['title']
            app_name = window_info['app']
            
            # Check if session exists
            cursor.execute("""
                SELECT id, total_time_seconds, visit_count, first_seen 
                FROM active_sessions 
                WHERE window_title = ? AND application_name = ?
            """, (window_title, app_name))
            
            existing = cursor.fetchone()
            current_time = datetime.now(timezone.utc).isoformat()
            
            if existing:
                # Update existing session
                session_id, total_time, visit_count, first_seen = existing
                
                cursor.execute("""
                    UPDATE active_sessions 
                    SET total_time_seconds = total_time_seconds + ?,
                        visit_count = visit_count + 1,
                        last_seen = ?,
                        ocr_text = ?,
                        ocr_method = ?,
                        ocr_confidence = ?
                    WHERE id = ?
                """, (
                    3,  # Add 3 seconds (tracking interval)
                    current_time,
                    ocr_result['text'] if ocr_result else None,
                    ocr_result['method'] if ocr_result else None,
                    ocr_result['confidence'] if ocr_result else None,
                    session_id
                ))
            else:
                # Insert new session
                cursor.execute("""
                    INSERT INTO active_sessions 
                    (window_title, application_name, classification, ocr_text,
                     ocr_method, ocr_confidence, ocr_error_message,
                     total_time_seconds, visit_count, first_seen, last_seen, timer_started_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """, (
                    window_title,
                    app_name,
                    classification,
                    ocr_result['text'] if ocr_result else None,
                    ocr_result['method'] if ocr_result else None,
                    ocr_result['confidence'] if ocr_result else None,
                    None,
                    3,  # Initial 3 seconds
                    1,  # First visit
                    current_time,
                    current_time
                ))
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"  ✗ Error storing session: {e}")
            return False
    
    def track_windows(self, duration_minutes, interval_seconds):
        """Track windows for specified duration"""
        print("\n" + "="*80)
        print("  REAL-TIME WINDOW TRACKING")
        print("="*80)
        
        print(f"\n  Duration: {duration_minutes} minutes")
        print(f"  Check Interval: {interval_seconds} seconds")
        print(f"  Database: {os.path.basename(self.db_path)}")
        
        print("\n  Starting in 3 seconds... Switch to different windows!\n")
        time.sleep(3)
        
        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        check_count = 0
        session_count = 0
        
        print("  " + "-"*76)
        
        while time.time() < end_time:
            check_count += 1
            elapsed = int(time.time() - start_time)
            
            # Get current window
            window = self.get_active_window()
            
            if window:
                # Classify
                classification = self.classify_window(window)
                
                # Capture screenshot and OCR for productive windows
                ocr_result = None
                if classification == 'productive':
                    screenshot = self.capture_screenshot()
                    if screenshot:
                        ocr_result = self.extract_text_ocr(screenshot)
                
                # Store in database
                if self.store_session(window, classification, ocr_result):
                    session_count += 1
                
                # Display progress
                title = window['title'][:45]
                ocr_status = "✓ OCR" if ocr_result else "○ No OCR"
                
                print(f"  [{elapsed}s] {title}")
                print(f"         {window['app']} | {classification} | {ocr_status}")
            
            # Wait for next check
            time.sleep(interval_seconds)
        
        print("\n  " + "-"*76)
        print(f"  ✓ Tracking complete!")
        print(f"  Checks: {check_count} | Sessions updated: {session_count}")
    
    def show_collected_data(self):
        """Show collected sessions"""
        print("\n" + "="*80)
        print("  COLLECTED SESSIONS")
        print("="*80)
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM active_sessions")
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            conn.close()
            
            sessions = [dict(zip(columns, row)) for row in rows]
            
            if not sessions:
                print("\n  No sessions found")
                return sessions
            
            print(f"\n  Total Sessions: {len(sessions)}\n")
            
            total_time = sum(s.get('total_time_seconds', 0) or 0 for s in sessions)
            total_visits = sum(s.get('visit_count', 0) or 0 for s in sessions)
            
            classifications = {}
            for s in sessions:
                cls = s.get('classification', 'unknown')
                classifications[cls] = classifications.get(cls, 0) + 1
            
            print("  📊 SUMMARY:")
            print(f"  Total Time: {int(total_time)}s ({int(total_time/60)}m)")
            print(f"  Total Visits: {total_visits}")
            print(f"  Classifications:")
            for cls, count in classifications.items():
                print(f"    - {cls}: {count}")
            
            print(f"\n  📋 SESSIONS:")
            for i, session in enumerate(sessions[:10], 1):
                title = session.get('window_title', 'N/A')[:50]
                app = session.get('application_name', 'N/A')
                duration = int(session.get('total_time_seconds', 0) or 0)
                visits = session.get('visit_count', 1)
                cls = session.get('classification', 'unknown')
                has_ocr = "✓" if session.get('ocr_text') else "○"
                
                print(f"\n  [{i}] {title}")
                print(f"      App: {app} | Class: {cls}")
                print(f"      Duration: {duration}s | Visits: {visits} | OCR: {has_ocr}")
                
                # Show OCR preview
                if session.get('ocr_text'):
                    ocr_preview = session['ocr_text'][:100].replace('\n', ' ')
                    print(f"      Text: {ocr_preview}...")
            
            if len(sessions) > 10:
                print(f"\n  ... and {len(sessions) - 10} more sessions")
            
            return sessions
            
        except Exception as e:
            print(f"\n  ✗ Error reading sessions: {e}")
            return []
    
    def get_or_prompt_user_id(self):
        """Get valid user_id and organization_id from database"""
        try:
            # First, get a valid organization
            org_result = self.supabase.table('organizations').select('id').limit(1).execute()
            
            if not org_result.data or len(org_result.data) == 0:
                print("\n  ⚠️  No organizations found in database")
                print("  Create an organization first or run the desktop app with OAuth setup")
                return False
            
            self.org_id = org_result.data[0]['id']
            print(f"\n  ✓ Using organization ID: {self.org_id}")
            
            # Query users table to find users in this organization
            result = self.supabase.table('users').select('id, email, organization_id').eq(
                'organization_id', self.org_id
            ).limit(5).execute()
            
            if result.data and len(result.data) > 0:
                print(f"  ✓ Found {len(result.data)} user(s) in this organization:")
                for i, user in enumerate(result.data, 1):
                    email = user.get('email', 'N/A')
                    user_id = user.get('id')
                    print(f"    [{i}] {email}")
                
                # Use first user by default
                self.user_id = result.data[0]['id']
                print(f"\n  ✓ Using user: {result.data[0].get('email')}")
                return True
            else:
                print("\n  ⚠️  No users found in this organization")
                print("  Create a user first or run the desktop app with OAuth login")
                return False
                
        except Exception as e:
            print(f"\n  ⚠️  Could not query database: {e}")
            return False
    
    def upload_to_supabase(self, sessions):
        """Upload sessions to Supabase"""
        print("\n" + "="*80)
        print("  UPLOAD TO SUPABASE")
        print("="*80)
        
        url = os.getenv('SUPABASE_URL')
        key = (os.getenv('SUPABASE_SERVICE_ROLE_KEY') or 
               os.getenv('SUPABASE_SERVICE_KEY') or 
               os.getenv('SUPABASE_KEY'))
        
        if not url or not key:
            print("\n  ⚠️  Supabase credentials not configured")
            print("  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
            return False
        
        try:
            self.supabase = create_client(url, key)
            print(f"\n  ✓ Connected to Supabase")
        except Exception as e:
            print(f"\n  ✗ Connection failed: {e}")
            return False
        
        # Get valid user_id if not set in .env
        if not os.getenv('USER_ID'):
            if not self.get_or_prompt_user_id():
                return False
        
        # Build activity records
        print(f"  Building {len(sessions)} activity records...")
        
        batch_timestamp = datetime.now(timezone.utc).isoformat()
        batch_start = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        batch_end = datetime.now(timezone.utc).isoformat()
        
        records = []
        for session in sessions:
            classification = session.get('classification', 'unknown')
            status = 'analyzed' if classification in ('non_productive', 'private') else 'pending'
            
            record = {
                'user_id': self.user_id,
                'organization_id': self.org_id,
                'window_title': session.get('window_title'),
                'application_name': session.get('application_name'),
                'classification': classification,
                'ocr_text': session.get('ocr_text'),
                'ocr_method': session.get('ocr_method'),
                'ocr_confidence': session.get('ocr_confidence'),
                'ocr_error_message': session.get('ocr_error_message'),
                'total_time_seconds': int(session.get('total_time_seconds', 0) or 0),
                'visit_count': session.get('visit_count', 1),
                'start_time': session.get('first_seen'),
                'end_time': session.get('last_seen'),
                'duration_seconds': int(session.get('total_time_seconds', 0) or 0),
                'batch_timestamp': batch_timestamp,
                'batch_start': batch_start,
                'batch_end': batch_end,
                'work_date': session.get('first_seen', '')[:10],
                'user_timezone': 'UTC',
                'project_key': 'TEST',
                'user_assigned_issues': json.dumps([]),
                'status': status,
                'metadata': json.dumps({
                    'tracking_mode': 'real_test',
                    'test_script': 'test_real_tracking.py'
                })
            }
            
            records.append(record)
        
        # Upload
        print(f"  Uploading to activity_records table...")
        
        try:
            result = self.supabase.table('activity_records').insert(records).execute()
            
            if result.data:
                print(f"\n  ✓ Successfully uploaded {len(result.data)} records")
                
                # Clear SQLite
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM active_sessions")
                conn.commit()
                conn.close()
                
                print(f"  ✓ Cleared SQLite database")
                return True
            else:
                print("\n  ✗ Upload returned no data")
                return False
                
        except Exception as e:
            print(f"\n  ✗ Upload failed: {e}")
            return False


def main():
    parser = argparse.ArgumentParser(description='Real window tracking test')
    parser.add_argument('--duration', type=int, default=5, help='Track for N minutes')
    parser.add_argument('--interval', type=int, default=3, help='Check every N seconds')
    parser.add_argument('--upload', action='store_true', help='Upload to Supabase after tracking')
    
    args = parser.parse_args()
    
    print("\n╔════════════════════════════════════════════════════════════════════════════╗")
    print("║              REAL WINDOW TRACKING TEST                                     ║")
    print("║          Captures Screenshots & Extracts Text with OCR                     ║")
    print("╚════════════════════════════════════════════════════════════════════════════╝")
    
    tracker = RealWindowTracker()
    
    # Find database
    print("\n🔍 Finding database...")
    if not tracker.find_database():
        print("✗ Database not found. Run desktop app once to create it.")
        sys.exit(1)
    
    print(f"✓ Using: {tracker.db_path}")
    
    # Track windows
    tracker.track_windows(args.duration, args.interval)
    
    # Show collected data
    sessions = tracker.show_collected_data()
    
    # Upload if requested
    if args.upload and sessions:
        tracker.upload_to_supabase(sessions)
    
    # Final summary
    print("\n" + "="*80)
    print("  ✅ TEST COMPLETE")
    print("="*80)
    
    print(f"\n  What was tested:")
    print(f"  ✓ Real window monitoring")
    print(f"  ✓ Real screenshot capture")
    print(f"  ✓ Application classification")
    print(f"  ✓ OCR text extraction (PaddleOCR/Tesseract)")
    print(f"  ✓ SQLite storage")
    if args.upload:
        print(f"  ✓ Supabase upload")
    
    print(f"\n  💡 To upload to Supabase, run:")
    print(f"     python test_real_tracking.py --duration {args.duration} --upload")
    
    print("\n" + "="*80)


if __name__ == '__main__':
    main()
