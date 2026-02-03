# Desktop App Version Control & Update Notification Feature

## Overview

This document describes the version control and update notification system for the Time Tracker desktop application. The system enables:

- Tracking released versions of the desktop app in a central database
- Notifying users when a new version is available
- Providing download links for updates in both the desktop app and Forge (Jira) UI
- Supporting mandatory updates that users cannot dismiss

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RELEASE WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Admin/Developer                                                             │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐        │
│  │ Build new .exe  │ ──▶ │ Upload to       │ ──▶ │ Create release  │        │
│  │ with new version│     │ Supabase Storage│     │ record in DB    │        │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         UPDATE CHECK WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                         ┌─────────────────┐            │
│  │  Desktop App    │ ───GET /api/app-───────▶│   AI Server     │            │
│  │  (Python)       │    version/check        │   (Node.js)     │            │
│  │                 │◀──────────────────────── │                 │            │
│  │  Shows toast    │   {updateAvailable,     │   Queries       │            │
│  │  notification   │    latestVersion,       │   Supabase      │            │
│  │                 │    downloadUrl}         │                 │            │
│  └─────────────────┘                         └────────┬────────┘            │
│                                                       │                      │
│  ┌─────────────────┐                                  │                      │
│  │  Forge App      │ ───invoke('getDesktop───────────▶│                      │
│  │  (React/Jira)   │    AppStatus')                   │                      │
│  │                 │◀────────────────────────────────── │                      │
│  │  Shows banner   │   {status, updateAvailable,      │                      │
│  │  in Jira UI     │    latestVersion, downloadUrl}   │                      │
│  └─────────────────┘                                  ▼                      │
│                                              ┌─────────────────┐            │
│                                              │    Supabase     │            │
│                                              │   (PostgreSQL)  │            │
│                                              │                 │            │
│                                              │  app_releases   │            │
│                                              │  table          │            │
│                                              └─────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `app_releases`

Stores information about each released version of the desktop application.

```sql
CREATE TABLE public.app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Version information
    version TEXT NOT NULL,                          -- Semantic version e.g., "1.1.0"
    platform TEXT NOT NULL DEFAULT 'windows',       -- windows, macos, linux
    
    -- Download information
    download_url TEXT NOT NULL,                     -- Supabase storage URL
    file_size_bytes BIGINT,                         -- Size of the executable
    checksum TEXT,                                  -- SHA256 hash for integrity
    
    -- Release details
    release_notes TEXT,                             -- What's new in this version
    min_supported_version TEXT,                     -- Minimum version that can upgrade
    
    -- Flags
    is_mandatory BOOLEAN DEFAULT FALSE,             -- Force users to update
    is_latest BOOLEAN DEFAULT TRUE,                 -- Mark as current latest
    is_active BOOLEAN DEFAULT TRUE,                 -- Can be downloaded
    
    -- Metadata
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    
    UNIQUE(version, platform)
);
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `version` | TEXT | Semantic version (e.g., "1.0.0", "1.1.0") |
| `platform` | TEXT | Target platform: "windows", "macos", "linux" |
| `download_url` | TEXT | Full URL to download the executable |
| `file_size_bytes` | BIGINT | File size for progress display |
| `checksum` | TEXT | SHA256 hash for integrity verification |
| `release_notes` | TEXT | User-facing release notes |
| `min_supported_version` | TEXT | Minimum version required to upgrade |
| `is_mandatory` | BOOLEAN | If true, users must update |
| `is_latest` | BOOLEAN | Marks the current latest version |
| `is_active` | BOOLEAN | If false, version is deprecated |
| `published_at` | TIMESTAMPTZ | When the version was released |

### Automatic `is_latest` Management

A database trigger automatically manages the `is_latest` flag:

```sql
-- When a new release is marked as latest, all others are unmarked
CREATE OR REPLACE FUNCTION public.update_latest_release()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_latest = TRUE THEN
        UPDATE public.app_releases
        SET is_latest = FALSE, updated_at = NOW()
        WHERE platform = NEW.platform 
          AND id != NEW.id 
          AND is_latest = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. Get Latest Version

```
GET /api/app-version/latest?platform=windows
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "1.1.0",
    "downloadUrl": "https://..../TimeTracker.exe",
    "releaseNotes": "Bug fixes and performance improvements",
    "isMandatory": false,
    "minSupportedVersion": null,
    "fileSizeBytes": 45678901,
    "publishedAt": "2026-02-03T10:00:00Z"
  }
}
```

#### 2. Check for Update

```
GET /api/app-version/check?platform=windows&current=1.0.0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updateAvailable": true,
    "canUpdate": true,
    "currentVersion": "1.0.0",
    "latestVersion": "1.1.0",
    "downloadUrl": "https://..../TimeTracker.exe",
    "releaseNotes": "Bug fixes and performance improvements",
    "isMandatory": false,
    "fileSizeBytes": 45678901,
    "publishedAt": "2026-02-03T10:00:00Z"
  }
}
```

### Protected Endpoints (Require Authentication)

#### 3. Get All Releases

```
GET /api/app-version/releases?platform=windows&includeInactive=false
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "version": "1.1.0",
      "platform": "windows",
      "download_url": "https://...",
      "is_latest": true,
      "is_active": true,
      "published_at": "2026-02-03T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "version": "1.0.0",
      "platform": "windows",
      "download_url": "https://...",
      "is_latest": false,
      "is_active": true,
      "published_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

#### 4. Create New Release

```
POST /api/app-version/releases
Content-Type: application/json

{
  "version": "1.2.0",
  "platform": "windows",
  "downloadUrl": "https://..../TimeTracker-1.2.0.exe",
  "releaseNotes": "New features:\n- Dark mode\n- Auto-update",
  "isMandatory": false,
  "fileSizeBytes": 48000000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-new",
    "version": "1.2.0",
    "platform": "windows",
    "is_latest": true,
    ...
  }
}
```

### Forge Remote Endpoint

#### 5. Get Latest App Version (Forge)

```
POST /api/forge/app-version/latest
Headers: X-Forge-Invocation-Token: <FIT>

