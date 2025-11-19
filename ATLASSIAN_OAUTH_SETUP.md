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
   
   **For Electron Desktop App:**
   ```
   brd-time-tracker://oauth/callback
   ```
   
   **For Python Desktop App:**
   ```
   http://localhost:7777/auth/callback
   ```
   
   ⚠️ **IMPORTANT:** 
   - You can add **both** callback URLs if you want to use both apps
   - For Electron app: Use `brd-time-tracker://oauth/callback` (custom protocol)
   - For Python app: Use `http://localhost:7777/auth/callback` (HTTP localhost)
   - The URLs must match exactly (no trailing slashes, exact case)

2. **Scopes:** Enable the following scopes:
   - ✅ `read:me` - Read your user information
   - ✅ `read:jira-work` - Read Jira issues and worklogs
   - ✅ `write:jira-work` - Create worklogs and issues
   - ✅ `offline_access` - Refresh tokens (for long-lived sessions)

3. Click **"Add"** or **"Save"** to save the settings

## Step 5: Allow Other Users to Access the App

⚠️ **IMPORTANT:** By default, OAuth apps are set to **"Not sharing"**, which means only the app owner can authorize it. To allow other users:

### Enable Sharing (Recommended for Teams)

1. In your app's details page, go to **"Distribution"** in the left sidebar
2. You'll see the current status: **"BRD Time Tracker Desktop App is private"**
3. In the **"Edit distribution controls"** section:
   
   **a. Change Distribution Status:**
   - Select the **"Sharing"** radio button (currently "Not sharing" is selected)
   
   **b. Fill in Vendor & Security Details (Required):**
   - **Vendor name***: Enter your name or company name (e.g., "Your Company" or "Your Name")
     - You can check "Use your own name" if you want to use your Atlassian account name
   - **Privacy policy***: Enter a URL to your privacy policy
     - For internal use, you can use a placeholder like: `https://example.com/privacy`
     - For production, create an actual privacy policy page
   - **Terms of service** (Optional): Enter a URL if you have terms of service
   - **Customer support contact***: Enter an email or URL where users can reach you
     - Example: `support@yourcompany.com` or `https://example.com/contact`
   
   **c. Personal Data Declaration:**
   - **"Does your app store personal data? *"**: Select from the dropdown
     - **"No"**: If you only store screenshots and activity data (recommended for this app)
     - **"Yes"**: If you store personal information like names, emails, etc. in your own systems
   - For this time tracker app, **"No"** is typically correct since you're just storing screenshots

4. Click **"Save changes"** at the bottom
5. Once saved, the app status will change to **"Sharing"**
6. **Any Atlassian user** can now authorize your app!

**Note:** 
- This enables sharing without requiring app review (unlike publishing)
- Perfect for internal teams and controlled distribution
- Users can authorize immediately after you enable sharing

## Step 6: Get Your Credentials

1. In the app details page, look for **"App credentials"** or **"OAuth credentials"** section
2. You'll see:
   - **Client ID** - Copy this value
   - **Client Secret** - Click "Show" or "Reveal" to see it, then copy

## Step 7: Add Credentials to Desktop App

Open `desktop-app/.env` and add:

```env
ATLASSIAN_CLIENT_ID=your_client_id_here
ATLASSIAN_CLIENT_SECRET=your_client_secret_here
```

Replace `your_client_id_here` and `your_client_secret_here` with the actual values you copied.

## Step 8: Register Custom Protocol (Windows)

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

### "You don't have access to this app" error
- **Cause:** The OAuth app is set to "Not sharing" and only the owner can authorize it
- **Solution:** 
  - Go to **Distribution** page in your Atlassian Developer Console
  - Change distribution status from **"Not sharing"** to **"Sharing"**
  - Fill in the required vendor and security details (Vendor name, Privacy policy, Support contact)
  - Set Personal Data Declaration (typically "No" for this app)
  - Click **"Save changes"**
  - See Step 5 above for detailed instructions

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

