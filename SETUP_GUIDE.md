use the .envs if they already exists 


# Complete Setup Guide - BRD Time Tracker Application

This guide will help you set up the entire BRD Time Tracker application on a new system. The application consists of 4 main components:

1. **Supabase** - Database and storage backend
2. **AI Server** - Node.js server for processing screenshots and BRD documents
3. **Forge App** - Jira Forge application for displaying analytics
4. **Python Desktop App** - Desktop application for capturing screenshots

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 20.x or 22.x** (for Forge App and AI Server)
  - Download: https://nodejs.org/
  - Verify: `node --version`
  
- **Python 3.8+** (for Desktop App)
  - Download: https://www.python.org/downloads/
  - Verify: `python --version`
  
- **Git** (to clone the repository)
  - Download: https://git-scm.com/downloads
  
- **Atlassian Developer Account**
  - Sign up: https://developer.atlassian.com/
  - Create a free developer site for testing

- **Supabase Account** (free tier works)
  - Sign up: https://supabase.com/

- **OpenAI API Key** (for AI features)
  - Get from: https://platform.openai.com/api-keys

---

## Step 1: Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd jira1
```

---

## Step 2: Set Up Supabase

### 2.1 Create Supabase Project

1. Go to https://supabase.com/ and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: BRD Time Tracker (or your preferred name)
   - **Database Password**: Save this securely
   - **Region**: Choose closest to you
4. Wait for project to be created (2-3 minutes)

### 2.2 Get Supabase Credentials

After project creation, go to **Settings** → **API** and copy:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ Keep this secret!

### 2.3 Run Database Migrations

1. Go to **SQL Editor** in Supabase dashboard
2. Open each migration file from `supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `002_unassigned_activity.sql`
   - `003_storage_buckets.sql`
   - `003_work_type_column.sql`
   - `004_add_display_names_to_views.sql`
   - `004_database_triggers.sql`
   - `005_user_jira_issues_cache.sql`
   - `006_add_user_assigned_issues_to_screenshots.sql`
3. Run each file by clicking "Run"

### 2.4 Create Storage Buckets

1. Go to **Storage** in Supabase dashboard
2. Create two buckets:
   - **Bucket Name**: `screenshots`
     - Public: ✅ Yes
     - File size limit: 10 MB
     - Allowed MIME types: `image/png, image/jpeg, image/webp`
   - **Bucket Name**: `documents`
     - Public: ✅ Yes
     - File size limit: 50 MB
     - Allowed MIME types: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 2.5 Deploy Edge Functions (Optional)

If you want to use Supabase Edge Functions for webhooks:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
cd supabase/functions
supabase functions deploy screenshot-webhook
supabase functions deploy document-webhook
```

---

## Step 3: Set Up AI Server

### 3.1 Install Dependencies

```bash
cd ai-server
npm install
```

### 3.2 Configure Environment

1. Copy the `.env` file (it already exists with example values)
2. Edit `ai-server/.env` and update these values:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# API Security - Generate a new secure key
AI_SERVER_API_KEY=your_secure_random_key_here

# Supabase Configuration (from Step 2.2)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
USE_AI_FOR_SCREENSHOTS=true

# Screenshot Analysis Configuration
SCREENSHOT_INTERVAL=300
AUTO_CREATE_WORKLOGS=false

# Polling Service Configuration
POLLING_INTERVAL_MS=30000
POLLING_BATCH_SIZE=10

# BRD Processing Configuration
AUTO_CREATE_JIRA_ISSUES=false

# Jira API Configuration (optional, for direct API access)
JIRA_API_TOKEN=your_jira_api_token
JIRA_BASE_URL=https://your-domain.atlassian.net
```

**Generate a secure API key:**
```bash
# On Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# On Linux/Mac:
openssl rand -hex 32
```

### 3.3 Create Logs Directory

```bash
mkdir logs
```

### 3.4 Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server should start on `http://localhost:3001`

**Verify it's working:**
```bash
curl http://localhost:3001/health
```

You should see:
```json
{"status":"healthy","timestamp":"...","uptime":...}
```

---

## Step 4: Set Up Forge App

### 4.1 Install Forge CLI

```bash
npm install -g @forge/cli
```

### 4.2 Install Dependencies

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

### 4.3 Build UI Components

```bash
# From forge-app directory
npm run build
```

### 4.4 Register with Forge

```bash
forge login
forge register
```

Follow the prompts:
- Select your Atlassian account
- Choose a name for your app (e.g., "BRD Time Tracker")
- The app ID will be automatically added to `manifest.yml`

### 4.5 Deploy to Development

```bash
forge deploy
```

This may take a few minutes on first deployment.

### 4.6 Install on Jira Site

```bash
forge install
```

Follow the prompts to select your Jira development site.

### 4.7 Configure Settings in Jira

