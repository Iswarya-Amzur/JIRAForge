# Atlassian OAuth Setup Guide

Step-by-step guide to create an OAuth app and get your Client ID and Secret.

## Step 1: Go to Atlassian Developer Console

1. Open your browser and go to: **https://developer.atlassian.com/console/myapps/**
2. Sign in with your Atlassian account (the same one you use for Jira)

## Step 2: Create a New App

1. Click the **"Create"** button (usually in the top right)
2. Select **"OAuth 2.0 (3LO)"** integration type
3. Click **"Next"**

## Step 3: Configure App Details

Fill in the app details:

- **App name:** `BRD Time Tracker Desktop App` (or any name you prefer)
- **App logo:** (Optional - you can skip this)
- **App description:** `Desktop application for automatic time tracking via screenshot capture`

Click **"Create"**

## Step 4: Configure OAuth Settings

After creating the app, you'll see the app details page. Look for **"OAuth 2.0 (3LO)"** in the left sidebar and click it.

### Authorization Settings

1. **Authorization callback URL:**
   ```
   brd-time-tracker://oauth/callback
   ```
   ⚠️ **IMPORTANT:** This must match exactly! This is a custom protocol handler for the desktop app.

2. **Scopes:** Enable the following scopes:
   - ✅ `read:me` - Read your user information
   - ✅ `read:jira-work` - Read Jira issues and worklogs
   - ✅ `write:jira-work` - Create worklogs and issues
   - ✅ `offline_access` - Refresh tokens (for long-lived sessions)

3. Click **"Add"** or **"Save"** to save the settings

## Step 5: Get Your Credentials

1. In the app details page, look for **"App credentials"** or **"OAuth credentials"** section
2. You'll see:
   - **Client ID** - Copy this value
   - **Client Secret** - Click "Show" or "Reveal" to see it, then copy

## Step 6: Add Credentials to Desktop App

Open `desktop-app/.env` and add:

```env
ATLASSIAN_CLIENT_ID=your_client_id_here
ATLASSIAN_CLIENT_SECRET=your_client_secret_here
```

Replace `your_client_id_here` and `your_client_secret_here` with the actual values you copied.

## Step 7: Register Custom Protocol (Windows)

For Windows, you may need to register the custom protocol handler. The Electron app should handle this automatically, but if it doesn't work:

1. Run the desktop app once
2. It should register `brd-time-tracker://` protocol automatically
3. If not, you can manually register it in Windows Registry (advanced)

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the callback URL in Atlassian console is exactly: `brd-time-tracker://oauth/callback`
- No trailing slashes, no http/https prefix

### "Invalid client" error
- Double-check that Client ID and Secret are correct
- Make sure there are no extra spaces when copying

### OAuth flow doesn't start
- Verify the desktop app is running
- Check that the protocol handler is registered
- Try restarting the desktop app

## Security Notes

- ⚠️ **Never commit** your Client Secret to git
- ⚠️ The `.env` file is already in `.gitignore` - it won't be committed
- ⚠️ Keep your Client Secret secure - treat it like a password

## Quick Reference

**Atlassian Developer Console:** https://developer.atlassian.com/console/myapps/

**Required Scopes:**
- `read:me`
- `read:jira-work`
- `write:jira-work`
- `offline_access`

**Callback URL:** `brd-time-tracker://oauth/callback`

---

Once you have the Client ID and Secret, add them to `desktop-app/.env` and you're ready to go! 🚀

