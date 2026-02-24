"""
QUICK BATCH PROCESSING TEST (5 MINUTES)
========================================

Fast validation of batch processing system.
Tests a single 5-minute batch cycle instead of full 15 minutes.

USAGE:
    python test_batch_quick.py

REQUIREMENTS:
    - Desktop app running (desktop_app.py)
    - User logged in and tracking active
    - Supabase credentials in .env
"""

import os
import sys
import time
from datetime import datetime, timezone

# Reuse the comprehensive tester
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_batch_processing_real import BatchProcessingTester


class QuickBatchTester(BatchProcessingTester):
    """Quick 5-minute batch validation"""
    
    def __init__(self):
        super().__init__(manual_mode=True)
        self.test_duration = 5.5 * 60  # 5.5 minutes (to catch the batch upload)
        self.expected_batches = 1
    
    def run_quick_test(self):
        """Run quick 5-minute validation"""
        print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                    QUICK BATCH PROCESSING TEST                             ║
║                          5-Minute Validation                               ║
╚════════════════════════════════════════════════════════════════════════════╝

TEST PLAN:
  Duration: 5.5 minutes (1 batch cycle + buffer)
  Goal: Verify single batch upload at 5-minute mark

ACTIONS REQUIRED:
  1. Switch between 3-5 different windows/applications
  2. Spend 30-60 seconds on each
  3. Try productive apps (VS Code, Jira) and non-productive (Gmail, YouTube)
  4. Return to a previous window to test visit_count tracking
