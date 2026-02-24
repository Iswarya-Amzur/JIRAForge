# Project-Level Timesheet Settings Migration

## Overview

This migration changes **tracking_settings** from organization-level to project-level configuration, allowing different projects to have different productivity rules.

## Why This Change?

**Use Case**: Different projects have different productivity requirements:
- **Social Media Marketing Project**: Twitter, Facebook, LinkedIn = Productive
- **Internal Tools Project**: Twitter, Facebook, LinkedIn = Non-Productive
- **Healthcare Project**: medical-portal.com = Productive (but private for others)

## Database Changes

### Schema Updates
- Added `project_key TEXT` column to `tracking_settings` table
- Changed unique constraint from `(organization_id)` to `(organization_id, project_key)`
- Added indexes for fast lookups
- Added fallback function `get_tracking_settings_for_project(org_id, project_key)`

### Hierarchy
1. **Project-specific settings** (`project_key IS NOT NULL`) - Highest priority
2. **Organization-wide defaults** (`project_key IS NULL`) - Fallback
3. **Global defaults** (`organization_id IS NULL, project_key IS NULL`) - Final fallback

## Code Changes

### Backend (Forge App)

**settingsService.js**:
- `getTrackingSettings(accountId, cloudId, projectKey)` - Added projectKey parameter
- `saveTrackingSettings(accountId, cloudId, settings, projectKey)` - Added projectKey parameter
- Returns `settingsSource` field indicating level (project/organization/global)

**settingsResolvers.js**:
- Updated resolvers to accept and pass `projectKey` from payload

### Frontend

**TimesheetSettings.js**:
- Added project selector dropdown
- Shows current settings level with visual indicators
- Loads projects list on mount
- Reloads settings when project selection changes

### Python Desktop App

**desktop_app.py**: ✅ **COMPLETED**

**Initialization Changes** (Lines 3335-3367):
- Changed from single `tracking_settings` dict to per-project cache:
  - `tracking_settings_cache = {}` - Keyed by project_key
  - `tracking_settings_last_fetch = {}` - Timestamps per project
  - `current_project_key = None` - Tracks active project
  - `default_tracking_settings` - Fallback values
  - `tracking_settings_cache_ttl = 300` - 5-minute cache TTL

**New Methods**:
1. `get_tracking_settings_for_project(project_key)` - Retrieves cached or fresh settings
2. `@property tracking_settings` - Backward compatibility layer
3. `update_current_project()` - Detects project switches and reloads settings
4. `fetch_tracking_settings(project_key=None)` - Updated with 3-tier fallback

**Integration**:
- `tracking_loop()` calls `update_current_project()` on startup
- Periodic refresh every 5 minutes checks for project changes
- Settings automatically reload when user switches projects
- Backward compatible via `@property` decorator

## Migration Steps

1. **Run Migration**: `supabase/migrations/20260220_tracking_settings_project_level.sql`
2. **Verify**: Existing settings remain as organization-wide defaults
3. **Configure**: Admins can now create project-specific settings via UI
4. **Test**: Verify fallback works (project → org → global)

## API Usage

### Get Settings
```javascript
// Organization-wide settings
await invoke('getTrackingSettings', { projectKey: null });

// Project-specific settings
await invoke('getTrackingSettings', { projectKey: 'PROJ' });
```

### Save Settings
```javascript
// Save as organization-wide default
await invoke('saveTrackingSettings', { 
  settings: {...}, 
  projectKey: null 
});

// Save as project-specific
await invoke('saveTrackingSettings', { 
  settings: {...}, 
  projectKey: 'PROJ' 
});
```

## Backward Compatibility

✅ **Fully backward compatible**:
- Existing organization-level settings remain functional
- `project_key` defaults to `NULL` (organization-wide)
- Old API calls without `projectKey` still work (treated as org-wide)

## Testing Checklist

**Automated Test Script**: `python-desktop-app/test_project_level_settings.py`

Run the test suite:
```bash
cd python-desktop-app
python test_project_level_settings.py
```

The script validates:
- [x] Database schema has project_key column
- [x] Can create project-specific settings
- [x] Can create organization-wide settings
- [x] Project settings override organization defaults
- [x] Fallback works when project settings don't exist
- [x] Unique constraints prevent duplicate settings
- [x] Python app has per-project cache structure
- [x] Python app has get_tracking_settings_for_project() method
- [x] Python app has update_current_project() method
- [x] fetch_tracking_settings() accepts project_key parameter
- [x] tracking_loop() integrates project detection
- [x] Cache TTL configured (300 seconds)
- [x] Backward compatibility maintained via @property

**Manual Testing**:
- [ ] Frontend UI shows project selector
- [ ] Can switch between projects and see different settings
- [ ] Settings source indicator shows correct level (project/org/global)
- [ ] Can delete project settings to fall back to org defaults
- [ ] RLS policies allow proper access control

## Future Enhancements

1. **Desktop App**: Update to use project-specific settings based on active issue
2. **Bulk Config**: Allow copying settings from one project to another
3. **Templates**: Create project templates with pre-configured settings
4. **Override UI**: Show inherited values with option to override at project level
