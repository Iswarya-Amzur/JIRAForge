"""
View activity_records from Supabase

This script connects to Supabase and shows recent activity records.
"""

import os
import sys
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    from supabase import create_client
except ImportError:
    print("❌ supabase-py not installed")
    print("   Install: pip install supabase")
    sys.exit(1)

def get_activity_records(limit=10):
    """Fetch recent activity records from Supabase"""
    
    # Get Supabase credentials from .env
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Supabase credentials not found in .env file")
        print("   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)")
        return
    
    print("\n" + "=" * 70)
    print("  ACTIVITY RECORDS FROM SUPABASE")
    print("=" * 70)
    print(f"URL: {supabase_url}\n")
    
    try:
        # Connect to Supabase
        supabase = create_client(supabase_url, supabase_key)
        
        # Query activity_records table
        response = supabase.table('activity_records') \
            .select('*') \
            .order('created_at', desc=True) \
            .limit(limit) \
            .execute()
        
        records = response.data
        
        if not records:
            print("📭 No activity records found in database")
            print("\nThis is normal if:")
            print("  • You haven't run the desktop app yet")
            print("  • The 5-minute batch upload hasn't triggered")
            print("  • You're using a test/empty database")
            return
        
        print(f"📊 Found {len(records)} recent record(s):\n")
        print("-" * 70)
        
        for i, record in enumerate(records, 1):
            print(f"\n🔹 Record {i}:")
            print(f"   Window: {record.get('window_title', 'N/A')[:50]}...")
            print(f"   App: {record.get('application_name', 'N/A')}")
            print(f"   Classification: {record.get('classification', 'N/A')}")
            print(f"   OCR Method: {record.get('ocr_method', 'N/A')}")
            print(f"   OCR Confidence: {record.get('ocr_confidence', 0):.2f}")
            print(f"   Duration: {record.get('duration_seconds', 0)}s")
            print(f"   Status: {record.get('status', 'N/A')}")
            print(f"   Created: {record.get('created_at', 'N/A')}")
            
            # Show OCR text preview if available
            ocr_text = record.get('ocr_text')
            if ocr_text:
                preview = ocr_text[:100].replace('\n', ' ')
                print(f"   OCR Text: {preview}...")
        
        print("\n" + "-" * 70)
        print(f"\n✅ Total records in database: Check Supabase dashboard for full count")
        
    except Exception as e:
        print(f"❌ Error connecting to Supabase: {e}")
        print("\nTroubleshooting:")
        print("  • Check your .env file has correct SUPABASE_URL and keys")
        print("  • Verify the activity_records table exists (run migration)")
        print("  • Check your internet connection")

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='View activity records from Supabase')
    parser.add_argument('--limit', type=int, default=10, help='Number of records to show (default: 10)')
    
    args = parser.parse_args()
    
    get_activity_records(args.limit)
    print()