""")
        
        # Preflight checks
        if not self.run_preflight_checks():
            print("\n⚠️  WARNING: Some preflight checks failed")
            response = input("Continue anyway? (y/n): ")
            if response.lower() != 'y':
                return
        
        print("\n" + "="*80)
        input("\n▶  Press ENTER to start 5-minute test...")
        
        self.test_start_time = time.time()
        print("\n⏱️  Test started at", datetime.now().strftime('%H:%M:%S'))
        print("\n📍 CHECKPOINTS:")
        print("   - 1 min: First status check")
        print("   - 2 min: Second status check")  
        print("   - 5 min: BATCH UPLOAD should occur")
        print("   - 5.5 min: Final verification")
        
        checkpoints = [60, 120, 180, 240, 300, 330]  # Check at 1, 2, 3, 4, 5, 5.5 min
        last_checkpoint_idx = 0
        
        try:
            while True:
                elapsed = time.time() - self.test_start_time
                
                if elapsed >= self.test_duration:
                    break
                
                # Check if we've passed a checkpoint
                for i, checkpoint in enumerate(checkpoints[last_checkpoint_idx:], last_checkpoint_idx):
                    if elapsed >= checkpoint:
                        self.print_checkpoint(checkpoint, elapsed)
                        last_checkpoint_idx = i + 1
                
                time.sleep(5)
        
        except KeyboardInterrupt:
            print("\n\n✗ Test interrupted by user")
        
        # Final report
        self.print_quick_final_report()
    
    def print_checkpoint(self, checkpoint, elapsed):
        """Print status at checkpoint"""
        minutes = int(checkpoint / 60)
        
        self.print_header(f"CHECKPOINT - {minutes} MINUTE{'S' if minutes != 1 else ''}")
        
        # Get current state
        sessions = self.get_sqlite_sessions()
        records = self.get_supabase_records(
            since_time=datetime.fromtimestamp(self.test_start_time, tz=timezone.utc)
        )
        
        # SQLite status
        print(f"\n  📊 SQLite active_sessions: {len(sessions)} session(s)")
        if sessions:
            for i, session in enumerate(sessions[:3], 1):  # Show first 3
                title = session.get('window_title', 'N/A')[:40]
                time_sec = int(session.get('total_time_seconds', 0))
                visits = session.get('visit_count', 0)
                print(f"      [{i}] {title} ({time_sec}s, visits: {visits})")
        
        # Supabase status
        print(f"\n  ☁️  Supabase activity_records: {len(records)} record(s)")
        
        # Detect batch upload
        if checkpoint >= 300 and records and len(sessions) == 0:
            self.print_status("✅", "BATCH UPLOAD SUCCESSFUL!")
            self.print_status("ℹ️", f"SQLite cleared, {len(records)} records in Supabase")
            self.batches_detected.append(elapsed)
        elif checkpoint >= 300 and len(sessions) > 0:
            self.print_status("⏳", "Waiting for batch upload...")
        
        time.sleep(1)  # Brief pause for readability
    
    def print_quick_final_report(self):
        """Print final report for quick test"""
        self.print_header("QUICK TEST RESULTS")
        
        total_time = time.time() - self.test_start_time
        minutes_run = total_time / 60
        
        print(f"\n  Test Duration: {minutes_run:.1f} minutes")
        
        # Final state
        final_sessions = self.get_sqlite_sessions()
        final_records = self.get_supabase_records(
            since_time=datetime.fromtimestamp(self.test_start_time, tz=timezone.utc)
        )
        
        print(f"\n  📊 Final SQLite State: {len(final_sessions)} session(s)")
        print(f"  ☁️  Final Supabase State: {len(final_records)} record(s)")
        
        # Show records
        if final_records:
            print("\n  📋 UPLOADED RECORDS:")
            self.display_supabase_records(final_records)
        
        # Validation
        print("\n  🔍 VALIDATION:")
        
        if len(self.batches_detected) > 0:
            self.print_status("✅", "Batch upload detected")
            batch_time = self.batches_detected[0]
            print(f"      Upload occurred at: {int(batch_time/60)} min {int(batch_time%60)} sec")
        else:
            self.print_status("❌", "No batch upload detected")
            print("      Possible reasons:")
            print("      - Desktop app is paused")
            print("      - User is idle")
            print("      - Less than 5 minutes of activity")
            print("      - Desktop app not running")
        
        if final_records:
            self.print_status("✅", f"{len(final_records)} records uploaded successfully")
            
            # Validate record structure
            sample = final_records[0]
            has_ocr = bool(sample.get('ocr_text'))
            has_jira = bool(sample.get('user_assigned_issues'))
            has_classification = bool(sample.get('classification'))
            
            if has_classification:
                self.print_status("✅", "Classification present")
            if has_ocr:
                self.print_status("✅", "OCR data captured")
            if has_jira:
                self.print_status("✅", "Jira context included")
        else:
            self.print_status("❌", "No records in Supabase")
        
        if len(final_sessions) == 0 and final_records:
            self.print_status("✅", "SQLite properly cleared after upload")
        elif len(final_sessions) > 0 and not final_records:
            self.print_status("⚠️", f"{len(final_sessions)} sessions in SQLite (waiting for batch)")
        
        # Final verdict
        print("\n" + "="*80)
        
        if self.batches_detected and final_records and len(final_sessions) < 3:
            print("  ✅ TEST PASSED - Batch processing is working!")
            print("\n  Summary:")
            print(f"    • Batch uploaded at ~5 minute mark")
            print(f"    • {len(final_records)} records saved to Supabase")
            print(f"    • SQLite properly managed")
        elif final_records:
            print("  ⚠️  TEST PARTIAL - Some issues detected")
            print("\n  Issues:")
            if not self.batches_detected:
                print("    • Batch upload timing not precisely detected")
            print("\n  But data is flowing correctly.")
        else:
            print("  ❌ TEST FAILED - No data uploaded")
            print("\n  Troubleshooting:")
            print("    1. Check desktop app is running and tracking is active")
            print("    2. Verify user is logged in (not anonymous)")
            print("    3. Check Supabase credentials in .env")
            print("    4. Review desktop app console for errors")
        
        print("="*80)


def main():
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                         QUICK VALIDATION TEST                              ║
║              Test Batch Processing in Just 5 Minutes                      ║
╚════════════════════════════════════════════════════════════════════════════╝

This is a fast check to verify the batch processing system is working.
For comprehensive testing, use: python test_batch_processing_real.py
    """)
    
    tester = QuickBatchTester()
    tester.run_quick_test()
    
    print("\n💡 TIP: For full 15-minute validation, run:")
    print("   python test_batch_processing_real.py --manual\n")


if __name__ == '__main__':
    main()
