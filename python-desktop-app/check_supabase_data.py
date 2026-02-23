"""
Check Supabase Database for Project Key Values

This script checks your Supabase activity_records table to see
what project_key values are actually stored.
"""

import os
import sys
from pathlib import Path
from supabase import create_client

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from desktop_app import get_env_var

def main():
    print("\n🔍 Checking Supabase for project_key values...")
    print("="*70)
    
    # Get Supabase credentials
    supabase_url = get_env_var('SUPABASE_URL')
    supabase_key = get_env_var('SUPABASE_SERVICE_ROLE_KEY') or get_env_var('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Supabase credentials not found in environment variables")
        print("   Please check your .env file")
        return
    
    print(f"✅ Supabase URL: {supabase_url}")
    
    try:
        # Create Supabase client
        supabase = create_client(supabase_url, supabase_key)
        print("✅ Connected to Supabase")
        
        # Check activity_records table
        print("\n" + "="*70)
        print("1. Activity Records - Project Key Analysis")
        print("="*70)
        
        # Count total records
        response = supabase.table('activity_records').select('id', count='exact').execute()
        total_count = response.count if hasattr(response, 'count') else len(response.data)
        print(f"\nTotal activity records: {total_count}")
        
        # Get distinct project_key values
        print("\nFetching distinct project_key values...")
        response = supabase.table('activity_records').select('project_key').execute()
        
        if response.data:
            # Count occurrences of each project_key
            project_keys = {}
            for record in response.data:
                key = record.get('project_key')
                if key:
                    project_keys[key] = project_keys.get(key, 0) + 1
            
            if project_keys:
                print(f"\n✅ Found {len(project_keys)} distinct project_key value(s):\n")
                for key, count in sorted(project_keys.items(), key=lambda x: x[1], reverse=True):
                    print(f"   '{key}': {count} record(s)")
                    
                    # Check if 'jiraforge' is present
                    if key.lower() == 'jiraforge':
                        print(f"      ⚠️  WARNING: This is the 'jiraforge' key causing the issue!")
            else:
                print("   ℹ️  All project_key values are NULL")
        else:
            print("   ℹ️  No activity records found")
        
        # Get sample records with 'jiraforge' project_key
        print("\n" + "="*70)
        print("2. Sample Records with 'jiraforge' project_key")
        print("="*70)
        
        response = supabase.table('activity_records')\
            .select('id, window_title, application_name, project_key, created_at, user_assigned_issues')\
            .ilike('project_key', 'jiraforge')\
            .order('created_at', desc=True)\
            .limit(5)\
            .execute()
        
        if response.data and len(response.data) > 0:
            print(f"\n✅ Found {len(response.data)} record(s) with project_key='jiraforge':\n")
            for idx, record in enumerate(response.data, 1):
                print(f"   [{idx}] ID: {record['id'][:8]}...")
                print(f"       Window: {record.get('window_title', 'N/A')[:60]}")
                print(f"       App: {record.get('application_name', 'N/A')}")
                print(f"       Project Key: {record.get('project_key')}")
                print(f"       Created: {record.get('created_at')}")
                
                # Check user_assigned_issues for hints
                issues = record.get('user_assigned_issues')
                if issues:
                    try:
                        import json
                        issues_data = json.loads(issues) if isinstance(issues, str) else issues
                        if issues_data and len(issues_data) > 0:
                            print(f"       User Issues at time of capture:")
                            for issue in issues_data[:2]:
                                if isinstance(issue, dict):
                                    print(f"         • {issue.get('key')} (Project: {issue.get('project')})")
                    except:
                        pass
                print()
        else:
            print("   ℹ️  No records found with project_key='jiraforge'")
            print("   The issue might be with current/new records being created")
        
        # Check if there are any NULL project_keys
        print("\n" + "="*70)
        print("3. Records with NULL project_key")
        print("="*70)
        
        response = supabase.table('activity_records')\
            .select('id', count='exact')\
            .is_('project_key', 'null')\
            .execute()
        
        null_count = response.count if hasattr(response, 'count') else len(response.data)
        print(f"   Records with NULL project_key: {null_count}")
        
    except Exception as e:
        print(f"\n❌ Error accessing Supabase: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n" + "="*70)
    print("✅ Supabase inspection complete!")
    print("="*70)
    print("\nNext steps:")
    print("  1. If you found 'jiraforge' records above, check the 'user_assigned_issues'")
    print("     field to see what Jira data was cached at that time")
    print("  2. Run 'python diagnose_project_key.py' to check current Jira API data")
    print("  3. If needed, you can manually update records in Supabase")
    print()

if __name__ == "__main__":
    main()
