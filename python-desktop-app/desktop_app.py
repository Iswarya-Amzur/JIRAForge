"""
BRD Time Tracker - Python Desktop Application
Desktop app for automatic time tracking via screenshot capture with Atlassian OAuth
"""

import os
import sys
import time
import json
import threading
import webbrowser
import tempfile
import traceback
import urllib.parse
import secrets
import hashlib
import base64
from datetime import datetime, timezone
from io import BytesIO

# Core dependencies
from PIL import Image, ImageGrab, ImageDraw
import psutil
import requests
from flask import Flask, render_template_string, jsonify, request, session, redirect, url_for
from flask_cors import CORS
import pystray
from pystray import MenuItem as item
from PIL import Image as PILImage

# Supabase
from supabase import create_client, Client
from dotenv import load_dotenv

# Windows-specific imports
try:
    import win32gui
    import win32process
    import win32con
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

# Note: AI analysis is now handled by the separate AI server
# Desktop app only captures and uploads screenshots to Supabase

# Load environment variables
load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

def get_env_var(key, default=None):
    """Get environment variable with fallback to embedded values"""
    value = os.getenv(key, default)
    return value

# ============================================================================
# ATLASSIAN OAUTH MANAGER
# ============================================================================

class AtlassianAuthManager:
    """Manages Atlassian OAuth 3LO flow"""
    
    def __init__(self, web_port=7777, store_path=None):
        self.client_id = get_env_var('ATLASSIAN_CLIENT_ID', '')
        self.client_secret = get_env_var('ATLASSIAN_CLIENT_SECRET', '')
        self.redirect_uri = f'http://localhost:{web_port}/auth/callback'
        self.authorization_url = 'https://auth.atlassian.com/authorize'
        self.token_url = 'https://auth.atlassian.com/oauth/token'
        self.store_path = store_path or os.path.join(tempfile.gettempdir(), 'brd_tracker_auth.json')
        self.tokens = self._load_tokens()
        
    def _load_tokens(self):
        """Load stored tokens from file"""
        try:
            if os.path.exists(self.store_path):
                with open(self.store_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load tokens: {e}")
        return {}
    
    def _save_tokens(self):
        """Save tokens to file"""
        try:
            with open(self.store_path, 'w') as f:
                json.dump(self.tokens, f)
        except Exception as e:
            print(f"[WARN] Failed to save tokens: {e}")
    
    def get_auth_url(self):
        """Generate Atlassian OAuth authorization URL"""
        if not self.client_id:
            raise ValueError("ATLASSIAN_CLIENT_ID not configured")
        
        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)
        self.tokens['oauth_state'] = state
        self._save_tokens()
        
        params = {
            'audience': 'api.atlassian.com',
            'client_id': self.client_id,
            'scope': 'read:me read:jira-work write:jira-work offline_access',
            'redirect_uri': self.redirect_uri,
            'state': state,
            'response_type': 'code',
            'prompt': 'consent'
        }
        
        auth_url = f"{self.authorization_url}?{urllib.parse.urlencode(params)}"
        return auth_url
    
    def handle_callback(self, code, state):
        """Handle OAuth callback and exchange code for tokens"""
        # Verify state
        stored_state = self.tokens.get('oauth_state')
        if state != stored_state:
            raise ValueError("Invalid state parameter - possible CSRF attack")
        
        # Exchange code for tokens
        response = requests.post(
            self.token_url,
            json={
                'grant_type': 'authorization_code',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': code,
                'redirect_uri': self.redirect_uri
            },
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code != 200:
            error = response.json().get('error_description', response.text)
            raise Exception(f"Token exchange failed: {error}")
        
        tokens = response.json()
        self.tokens.update({
            'access_token': tokens.get('access_token'),
            'refresh_token': tokens.get('refresh_token'),
            'expires_at': time.time() + tokens.get('expires_in', 3600)
        })
        self._save_tokens()
        
        return tokens
    
    def get_user_info(self):
        """Get Atlassian user information with automatic token refresh on 401"""
        access_token = self.tokens.get('access_token')
        if not access_token:
            return None

        response = requests.get(
            'https://api.atlassian.com/me',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/json'
            }
        )

        # Handle 401 - token expired
        if response.status_code == 401:
            print("[WARN] Access token expired (401) in get_user_info, attempting refresh...")
            if self.refresh_access_token():
                # Retry with new token
                access_token = self.tokens.get('access_token')
                response = requests.get(
                    'https://api.atlassian.com/me',
                    headers={
                        'Authorization': f'Bearer {access_token}',
                        'Accept': 'application/json'
                    }
                )
            else:
                print("[ERROR] Token refresh failed in get_user_info")
                return None

        if response.status_code == 200:
            return response.json()
        return None
    
    def refresh_access_token(self):
        """Refresh access token using refresh token"""
        refresh_token = self.tokens.get('refresh_token')
        if not refresh_token:
            print("[ERROR] No refresh token available")
            return False

        print("[INFO] Refreshing access token...")
        try:
            response = requests.post(
                self.token_url,
                json={
                    'grant_type': 'refresh_token',
                    'client_id': self.client_id,
                    'client_secret': self.client_secret,
                    'refresh_token': refresh_token
                },
                headers={'Content-Type': 'application/json'}
            )

            if response.status_code != 200:
                error = response.json().get('error_description', response.text)
                print(f"[ERROR] Token refresh failed: {error}")
                return False

            tokens = response.json()
            self.tokens.update({
                'access_token': tokens.get('access_token'),
                'refresh_token': tokens.get('refresh_token', refresh_token),  # Use new refresh token if provided, otherwise keep old one
                'expires_at': time.time() + tokens.get('expires_in', 3600)
            })
            self._save_tokens()

            print("[OK] Access token refreshed successfully")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to refresh access token: {e}")
            return False

    def is_authenticated(self):
        """Check if user is authenticated"""
        return bool(self.tokens.get('access_token'))

    def logout(self):
        """Clear authentication tokens"""
        self.tokens = {}
        if os.path.exists(self.store_path):
            os.remove(self.store_path)

