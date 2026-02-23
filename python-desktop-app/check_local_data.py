"""
Check Local SQLite Database for Project Key Data

This script checks your local SQLite database to see if there's
cached project_key data that might be causing the issue.
"""

import sqlite3
import json
from pathlib import Path
import os

db_path = Path.home() / "jiraforge_local.db"

if not db_path.exists():
    print(f"❌ Database not found at: {db_path}")
    print("   The app hasn't created local data yet.")
    exit(0)

print(f"✅ Found database at: {db_path}")
print("="*70)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print(f"\n📊 Tables in database: {[t[0] for t in tables]}")

# Check active_sessions table
print("\n" + "="*70)
print("1. Active Sessions (Event-based tracking)")
print("="*70)

try:
    cursor.execute("SELECT COUNT(*) FROM active_sessions")
    count = cursor.fetchone()[0]
    print(f"Total sessions: {count}")
    
    if count > 0:
        cursor.execute("""
            SELECT window_title, application_name, 
                   total_time_seconds, visit_count 
            FROM active_sessions 
            ORDER BY last_seen DESC 
            LIMIT 5
        """)
        sessions = cursor.fetchall()
        print("\nMost recent sessions:")
        for idx, (title, app, time, visits) in enumerate(sessions, 1):
            print(f"  [{idx}] {app}: {title[:50]}")
            print(f"      Time: {time}s, Visits: {visits}")
except Exception as e:
    print(f"Error reading active_sessions: {e}")

# Check app_classification table
print("\n" + "="*70)
print("2. Application Classifications")
print("="*70)

try:
    cursor.execute("SELECT COUNT(*) FROM app_classification")
    count = cursor.fetchone()[0]
    print(f"Total classifications: {count}")
    
    if count > 0:
        cursor.execute("""
            SELECT app_name, app_pattern, classification, is_private 
            FROM app_classification 
            LIMIT 10
        """)
        classifications = cursor.fetchall()
        print("\nApp classifications:")
        for app, pattern, cls, private in classifications:
            private_flag = " (PRIVATE)" if private else ""
            print(f"  • {app}: {cls}{private_flag}")
except Exception as e:
    print(f"Error reading app_classification: {e}")

# Check if there are any project_key references
print("\n" + "="*70)
print("3. Looking for 'jiraforge' in database...")
print("="*70)

found_jiraforge = False

# Check each table for any text containing "jiraforge"
for table_name in [t[0] for t in tables]:
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        # Build a query to search all text columns
        text_columns = [col[1] for col in columns if col[2] in ('TEXT', 'VARCHAR')]
        
        if text_columns:
            for col in text_columns:
                cursor.execute(f"SELECT {col}, COUNT(*) as cnt FROM {table_name} WHERE LOWER({col}) LIKE '%jiraforge%' GROUP BY {col}")
                results = cursor.fetchall()
                if results:
                    found_jiraforge = True
                    print(f"\n✅ Found 'jiraforge' in table '{table_name}', column '{col}':")
                    for value, count in results:
                        print(f"   Value: {value}")
                        print(f"   Count: {count}")
    except Exception as e:
        # Skip errors from complex queries
        pass

if not found_jiraforge:
    print("   ℹ️  No 'jiraforge' references found in local SQLite database")
    print("   This suggests the value is coming from Jira API or Supabase")

# Check offline_queue
print("\n" + "="*70)
print("4. Offline Queue (Pending uploads)")
print("="*70)

try:
    cursor.execute("SELECT COUNT(*) FROM offline_queue")
    count = cursor.fetchone()[0]
    print(f"Total pending uploads: {count}")
    
    if count > 0:
        cursor.execute("""
            SELECT operation, table_name, created_at 
            FROM offline_queue 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        queue_items = cursor.fetchall()
        print("\nRecent queue items:")
        for op, table, created in queue_items:
            print(f"  • {op} -> {table} at {created}")
        
        # Check for project_key in payload
        cursor.execute("""
            SELECT payload 
            FROM offline_queue 
            WHERE payload LIKE '%project_key%' 
            LIMIT 3
        """)
        payloads = cursor.fetchall()
        if payloads:
            print("\nPayloads with project_key:")
            for (payload,) in payloads:
                try:
                    data = json.loads(payload)
                    if isinstance(data, list):
                        for item in data[:2]:  # Show first 2 items
                            if 'project_key' in item:
                                print(f"   project_key: {item['project_key']}")
                    elif isinstance(data, dict) and 'project_key' in data:
                        print(f"   project_key: {data['project_key']}")
                except:
                    pass
except Exception as e:
    print(f"Error reading offline_queue: {e}")

conn.close()

print("\n" + "="*70)
print("✅ Database inspection complete!")
print("="*70)
print("\nIf you found 'jiraforge' in the data above:")
print("  1. It might be cached from a previous test or development setup")
print("  2. You can clear the local database by closing the app and deleting:")
print(f"     {db_path}")
print("\nIf NOT found in local database:")
print("  → The 'jiraforge' value is coming from Jira API or Supabase")
print("  → Run 'python diagnose_project_key.py' to check Jira API data")
print()
