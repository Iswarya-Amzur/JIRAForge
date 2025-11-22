# OAuth Token Refresh Implementation

## Problem
The desktop app was experiencing OAuth token expiration after ~1 hour, resulting in continuous 401 Unauthorized errors when trying to fetch Jira issues. Users had to manually re-authenticate every hour.

## Root Cause
- Atlassian OAuth access tokens expire after approximately 1 hour
- The app was NOT refreshing the access token using the refresh token
- When token expired, all Jira API calls failed with 401 errors
- Screenshots continued uploading (different auth mechanism) but had NO Jira context

## Solution Implemented

### 1. Added `refresh_access_token()` Method
**Location**: `AtlassianAuthManager` class (lines 190-210)

**What it does**:
- Uses the refresh token to obtain a new access token from Atlassian
- Updates both access_token and refresh_token in memory and local file
- Updates token expiration timestamp
- Returns success/failure status

**Flow**:
```python
POST https://auth.atlassian.com/oauth/token
Body: {
    "grant_type": "refresh_token",
    "client_id": "...",
    "client_secret": "...",
    "refresh_token": "..."
}
```

### 2. Updated `get_user_info()` Method
**Location**: Lines 155-188

**Changes**:
- Detects 401 response (token expired)
- Automatically calls `refresh_access_token()`
- Retries the API call with new token
- Falls back gracefully if refresh fails

### 3. Updated `get_jira_cloud_id()` Method
**Location**: Lines 500-543

**Changes**:
- Detects 401 response (token expired)
- Automatically calls `refresh_access_token()`
- Retries the API call with new token
- Falls back gracefully if refresh fails

### 4. Updated `fetch_jira_issues()` Method ⭐ **MOST CRITICAL**
**Location**: Lines 545-617

**Changes**:
- Detects 401 response (token expired)
- Automatically calls `refresh_access_token()`
- Retries the Jira search API call with new token
- Falls back gracefully if refresh fails

**This was the most important fix** - it's called every 5 minutes during screenshot capture to fetch the user's assigned issues.

## How It Works

### Before (Old Behavior):
```
User logs in → Access token valid for 1 hour
After 1 hour:
  - Jira API call → 401 Unauthorized
  - Error logged
  - NO retry
  - User must manually re-authenticate
```

### After (New Behavior):
```
User logs in → Access token valid for 1 hour
After 1 hour:
  - Jira API call → 401 Unauthorized
  - Detect 401 → Automatic token refresh
  - Retry Jira API call with new token → Success!
  - Continue working without interruption
```

## Testing Instructions

### Test 1: Wait for Token Expiration
1. Start the desktop app and log in
2. Let it run for **1+ hour** without interaction
3. Watch the console logs
4. **Expected behavior**:
   - After ~1 hour, you'll see: `[WARN] Access token expired (401), attempting refresh...`
   - Followed by: `[OK] Access token refreshed successfully`
   - Then: `[INFO] Retrying Jira API with refreshed token...`
   - Finally: `[OK] Jira API returned 2 issues`

### Test 2: Verify No Re-Authentication Needed
1. Start the app and log in
2. Let it run for **2+ hours**
3. **Expected behavior**:
   - No manual re-authentication required
   - Token automatically refreshes every ~1 hour
   - Screenshots continue with proper Jira context

### Test 3: Check Token Persistence
1. Start the app and log in
2. Let token refresh happen (wait ~1 hour)
3. Restart the app (stop and start again)
4. **Expected behavior**:
   - App uses the refreshed token from storage
   - No need to log in again

## Log Messages to Watch For

### Success Indicators:
```
[WARN] Access token expired (401), attempting refresh...
[INFO] Refreshing access token...
[OK] Access token refreshed successfully
[INFO] Retrying Jira API with refreshed token...
[OK] Jira API returned X issues
```

### Failure Indicators (requires re-auth):
```
[ERROR] Token refresh failed: <error message>
[ERROR] Token refresh failed, please re-authenticate
```

## Benefits

1. **Zero User Intervention**: App can run for days/weeks without re-authentication
2. **Seamless Experience**: Users don't notice token refreshes happening
3. **Better Data Quality**: Screenshots always have proper Jira context
4. **Improved AI Analysis**: AI can validate task keys against current assigned issues
5. **Production Ready**: Handles token expiration gracefully

## Technical Details

### Token Lifetimes:
- **Access Token**: ~3600 seconds (1 hour)
- **Refresh Token**: ~90 days (sliding expiration)
- Each refresh gives a NEW refresh token, extending the sliding window

### Storage:
- Tokens stored in: `%TEMP%/brd_tracker_auth.json` (Windows)
- Contains: access_token, refresh_token, expires_at, oauth_state
- Automatically updated on refresh

### Security:
- Refresh tokens are long-lived but rotate on each use
- Client secret required for refresh (stored in .env)
- All tokens stored locally, never sent to Supabase

## Files Modified
1. `python-desktop-app/desktop_app.py` - All changes in this single file

## Compatibility
- ✅ Backward compatible with existing auth flow
- ✅ Works with existing token storage
- ✅ No database schema changes needed
- ✅ No Supabase changes needed