{
  "platform": "windows",
  "currentVersion": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "latestVersion": "1.1.0",
    "downloadUrl": "https://...",
    "releaseNotes": "...",
    "updateAvailable": true,
    "isMandatory": false
  }
}
```

---

## Version Comparison Logic

The system uses **semantic versioning** (MAJOR.MINOR.PATCH) for comparing versions:

```javascript
function isNewerVersion(v1, v2) {
  // v1 = latest version, v2 = current version
  // Returns true if v1 is newer than v2
  
  const parts1 = v1.split('.').map(Number);  // [1, 1, 0]
  const parts2 = v2.split('.').map(Number);  // [1, 0, 0]

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return true;   // 1.1.0 > 1.0.0 ✓
    if (p1 < p2) return false;  // 1.0.0 < 1.1.0 ✗
  }
  
  return false; // Versions are equal
}
```

**Examples:**
- `1.1.0` vs `1.0.0` → Update available ✓
- `1.0.1` vs `1.0.0` → Update available ✓
- `2.0.0` vs `1.9.9` → Update available ✓
- `1.0.0` vs `1.0.0` → No update
- `1.0.0` vs `1.1.0` → No update (current is newer)

---

## Desktop App Implementation

### Configuration

```python
# desktop_app.py

# Application version - UPDATE THIS WHEN RELEASING
APP_VERSION = "1.0.0"
```

### Version Check on Startup

```python
def run(self):
    """Main application entry point"""
    # ... initialization code ...
    
    # Check for updates on startup (only if online)
    if is_online:
        print("[INFO] Checking for app updates...")
        self.check_for_app_updates(show_notification=True, force=True)
```

### Periodic Version Check

```python
def tracking_loop(self):
    """Main tracking loop"""
    while self.running:
        # ... tracking code ...
        
        # Check for updates every 4 hours
        if time.time() - self.last_version_check_time > self.version_check_interval:
            self.check_for_app_updates(show_notification=True)
```

### Windows Toast Notification

When an update is available, a Windows toast notification is displayed:

```python
def show_update_notification(update_info):
    notification = Notification(
        app_id="Time Tracker",
        title="Update Available: v1.1.0",
        msg="Bug fixes and performance improvements",
        duration="short"
    )
    notification.add_actions(label="Download Update", launch=download_url)
    notification.show()