1. Go to your Jira site
2. Navigate to **Settings** → **Apps** → **Manage apps**
3. Find your app and click **Settings**
4. Enter your Supabase configuration:
   - **Supabase URL**: From Step 2.2
   - **Supabase Anon Key**: From Step 2.2
   - **Supabase Service Role Key**: From Step 2.2 (keep secret!)
   - **AI Server URL**: `http://localhost:3001` (or your deployed URL)
5. Click **Save Settings**

---

## Step 5: Set Up Python Desktop App

### 5.1 Install Python Dependencies

```bash
cd python-desktop-app
pip install -r requirements.txt
```

**Note for Windows:** If you encounter issues with `pywin32`, try:
```bash
pip install pywin32
python Scripts/pywin32_postinstall.py -install
```

### 5.2 Configure Environment

Create a `.env` file in `python-desktop-app/` directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Atlassian OAuth Configuration
# Option 1: Use existing OAuth client (if shared with team)
# Option 2: Create your own OAuth app (recommended - see Step 5.3)
ATLASSIAN_CLIENT_ID=your_client_id_here
ATLASSIAN_CLIENT_SECRET=your_client_secret_here

# Screenshot Configuration
SCREENSHOT_INTERVAL=300  # seconds (5 minutes default)
```

### 5.3 Configure Atlassian OAuth

**You have two options:**

#### Option A: Use Existing OAuth Client (Quick Setup)

If you have access to an existing OAuth client that's already configured:

1. Get the **Client ID** and **Client Secret** from the existing OAuth app
2. Verify the redirect URI is set to: `http://localhost:7777/auth/callback`
3. Add these values to your `.env` file:
   ```env
   ATLASSIAN_CLIENT_ID=existing_client_id
   ATLASSIAN_CLIENT_SECRET=existing_client_secret
   ```

⚠️ **Note**: Sharing OAuth credentials is acceptable for internal team use, but each person should ideally have their own OAuth app for better security and tracking.

#### Option B: Create Your Own OAuth App (Recommended)

For better security and individual tracking, create your own OAuth app:

1. Go to https://developer.atlassian.com/console/myapps/
2. Click **Create** → **New app**
3. Fill in:
   - **App name**: BRD Time Tracker Desktop (Your Name)
   - **App type**: OAuth 2.0 (3LO)
4. Click **Create**
5. Go to **Authorization** tab
6. Add **Authorization callback URL**: `http://localhost:7777/auth/callback`
   - ⚠️ **Important**: Use `http://localhost:7777/auth/callback` (not the custom protocol)
7. Enable these scopes:
   - `read:me`
   - `read:jira-work`
   - `write:jira-work`
   - `offline_access`
8. Click **Save changes**
9. Copy **Client ID** and **Client Secret**
10. Update your `.env` file with these values:
    ```env
    ATLASSIAN_CLIENT_ID=your_client_id_here
    ATLASSIAN_CLIENT_SECRET=your_client_secret_here
    ```

**Why create your own?**
- ✅ Better security (credentials are not shared)
- ✅ Individual tracking and auditing
- ✅ No risk of affecting other users
- ✅ Free to create (no cost)

### 5.4 Run the Desktop App

```bash
python desktop_app.py
```

The app should:
- Open a window for authentication
- Show a system tray icon
- Start capturing screenshots after you sign in

---

## Step 6: Verify Everything Works

### 6.1 Test AI Server

```bash
# Check health
curl http://localhost:3001/health

# Should return: {"status":"healthy",...}
```

### 6.2 Test Forge App

1. Go to any Jira project
2. You should see "BRD & Time Tracker" tab
3. Open any issue → You should see "Time Analytics" panel
4. Go to Settings → Apps → Your app → Settings should load

### 6.3 Test Desktop App

1. Launch the desktop app
2. Click "Sign In with Atlassian"
3. Complete OAuth flow
4. Click "Start Tracking"
5. Wait 5 minutes (or your configured interval)
6. Check Supabase Storage → `screenshots` bucket → You should see uploaded screenshots

### 6.4 Test End-to-End Flow

1. Desktop app captures screenshot → Uploads to Supabase
2. AI Server processes screenshot (check `ai-server/logs/combined.log`)
3. Forge App displays analytics in Jira

---

## Step 7: Troubleshooting

### AI Server Issues

**Server won't start:**
- Check Node.js version: `node --version` (should be 18+)
- Check if port 3001 is already in use
- Check `.env` file has all required variables
- Check logs: `ai-server/logs/error.log`

**OpenAI API errors:**
- Verify API key is correct
- Check you have credits/quota
- Try a different model (e.g., `gpt-3.5-turbo`)

**Supabase connection errors:**
- Verify SUPABASE_URL and keys are correct
- Check network connectivity
- Verify service role key has proper permissions

### Forge App Issues

**Build fails:**
- Make sure you ran `npm install` in all directories
- Check Node.js version (20.x or 22.x recommended)
- Try deleting `node_modules` and reinstalling

