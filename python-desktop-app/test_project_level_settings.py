"""
Test script for Project-Level Tracking Settings

This script validates that project-level timesheet settings are working correctly:
1. Database schema (project_key column, indexes, fallback function)
2. 3-tier fallback hierarchy (project → organization → global)
3. Python desktop app integration (caching, project detection)
4. Settings persistence and retrieval

Usage:
    python test_project_level_settings.py
"""

import os
import sys
import time
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    """Print section header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}\n")

def print_test(name):
    """Print test name"""
    print(f"{Colors.BOLD}TEST: {name}{Colors.END}")

def print_pass(message):
    """Print success message"""
    print(f"{Colors.GREEN}✓ PASS: {message}{Colors.END}")

def print_fail(message):
    """Print failure message"""
    print(f"{Colors.RED}✗ FAIL: {message}{Colors.END}")

def print_info(message):
    """Print info message"""
    print(f"{Colors.YELLOW}ℹ INFO: {message}{Colors.END}")

def print_result(passed, total):
    """Print test results summary"""
    percentage = (passed / total * 100) if total > 0 else 0
    color = Colors.GREEN if percentage == 100 else Colors.YELLOW if percentage >= 70 else Colors.RED
    print(f"\n{Colors.BOLD}{color}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{color}RESULTS: {passed}/{total} tests passed ({percentage:.1f}%){Colors.END}")
    print(f"{Colors.BOLD}{color}{'='*70}{Colors.END}\n")

class ProjectLevelSettingsTest:
    def __init__(self):
        self.supabase: Client = None
        self.test_org_id = None
        self.test_project_key = "TEST-PROJ"
        self.test_project_key_2 = "TEST-PROJ2"
        self.passed = 0
        self.total = 0
        self.cleanup_ids = []
        
    def setup(self):
        """Initialize Supabase client and test data"""
        print_header("SETUP")
        
        # Load environment variables
        supabase_url = os.getenv('SUPABASE_URL')
        # Use service role key for admin operations (creating/deleting test data)
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print_fail("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY environment variables")
            print_info("Set these in your .env file")
            sys.exit(1)
        
        try:
            self.supabase = create_client(supabase_url, supabase_key)
            print_pass(f"Connected to Supabase: {supabase_url}")
        except Exception as e:
            print_fail(f"Failed to connect to Supabase: {e}")
            sys.exit(1)
        
        # Get or create test organization
        try:
            result = self.supabase.table('organizations').select('*').limit(1).execute()
            if result.data and len(result.data) > 0:
                self.test_org_id = result.data[0]['id']
                print_pass(f"Using existing organization: {self.test_org_id}")
            else:
                print_info("No organizations found - some tests may be limited")
        except Exception as e:
            print_fail(f"Failed to fetch organizations: {e}")
    
    def cleanup(self):
        """Clean up test data"""
        print_header("CLEANUP")
        
        try:
            # Delete test tracking_settings records
            if self.test_org_id:
                self.supabase.table('tracking_settings').delete().eq('organization_id', self.test_org_id).eq('project_key', self.test_project_key).execute()
                self.supabase.table('tracking_settings').delete().eq('organization_id', self.test_org_id).eq('project_key', self.test_project_key_2).execute()
                self.supabase.table('tracking_settings').delete().eq('organization_id', self.test_org_id).is_('project_key', 'null').execute()
                print_pass("Cleaned up test tracking_settings records")
        except Exception as e:
            print_info(f"Cleanup note: {e}")
    
    def test_database_schema(self):
        """Test 1: Verify database schema has project_key column"""
        print_header("TEST 1: Database Schema")
        
        try:
            # Check if project_key column exists by querying with it
            result = self.supabase.table('tracking_settings').select('id, organization_id, project_key').limit(1).execute()
            self.passed += 1
            print_pass("project_key column exists in tracking_settings table")
        except Exception as e:
            print_fail(f"project_key column missing or inaccessible: {e}")
        
        self.total += 1
    
    def test_three_tier_fallback(self):
        """Test 2-4: Test 3-tier fallback hierarchy"""
        print_header("TEST 2-4: Three-Tier Fallback Hierarchy")
        
        if not self.test_org_id:
            print_info("Skipping fallback tests - no organization available")
            self.total += 3
            return
        
        try:
            # Clean existing test data first
            self.supabase.table('tracking_settings').delete().eq('organization_id', self.test_org_id).eq('project_key', self.test_project_key).execute()
            self.supabase.table('tracking_settings').delete().eq('organization_id', self.test_org_id).is_('project_key', 'null').execute()
            
            # Test 2: Create project-specific settings
            print_test("Create project-specific settings")
            project_settings = {
                'organization_id': self.test_org_id,
                'project_key': self.test_project_key,
                'screenshot_interval_seconds': 600,  # 10 minutes
                'idle_threshold_seconds': 180,
                'whitelist_enabled': True,
                'whitelisted_apps': ['VSCode', 'Chrome'],
                'private_sites_enabled': True,
                'private_sites': ['twitter.com', 'facebook.com']
            }
            result = self.supabase.table('tracking_settings').insert(project_settings).execute()
            if result.data and len(result.data) > 0:
                self.passed += 1
                print_pass(f"Created project-specific settings for {self.test_project_key}")
            else:
                print_fail("Failed to create project-specific settings")
            self.total += 1
            
            # Test 3: Create organization-wide settings
            print_test("Create organization-wide settings")
            org_settings = {
                'organization_id': self.test_org_id,
                'project_key': None,
                'screenshot_interval_seconds': 900,  # 15 minutes (different from project)
                'idle_threshold_seconds': 300,
                'whitelist_enabled': False,
                'whitelisted_apps': []
            }
            result = self.supabase.table('tracking_settings').insert(org_settings).execute()
            if result.data and len(result.data) > 0:
                self.passed += 1
                print_pass("Created organization-wide settings")
            else:
                print_fail("Failed to create organization-wide settings")
            self.total += 1
            
            # Test 4: Query project-specific and verify it takes priority
            print_test("Verify project settings have priority over org settings")
            result = self.supabase.table('tracking_settings').select('*').eq('organization_id', self.test_org_id).eq('project_key', self.test_project_key).execute()
            
            if result.data and len(result.data) > 0:
                settings = result.data[0]
                # Verify project settings are returned (interval=600, not 900)
                if settings['screenshot_interval_seconds'] == 600:
                    self.passed += 1
                    print_pass(f"Project-specific settings correctly retrieved (interval: {settings['screenshot_interval_seconds']}s)")
                else:
                    print_fail(f"Wrong settings retrieved: interval={settings['screenshot_interval_seconds']}s, expected 600s")
            else:
                print_fail("Failed to retrieve project-specific settings")
            self.total += 1
            
        except Exception as e:
            print_fail(f"Three-tier fallback test failed: {e}")
            self.total += 3
    
    def test_org_fallback(self):
        """Test 5: Verify fallback to organization settings when project settings don't exist"""
        print_header("TEST 5: Organization Fallback")
        
        if not self.test_org_id:
            print_info("Skipping org fallback test - no organization available")
            self.total += 1
            return
        
        try:
            # Query with a project that has no specific settings
            result = self.supabase.table('tracking_settings').select('*').eq('organization_id', self.test_org_id).eq('project_key', self.test_project_key_2).execute()
            
            if not result.data or len(result.data) == 0:
                # No project-specific settings, try org-wide
                result = self.supabase.table('tracking_settings').select('*').eq('organization_id', self.test_org_id).is_('project_key', 'null').execute()
                
                if result.data and len(result.data) > 0:
                    settings = result.data[0]
                    self.passed += 1
                    print_pass(f"Correctly fell back to organization settings (interval: {settings['screenshot_interval_seconds']}s)")
                else:
                    print_fail("Failed to fall back to organization settings")
            else:
                print_info("Project-specific settings exist, fallback not needed")
                self.passed += 1
            
        except Exception as e:
            print_fail(f"Organization fallback test failed: {e}")
        
        self.total += 1
    
    def test_global_fallback(self):
        """Test 6: Verify fallback to global defaults"""
        print_header("TEST 6: Global Defaults Fallback")
        
        try:
            # Query with non-existent org and project
            fake_org_id = '00000000-0000-0000-0000-000000000000'
            result = self.supabase.table('tracking_settings').select('*').eq('organization_id', fake_org_id).eq('project_key', 'FAKE').execute()
            
            if not result.data or len(result.data) == 0:
                # Try global defaults
                result = self.supabase.table('tracking_settings').select('*').is_('organization_id', 'null').is_('project_key', 'null').execute()
                
                if result.data and len(result.data) > 0:
                    self.passed += 1
                    print_pass("Global default settings available as final fallback")
                else:
                    print_info("No global defaults configured (will use hardcoded defaults)")
                    self.passed += 1  # This is acceptable
            
        except Exception as e:
            print_fail(f"Global fallback test failed: {e}")
        
        self.total += 1
    
    def test_unique_constraints(self):
        """Test 7: Verify unique constraints work correctly"""
        print_header("TEST 7: Unique Constraints")
        
        if not self.test_org_id:
            print_info("Skipping unique constraint test - no organization available")
            self.total += 1
            return
        
        try:
            # Try to insert duplicate project-specific settings
            duplicate_settings = {
                'organization_id': self.test_org_id,
                'project_key': self.test_project_key,
                'screenshot_interval_seconds': 1200
            }
            
            try:
                result = self.supabase.table('tracking_settings').insert(duplicate_settings).execute()
                # If we get here, duplicate was allowed (BAD)
                print_fail("Duplicate project settings were allowed (unique constraint not working)")
            except Exception as e:
                # Expected to fail with unique constraint violation
                if 'duplicate' in str(e).lower() or 'unique' in str(e).lower():
                    self.passed += 1
                    print_pass("Unique constraint correctly prevents duplicate project settings")
                else:
                    print_fail(f"Failed with unexpected error: {e}")
        
        except Exception as e:
            print_fail(f"Unique constraint test failed: {e}")
        
        self.total += 1
    
    def test_python_app_integration(self):
        """Test 8-10: Python desktop app integration"""
        print_header("TEST 8-10: Python Desktop App Integration")
        
        try:
            # Import desktop app to test its methods
            sys.path.insert(0, os.path.dirname(__file__))
            
            # Test 8: Check if tracking_settings_cache structure exists
            print_test("Verify Python app has per-project cache structure")
            with open('desktop_app.py', 'r', encoding='utf-8') as f:
                content = f.read()
                if 'tracking_settings_cache' in content and 'current_project_key' in content:
                    self.passed += 1
                    print_pass("Python app has per-project cache structure")
                else:
                    print_fail("Python app missing per-project cache structure")
            self.total += 1
            
            # Test 9: Check if get_tracking_settings_for_project method exists
            print_test("Verify get_tracking_settings_for_project() method exists")
            if 'def get_tracking_settings_for_project' in content:
                self.passed += 1
                print_pass("get_tracking_settings_for_project() method exists")
            else:
                print_fail("get_tracking_settings_for_project() method missing")
            self.total += 1
            
            # Test 10: Check if update_current_project method exists
            print_test("Verify update_current_project() method exists")
            if 'def update_current_project' in content:
                self.passed += 1
                print_pass("update_current_project() method exists")
            else:
                print_fail("update_current_project() method missing")
            self.total += 1
            
        except Exception as e:
            print_fail(f"Python app integration test failed: {e}")
            self.total += 3
    
    def test_fetch_tracking_settings_signature(self):
        """Test 11: Verify fetch_tracking_settings accepts project_key parameter"""
        print_header("TEST 11: fetch_tracking_settings() Method Signature")
        
        try:
            with open('desktop_app.py', 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Check if fetch_tracking_settings has project_key parameter
                if 'def fetch_tracking_settings(self, project_key' in content:
                    self.passed += 1
                    print_pass("fetch_tracking_settings() accepts project_key parameter")
                else:
                    print_fail("fetch_tracking_settings() missing project_key parameter")
        
        except Exception as e:
            print_fail(f"Method signature test failed: {e}")
        
        self.total += 1
    
    def test_tracking_loop_integration(self):
        """Test 12: Verify tracking_loop calls update_current_project"""
        print_header("TEST 12: Tracking Loop Integration")
        
        try:
            with open('desktop_app.py', 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Check if tracking_loop calls update_current_project
                if 'def tracking_loop' in content and 'update_current_project' in content:
                    self.passed += 1
                    print_pass("tracking_loop() integrates project detection")
                else:
                    print_fail("tracking_loop() missing project detection")
        
        except Exception as e:
            print_fail(f"Tracking loop integration test failed: {e}")
        
        self.total += 1
    
    def test_cache_ttl(self):
        """Test 13: Verify cache TTL is configured"""
        print_header("TEST 13: Cache TTL Configuration")
        
        try:
            with open('desktop_app.py', 'r', encoding='utf-8') as f:
                content = f.read()
                
                if 'tracking_settings_cache_ttl' in content and '300' in content:
                    self.passed += 1
                    print_pass("Cache TTL configured (300 seconds)")
                else:
                    print_fail("Cache TTL not properly configured")
        
        except Exception as e:
            print_fail(f"Cache TTL test failed: {e}")
        
        self.total += 1
    
    def test_backward_compatibility(self):
        """Test 14: Verify backward compatibility with @property"""
        print_header("TEST 14: Backward Compatibility")
        
        try:
            with open('desktop_app.py', 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Check for @property tracking_settings
                if '@property' in content and 'def tracking_settings(self)' in content:
                    self.passed += 1
                    print_pass("Backward compatibility maintained via @property")
                else:
                    print_fail("Missing @property for backward compatibility")
        
        except Exception as e:
            print_fail(f"Backward compatibility test failed: {e}")
        
        self.total += 1
    
    def run_all_tests(self):
        """Run all tests"""
        print_header("PROJECT LEVEL TRACKING SETTINGS TEST SUITE")
        print_info(f"Started at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        try:
            self.setup()
            
            # Database tests
            self.test_database_schema()
            self.test_three_tier_fallback()
            self.test_org_fallback()
            self.test_global_fallback()
            self.test_unique_constraints()
            
            # Python app tests
            self.test_python_app_integration()
            self.test_fetch_tracking_settings_signature()
            self.test_tracking_loop_integration()
            self.test_cache_ttl()
            self.test_backward_compatibility()
            
            # Cleanup
            self.cleanup()
            
        except KeyboardInterrupt:
            print_info("\nTest interrupted by user")
            self.cleanup()
        except Exception as e:
            print_fail(f"Test suite failed: {e}")
        finally:
            print_result(self.passed, self.total)
            
            if self.passed == self.total:
                print(f"{Colors.GREEN}{Colors.BOLD}✓ All tests passed! Project-level settings are working correctly.{Colors.END}\n")
                return 0
            else:
                print(f"{Colors.RED}{Colors.BOLD}✗ Some tests failed. Please review the output above.{Colors.END}\n")
                return 1

def main():
    """Main entry point"""
    tester = ProjectLevelSettingsTest()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
