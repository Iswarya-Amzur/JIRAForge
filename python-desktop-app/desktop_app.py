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
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

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

def get_env_var(key, default=None):
    """Get environment variable with fallback to embedded values"""
    value = os.getenv(key, default)
    return value

# ============================================================================
# ATLASSIAN OAUTH MANAGER
# ============================================================================

class AtlassianAuthManager:
    """Manages Atlassian OAuth 3LO flow"""
    
    def __init__(self, web_port=51777, store_path=None):
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
# OFFLINE DATA MANAGER
# ============================================================================

class OfflineManager:
    """Manages offline data storage and synchronization with Supabase"""
    
    def __init__(self, db_path=None):
        """Initialize offline manager with SQLite database"""
        self.db_path = db_path or os.path.join(tempfile.gettempdir(), 'brd_tracker_offline.db')
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
            try:
                socket.setdefaulttimeout(3)
                socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
                if not self.is_online:
                    print("[OK] Network connectivity restored")
                self.is_online = True
                return True
            except (socket.error, socket.timeout):
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
                    start_time, end_time, duration_seconds,
                    user_assigned_issues, metadata, image_data, thumbnail_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
# MAIN APPLICATION
# ============================================================================

class BRDTimeTracker:
    """Main application class"""
    
    def __init__(self):
        print("[INFO] Initializing BRD Time Tracker...")
        
        # Configuration (defaults, will be overridden by server settings)
        self.capture_interval = int(get_env_var('CAPTURE_INTERVAL', 300))
        self.web_port = int(get_env_var('WEB_PORT', 51777))
        
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

        # Multi-tenancy: Organization info
        self.organization_id = None  # UUID from public.organizations table
        self.organization_name = None  # Organization name (Jira site name)
        self.jira_instance_url = None  # Jira instance URL
        
        # Offline mode support
        self.offline_manager = OfflineManager()
        self._sync_thread = None
        self._last_sync_time = 0
        self._sync_interval = 60  # Try to sync every 60 seconds when online
        
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

            # Update user's organization if not set or different
            if self.organization_id and existing_org_id != self.organization_id:
                client.table('users').update({
                    'organization_id': self.organization_id,
                    'display_name': name,
                    'email': email
                }).eq('id', user_id).execute()
                print(f"[OK] Updated user organization to: {self.organization_id}")

                # Ensure organization membership exists
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
        return os.path.join(tempfile.gettempdir(), 'brd_tracker_user_cache.json')
    
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
                if self.current_window_key and self.current_window_key != 'unknown':
                    print(f"[INFO] Window switched at {self.current_window_start_time.strftime('%H:%M:%S')}:")
                    print(f"     - App: {app_name}")
                    print(f"     - Title: {title[:50]}")
            
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
            if duration_seconds < 1:
                duration_seconds = 1
                start_time = end_time - timedelta(seconds=1)
            
            # Prepare screenshot data for both online and offline storage
            work_type = window_info.get('work_type', 'office')  # Default to 'office'
            is_blacklisted = window_info.get('is_blacklisted', False)
            
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
                    
                    # Store the screenshot ID so we can update end_time/duration later
                    # When user switches windows OR when interval is reached, this record will be updated
                    self.current_window_screenshot_id = screenshot_id

                    # IMPORTANT: Track the actual start_time saved to database
                    # This may differ from current_window_start_time due to gap-free continuity logic
                    self.current_window_db_start_time = start_time

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
        
        # Get the appropriate clients
        db_client = self.supabase_service if self.supabase_service else self.supabase
        storage_client = self.supabase_service if self.supabase_service else self.supabase
        
        # Perform sync
        result = self.offline_manager.sync_all(db_client, storage_client)
        
        self._last_sync_time = current_time
        
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
                                self.current_window_start_time = None
                                self.current_window_db_start_time = None
                                self.last_screenshot_end_time = end_time

                            except Exception as e:
                                print(f"[ERROR] Error finalizing session before idle: {e}")
                        
                        self.is_idle = True
                        self.update_tray_icon()

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
                    # Reset interval timer so first capture happens after full interval
                    self.last_interval_time = time.time()
                    # Start fresh - next screenshot will be the start of a new work session
                    # IMPORTANT: Reset ALL tracking state so new session starts from "now"
                    self.current_window_start_time = None
                    self.current_window_db_start_time = None
                    self.current_window_screenshot_id = None
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
                    if self.current_window_screenshot_id is not None and self.current_window_db_start_time is not None:
                        # SAFEGUARD: Skip if the current record was just created (less than interval seconds ago)
                        # This prevents the bug where delays (settings fetch, network) cause duplicate interval updates
                        record_age = (datetime.now() - self.current_window_db_start_time).total_seconds()
                        if record_age < current_capture_interval:
                            print(f"[DEBUG] Skipping interval update - record only {int(record_age)}s old (need {current_capture_interval}s)")
                            # Reset interval timer to prevent continuous triggering
                            self.last_interval_time = time.time()
                            continue
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
                        except Exception as e:
                            print(f"[ERROR] Error updating record before interval: {e}")

                        # Reset tracking - the new screenshot will start fresh from now
                        self.current_window_start_time = end_time
                        self.current_window_db_start_time = None  # Will be set when new screenshot is uploaded
                        self.current_window_screenshot_id = None
                    
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
    
    def stop_tracking(self):
        """Stop screenshot tracking"""
        self.running = False
        self.tracking_active = False
        
        # Update tray icon to blue
        self.update_tray_icon()
        
        print("[OK] Tracking stopped")
    
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
                        self.current_user_id = self.ensure_user_exists(user_info)
                        # Associate any anonymous offline records with this user
                        self._associate_offline_records()
                    except Exception as e:
                        print(f"[WARN] Could not sync user to database: {e}")
                        # Try to load cached user_id from local storage
                        self.current_user_id = self._load_cached_user_id()
                    print(f"[OK] Welcome back, {user_info.get('email', 'User')}!")
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
        
        # Open browser if not authenticated (only if online)
        if not self.current_user:
            if is_online:
                print("[INFO] Opening browser for authentication...")
                webbrowser.open(f'http://localhost:{self.web_port}/login')
            else:
                print(f"[INFO] Dashboard available at http://localhost:{self.web_port}")
                print("[INFO] Login when online to sync your data")
        
        # Start tracking (even in offline/anonymous mode)
        if should_track:
            self.start_tracking()
        
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
        .status-bar {
            display: flex;
            gap: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        .status.offline {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        .status.idle {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        .sync-btn {
            background: #0052CC;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        .sync-btn:hover {
            background: #0065FF;
        }
        .sync-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .pending-badge {
            background: #dc3545;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>BRD Time Tracker Dashboard</h1>
        <div class="status-bar">
            <div id="status" class="status">Loading...</div>
            <div id="network-status" class="status" style="display: none;"></div>
            <div id="offline-info" style="display: none;">
                <button id="sync-btn" class="sync-btn" onclick="triggerSync()">Sync Now</button>
                <span id="pending-count" class="pending-badge"></span>
            </div>
        </div>
        <h2>Recent Screenshots</h2>
        <div id="screenshots" class="loading">Loading screenshots...</div>
    </div>
    <script>
        // Load status
        function loadStatus() {
            fetch('/api/status')
                .then(r => r.json())
                .then(data => {
                    const statusDiv = document.getElementById('status');
                    const networkDiv = document.getElementById('network-status');
                    const offlineInfo = document.getElementById('offline-info');
                    const pendingCount = document.getElementById('pending-count');
                    
                    // Tracking status
                    if (data.idle) {
                        statusDiv.className = 'status idle';
                        statusDiv.textContent = '⏸ Idle (No Activity)';
                    } else if (data.tracking) {
                        statusDiv.className = 'status active';
                        statusDiv.textContent = '✓ Tracking Active';
                    } else {
                        statusDiv.className = 'status inactive';
                        statusDiv.textContent = '○ Tracking Inactive';
                    }
                    
                    // Network status
                    if (!data.online) {
                        networkDiv.style.display = 'block';
                        networkDiv.className = 'status offline';
                        networkDiv.textContent = '📡 Offline Mode';
                    } else {
                        networkDiv.style.display = 'none';
                    }
                    
                    // Pending offline screenshots
                    if (data.offline_pending > 0) {
                        offlineInfo.style.display = 'flex';
                        offlineInfo.style.alignItems = 'center';
                        offlineInfo.style.gap = '8px';
                        pendingCount.textContent = data.offline_pending + ' pending';
                    } else {
                        offlineInfo.style.display = 'none';
                    }
                })
                .catch(err => {
                    console.error('Error loading status:', err);
                    document.getElementById('status').textContent = 'Error loading status';
                });
        }
        
        // Trigger sync
        function triggerSync() {
            const btn = document.getElementById('sync-btn');
            btn.disabled = true;
            btn.textContent = 'Syncing...';
            
            fetch('/api/offline/sync', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        alert('Synced ' + data.synced + ' screenshots. ' + data.failed + ' failed.');
                    } else {
                        alert(data.message || 'Sync completed');
                    }
                    loadStatus();
                    loadScreenshots();
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
        
        // Load status initially and refresh every 10 seconds
        loadStatus();
        setInterval(loadStatus, 10000);
        
        // Load screenshots
        function loadScreenshots() {
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
        }
        
        loadScreenshots();
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