**App not showing in Jira:**
- Check `forge install` completed successfully
- Verify app is installed: `forge list`
- Check Forge logs: `forge logs`

**Settings not saving:**
- Verify Supabase credentials are correct
- Check browser console for errors
- Check Forge logs for resolver errors

### Desktop App Issues

**App won't start:**
- Check Python version: `python --version` (should be 3.8+)
- Install missing dependencies: `pip install -r requirements.txt`
- On Windows, ensure `pywin32` is properly installed

**OAuth fails:**
- Verify redirect URL is exactly: `http://localhost:7777/auth/callback` (in OAuth app settings)
- Check Client ID and Secret in `.env`
- Ensure OAuth app has correct scopes enabled
- Verify port 7777 is not blocked by firewall

**Screenshots not uploading:**
- Verify Supabase URL and Anon Key in `.env`
- Check network connectivity
- Verify storage bucket exists and is public
- Check Supabase Storage policies allow uploads

**Permission errors (macOS):**
- System Preferences → Security & Privacy → Privacy
- Screen Recording → Add the app

### Supabase Issues

**Migrations fail:**
- Run migrations in order (001, 002, 003, etc.)
- Check for syntax errors in SQL
- Verify `uuid-ossp` extension is enabled

**Storage upload fails:**
- Check file size limits (10MB for screenshots, 50MB for documents)
- Verify MIME types are allowed
- Check storage policies are configured

---

## Step 8: Production Deployment (Optional)

### AI Server Deployment

**Option 1: Traditional Server (VPS, AWS EC2)**
```bash
# Install PM2 for process management
npm install -g pm2

# Start server
cd ai-server
pm2 start src/index.js --name ai-server
pm2 save
pm2 startup
```

**Option 2: Docker**
```bash
cd ai-server
docker build -t brd-ai-server .
docker run -p 3001:3001 --env-file .env brd-ai-server
```

**Option 3: Cloud Platforms**
- Deploy to Heroku, Railway, Render, etc.
- Set environment variables in platform dashboard
- Update webhook URLs in Supabase

### Forge App Deployment

Forge apps are automatically deployed to Atlassian's infrastructure when you run `forge deploy`. No additional deployment needed!

### Desktop App Distribution

**Windows:**
```bash
cd python-desktop-app
pyinstaller --onefile --windowed desktop_app.py
```

**macOS/Linux:**
```bash
# Use PyInstaller or similar tool
pyinstaller --onefile desktop_app.py
```

---

## Configuration Reference

### Environment Variables Summary

**AI Server** (`ai-server/.env`):
- `PORT` - Server port (default: 3001)
- `AI_SERVER_API_KEY` - Secure API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `JIRA_API_TOKEN` - Jira API token (optional)
- `JIRA_BASE_URL` - Jira instance URL (optional)

**Desktop App** (`python-desktop-app/.env`):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `ATLASSIAN_CLIENT_ID` - OAuth client ID
- `ATLASSIAN_CLIENT_SECRET` - OAuth client secret
- `SCREENSHOT_INTERVAL` - Capture interval in seconds

**Forge App** (configured in Jira Settings):
- Supabase URL
- Supabase Anon Key
- Supabase Service Role Key
- AI Server URL

---

## Next Steps

After setup is complete:

1. ✅ Test screenshot capture from desktop app
2. ✅ Verify screenshots appear in Forge app gallery
3. ✅ Check AI analysis is working (check AI server logs)
4. ✅ Test BRD upload functionality
5. ✅ Verify time analytics display correctly
6. ✅ Configure auto-create worklogs (if desired)

---

## Getting Help

If you encounter issues:

1. Check the component-specific README files in `docs/`:
   - `docs/ai-server_README.md`
   - `docs/forge-app_SETUP_GUIDE.md`
   - `docs/desktop-app_README.md`
   - `docs/supabase_README.md`

2. Check logs:
   - AI Server: `ai-server/logs/combined.log` and `ai-server/logs/error.log`
   - Forge App: `forge logs`
   - Desktop App: Check console output

3. Verify all environment variables are set correctly

4. Ensure all services are running:
   - AI Server: `http://localhost:3001`
   - Supabase: Check dashboard
   - Desktop App: Check system tray

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `.env` files** - They contain sensitive keys
2. **Service Role Key** - Keep this secret! Never expose it to client-side code
3. **API Keys** - Rotate keys if they're ever exposed
4. **OAuth Secrets** - Keep client secrets secure
5. **Production** - Use HTTPS for all external services
6. **Environment Variables** - Use secure storage (e.g., AWS Secrets Manager, Azure Key Vault) in production

---

## Support

For additional help:
- Review component-specific documentation in `docs/` folder
- Check Supabase dashboard for database issues
- Review Forge logs: `forge logs`
- Check AI server logs: `ai-server/logs/`

Good luck with your setup! 🚀