```

### Admin UI Update Badge

The desktop app's admin UI (localhost:51777) shows:
- Current version
- "Update Available" badge when update exists
- Direct download link

---

## Forge App (Jira UI) Implementation

### Resolver Enhancement

The `getDesktopAppStatus` resolver now returns version information:

```javascript
// userResolvers.js

resolver.define('getDesktopAppStatus', async (req) => {
  // ... existing status check ...
  
  // Fetch latest version info
  const latestVersionInfo = await getLatestAppVersion({ platform: 'windows' });
  
  // Compare versions
  const updateAvailable = isVersionNewer(
    latestVersionInfo?.latestVersion, 
    user.desktop_app_version
  );
  
  return {
    status: 'active',
    appVersion: user.desktop_app_version,
    updateAvailable,
    latestVersion: latestVersionInfo?.latestVersion,
    downloadUrl: latestVersionInfo?.downloadUrl,
    releaseNotes: latestVersionInfo?.releaseNotes,
    isMandatoryUpdate: latestVersionInfo?.isMandatory
  };
});
```

### DesktopAppStatusBanner Component

The banner component displays three states:

1. **Not Installed** - Green banner, "Download App" button
2. **Inactive/Logged Out** - Yellow banner, "Open from System Tray" hint
3. **Update Available** - Blue banner with version badge

```jsx
// When update is available
<div className="update-banner">
  <span className="update-badge">
    v{latestVersion}
    {isMandatory && <span className="required">Required</span>}
  </span>
  <p>{releaseNotes}</p>
  <button onClick={handleDownload}>Download Update</button>
  {!isMandatory && <button onClick={dismiss}>Remind Later</button>}
</div>
```

### Dismiss Logic

- Users can dismiss non-mandatory updates
- Dismissed version is stored in localStorage
- If a newer version is released, banner shows again

```javascript
const dismissUpdate = () => {
  localStorage.setItem('desktopAppUpdateDismissedVersion', latestVersion);
  setUpdateDismissed(true);
};

// On load, check if dismissed version matches current latest
const dismissedVersion = localStorage.getItem('desktopAppUpdateDismissedVersion');
if (dismissedVersion !== latestVersion) {
  setUpdateDismissed(false);  // Show banner for new version
}
```

---

## How to Release a New Version

### Step 1: Update Version in Code

Edit `desktop_app.py`:
```python
APP_VERSION = "1.1.0"  # Update this
```

### Step 2: Build the Executable

```bash
# Using PyInstaller
pyinstaller --onefile --noconsole desktop_app.py
```

### Step 3: Upload to Supabase Storage

```bash
# Using Supabase CLI or Dashboard
# Upload to: storage/desktop app/TimeTracker-1.1.0.exe
```

Or via code:
```javascript
const { data, error } = await supabase.storage
  .from('desktop app')
  .upload('TimeTracker-1.1.0.exe', file, {
    contentType: 'application/octet-stream'
  });
```

### Step 4: Create Release Record

**Option A: Direct SQL**
```sql
INSERT INTO app_releases (
  version, 
  platform, 
  download_url, 
  release_notes, 
  is_mandatory,
  file_size_bytes
) VALUES (
  '1.1.0',
  'windows',
  'https://jvijitdewbypqbatfboi.supabase.co/storage/v1/object/public/desktop%20app/TimeTracker-1.1.0.exe',
  'What''s New in v1.1.0:\n- Bug fixes\n- Performance improvements\n- New notification system',
  false,
  48000000
);
```

**Option B: API Call**
```bash
curl -X POST https://forgesync.amzur.com/api/app-version/releases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "platform": "windows",
    "downloadUrl": "https://..../TimeTracker-1.1.0.exe",
    "releaseNotes": "Bug fixes and improvements",
    "isMandatory": false,
    "fileSizeBytes": 48000000
  }'
