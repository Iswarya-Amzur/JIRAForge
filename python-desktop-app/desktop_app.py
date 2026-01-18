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
from datetime import datetime, timezone, timedelta
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

# SQLite for offline storage
import sqlite3
import socket

# Windows-specific imports
try:
    import win32gui
    import win32process
    import win32con
    import win32event
    import winerror
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

# ============================================================================
# SINGLE INSTANCE LOCK
# ============================================================================

_instance_mutex = None

def acquire_single_instance_lock():
    """
    Acquire a system-wide mutex to ensure only one instance runs.
    Returns True if lock acquired (this is the only instance).
    Returns False if another instance is already running.
    """
    global _instance_mutex

    if not WIN32_AVAILABLE:
        # On non-Windows, use a lock file approach
        return _acquire_lock_file()

    try:
        # Create a named mutex - if it already exists, another instance is running
        mutex_name = "BRDTimeTracker_SingleInstance_Mutex"
        _instance_mutex = win32event.CreateMutex(None, True, mutex_name)

        # Check if we got the mutex or if it already existed
        last_error = win32event.GetLastError() if hasattr(win32event, 'GetLastError') else 0

        # Alternative way to check - try to get last error via ctypes
        import ctypes
        last_error = ctypes.windll.kernel32.GetLastError()

        if last_error == winerror.ERROR_ALREADY_EXISTS:
            print("[WARN] Another instance of BRD Time Tracker is already running!")
            return False

        print("[OK] Single instance lock acquired")
        return True

    except Exception as e:
        print(f"[WARN] Could not create single instance lock: {e}")
        # Fall back to lock file approach
        return _acquire_lock_file()

def _acquire_lock_file():
    """Fallback lock file approach for non-Windows or when mutex fails"""
    lock_file = os.path.join(get_app_data_dir(), '.lock')

    try:
        # Check if lock file exists and if the process is still running
        if os.path.exists(lock_file):
            with open(lock_file, 'r') as f:
                pid = int(f.read().strip())

            # Check if process is still running
            if psutil.pid_exists(pid):
                try:
                    proc = psutil.Process(pid)
                    if 'brdtimetracker' in proc.name().lower() or 'python' in proc.name().lower():
                        print(f"[WARN] Another instance is running (PID: {pid})")
                        return False
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

        # Write our PID to lock file
        with open(lock_file, 'w') as f:
            f.write(str(os.getpid()))

        print("[OK] Lock file acquired")
        return True

    except Exception as e:
        print(f"[WARN] Lock file error: {e}")
        return True  # Allow running if we can't check

def release_single_instance_lock():
    """Release the single instance lock"""
    global _instance_mutex

    if _instance_mutex:
        try:
            win32event.ReleaseMutex(_instance_mutex)
            win32event.CloseHandle(_instance_mutex)
        except:
            pass
        _instance_mutex = None

    # Also clean up lock file
    lock_file = os.path.join(get_app_data_dir(), '.lock')
    try:
        if os.path.exists(lock_file):
            os.remove(lock_file)
    except:
        pass

# Windows toast notifications
try:
    from winotify import Notification, audio
    WINOTIFY_AVAILABLE = True
except ImportError:
    WINOTIFY_AVAILABLE = False
    print("[WARN] winotify not available - desktop notifications disabled")

# Note: AI analysis is now handled by the separate AI server
# Desktop app only captures and uploads screenshots to Supabase

# Load environment variables
load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

# Embedded credentials (for production builds - no .env file needed)
# SECURITY: All sensitive keys moved to AI Server - fetched at runtime after authentication
EMBEDDED_CONFIG = {
    'ATLASSIAN_CLIENT_ID': 'Q8HT4Jn205AuTiAarj088oWNDrOqwvM5',
    # REMOVED: ATLASSIAN_CLIENT_SECRET - now on AI Server only (security fix)
    # REMOVED: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY - fetched from AI Server
    'AI_SERVER_URL': 'https://forgesync.amzur.com',  # AI Server for secure token exchange & config
    'CAPTURE_INTERVAL': '300',
    'WEB_PORT': '51777',
    'ADMIN_PASSWORD': 'admin123'
}

# Runtime Supabase config (fetched from AI server after authentication)
RUNTIME_SUPABASE_CONFIG = {
    'SUPABASE_URL': None,
    'SUPABASE_ANON_KEY': None,
    'SUPABASE_SERVICE_ROLE_KEY': None
}

def get_env_var(key, default=None):
    """Get environment variable with fallback to embedded/runtime values"""
    # First try environment variable (for development with .env)
    value = os.getenv(key)
    if value:
        return value
    # Then try runtime Supabase config (fetched from AI server)
    if key in RUNTIME_SUPABASE_CONFIG and RUNTIME_SUPABASE_CONFIG[key]:
        return RUNTIME_SUPABASE_CONFIG[key]
    # Then try embedded config (for production builds)
    if key in EMBEDDED_CONFIG:
        return EMBEDDED_CONFIG[key]
    # Finally use default
    return default

def set_runtime_supabase_config(url, anon_key, service_role_key):
    """Set Supabase config fetched from AI server"""
    global RUNTIME_SUPABASE_CONFIG
    RUNTIME_SUPABASE_CONFIG['SUPABASE_URL'] = url
    RUNTIME_SUPABASE_CONFIG['SUPABASE_ANON_KEY'] = anon_key
    RUNTIME_SUPABASE_CONFIG['SUPABASE_SERVICE_ROLE_KEY'] = service_role_key
    print(f"[OK] Supabase config loaded from AI server")

def get_app_data_dir():
    """Get the application data directory in LocalAppData"""
    if sys.platform == 'win32':
        app_data = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
    else:
        app_data = os.path.expanduser('~/.local/share')

    app_dir = os.path.join(app_data, 'BRDTimeTracker')

    # Create directory if it doesn't exist
    if not os.path.exists(app_dir):
        os.makedirs(app_dir)
        print(f"[OK] Created app data directory: {app_dir}")

    return app_dir

