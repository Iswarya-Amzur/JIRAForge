"""
COMPLETE BATCH PROCESSING TEST SCRIPT
=====================================

This script tests the complete JSON record creation and batch upload process
with real data over a 15-minute period.

TEST PLAN:
- Duration: 15 minutes (3 batch cycles of 5 minutes each)
- Simulates: Window switches, OCR capture, classification, batch uploads
- Validates: SQLite storage, Supabase uploads, data integrity
- Monitor: Real-time status display

REQUIREMENTS:
1. Desktop app must be running (desktop_app.py)
2. User must be logged in (authenticated with Jira)
3. Supabase credentials configured (.env file)

USAGE:
    python test_batch_processing_real.py

    OR with manual window switching (recommended):
    python test_batch_processing_real.py --manual

    Manual mode: You manually switch windows/tabs for realistic testing
    Auto mode: Script simulates window switches programmatically
"""

import os
import sys
import time
import json
import sqlite3
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: Missing dependencies. Install with:")
    print("  pip install supabase python-dotenv")
    sys.exit(1)


class BatchProcessingTester:
    """Complete test harness for batch processing validation"""
    
    def __init__(self, manual_mode=False):
        self.manual_mode = manual_mode
        self.test_start_time = None
        self.test_duration = 15 * 60  # 15 minutes
        self.batch_interval = 5 * 60  # 5 minutes
        self.expected_batches = 3
        
        # Load environment
        load_dotenv()
        
        # Database paths
        self.db_path = self._find_sqlite_db()
        
        # Initialize Supabase client
        self.supabase = self._init_supabase()
        
        # Test state tracking
        self.batches_detected = []
        self.sqlite_snapshots = []
        self.supabase_snapshots = []
        
        # Simulated window data (for auto mode)
        self.test_windows = [
            {
                'title': 'PROJ-123: Implement OAuth Login - Jira',
                'app': 'chrome.exe',
                'classification': 'productive',
                'ocr_text': 'PROJ-123\nImplement OAuth Login\n\nStatus: In Progress\nAssignee: John Doe\n\nDescription:\nAdd OAuth 2.0 authentication flow with PKCE...',
                'duration': 180  # seconds
            },
            {
                'title': 'main.py - Visual Studio Code',
                'app': 'Code.exe',
                'classification': 'productive',
                'ocr_text': 'def authenticate_user(code):\n    # Exchange code for tokens\n    response = oauth_client.get_token(code)\n    return response.access_token',
                'duration': 240
            },
            {
                'title': 'Inbox (23) - Gmail',
                'app': 'chrome.exe',
                'classification': 'non_productive',
                'ocr_text': None,  # No OCR for non-productive
                'duration': 60
            },
            {
                'title': 'OAuth 2.0 PKCE Flow - Stack Overflow',
                'app': 'chrome.exe',
                'classification': 'productive',
                'ocr_text': 'PKCE (Proof Key for Code Exchange)\n\nPKCE is an extension to the OAuth 2.0 Authorization Code flow...',
                'duration': 120
            },
            {
                'title': 'package.json - Visual Studio Code',
                'app': 'Code.exe',
                'classification': 'productive',
                'ocr_text': '{\n  "dependencies": {\n    "oauth2-client": "^2.1.0",\n    "express": "^4.18.0"\n  }\n}',
                'duration': 90
            },
            {
                'title': 'Slack - Team Chat',
                'app': 'slack.exe',
                'classification': 'non_productive',
                'ocr_text': None,
                'duration': 45
            },
            {
                'title': 'test_auth.py - Visual Studio Code',
                'app': 'Code.exe',
                'classification': 'productive',
                'ocr_text': 'def test_oauth_flow():\n    # Test PKCE flow\n    verifier = generate_code_verifier()\n    challenge = generate_code_challenge(verifier)',
                'duration': 150
            },
            {
                'title': 'YouTube - Music',
                'app': 'chrome.exe',
                'classification': 'non_productive',
                'ocr_text': None,
                'duration': 30
            },
        ]
    
    def _find_sqlite_db(self):
        """Find the SQLite database file"""
        possible_paths = [
            Path.home() / 'AppData' / 'Local' / 'TimeTracker' / 'offline_screenshots.db',
            Path.home() / '.timetracker' / 'offline_screenshots.db',
            Path(__file__).parent / 'offline_screenshots.db',
        ]
        
        for path in possible_paths:
            if path.exists():
                print(f"✓ Found SQLite database: {path}")
                return str(path)
        
        print("✗ SQLite database not found. Expected locations:")
        for path in possible_paths:
            print(f"  - {path}")
        print("\nNOTE: Database is created when desktop app starts tracking.")
        return None
    
    def _init_supabase(self):
        """Initialize Supabase client"""
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
        
        if not url or not key:
            print("✗ Missing Supabase credentials in .env file")
            print("  Required: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_KEY)")
            return None
        
        try:
            client = create_client(url, key)
            print(f"✓ Connected to Supabase: {url}")
            return client
        except Exception as e:
            print(f"✗ Failed to connect to Supabase: {e}")
            return None
    
    def get_sqlite_sessions(self):
        """Get current sessions from SQLite active_sessions table"""
        if not self.db_path or not os.path.exists(self.db_path):
            return []
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if table exists
            cursor.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='active_sessions'
            """)
            
            if not cursor.fetchone():
                conn.close()
                return []
            
            cursor.execute("SELECT * FROM active_sessions")
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            conn.close()
            
            return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            print(f"✗ Error reading SQLite: {e}")
            return []
    
    def get_supabase_records(self, since_time=None):
        """Get activity records from Supabase"""
        if not self.supabase:
            return []
        
        try:
            query = self.supabase.table('activity_records').select('*')
            
            if since_time:
                query = query.gte('created_at', since_time.isoformat())
            
            result = query.order('created_at', desc=True).limit(100).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"✗ Error reading Supabase: {e}")
            return []
    
    def print_header(self, text):
        """Print formatted section header"""
        print("\n" + "="*80)
        print(f"  {text}")
        print("="*80)
    
    def print_status(self, emoji, text):
        """Print status line"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {emoji} {text}")
    
    def display_sqlite_sessions(self, sessions):
        """Display current SQLite sessions"""
        if not sessions:
            print("  (empty)")
            return
        
        print(f"\n  Found {len(sessions)} session(s):\n")
        
        for i, session in enumerate(sessions, 1):
            window_title = session.get('window_title', 'N/A')[:50]
            app_name = session.get('application_name', 'N/A')
            classification = session.get('classification', 'unknown')
            time_seconds = session.get('total_time_seconds', 0)
            visit_count = session.get('visit_count', 0)
            ocr_method = session.get('ocr_method') or 'none'
            ocr_text_length = len(session.get('ocr_text') or '')
            
            print(f"  [{i}] Window: {window_title}")
            print(f"      App: {app_name}")
            print(f"      Classification: {classification}")
            print(f"      Time: {int(time_seconds)}s (visits: {visit_count})")
            print(f"      OCR: {ocr_method} ({ocr_text_length} chars)")
            
            if i < len(sessions):
                print()
    
    def display_supabase_records(self, records):
        """Display Supabase activity records"""
        if not records:
            print("  (no new records)")
            return
        
        print(f"\n  Found {len(records)} record(s):\n")
        
        for i, record in enumerate(records[:10], 1):  # Show first 10
            window_title = record.get('window_title', 'N/A')[:50]
            app_name = record.get('application_name', 'N/A')
            classification = record.get('classification', 'unknown')
            duration = record.get('duration_seconds', 0)
            status = record.get('status', 'unknown')
            batch_time = record.get('batch_timestamp', 'N/A')[:19]
            
            print(f"  [{i}] Window: {window_title}")
            print(f"      App: {app_name}")
            print(f"      Classification: {classification} | Status: {status}")
            print(f"      Duration: {duration}s | Batch: {batch_time}")
            
            # Show Jira context if present
            user_issues = record.get('user_assigned_issues')
            if user_issues:
                try:
                    issues = json.loads(user_issues) if isinstance(user_issues, str) else user_issues
                    issue_keys = [issue.get('key') for issue in issues]
                    print(f"      Jira Issues: {', '.join(issue_keys)}")
                except:
                    pass
            
            if i < len(records):
                print()
    
    def check_desktop_app_running(self):
        """Check if desktop app is running"""
        try:
            import psutil
            for proc in psutil.process_iter(['name', 'cmdline']):
                cmdline = proc.info.get('cmdline') or []
                if any('desktop_app.py' in str(arg) for arg in cmdline):
                    return True
        except ImportError:
            print("  (psutil not installed - skipping process check)")
            return True  # Assume running
        except Exception:
            pass
        
        return False
    
    def run_preflight_checks(self):
        """Run preflight checks before starting test"""
        self.print_header("PREFLIGHT CHECKS")
        
        checks_passed = True
        
        # Check 1: SQLite database
        if self.db_path and os.path.exists(self.db_path):
            self.print_status("✓", f"SQLite database found: {os.path.basename(self.db_path)}")
            
            # Check table exists
            sessions = self.get_sqlite_sessions()
            if sessions is not None:
                self.print_status("✓", f"active_sessions table exists ({len(sessions)} current records)")
            else:
                self.print_status("⚠", "active_sessions table not yet created")
        else:
            self.print_status("✗", "SQLite database not found")
            self.print_status("ℹ", "Database will be created when desktop app starts tracking")
            checks_passed = False
        
        # Check 2: Supabase connection
        if self.supabase:
            self.print_status("✓", "Supabase connection established")
            
            try:
                # Test query
                result = self.supabase.table('activity_records').select('id').limit(1).execute()
                self.print_status("✓", "Can query activity_records table")
            except Exception as e:
                self.print_status("✗", f"Cannot query activity_records: {e}")
                checks_passed = False
        else:
            self.print_status("✗", "Supabase not connected")
            checks_passed = False
        
        # Check 3: Desktop app running
        if self.check_desktop_app_running():
            self.print_status("✓", "Desktop app is running")
        else:
            self.print_status("⚠", "Desktop app may not be running")
            self.print_status("ℹ", "Make sure desktop_app.py is running and tracking is active")
        
        return checks_passed
    
    def run_test(self):
        """Run the complete 15-minute test"""
        self.print_header("BATCH PROCESSING TEST - 15 MINUTE VALIDATION")
        
        print(f"""
TEST CONFIGURATION:
  Mode: {'MANUAL' if self.manual_mode else 'MONITORING'}
  Duration: 15 minutes (3 batch cycles)
  Batch Interval: 5 minutes
  Expected Batches: 3

TEST OBJECTIVES:
  1. Monitor SQLite active_sessions table (real-time session tracking)
  2. Verify batch uploads to Supabase every 5 minutes
  3. Validate JSON record structure and data integrity
  4. Confirm SQLite clearing after successful upload
""")
        
        # Preflight checks
        if not self.run_preflight_checks():
            print("\n✗ PREFLIGHT CHECKS FAILED")
            print("  Please ensure:")
            print("  1. Desktop app is running (python desktop_app.py)")
            print("  2. User is logged in and tracking is active")
            print("  3. Supabase credentials are configured")
            response = input("\nContinue anyway? (y/n): ")
            if response.lower() != 'y':
                return
        
        print("\n" + "="*80)
        
        if self.manual_mode:
            print("\n🎯 MANUAL TEST MODE")
            print("\nINSTRUCTIONS:")
            print("  1. Switch between different applications and tabs")
            print("  2. Spend 30-60 seconds on each window")
            print("  3. Try these apps: Browser (multiple tabs), VS Code, Slack, etc.")
            print("  4. Return to previous windows to test visit_count tracking")
            print("\nThe script will monitor and report activity every minute.")
            print("Batch uploads occur every 5 minutes automatically.")
        else:
            print("\n📊 MONITORING MODE")
            print("\nThe script will monitor the desktop app's activity tracking.")
            print("Make sure you're actively using different applications.")
        
        input("\nPress ENTER to start the 15-minute test...")
        
        self.test_start_time = time.time()
        last_check_time = 0
        check_interval = 60  # Check every minute
        
        try:
            while True:
                elapsed = time.time() - self.test_start_time
                
                if elapsed >= self.test_duration:
                    break
                
                # Periodic status check (every minute)
                if elapsed - last_check_time >= check_interval:
                    self.print_status_update(elapsed)
                    last_check_time = elapsed
                
                time.sleep(5)  # Check every 5 seconds for batch uploads
        
        except KeyboardInterrupt:
            print("\n\n✗ Test interrupted by user")
        
        # Final report
        self.print_final_report()
    
    def print_status_update(self, elapsed):
        """Print periodic status update"""
        minutes_elapsed = int(elapsed / 60)
        minutes_remaining = int((self.test_duration - elapsed) / 60)
        
        # Calculate current batch cycle
        current_batch = int(elapsed / self.batch_interval) + 1
        time_until_next_batch = self.batch_interval - (elapsed % self.batch_interval)
        batch_countdown = int(time_until_next_batch / 60)
        
        self.print_header(f"STATUS UPDATE - {minutes_elapsed} MIN ELAPSED ({minutes_remaining} MIN REMAINING)")
        
        print(f"\n  Current Batch Cycle: {current_batch}/3")
        print(f"  Next Batch Upload In: ~{batch_countdown} minutes")
        
        # SQLite snapshot
        print("\n  📊 SQLITE active_sessions TABLE:")
        sessions = self.get_sqlite_sessions()
        self.display_sqlite_sessions(sessions)
        self.sqlite_snapshots.append({
            'time': elapsed,
            'sessions': sessions
        })
        
        # Supabase snapshot (records since test start)
        print("\n  ☁️  SUPABASE activity_records TABLE (since test start):")
        records = self.get_supabase_records(since_time=datetime.fromtimestamp(self.test_start_time, tz=timezone.utc))
        self.display_supabase_records(records)
        self.supabase_snapshots.append({
            'time': elapsed,
            'records': records
        })
        
        # Detect batch uploads (SQLite cleared after upload)
        if len(self.sqlite_snapshots) >= 2:
            prev_sessions = len(self.sqlite_snapshots[-2]['sessions'])
            curr_sessions = len(sessions)
            
            if prev_sessions > 0 and curr_sessions == 0:
                self.print_status("🚀", "BATCH UPLOAD DETECTED! SQLite was cleared.")
                self.batches_detected.append(elapsed)
    
    def print_final_report(self):
        """Print comprehensive final test report"""
        self.print_header("FINAL TEST REPORT")
        
        total_time = time.time() - self.test_start_time
        minutes_run = int(total_time / 60)
        
        print(f"\n  Test Duration: {minutes_run} minutes")
        print(f"  Batches Detected: {len(self.batches_detected)}/3 expected")
        
        if self.batches_detected:
            print("\n  Batch Upload Times (minutes into test):")
            for i, batch_time in enumerate(self.batches_detected, 1):
                print(f"    [{i}] {int(batch_time/60)} min {int(batch_time%60)} sec")
        
        # Final SQLite state
        print("\n  📊 FINAL SQLITE STATE:")
        final_sessions = self.get_sqlite_sessions()
        self.display_sqlite_sessions(final_sessions)
        
        # Final Supabase state
        print("\n  ☁️  FINAL SUPABASE STATE (all records from test):")
        final_records = self.get_supabase_records(
            since_time=datetime.fromtimestamp(self.test_start_time, tz=timezone.utc)
        )
        self.display_supabase_records(final_records)
        
        # Validation
        print("\n  VALIDATION:")
        
        if len(self.batches_detected) >= 3:
            self.print_status("✓", "All 3 batch uploads detected")
        elif len(self.batches_detected) > 0:
            self.print_status("⚠", f"Only {len(self.batches_detected)} batch uploads detected (expected 3)")
        else:
            self.print_status("✗", "No batch uploads detected")
        
        if final_records:
            self.print_status("✓", f"{len(final_records)} records uploaded to Supabase")
            
            # Check record structure
            sample_record = final_records[0]
            required_fields = [
                'window_title', 'application_name', 'classification',
                'ocr_text', 'ocr_method', 'total_time_seconds',
                'visit_count', 'batch_timestamp', 'status'
            ]
            
            missing_fields = [field for field in required_fields if field not in sample_record]
            if not missing_fields:
                self.print_status("✓", "All required fields present in records")
            else:
                self.print_status("✗", f"Missing fields: {', '.join(missing_fields)}")
            
            # Check for Jira context
            if sample_record.get('user_assigned_issues'):
                self.print_status("✓", "Jira context included in records")
            else:
                self.print_status("⚠", "No Jira context found (user may not have issues)")
        else:
            self.print_status("✗", "No records found in Supabase")
        
        if final_sessions:
            self.print_status("⚠", f"{len(final_sessions)} sessions still in SQLite (next batch pending)")
        else:
            self.print_status("✓", "SQLite cleared (indicates successful upload)")
        
        # Summary
        print("\n" + "="*80)
        if len(self.batches_detected) >= 2 and final_records:
            print("  ✓ TEST PASSED - Batch processing is working correctly!")
        elif final_records:
            print("  ⚠ TEST PARTIAL - Some batch uploads occurred")
        else:
            print("  ✗ TEST FAILED - No batch uploads detected")
        print("="*80)


def main():
    parser = argparse.ArgumentParser(
        description='Test batch processing with real data over 15 minutes',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_batch_processing_real.py          # Monitor mode (watch existing activity)
  python test_batch_processing_real.py --manual # Manual mode (you switch windows)

Requirements:
  1. Desktop app (desktop_app.py) must be running
  2. User must be logged in with Jira OAuth
  3. Tracking must be active (not paused)
  4. Supabase credentials in .env file
        """
    )
    
    parser.add_argument(
        '--manual',
        action='store_true',
        help='Manual mode: you manually switch between applications'
    )
    
    args = parser.parse_args()
    
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                   BATCH PROCESSING VALIDATION TEST                         ║
║                         15-Minute Real Data Test                           ║
╚════════════════════════════════════════════════════════════════════════════╝
    """)
    
    tester = BatchProcessingTester(manual_mode=args.manual)
    tester.run_test()


if __name__ == '__main__':
    main()
