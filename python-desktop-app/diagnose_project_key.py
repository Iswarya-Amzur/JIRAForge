"""
Diagnostic Script: Check Project Key Fetching

This script helps diagnose what project_key is being fetched from your Jira instance.
It shows:
1. Your Jira authentication status
2. Your assigned issues and their project keys
3. Your accessible projects
4. What project_key will be used in activity_records

Usage:
    python diagnose_project_key.py
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

# Add parent directory to path to import desktop_app modules
sys.path.insert(0, str(Path(__file__).parent))

from desktop_app import AtlassianAuthManager, get_env_var


def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def fetch_jira_issues(auth_manager, cloud_id):
    """Fetch user's In Progress Jira issues"""
    access_token = auth_manager.tokens.get('access_token')
    if not access_token:
        return None, "No access token"

    try:
        # Build JQL for in-progress issues
        jql = 'assignee = currentUser() AND statusCategory = "In Progress"'
        
        response = requests.post(
            f'https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search/jql',
            json={
                'jql': jql,
                'maxResults': 50,
                'fields': ['summary', 'status', 'project', 'description', 'labels']
            },
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        )

        if response.status_code == 200:
            data = response.json()
            issues = data.get('issues', [])
            
            formatted_issues = []
            for issue in issues:
                fields = issue['fields']
                formatted_issues.append({
                    'key': issue['key'],
                    'summary': fields['summary'],
                    'status': fields['status']['name'],
                    'project': fields['project']['key'],
                    'labels': fields.get('labels', [])
                })
            
            return formatted_issues, None
        else:
            return None, f"API error: {response.status_code} - {response.text[:200]}"
    except Exception as e:
        return None, str(e)


def fetch_jira_projects(auth_manager, cloud_id):
    """Fetch user's accessible Jira projects"""
    access_token = auth_manager.tokens.get('access_token')
    if not access_token:
        return None, "No access token"

    try:
        response = requests.get(
            f'https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/project/search',
            params={
                'maxResults': 50,
                'orderBy': 'name'
            },
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json'
            }
        )

        if response.status_code == 200:
            data = response.json()
            projects = data.get('values', [])
            
            formatted_projects = []
            for project in projects:
                formatted_projects.append({
                    'key': project.get('key'),
                    'name': project.get('name'),
                    'id': project.get('id')
                })
            
            return formatted_projects, None
        else:
            return None, f"API error: {response.status_code} - {response.text[:200]}"
    except Exception as e:
        return None, str(e)


def get_cloud_id(auth_manager):
    """Get Jira Cloud ID"""
    access_token = auth_manager.tokens.get('access_token')
    if not access_token:
        return None, "No access token"
    
    try:
        response = requests.get(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        if response.status_code == 200:
            resources = response.json()
            if resources and len(resources) > 0:
                return resources[0]['id'], resources[0].get('url')
            return None, "No accessible resources"
        else:
            return None, f"API error: {response.status_code}"
    except Exception as e:
        return None, str(e)


def determine_project_key(issues, projects):
    """Determine project key based on issues and projects"""
    # Priority 1: From issues
    if issues and len(issues) > 0:
        return issues[0].get('project'), 'first_issue'
    
    # Priority 2: From projects
    if projects and len(projects) > 0:
        return projects[0].get('key'), 'first_project'
    
    return None, None


def main():
    print("\n🔍 JIRAForge Project Key Diagnostic Tool")
    print("="*70)
    
    # Initialize auth manager
    try:
        auth_manager = AtlassianAuthManager(web_port=51777)
        print("✅ Auth manager initialized")
    except Exception as e:
        print(f"❌ Failed to initialize auth manager: {e}")
        return
    
    # Check authentication
    print_section("1. Authentication Status")
    if not auth_manager or not auth_manager.tokens:
        print("❌ Not authenticated. Please log in to the desktop app first.")
        return
    
    access_token = auth_manager.tokens.get('access_token')
    if not access_token:
        print("❌ No access token found. Please re-authenticate.")
        return
    
    print(f"✅ Authenticated")
    print(f"   Token present: {bool(access_token)}")
    
    # Get Cloud ID
    cloud_id, jira_url_or_error = get_cloud_id(auth_manager)
    if not cloud_id:
        print(f"❌ Failed to get Jira Cloud ID: {jira_url_or_error}")
        return
    
    print(f"   Jira Cloud ID: {cloud_id}")
    print(f"   Jira Instance: {jira_url_or_error}")
    
    # Fetch and display user's issues
    print_section("2. Your Assigned Jira Issues (In Progress)")
    print("Fetching your assigned issues from Jira...")
    
    issues, error = fetch_jira_issues(auth_manager, cloud_id)
    
    if error:
        print(f"❌ Failed to fetch issues: {error}")
        issues = []
    elif not issues or len(issues) == 0:
        print("⚠️  No issues found (or you have no assigned in-progress issues)")
        print("   This could mean:")
        print("   - You have no issues assigned to you in 'In Progress' status")
        print("   - The JQL query returned no results")
        print("   - There's a permission issue")
    else:
        print(f"✅ Found {len(issues)} issue(s):\n")
        for idx, issue in enumerate(issues, 1):
            print(f"   [{idx}] {issue.get('key')}")
            print(f"       Project: {issue.get('project')}")
            print(f"       Summary: {issue.get('summary')}")
            print(f"       Status: {issue.get('status')}")
            if issue.get('labels'):
                print(f"       Labels: {', '.join(issue.get('labels'))}")
            print()
    
    # Fetch and display accessible projects
    print_section("3. Your Accessible Jira Projects")
    print("Fetching accessible projects...")
    
    projects, error = fetch_jira_projects(auth_manager, cloud_id)
    
    if error:
        print(f"❌ Failed to fetch projects: {error}")
        projects = []
    elif not projects or len(projects) == 0:
        print("⚠️  No accessible projects found")
    else:
        print(f"✅ Found {len(projects)} project(s):\n")
        for idx, project in enumerate(projects, 1):
            print(f"   [{idx}] {project.get('key')} - {project.get('name')}")
    
    # Determine what project_key will be used
    print_section("4. Project Key Selection")
    
    project_key, source = determine_project_key(issues, projects)
    
    if project_key:
        print(f"✅ Project key that will be used: {project_key}")
        print(f"\n   This value comes from:")
        if source == 'first_issue':
            print(f"   → Your first assigned issue ({issues[0].get('key')})")
        elif source == 'first_project':
            print(f"   → Your first accessible project")
    else:
        print("⚠️  No project key available")
        print("   This means:")
        print("   - You have no assigned issues")
        print("   - You have no accessible projects")
        print("   - The activity_records will have NULL project_key")
    
    # Summary
    print_section("Summary")
    if project_key:
        print(f"✅ Your activity_records will use project_key: '{project_key}'")
        
        if project_key.lower() == 'jiraforge':
            print(f"\n⚠️  WARNING: The project key is 'jiraforge'")
            print(f"   This suggests you have a Jira project named 'JIRAForge' or 'jiraforge'")
            print(f"   in your Jira instance.")
            print(f"\n   If this is NOT expected:")
            print(f"   1. Check your Jira instance for a project with key 'JIRAFORGE'")
            print(f"   2. The issue shown above should reveal which project it belongs to")
            print(f"   3. You may need to assign yourself to issues in a different project")
    else:
        print("⚠️  No project key will be stored in activity_records")
    
    print("\n" + "="*70)
    print("✅ Diagnostic complete!\n")


if __name__ == "__main__":
    main()
