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

# OpenAI for enhanced screenshot analysis (optional)
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

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
        """Get Atlassian user information"""
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
        
        if response.status_code == 200:
            return response.json()
        return None
    
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
        self._tracking_thread = None
        self.screenshot_hash = None
        
        # OpenAI (optional)
        openai_key = get_env_var('OPENAI_API_KEY')
        use_ai = get_env_var('USE_AI_FOR_SCREENSHOTS', 'false').lower() == 'true'
        
        if OPENAI_AVAILABLE and openai_key and use_ai:
            self.openai_client = OpenAI(api_key=openai_key)
            self.openai_enabled = True
        else:
            self.openai_client = None
            self.openai_enabled = False
        
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
                
                return jsonify(result.data)
            except Exception as e:
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
                    'status': 'pending'
                }
                
                # Use service client for database insert to bypass RLS
                db_client = self.supabase_service if self.supabase_service else self.supabase
                result = db_client.table('screenshots').insert(screenshot_data).execute()
                
                if result.data:
                    print(f"[OK] Screenshot uploaded: {filename}")
                    return result.data[0]['id']
            
        except Exception as e:
            print(f"[ERROR] Screenshot upload failed: {e}")
            traceback.print_exc()
        
        return None
    
    def tracking_loop(self):
        """Main tracking loop"""
        print("[OK] Tracking started")
        
        while self.running:
            try:
                if not self.tracking_active:
                    time.sleep(1)
                    continue
                
                # Capture screenshot
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
        """Start screenshot tracking"""
        if self.running:
            return
        
        if not self.current_user_id:
            print("[WARN] Cannot start tracking - user not authenticated")
            return
        
        self.running = True
        self.tracking_active = True
        
        self._tracking_thread = threading.Thread(target=self.tracking_loop, daemon=True)
        self._tracking_thread.start()
        
        # Update tray icon to green
        self.update_tray_icon()
        
        print("[OK] Tracking started")
    
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
            'green': (40, 167, 69, 255)     # Green - logged in and tracking
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
        elif self.tracking_active:
            return 'green'  # Logged in and tracking
        else:
            return 'blue'  # Logged in but not tracking
    
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
                    'green': '#28A745'
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
        body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .status.active { background: #d4edda; color: #155724; }
        .status.inactive { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <h1>BRD Time Tracker Dashboard</h1>
        <div id="status" class="status">Loading...</div>
        <h2>Recent Screenshots</h2>
        <div id="screenshots">Loading...</div>
    </div>
    <script>
        fetch('/api/status').then(r => r.json()).then(data => {
            const statusDiv = document.getElementById('status');
            statusDiv.className = 'status ' + (data.tracking ? 'active' : 'inactive');
            statusDiv.textContent = data.tracking ? 'Tracking Active' : 'Tracking Inactive';
        });
        fetch('/api/screenshots').then(r => r.json()).then(data => {
            const div = document.getElementById('screenshots');
            if (data.length === 0) {
                div.textContent = 'No screenshots yet';
            } else {
                div.innerHTML = '<ul>' + data.map(s => '<li>' + new Date(s.timestamp).toLocaleString() + ' - ' + s.application_name + '</li>').join('') + '</ul>';
            }
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

