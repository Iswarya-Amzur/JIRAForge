# Fix OAuth Callback URL Error

## Error Message
```
redirect_uri is not registered for client: http://localhost:7777/auth/callback
```

## Solution

You need to update the callback URL in your Atlassian OAuth app settings.

### Step 1: Go to Atlassian Developer Console

1. Open your browser and go to: **https://developer.atlassian.com/console/myapps/**
2. Sign in with your Atlassian account
3. Find your OAuth app (the one with Client ID: `Q8HT4Jn205AuTiAarj088oWNDrOqwvM5`)
4. Click on it to open the app details

### Step 2: Update Authorization Callback URL

1. In the left sidebar, click **"OAuth 2.0 (3LO)"**
2. Scroll down to **"Authorization callback URL"** section
3. **Remove** the old callback URL: `brd-time-tracker://oauth/callback` (if it exists)
4. **Add** the new callback URL: `http://localhost:7777/auth/callback`
5. Click **"Add"** or **"Save"** to save the changes

### Step 3: Verify Settings

Make sure your OAuth app has:
- ✅ **Authorization callback URL**: `http://localhost:7777/auth/callback`
- ✅ **Scopes enabled**:
  - `read:me`
  - `read:jira-work`
  - `write:jira-work`
  - `offline_access`

### Step 4: Restart the Python App

1. Stop the current Python app (press `CTRL+C` in the terminal)
2. Start it again:
   ```bash
   python desktop_app.py
   ```
3. Try the OAuth flow again

## Important Notes

- The Python app uses **HTTP localhost** callback (`http://localhost:7777/auth/callback`)
- The Electron app uses **custom protocol** callback (`brd-time-tracker://oauth/callback`)
- You can have **both** callback URLs registered if you want to use both apps
- Make sure port 7777 is not blocked by firewall

## Still Having Issues?

If the error persists:
1. Double-check the callback URL is exactly: `http://localhost:7777/auth/callback` (no trailing slash)
2. Wait a few seconds after saving - Atlassian may need a moment to propagate changes
3. Clear your browser cache and try again
4. Check that the Flask server is running on port 7777 before clicking "Sign in with Atlassian"

