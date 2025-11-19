"""
Quick script to verify screenshots are being saved to Supabase
Run this to check if screenshots are in the database and storage
"""

import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not supabase_service_key:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    exit(1)

supabase = create_client(supabase_url, supabase_service_key)

print("=" * 60)
print("SUPABASE SCREENSHOT VERIFICATION")
print("=" * 60)

# 1. Check screenshots table
print("\n1. Checking screenshots table...")
try:
    result = supabase.table('screenshots').select('*').order('timestamp', desc=True).limit(10).execute()
    
    if result.data:
        print(f"✅ Found {len(result.data)} recent screenshots in database")
        print("\nRecent screenshots:")
        for i, screenshot in enumerate(result.data, 1):
            print(f"\n  Screenshot {i}:")
            print(f"    ID: {screenshot.get('id')}")
            print(f"    User ID: {screenshot.get('user_id')}")
            print(f"    Timestamp: {screenshot.get('timestamp')}")
            print(f"    App: {screenshot.get('application_name', 'Unknown')}")
            print(f"    Window: {screenshot.get('window_title', 'Unknown')[:50]}")
            print(f"    Status: {screenshot.get('status')}")
            print(f"    Storage Path: {screenshot.get('storage_path')}")
            print(f"    File Size: {screenshot.get('file_size_bytes', 0)} bytes")
    else:
        print("❌ No screenshots found in database")
except Exception as e:
    print(f"❌ Error querying screenshots table: {e}")

# 2. Check storage bucket
print("\n2. Checking storage bucket...")
try:
    # List files in screenshots bucket
    files_result = supabase.storage.from_('screenshots').list()
    
    # Handle different response formats
    files = files_result
    if isinstance(files_result, dict):
        files = files_result.get('data', [])
    elif hasattr(files_result, 'data'):
        files = files_result.data
    
    if files and len(files) > 0:
        print(f"✅ Found {len(files)} files/folders in storage bucket")
        print("\nStorage structure:")
        for item in files[:10]:  # Show first 10
            if isinstance(item, dict):
                name = item.get('name', 'Unknown')
                size = item.get('metadata', {}).get('size', 0) if isinstance(item.get('metadata'), dict) else 0
                print(f"    - {name} ({size} bytes)")
            else:
                print(f"    - {str(item)}")
    else:
        print("⚠️  Storage listing returned empty (files may be in subdirectories)")
        print("    Note: Screenshots are stored in user-specific folders (user_id/filename)")
except Exception as e:
    print(f"⚠️  Error listing storage (this is OK - files are in user folders): {e}")

# 3. Check users table
print("\n3. Checking users table...")
try:
    users = supabase.table('users').select('*').execute()
    if users.data:
        print(f"✅ Found {len(users.data)} users")
        for user in users.data:
            print(f"    - {user.get('email', 'No email')} (ID: {user.get('id')})")
    else:
        print("❌ No users found")
except Exception as e:
    print(f"❌ Error querying users: {e}")

# 4. Count screenshots by user
print("\n4. Screenshot count by user...")
try:
    result = supabase.table('screenshots').select('user_id').execute()
    if result.data:
        from collections import Counter
        user_counts = Counter(s['user_id'] for s in result.data)
        print(f"✅ Total screenshots: {len(result.data)}")
        for user_id, count in user_counts.items():
            print(f"    User {user_id[:8]}...: {count} screenshots")
    else:
        print("❌ No screenshots to count")
except Exception as e:
    print(f"❌ Error counting screenshots: {e}")

print("\n" + "=" * 60)
print("Verification complete!")
print("=" * 60)

