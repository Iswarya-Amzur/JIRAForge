-- ============================================================================
-- SQLite Schema for Offline Activity Tracking
-- ============================================================================
-- This script creates all necessary tables for offline activity tracking
-- with OCR text storage. Run this directly in SQLite if tables don't exist.
--
-- Database location: %APPDATA%\TimeTracker\time_tracker_offline.db
-- ============================================================================

-- ============================================================================
-- TABLE: active_sessions
-- Stores real-time activity sessions between batch uploads
-- ============================================================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_title TEXT,
    application_name TEXT,
    classification TEXT,
    ocr_text TEXT,                    -- OCR extracted text from window
    total_time_seconds REAL DEFAULT 0,
    visit_count INTEGER DEFAULT 1,
    first_seen TEXT,                   -- ISO timestamp
    last_seen TEXT,                    -- ISO timestamp
    timer_started_at TEXT,             -- ISO timestamp
    UNIQUE(window_title, application_name)
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_app 
    ON active_sessions(application_name);

CREATE INDEX IF NOT EXISTS idx_active_sessions_classification 
    ON active_sessions(classification);

-- ============================================================================
-- TABLE: app_classifications_cache
-- Caches app classifications synced from Supabase
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_classifications_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT,
    project_key TEXT,
    identifier TEXT NOT NULL,          -- Process name (e.g., 'chrome.exe') or URL pattern
    display_name TEXT,                 -- Human-readable name
    classification TEXT NOT NULL,      -- 'productive', 'non_productive', 'private'
    match_by TEXT NOT NULL,            -- 'process' or 'url'
    cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, project_key, identifier, match_by)
);

CREATE INDEX IF NOT EXISTS idx_app_class_cache_identifier 
    ON app_classifications_cache(identifier);

CREATE INDEX IF NOT EXISTS idx_app_class_cache_match_by 
    ON app_classifications_cache(match_by);

CREATE INDEX IF NOT EXISTS idx_app_class_cache_classification 
    ON app_classifications_cache(classification);

-- ============================================================================
-- TABLE: offline_screenshots (for backup/offline mode)
-- ============================================================================
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
    extracted_text TEXT,              -- OCR extracted text
    ocr_confidence REAL,              -- OCR confidence score
    ocr_method TEXT,                  -- OCR engine used
    ocr_line_count INTEGER,           -- Number of text lines detected
    metadata TEXT,                    -- JSON metadata
    image_data BLOB,                  -- Screenshot image bytes
    thumbnail_data BLOB,              -- Thumbnail bytes
    synced INTEGER DEFAULT 0,         -- 0 = pending, 1 = synced
    sync_attempts INTEGER DEFAULT 0,
    last_sync_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offline_screenshots_synced 
    ON offline_screenshots(synced);

CREATE INDEX IF NOT EXISTS idx_offline_screenshots_user 
    ON offline_screenshots(user_id);

CREATE INDEX IF NOT EXISTS idx_offline_screenshots_timestamp 
    ON offline_screenshots(timestamp);

-- ============================================================================
-- TABLE: project_settings_cache
-- Caches project-specific settings from Supabase
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_settings_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT NOT NULL,
    project_key TEXT NOT NULL,
    project_name TEXT,
    tracked_statuses TEXT,           -- JSON array of tracked issue statuses
    cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, project_key)
);

CREATE INDEX IF NOT EXISTS idx_project_settings_org 
    ON project_settings_cache(organization_id);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if all tables exist
SELECT 'Tables Created:' AS status;
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Show active_sessions schema (verify ocr_text column exists)
SELECT 'active_sessions columns:' AS status;
PRAGMA table_info(active_sessions);

-- Show app_classifications_cache schema
SELECT 'app_classifications_cache columns:' AS status;
PRAGMA table_info(app_classifications_cache);