def get_app_executable_dir():
    """Get the directory where the executable is located"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        return os.path.dirname(sys.executable)
    else:
        # Running as script
        return os.path.dirname(os.path.abspath(__file__))

def get_app_executable_path():
    """Get the full path to the executable"""
    if getattr(sys, 'frozen', False):
        return sys.executable
    else:
        return os.path.abspath(__file__)

def get_installed_exe_path():
    """Get the path where the exe should be installed"""
    return os.path.join(get_app_data_dir(), 'BRDTimeTracker.exe')

def is_running_from_install_location():
    """Check if the app is running from the correct install location"""
    if not getattr(sys, 'frozen', False):
        # Running as script (development mode) - always return True
        return True

    current_path = os.path.normpath(get_app_executable_path()).lower()
    install_path = os.path.normpath(get_installed_exe_path()).lower()

    return current_path == install_path

def install_application():
    """
    Self-install the application to %LOCALAPPDATA%\BRDTimeTracker\

    Returns:
        bool: True if app should continue running, False if it should exit (restart from new location)
    """
    if not getattr(sys, 'frozen', False):
        # Running as script (development mode) - skip installation
        print("[INFO] Running in development mode - skipping self-installation")
        return True

    # Check if already running from install location
    if is_running_from_install_location():
        print("[OK] Running from installed location")
        return True

    current_exe = get_app_executable_path()
    install_dir = get_app_data_dir()
    installed_exe = get_installed_exe_path()

    print(f"[INFO] First run detected - installing application...")
    print(f"       From: {current_exe}")
    print(f"       To:   {installed_exe}")

    try:
        import shutil
        import subprocess

        # Copy the executable to install location
        shutil.copy2(current_exe, installed_exe)
        print(f"[OK] Application copied to: {installed_exe}")

        # Generate uninstaller in install location
        uninstall_path = os.path.join(install_dir, 'uninstall.bat')
        _generate_uninstaller_at_path(uninstall_path, install_dir)
        print(f"[OK] Uninstaller created: {uninstall_path}")

        # Start the installed version
        print("[INFO] Starting installed application...")
        subprocess.Popen([installed_exe], creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)

        # Show message to user
        print("")
        print("=" * 50)
        print("  INSTALLATION COMPLETE!")
        print("=" * 50)
        print("")
        print(f"  Application installed to:")
        print(f"  {install_dir}")
        print("")
        print("  The application is now starting from the")
        print("  installed location. You can delete the")
        print("  downloaded file if you wish.")
        print("")
        print("=" * 50)

        # Exit this instance (the new one will continue)
        return False

    except Exception as e:
        print(f"[ERROR] Installation failed: {e}")
        print("[INFO] Continuing to run from current location...")
        import traceback
        traceback.print_exc()
        return True

def _generate_uninstaller_at_path(uninstall_path, install_dir):
    """Generate uninstall.bat at the specified path"""

    uninstall_script = f'''@echo off
REM ============================================================================
REM BRD Time Tracker - Uninstall Script
REM Removes the application and all associated data
REM ============================================================================

echo.
echo ============================================
echo  BRD Time Tracker - Uninstaller
echo ============================================
echo.

echo This will remove BRD Time Tracker and all associated data.
echo.
echo The following will be deleted:
echo   - Application executable
echo   - OAuth tokens and session data
echo   - Offline screenshot database
echo   - User preferences and consent data
echo   - Windows startup entry
echo.
set /p CONFIRM="Are you sure you want to uninstall? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo Uninstall cancelled.
    pause
    exit /b 0
)

echo.
echo [STEP 1/4] Stopping application if running...
taskkill /f /im BRDTimeTracker.exe >nul 2>&1
if %errorlevel%==0 (
    echo   Application stopped.
) else (
    echo   Application was not running.
)

echo.
echo [STEP 2/4] Removing from Windows startup...
reg delete "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v BRDTimeTracker /f >nul 2>&1
if %errorlevel%==0 (
    echo   Removed from startup.
) else (
    echo   Was not in startup.
)

echo.
echo [STEP 3/4] Waiting for application to fully close...
timeout /t 2 /nobreak >nul

echo.
echo [STEP 4/4] Removing application files...

REM Store the install directory path
set "INSTALL_DIR={install_dir}"

REM Delete the executable first
if exist "%INSTALL_DIR%\\BRDTimeTracker.exe" (
    del /f /q "%INSTALL_DIR%\\BRDTimeTracker.exe"
    echo   - Removed: BRDTimeTracker.exe
)

REM Delete data files
if exist "%INSTALL_DIR%\\brd_tracker_auth.json" del /f /q "%INSTALL_DIR%\\brd_tracker_auth.json"
if exist "%INSTALL_DIR%\\brd_tracker_offline.db" del /f /q "%INSTALL_DIR%\\brd_tracker_offline.db"
if exist "%INSTALL_DIR%\\brd_tracker_consent.json" del /f /q "%INSTALL_DIR%\\brd_tracker_consent.json"
if exist "%INSTALL_DIR%\\brd_tracker_user_cache.json" del /f /q "%INSTALL_DIR%\\brd_tracker_user_cache.json"
echo   - Removed: Application data files

REM Also clean up old TEMP location if exists
if exist "%TEMP%\\brd_tracker_auth.json" del /f /q "%TEMP%\\brd_tracker_auth.json"
if exist "%TEMP%\\brd_tracker_offline.db" del /f /q "%TEMP%\\brd_tracker_offline.db"
if exist "%TEMP%\\brd_tracker_consent.json" del /f /q "%TEMP%\\brd_tracker_consent.json"
if exist "%TEMP%\\brd_tracker_user_cache.json" del /f /q "%TEMP%\\brd_tracker_user_cache.json"

echo.
echo ============================================
echo  Uninstall Complete!
echo ============================================
echo.
echo BRD Time Tracker has been removed from your system.
echo.
echo This window will close and the uninstaller will
echo delete itself along with the application folder.
echo.
pause

REM Self-delete: remove this batch file and the folder
cd /d "%TEMP%"
rmdir /s /q "%INSTALL_DIR%" 2>nul
'''

    with open(uninstall_path, 'w') as f:
        f.write(uninstall_script)

# ============================================================================
# AUTO-START (REGISTRY) MANAGEMENT
# ============================================================================

APP_NAME = "BRDTimeTracker"
REGISTRY_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"

def add_to_startup():
    """Add application to Windows startup via registry"""
    if sys.platform != 'win32':
        print("[INFO] Auto-start only supported on Windows")
        return False

    try:
        import winreg

        exe_path = get_app_executable_path()

        # Open registry key
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REGISTRY_PATH,
            0,
            winreg.KEY_SET_VALUE
        )

        # Set the value
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{exe_path}"')
        winreg.CloseKey(key)

        print(f"[OK] Added to Windows startup: {exe_path}")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to add to startup: {e}")
        return False

def remove_from_startup():
    """Remove application from Windows startup"""
    if sys.platform != 'win32':
        return False

    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REGISTRY_PATH,
            0,
            winreg.KEY_SET_VALUE
        )

        try:
            winreg.DeleteValue(key, APP_NAME)
            print(f"[OK] Removed from Windows startup")
        except FileNotFoundError:
            print("[INFO] App was not in startup")

        winreg.CloseKey(key)
        return True

    except Exception as e:
        print(f"[ERROR] Failed to remove from startup: {e}")
        return False

def is_in_startup():
    """Check if application is in Windows startup"""
    if sys.platform != 'win32':
        return False

    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            REGISTRY_PATH,
            0,
            winreg.KEY_READ
        )

        try:
            value, _ = winreg.QueryValueEx(key, APP_NAME)
            winreg.CloseKey(key)
            return True
        except FileNotFoundError:
            winreg.CloseKey(key)
            return False

    except Exception as e:
        return False

# ============================================================================
# ATLASSIAN OAUTH MANAGER
# ============================================================================

class AtlassianAuthManager:
    """Manages Atlassian OAuth 3LO flow via AI Server (secure token exchange)"""

    def __init__(self, web_port=51777, store_path=None):
        self.client_id = get_env_var('ATLASSIAN_CLIENT_ID', '')
        # SECURITY: client_secret is now on AI Server only, not in desktop app
        self.redirect_uri = f'http://localhost:{web_port}/auth/callback'
        self.authorization_url = 'https://auth.atlassian.com/authorize'
        # Token exchange now goes through AI Server
        self.ai_server_url = get_env_var('AI_SERVER_URL', 'http://216.48.190.255:3001')
        self.store_path = store_path or os.path.join(get_app_data_dir(), 'brd_tracker_auth.json')
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
        """Generate Atlassian OAuth authorization URL with PKCE"""
        if not self.client_id:
            raise ValueError("ATLASSIAN_CLIENT_ID not configured")

        # Generate state for CSRF protection
        state = secrets.token_urlsafe(32)

        # PKCE: Generate code_verifier (43-128 characters, URL-safe)
        code_verifier = secrets.token_urlsafe(64)

        # PKCE: Create code_challenge = BASE64URL(SHA256(code_verifier))
        code_challenge = base64.urlsafe_b64encode(
            hashlib.sha256(code_verifier.encode()).digest()
        ).decode().rstrip('=')

        # Store state and code_verifier for callback verification
        self.tokens['oauth_state'] = state
        self.tokens['code_verifier'] = code_verifier
        self._save_tokens()

        print(f"[OK] PKCE code_challenge generated (S256)")

        params = {
            'audience': 'api.atlassian.com',
            'client_id': self.client_id,
            'scope': 'read:me read:jira-work write:jira-work offline_access',
            'redirect_uri': self.redirect_uri,
            'state': state,
            'response_type': 'code',
            'prompt': 'consent',
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256'
        }

        auth_url = f"{self.authorization_url}?{urllib.parse.urlencode(params)}"
        return auth_url
    
    def handle_callback(self, code, state):
        """Handle OAuth callback and exchange code for tokens via AI Server (with PKCE)"""
        # Verify state
        stored_state = self.tokens.get('oauth_state')
        if state != stored_state:
            raise ValueError("Invalid state parameter - possible CSRF attack")

        # PKCE: Get the code_verifier we stored during get_auth_url()
        code_verifier = self.tokens.get('code_verifier')
        if not code_verifier:
            raise ValueError("Missing code_verifier - PKCE flow was not properly initiated")

        # Exchange code for tokens via AI Server (client_secret is on server only)
        print("[INFO] Exchanging OAuth code via AI Server (with PKCE)...")
        response = requests.post(
            f"{self.ai_server_url}/api/auth/atlassian/callback",
            json={
                'code': code,
                'redirect_uri': self.redirect_uri,
                'code_verifier': code_verifier  # PKCE: Send verifier to AI server
            },
            headers={'Content-Type': 'application/json'},
            timeout=30
        )

        if response.status_code != 200:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error = error_data.get('error', response.text)
            raise Exception(f"Token exchange failed: {error}")

        result = response.json()
        if not result.get('success'):
            raise Exception(f"Token exchange failed: {result.get('error', 'Unknown error')}")

        self.tokens.update({
            'access_token': result.get('access_token'),
            'refresh_token': result.get('refresh_token'),
            'expires_at': time.time() + result.get('expires_in', 3600)
        })
        self._save_tokens()

        print("[OK] OAuth tokens received via AI Server")
        return result
    
    def get_user_info(self):
        """Get Atlassian user information with automatic token refresh on 401"""
        access_token = self.tokens.get('access_token')
        if not access_token:
            return None

        try:
            response = requests.get(
                'https://api.atlassian.com/me',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Accept': 'application/json'
                },
                timeout=10
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
                        },
                        timeout=10
                    )
                else:
                    print("[ERROR] Token refresh failed in get_user_info")
                    return None

            if response.status_code == 200:
                return response.json()
            return None
        except requests.exceptions.ConnectionError:
            print("[WARN] Network unavailable - cannot fetch user info")
            return None
        except requests.exceptions.Timeout:
            print("[WARN] Request timed out - cannot fetch user info")
            return None
        except Exception as e:
            print(f"[ERROR] Failed to get user info: {e}")
            return None
    
    def refresh_access_token(self):
        """Refresh access token using refresh token via AI Server"""
        refresh_token = self.tokens.get('refresh_token')
        if not refresh_token:
            print("[ERROR] No refresh token available")
            return False

        print("[INFO] Refreshing access token via AI Server...")
        try:
            response = requests.post(
                f"{self.ai_server_url}/api/auth/refresh-token",
                json={
                    'refresh_token': refresh_token
                },
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code != 200:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                error = error_data.get('error', response.text)
                print(f"[ERROR] Token refresh failed: {error}")
                # Check if re-authentication is required
                if error_data.get('requiresReauth'):
                    print("[WARN] Refresh token expired - user must re-authenticate")
                return False

            result = response.json()
            if not result.get('success'):
                print(f"[ERROR] Token refresh failed: {result.get('error', 'Unknown error')}")
                return False

            self.tokens.update({
                'access_token': result.get('access_token'),
                'refresh_token': result.get('refresh_token', refresh_token),
                'expires_at': time.time() + result.get('expires_in', 3600)
            })
            self._save_tokens()

            print("[OK] Access token refreshed successfully via AI Server")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to refresh access token: {e}")
            return False

    def is_authenticated(self):
        """Check if user is authenticated"""
        return bool(self.tokens.get('access_token'))

    def get_supabase_token(self):
        """Get Supabase JWT from AI Server using Atlassian token"""
        access_token = self.tokens.get('access_token')
        if not access_token:
            print("[ERROR] No Atlassian access token available")
            return None

        print("[INFO] Requesting Supabase token from AI Server...")
        try:
            response = requests.post(
                f"{self.ai_server_url}/api/auth/exchange-token",
                json={
                    'atlassian_token': access_token
                },
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code == 401:
                # Atlassian token expired, try to refresh
                print("[WARN] Atlassian token expired, attempting refresh...")
                if self.refresh_access_token():
                    # Retry with new token
                    return self.get_supabase_token()
                print("[ERROR] Could not refresh Atlassian token")
                return None

            if response.status_code != 200:
                error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                error = error_data.get('error', response.text)
                print(f"[ERROR] Failed to get Supabase token: {error}")
                return None

            result = response.json()
            if not result.get('success'):
                print(f"[ERROR] Failed to get Supabase token: {result.get('error', 'Unknown error')}")
                return None

            supabase_token = result.get('supabase_token')
            expires_in = result.get('expires_in', 3600)

            # Store the Supabase token
            self.tokens['supabase_token'] = supabase_token
            self.tokens['supabase_token_expires_at'] = time.time() + expires_in
            self._save_tokens()

            print(f"[OK] Supabase token received (expires in {expires_in}s)")
            return supabase_token

        except Exception as e:
            print(f"[ERROR] Failed to get Supabase token: {e}")
            return None

    def get_valid_supabase_token(self):
        """Get a valid Supabase token, refreshing if needed"""
        supabase_token = self.tokens.get('supabase_token')
        expires_at = self.tokens.get('supabase_token_expires_at', 0)

        # Check if token exists and is not expired (with 5 min buffer)
        if supabase_token and time.time() < (expires_at - 300):
            return supabase_token

        # Token expired or doesn't exist, get a new one
        print("[INFO] Supabase token expired or missing, getting new one...")
        return self.get_supabase_token()

    def get_supabase_config(self):
        """Fetch Supabase configuration from AI Server (requires valid Atlassian token)"""
        access_token = self.tokens.get('access_token')
        if not access_token:
            print("[ERROR] No valid Atlassian token - cannot fetch Supabase config")
            return False

        try:
            ai_server_url = get_env_var('AI_SERVER_URL')
            print("[INFO] Fetching Supabase config from AI Server...")

            response = requests.post(
                f"{ai_server_url}/api/auth/supabase-config",
                json={'atlassian_token': access_token},
                timeout=30
            )

            if response.status_code == 401:
                # Token might be expired, try refreshing
                print("[WARN] Atlassian token rejected, attempting refresh...")
                if self.refresh_access_token():
                    return self.get_supabase_config()
                else:
                    print("[ERROR] Token refresh failed")
                    return False

            if response.status_code != 200:
                error = response.json().get('error', 'Unknown error')
                print(f"[ERROR] Failed to get Supabase config: {error}")
                return False

            result = response.json()
            if not result.get('success'):
                print(f"[ERROR] Failed to get Supabase config: {result.get('error', 'Unknown error')}")
                return False

            # Store the Supabase config in runtime config
            set_runtime_supabase_config(
                result.get('supabase_url'),
                result.get('supabase_anon_key'),
                result.get('supabase_service_role_key')
            )
            return True

        except Exception as e:
            print(f"[ERROR] Failed to fetch Supabase config: {e}")
            return False

    def logout(self):
        """Clear authentication tokens"""
        self.tokens = {}
        if os.path.exists(self.store_path):
            os.remove(self.store_path)


# ============================================================================
# OFFLINE DATA MANAGER
# ============================================================================

class OfflineManager:
    """Manages offline data storage and synchronization with Supabase"""
    
    def __init__(self, db_path=None):
        """Initialize offline manager with SQLite database"""
        self.db_path = db_path or os.path.join(get_app_data_dir(), 'brd_tracker_offline.db')
        self.is_online = True
        self._last_connectivity_check = 0
        self._connectivity_check_interval = 30  # Check every 30 seconds
        self._sync_lock = threading.Lock()
        self._syncing = False
        
        # Initialize database
        self._init_database()
        print(f"[OK] Offline manager initialized (DB: {self.db_path})")
    
    def _init_database(self):
        """Initialize SQLite database for offline storage"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create screenshots table for offline storage
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS offline_screenshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                organization_id TEXT,
                timestamp TEXT NOT NULL,
                storage_path TEXT,
                window_title TEXT,
                application_name TEXT,
                file_size_bytes INTEGER,
                start_time TEXT,
                end_time TEXT,
                duration_seconds INTEGER,
                project_key TEXT,
                user_assigned_issues TEXT,
                metadata TEXT,
                image_data BLOB,
                thumbnail_data BLOB,
                synced INTEGER DEFAULT 0,
                sync_attempts INTEGER DEFAULT 0,
                last_sync_error TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Add project_key column if it doesn't exist (for existing databases)
        try:
            cursor.execute('ALTER TABLE offline_screenshots ADD COLUMN project_key TEXT')
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        # Create index for faster queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_offline_screenshots_synced 
            ON offline_screenshots(synced)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_offline_screenshots_user 
            ON offline_screenshots(user_id)
        ''')
        
        conn.commit()
        conn.close()
    
    def check_connectivity(self, force=False):
        """Check if we have internet connectivity"""
        current_time = time.time()
        
        # Use cached result if checked recently (unless forced)
        if not force and (current_time - self._last_connectivity_check) < self._connectivity_check_interval:
            return self.is_online
        
        self._last_connectivity_check = current_time
        
        # Try multiple endpoints for reliability
        test_endpoints = [
            ("api.atlassian.com", 443),
            ("supabase.co", 443),
            ("8.8.8.8", 53),  # Google DNS
        ]
        
        for host, port in test_endpoints:
            sock = None
            try:
                # Create socket with per-socket timeout (not global)
                # Using setdefaulttimeout() would affect Flask's request handling
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(3)  # Per-socket timeout
                sock.connect((host, port))
                sock.close()
                if not self.is_online:
                    print("[OK] Network connectivity restored")
                self.is_online = True
                return True
            except (socket.error, socket.timeout, OSError):
                if sock:
                    try:
                        sock.close()
                    except:
                        pass
                continue
        
        if self.is_online:
            print("[WARN] Network connectivity lost - switching to offline mode")
        self.is_online = False
        return False
    
    def save_screenshot_offline(self, screenshot_data, image_bytes, thumbnail_bytes):
        """Save screenshot data locally when offline
        
        Args:
            screenshot_data: Dictionary with screenshot metadata
            image_bytes: Raw image data (PNG)
            thumbnail_bytes: Raw thumbnail data (JPEG)
        
        Returns:
            int: Local record ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Convert complex objects to JSON strings
            user_issues = json.dumps(screenshot_data.get('user_assigned_issues', []))
            metadata = json.dumps(screenshot_data.get('metadata', {}))
            
            cursor.execute('''
                INSERT INTO offline_screenshots (
                    user_id, organization_id, timestamp, storage_path,
                    window_title, application_name, file_size_bytes,
                    start_time, end_time, duration_seconds, project_key,
                    user_assigned_issues, metadata, image_data, thumbnail_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                screenshot_data.get('user_id'),
                screenshot_data.get('organization_id'),
                screenshot_data.get('timestamp'),
                screenshot_data.get('storage_path'),
                screenshot_data.get('window_title'),
                screenshot_data.get('application_name'),
                screenshot_data.get('file_size_bytes'),
                screenshot_data.get('start_time'),
                screenshot_data.get('end_time'),
                screenshot_data.get('duration_seconds'),
                screenshot_data.get('project_key'),
                user_issues,
                metadata,
                image_bytes,
                thumbnail_bytes
            ))
            
            local_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            print(f"[OK] Screenshot saved offline (local ID: {local_id})")
            return local_id
            
        except Exception as e:
            print(f"[ERROR] Failed to save screenshot offline: {e}")
            traceback.print_exc()
            return None
    
    def get_pending_screenshots(self, limit=10):
        """Get screenshots that need to be synced (only those with valid user_id)
        
        Args:
            limit: Maximum number of records to retrieve
        
        Returns:
            List of dictionaries with screenshot data
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Only get records with valid UUID user_id (not anonymous)
            # UUID format: 8-4-4-4-12 hex characters
            cursor.execute('''
                SELECT * FROM offline_screenshots 
                WHERE synced = 0 
                AND sync_attempts < 5
                AND user_id IS NOT NULL 
                AND user_id != ''
                AND user_id NOT LIKE 'anonymous_%'
                AND length(user_id) = 36
                ORDER BY created_at ASC
                LIMIT ?
            ''', (limit,))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [dict(row) for row in rows]
            
        except Exception as e:
            print(f"[ERROR] Failed to get pending screenshots: {e}")
            return []
    
    def mark_as_synced(self, local_id):
        """Mark a screenshot as successfully synced
        
        Args:
            local_id: Local database ID
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE offline_screenshots 
                SET synced = 1, last_sync_error = NULL
                WHERE id = ?
            ''', (local_id,))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"[ERROR] Failed to mark screenshot as synced: {e}")
    
    def mark_sync_failed(self, local_id, error_message):
        """Mark a sync attempt as failed
        
        Args:
            local_id: Local database ID
            error_message: Error message from sync attempt
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE offline_screenshots 
                SET sync_attempts = sync_attempts + 1, 
                    last_sync_error = ?
                WHERE id = ?
            ''', (error_message, local_id))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"[ERROR] Failed to mark sync as failed: {e}")
    
    def get_pending_count(self, include_anonymous=True):
        """Get count of screenshots pending sync
        
        Args:
            include_anonymous: If True, includes records without user_id
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if include_anonymous:
                cursor.execute('''
                    SELECT COUNT(*) FROM offline_screenshots 
                    WHERE synced = 0 AND sync_attempts < 5
                ''')
            else:
                cursor.execute('''
                    SELECT COUNT(*) FROM offline_screenshots 
                    WHERE synced = 0 AND sync_attempts < 5 AND user_id IS NOT NULL AND user_id != ''
                ''')
            
            count = cursor.fetchone()[0]
            conn.close()
            return count
            
        except Exception as e:
            print(f"[ERROR] Failed to get pending count: {e}")
            return 0
    
    def get_anonymous_count(self):
        """Get count of screenshots captured without user authentication"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT COUNT(*) FROM offline_screenshots 
                WHERE synced = 0 AND (user_id IS NULL OR user_id = '' OR user_id LIKE 'anonymous_%')
            ''')
            
            count = cursor.fetchone()[0]
            conn.close()
            return count
            
        except Exception as e:
            print(f"[ERROR] Failed to get anonymous count: {e}")
            return 0
    
    def associate_anonymous_records(self, user_id, organization_id=None):
        """Associate all anonymous offline records with a user after login
        
        Args:
            user_id: The actual user UUID from Supabase
            organization_id: The organization UUID (optional)
        
        Returns:
            int: Number of records updated
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Update all anonymous records with the real user_id
            if organization_id:
                cursor.execute('''
                    UPDATE offline_screenshots 
                    SET user_id = ?, organization_id = ?
                    WHERE synced = 0 AND (user_id IS NULL OR user_id = '' OR user_id LIKE 'anonymous_%')
                ''', (user_id, organization_id))
            else:
                cursor.execute('''
                    UPDATE offline_screenshots 
                    SET user_id = ?
                    WHERE synced = 0 AND (user_id IS NULL OR user_id = '' OR user_id LIKE 'anonymous_%')
                ''', (user_id,))
            
            updated = cursor.rowcount
            conn.commit()
            conn.close()
            
            if updated > 0:
                print(f"[OK] Associated {updated} anonymous screenshots with user {user_id}")
            
            return updated
            
        except Exception as e:
            print(f"[ERROR] Failed to associate anonymous records: {e}")
            return 0

    def cleanup_synced(self, days_old=0):
        """Remove synced screenshots from local database
        
        Args:
            days_old: Number of days after which to delete synced records (0 = immediate)
        """
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if days_old == 0:
                # Delete immediately after sync
                cursor.execute('''
                    DELETE FROM offline_screenshots 
                    WHERE synced = 1
                ''')
            else:
                cursor.execute('''
                    DELETE FROM offline_screenshots 
                    WHERE synced = 1 
                    AND datetime(created_at) < datetime('now', ? || ' days')
                ''', (f'-{days_old}',))
            
            deleted = cursor.rowcount
            conn.commit()
            conn.close()
            
            if deleted > 0:
                print(f"[OK] Deleted {deleted} synced screenshots from local storage")
            
        except Exception as e:
            print(f"[ERROR] Failed to cleanup synced screenshots: {e}")
    
    def sync_all(self, supabase_client, storage_client):
        """Sync all pending screenshots to Supabase
        
        Args:
            supabase_client: Supabase client for database operations
            storage_client: Supabase client for storage operations (service role)
        
        Returns:
            tuple: (synced_count, failed_count)
        """
        if self._syncing:
            print("[INFO] Sync already in progress, skipping...")
            return (0, 0)
        
        with self._sync_lock:
            self._syncing = True
            
        try:
            pending = self.get_pending_screenshots(limit=50)
            
            if not pending:
                # Check if there are anonymous records waiting
                anonymous_count = self.get_anonymous_count()
                if anonymous_count > 0:
                    print(f"[INFO] {anonymous_count} anonymous screenshots waiting for user login before sync")
                return (0, 0)
            
            print(f"[INFO] Starting offline sync: {len(pending)} screenshots to upload")
            synced = 0
            failed = 0
            
            for record in pending:
                try:
                    success = self._sync_single_screenshot(
                        record, supabase_client, storage_client
                    )
                    if success:
                        self.mark_as_synced(record['id'])
                        synced += 1
                    else:
                        # Don't increment failed for anonymous records - they're just waiting
                        user_id = record.get('user_id', '')
                        if not user_id.startswith('anonymous_'):
                            self.mark_sync_failed(record['id'], "Upload returned no success")
                            failed += 1
                except Exception as e:
                    self.mark_sync_failed(record['id'], str(e))
                    failed += 1
                    print(f"[ERROR] Failed to sync screenshot {record['id']}: {e}")
                
                # Small delay between uploads to avoid overwhelming the server
                time.sleep(0.5)
            
            print(f"[OK] Offline sync completed: {synced} synced, {failed} failed")
            
            # Cleanup old synced records
            self.cleanup_synced()
            
            return (synced, failed)
            
        finally:
            with self._sync_lock:
                self._syncing = False
    
    def _sync_single_screenshot(self, record, db_client, storage_client):
        """Sync a single screenshot record to Supabase
        
        Args:
            record: Dictionary with offline screenshot data
            db_client: Supabase client for database operations
            storage_client: Supabase client for storage operations
        
        Returns:
            bool: True if sync was successful
        """
        try:
            user_id = record['user_id']
            timestamp = record['timestamp']
            image_data = record['image_data']
            thumbnail_data = record['thumbnail_data']
            
            # Validate user_id is a proper UUID (not anonymous)
            if not user_id or user_id.startswith('anonymous_') or len(user_id) != 36:
                print(f"[WARN] Skipping record {record['id']} - invalid user_id (anonymous or not UUID)")
                return False  # Don't mark as synced, wait for user to login
            
            if not image_data:
                print(f"[WARN] Skipping record {record['id']} - no image data")
                return True  # Mark as synced to skip it
            
            # Generate filenames
            ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            filename = f"screenshot_{int(ts.timestamp())}.png"
            thumb_filename = f"thumb_{int(ts.timestamp())}.jpg"
            
            storage_path = f"{user_id}/{filename}"
            thumb_path = f"{user_id}/{thumb_filename}"
            
            # Try to upload image to storage (handle duplicates)
            screenshot_url = None
            try:
                screenshot_result = storage_client.storage.from_('screenshots').upload(
                    storage_path, image_data, file_options={'content-type': 'image/png'}
                )
                if screenshot_result:
                    screenshot_url = storage_client.storage.from_('screenshots').get_public_url(storage_path)
            except Exception as upload_err:
                error_str = str(upload_err)
                # Handle duplicate file error - file already exists, just get the URL
                if 'Duplicate' in error_str or '409' in error_str or 'already exists' in error_str.lower():
                    print(f"[INFO] File already exists in storage, using existing: {storage_path}")
                    screenshot_url = storage_client.storage.from_('screenshots').get_public_url(storage_path)
                else:
                    raise upload_err
            
            if not screenshot_url:
                raise Exception("Failed to get screenshot URL")
            
            # Try to upload thumbnail (handle duplicates)
            thumb_url = None
            if thumbnail_data:
                try:
                    thumb_result = storage_client.storage.from_('screenshots').upload(
                        thumb_path, thumbnail_data, file_options={'content-type': 'image/jpeg'}
                    )
                    if thumb_result:
                        thumb_url = storage_client.storage.from_('screenshots').get_public_url(thumb_path)
                except Exception as thumb_err:
                    error_str = str(thumb_err)
                    if 'Duplicate' in error_str or '409' in error_str or 'already exists' in error_str.lower():
                        thumb_url = storage_client.storage.from_('screenshots').get_public_url(thumb_path)
                    # Don't fail if thumbnail upload fails
            
            # Parse JSON fields
            user_issues = json.loads(record.get('user_assigned_issues') or '[]')
            metadata = json.loads(record.get('metadata') or '{}')

            # Prepare database record
            screenshot_data = {
                'user_id': user_id,
                'organization_id': record.get('organization_id'),
                'timestamp': timestamp,
                'storage_url': screenshot_url,
                'storage_path': storage_path,
                'thumbnail_url': thumb_url,
                'window_title': record.get('window_title'),
                'application_name': record.get('application_name'),
                'file_size_bytes': record.get('file_size_bytes'),
                'status': 'pending',
                'project_key': record.get('project_key'),
                'user_assigned_issues': user_issues,
                'start_time': record.get('start_time'),
                'end_time': record.get('end_time'),
                'duration_seconds': record.get('duration_seconds'),
                'metadata': metadata
            }
            
            # Insert into database
            result = db_client.table('screenshots').insert(screenshot_data).execute()
            
            if result.data:
                print(f"[OK] Synced offline screenshot to Supabase (DB ID: {result.data[0]['id']})")
                return True
            
            return False
            
        except Exception as e:
            print(f"[ERROR] Error syncing screenshot: {e}")
            raise

# ============================================================================
# CONSENT MANAGER
# ============================================================================

class ConsentManager:
    """Manages user consent for screenshot capture - GDPR/Privacy compliance"""

    CONSENT_VERSION = "1.0"  # Increment when privacy policy changes significantly

    def __init__(self, store_path=None):
        self.store_path = store_path or os.path.join(
            get_app_data_dir(), 'brd_tracker_consent.json'
        )
        self.consent_data = self._load_consent()

    def _load_consent(self):
        """Load stored consent data from file"""
        try:
            if os.path.exists(self.store_path):
                with open(self.store_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load consent data: {e}")
        return {}

    def _save_consent(self):
        """Save consent data to file"""
        try:
            with open(self.store_path, 'w') as f:
                json.dump(self.consent_data, f, indent=2)
        except Exception as e:
            print(f"[WARN] Failed to save consent data: {e}")

    def has_valid_consent(self, user_id):
        """Check if user has given valid consent for current version"""
        if not user_id:
            return False

        user_consent = self.consent_data.get(user_id, {})
        if not user_consent.get('consented', False):
            return False

        # Check if consent is for current version
        consent_version = user_consent.get('version', '0.0')
        if consent_version != self.CONSENT_VERSION:
            print(f"[INFO] Consent version mismatch ({consent_version} vs {self.CONSENT_VERSION}) - re-consent required")
            return False

        return True

    def record_consent(self, user_id, consented=True, user_email=None):
        """Record user's consent decision"""
        self.consent_data[user_id] = {
            'consented': consented,
            'version': self.CONSENT_VERSION,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'user_email': user_email,
            'data_collected': [
                'screenshots',
                'window_titles',
                'application_names',
                'timestamps',
                'jira_issues'
            ],
            'third_party_processing': [
                'OpenAI (screenshot analysis)',
                'Supabase (data storage)'
            ]
        }
        self._save_consent()
        print(f"[OK] Consent {'granted' if consented else 'denied'} for user {user_id}")

    def revoke_consent(self, user_id):
        """Revoke user's consent"""
        if user_id in self.consent_data:
            self.consent_data[user_id]['consented'] = False
            self.consent_data[user_id]['revoked_at'] = datetime.now(timezone.utc).isoformat()
            self._save_consent()
            print(f"[OK] Consent revoked for user {user_id}")

    def get_consent_info(self, user_id):
        """Get consent information for a user"""
        return self.consent_data.get(user_id, {})


# ============================================================================
# MAIN APPLICATION
# ============================================================================

class BRDTimeTracker:
    """Main application class"""

    def __init__(self):
        print("[INFO] Initializing BRD Time Tracker...")

        # Configuration (defaults, will be overridden by server settings)
        self.capture_interval = int(get_env_var('CAPTURE_INTERVAL', 300))
        self.web_port = int(get_env_var('WEB_PORT', 51777))

        # Supabase clients (initialized after authentication)
        self.supabase = None
        self.supabase_service = None
        self.supabase_url = None
        self.supabase_initialized = False

        # Initialize Atlassian Auth FIRST (needed to fetch Supabase config)
        self.auth_manager = AtlassianAuthManager(web_port=self.web_port)
        
        # User state
        self.current_user = None
        self.current_user_id = None  # UUID from public.users table
        
        # ============================================================================
        # TRACKING SETTINGS (loaded from Supabase, configurable by admins)
        # ============================================================================
        self.tracking_settings = {
            'screenshot_monitoring_enabled': True,
            'screenshot_interval_seconds': 900,  # 15 minutes default
            'tracking_mode': 'interval',  # 'interval' or 'event'
            'event_tracking_enabled': False,
            'track_window_changes': True,
            'track_idle_time': True,
            'idle_threshold_seconds': 300,  # 5 minutes
            'whitelist_enabled': True,
            'whitelisted_apps': ['vscode', 'code', 'chrome', 'slack', 'jira', 'github', 'zoom', 'teams'],
            'blacklist_enabled': True,
            'blacklisted_apps': ['netflix', 'youtube', 'spotify', 'facebook', 'instagram', 'twitter', 'tiktok'],
            'non_work_threshold_percent': 30,
            'flag_excessive_non_work': True,
            'private_sites_enabled': True,
            'private_sites': []
        }
        self.tracking_settings_last_fetch = None
        self.tracking_settings_cache_ttl = 300  # Refresh settings every 5 minutes
        
        # ============================================================================
        # UNASSIGNED WORK NOTIFICATION SETTINGS
        # ============================================================================
        self.notification_settings = {
            'enabled': True,  # Whether desktop notifications are enabled
            'interval_hours': 24,  # How often to check/notify (hours) - once a day
            'min_unassigned_minutes': 30  # Minimum unassigned time before notifying
        }
        self.last_notification_time = 0  # Timestamp of last notification
        self.notification_settings_last_fetch = None
        self.notification_settings_cache_ttl = 300  # Refresh every 5 minutes
        
        # Tracking state
        self.running = False
        self.tracking_active = False
        self.is_idle = False  # Idle state - when no activity for idle_timeout seconds
        self.needs_idle_resume = False  # Flag set by pynput when activity detected during idle
        self.last_activity_time = time.time()  # Last mouse/keyboard activity
        self.idle_timeout = 300  # 5 minutes idle timeout (in seconds)
        self._tracking_thread = None
        self._activity_monitor_thread = None  # Activity monitoring thread
        self.screenshot_hash = None
        
        # Event-based tracking: Window switch detection
        self.current_window_key = None  # Unique identifier for current window (app + title)
        self.current_window_start_time = None  # When current window became active (updated after each screenshot)
        self.current_window_db_start_time = None  # Actual start_time saved to database (for accurate duration calc)
        self.current_window_record_created_at = None  # When the record was actually inserted (for interval safeguard)
        self.current_window_screenshot_id = None  # ID of the current screenshot (to update later when switching)
        self.last_interval_time = None  # When last INTERVAL screenshot was taken (fixed 5-min clock)
        self.last_screenshot_end_time = None  # End time of last screenshot record (to ensure no gaps)
        self.previous_window_key = None  # Previous window (to capture final screenshot with full duration)
        self.previous_window_start_time = None  # When previous window became active
        self.previous_window_db_start_time = None  # Actual start_time from database (for accurate duration calc)
        self.previous_window_info = None  # Previous window info (title, app)
        self.previous_window_screenshot_id = None  # ID of the "start" screenshot for previous window (to update)
        
        # Jira issue caching
        self.user_issues = []  # Cache of user's In Progress Jira issues
        self.issues_cache_time = None  # Last time issues were fetched
        self.issues_cache_ttl = 300  # 5 minutes cache TTL
        self.jira_cloud_id = None  # Cached Jira cloud ID

        # Jira project caching (for users without assigned issues)
        self.user_projects = []  # Cache of user's accessible Jira projects
        self.projects_cache_time = None  # Last time projects were fetched
        self.projects_cache_ttl = 3600  # 1 hour cache TTL (projects change less frequently)

        # Multi-tenancy: Organization info
        self.organization_id = None  # UUID from public.organizations table
        self.organization_name = None  # Organization name (Jira site name)
        self.jira_instance_url = None  # Jira instance URL
        
        # Offline mode support
        self.offline_manager = OfflineManager()
        self._sync_thread = None
        self._last_sync_time = 0
        self._sync_interval = 60  # Try to sync every 60 seconds when online

        # Consent management (GDPR/Privacy compliance)
        self.consent_manager = ConsentManager()

        # AI analysis is handled by the separate AI server
        # Desktop app only captures and uploads screenshots
        
        # Flask app
        self.app = Flask(__name__)
        self.app.secret_key = secrets.token_hex(16)
        CORS(self.app)
        
        # System tray
        self.tray = None

        # Admin configuration
        self.admin_password = get_env_var('ADMIN_PASSWORD', 'admin123')  # Default password, should be changed
        self.admin_session_token = None
        self.admin_logs = []  # In-memory log storage
        self.max_log_entries = 500  # Maximum log entries to keep

        # Setup routes
        self.setup_routes()

        print("[OK] Application initialized")
        self.add_admin_log('INFO', 'Application started')

    def initialize_supabase(self):
        """Initialize Supabase clients after fetching config from AI server.
        Must be called after successful authentication."""
        if self.supabase_initialized:
            print("[INFO] Supabase already initialized")
            return True

        # Fetch Supabase config from AI server (requires valid Atlassian token)
        print("[INFO] Fetching Supabase configuration from AI server...")
        if not self.auth_manager.get_supabase_config():
            print("[ERROR] Failed to get Supabase config from AI server")
            return False

        # Now initialize Supabase clients with runtime config
        try:
            self.supabase_url = get_env_var('SUPABASE_URL')
            supabase_anon_key = get_env_var('SUPABASE_ANON_KEY')
            supabase_service_key = get_env_var('SUPABASE_SERVICE_ROLE_KEY')

            if not self.supabase_url or not supabase_anon_key:
                print("[ERROR] Supabase URL or anon key not available")
                return False

            # Initialize anonymous client
            self.supabase: Client = create_client(self.supabase_url, supabase_anon_key)
            print(f"[OK] Supabase client initialized for {self.supabase_url}")

            # Initialize service client for admin operations (bypasses RLS)
            if supabase_service_key:
                self.supabase_service: Client = create_client(self.supabase_url, supabase_service_key)
                print("[OK] Supabase service client initialized")
            else:
                self.supabase_service = self.supabase
                print("[WARN] No service role key - using anon client for all operations")

            self.supabase_initialized = True
            self.add_admin_log('INFO', 'Supabase initialized from AI server config')
            return True

        except Exception as e:
            print(f"[ERROR] Failed to initialize Supabase clients: {e}")
            traceback.print_exc()
            return False

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
                # Exchange code for tokens via AI Server (ATLASSIAN_CLIENT_SECRET is on server)
                tokens = self.auth_manager.handle_callback(code, state)

                # Get user info from Atlassian
                user_info = self.auth_manager.get_user_info()
                if not user_info:
                    return "Failed to get user information", 500

                # Initialize Supabase clients (fetches config from AI server)
                if not self.initialize_supabase():
                    return "Failed to initialize database connection", 500

                # Check if we had anonymous tracking before login
                had_anonymous = self.current_user_id and self.current_user_id.startswith('anonymous_')

                # Create or update user in Supabase
                self.current_user = user_info
                self.current_user_id = self.ensure_user_exists(user_info)
                
                print(f"[OK] Authenticated user: {user_info.get('email', 'unknown')}")

                # Associate any anonymous offline records with this user
                self._associate_offline_records()

                # Update tray icon to blue (logged in, tracking not started yet)
                self.update_tray_icon()

                # Check if user has given consent for screenshot capture
                user_account_id = user_info.get('account_id')
                if not self.consent_manager.has_valid_consent(user_account_id):
                    # Redirect to consent page first
                    print(f"[INFO] User {user_info.get('email')} needs to provide consent")
                    return redirect('/consent')

                # User has consent - start tracking if not already running
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
            # Get offline status
            is_online = self.offline_manager.check_connectivity(force=False)
            pending_offline = self.offline_manager.get_pending_count()
            
            return jsonify({
                'authenticated': self.current_user is not None,
                'tracking': self.tracking_active,
                'user': self.current_user.get('email') if self.current_user else None,
                'online': is_online,
                'offline_pending': pending_offline,
                'idle': self.is_idle
            })
        
        @self.app.route('/api/offline/sync', methods=['POST'])
        def api_trigger_sync():
            """Manually trigger offline sync"""
            if not self.current_user_id:
                return jsonify({'error': 'Not authenticated'}), 401
            
            result = self.sync_offline_data(force=True)
            if result:
                synced, failed = result
                return jsonify({
                    'success': True,
                    'synced': synced,
                    'failed': failed,
                    'remaining': self.offline_manager.get_pending_count()
                })
            else:
                return jsonify({
                    'success': False,
                    'message': 'No data to sync or offline',
                    'remaining': self.offline_manager.get_pending_count()
                })
        
        @self.app.route('/api/offline/status')
        def api_offline_status():
            """Get offline storage status"""
            is_online = self.offline_manager.check_connectivity(force=True)
            pending = self.offline_manager.get_pending_count()
            
            return jsonify({
                'online': is_online,
                'pending_screenshots': pending,
                'sync_interval_seconds': self._sync_interval,
                'last_sync_time': self._last_sync_time if self._last_sync_time > 0 else None,
                'database_path': self.offline_manager.db_path
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

        # ============================================================================
        # ADMIN ROUTES
        # ============================================================================

        @self.app.route('/admin')
        def admin_login_page():
            """Admin login page"""
            # Check if already authenticated
            session_token = request.cookies.get('admin_session')
            if session_token and session_token == self.admin_session_token:
                return redirect('/admin/dashboard')
            return self.render_admin_login_page()

        @self.app.route('/admin/login', methods=['POST'])
        def admin_login():
            """Handle admin login"""
            password = request.form.get('password', '')

            if password == self.admin_password:
                # Generate session token
                self.admin_session_token = secrets.token_hex(32)
                self.add_admin_log('INFO', 'Admin logged in successfully')

                response = redirect('/admin/dashboard')
                response.set_cookie('admin_session', self.admin_session_token, httponly=True, max_age=3600)
                return response
            else:
                self.add_admin_log('WARN', 'Failed admin login attempt')
                return self.render_admin_login_page(error='Invalid password')

        @self.app.route('/admin/dashboard')
        def admin_dashboard():
            """Admin dashboard"""
            session_token = request.cookies.get('admin_session')
            if not session_token or session_token != self.admin_session_token:
                return redirect('/admin')
            return self.render_admin_dashboard()

        @self.app.route('/admin/logout')
        def admin_logout():
            """Admin logout"""
            self.add_admin_log('INFO', 'Admin logged out')
            self.admin_session_token = None
            response = redirect('/admin')
            response.delete_cookie('admin_session')
            return response

        @self.app.route('/api/admin/logs')
        def api_admin_logs():
            """Get admin logs"""
            session_token = request.cookies.get('admin_session')
            if not session_token or session_token != self.admin_session_token:
                return jsonify({'error': 'Unauthorized'}), 401

            # Get optional filters
            level = request.args.get('level', None)
            limit = int(request.args.get('limit', 100))

            logs = self.admin_logs[-limit:]
            if level:
                logs = [l for l in logs if l['level'] == level.upper()]

            return jsonify({'logs': logs})

        @self.app.route('/api/admin/status')
        def api_admin_status():
            """Get detailed admin status"""
            session_token = request.cookies.get('admin_session')
            if not session_token or session_token != self.admin_session_token:
                return jsonify({'error': 'Unauthorized'}), 401

            # Count screenshots from today's logs
            from datetime import date
            today = date.today().isoformat()
            screenshots_today = sum(1 for log in self.admin_logs 
                                   if 'Screenshot captured' in log.get('message', '') 
                                   and log.get('timestamp', '').startswith(today))

            # Get session start time from first log or tracking start
            session_start = None
            if self.admin_logs:
                session_start = self.admin_logs[0].get('timestamp')

            return jsonify({
                'tracking_active': self.tracking_active,
                'is_idle': self.is_idle,
                'running': self.running,
                'current_user': self.current_user.get('email') if self.current_user else None,
                'organization': self.organization_name,
                'online': self.offline_manager.check_connectivity(force=False),
                'offline_pending': self.offline_manager.get_pending_count(),
                'capture_interval': self.capture_interval,
                'screenshot_interval': self.capture_interval,
                'tracking_settings': self.tracking_settings,
                'total_logs': len(self.admin_logs),
                'screenshots_today': screenshots_today,
                'session_start': session_start
            })

        @self.app.route('/api/admin/control', methods=['POST'])
        def api_admin_control():
            """Admin control actions"""
            session_token = request.cookies.get('admin_session')
            if not session_token or session_token != self.admin_session_token:
                return jsonify({'error': 'Unauthorized'}), 401

            data = request.get_json() or {}
            action = data.get('action')

            if action == 'start_tracking':
                # GDPR compliance: Check consent before starting tracking
                if self.current_user:
                    user_account_id = self.current_user.get('account_id')
                    if not self.consent_manager.has_valid_consent(user_account_id):
                        self.add_admin_log('WARN', 'Cannot start tracking - user consent not given')
                        return jsonify({
                            'success': False,
                            'error': 'User consent required before tracking can start',
                            'redirect': '/consent'
                        }), 403

                if not self.running:
                    self.start_tracking()
                    self.add_admin_log('INFO', 'Tracking started by admin')
                return jsonify({'success': True, 'message': 'Tracking started'})

            elif action == 'stop_tracking':
                if self.running:
                    self.stop_tracking()
                    self.add_admin_log('INFO', 'Tracking stopped by admin')
                return jsonify({'success': True, 'message': 'Tracking stopped'})

            elif action == 'clear_logs':
                self.admin_logs = []
                self.add_admin_log('INFO', 'Logs cleared by admin')
                return jsonify({'success': True, 'message': 'Logs cleared'})

            elif action == 'force_sync':
                try:
                    synced, failed = self.offline_manager.sync_pending_screenshots(self)
                    self.add_admin_log('INFO', f'Force sync completed: {synced} synced, {failed} failed')
                    return jsonify({'success': True, 'synced': synced, 'failed': failed})
                except Exception as e:
                    self.add_admin_log('ERROR', f'Force sync failed: {str(e)}')
                    return jsonify({'success': False, 'error': str(e)}), 500

            elif action == 'refresh_settings':
                self.load_tracking_settings()
                self.add_admin_log('INFO', 'Settings refreshed by admin')
                return jsonify({'success': True, 'message': 'Settings refreshed'})

            else:
                return jsonify({'error': 'Unknown action'}), 400

        # ============================================================================
        # CONSENT ROUTES (GDPR/Privacy Compliance)
        # ============================================================================

        @self.app.route('/consent')
        def consent_page():
            """Display consent page for screenshot capture"""
            if not self.current_user:
                return redirect('/login')
            return self.render_consent_page()

        @self.app.route('/consent/submit', methods=['POST'])
        def consent_submit():
            """Handle consent form submission"""
            if not self.current_user:
                return redirect('/login')

            consented = request.form.get('consent') == 'agree'
            user_id = self.current_user.get('account_id')
            user_email = self.current_user.get('email')

            if consented:
                # Record consent
                self.consent_manager.record_consent(user_id, True, user_email)
                self.add_admin_log('INFO', f'User {user_email} granted consent for screenshot capture')

                # Now start tracking
                if not self.running:
                    self.start_tracking()

                return redirect('/success')
            else:
                # Record denial
                self.consent_manager.record_consent(user_id, False, user_email)
                self.add_admin_log('INFO', f'User {user_email} denied consent for screenshot capture')
                return self.render_consent_denied_page()

        @self.app.route('/consent/revoke', methods=['POST'])
        def consent_revoke():
            """Revoke previously given consent"""
            if not self.current_user:
                return jsonify({'error': 'Not authenticated'}), 401

            user_id = self.current_user.get('account_id')
            user_email = self.current_user.get('email')

            # Revoke consent
            self.consent_manager.revoke_consent(user_id)

            # Stop tracking
            if self.running:
                self.stop_tracking()

            self.add_admin_log('INFO', f'User {user_email} revoked consent for screenshot capture')
            return jsonify({'success': True, 'message': 'Consent revoked. Screenshot tracking has been stopped.'})

        @self.app.route('/api/consent/status')
        def api_consent_status():
            """Get consent status for current user"""
            if not self.current_user:
                return jsonify({'error': 'Not authenticated'}), 401

            user_id = self.current_user.get('account_id')
            has_consent = self.consent_manager.has_valid_consent(user_id)
            consent_info = self.consent_manager.get_consent_info(user_id)

            return jsonify({
                'has_consent': has_consent,
                'consent_version': ConsentManager.CONSENT_VERSION,
                'consent_info': consent_info
            })

    # ============================================================================
    # ADMIN HELPER METHODS
    # ============================================================================

    def add_admin_log(self, level, message, details=None):
        """Add a log entry for admin panel

        Args:
            level: Log level (INFO, WARN, ERROR)
            message: Log message
            details: Optional dict with additional details to display
        """
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'level': level.upper(),
            'message': message
        }
        if details:
            log_entry['details'] = details
        self.admin_logs.append(log_entry)

        # Keep only last N entries
        if len(self.admin_logs) > self.max_log_entries:
            self.admin_logs = self.admin_logs[-self.max_log_entries:]

    def refresh_supabase_client(self):
        """Refresh Supabase client with user-scoped JWT from AI Server"""
        try:
            # Get a valid Supabase token from the auth manager
            supabase_token = self.auth_manager.get_valid_supabase_token()

            if not supabase_token:
                print("[WARN] Could not get Supabase token - using anon key only")
                return False

            # Create a new Supabase client with the user token
            # This client will have RLS-scoped access based on the user's identity
            self.supabase_service = create_client(
                self.supabase_url,
                supabase_token
            )
            print("[OK] Supabase service client refreshed with user token")
            return True

        except Exception as e:
            print(f"[ERROR] Failed to refresh Supabase client: {e}")
            self.supabase_service = None
            return False

    def ensure_user_exists(self, atlassian_user):
        """Ensure user exists in Supabase users table and is linked to organization"""
        account_id = atlassian_user.get('account_id')
        email = atlassian_user.get('email')
        name = atlassian_user.get('name', email.split('@')[0] if email else 'User')

        if not account_id:
            raise ValueError("No account_id in Atlassian user info")

        # First, ensure we have organization info
        if not self.organization_id:
            self.get_jira_cloud_id()  # This will also register the organization

        # Use service client to bypass RLS
        client = self.supabase_service if self.supabase_service else self.supabase

        # Check if user exists
        result = client.table('users').select('id, organization_id').eq(
            'atlassian_account_id', account_id
        ).execute()

        if result.data:
            user_id = result.data[0]['id']
            existing_org_id = result.data[0].get('organization_id')
            print(f"[OK] Found existing user: {user_id}")

            # Check if we need to update user details
            existing_user = client.table('users').select('display_name, email').eq('id', user_id).execute()
            existing_display_name = existing_user.data[0].get('display_name') if existing_user.data else None
            existing_email = existing_user.data[0].get('email') if existing_user.data else None

            # Update if organization changed OR if details are missing
            needs_update = (
                (self.organization_id and existing_org_id != self.organization_id) or
                (not existing_display_name and name) or
                (not existing_email and email)
            )

            if needs_update:
                update_data = {
                    'organization_id': self.organization_id or existing_org_id,
                    'display_name': name or existing_display_name,
                    'email': email or existing_email
                }
                client.table('users').update(update_data).eq('id', user_id).execute()
                print(f"[OK] Updated user details: org={self.organization_id}, name={name}")

                # Ensure organization membership exists
                if self.organization_id:
                    self._ensure_organization_membership(user_id)
        else:
            # Create new user with organization
            user_data = {
                'atlassian_account_id': account_id,
                'email': email,
                'display_name': name,
                'organization_id': self.organization_id
            }
            create_result = client.table('users').insert(user_data).execute()
            if create_result.data:
                user_id = create_result.data[0]['id']
                print(f"[OK] Created new user: {user_id}")

                # Create organization membership
                self._ensure_organization_membership(user_id)
            else:
                raise Exception("Failed to create user")

        # Cache user info for offline mode
        self._save_cached_user_info(atlassian_user, user_id)
        
        return user_id

    def _get_user_cache_path(self):
        """Get path to user cache file"""
        return os.path.join(get_app_data_dir(), 'brd_tracker_user_cache.json')
    
    def _save_cached_user_info(self, atlassian_user, user_id):
        """Save user info locally for offline mode"""
        try:
            cache_data = {
                'account_id': atlassian_user.get('account_id'),
                'email': atlassian_user.get('email'),
                'name': atlassian_user.get('name'),
                'user_id': user_id,
                'organization_id': self.organization_id,
                'cached_at': datetime.now().isoformat()
            }
            with open(self._get_user_cache_path(), 'w') as f:
                json.dump(cache_data, f)
            print(f"[OK] User info cached for offline mode")
        except Exception as e:
            print(f"[WARN] Failed to cache user info: {e}")
    
    def _load_cached_user_info(self):
        """Load cached user info for offline mode"""
        try:
            cache_path = self._get_user_cache_path()
            if os.path.exists(cache_path):
                with open(cache_path, 'r') as f:
                    cache_data = json.load(f)
                
                # Restore organization_id from cache
                if cache_data.get('organization_id'):
                    self.organization_id = cache_data['organization_id']
                
                return cache_data
        except Exception as e:
            print(f"[WARN] Failed to load cached user info: {e}")
        return None
    
    def _load_cached_user_id(self):
        """Load only the user_id from cache"""
        cached = self._load_cached_user_info()
        if cached:
            return cached.get('user_id')
        return None

    def _associate_offline_records(self):
        """Associate any anonymous offline records with the current user"""
        if not self.current_user_id or self.current_user_id.startswith('anonymous_'):
            return
        
        # Get count of anonymous records
        anonymous_count = self.offline_manager.get_anonymous_count()
        
        if anonymous_count > 0:
            print(f"[INFO] Found {anonymous_count} anonymous screenshots to associate...")
            updated = self.offline_manager.associate_anonymous_records(
                self.current_user_id,
                self.organization_id
            )
            
            if updated > 0:
                # Trigger sync to upload the newly associated records
                print(f"[INFO] Triggering sync for {updated} newly associated screenshots...")
                threading.Thread(
                    target=lambda: self.sync_offline_data(force=True),
                    daemon=True
                ).start()

    def _ensure_organization_membership(self, user_id):
        """Ensure user has membership entry in organization_members table"""
        if not self.organization_id or not user_id:
            return

        try:
            client = self.supabase_service if self.supabase_service else self.supabase

            # Check if membership exists
            result = client.table('organization_members').select('id').eq(
                'user_id', user_id
            ).eq('organization_id', self.organization_id).execute()

            if not result.data:
                # Create membership - first user becomes owner, others are members
                # Check if org has any members
                member_count = client.table('organization_members').select('id', count='exact').eq(
                    'organization_id', self.organization_id
                ).execute()

                is_first_user = member_count.count == 0 if hasattr(member_count, 'count') else len(member_count.data) == 0
                role = 'owner' if is_first_user else 'member'

                membership_data = {
                    'user_id': user_id,
                    'organization_id': self.organization_id,
                    'role': role,
                    'can_manage_settings': role in ['owner', 'admin'],
                    'can_view_team_analytics': role in ['owner', 'admin', 'manager'],
                    'can_manage_members': role in ['owner', 'admin'],
                    'can_delete_screenshots': role in ['owner', 'admin'],
                    'can_manage_billing': role == 'owner'
                }
                client.table('organization_members').insert(membership_data).execute()
                print(f"[OK] Created organization membership with role: {role}")

        except Exception as e:
            print(f"[WARN] Failed to create organization membership: {e}")
    
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
                    # Get the first (selected during OAuth) resource
                    selected_resource = resources[0]
                    self.jira_cloud_id = selected_resource['id']
                    self.organization_name = selected_resource.get('name', 'Unknown Organization')
                    self.jira_instance_url = selected_resource.get('url', '')

                    print(f"[OK] Using Jira Cloud ID: {self.jira_cloud_id}")
                    print(f"[OK] Organization: {self.organization_name}")
                    print(f"[OK] Jira URL: {self.jira_instance_url}")

                    # Register organization in database
                    self.register_organization()

                    return self.jira_cloud_id
            else:
                print(f"[ERROR] Failed to get resources: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[ERROR] Failed to get Jira cloud ID: {e}")

        return None

    def register_organization(self):
        """Register or update organization in Supabase database"""
        if not self.jira_cloud_id:
            print("[WARN] Cannot register organization: No Jira Cloud ID")
            return None

        try:
            # Use service client to bypass RLS
            client = self.supabase_service if self.supabase_service else self.supabase

            # Check if organization already exists
            result = client.table('organizations').select('id').eq(
                'jira_cloud_id', self.jira_cloud_id
            ).execute()

            if result.data:
                # Organization exists
                self.organization_id = result.data[0]['id']
                print(f"[OK] Found existing organization: {self.organization_id}")

                # Update organization info if changed
                client.table('organizations').update({
                    'org_name': self.organization_name,
                    'jira_instance_url': self.jira_instance_url
                }).eq('id', self.organization_id).execute()
            else:
                # Create new organization
                org_data = {
                    'jira_cloud_id': self.jira_cloud_id,
                    'org_name': self.organization_name,
                    'jira_instance_url': self.jira_instance_url,
                    'subscription_status': 'active',
                    'subscription_tier': 'free'
                }
                create_result = client.table('organizations').insert(org_data).execute()

                if create_result.data:
                    self.organization_id = create_result.data[0]['id']
                    print(f"[OK] Created new organization: {self.organization_id}")

                    # Create default organization settings
                    settings_data = {
                        'organization_id': self.organization_id,
                        'screenshot_interval': self.capture_interval,
                        'auto_worklog_enabled': True
                    }
                    client.table('organization_settings').insert(settings_data).execute()
                    print(f"[OK] Created organization settings")
                else:
                    raise Exception("Failed to create organization")

            return self.organization_id

        except Exception as e:
            print(f"[ERROR] Failed to register organization: {e}")
            traceback.print_exc()
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
                    'fields': ['summary', 'status', 'project', 'description', 'labels']
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
                            'fields': ['summary', 'status', 'project', 'description', 'labels']
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

                # Extract and format issue data with description and labels
                formatted_issues = []
                for issue in issues:
                    fields = issue['fields']

                    # Get description text (handle ADF format)
                    description = ''
                    if fields.get('description'):
                        # Jira uses Atlassian Document Format (ADF)
                        # Extract plain text from content
                        desc_content = fields['description']
                        if isinstance(desc_content, dict) and desc_content.get('content'):
                            # Simple text extraction from ADF
                            text_parts = []
                            for content_item in desc_content.get('content', []):
                                if content_item.get('type') == 'paragraph':
                                    for text_node in content_item.get('content', []):
                                        if text_node.get('type') == 'text':
                                            text_parts.append(text_node.get('text', ''))
                            description = ' '.join(text_parts).strip()
                        elif isinstance(desc_content, str):
                            description = desc_content

                    # Get labels (array of strings)
                    labels = fields.get('labels', [])

                    formatted_issues.append({
                        'key': issue['key'],
                        'summary': fields['summary'],
                        'status': fields['status']['name'],
                        'project': fields['project']['key'],
                        'description': description,
                        'labels': labels
                    })

                return formatted_issues
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

    def fetch_jira_projects(self):
        """Fetch user's accessible Jira projects with automatic token refresh on 401

        This is used as a fallback when the user has no assigned issues.
        If they only have access to one project, we can use that as the default.

        Uses the paginated /project/search endpoint (recommended by Atlassian).
        Requires OAuth scope: read:jira-work
        """
        print("[INFO] Fetching user's accessible Jira projects...")
        cloud_id = self.get_jira_cloud_id()
        if not cloud_id:
            print("[WARN] Cannot fetch projects: No Cloud ID")
            return []

        access_token = self.auth_manager.tokens.get('access_token')
        if not access_token:
            print("[WARN] Cannot fetch projects: No access token")
            return []

        try:
            # Use /rest/api/3/project/search (paginated, recommended by Atlassian)
            # This returns projects where user has Browse Projects permission
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

            # Handle 401 - token expired
            if response.status_code == 401:
                print("[WARN] Access token expired (401), attempting refresh...")
                if self.auth_manager.refresh_access_token():
                    # Retry with new token
                    access_token = self.auth_manager.tokens.get('access_token')
                    print("[INFO] Retrying Jira API with refreshed token...")
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
                else:
                    print("[ERROR] Token refresh failed, please re-authenticate")
                    return []

            if response.status_code == 200:
                data = response.json()
                projects = data.get('values', [])
                print(f"[OK] User has access to {len(projects)} projects")

                # Format project data
                formatted_projects = []
                for project in projects:
                    formatted_projects.append({
                        'key': project.get('key'),
                        'name': project.get('name'),
                        'id': project.get('id')
                    })

                return formatted_projects
            else:
                print(f"[ERROR] Jira projects API failed: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"[ERROR] Failed to fetch Jira projects: {e}")

        return []

    def should_refresh_projects_cache(self):
        """Check if projects cache needs to be refreshed"""
        if not self.projects_cache_time:
            return True

        return (time.time() - self.projects_cache_time) > self.projects_cache_ttl

    def get_user_project_key(self):
        """Get project key from user's issues or projects

        Priority:
        1. If user has assigned issues, use the project from first issue
        2. If no issues but has accessible projects, use first project
        3. Return None if no project can be determined
        """
        # Try from issues first
        if self.user_issues and len(self.user_issues) > 0:
            project_key = self.user_issues[0].get('project')
            if project_key:
                return project_key

        # Fallback to projects
        if self.should_refresh_projects_cache():
            self.user_projects = self.fetch_jira_projects()
            self.projects_cache_time = time.time()

        if self.user_projects and len(self.user_projects) > 0:
            # If user only has one project, definitely use it
            # If multiple projects, use the first one (could be enhanced with user preference)
            project_key = self.user_projects[0].get('key')
            if project_key:
                if len(self.user_projects) == 1:
                    print(f"[INFO] User has single project: {project_key}")
                else:
                    print(f"[INFO] Using first of {len(self.user_projects)} projects: {project_key}")
                return project_key

        return None

    # ============================================================================
    # TRACKING SETTINGS MANAGEMENT
    # ============================================================================
    
    def fetch_tracking_settings(self):
        """Fetch tracking settings from Supabase (configured by admins in Forge app)"""
        try:
            # Check if we need to refresh settings
            if self.tracking_settings_last_fetch is not None:
                time_since_fetch = time.time() - self.tracking_settings_last_fetch
                if time_since_fetch < self.tracking_settings_cache_ttl:
                    return  # Use cached settings
            
            client = self.supabase_service if self.supabase_service else self.supabase
            
            # Fetch settings for current organization (or global settings)
            query = client.table('tracking_settings').select('*')
            
            # If we have an organization_id, filter by it
            if self.organization_id:
                query = query.eq('organization_id', self.organization_id)
            else:
                # Try to get global settings (organization_id is null)
                query = query.is_('organization_id', 'null')
            
            result = query.limit(1).execute()
            
            if result.data and len(result.data) > 0:
                settings = result.data[0]
                
                # Map database columns to local settings
                self.tracking_settings = {
                    'screenshot_monitoring_enabled': settings.get('screenshot_monitoring_enabled', True),
                    'screenshot_interval_seconds': settings.get('screenshot_interval_seconds', 900),
                    'tracking_mode': settings.get('tracking_mode', 'interval'),
                    'event_tracking_enabled': settings.get('event_tracking_enabled', False),
                    'track_window_changes': settings.get('track_window_changes', True),
                    'track_idle_time': settings.get('track_idle_time', True),
                    'idle_threshold_seconds': settings.get('idle_threshold_seconds', 300),
                    'whitelist_enabled': settings.get('whitelist_enabled', True),
                    'whitelisted_apps': settings.get('whitelisted_apps', []),
                    'blacklist_enabled': settings.get('blacklist_enabled', True),
                    'blacklisted_apps': settings.get('blacklisted_apps', []),
                    'non_work_threshold_percent': settings.get('non_work_threshold_percent', 30),
                    'flag_excessive_non_work': settings.get('flag_excessive_non_work', True),
                    'private_sites_enabled': settings.get('private_sites_enabled', True),
                    'private_sites': settings.get('private_sites', [])
                }
                
                # Update capture interval from settings
                self.capture_interval = self.tracking_settings['screenshot_interval_seconds']
                self.idle_timeout = self.tracking_settings['idle_threshold_seconds']
                
                self.tracking_settings_last_fetch = time.time()
                print(f"[OK] Tracking settings loaded - interval: {self.capture_interval}s, whitelist: {len(self.tracking_settings['whitelisted_apps'])} apps, blacklist: {len(self.tracking_settings['blacklisted_apps'])} apps")
                self.add_admin_log('INFO', f'Settings loaded: interval={self.capture_interval}s')

            else:
                print("[INFO] No tracking settings found in Supabase, using defaults")
                self.tracking_settings_last_fetch = time.time()
                
        except Exception as e:
            print(f"[WARN] Failed to fetch tracking settings: {e}")
            # Continue with default settings
    
    # ============================================================================
    # UNASSIGNED WORK NOTIFICATION FUNCTIONS
    # ============================================================================
    
    def fetch_notification_settings(self):
        """Fetch notification settings for unassigned work reminders from Supabase"""
        try:
            # Check if we need to refresh settings
            if self.notification_settings_last_fetch is not None:
                time_since_fetch = time.time() - self.notification_settings_last_fetch
                if time_since_fetch < self.notification_settings_cache_ttl:
                    return  # Use cached settings
            
            if not self.current_user_id:
                return  # No user logged in
            
            client = self.supabase_service if self.supabase_service else self.supabase
            
            # Fetch user's settings from users table
            result = client.table('users').select('settings').eq('id', self.current_user_id).limit(1).execute()
            
            if result.data and len(result.data) > 0 and result.data[0].get('settings'):
                settings = result.data[0]['settings']
                self.notification_settings = {
                    'enabled': settings.get('unassigned_work_notifications_enabled', True),
                    'interval_hours': settings.get('notification_interval_hours', 24),
                    'min_unassigned_minutes': settings.get('min_unassigned_minutes', 30)
                }
                print(f"[OK] Notification settings loaded - enabled: {self.notification_settings['enabled']}, interval: {self.notification_settings['interval_hours']}h")
            
            self.notification_settings_last_fetch = time.time()
            
        except Exception as e:
            print(f"[WARN] Failed to fetch notification settings: {e}")
            # Continue with default settings
    
    def get_unassigned_work_summary(self):
        """Get summary of unassigned work from Supabase"""
        try:
            if not self.current_user_id or not self.organization_id:
                return None
            
            client = self.supabase_service if self.supabase_service else self.supabase
            
            # Query unassigned work groups that are not yet assigned
            result = client.table('unassigned_work_groups').select('id,total_seconds').eq(
                'user_id', self.current_user_id
            ).eq(
                'organization_id', self.organization_id
            ).eq(
                'is_assigned', False
            ).execute()
            
            if result.data:
                total_groups = len(result.data)
                total_seconds = sum(g.get('total_seconds', 0) for g in result.data)
                return {
                    'pending_groups': total_groups,
                    'total_seconds': total_seconds,
                    'total_minutes': total_seconds // 60,
                    'total_hours': round(total_seconds / 3600, 1)
                }
            
            return {'pending_groups': 0, 'total_seconds': 0, 'total_minutes': 0, 'total_hours': 0}
            
        except Exception as e:
            print(f"[WARN] Failed to get unassigned work summary: {e}")
            return None
    
    def show_unassigned_work_notification(self, summary):
        """Show Windows toast notification for unassigned work"""
        if not WINOTIFY_AVAILABLE:
            print("[INFO] Notifications not available (winotify not installed)")
            return

        if not summary or summary['pending_groups'] == 0:
            return

        try:
            # Format the notification message
            if summary['total_hours'] >= 1:
                time_str = f"{summary['total_hours']}h"
            else:
                time_str = f"{summary['total_minutes']}m"

            notification = Notification(
                app_id="BRD Time Tracker",
                title="📋 Unassigned Work Reminder",
                msg=f"You have {summary['pending_groups']} work session(s) ({time_str}) that need to be assigned to Jira issues.",
                duration="long"
            )

            # Build URL to Jira Forge app's Time Tracker page
            jira_app_url = self._get_jira_app_url()
            notification.add_actions(label="Open in Jira", launch=jira_app_url)

            # Set notification sound
            notification.set_audio(audio.Default, loop=False)

            # Show the notification
            notification.show()

            print(f"[OK] Unassigned work notification shown - {summary['pending_groups']} groups, {time_str} total")
            print(f"[INFO] Notification URL: {jira_app_url}")

        except Exception as e:
            print(f"[WARN] Failed to show notification: {e}")

    def _get_jira_app_url(self, tab=None):
        """Build the URL to open the Jira Forge app (Time Tracker)

        Args:
            tab: Optional tab parameter (currently not used as Jira handles its own navigation)
        """
        # Ensure we have issues cached (fetch if empty)
        if not self.user_issues or len(self.user_issues) == 0:
            print("[INFO] Fetching Jira issues for notification URL...")
            self.user_issues = self.fetch_jira_issues()
            self.issues_cache_time = time.time()

        # Get a project key from user's cached issues
        project_key = None
        if self.user_issues and len(self.user_issues) > 0:
            # Use the project key from the first issue
            project_key = self.user_issues[0].get('project')

        # If we have Jira instance URL and a project key, build the Forge app URL
        if self.jira_instance_url and project_key:
            # URL format: {jira_url}/jira/software/projects/{PROJECT}/boards
            # This opens the project's board page where the Time Tracker tab is accessible
            return f"{self.jira_instance_url}/jira/software/projects/{project_key}/boards"
        elif self.jira_instance_url:
            # Fallback: just open the Jira homepage if no project key available
            return self.jira_instance_url
        else:
            # Final fallback: open local dashboard
            return f"http://localhost:{self.web_port}/dashboard"
    
    def check_and_notify_unassigned_work(self):
        """Check for unassigned work and show notification if needed"""
        try:
            # Refresh notification settings
            self.fetch_notification_settings()
            
            # Check if notifications are enabled
            if not self.notification_settings.get('enabled', True):
                return
            
            # Check if enough time has passed since last notification
            interval_seconds = self.notification_settings.get('interval_hours', 24) * 3600
            if time.time() - self.last_notification_time < interval_seconds:
                return
            
            # Get unassigned work summary
            summary = self.get_unassigned_work_summary()
            if not summary:
                return
            
            # Check if there's enough unassigned time to warrant a notification
            min_minutes = self.notification_settings.get('min_unassigned_minutes', 30)
            if summary['total_minutes'] < min_minutes:
                return
            
            # Show the notification
            self.show_unassigned_work_notification(summary)
            self.last_notification_time = time.time()
            
        except Exception as e:
            print(f"[WARN] Error checking unassigned work: {e}")
    
    def normalize_app_name(self, app_name):
        """Normalize application name for comparison"""
        if not app_name:
            return ''
        # Remove .exe extension, lowercase, remove spaces
        normalized = app_name.lower().replace('.exe', '').replace(' ', '').strip()
        return normalized
    
    def is_in_whitelist(self, app_name):
        """Check if app exists in whitelist (regardless of toggle state)

        Used to determine if an app should be skipped when whitelist toggle is OFF.
        """
        whitelisted_apps = self.tracking_settings.get('whitelisted_apps', [])
        if not whitelisted_apps:
            return False

        normalized_app = self.normalize_app_name(app_name)

        for whitelist_entry in whitelisted_apps:
            normalized_entry = self.normalize_app_name(whitelist_entry)
            if normalized_entry in normalized_app or normalized_app in normalized_entry:
                return True

        return False

    def is_in_blacklist(self, app_name):
        """Check if app exists in blacklist (regardless of toggle state)

        Used to determine if an app should be skipped when blacklist toggle is OFF.
        """
        blacklisted_apps = self.tracking_settings.get('blacklisted_apps', [])
        if not blacklisted_apps:
            return False

        normalized_app = self.normalize_app_name(app_name)

        for blacklist_entry in blacklisted_apps:
            normalized_entry = self.normalize_app_name(blacklist_entry)
            if normalized_entry in normalized_app or normalized_app in normalized_entry:
                return True

        return False

    def is_app_whitelisted(self, app_name):
        """Check if application is in whitelist (work apps)"""
        if not self.tracking_settings.get('whitelist_enabled', True):
            return True  # If whitelist disabled, allow all

        whitelisted_apps = self.tracking_settings.get('whitelisted_apps', [])
        if not whitelisted_apps:
            return True  # Empty whitelist means allow all

        normalized_app = self.normalize_app_name(app_name)

        # Check if any whitelist entry matches
        for whitelist_entry in whitelisted_apps:
            normalized_entry = self.normalize_app_name(whitelist_entry)
            if normalized_entry in normalized_app or normalized_app in normalized_entry:
                return True

        return False

    def is_app_blacklisted(self, app_name):
        """Check if application is in blacklist (non-work apps)"""
        if not self.tracking_settings.get('blacklist_enabled', True):
            return False  # If blacklist disabled, nothing is blacklisted

        blacklisted_apps = self.tracking_settings.get('blacklisted_apps', [])
        if not blacklisted_apps:
            return False  # Empty blacklist means nothing blocked

        normalized_app = self.normalize_app_name(app_name)

        # Check if any blacklist entry matches
        for blacklist_entry in blacklisted_apps:
            normalized_entry = self.normalize_app_name(blacklist_entry)
            if normalized_entry in normalized_app or normalized_app in normalized_entry:
                return True

        return False
    
    def is_private_app(self, app_name, window_title=''):
        """Check if application/window is private (should not be tracked/recorded)"""
        if not self.tracking_settings.get('private_sites_enabled', True):
            return False  # If private sites disabled, nothing is private
        
        private_sites = self.tracking_settings.get('private_sites', [])
        if not private_sites:
            return False  # No private sites configured
        
        normalized_app = self.normalize_app_name(app_name)
        normalized_title = window_title.lower() if window_title else ''
        
        # Check if any private site entry matches in app name or window title
        for private_entry in private_sites:
            normalized_entry = private_entry.lower().strip()
            if normalized_entry in normalized_app or normalized_entry in normalized_title:
                return True
        
        return False
    
    def get_app_work_type(self, app_name, window_title=''):
        """Determine work type based on app whitelist/blacklist
        
        Returns:
            str: 'office' for whitelisted apps, 'non-office' for blacklisted apps, 
                 'office' as default if not in any list
        """
        if self.is_app_blacklisted(app_name):
            return 'non-office'
        elif self.is_app_whitelisted(app_name):
            return 'office'
        else:
            # Default to office if not in any list
            return 'office'
    
    def should_skip_screenshot(self, app_name, window_title=''):
        """Check if screenshot should be skipped based on settings

        Returns:
            tuple: (should_skip: bool, reason: str or None)
        """
        # Check if screenshot monitoring is disabled
        if not self.tracking_settings.get('screenshot_monitoring_enabled', True):
            return (True, 'screenshot_monitoring_disabled')

        # Check if app is private (should not be recorded at all)
        if self.is_private_app(app_name, window_title):
            return (True, 'private_app')

        # Check if app is in whitelist but whitelist toggle is OFF
        # When OFF, apps in the whitelist should NOT be tracked
        if self.is_in_whitelist(app_name) and not self.tracking_settings.get('whitelist_enabled', True):
            return (True, 'whitelist_disabled')

        # Check if app is in blacklist but blacklist toggle is OFF
        # When OFF, apps in the blacklist should NOT be tracked
        if self.is_in_blacklist(app_name) and not self.tracking_settings.get('blacklist_enabled', True):
            return (True, 'blacklist_disabled')

        return (False, None)

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
        """Get active window information and detect window switches for event-based tracking"""
        if not WIN32_AVAILABLE:
            return {'title': 'Unknown', 'app': 'Unknown', 'window_key': 'unknown', 'is_new_window': False}
        
        try:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
            
            # Get process name
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process = psutil.Process(pid)
            app_name = process.name()
            
            # Create unique window key (app + title) to detect window switches
            window_key = f"{app_name}|||{title}"
            
            # Detect window switch
            is_new_window = False
            if window_key != self.current_window_key:
                is_new_window = True
                # Save previous window info before updating (for final screenshot with full duration)
                # ALWAYS save the previous window info so we can track time properly
                # The screenshot_id may be None if no screenshot was taken (rapid switching)
                if self.current_window_key is not None:
                    self.previous_window_key = self.current_window_key
                    self.previous_window_start_time = self.current_window_start_time
                    self.previous_window_db_start_time = self.current_window_db_start_time  # Actual DB start_time
                    self.previous_window_screenshot_id = self.current_window_screenshot_id  # May be None if no screenshot
                    # Parse previous window info from window_key format: "app|||title"
                    if '|||' in self.current_window_key:
                        prev_app, prev_title = self.current_window_key.split('|||', 1)
                    else:
                        prev_app = 'Unknown'
                        prev_title = 'Unknown'
                    self.previous_window_info = {
                        'title': prev_title,
                        'app': prev_app,
                        'window_key': self.current_window_key
                    }
                # Update current window tracking
                # IMPORTANT: Start time is set to NOW, so the next screenshot will cover from this moment
                self.current_window_key = window_key
                self.current_window_start_time = datetime.now()
                self.current_window_screenshot_id = None  # Reset - will be set when screenshot is captured
                self.current_window_record_created_at = None  # Reset - will be set when screenshot is captured
                if self.current_window_key and self.current_window_key != 'unknown':
                    print(f"[INFO] Window switched at {self.current_window_start_time.strftime('%H:%M:%S')}:")
                    print(f"     - App: {app_name}")
                    print(f"     - Title: {title[:50]}")
                    self.add_admin_log('INFO', f'Window switch: {app_name}', {
                        'app': app_name,
                        'title': title[:60] if title else '',
                        'time': self.current_window_start_time.strftime('%H:%M:%S')
                    })
            
            return {
                'title': title,
                'app': app_name,
                'window_key': window_key,
                'is_new_window': is_new_window
            }
        except Exception as e:
            print(f"[WARN] Failed to get window info: {e}")
            return {'title': 'Unknown', 'app': 'Unknown', 'window_key': 'unknown', 'is_new_window': False}
    
    def upload_screenshot(self, screenshot, window_info, use_previous_window=False):
        """Upload screenshot to Supabase with event-based tracking (start_time and end_time)
        Supports offline mode - saves locally when network is unavailable
        
        Args:
            screenshot: PIL Image to upload
            window_info: Dictionary with window information
            use_previous_window: If True, use previous_window_start_time for duration (final screenshot)
        """
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
            timestamp = datetime.now()
            filename = f"screenshot_{int(timestamp.timestamp())}.png"
            thumb_filename = f"thumb_{int(timestamp.timestamp())}.jpg"
            
            storage_path = f"{self.current_user_id}/{filename}"
            thumb_path = f"{self.current_user_id}/{thumb_filename}"
            
            # Event-based tracking: Calculate start_time and end_time
            # end_time is when screenshot is taken (now)
            end_time = timestamp
            
            # start_time calculation - ENSURE NO GAPS between records
            # Priority: Use last_screenshot_end_time to ensure continuity, then fall back to other sources
            if use_previous_window:
                # This is the final screenshot of the previous window
                # Use the previous window's start time to calculate actual time spent
                start_time = self.previous_window_start_time if self.previous_window_start_time else end_time
            elif self.last_screenshot_end_time is not None:
                # IMPORTANT: Use last screenshot's end_time as this record's start_time
                # This ensures no gaps even when window switches were skipped due to min_interval
                start_time = self.last_screenshot_end_time
            elif self.current_window_start_time is not None:
                # Fall back to current window start time
                start_time = self.current_window_start_time
            else:
                # First screenshot ever - start from now (will be adjusted to 1 second)
                start_time = end_time
                self.current_window_start_time = start_time
            
            # Calculate duration in seconds
            duration_seconds = int((end_time - start_time).total_seconds())
            # Ensure minimum duration of 1 second (for database constraints)
            # IMPORTANT: Do NOT adjust start_time backwards - this causes overlaps!
            # Keep start_time unchanged to maintain continuity with previous record's end_time
            if duration_seconds < 1:
                duration_seconds = 1
                # Don't modify start_time - accept that actual duration was < 1 second
                # The database will show 1s duration but time ranges won't overlap
            
            # Prepare screenshot data for both online and offline storage
            work_type = window_info.get('work_type', 'office')  # Default to 'office'
            is_blacklisted = window_info.get('is_blacklisted', False)

            # Get project_key from user's issues or accessible projects
            # This is used as a fallback when AI fails to detect the project
            # Priority: assigned issues > accessible projects
            project_key = self.get_user_project_key()

            screenshot_data = {
                'user_id': self.current_user_id,
                'organization_id': self.organization_id,  # Multi-tenancy support
                'timestamp': timestamp.isoformat(),
                'storage_path': storage_path,
                'window_title': window_info['title'],
                'application_name': window_info['app'],
                'file_size_bytes': len(img_bytes),
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'duration_seconds': duration_seconds,
                'project_key': project_key,  # Project from user's assigned issues
                'user_assigned_issues': self.user_issues,
                'metadata': {
                    'work_type': work_type,
                    'is_blacklisted': is_blacklisted,
                    'tracking_mode': self.tracking_settings.get('tracking_mode', 'interval')
                }
            }
            
            # Check network connectivity
            is_online = self.offline_manager.check_connectivity()
            
            if not is_online:
                # OFFLINE MODE: Save locally
                local_id = self.offline_manager.save_screenshot_offline(
                    screenshot_data, img_bytes, thumb_bytes
                )
                
                if local_id:
                    pending_count = self.offline_manager.get_pending_count()
                    print(f"[OFFLINE] Screenshot saved locally (ID: {local_id})")
                    print(f"     - Pending sync: {pending_count} screenshots")
                    print(f"     - Window: {window_info['app']}")
                    print(f"     - Duration: {duration_seconds}s")
                    
                    # Update tracking state even when offline
                    self.last_screenshot_end_time = end_time
                    
                    return f"offline_{local_id}"
                else:
                    print("[ERROR] Failed to save screenshot offline")
                    return None
            
            # ONLINE MODE: Upload to Supabase
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

                # Update screenshot_data with URLs for database insert
                screenshot_data['storage_url'] = screenshot_url
                screenshot_data['thumbnail_url'] = thumb_url
                screenshot_data['status'] = 'pending'
                
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
                    print(f"     - Start: {start_time.strftime('%H:%M:%S')}")
                    print(f"     - End:   {end_time.strftime('%H:%M:%S')}")
                    print(f"     - Duration: {duration_seconds}s")
                    print(f"     - App: {window_info['app']}")
                    self.add_admin_log('INFO', f"Screenshot captured: {window_info['app']} ({duration_seconds}s)", {
                        'file': filename,
                        'id': screenshot_id[:8] + '...',  # Short ID for display
                        'full_id': screenshot_id,
                        'storage': storage_path,
                        'size': len(img_bytes),
                        'start': start_time.strftime('%H:%M:%S'),
                        'end': end_time.strftime('%H:%M:%S'),
                        'duration': duration_seconds,
                        'app': window_info['app'],
                        'title': window_info.get('title', '')[:50]  # Truncate long titles
                    })
                    
                    # Store the screenshot ID so we can update end_time/duration later
                    # When user switches windows OR when interval is reached, this record will be updated
                    self.current_window_screenshot_id = screenshot_id

                    # IMPORTANT: Track the actual start_time saved to database
                    # This may differ from current_window_start_time due to gap-free continuity logic
                    self.current_window_db_start_time = start_time

                    # Track when this record was actually created (for interval safeguard)
                    # This is different from start_time which may be from last_screenshot_end_time
                    self.current_window_record_created_at = datetime.now()

                    # Track end_time for continuity - next screenshot will start from here
                    # This ensures no gaps between records
                    self.last_screenshot_end_time = end_time
                    
                    # For interval captures, current_window_start_time was already updated
                    # in tracking_loop before calling upload_screenshot
                    # For window switches, it was set in get_active_window()
                    
                    return screenshot_id
                else:
                    print(f"[WARN] Screenshot uploaded to storage but database insert returned no data")
                    return None
            
        except requests.exceptions.ConnectionError:
            # Network error - save offline
            print("[WARN] Connection error - saving screenshot offline")
            self.add_admin_log('WARN', 'Connection error - saving screenshot offline')
            local_id = self.offline_manager.save_screenshot_offline(
                screenshot_data, img_bytes, thumb_bytes
            )
            if local_id:
                self.last_screenshot_end_time = end_time
                self.offline_manager.is_online = False
                return f"offline_{local_id}"
            return None
            
        except Exception as e:
            print(f"[ERROR] Screenshot upload failed: {e}")
            self.add_admin_log('ERROR', f'Screenshot upload failed: {str(e)[:100]}')
            traceback.print_exc()
            
            # Try to save offline as fallback
            try:
                print("[INFO] Attempting to save screenshot offline as fallback...")
                local_id = self.offline_manager.save_screenshot_offline(
                    screenshot_data, img_bytes, thumb_bytes
                )
                if local_id:
                    self.last_screenshot_end_time = end_time
                    return f"offline_{local_id}"
            except Exception as offline_err:
                print(f"[ERROR] Offline save also failed: {offline_err}")
        
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

            # Signal that we need to resume from idle (tracking loop will handle the state reset)
            if self.is_idle:
                self.needs_idle_resume = True

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

    def sync_offline_data(self, force=False):
        """Sync offline data to Supabase when online
        
        Args:
            force: If True, sync immediately regardless of interval
        
        Returns:
            tuple: (synced_count, failed_count) or None if not syncing
        """
        current_time = time.time()
        
        # Check sync interval (unless forced)
        if not force and (current_time - self._last_sync_time) < self._sync_interval:
            return None
        
        # Check connectivity
        if not self.offline_manager.check_connectivity():
            return None
        
        # Check if there's anything to sync
        pending_count = self.offline_manager.get_pending_count()
        if pending_count == 0:
            return None
        
        print(f"[INFO] Network online - syncing {pending_count} offline screenshots...")
        self.add_admin_log('INFO', f'Syncing {pending_count} offline screenshots...')

        # Get the appropriate clients
        db_client = self.supabase_service if self.supabase_service else self.supabase
        storage_client = self.supabase_service if self.supabase_service else self.supabase

        # Perform sync
        result = self.offline_manager.sync_all(db_client, storage_client)

        self._last_sync_time = current_time

        if result:
            synced, failed = result
            if synced > 0 or failed > 0:
                self.add_admin_log('INFO', f'Sync complete: {synced} synced, {failed} failed')

        return result

    def start_sync_thread(self):
        """Start background thread for periodic offline sync"""
        def sync_worker():
            while self.running:
                try:
                    if self.tracking_active and self.current_user_id:
                        self.sync_offline_data()
                except Exception as e:
                    print(f"[ERROR] Sync thread error: {e}")
                
                # Check every 30 seconds
                time.sleep(30)
        
        self._sync_thread = threading.Thread(target=sync_worker, daemon=True)
        self._sync_thread.start()
        print("[OK] Offline sync background thread started")

    def tracking_loop(self):
        """Main tracking loop with idle detection and event-based window switch capture"""
        print("[OK] Tracking started (interval + event-based)")
        
        # Fetch initial tracking settings from Supabase
        self.fetch_tracking_settings()
        
        # Track last screenshot time to prevent too frequent captures (for window switches)
        last_screenshot_time = 0
        min_screenshot_interval = 10  # Minimum 10 seconds between window switch screenshots
        
        # Track time for refreshing settings
        last_settings_refresh = time.time()
        settings_refresh_interval = 300  # Refresh settings every 5 minutes

        # Track time for notification checks
        last_notification_check = 0
        notification_check_interval = 1800  # Check every 30 minutes
        
        # Initialize interval timer on first run
        # The interval timer is FIXED - only resets on interval captures, not window switches
        if self.last_interval_time is None:
            self.last_interval_time = time.time()
        
        while self.running:
            try:
                if not self.tracking_active:
                    time.sleep(1)
                    continue
                
                # Periodically refresh tracking settings from Supabase
                if time.time() - last_settings_refresh > settings_refresh_interval:
                    self.fetch_tracking_settings()
                    last_settings_refresh = time.time()

                # Periodically check for unassigned work and send notifications
                if time.time() - last_notification_check > notification_check_interval:
                    self.check_and_notify_unassigned_work()
                    last_notification_check = time.time()
                
                # Check if screenshot monitoring is enabled
                if not self.tracking_settings.get('screenshot_monitoring_enabled', True):
                    time.sleep(10)  # Sleep longer when disabled
                    continue

                # Check for idle timeout (use configurable threshold)
                idle_duration = time.time() - self.last_activity_time
                current_idle_timeout = self.tracking_settings.get('idle_threshold_seconds', self.idle_timeout)
                if idle_duration > current_idle_timeout:
                    if not self.is_idle:
                        idle_start_time = datetime.now()
                        last_activity = datetime.fromtimestamp(self.last_activity_time)
                        print(f"[INFO] Entering idle mode at {idle_start_time.strftime('%H:%M:%S')}:")
                        print(f"     - Last activity: {last_activity.strftime('%H:%M:%S')}")
                        print(f"     - Idle duration: {int(idle_duration)}s (threshold: {current_idle_timeout}s)")
                        
                        # IMPORTANT: Finalize the current window's duration BEFORE going idle
                        # This prevents idle time from being counted as work time
                        if self.current_window_screenshot_id is not None and self.current_window_db_start_time is not None:
                            try:
                                # Use the last activity time as the end time, not current time
                                # This gives us the actual work duration before user went idle
                                end_time = datetime.fromtimestamp(self.last_activity_time)
                                # Use the ACTUAL start_time from database for accurate duration calculation
                                duration_seconds = int((end_time - self.current_window_db_start_time).total_seconds())

                                if duration_seconds < 1:
                                    duration_seconds = 1
                                    end_time = self.current_window_db_start_time + timedelta(seconds=1)

                                db_client = self.supabase_service if self.supabase_service else self.supabase
                                update_result = db_client.table('screenshots').update({
                                    'end_time': end_time.isoformat(),
                                    'timestamp': end_time.isoformat(),
                                    'duration_seconds': duration_seconds
                                }).eq('id', self.current_window_screenshot_id).execute()

                                if update_result.data:
                                    print(f"[OK] Finalized work session before idle:")
                                    print(f"     - Record ID: {self.current_window_screenshot_id}")
                                    print(f"     - Start: {self.current_window_db_start_time.strftime('%H:%M:%S')} (from DB)")
                                    print(f"     - End (last activity): {end_time.strftime('%H:%M:%S')}")
                                    print(f"     - Duration: {duration_seconds}s")

                                # Reset tracking state - will start fresh when resuming
                                self.current_window_screenshot_id = None
                                self.current_window_record_created_at = None
                                self.current_window_start_time = None
                                self.current_window_db_start_time = None
                                self.last_screenshot_end_time = end_time

                            except Exception as e:
                                print(f"[ERROR] Error finalizing session before idle: {e}")
                        
                        self.is_idle = True
                        self.update_tray_icon()
                        self.add_admin_log('INFO', f'User idle (no activity for {int(idle_duration)}s)')

                    # While idle, check every 5 seconds for activity
                    # Don't skip if needs_idle_resume is set - we need to process the resume
                    if not self.needs_idle_resume:
                        time.sleep(5)
                        continue

                # Resume from idle if activity was detected by pynput
                if self.needs_idle_resume:
                    resume_time = datetime.now()
                    print(f"[INFO] Activity detected at {resume_time.strftime('%H:%M:%S')}, resuming tracking from idle")
                    print(f"     - All tracking state reset - new session will start fresh")
                    self.is_idle = False
                    self.needs_idle_resume = False
                    self.update_tray_icon()
                    self.add_admin_log('INFO', 'User active - resuming tracking')
                    # Reset interval timer so first capture happens after full interval
                    self.last_interval_time = time.time()
                    # Start fresh - next screenshot will be the start of a new work session
                    # IMPORTANT: Reset ALL tracking state so new session starts from "now"
                    self.current_window_start_time = None
                    self.current_window_db_start_time = None
                    self.current_window_screenshot_id = None
                    self.current_window_record_created_at = None
                    self.last_screenshot_end_time = None  # Critical: prevents idle time from being counted
                    self.previous_window_key = None
                    self.previous_window_screenshot_id = None
                    self.previous_window_start_time = None
                    self.previous_window_db_start_time = None
                    self.current_window_key = None  # Also reset current window so it's detected as "new"

                # Check for window switches more frequently (every 2 seconds)
                # This allows us to capture screenshots immediately on window switch
                window_info = self.get_active_window()
                current_time = time.time()
                
                # Get current capture interval from settings
                current_capture_interval = self.tracking_settings.get('screenshot_interval_seconds', self.capture_interval)
                
                # Check if current app should be tracked (private app check)
                app_name = window_info.get('app', '')
                window_title = window_info.get('title', '')
                should_skip, skip_reason = self.should_skip_screenshot(app_name, window_title)
                
                if should_skip:
                    if skip_reason == 'private_app':
                        # Don't log too frequently for private apps
                        pass
                    time.sleep(2)
                    continue
                
                # Determine work type based on whitelist/blacklist
                work_type = self.get_app_work_type(app_name, window_title)
                window_info['work_type'] = work_type
                window_info['is_blacklisted'] = self.is_app_blacklisted(app_name)
                
                # Check if window switched
                window_switched = window_info.get('is_new_window', False)
                time_since_last_screenshot = current_time - last_screenshot_time
                time_since_last_interval = current_time - self.last_interval_time

                # Debug: Log interval progress every 60 seconds
                if int(time_since_last_interval) % 60 == 0 and int(time_since_last_interval) > 0:
                    remaining = current_capture_interval - time_since_last_interval
                    if remaining > 0:
                        print(f"[INTERVAL] {int(time_since_last_interval)}s elapsed, {int(remaining)}s until next interval capture")

                # IMPORTANT: Always update the previous window record when switching, regardless of interval
                # The interval check only applies to creating NEW screenshots, not updating existing ones
                if window_switched:
                    # Update existing record of previous window with actual time spent
                    # This ensures we update the screenshot record with the actual duration
                    # Only update if there's actually a screenshot ID to update
                    if (self.previous_window_key is not None and
                        self.previous_window_db_start_time is not None and
                        self.previous_window_screenshot_id is not None):  # Only update if screenshot exists
                        # IMPORTANT: Capture timestamp BEFORE any operations
                        # This exact timestamp will be used for both:
                        # 1. Previous record's end_time
                        # 2. Next record's start_time (via last_screenshot_end_time)
                        # This ensures PERFECT continuity with NO gaps or overlaps
                        end_time = datetime.now()

                        # Set last_screenshot_end_time IMMEDIATELY so upload_screenshot uses this exact value
                        self.last_screenshot_end_time = end_time

                        # Use the ACTUAL start_time from database for accurate duration calculation
                        # This ensures log output matches what's stored in the database
                        duration_seconds = int((end_time - self.previous_window_db_start_time).total_seconds())

                        # Ensure minimum duration of 1 second
                        if duration_seconds < 1:
                            duration_seconds = 1
                            end_time = self.previous_window_db_start_time + timedelta(seconds=1)
                            self.last_screenshot_end_time = end_time  # Update with adjusted time

                        try:
                            # Update the existing record in database
                            # IMPORTANT: Only update end_time, timestamp, and duration
                            # Do NOT update start_time - it should remain as originally set
                            db_client = self.supabase_service if self.supabase_service else self.supabase
                            update_result = db_client.table('screenshots').update({
                                'end_time': end_time.isoformat(),
                                'timestamp': end_time.isoformat(),
                                'duration_seconds': duration_seconds
                            }).eq('id', self.previous_window_screenshot_id).execute()

                            if update_result.data:
                                print(f"[OK] Updated previous window record (window switch):")
                                print(f"     - Record ID: {self.previous_window_screenshot_id}")
                                print(f"     - Start: {self.previous_window_db_start_time.strftime('%H:%M:%S')} (from DB)")
                                print(f"     - End:   {end_time.strftime('%H:%M:%S')}")
                                print(f"     - Duration: {duration_seconds}s")
                            else:
                                print(f"[WARN] Failed to update previous window record")
                        except Exception as e:
                            print(f"[ERROR] Error updating previous window record: {e}")

                        # Reset previous window info after updating
                        self.previous_window_info = None
                        self.previous_window_screenshot_id = None
                        self.previous_window_db_start_time = None
                    else:
                        # No previous screenshot to update
                        # IMPORTANT: Only set last_screenshot_end_time if it's not already set
                        # This maintains continuity from the last actual screenshot's end_time
                        # If we always reset to now(), we'd create gaps when window switches are
                        # skipped due to min_screenshot_interval cooldown
                        if self.last_screenshot_end_time is None:
                            self.last_screenshot_end_time = datetime.now()

                # Decide whether to capture a new screenshot
                should_capture = False
                capture_reason = None
                
                if window_switched and time_since_last_screenshot >= min_screenshot_interval:
                    # Window switch + enough time passed - capture new screenshot
                    should_capture = True
                    capture_reason = "window_switch"
                elif time_since_last_interval >= current_capture_interval:
                    # Interval reached (using dynamic interval from settings)
                    # This ensures clean, non-overlapping time periods
                    updated_existing_record = False  # Track if we updated a previous record
                    if self.current_window_screenshot_id is not None and self.current_window_db_start_time is not None:
                        # IMPORTANT: Capture timestamp BEFORE any operations
                        # This exact timestamp will be used for both:
                        # 1. Current record's end_time
                        # 2. Next record's start_time (via last_screenshot_end_time)
                        end_time = datetime.now()

                        # Set last_screenshot_end_time IMMEDIATELY so upload_screenshot uses this exact value
                        self.last_screenshot_end_time = end_time

                        # Use the ACTUAL start_time from database for accurate duration calculation
                        duration_seconds = int((end_time - self.current_window_db_start_time).total_seconds())

                        if duration_seconds < 1:
                            duration_seconds = 1
                            end_time = self.current_window_db_start_time + timedelta(seconds=1)
                            self.last_screenshot_end_time = end_time  # Update with adjusted time

                        try:
                            db_client = self.supabase_service if self.supabase_service else self.supabase
                            update_result = db_client.table('screenshots').update({
                                'end_time': end_time.isoformat(),
                                'timestamp': end_time.isoformat(),
                                'duration_seconds': duration_seconds
                            }).eq('id', self.current_window_screenshot_id).execute()

                            if update_result.data:
                                print(f"[OK] Updated current window record (interval):")
                                print(f"     - Record ID: {self.current_window_screenshot_id}")
                                print(f"     - Start: {self.current_window_db_start_time.strftime('%H:%M:%S')} (from DB)")
                                print(f"     - End:   {end_time.strftime('%H:%M:%S')}")
                                print(f"     - Duration: {duration_seconds}s")
                                updated_existing_record = True  # Mark that we successfully updated a record
                        except Exception as e:
                            print(f"[ERROR] Error updating record before interval: {e}")

                        # Reset tracking - the new screenshot will start fresh from now
                        self.current_window_start_time = end_time
                        self.current_window_db_start_time = None  # Will be set when new screenshot is uploaded
                        self.current_window_screenshot_id = None
                        self.current_window_record_created_at = None  # Will be set when new screenshot is uploaded

                    should_capture = True
                    capture_reason = "interval"
                
                if should_capture:
                    screenshot = self.capture_screenshot()
                    if screenshot:
                        # Upload screenshot with event-based tracking (start_time and end_time)
                        # For window switches: start_time is when new window became active
                        # For intervals: start_time is now (after updating previous record)
                        self.upload_screenshot(screenshot, window_info)
                        
                        # Update timing based on capture reason
                        if capture_reason == "interval":
                            # Interval capture - reset the fixed interval timer
                            # IMPORTANT: Use fresh time.time() here, NOT the stale current_time from start of loop
                            # This prevents the issue where blocking operations (settings fetch, Jira API calls)
                            # cause the next iteration to think another interval has passed
                            self.last_interval_time = time.time()

                            # BUG FIX: If this was a "fresh" interval capture (no previous record was updated),
                            # make this record "final" so the next interval creates a new record instead of updating this one.
                            # This prevents records from spanning multiple interval periods when window switch
                            # didn't create a screenshot (due to min_interval check).
                            if not updated_existing_record:
                                print(f"[INFO] Fresh interval capture - record is final (won't be extended)")
                                self.current_window_screenshot_id = None
                                self.current_window_db_start_time = None
                                self.current_window_record_created_at = None

                        # Always update last_screenshot_time (for min_screenshot_interval check)
                        last_screenshot_time = time.time()  # Also use fresh time here
                        print(f"[OK] Screenshot captured ({capture_reason})")
                
                # Sleep for shorter interval to check for window switches more frequently
                # But still respect the minimum screenshot interval
                sleep_time = min(2, min_screenshot_interval)  # Check every 2 seconds
                time.sleep(sleep_time)

            except Exception as e:
                print(f"[ERROR] Tracking loop error: {e}")
                traceback.print_exc()
                time.sleep(5)
    
    def start_tracking(self):
        """Start screenshot tracking with idle detection"""
        if self.running:
            return

        if not self.current_user_id:
            print("[WARN] Cannot start tracking - no user ID (authenticated or anonymous)")
            return

        # GDPR compliance: Verify consent before starting (defensive check)
        # Skip consent check for anonymous users (they'll provide consent on login)
        if self.current_user and not self.current_user_id.startswith('anonymous_'):
            user_account_id = self.current_user.get('account_id')
            if not self.consent_manager.has_valid_consent(user_account_id):
                print("[WARN] Cannot start tracking - user has not given consent for screenshot capture")
                print("[INFO] User must visit /consent page to provide consent")
                return
        
        # Log if we're in anonymous mode
        if self.current_user_id.startswith('anonymous_'):
            print("[INFO] Starting tracking in ANONYMOUS mode")
            print("[INFO] Screenshots will be saved locally and associated when you login")

        self.running = True
        self.tracking_active = True
        self.is_idle = False
        self.last_activity_time = time.time()  # Reset activity time
        
        # Initialize window tracking for event-based tracking
        self.current_window_key = None
        self.current_window_start_time = None
        self.current_window_db_start_time = None
        self.current_window_record_created_at = None
        self.current_window_screenshot_id = None
        self.last_interval_time = None  # Will be set on first screenshot
        self.last_screenshot_end_time = None  # Tracks last record's end_time for continuity
        self.previous_window_key = None
        self.previous_window_start_time = None
        self.previous_window_db_start_time = None
        self.previous_window_info = None
        self.previous_window_screenshot_id = None

        # Start tracking thread
        self._tracking_thread = threading.Thread(target=self.tracking_loop, daemon=True)
        self._tracking_thread.start()

        # Start activity monitoring thread (for idle detection)
        if not self._activity_monitor_thread or not self._activity_monitor_thread.is_alive():
            self._activity_monitor_thread = threading.Thread(
                target=self.monitor_user_activity, daemon=True
            )
            self._activity_monitor_thread.start()

        # Start offline sync thread
        if not self._sync_thread or not self._sync_thread.is_alive():
            self.start_sync_thread()

        # Check for any pending offline data and sync immediately
        pending_count = self.offline_manager.get_pending_count()
        if pending_count > 0:
            print(f"[INFO] Found {pending_count} offline screenshots to sync")
            # Trigger immediate sync in background
            threading.Thread(
                target=lambda: self.sync_offline_data(force=True),
                daemon=True
            ).start()

        # Update tray icon to green
        self.update_tray_icon()

        print("[OK] Tracking started with idle detection")
        self.add_admin_log('INFO', f'Tracking started (interval: {self.capture_interval}s)')
    
    def stop_tracking(self):
        """Stop screenshot tracking"""
        self.running = False
        self.tracking_active = False

        # Update tray icon to blue
        self.update_tray_icon()

        print("[OK] Tracking stopped")
        self.add_admin_log('INFO', 'Tracking stopped')
    
    def pause_tracking(self):
        """Pause screenshot tracking (can be resumed)"""
        if self.tracking_active:
            self.tracking_active = False
            self.update_tray_icon()
            print("[OK] Tracking paused")
    
    def resume_tracking(self):
        """Resume screenshot tracking"""
        if not self.tracking_active and self.running:
            self.tracking_active = True
            self.is_idle = False
            self.last_activity_time = time.time()
            self.update_tray_icon()
            print("[OK] Tracking resumed")
    
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
        if not self.current_user and not (self.current_user_id and self.current_user_id.startswith('anonymous_')):
            return 'red'  # Not logged in and not in anonymous mode
        elif self.current_user_id and self.current_user_id.startswith('anonymous_'):
            if self.tracking_active:
                return 'orange'  # Anonymous mode, tracking active (use orange to indicate not logged in)
            else:
                return 'red'  # Anonymous mode but not tracking
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
            
            # Create menu - Show current user or "Login" or "Anonymous"
            def get_menu_label():
                if self.current_user:
                    return f"👤 {self.current_user.get('email', 'User')}"
                elif self.current_user_id and self.current_user_id.startswith('anonymous_'):
                    return "👤 Anonymous (Click to Login)"
                else:
                    return "Login"

            def get_consent_label():
                if self.current_user:
                    user_account_id = self.current_user.get('account_id')
                    has_consent = self.consent_manager.has_valid_consent(user_account_id)
                    if has_consent:
                        return "✅ Consent: Granted"
                    else:
                        return "⚠️ Consent: Required"
                return "Consent: N/A"

            def handle_consent_action():
                if self.current_user:
                    user_account_id = self.current_user.get('account_id')
                    has_consent = self.consent_manager.has_valid_consent(user_account_id)
                    if has_consent:
                        # Open dashboard with revoke option
                        webbrowser.open(f'http://localhost:{self.web_port}/dashboard')
                    else:
                        # Open consent page
                        webbrowser.open(f'http://localhost:{self.web_port}/consent')

            users_action = lambda: webbrowser.open(
                f'http://localhost:{self.web_port}/login' if not self.current_user
                else f'http://localhost:{self.web_port}/dashboard'
            )

            # Create static menu (pystray will call visible/enabled functions dynamically)
            menu = pystray.Menu(
                item(
                    lambda text: get_menu_label(),
                    users_action
                ),
                item(
                    lambda text: get_consent_label(),
                    handle_consent_action,
                    visible=lambda item: self.current_user is not None
                ),
                pystray.Menu.SEPARATOR,
                item(
                    lambda text: "Resume" if (self.running and not self.tracking_active) else "Pause",
                    lambda: self.resume_tracking() if (self.running and not self.tracking_active) else self.pause_tracking() if (self.running and self.tracking_active) else None,
                    enabled=lambda item: self.running
                )
            )

            self.tray = pystray.Icon("BRD Time Tracker", icon_image, menu=menu)
            
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
                
                # Create fallback menu
                def get_menu_label():
                    if self.current_user:
                        return f"👤 {self.current_user.get('email', 'User')}"
                    elif self.current_user_id and self.current_user_id.startswith('anonymous_'):
                        return "👤 Anonymous (Click to Login)"
                    else:
                        return "Login"

                def get_consent_label():
                    if self.current_user:
                        user_account_id = self.current_user.get('account_id')
                        has_consent = self.consent_manager.has_valid_consent(user_account_id)
                        if has_consent:
                            return "✅ Consent: Granted"
                        else:
                            return "⚠️ Consent: Required"
                    return "Consent: N/A"

                def handle_consent_action():
                    if self.current_user:
                        user_account_id = self.current_user.get('account_id')
                        has_consent = self.consent_manager.has_valid_consent(user_account_id)
                        if has_consent:
                            webbrowser.open(f'http://localhost:{self.web_port}/dashboard')
                        else:
                            webbrowser.open(f'http://localhost:{self.web_port}/consent')

                users_action = lambda: webbrowser.open(
                    f'http://localhost:{self.web_port}/login' if not self.current_user
                    else f'http://localhost:{self.web_port}/dashboard'
                )

                menu = pystray.Menu(
                    item(
                        lambda text: get_menu_label(),
                        users_action
                    ),
                    item(
                        lambda text: get_consent_label(),
                        handle_consent_action,
                        visible=lambda item: self.current_user is not None
                    ),
                    pystray.Menu.SEPARATOR,
                    item(
                        lambda text: "Resume" if (self.running and not self.tracking_active) else "Pause",
                        lambda: self.resume_tracking() if (self.running and not self.tracking_active) else self.pause_tracking() if (self.running and self.tracking_active) else None,
                        enabled=lambda item: self.running
                    )
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

        # Self-install on first run (copies exe to %LOCALAPPDATA%\BRDTimeTracker\)
        if not install_application():
            # Installation happened - this instance should exit
            # The installed version has been started
            print("[INFO] Exiting installer instance...")
            sys.exit(0)

        # Acquire single instance lock - prevent multiple instances
        if not acquire_single_instance_lock():
            print("[ERROR] Another instance is already running. Exiting...")
            print("[INFO] Check your system tray for the existing instance.")
            # Give user time to see the message if running from console
            time.sleep(3)
            sys.exit(1)

        # Add to Windows startup (runs on system boot)
        # Uses the installed path, not the downloaded path
        if not is_in_startup():
            add_to_startup()

        # Check network connectivity first
        is_online = self.offline_manager.check_connectivity(force=True)
        
        # Check authentication
        if self.auth_manager.is_authenticated():
            if is_online:
                # Online: try to get user info from Atlassian
                user_info = self.auth_manager.get_user_info()
                if user_info:
                    self.current_user = user_info
                    try:
                        # Initialize Supabase clients (fetches config from AI server)
                        if not self.initialize_supabase():
                            print("[WARN] Could not initialize Supabase, using cached user ID")
                            self.current_user_id = self._load_cached_user_id()
                        else:
                            self.current_user_id = self.ensure_user_exists(user_info)
                            # Associate any anonymous offline records with this user
                            self._associate_offline_records()
                    except Exception as e:
                        print(f"[WARN] Could not sync user to database: {e}")
                        # Try to load cached user_id from local storage
                        self.current_user_id = self._load_cached_user_id()
                    print(f"[OK] Welcome back, {user_info.get('email', 'User')}!")
                    self.add_admin_log('INFO', f"User logged in: {user_info.get('email', 'User')}")
                else:
                    print("[WARN] Failed to get user info, please re-authenticate")
                    self.auth_manager.logout()
            else:
                # Offline: try to use cached credentials
                print("[INFO] Starting in OFFLINE MODE...")
                cached_user = self._load_cached_user_info()
                if cached_user:
                    self.current_user = cached_user
                    self.current_user_id = cached_user.get('user_id')
                    print(f"[OK] Offline mode - Welcome back, {cached_user.get('email', 'User')}!")
                    print("[INFO] Screenshots will be saved locally until online")
                else:
                    # No cached user - will use anonymous tracking
                    print("[INFO] Offline mode - Starting anonymous tracking")
                    print("[INFO] Screenshots will be associated with your account when you login")
                    self.current_user_id = f"anonymous_{secrets.token_hex(8)}"
        else:
            # Not authenticated
            if not is_online:
                # Offline and not authenticated - start anonymous tracking
                print("[INFO] Starting in OFFLINE MODE (not authenticated)...")
                print("[INFO] Screenshots will be saved locally and associated when you login")
                self.current_user_id = f"anonymous_{secrets.token_hex(8)}"
        
        # Start web server
        web_thread = threading.Thread(target=self.run_web_server, daemon=True)
        web_thread.start()
        time.sleep(2)
        
        # Determine if we should start tracking
        should_track = self.current_user is not None or self.current_user_id is not None

        # Check consent status for authenticated users
        has_consent = False
        if self.current_user:
            user_account_id = self.current_user.get('account_id')
            has_consent = self.consent_manager.has_valid_consent(user_account_id)
            if not has_consent:
                print(f"[INFO] User {self.current_user.get('email')} has not provided consent for screenshot capture")
        elif self.current_user_id and self.current_user_id.startswith('anonymous_'):
            # Anonymous users don't need consent yet (they'll provide it on login)
            has_consent = True

        # Open browser if not authenticated (only if online) or if consent needed
        if not self.current_user:
            if is_online:
                print("[INFO] Opening browser for authentication...")
                webbrowser.open(f'http://localhost:{self.web_port}/login')
            else:
                print(f"[INFO] Dashboard available at http://localhost:{self.web_port}")
                print("[INFO] Login when online to sync your data")
        elif not has_consent:
            # User is authenticated but hasn't given consent - open consent page
            print("[INFO] Opening browser for consent...")
            webbrowser.open(f'http://localhost:{self.web_port}/consent')

        # Start tracking only if user has consent (or is anonymous)
        if should_track and has_consent:
            self.start_tracking()
        elif should_track and not has_consent:
            print("[INFO] Waiting for user consent before starting screenshot capture")
        
        print(f"[OK] Application running at http://localhost:{self.web_port}")
        if not is_online:
            print("[INFO] OFFLINE MODE - Screenshots will be synced when online")
        if self.current_user_id and self.current_user_id.startswith('anonymous_'):
            print("[INFO] ANONYMOUS MODE - Login to associate screenshots with your account")
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
    <title>Time Tracker - Login</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            background: #f8fafc;
        }

        /* Split Screen Layout */
        .split-container {
            display: flex;
            width: 100%;
            min-height: 100vh;
        }

        /* Left Panel - Branding & Features */
        .left-panel {
            flex: 1;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 60px;
            position: relative;
            overflow: hidden;
        }
        .left-panel::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
            animation: pulse 15s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.3; }
        }
        .left-content {
            position: relative;
            z-index: 1;
            max-width: 480px;
        }
        .brand-logo {
            width: 56px;
            height: 56px;
            background: white;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            margin-bottom: 32px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }
        .left-panel h1 {
            color: white;
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
        }
        .left-panel .tagline {
            color: rgba(255, 255, 255, 0.85);
            font-size: 18px;
            font-weight: 400;
            margin-bottom: 48px;
            line-height: 1.5;
        }
        .feature-list {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        .feature-item {
            display: flex;
            align-items: flex-start;
            gap: 16px;
        }
        .feature-icon-wrapper {
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
            backdrop-filter: blur(10px);
        }
        .feature-content h4 {
            color: white;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .feature-content p {
            color: rgba(255, 255, 255, 0.75);
            font-size: 14px;
            line-height: 1.4;
        }
        .trust-badge {
            margin-top: 48px;
            padding-top: 32px;
            border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        .trust-badge p {
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .trust-badge .stat {
            color: white;
            font-weight: 600;
        }

        /* Right Panel - Login Form */
        .right-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 60px;
            background: white;
        }
        .login-container {
            width: 100%;
            max-width: 380px;
        }
        .login-header {
            text-align: center;
            margin-bottom: 40px;
        }
        .login-logo {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            margin: 0 auto 24px;
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
        }
        .login-header h2 {
            color: #1a1a2e;
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        .login-header p {
            color: #64748b;
            font-size: 15px;
            font-weight: 400;
        }

        /* Login Button - Atlassian Style */
        .login-btn {
            width: 100%;
            height: 52px;
            background: #0052CC;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        .login-btn:hover {
            background: #0065FF;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 82, 204, 0.35);
        }
        .login-btn:active {
            transform: translateY(0);
            box-shadow: 0 4px 12px rgba(0, 82, 204, 0.25);
        }
        .login-btn.loading {
            pointer-events: none;
        }
        .login-btn.loading .btn-text {
            opacity: 0;
        }
        .login-btn.loading .spinner {
            display: block;
        }
        .login-btn svg.atlassian-icon {
            width: 20px;
            height: 20px;
        }
        .spinner {
            display: none;
            position: absolute;
            width: 22px;
            height: 22px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Divider */
        .divider {
            display: flex;
            align-items: center;
            margin: 28px 0;
            color: #94a3b8;
            font-size: 13px;
        }
        .divider::before, .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #e2e8f0;
        }
        .divider span {
            padding: 0 16px;
        }

        /* Info Cards */
        .info-cards {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 32px;
        }
        .info-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 16px;
            background: #f8fafc;
            border-radius: 10px;
            border: 1px solid #e2e8f0;
            transition: border-color 0.2s;
        }
        .info-card:hover {
            border-color: #cbd5e1;
        }
        .info-card-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
        }
        .info-card-icon.green {
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
        }
        .info-card-icon.purple {
            background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
        }
        .info-card h4 {
            color: #1e293b;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 2px;
        }
        .info-card p {
            color: #64748b;
            font-size: 12px;
        }

        /* Security Note */
        .security-note {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 14px;
            background: #f0fdf4;
            border-radius: 8px;
            margin-bottom: 24px;
        }
        .security-note svg {
            width: 16px;
            height: 16px;
            color: #16a34a;
        }
        .security-note p {
            color: #15803d;
            font-size: 13px;
            font-weight: 500;
        }

        /* Footer */
        .login-footer {
            text-align: center;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
        }
        .login-footer p {
            color: #94a3b8;
            font-size: 12px;
            margin-bottom: 8px;
        }
        .legal-links {
            display: flex;
            justify-content: center;
            gap: 16px;
        }
        .legal-links a {
            color: #64748b;
            font-size: 12px;
            text-decoration: none;
            transition: color 0.2s;
        }
        .legal-links a:hover {
            color: #0052CC;
        }

        /* Responsive */
        @media (max-width: 900px) {
            .split-container {
                flex-direction: column;
            }
            .left-panel {
                padding: 40px 30px;
                min-height: auto;
            }
            .left-content {
                max-width: 100%;
            }
            .left-panel h1 {
                font-size: 28px;
            }
            .feature-list {
                display: none;
            }
            .trust-badge {
                display: none;
            }
            .right-panel {
                padding: 40px 30px;
            }
        }
    </style>
</head>
<body>
    <div class="split-container">
        <!-- Left Panel - Branding -->
        <div class="left-panel">
            <div class="left-content">
                <div class="brand-logo">&#128337;</div>
                <h1>Time Tracker</h1>
                <p class="tagline">Effortless time tracking that works in the background while you focus on what matters.</p>

                <div class="feature-list">
                    <div class="feature-item">
                        <div class="feature-icon-wrapper">&#128247;</div>
                        <div class="feature-content">
                            <h4>Automatic Tracking</h4>
                            <p>Captures your work activity automatically without interrupting your flow</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon-wrapper">&#129302;</div>
                        <div class="feature-content">
                            <h4>AI-Powered Analysis</h4>
                            <p>Intelligently matches your work sessions to the right Jira issues</p>
                        </div>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon-wrapper">&#128202;</div>
                        <div class="feature-content">
                            <h4>Accurate Timesheets</h4>
                            <p>Generate precise time reports with zero manual effort</p>
                        </div>
                    </div>
                </div>

                <div class="trust-badge">
                    <p>Trusted by <span class="stat">500+</span> teams tracking <span class="stat">10,000+</span> hours monthly</p>
                </div>
            </div>
        </div>

        <!-- Right Panel - Login -->
        <div class="right-panel">
            <div class="login-container">
                <div class="login-header">
                    <div class="login-logo">&#128337;</div>
                    <h2>Welcome Back</h2>
                    <p>Sign in to continue tracking your time</p>
                </div>

                <div class="info-cards">
                    <div class="info-card">
                        <div class="info-card-icon">&#128247;</div>
                        <div>
                            <h4>Smart Capture</h4>
                            <p>Activity tracked automatically</p>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-icon green">&#129302;</div>
                        <div>
                            <h4>AI Matching</h4>
                            <p>Links work to Jira issues</p>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-card-icon purple">&#128202;</div>
                        <div>
                            <h4>Precise Reports</h4>
                            <p>Accurate timesheets instantly</p>
                        </div>
                    </div>
                </div>

                <div class="security-note">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <p>Secure authentication via Atlassian OAuth 2.0</p>
                </div>

                <button class="login-btn" id="loginBtn" onclick="handleLogin()">
                    <div class="spinner"></div>
                    <span class="btn-text">
                        <svg class="atlassian-icon" viewBox="0 0 32 32" fill="currentColor">
                            <path d="M15.52 5.14a1.06 1.06 0 0 0-1.81.04C11.36 9.73 11.89 13.19 14.15 18l3.53 7.54c.22.47.63.46.9 0L22 18c2.59-4.57 3.14-9.27.21-13.1-.15-.19-.35-.36-.62-.36H6.05c-.7 0-1.16.74-.83 1.36l6.6 13.27c.2.41.68.41.88 0l2.82-5.83z"/>
                        </svg>
                        Sign in with Atlassian
                    </span>
                </button>

                <div class="login-footer">
                    <p>By signing in, you agree to our terms</p>
                    <div class="legal-links">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function handleLogin() {
            const btn = document.getElementById('loginBtn');
            btn.classList.add('loading');
            // Small delay to show loading state
            setTimeout(() => {
                window.location.href = '/auth/atlassian';
            }, 300);
        }
    </script>
</body>
</html>'''
        return html
    
    def render_success_page(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Login Successful</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .success-card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 400px;
            padding: 50px 40px;
            text-align: center;
        }
        .success-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
        }
        .success-icon svg {
            width: 40px;
            height: 40px;
            color: white;
        }
        h1 {
            color: #172B4D;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        p {
            color: #6B778C;
            font-size: 15px;
            line-height: 1.5;
            margin-bottom: 30px;
        }
        .close-btn {
            width: 100%;
            padding: 14px 24px;
            background: linear-gradient(135deg, #0052CC 0%, #0065FF 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .close-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 82, 204, 0.4);
        }
        .close-btn:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="success-card">
        <div class="success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <h1>Login Successful!</h1>
        <p>You're all set. Time tracking will start automatically in the background.</p>
        <button class="close-btn" onclick="window.close()">Close This Tab</button>
    </div>
    <script>
        // Auto-close after 5 seconds (optional)
        // setTimeout(() => window.close(), 5000);
    </script>
</body>
</html>'''
        return html

    def render_consent_page(self):
        """Render the consent page for screenshot capture"""
        user_email = self.current_user.get('email', 'User') if self.current_user else 'User'
        html = f'''<!DOCTYPE html>
<html>
<head>
    <title>BRD Time Tracker - Consent Required</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }}
        .consent-card {{
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 600px;
            padding: 40px;
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .header-icon {{
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #0052CC 0%, #0065FF 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
        }}
        .header-icon svg {{
            width: 30px;
            height: 30px;
            color: white;
        }}
        h1 {{
            color: #172B4D;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        .subtitle {{
            color: #6B778C;
            font-size: 14px;
        }}
        .section {{
            background: #F4F5F7;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }}
        .section-title {{
            color: #172B4D;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .section-title svg {{
            width: 20px;
            height: 20px;
            color: #0052CC;
        }}
        .data-item {{
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #DFE1E6;
        }}
        .data-item:last-child {{
            border-bottom: none;
        }}
        .data-icon {{
            font-size: 18px;
            width: 24px;
            text-align: center;
        }}
        .data-text {{
            flex: 1;
        }}
        .data-text strong {{
            color: #172B4D;
            display: block;
            font-size: 14px;
        }}
        .data-text span {{
            color: #6B778C;
            font-size: 13px;
        }}
        .third-party {{
            background: #FFF7E6;
            border: 1px solid #FFE4B5;
        }}
        .third-party .section-title svg {{
            color: #FF8B00;
        }}
        .retention {{
            background: #E6FCFF;
            border: 1px solid #B3F5FF;
        }}
        .retention .section-title svg {{
            color: #00B8D9;
        }}
        .buttons {{
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }}
        .btn {{
            flex: 1;
            padding: 14px 24px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .btn-primary {{
            background: linear-gradient(135deg, #0052CC 0%, #0065FF 100%);
            color: white;
        }}
        .btn-primary:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 82, 204, 0.4);
        }}
        .btn-secondary {{
            background: #DFE1E6;
            color: #172B4D;
        }}
        .btn-secondary:hover {{
            background: #C1C7D0;
        }}
        .privacy-link {{
            text-align: center;
            margin-top: 16px;
        }}
        .privacy-link a {{
            color: #0052CC;
            text-decoration: none;
            font-size: 14px;
        }}
        .privacy-link a:hover {{
            text-decoration: underline;
        }}
        .user-info {{
            text-align: center;
            color: #6B778C;
            font-size: 13px;
            margin-bottom: 20px;
        }}
    </style>
</head>
<body>
    <div class="consent-card">
        <div class="header">
            <div class="header-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
            </div>
            <h1>Screenshot Capture Consent</h1>
            <p class="subtitle">Please review what data we collect before starting</p>
        </div>

        <p class="user-info">Logged in as: <strong>{user_email}</strong></p>

        <div class="section">
            <div class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                Data We Collect
            </div>
            <div class="data-item">
                <span class="data-icon">📸</span>
                <div class="data-text">
                    <strong>Screenshots</strong>
                    <span>Captured at regular intervals while tracking is active</span>
                </div>
            </div>
            <div class="data-item">
                <span class="data-icon">🪟</span>
                <div class="data-text">
                    <strong>Window Titles</strong>
                    <span>The title of your active application window</span>
                </div>
            </div>
            <div class="data-item">
                <span class="data-icon">📱</span>
                <div class="data-text">
                    <strong>Application Names</strong>
                    <span>Which application is currently in focus</span>
                </div>
            </div>
            <div class="data-item">
                <span class="data-icon">⏱️</span>
                <div class="data-text">
                    <strong>Timestamps</strong>
                    <span>When each screenshot was captured</span>
                </div>
            </div>
            <div class="data-item">
                <span class="data-icon">📋</span>
                <div class="data-text">
                    <strong>Jira Issue Data</strong>
                    <span>Your assigned issues for task matching</span>
                </div>
            </div>
        </div>

        <div class="section third-party">
            <div class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                Third-Party Processing
            </div>
            <div class="data-item">
                <span class="data-icon">🤖</span>
                <div class="data-text">
                    <strong>OpenAI</strong>
                    <span>Screenshots are analyzed by AI to identify which Jira task you're working on. OpenAI may retain data for up to 30 days (not used for training).</span>
                </div>
            </div>
            <div class="data-item">
                <span class="data-icon">🗄️</span>
                <div class="data-text">
                    <strong>Supabase</strong>
                    <span>Screenshots and analysis data are stored securely with encryption at rest.</span>
                </div>
            </div>
        </div>

        <div class="section retention">
            <div class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Data Retention & Your Rights
            </div>
            <div class="data-item">
                <span class="data-icon">🗑️</span>
                <div class="data-text">
                    <strong>Retention Period</strong>
                    <span>Screenshots are retained for 90 days, then automatically deleted</span>
                </div>
            </div>
            <div class="data-item">
                <span class="data-icon">✋</span>
                <div class="data-text">
                    <strong>Your Control</strong>
                    <span>You can pause tracking, delete screenshots, or revoke consent at any time</span>
                </div>
            </div>
        </div>

        <form action="/consent/submit" method="POST">
            <div class="buttons">
                <button type="submit" name="consent" value="decline" class="btn btn-secondary">
                    I Do Not Agree
                </button>
                <button type="submit" name="consent" value="agree" class="btn btn-primary">
                    I Agree - Start Tracking
                </button>
            </div>
        </form>

        <div class="privacy-link">
            <a href="#" onclick="alert('Privacy policy will be available at your organization\\'s privacy policy URL')">Read Full Privacy Policy</a>
        </div>
    </div>
</body>
</html>'''
        return html

    def render_consent_denied_page(self):
        """Render page when user denies consent"""
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>BRD Time Tracker - Consent Required</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 450px;
            padding: 50px 40px;
            text-align: center;
        }
        .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #FF8B00 0%, #FFAB00 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        .icon svg {
            width: 40px;
            height: 40px;
            color: white;
        }
        h1 {
            color: #172B4D;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        p {
            color: #6B778C;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .btn {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #0052CC 0%, #0065FF 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s;
            margin: 8px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 82, 204, 0.4);
        }
        .btn-secondary {
            background: #DFE1E6;
            color: #172B4D;
        }
        .btn-secondary:hover {
            background: #C1C7D0;
            box-shadow: none;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        </div>
        <h1>Consent Required</h1>
        <p>
            Screenshot tracking requires your consent to operate. Without consent, we cannot capture screenshots or track your work time.
        </p>
        <p>
            If you change your mind, you can grant consent at any time by clicking the button below.
        </p>
        <a href="/consent" class="btn">Review & Grant Consent</a>
        <button class="btn btn-secondary" onclick="window.close()">Close</button>
    </div>
</body>
</html>'''
        return html

    def render_dashboard(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Time Tracker - Dashboard</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .dashboard {
            max-width: 600px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            color: white;
        }
        .header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        .header p {
            opacity: 0.9;
            font-size: 14px;
        }
        .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
            margin-bottom: 20px;
        }
        .card-header {
            background: #f8f9fa;
            padding: 20px 24px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .card-header-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #0052CC 0%, #0065FF 100%);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        .card-header h2 {
            color: #172B4D;
            font-size: 18px;
            font-weight: 600;
        }
        .card-body {
            padding: 24px;
        }
        .status-grid {
            display: grid;
            gap: 16px;
        }
        .status-item {
            display: flex;
            align-items: center;
            padding: 16px;
            background: #f8f9fa;
            border-radius: 12px;
            gap: 16px;
        }
        .status-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            flex-shrink: 0;
        }
        .status-icon.active { background: #d4edda; }
        .status-icon.inactive { background: #f8d7da; }
        .status-icon.idle { background: #fff3cd; }
        .status-icon.offline { background: #e2e3e5; }
        .status-content {
            flex: 1;
        }
        .status-label {
            font-size: 12px;
            color: #6B778C;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .status-value {
            font-size: 16px;
            font-weight: 600;
            color: #172B4D;
        }
        .status-value.active { color: #155724; }
        .status-value.inactive { color: #721c24; }
        .status-value.idle { color: #856404; }
        .sync-section {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
        }
        .sync-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        }
        .pending-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .pending-badge {
            background: #dc3545;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
        }
        .pending-text {
            color: #6B778C;
            font-size: 14px;
        }
        .sync-btn {
            background: linear-gradient(135deg, #0052CC 0%, #0065FF 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .sync-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 82, 204, 0.4);
        }
        .sync-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        .info-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 20px;
            color: white;
            text-align: center;
        }
        .info-card p {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 8px;
        }
        .info-card small {
            font-size: 12px;
            opacity: 0.7;
        }
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div class="dashboard">
        <div class="header">
            <h1>Time Tracker</h1>
            <p>Your work activity is being tracked automatically</p>
        </div>

        <div class="card">
            <div class="card-header">
                <div class="card-header-icon">&#128202;</div>
                <h2>Tracking Status</h2>
            </div>
            <div class="card-body">
                <div class="status-grid">
                    <div class="status-item">
                        <div id="tracking-icon" class="status-icon active">&#9989;</div>
                        <div class="status-content">
                            <div class="status-label">Status</div>
                            <div id="tracking-status" class="status-value active">Loading...</div>
                        </div>
                    </div>
                    <div id="network-item" class="status-item hidden">
                        <div class="status-icon offline">&#128225;</div>
                        <div class="status-content">
                            <div class="status-label">Network</div>
                            <div class="status-value">Offline Mode</div>
                        </div>
                    </div>
                </div>

                <div id="sync-section" class="sync-section hidden">
                    <div class="sync-info">
                        <div class="pending-info">
                            <span id="pending-badge" class="pending-badge">0</span>
                            <span class="pending-text">screenshots pending sync</span>
                        </div>
                        <button id="sync-btn" class="sync-btn" onclick="triggerSync()">Sync Now</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="info-card">
            <p>Time tracking data is automatically synced to Jira</p>
            <small>Check your Jira Time Tracker panel for detailed analytics</small>
        </div>
    </div>

    <script>
        function loadStatus() {
            fetch('/api/status')
                .then(r => r.json())
                .then(data => {
                    const trackingIcon = document.getElementById('tracking-icon');
                    const trackingStatus = document.getElementById('tracking-status');
                    const networkItem = document.getElementById('network-item');
                    const syncSection = document.getElementById('sync-section');
                    const pendingBadge = document.getElementById('pending-badge');

                    // Tracking status
                    if (data.idle) {
                        trackingIcon.className = 'status-icon idle';
                        trackingIcon.innerHTML = '&#9208;';
                        trackingStatus.className = 'status-value idle';
                        trackingStatus.textContent = 'Idle - No Activity Detected';
                    } else if (data.tracking) {
                        trackingIcon.className = 'status-icon active';
                        trackingIcon.innerHTML = '&#9989;';
                        trackingStatus.className = 'status-value active';
                        trackingStatus.textContent = 'Actively Tracking';
                    } else {
                        trackingIcon.className = 'status-icon inactive';
                        trackingIcon.innerHTML = '&#10060;';
                        trackingStatus.className = 'status-value inactive';
                        trackingStatus.textContent = 'Tracking Paused';
                    }

                    // Network status
                    if (!data.online) {
                        networkItem.classList.remove('hidden');
                    } else {
                        networkItem.classList.add('hidden');
                    }

                    // Pending sync
                    if (data.offline_pending > 0) {
                        syncSection.classList.remove('hidden');
                        pendingBadge.textContent = data.offline_pending;
                    } else {
                        syncSection.classList.add('hidden');
                    }
                })
                .catch(err => {
                    console.error('Error loading status:', err);
                    document.getElementById('tracking-status').textContent = 'Error loading status';
                });
        }

        function triggerSync() {
            const btn = document.getElementById('sync-btn');
            btn.disabled = true;
            btn.textContent = 'Syncing...';

            fetch('/api/offline/sync', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert('Synced ' + data.synced + ' screenshots successfully!');
                    } else {
                        alert(data.message || 'Sync completed');
                    }
                    loadStatus();
                })
                .catch(err => {
                    console.error('Sync error:', err);
                    alert('Sync failed: ' + err.message);
                })
                .finally(() => {
                    btn.disabled = false;
                    btn.textContent = 'Sync Now';
                });
        }

        loadStatus();
        setInterval(loadStatus, 10000);
    </script>
</body>
</html>'''
        return html

    def render_admin_login_page(self, error=None):
        error_html = f'<div class="error">{error}</div>' if error else ''
        html = f'''<!DOCTYPE html>
<html>
<head>
    <title>Admin Login - Time Tracker</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 20px;
        }}
        .login-card {{
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            width: 100%;
            max-width: 400px;
            overflow: hidden;
        }}
        .card-header {{
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            padding: 30px;
            text-align: center;
        }}
        .card-header h1 {{
            color: white;
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        .card-header p {{
            color: rgba(255, 255, 255, 0.85);
            font-size: 14px;
        }}
        .shield-icon {{
            width: 60px;
            height: 60px;
            background: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 28px;
        }}
        .card-body {{
            padding: 30px;
        }}
        .form-group {{
            margin-bottom: 20px;
        }}
        .form-group label {{
            display: block;
            color: #172B4D;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        .form-group input {{
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.2s;
        }}
        .form-group input:focus {{
            outline: none;
            border-color: #e94560;
        }}
        .login-btn {{
            width: 100%;
            padding: 14px 24px;
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }}
        .login-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(233, 69, 96, 0.4);
        }}
        .error {{
            background: #f8d7da;
            color: #721c24;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
        }}
        .back-link {{
            display: block;
            text-align: center;
            margin-top: 20px;
            color: #6B778C;
            text-decoration: none;
            font-size: 14px;
        }}
        .back-link:hover {{
            color: #172B4D;
        }}
    </style>
</head>
<body>
    <div class="login-card">
        <div class="card-header">
            <div class="shield-icon">&#128272;</div>
            <h1>Admin Access</h1>
            <p>Enter password to access admin panel</p>
        </div>
        <div class="card-body">
            {error_html}
            <form method="POST" action="/admin/login">
                <div class="form-group">
                    <label for="password">Admin Password</label>
                    <input type="password" id="password" name="password" placeholder="Enter admin password" required autofocus>
                </div>
                <button type="submit" class="login-btn">Access Admin Panel</button>
            </form>
            <a href="/" class="back-link">Back to Application</a>
        </div>
    </div>
</body>
</html>'''
        return html

    def render_admin_dashboard(self):
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Admin Dashboard - Time Tracker</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
            background: #1a1a2e;
            color: #fff;
        }
        .navbar {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .navbar h1 {
            font-size: 20px;
            font-weight: 600;
        }
        .navbar-actions {
            display: flex;
            gap: 12px;
        }
        .nav-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
        }
        .nav-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            margin-bottom: 24px;
        }
        @media (max-width: 1200px) {
            .grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
        .card {
            background: #16213e;
            border-radius: 12px;
            overflow: hidden;
        }
        .card-header {
            background: rgba(255, 255, 255, 0.05);
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .card-header h2 {
            font-size: 16px;
            font-weight: 600;
        }
        .card-body {
            padding: 20px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }
        .status-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 16px;
            border-radius: 8px;
        }
        .status-label {
            font-size: 12px;
            color: #8b8fa3;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .status-value {
            font-size: 18px;
            font-weight: 600;
        }
        .status-value.active { color: #4ade80; }
        .status-value.inactive { color: #f87171; }
        .status-value.warning { color: #fbbf24; }
        .control-btn {
            width: 100%;
            padding: 12px 16px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 10px;
            transition: transform 0.2s, opacity 0.2s;
        }
        .control-btn:hover {
            transform: translateY(-1px);
            opacity: 0.9;
        }
        .control-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .control-btn.primary {
            background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
            color: #000;
        }
        .control-btn.danger {
            background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
            color: #fff;
        }
        .control-btn.secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        .logs-container {
            background: #0f0f1a;
            border-radius: 8px;
            height: 450px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
        }
        .log-entry {
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
            gap: 12px;
            transition: background 0.15s;
        }
        .log-entry:hover {
            background: rgba(255, 255, 255, 0.04);
        }
        .log-entry.screenshot { background: rgba(74, 222, 128, 0.05); border-left: 3px solid #4ade80; }
        .log-entry.window-switch { background: rgba(96, 165, 250, 0.05); border-left: 3px solid #60a5fa; }
        .log-entry.settings { background: rgba(251, 191, 36, 0.05); border-left: 3px solid #fbbf24; }
        .log-entry.tracking { background: rgba(167, 139, 250, 0.05); border-left: 3px solid #a78bfa; }
        .log-entry.user { background: rgba(236, 72, 153, 0.05); border-left: 3px solid #ec4899; }
        .log-entry.error { background: rgba(248, 113, 113, 0.08); border-left: 3px solid #f87171; }
        .log-entry.warning { background: rgba(251, 191, 36, 0.08); border-left: 3px solid #fbbf24; }
        .log-icon {
            font-size: 16px;
            width: 24px;
            text-align: center;
            flex-shrink: 0;
        }
        .log-time {
            color: #6b7280;
            flex-shrink: 0;
            font-size: 11px;
            min-width: 70px;
        }
        .log-level {
            font-weight: 600;
            flex-shrink: 0;
            width: 50px;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            text-align: center;
        }
        .log-level.INFO { color: #4ade80; background: rgba(74, 222, 128, 0.15); }
        .log-level.WARN { color: #fbbf24; background: rgba(251, 191, 36, 0.15); }
        .log-level.ERROR { color: #f87171; background: rgba(248, 113, 113, 0.15); }
        .log-message {
            color: #e5e7eb;
            word-break: break-word;
            flex: 1;
        }
        .log-message .app-name { color: #60a5fa; font-weight: 500; }
        .log-message .duration { color: #4ade80; font-weight: 500; }
        .log-message .user-email { color: #ec4899; }
        .log-message .setting-value { color: #fbbf24; font-weight: 500; }
        .log-details {
            display: none;
            margin-top: 8px;
            padding: 10px 12px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            font-size: 11px;
            line-height: 1.6;
            border-left: 2px solid rgba(255, 255, 255, 0.1);
        }
        .log-entry.expanded .log-details {
            display: block;
        }
        .log-details-row {
            display: flex;
            gap: 8px;
            padding: 2px 0;
        }
        .log-details-label {
            color: #6b7280;
            min-width: 70px;
            flex-shrink: 0;
        }
        .log-details-value {
            color: #e5e7eb;
            word-break: break-all;
        }
        .log-details-value.file { color: #fbbf24; }
        .log-details-value.id { color: #a78bfa; font-family: monospace; }
        .log-details-value.storage { color: #6b7280; font-family: monospace; font-size: 10px; }
        .log-details-value.size { color: #60a5fa; }
        .log-details-value.time { color: #4ade80; }
        .log-details-value.app { color: #60a5fa; font-weight: 500; }
        .log-details-value.title { color: #9ca3af; font-style: italic; }
        .log-expand-btn {
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            font-size: 10px;
            padding: 2px 6px;
            margin-left: 8px;
            border-radius: 3px;
            transition: all 0.15s;
        }
        .log-expand-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        .log-entry.expanded .log-expand-btn {
            color: #4ade80;
        }
        .log-content-wrapper {
            flex: 1;
            min-width: 0;
        }
        .logs-toolbar {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        .filter-btn {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .filter-btn:hover, .filter-btn.active {
            background: rgba(255, 255, 255, 0.2);
        }
        .empty-logs {
            color: #6b7280;
            text-align: center;
            padding: 40px;
        }
        .full-width { grid-column: 1 / -1; }
    </style>
</head>
<body>
    <nav class="navbar">
        <h1>&#128272; Admin Dashboard</h1>
        <div class="navbar-actions">
            <a href="/" class="nav-btn">View App</a>
            <a href="/admin/logout" class="nav-btn">Logout</a>
        </div>
    </nav>

    <div class="container">
        <div class="grid">
            <!-- Status Card -->
            <div class="card">
                <div class="card-header">
                    <h2>&#128202; System Status</h2>
                </div>
                <div class="card-body">
                    <div class="status-grid">
                        <div class="status-item">
                            <div class="status-label">Tracking</div>
                            <div id="tracking-status" class="status-value">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">User</div>
                            <div id="user-status" class="status-value">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">Network</div>
                            <div id="network-status" class="status-value">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">Pending Sync</div>
                            <div id="pending-status" class="status-value">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Controls Card -->
            <div class="card">
                <div class="card-header">
                    <h2>&#9881; Controls</h2>
                </div>
                <div class="card-body">
                    <button id="btn-start" class="control-btn primary" onclick="controlAction('start_tracking')">
                        &#9654; Start Tracking
                    </button>
                    <button id="btn-stop" class="control-btn danger" onclick="controlAction('stop_tracking')">
                        &#9632; Stop Tracking
                    </button>
                    <button class="control-btn secondary" onclick="controlAction('force_sync')">
                        &#128259; Force Sync
                    </button>
                    <button class="control-btn secondary" onclick="controlAction('refresh_settings')">
                        &#128260; Refresh Settings
                    </button>
                    <button class="control-btn secondary" onclick="controlAction('clear_logs')">
                        &#128465; Clear Logs
                    </button>
                </div>
            </div>

            <!-- Session Info Card -->
            <div class="card">
                <div class="card-header">
                    <h2>&#128337; Session Info</h2>
                </div>
                <div class="card-body">
                    <div class="status-grid">
                        <div class="status-item">
                            <div class="status-label">App Version</div>
                            <div id="version-status" class="status-value">1.0.0</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">Screenshot Interval</div>
                            <div id="interval-status" class="status-value">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">Session Start</div>
                            <div id="session-start" class="status-value">Loading...</div>
                        </div>
                        <div class="status-item">
                            <div class="status-label">Screenshots Today</div>
                            <div id="screenshots-today" class="status-value">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Logs Card -->
            <div class="card full-width">
                <div class="card-header">
                    <h2>&#128196; Application Logs</h2>
                </div>
                <div class="card-body">
                    <div class="logs-toolbar">
                        <button class="filter-btn active" onclick="filterLogs('all')">All</button>
                        <button class="filter-btn" onclick="filterLogs('INFO')">Info</button>
                        <button class="filter-btn" onclick="filterLogs('WARN')">Warning</button>
                        <button class="filter-btn" onclick="filterLogs('ERROR')">Error</button>
                        <button class="filter-btn" onclick="loadLogs()" style="margin-left: auto;">&#128260; Refresh</button>
                    </div>
                    <div id="logs-container" class="logs-container">
                        <div class="empty-logs">Loading logs...</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentFilter = 'all';

        function formatLogMessage(message, level) {
            let icon = '📋';
            let category = '';
            let formattedMsg = message;

            // Determine icon and category based on message content
            if (message.includes('Screenshot captured:')) {
                icon = '📸';
                category = 'screenshot';
                // Format: "Screenshot captured: chrome.exe (10s)"
                const match = message.match(/Screenshot captured: (.+?) \((\d+)s\)/);
                if (match) {
                    formattedMsg = `Screenshot captured: <span class="app-name">${match[1]}</span> <span class="duration">(${match[2]}s)</span>`;
                }
            } else if (message.includes('Window switch:')) {
                icon = '🔄';
                category = 'window-switch';
                const match = message.match(/Window switch: (.+)/);
                if (match) {
                    formattedMsg = `Switched to <span class="app-name">${match[1]}</span>`;
                }
            } else if (message.includes('Settings loaded:')) {
                icon = '⚙️';
                category = 'settings';
                const match = message.match(/Settings loaded: interval=(\d+)s/);
                if (match) {
                    formattedMsg = `Settings loaded: interval = <span class="setting-value">${match[1]}s</span>`;
                }
            } else if (message.includes('Tracking started')) {
                icon = '▶️';
                category = 'tracking';
                const match = message.match(/Tracking started \(interval: (\d+)s\)/);
                if (match) {
                    formattedMsg = `Tracking started (interval: <span class="setting-value">${match[1]}s</span>)`;
                }
            } else if (message.includes('Tracking stopped')) {
                icon = '⏹️';
                category = 'tracking';
            } else if (message.includes('User idle')) {
                icon = '💤';
                category = 'tracking';
                const match = message.match(/User idle \(no activity for (\d+)s\)/);
                if (match) {
                    formattedMsg = `User idle (no activity for <span class="duration">${match[1]}s</span>)`;
                }
            } else if (message.includes('User active')) {
                icon = '✨';
                category = 'tracking';
            } else if (message.includes('granted consent') || message.includes('logged in:')) {
                icon = '👤';
                category = 'user';
                const match = message.match(/User (.+?) granted consent/);
                if (match) {
                    formattedMsg = `<span class="user-email">${match[1]}</span> granted consent`;
                }
            } else if (message.includes('Admin logged in')) {
                icon = '🔐';
                category = 'user';
            } else if (message.includes('Application started')) {
                icon = '🚀';
                category = 'tracking';
            } else if (message.includes('Sync') || message.includes('sync')) {
                icon = '☁️';
                category = 'settings';
            } else if (level === 'ERROR') {
                icon = '❌';
                category = 'error';
            } else if (level === 'WARN') {
                icon = '⚠️';
                category = 'warning';
            }

            return { icon, category, formattedMsg };
        }

        function formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        }

        function formatDetails(details, category) {
            if (!details) return '';

            let html = '<div class="log-details">';

            if (category === 'screenshot') {
                // Screenshot details
                if (details.file) html += `<div class="log-details-row"><span class="log-details-label">File:</span><span class="log-details-value file">${details.file}</span></div>`;
                if (details.id) html += `<div class="log-details-row"><span class="log-details-label">ID:</span><span class="log-details-value id">${details.id}</span></div>`;
                if (details.storage) html += `<div class="log-details-row"><span class="log-details-label">Storage:</span><span class="log-details-value storage">${details.storage}</span></div>`;
                if (details.size) html += `<div class="log-details-row"><span class="log-details-label">Size:</span><span class="log-details-value size">${formatBytes(details.size)}</span></div>`;
                if (details.start && details.end) html += `<div class="log-details-row"><span class="log-details-label">Time:</span><span class="log-details-value time">${details.start} → ${details.end}</span></div>`;
                if (details.duration) html += `<div class="log-details-row"><span class="log-details-label">Duration:</span><span class="log-details-value time">${details.duration}s</span></div>`;
                if (details.title) html += `<div class="log-details-row"><span class="log-details-label">Title:</span><span class="log-details-value title">${details.title}</span></div>`;
            } else if (category === 'window-switch') {
                // Window switch details
                if (details.app) html += `<div class="log-details-row"><span class="log-details-label">App:</span><span class="log-details-value app">${details.app}</span></div>`;
                if (details.title) html += `<div class="log-details-row"><span class="log-details-label">Title:</span><span class="log-details-value title">${details.title}</span></div>`;
                if (details.time) html += `<div class="log-details-row"><span class="log-details-label">Time:</span><span class="log-details-value time">${details.time}</span></div>`;
            } else {
                // Generic details
                for (const [key, value] of Object.entries(details)) {
                    html += `<div class="log-details-row"><span class="log-details-label">${key}:</span><span class="log-details-value">${value}</span></div>`;
                }
            }

            html += '</div>';
            return html;
        }

        function toggleLogDetails(btn) {
            const entry = btn.closest('.log-entry');
            entry.classList.toggle('expanded');
            btn.textContent = entry.classList.contains('expanded') ? '▼ Hide' : '▶ Details';
        }

        function loadStatus() {
            fetch('/api/admin/status')
                .then(r => r.json())
                .then(data => {
                    // Tracking status
                    const trackingEl = document.getElementById('tracking-status');
                    if (data.is_idle) {
                        trackingEl.textContent = 'Idle';
                        trackingEl.className = 'status-value warning';
                    } else if (data.tracking_active) {
                        trackingEl.textContent = 'Active';
                        trackingEl.className = 'status-value active';
                    } else {
                        trackingEl.textContent = 'Stopped';
                        trackingEl.className = 'status-value inactive';
                    }

                    // User status
                    const userEl = document.getElementById('user-status');
                    userEl.textContent = data.current_user || 'Not logged in';
                    userEl.className = data.current_user ? 'status-value active' : 'status-value inactive';

                    // Network status
                    const networkEl = document.getElementById('network-status');
                    networkEl.textContent = data.online ? 'Online' : 'Offline';
                    networkEl.className = data.online ? 'status-value active' : 'status-value warning';

                    // Pending status
                    const pendingEl = document.getElementById('pending-status');
                    pendingEl.textContent = data.offline_pending || '0';
                    pendingEl.className = data.offline_pending > 0 ? 'status-value warning' : 'status-value active';

                    // Session Info card
                    const intervalEl = document.getElementById('interval-status');
                    if (intervalEl) {
                        intervalEl.textContent = (data.screenshot_interval || 30) + 's';
                        intervalEl.className = 'status-value active';
                    }

                    const sessionStartEl = document.getElementById('session-start');
                    if (sessionStartEl && data.session_start) {
                        const startTime = new Date(data.session_start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                        sessionStartEl.textContent = startTime;
                        sessionStartEl.className = 'status-value active';
                    } else if (sessionStartEl) {
                        sessionStartEl.textContent = 'N/A';
                        sessionStartEl.className = 'status-value inactive';
                    }

                    const screenshotsTodayEl = document.getElementById('screenshots-today');
                    if (screenshotsTodayEl) {
                        screenshotsTodayEl.textContent = data.screenshots_today || '0';
                        screenshotsTodayEl.className = 'status-value active';
                    }

                    // Update buttons
                    document.getElementById('btn-start').disabled = data.running;
                    document.getElementById('btn-stop').disabled = !data.running;
                })
                .catch(err => console.error('Error loading status:', err));
        }

        function loadLogs() {
            const url = currentFilter === 'all' ? '/api/admin/logs?limit=200' : `/api/admin/logs?level=${currentFilter}&limit=200`;
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    const container = document.getElementById('logs-container');
                    if (!data.logs || data.logs.length === 0) {
                        container.innerHTML = '<div class="empty-logs">No logs available</div>';
                        return;
                    }

                    container.innerHTML = data.logs.reverse().map(log => {
                        const time = new Date(log.timestamp).toLocaleTimeString();
                        const { icon, category, formattedMsg } = formatLogMessage(log.message, log.level);
                        const hasDetails = log.details && Object.keys(log.details).length > 0;
                        const detailsHtml = hasDetails ? formatDetails(log.details, category) : '';
                        const expandBtn = hasDetails ? `<button class="log-expand-btn" onclick="toggleLogDetails(this)">▶ Details</button>` : '';

                        return `
                            <div class="log-entry ${category}">
                                <span class="log-icon">${icon}</span>
                                <span class="log-time">${time}</span>
                                <span class="log-level ${log.level}">${log.level}</span>
                                <div class="log-content-wrapper">
                                    <span class="log-message">${formattedMsg}${expandBtn}</span>
                                    ${detailsHtml}
                                </div>
                            </div>
                        `;
                    }).join('');
                })
                .catch(err => {
                    console.error('Error loading logs:', err);
                    document.getElementById('logs-container').innerHTML = '<div class="empty-logs">Error loading logs</div>';
                });
        }

        function filterLogs(level) {
            currentFilter = level;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            loadLogs();
        }

        function controlAction(action) {
            fetch('/api/admin/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    loadStatus();
                    loadLogs();
                } else {
                    alert(data.error || 'Action failed');
                }
            })
            .catch(err => {
                console.error('Control action error:', err);
                alert('Failed to execute action');
            });
        }

        // Initial load
        loadStatus();
        loadLogs();

        // Auto-refresh
        setInterval(loadStatus, 5000);
        setInterval(loadLogs, 10000);
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

