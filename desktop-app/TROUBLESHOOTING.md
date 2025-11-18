# Troubleshooting Guide - Desktop App

## Common Issues and Solutions

---

## Issue 1: "failed to retrieve client" OAuth Error

**Error Message:**
```
error=invalid_request&error_description=failed%20to%20retrieve%20client
```

**Possible Causes:**
1. Client ID is incorrect or has typos
2. App not properly configured in Atlassian Developer Console
3. Redirect URI mismatch
4. Client ID not being read from .env file

**Solutions:**

### Check 1: Verify Client ID in .env
```bash
# In desktop-app/.env, verify:
ATLASSIAN_CLIENT_ID=Q8HT4Jn205AuTiAarj088oWNDrOqwvM5
```

**Common typos to check:**
- `088oWNDrOqwvM5` (correct)
- `0880WNDrOqwwM5` (wrong - has extra '0' and 'w')

### Check 2: Verify in Atlassian Console
1. Go to https://developer.atlassian.com/console/myapps/
2. Open your app: "BRD Time Tracker Desktop App"
3. Go to **"Authorization"** tab
4. Verify **Callback URL** is exactly: `brd-time-tracker://oauth/callback`
5. Go to **"Settings"** tab
6. Copy the **Client ID** and compare with your `.env` file

### Check 3: Restart the App
After updating `.env`:
```bash
# Stop the app (Ctrl+C)
# Then restart
npm start
```

### Check 4: Verify Environment Variables are Loaded
Add this to `src/main.js` temporarily to debug:
```javascript
console.log('Client ID:', process.env.ATLASSIAN_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('Client ID length:', process.env.ATLASSIAN_CLIENT_ID?.length);
```

---

## Issue 2: Missing Tray Icon

**Error:**
```
Failed to load image from path 'C:\Users\...\assets\tray-icon.png'
```

**Solution:**
The code has been updated to handle missing icons gracefully. The app will work without the tray icon.

**To add icons later:**
1. Create `desktop-app/assets/` directory if it doesn't exist
2. Add `tray-icon.png` (16x16 or 32x32 pixels)
3. Add `icon.png` (256x256 pixels for app icon)

---

## Issue 3: Node.js Version Warning

**Warning:**
```
Node.js 18 and below are deprecated
```

**Solution:**
This is just a warning, not an error. The app will still work. To fix:
1. Upgrade to Node.js 20 or 22
2. Or ignore the warning for now (it's just a deprecation notice)

---

## Issue 4: OAuth Redirect Not Working

**Symptoms:**
- Browser opens for OAuth
- User authorizes
- Nothing happens after authorization

**Solutions:**

### Windows-specific Fix:
The code has been updated to handle Windows protocol handlers. Make sure:
1. The app is set as default protocol handler (code does this automatically)
2. If it doesn't work, manually register:
   ```powershell
   # Run as Administrator
   reg add "HKEY_CURRENT_USER\Software\Classes\brd-time-tracker" /ve /d "URL:BRD Time Tracker" /f
   reg add "HKEY_CURRENT_USER\Software\Classes\brd-time-tracker" /v "URL Protocol" /d "" /f
   reg add "HKEY_CURRENT_USER\Software\Classes\brd-time-tracker\shell\open\command" /ve /d "\"C:\path\to\your\app.exe\" \"%1\"" /f
   ```

### Alternative: Use HTTP Redirect (for testing)
Temporarily change redirect URI to `http://localhost:3000/callback` for testing, then switch back.

---

## Issue 5: Environment Variables Not Loading

**Symptoms:**
- Client ID shows as empty
- OAuth fails immediately

**Solutions:**

1. **Verify .env file location:**
   - Must be in `desktop-app/.env` (same directory as `package.json`)

2. **Check .env file format:**
   ```env
   # No spaces around =
   ATLASSIAN_CLIENT_ID=Q8HT4Jn205AuTiAarj088oWNDrOqwvM5
   # NOT: ATLASSIAN_CLIENT_ID = Q8HT4Jn205AuTiAarj088oWNDrOqwvM5
   ```

3. **Install dotenv if needed:**
   ```bash
   npm install dotenv
   ```
   Then add to `src/main.js`:
   ```javascript
   require('dotenv').config();
   ```

---

## Debugging Steps

### Step 1: Check OAuth URL
When you click "Sign In", check the console output. You should see:
```
OAuth URL generated: https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=CLIENT_ID_HIDDEN&...
```

### Step 2: Verify Client ID Format
The Client ID should be exactly 32 characters:
```
Q8HT4Jn205AuTiAarj088oWNDrOqwvM5
```

### Step 3: Test OAuth URL Manually
Copy the generated URL (from console logs) and paste in browser to see the exact error.

### Step 4: Check Atlassian Console
1. Go to your app settings
2. Verify all scopes are added
3. Verify callback URL matches exactly
4. Check if app is in "Development" or "Production" mode

---

## Quick Fix Checklist

- [ ] Client ID in `.env` matches Atlassian Console exactly
- [ ] No extra spaces in `.env` file
- [ ] Callback URL in Atlassian Console: `brd-time-tracker://oauth/callback`
- [ ] App restarted after changing `.env`
- [ ] Node.js version 18+ (20+ recommended)
- [ ] All required scopes added in Permissions tab

---

## Still Having Issues?

1. **Check the console logs** - Look for error messages
2. **Verify Client ID** - Compare character by character with Atlassian Console
3. **Test with a simple OAuth test tool** - Use Postman or curl to test the OAuth flow
4. **Check Atlassian status** - Sometimes Atlassian services have issues

---

## Contact

If issues persist, check:
- Atlassian Developer Community: https://community.developer.atlassian.com/
- OAuth 2.0 (3LO) Documentation: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/