# ============================================================================
# MAIN APPLICATION
# ============================================================================

class BRDTimeTracker:
    """Main application class"""
    
    def __init__(self):
        print("[INFO] Initializing BRD Time Tracker...")
        
        # Configuration
        self.capture_interval = int(get_env_var('CAPTURE_INTERVAL', 300))
        self.web_port = int(get_env_var('WEB_PORT', 7777))
        
        # Initialize Supabase
        supabase_url = get_env_var('SUPABASE_URL')
        supabase_anon_key = get_env_var('SUPABASE_ANON_KEY')
        supabase_service_key = get_env_var('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_anon_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
        
        self.supabase: Client = create_client(supabase_url, supabase_anon_key)
        
        if supabase_service_key:
            self.supabase_service: Client = create_client(supabase_url, supabase_service_key)
            print("[OK] Supabase service role client initialized")
        else:
            self.supabase_service = None
            print("[WARN] SUPABASE_SERVICE_ROLE_KEY not set - storage operations may fail due to RLS")
        
        # Initialize Atlassian Auth
        self.auth_manager = AtlassianAuthManager(web_port=self.web_port)
        
        # User state
        self.current_user = None
        self.current_user_id = None  # UUID from public.users table
        
        # Tracking state
        self.running = False
        self.tracking_active = False
        self.is_idle = False  # Idle state - when no activity for idle_timeout seconds
        self.last_activity_time = time.time()  # Last mouse/keyboard activity
        self.idle_timeout = 300  # 5 minutes idle timeout (in seconds)
        self._tracking_thread = None
        self._activity_monitor_thread = None  # Activity monitoring thread
        self.screenshot_hash = None
        
        # Jira issue caching
        self.user_issues = []  # Cache of user's In Progress Jira issues
        self.issues_cache_time = None  # Last time issues were fetched
        self.issues_cache_ttl = 300  # 5 minutes cache TTL
        self.jira_cloud_id = None  # Cached Jira cloud ID
        
        # AI analysis is handled by the separate AI server
        # Desktop app only captures and uploads screenshots
        
        # Flask app
        self.app = Flask(__name__)
        self.app.secret_key = secrets.token_hex(16)
        CORS(self.app)
        
        # System tray
        self.tray = None
        
        # Setup routes
        self.setup_routes()
        
        print("[OK] Application initialized")
    
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/')
        def index():
            if self.current_user:
                return redirect('/dashboard')
            return redirect('/login')
        
        @self.app.route('/login')
        def login():
            if self.current_user:
                return redirect('/dashboard')
            return self.render_login_page()
        
        @self.app.route('/auth/atlassian')
        def auth_atlassian():
            """Start Atlassian OAuth flow"""
            try:
                auth_url = self.auth_manager.get_auth_url()
                print(f"[OK] Redirecting to Atlassian OAuth: {auth_url[:80]}...")
                return redirect(auth_url)
            except Exception as e:
                return f"OAuth error: {str(e)}", 500
        
        @self.app.route('/auth/callback')
        def auth_callback():
            """Handle OAuth callback"""
            error = request.args.get('error')
            if error:
                return f"Authentication failed: {error}", 400
            
            code = request.args.get('code')
            state = request.args.get('state')
            
            if not code:
                return "Authentication failed: no code", 400
            
            try:
                # Exchange code for tokens
                tokens = self.auth_manager.handle_callback(code, state)
                
                # Get user info from Atlassian
                user_info = self.auth_manager.get_user_info()
                if not user_info:
                    return "Failed to get user information", 500
                
                # Create or update user in Supabase
                self.current_user = user_info
                self.current_user_id = self.ensure_user_exists(user_info)
                
                print(f"[OK] Authenticated user: {user_info.get('email', 'unknown')}")
                
                # Update tray icon to blue (logged in, tracking not started yet)
                self.update_tray_icon()
                
                # Start tracking if not already running
                if not self.running:
                    self.start_tracking()
                
                return redirect('/success')
                
            except Exception as e:
                print(f"[ERROR] Auth callback failed: {e}")
                traceback.print_exc()
                return f"Authentication failed: {str(e)}", 500
        
        @self.app.route('/success')
        def success():
            return self.render_success_page()
        
        @self.app.route('/dashboard')
        def dashboard():
            if not self.current_user:
                return redirect('/login')
            return self.render_dashboard()
        
        @self.app.route('/api/status')
        def api_status():
            return jsonify({
                'authenticated': self.current_user is not None,
                'tracking': self.tracking_active,
                'user': self.current_user.get('email') if self.current_user else None
            })
        
        @self.app.route('/api/screenshots')
        def api_screenshots():
            if not self.current_user_id:
                return jsonify({'error': 'Not authenticated'}), 401
            
            try:
                # Use service client to bypass RLS for querying
                client = self.supabase_service if self.supabase_service else self.supabase
                result = client.table('screenshots').select('*').eq(
                    'user_id', self.current_user_id
                ).order('timestamp', desc=True).limit(50).execute()
                
                # Generate proxy URLs for private storage images
                screenshots = []
                for screenshot in result.data:
                    # Use proxy endpoint for thumbnails and full images
                    storage_path = screenshot.get('storage_path', '')
                    if storage_path:
                        # Get thumbnail path - extract directory and filename
                        # Format: user_id/screenshot_timestamp.png -> user_id/thumb_timestamp.jpg
                        if '/' in storage_path:
                            dir_path, filename = storage_path.rsplit('/', 1)
                            thumb_filename = filename.replace('screenshot_', 'thumb_').replace('.png', '.jpg')
                            thumb_path = f'{dir_path}/{thumb_filename}'
                        else:
                            thumb_path = storage_path.replace('screenshot_', 'thumb_').replace('.png', '.jpg')
                        
                        # Use proxy endpoint for thumbnail
                        screenshot['thumbnail_url'] = f'/api/screenshot/{thumb_path}'
                        
                        # Also provide proxy URL for full image
                        screenshot['proxy_url'] = f'/api/screenshot/{storage_path}'
                    
                    screenshots.append(screenshot)
                
                return jsonify(screenshots)
            except Exception as e:
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/screenshot/<path:file_path>')
        def serve_screenshot(file_path):
            """Proxy endpoint to serve screenshots from private storage"""
            if not self.current_user_id:
                return jsonify({'error': 'Not authenticated'}), 401
            
            try:
                # Verify the file belongs to the current user
                if not file_path.startswith(f"{self.current_user_id}/"):
                    return jsonify({'error': 'Unauthorized'}), 403
                
                # Use service client to get file
                client = self.supabase_service if self.supabase_service else self.supabase
                
                # Download file from storage
                file_response = client.storage.from_('screenshots').download(file_path)
                
                if file_response:
                    # Determine content type
                    content_type = 'image/png'
                    if file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                        content_type = 'image/jpeg'
                    
                    # Handle different response types from Supabase
                    file_data = file_response
                    if hasattr(file_response, 'read'):
                        file_data = file_response.read()
                    elif isinstance(file_response, dict):
                        # Supabase might return dict with 'data' key
                        file_data = file_response.get('data', file_response)
                    elif not isinstance(file_response, (bytes, bytearray)):
                        try:
                            file_data = bytes(file_response)
                        except:
                            file_data = str(file_response).encode()
                    
                    from flask import Response
                    return Response(file_data, mimetype=content_type)
                else:
                    return jsonify({'error': 'File not found'}), 404
            except Exception as e:
                print(f"[ERROR] Error serving screenshot: {e}")
                return jsonify({'error': str(e)}), 500
    
    def ensure_user_exists(self, atlassian_user):
        """Ensure user exists in Supabase users table"""
        account_id = atlassian_user.get('account_id')
        email = atlassian_user.get('email')
        name = atlassian_user.get('name', email.split('@')[0] if email else 'User')
        
        if not account_id:
            raise ValueError("No account_id in Atlassian user info")
        
        # Use service client to bypass RLS
        client = self.supabase_service if self.supabase_service else self.supabase
        
        # Check if user exists
        result = client.table('users').select('id').eq(
            'atlassian_account_id', account_id
        ).execute()
        
        if result.data:
            user_id = result.data[0]['id']
            print(f"[OK] Found existing user: {user_id}")
        else:
            # Create new user
            user_data = {
                'atlassian_account_id': account_id,
                'email': email,
                'display_name': name
            }
            create_result = client.table('users').insert(user_data).execute()
            if create_result.data:
                user_id = create_result.data[0]['id']
                print(f"[OK] Created new user: {user_id}")
            else:
                raise Exception("Failed to create user")
        
        return user_id
    
    def get_jira_cloud_id(self):
        """Get Jira cloud ID for API calls with automatic token refresh on 401"""
        if self.jira_cloud_id:
            return self.jira_cloud_id

        access_token = self.auth_manager.tokens.get('access_token')
        if not access_token:
            print("[WARN] No access token found for Jira Cloud ID fetch")
            return None

        try:
            print("[INFO] Fetching Jira Cloud ID...")
            response = requests.get(
                'https://api.atlassian.com/oauth/token/accessible-resources',
                headers={'Authorization': f'Bearer {access_token}'}
            )

            # Handle 401 - token expired
            if response.status_code == 401:
                print("[WARN] Access token expired (401), attempting refresh...")
                if self.auth_manager.refresh_access_token():
                    # Retry with new token
                    access_token = self.auth_manager.tokens.get('access_token')
                    response = requests.get(
                        'https://api.atlassian.com/oauth/token/accessible-resources',
                        headers={'Authorization': f'Bearer {access_token}'}
                    )
                else:
                    print("[ERROR] Token refresh failed, please re-authenticate")
                    return None

            if response.status_code == 200:
                resources = response.json()
                print(f"[INFO] Found {len(resources)} accessible resources")
                if resources:
                    self.jira_cloud_id = resources[0]['id']
                    print(f"[OK] Using Jira Cloud ID: {self.jira_cloud_id}")
                    return self.jira_cloud_id
            else:
                print(f"[ERROR] Failed to get resources: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[ERROR] Failed to get Jira cloud ID: {e}")

        return None

    def fetch_jira_issues(self):
        """Fetch user's In Progress Jira issues with automatic token refresh on 401"""
        print("[INFO] Attempting to fetch Jira issues...")
        cloud_id = self.get_jira_cloud_id()
        if not cloud_id:
            print("[WARN] Cannot fetch issues: No Cloud ID")
            return []

        access_token = self.auth_manager.tokens.get('access_token')
        if not access_token:
            print("[WARN] Cannot fetch issues: No access token")
            return []

        try:
            jql = 'assignee = currentUser() AND status = "In Progress"'
            print(f"[INFO] Querying Jira with JQL (POST): {jql}")

            # Use /search/jql endpoint as requested by the 410 error message
            # Note: The error explicitly said "Please migrate to the /rest/api/3/search/jql API"
            response = requests.post(
                f'https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search/jql',
                json={
                    'jql': jql,
                    'maxResults': 50,
                    'fields': ['summary', 'status', 'project']
                },
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            )

            # Handle 401 - token expired
            if response.status_code == 401:
                print("[WARN] Access token expired (401), attempting refresh...")
                if self.auth_manager.refresh_access_token():
                    # Retry with new token
                    access_token = self.auth_manager.tokens.get('access_token')
                    print("[INFO] Retrying Jira API with refreshed token...")
                    response = requests.post(
                        f'https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3/search/jql',
                        json={
                            'jql': jql,
                            'maxResults': 50,
                            'fields': ['summary', 'status', 'project']
                        },
                        headers={
                            'Authorization': f'Bearer {access_token}',
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    )
                else:
                    print("[ERROR] Token refresh failed, please re-authenticate")
                    return []

            if response.status_code == 200:
                data = response.json()
                issues = data.get('issues', [])
                print(f"[OK] Jira API returned {len(issues)} issues")
                return [{
                    'key': issue['key'],
                    'summary': issue['fields']['summary'],
                    'status': issue['fields']['status']['name'],
                    'project': issue['fields']['project']['key']
                } for issue in issues]
            else:
                print(f"[ERROR] Jira API failed: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[ERROR] Failed to fetch Jira issues: {e}")

        return []

    def should_refresh_issues_cache(self):
        """Check if issues cache needs to be refreshed"""
        if not self.issues_cache_time:
            return True
        
        return (time.time() - self.issues_cache_time) > self.issues_cache_ttl
    
    def capture_screenshot(self):
        """Capture screenshot and return PIL Image"""
        try:
            screenshot = ImageGrab.grab()
            screenshot_bytes = screenshot.tobytes()
            current_hash = hashlib.md5(screenshot_bytes).hexdigest()
            
            # Skip if unchanged
            if current_hash == self.screenshot_hash:
                return None
            
            self.screenshot_hash = current_hash
            return screenshot
        except Exception as e:
            print(f"[ERROR] Screenshot capture failed: {e}")
            return None
    
    def get_active_window(self):
        """Get active window information"""
        if not WIN32_AVAILABLE:
            return {'title': 'Unknown', 'app': 'Unknown'}
        
        try:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
            
            # Get process name
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process = psutil.Process(pid)
            app_name = process.name()
            
            return {'title': title, 'app': app_name}
        except Exception as e:
            print(f"[WARN] Failed to get window info: {e}")
            return {'title': 'Unknown', 'app': 'Unknown'}
    
    def upload_screenshot(self, screenshot, window_info):
        """Upload screenshot to Supabase"""
        if not self.current_user_id:
            return
        
        # Use service role client for storage operations (bypasses RLS)
        # Since we're using Atlassian OAuth, not Supabase Auth, we need service role
        storage_client = self.supabase_service if self.supabase_service else self.supabase
        
        try:
            # Convert screenshot to bytes
            img_buffer = BytesIO()
            screenshot.save(img_buffer, format='PNG')
            img_bytes = img_buffer.getvalue()
            
            # Create thumbnail
            thumbnail = screenshot.copy()
            thumbnail.thumbnail((400, 300))
            thumb_buffer = BytesIO()
            thumbnail.save(thumb_buffer, format='JPEG', quality=70)
            thumb_bytes = thumb_buffer.getvalue()
            
            # Generate filenames
            timestamp = datetime.now(timezone.utc)
            filename = f"screenshot_{int(timestamp.timestamp())}.png"
            thumb_filename = f"thumb_{int(timestamp.timestamp())}.jpg"
            
            storage_path = f"{self.current_user_id}/{filename}"
            thumb_path = f"{self.current_user_id}/{thumb_filename}"
            
            # Upload to Supabase Storage using service role client
            screenshot_result = storage_client.storage.from_('screenshots').upload(
                storage_path, img_bytes, file_options={'content-type': 'image/png'}
            )
            
            if screenshot_result:
                # Get public URL
                screenshot_url = storage_client.storage.from_('screenshots').get_public_url(storage_path)
                
                # Upload thumbnail
                thumb_result = storage_client.storage.from_('screenshots').upload(
                    thumb_path, thumb_bytes, file_options={'content-type': 'image/jpeg'}
                )
                
                thumb_url = None
                if thumb_result:
                    thumb_url = storage_client.storage.from_('screenshots').get_public_url(thumb_path)
                
                # Refresh issues cache if needed
                if self.should_refresh_issues_cache():
                    self.user_issues = self.fetch_jira_issues()
                    self.issues_cache_time = time.time()
                    if self.user_issues:
                        print(f"[OK] Fetched {len(self.user_issues)} In Progress issues")

                # Save metadata to database (use service client to bypass RLS)
                screenshot_data = {
                    'user_id': self.current_user_id,
                    'timestamp': timestamp.isoformat(),
                    'storage_url': screenshot_url,
                    'storage_path': storage_path,
                    'thumbnail_url': thumb_url,
                    'window_title': window_info['title'],
                    'application_name': window_info['app'],
                    'file_size_bytes': len(img_bytes),
                    'status': 'pending',
                    'user_assigned_issues': self.user_issues
                }
                
                # Use service client for database insert to bypass RLS
                db_client = self.supabase_service if self.supabase_service else self.supabase
                result = db_client.table('screenshots').insert(screenshot_data).execute()
                
                if result.data:
                    screenshot_id = result.data[0]['id']
                    print(f"[OK] Screenshot uploaded and saved to database:")
                    print(f"     - File: {filename}")
                    print(f"     - Database ID: {screenshot_id}")
                    print(f"     - Storage: {storage_path}")
                    print(f"     - Size: {len(img_bytes)} bytes")
                    return screenshot_id
                else:
                    print(f"[WARN] Screenshot uploaded to storage but database insert returned no data")
                    return None
            
        except Exception as e:
            print(f"[ERROR] Screenshot upload failed: {e}")
            traceback.print_exc()
        
        return None

    def monitor_user_activity(self):
        """Monitor mouse and keyboard activity for idle detection"""
        try:
            from pynput import mouse, keyboard
        except ImportError:
            print("[WARN] pynput not installed - idle detection disabled")
            print("[INFO] Install with: pip install pynput")
            return

        def on_activity(*args, **kwargs):
            """Called on any mouse or keyboard activity"""
            self.last_activity_time = time.time()

            # Resume tracking if idle
            if self.is_idle:
                print("[INFO] Activity detected, resuming tracking from idle")
                self.is_idle = False
                self.update_tray_icon()

        # Start mouse listener
        mouse_listener = mouse.Listener(
            on_move=on_activity,
            on_click=on_activity,
            on_scroll=on_activity
        )
        mouse_listener.start()

        # Start keyboard listener
        keyboard_listener = keyboard.Listener(
            on_press=on_activity
        )
        keyboard_listener.start()

        print("[OK] Activity monitoring started (5-minute idle timeout)")

    def tracking_loop(self):
        """Main tracking loop with idle detection"""
        print("[OK] Tracking started")
        
        while self.running:
            try:
                if not self.tracking_active:
                    time.sleep(1)
                    continue

                # Check for idle timeout
                idle_duration = time.time() - self.last_activity_time
                if idle_duration > self.idle_timeout:
                    if not self.is_idle:
                        print(f"[INFO] No activity for {int(idle_duration)}s, entering idle mode (pausing screenshots)")
                        self.is_idle = True
                        self.update_tray_icon()

                    # Skip screenshot capture when idle
                    # Check every 5 seconds instead of full interval
                    time.sleep(5)
                    continue

                # Resume from idle if needed (activity was detected)
                if self.is_idle:
                    print("[INFO] Resuming tracking from idle mode")
                    self.is_idle = False
                    self.update_tray_icon()

                # Capture screenshot (only when not idle)
                screenshot = self.capture_screenshot()
                if screenshot:
                    # Get window info
                    window_info = self.get_active_window()

                    # Upload screenshot
                    self.upload_screenshot(screenshot, window_info)

                # Wait for next interval
                time.sleep(self.capture_interval)

            except Exception as e:
                print(f"[ERROR] Tracking loop error: {e}")
                traceback.print_exc()
                time.sleep(5)
    
    def start_tracking(self):
        """Start screenshot tracking with idle detection"""
        if self.running:
            return

        if not self.current_user_id:
            print("[WARN] Cannot start tracking - user not authenticated")
            return

        self.running = True
        self.tracking_active = True
        self.is_idle = False
        self.last_activity_time = time.time()  # Reset activity time

        # Start tracking thread
        self._tracking_thread = threading.Thread(target=self.tracking_loop, daemon=True)
        self._tracking_thread.start()

        # Start activity monitoring thread (for idle detection)
        if not self._activity_monitor_thread or not self._activity_monitor_thread.is_alive():
            self._activity_monitor_thread = threading.Thread(
                target=self.monitor_user_activity, daemon=True
            )
            self._activity_monitor_thread.start()

        # Update tray icon to green
        self.update_tray_icon()

        print("[OK] Tracking started with idle detection")
    
    def stop_tracking(self):
        """Stop screenshot tracking"""
        self.running = False
        self.tracking_active = False
        
        # Update tray icon to blue
        self.update_tray_icon()
        
        print("[OK] Tracking stopped")
    
    def create_tray_icon(self, state='blue'):
        """
        Create a system tray icon image with color based on state
        Args:
            state: 'red' (not logged in), 'blue' (logged in, not tracking), 'green' (logged in, tracking)
        """
        # Create a 16x16 icon with a clock symbol
        size = 16
        icon = PILImage.new('RGBA', (size, size), (0, 0, 0, 0))  # Transparent background
        
        # Draw using PIL ImageDraw
        draw = ImageDraw.Draw(icon)
        
        # Color mapping based on state
        color_map = {
            'red': (220, 53, 69, 255),      # Red - not logged in
            'blue': (0, 82, 204, 255),      # Atlassian blue - logged in, not tracking
            'green': (40, 167, 69, 255),    # Green - logged in and actively tracking
            'orange': (255, 152, 0, 255)    # Orange - logged in, tracking, but idle
        }
        
        icon_color = color_map.get(state, color_map['blue'])
        
        # Draw a circle (clock face) with state-based color
        center = size // 2
        radius = 6
        draw.ellipse(
            [center - radius, center - radius, center + radius, center + radius],
            fill=icon_color,
            outline=(255, 255, 255, 255),
            width=1
        )
        
        # Draw clock hands (simple lines)
        # Hour hand
        draw.line(
            [center, center, center, center - 3],
            fill=(255, 255, 255, 255),
            width=1
        )
        # Minute hand
        draw.line(
            [center, center, center + 2, center],
            fill=(255, 255, 255, 255),
            width=1
        )
        
        return icon
    
    def get_tray_icon_state(self):
        """Determine the current state for tray icon color"""
        if not self.current_user:
            return 'red'  # Not logged in
        elif self.is_idle:
            return 'orange'  # Logged in, tracking enabled, but idle (no activity)
        elif self.tracking_active:
            return 'green'  # Logged in and actively tracking
        else:
            return 'blue'  # Logged in but tracking not started
    
    def update_tray_icon(self):
        """Update the tray icon based on current state"""
        if self.tray:
            try:
                state = self.get_tray_icon_state()
                new_icon = self.create_tray_icon(state)
                self.tray.icon = new_icon
            except Exception as e:
                print(f"[WARN] Failed to update tray icon: {e}")
    
    def setup_system_tray(self):
        """Setup system tray icon"""
        try:
            # Create initial icon based on current state
            initial_state = self.get_tray_icon_state()
            icon_image = self.create_tray_icon(initial_state)
            
            # Create dynamic menu that updates based on tracking state
            def create_menu():
                if not self.current_user:
                    return pystray.Menu(
                        item('Login', lambda: webbrowser.open(f'http://localhost:{self.web_port}/login')),
                        item('Quit', lambda: self.quit_app())
                    )
                else:
                    tracking_status = "Stop Tracking" if self.tracking_active else "Start Tracking"
                    return pystray.Menu(
                        item('Dashboard', lambda: webbrowser.open(f'http://localhost:{self.web_port}/dashboard')),
                        item(tracking_status, 
                             lambda: self.stop_tracking() if self.tracking_active else self.start_tracking()),
                        item('Quit', lambda: self.quit_app())
                    )
            
            self.tray = pystray.Icon("BRD Time Tracker", icon_image, menu=create_menu())
            
            # Start a thread to periodically update the icon
            def update_icon_periodically():
                while self.tray and self.tray.visible:
                    try:
                        self.update_tray_icon()
                        time.sleep(2)  # Update every 2 seconds
                    except Exception as e:
                        break
            
            update_thread = threading.Thread(target=update_icon_periodically, daemon=True)
            update_thread.start()
            
            self.tray.run()
        except Exception as e:
            print(f"[WARN] System tray setup failed: {e}")
            # Fallback to simple colored icon
            try:
                state = self.get_tray_icon_state()
                color_map = {
                    'red': '#DC3545',
                    'blue': '#0052CC',
                    'green': '#28A745',
                    'orange': '#FF9800'
                }
                icon_image = PILImage.new('RGB', (16, 16), color=color_map.get(state, '#0052CC'))
                menu = pystray.Menu(
                    item('Dashboard', lambda: webbrowser.open(f'http://localhost:{self.web_port}/dashboard')),
                    item('Quit', lambda: self.quit_app())
                )
                self.tray = pystray.Icon("BRD Time Tracker", icon_image, menu=menu)
                self.tray.run()
            except Exception as e2:
                print(f"[ERROR] System tray fallback also failed: {e2}")
    
    def quit_app(self):
        """Quit application"""
        self.stop_tracking()
        if self.tray:
            self.tray.stop()
        sys.exit(0)
    
    def run_web_server(self):
        """Run Flask web server"""
        self.app.run(host='127.0.0.1', port=self.web_port, debug=False)
    
    def run(self):
        """Main application entry point"""
        print("[OK] Starting BRD Time Tracker...")
        
        # Check authentication
        if self.auth_manager.is_authenticated():
            user_info = self.auth_manager.get_user_info()
            if user_info:
                self.current_user = user_info
                self.current_user_id = self.ensure_user_exists(user_info)
                print(f"[OK] Welcome back, {user_info.get('email', 'User')}!")
            else:
                print("[WARN] Failed to get user info, please re-authenticate")
                self.auth_manager.logout()
        
        # Start web server
        web_thread = threading.Thread(target=self.run_web_server, daemon=True)
        web_thread.start()
        time.sleep(2)
        
        # Open browser if not authenticated
        if not self.current_user:
            print("[INFO] Opening browser for authentication...")
            webbrowser.open(f'http://localhost:{self.web_port}/login')
        else:
            # Start tracking automatically
            self.start_tracking()
        
        print(f"[OK] Application running at http://localhost:{self.web_port}")
        print("[OK] Check system tray for application icon")
        
        # Setup system tray (blocking)
        try:
            self.setup_system_tray()
        except KeyboardInterrupt:
            print("\n[INFO] Shutting down...")
            self.stop_tracking()
    
    # ============================================================================
    # HTML TEMPLATES
    # ============================================================================
    
    def render_login_page(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>BRD Time Tracker - Login</title>
    <style>
        body { font-family: Arial; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .btn { background: #0052CC; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; font-size: 16px; width: 100%; margin: 10px 0; }
        .btn:hover { background: #0065FF; }
    </style>
</head>
<body>
    <div class="container">
        <h2>BRD Time Tracker</h2>
        <p>Sign in with Atlassian to start tracking</p>
        <button class="btn" onclick="window.location.href='/auth/atlassian'">Sign in with Atlassian</button>
    </div>
</body>
</html>'''
        return html
    
    def render_success_page(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Login Successful</title>
    <style>
        body { font-family: Arial; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .success { color: #28a745; font-size: 48px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success">✓</div>
        <h2>Login Successful!</h2>
        <p>You can close this window. Tracking will start automatically.</p>
        <p><a href="/dashboard">Go to Dashboard</a></p>
    </div>
</body>
</html>'''
        return html
    
    def render_dashboard(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>BRD Time Tracker - Dashboard</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .container { 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        h1 { margin-top: 0; color: #172B4D; }
        .status { 
            padding: 12px 16px; 
            margin: 20px 0; 
            border-radius: 6px; 
            font-weight: 500;
        }
        .status.active { 
            background: #d4edda; 
            color: #155724; 
            border: 1px solid #c3e6cb;
        }
        .status.inactive { 
            background: #f8d7da; 
            color: #721c24; 
            border: 1px solid #f5c6cb;
        }
        h2 { 
            margin-top: 30px; 
            margin-bottom: 20px; 
            color: #172B4D; 
        }
        .screenshots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .screenshot-item {
            background: #f8f9fa;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .screenshot-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .screenshot-item img {
            width: 100%;
            height: 180px;
            object-fit: cover;
            display: block;
            background: #e9ecef;
        }
        .screenshot-info {
            padding: 12px;
        }
        .screenshot-info .app-name {
            font-weight: 600;
            color: #172B4D;
            margin: 0 0 4px 0;
            font-size: 14px;
        }
        .screenshot-info .window-title {
            color: #6B778C;
            font-size: 12px;
            margin: 0 0 6px 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .screenshot-info .timestamp {
            color: #8993A4;
            font-size: 11px;
            margin: 0;
        }
        .empty-state {
            text-align: center;
            color: #6B778C;
            padding: 60px 20px;
            grid-column: 1 / -1;
        }
        .empty-state p {
            margin: 10px 0;
            font-size: 14px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #6B778C;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BRD Time Tracker Dashboard</h1>
        <div id="status" class="status">Loading...</div>
        <h2>Recent Screenshots</h2>
        <div id="screenshots" class="loading">Loading screenshots...</div>
    </div>
    <script>
        // Load status
        fetch('/api/status')
            .then(r => r.json())
            .then(data => {
                const statusDiv = document.getElementById('status');
                statusDiv.className = 'status ' + (data.tracking ? 'active' : 'inactive');
                statusDiv.textContent = data.tracking ? '✓ Tracking Active' : '○ Tracking Inactive';
            })
            .catch(err => {
                console.error('Error loading status:', err);
                document.getElementById('status').textContent = 'Error loading status';
            });
        
        // Load screenshots
        fetch('/api/screenshots')
            .then(r => r.json())
            .then(data => {
                const div = document.getElementById('screenshots');
                if (!data || data.length === 0) {
                    div.className = 'empty-state';
                    div.innerHTML = '<p>📷</p><p>No screenshots captured yet</p><p style="font-size: 12px; color: #8993A4;">Screenshots will appear here once tracking starts</p>';
                } else {
                    div.className = 'screenshots-grid';
                    div.innerHTML = data.map(s => {
                        const date = new Date(s.timestamp);
                        const thumbnailUrl = s.thumbnail_url || s.storage_url || '';
                        const windowTitle = s.window_title || 'Unknown window';
                        const appName = s.application_name || 'Unknown app';
                        
                        const imageUrl = s.proxy_url || s.thumbnail_url || s.storage_url || '';
                        return `
                            <div class="screenshot-item" onclick="window.open('${imageUrl || '#'}', '_blank')">
                                <img src="${thumbnailUrl || imageUrl || ''}" alt="Screenshot" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'250\\' height=\\'180\\'%3E%3Crect fill=\\'%23e9ecef\\' width=\\'250\\' height=\\'180\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dy=\\'.3em\\' fill=\\'%23999\\' font-family=\\'Arial\\' font-size=\\'14\\'%3EImage not available%3C/text%3E%3C/svg%3E';">
                                <div class="screenshot-info">
                                    <p class="app-name">${appName}</p>
                                    <p class="window-title" title="${windowTitle}">${windowTitle}</p>
                                    <p class="timestamp">${date.toLocaleString()}</p>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            })
            .catch(err => {
                console.error('Error loading screenshots:', err);
                document.getElementById('screenshots').innerHTML = '<p style="color: #dc3545;">Error loading screenshots. Please refresh the page.</p>';
            });
    </script>
</body>
</html>'''
        return html

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """Main entry point"""
    try:
        app = BRDTimeTracker()
        app.run()
    except KeyboardInterrupt:
        print("\n[INFO] Application stopped by user")
    except Exception as e:
        print(f"[ERROR] Application error: {e}")
        traceback.print_exc()
        input("Press Enter to exit...")

if __name__ == '__main__':
    main()

