# Forge App Setup Guide

This guide will help you set up and deploy the Forge application to your Jira instance.

## Prerequisites

1. **Node.js 20.x or 22.x** (Forge recommended versions)
   - Check: `node --version`
   - Install: https://nodejs.org/

2. **Forge CLI** installed globally
   ```bash
   npm install -g @forge/cli
   ```

3. **Atlassian Developer Account**
   - Sign up at: https://developer.atlassian.com/
   - Create a free developer site for testing

4. **Supabase Project** (already set up)
   - URL: `https://jvijitdewbypqbatfboi.supabase.co`
   - You'll need: Supabase URL, Anon Key, and Service Role Key

## Step 1: Install Dependencies

```bash
cd forge-app

# Install root dependencies
npm install

# Install main UI dependencies
cd static/main
npm install
cd ../..

# Install settings UI dependencies
cd static/settings
npm install
cd ../..
```

## Step 2: Build UI Components

```bash
# Build both UI components
npm run build

# Or build individually:
npm run build:main      # Main dashboard
npm run build:settings  # Settings page
```

## Step 3: Register with Forge

This creates a new Forge app and updates the `app.id` in `manifest.yml`:

```bash
forge register
```

Follow the prompts:
- Select your Atlassian account
- Choose a name for your app (e.g., "BRD Time Tracker")
- The app ID will be automatically added to `manifest.yml`

## Step 4: Configure Supabase Settings

Before deploying, you'll need to configure Supabase in the Settings page after installation. However, you can also set default values:

**Your Supabase Configuration:**
- **URL**: `https://jvijitdewbypqbatfboi.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTU1OTAsImV4cCI6MjA3ODMzMTU5MH0.OvoIgXKqYTK_9S_bIJtUa6N2TVgtgcp94iOVjE3rdRM`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc1NTU5MCwiZXhwIjoyMDc4MzMxNTkwfQ.2Pbdo2DHHfCIpUVPP390P2Y3rF7_hdsYM-38g26XTUY`

⚠️ **Important**: The Service Role Key should be kept secure and only entered in the Settings page after installation.

## Step 5: Deploy to Development

```bash
forge deploy
```

This will:
- Upload your app to Forge
- Build and deploy the resolver functions
- Deploy the UI components

**Note**: The first deployment may take a few minutes.

## Step 6: Install on Jira Site

```bash
forge install
```

Follow the prompts:
- Select your Jira development site
- The app will be installed and available

## Step 7: Configure Settings

1. Go to your Jira site
2. Navigate to **Settings** → **Apps** → **Manage apps**
3. Find "BRD Time Tracker" (or your app name)
4. Click **Settings** or open the admin page
5. Enter your Supabase configuration:
   - Supabase URL
   - Supabase Anon Key
   - Supabase Service Role Key
6. Click **Save Settings**

## Step 8: Test the App

1. **Project Page**: Go to any Jira project → You should see "BRD & Time Tracker" tab
2. **Issue Panel**: Open any Jira issue → You should see "Time Analytics" panel
3. **Settings**: Go to Jira Settings → Apps → Find your app → Click Settings

## Development Workflow

### Local Development with Tunnel

For faster development, use Forge tunnel:

```bash
forge tunnel
```

This allows you to test changes without deploying each time.

### View Logs

```bash
forge logs
```

### Rebuild and Redeploy

After making changes:

```bash
# Rebuild UI
npm run build

# Redeploy
forge deploy
```

## Troubleshooting

### Build Errors

**Error: "Cannot find module"**
- Make sure you've run `npm install` in all directories
- Check that `static/main/node_modules` and `static/settings/node_modules` exist

**Error: "React is not defined"**
- Ensure React dependencies are installed in UI directories
- Check `package.json` files have correct dependencies

### Deployment Errors

**Error: "Manifest validation failed"**
- Check `manifest.yml` syntax
- Ensure `app.id` is set (run `forge register` first)
- Verify all module keys are unique

**Error: "Build failed"**
- Run `npm run build` locally to see detailed errors
- Check that all UI components build successfully

### Runtime Errors

**"Supabase not configured"**
- Go to Settings page and configure Supabase credentials
- Ensure Service Role Key is correct

**"Unable to get user information"**
- Check that Supabase is accessible
- Verify the user exists in the `users` table with `atlassian_account_id`

**Screenshots not displaying**
- Check Forge logs: `forge logs`
- Verify signed URL generation is working
- Ensure screenshots exist in Supabase storage

## Next Steps

1. ✅ Install and configure the app
2. ✅ Test with screenshots from Python desktop app
3. ✅ Verify time analytics display correctly
4. ✅ Test BRD upload functionality
5. ✅ Create Jira issues from BRD documents

## Integration with Python Desktop App

The Forge app is designed to work with the Python desktop app:

1. **Screenshots**: The desktop app uploads screenshots to Supabase
2. **Forge Display**: The Forge app displays these screenshots in the gallery
3. **Time Analytics**: Screenshots are analyzed and time is tracked
4. **User Matching**: Both apps use `atlassian_account_id` to match users

Make sure:
- Both apps use the same Supabase instance
- Users log in with the same Atlassian account
- Screenshots are being uploaded from the desktop app

## Security Notes

⚠️ **Important Security Considerations:**

1. **Service Role Key**: 
   - Never commit this to git
   - Only enter it in the Settings page (stored securely in Forge storage)
   - This key bypasses RLS, so keep it secure

2. **Anon Key**: 
   - Can be stored in settings (less sensitive)
   - Used for client-side operations with RLS

3. **Forge Storage**: 
   - Settings are stored encrypted in Forge storage
   - Each user's settings are isolated by `accountId`

## Support

For issues:
1. Check Forge logs: `forge logs`
2. Check browser console for UI errors
3. Verify Supabase connection
4. Review resolver function logs

For more information:
- [Forge Documentation](https://developer.atlassian.com/platform/forge/)
- [Forge Community](https://community.developer.atlassian.com/)