```

### Step 5: Verify

1. Open desktop app → Should show update notification
2. Open Jira app → Should show update banner
3. Click download → Should download new version

---

## Configuration Options

### Desktop App Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `version_check_interval` | 4 hours | How often to check for updates |
| `show_notification` | true | Show Windows toast for updates |

### Database Configuration

| Column | Purpose |
|--------|---------|
| `is_mandatory` | If true, users cannot dismiss the update notification |
| `is_active` | If false, version is deprecated and won't be offered |
| `min_supported_version` | Prevents very old versions from upgrading directly |

---

## Tray Icon Update Badge

The desktop app shows a visual indicator on the system tray icon when an update is available:

- **Blue dot** appears in the top-right corner of the tray icon
- Updates every 2 seconds with the icon state
- Persists until the user downloads the update or dismisses it

### Tray Menu Options

The system tray menu includes:
- **Check for Updates (v1.0.0)** - Shows current version, checks for updates
- **Download Update (v1.1.0)** - Appears when update is available, opens download URL
- **Open Dashboard** - Opens the local web UI
- **Exit** - Closes the application

---

## Checksum Verification

The system supports SHA256 checksum verification for download integrity.

### How to Add Checksum to a Release

**Option 1: Compute checksum before upload**

```bash
# On Windows (PowerShell)
Get-FileHash TimeTracker.exe -Algorithm SHA256 | Select-Object -ExpandProperty Hash

# On Linux/macOS
sha256sum TimeTracker.exe
```

**Option 2: Use the API to compute checksum from URL**

```bash
curl -X POST https://forgesync.amzur.com/api/app-version/compute-checksum \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://....supabase.co/storage/.../TimeTracker.exe"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://...",
    "checksum": "a1b2c3d4e5f6...",
    "algorithm": "SHA256"
  }
}
```

**Option 3: Include checksum when creating release**

```bash
curl -X POST https://forgesync.amzur.com/api/app-version/releases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "platform": "windows",
    "downloadUrl": "https://...",
    "checksum": "a1b2c3d4e5f6789...",
    "releaseNotes": "..."
  }'
```

### Verification in Desktop App

The desktop app includes utility functions for checksum verification:

```python
# Compute checksum of a local file
checksum = compute_file_checksum("TimeTracker.exe")

# Verify downloaded file against expected checksum
is_valid = verify_download_checksum("TimeTracker.exe", expected_checksum)
```

These functions are used when auto-update is implemented.

---

## Troubleshooting

### Update Not Showing

1. **Check database**: Verify `is_latest = true` and `is_active = true`
2. **Check API**: Call `/api/app-version/check?current=<version>`
3. **Clear cache**: Frontend caches version for 5 minutes

### Download URL Not Working

1. Verify the file exists in Supabase Storage
2. Ensure the bucket has public read access
3. Check URL encoding (spaces → %20)

### Notification Not Appearing (Desktop)

1. Check Windows notification settings
2. Verify `winotify` is installed
3. Check app logs for errors

### Tray Icon Badge Not Showing

1. Verify `self.update_available` is set to `True`
2. Check that the tray icon update thread is running
3. Restart the application

### Checksum Mismatch

1. Re-download the file (may have been corrupted)
2. Verify the checksum in the database is correct
3. Use `/api/app-version/compute-checksum` to verify the expected checksum

---

## Security Considerations

1. **Public endpoints** only expose version info, not sensitive data
2. **Rate limiting** prevents abuse (60 requests per 15 minutes)
3. **Checksum verification** ensures download integrity (SHA256)
4. **RLS policies** control who can create/modify releases

---

## Future Enhancements

1. **Auto-update**: Download and install updates automatically (checksum verification ready)
2. **Delta updates**: Only download changed files
3. **Rollback**: Allow users to revert to previous versions
4. **Platform support**: Add macOS and Linux versions
5. **Admin UI**: Web interface for managing releases

---

## File Locations

| Component | File Path |
|-----------|-----------|
| Migration | `supabase/migrations/20260203_add_app_releases.sql` |
| AI Server Controller | `ai-server/src/controllers/app-version-controller.js` |
| AI Server Routes | `ai-server/src/index.js` |
| Forge Proxy | `ai-server/src/controllers/forge-proxy-controller.js` |
| Remote Utils | `forge-app/src/utils/remote.js` |
| User Resolvers | `forge-app/src/resolvers/userResolvers.js` |
| Status Banner | `forge-app/static/main/src/components/common/DesktopAppStatusBanner.js` |
| Desktop App | `python-desktop-app/desktop_app.py` |

---

*Document created: February 3, 2026*
*Feature version: 1.0*
