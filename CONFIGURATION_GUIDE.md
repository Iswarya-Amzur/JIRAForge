# Configuration Guide - Setting Up Your Credentials

This guide shows you exactly where to configure each credential you've provided.

## Credentials Provided

✅ **Supabase URL:** `https://jvijitdewbypqbatfboi.supabase.co`  
✅ **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`  
✅ **Jira API Token:** `YOUR_JIRA_API_TOKEN_HERE` (⚠️ Get this from https://id.atlassian.com/manage-profile/security/api-tokens)

## ⚠️ Missing Credential

You'll also need the **Supabase Service Role Key** for backend operations. You can find it in:
- Supabase Dashboard → Settings → API → `service_role` key (keep this secret!)

---

## 1. Forge App Configuration (Jira Integration)

### Step 1: Deploy the Forge App

```bash
cd forge-app
npm install
cd static/main && npm install && cd ../..
cd static/settings && npm install && cd ../..
npm run build
forge register
forge deploy
```

### Step 2: Configure in Jira Settings

1. Install the app on your Jira site: `forge install`
2. Go to your Jira site → Apps → BRD & Time Tracker → Settings
3. Enter the following:

**Supabase Configuration:**
- **Supabase URL:** `https://jvijitdewbypqbatfboi.supabase.co`
- **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTU1OTAsImV4cCI6MjA3ODMzMTU5MH0.OvoIgXKqYTK_9S_bIJtUa6N2TVgtgcp94iOVjE3rdRM`
- **Supabase Service Role Key:** ⚠️ **Get this from Supabase Dashboard** (Settings → API → service_role key)

**Time Tracking Configuration:**
- **Screenshot Interval:** 300 seconds (5 minutes) - adjust as needed
- **Auto-create Worklogs:** Enable/disable as preferred

**AI Server Configuration:**
- **AI Server URL:** Your AI server URL (if running separately)

4. Click **Save Settings**

---

## 2. Desktop App Configuration

The desktop app uses OAuth, not the API token directly. However, you can use the API token for testing.

### Step 1: Create Environment File

```bash
cd desktop-app
cp .env.example .env
```

### Step 2: Edit `.env` File

```env
# Atlassian OAuth (get from https://developer.atlassian.com/console/myapps/)
ATLASSIAN_CLIENT_ID=your_oauth_client_id
ATLASSIAN_CLIENT_SECRET=your_oauth_client_secret

# Supabase Configuration
SUPABASE_URL=https://jvijitdewbypqbatfboi.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTU1OTAsImV4cCI6MjA3ODMzMTU5MH0.OvoIgXKqYTK_9S_bIJtUa6N2TVgtgcp94iOVjE3rdRM
SUPABASE_AUTH_URL=https://jvijitdewbypqbatfboi.supabase.co/auth/v1
```

**Note:** The Jira API token you provided is not used by the desktop app. The desktop app uses OAuth 3LO flow. However, if you need to use the API token for testing, you can add it as:

```env
# Optional: For testing Jira API directly
JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN_HERE
JIRA_BASE_URL=https://your-domain.atlassian.net
```

---

## 3. AI Server Configuration

### Step 1: Create Environment File

```bash
cd ai-server
cp .env.example .env
```

### Step 2: Edit `.env` File

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://jvijitdewbypqbatfboi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Server Security
AI_SERVER_API_KEY=generate_a_secure_random_key_here

# OpenAI Configuration (for BRD processing)
OPENAI_API_KEY=your_openai_api_key

# Optional: Screenshot interval (default: 300 seconds)
SCREENSHOT_INTERVAL=300

# Optional: Auto-create worklogs
AUTO_CREATE_WORKLOGS=false
```

**Important:**
- Generate a secure `AI_SERVER_API_KEY` (e.g., use `openssl rand -hex 32`)
- Get `SUPABASE_SERVICE_ROLE_KEY` from Supabase Dashboard
- Get `OPENAI_API_KEY` from https://platform.openai.com/api-keys

---

## 4. Supabase Edge Functions Configuration

The Edge Functions need the AI Server API key.

### Step 1: Set Secrets in Supabase

```bash
cd supabase

# If using Supabase CLI locally
supabase secrets set AI_SERVER_API_KEY=your_ai_server_api_key
supabase secrets set AI_SERVER_URL=http://localhost:3001  # or your deployed URL
```

Or set them in Supabase Dashboard:
- Go to Project Settings → Edge Functions → Secrets
- Add:
  - `AI_SERVER_API_KEY` = (same as in ai-server/.env)
  - `AI_SERVER_URL` = (your AI server URL)

---

## 5. Quick Setup Checklist

### Forge App (Jira)
- [ ] Deploy Forge app: `cd forge-app && forge deploy`
- [ ] Install on Jira site: `forge install`
- [ ] Configure Supabase credentials in Settings page
- [ ] ⚠️ Add Supabase Service Role Key (get from dashboard)

### Desktop App
- [ ] Create `.env` file with Supabase URL and Anon Key
- [ ] Configure Atlassian OAuth app (get Client ID/Secret)
- [ ] Test authentication flow

### AI Server
- [ ] Create `.env` file with all required keys
- [ ] Generate secure `AI_SERVER_API_KEY`
- [ ] Add OpenAI API key for BRD processing
- [ ] Start server: `npm start`

### Supabase
- [ ] Run migrations: `supabase db reset` (or apply migrations)
- [ ] Set Edge Function secrets (AI_SERVER_API_KEY, AI_SERVER_URL)
- [ ] Verify storage buckets exist (screenshots, documents)

---

## 6. Getting Missing Credentials

### Supabase Service Role Key
1. Go to https://supabase.com/dashboard
2. Select your project: `jvijitdewbypqbatfboi`
3. Go to **Settings** → **API**
4. Find **service_role** key (⚠️ Keep this secret!)
5. Copy and use in Forge app settings and AI server `.env`

### Atlassian OAuth Credentials (for Desktop App)
1. Go to https://developer.atlassian.com/console/myapps/
2. Create a new OAuth 2.0 (3LO) app
3. Set redirect URL: `brd-time-tracker://oauth/callback`
4. Enable scopes: `read:me`, `read:jira-work`, `write:jira-work`, `offline_access`
5. Copy Client ID and Client Secret

### OpenAI API Key (for BRD Processing)
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy and add to `ai-server/.env`

---

## 7. Testing the Configuration

### Test Forge App Connection
1. Open Jira → Project → BRD & Time Tracker tab
2. Go to Time Analytics tab
3. Should show "No data available" (not an error) if Supabase is connected

### Test Desktop App
1. Run: `cd desktop-app && npm start`
2. Click "Sign In with Atlassian"
3. Complete OAuth flow
4. Start tracking

### Test AI Server
```bash
cd ai-server
npm start
# Should see: "AI Analysis Server running on port 3001"
```

Test health endpoint:
```bash
curl http://localhost:3001/health
```

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit `.env` files** to git
2. **Service Role Key** has full database access - keep it secret
3. **API Keys** should be rotated regularly
4. **Jira API Token** - the one you provided should be kept secure
5. Use environment variables, never hardcode credentials

---

## Troubleshooting

### "Supabase not configured" error
- Check that you've saved settings in Forge app
- Verify Service Role Key is correct
- Check Supabase URL format (must start with https://)

### "Unable to get user information"
- User record might not exist in Supabase `users` table
- Check that migrations have been run
- Verify RLS policies are set up correctly

### Desktop app authentication fails
- Verify OAuth redirect URL matches exactly: `brd-time-tracker://oauth/callback`
- Check Client ID and Secret are correct
- Ensure scopes are enabled in Atlassian app

### AI Server not receiving webhooks
- Verify `AI_SERVER_API_KEY` matches in both Supabase secrets and `.env`
- Check `AI_SERVER_URL` is correct and accessible
- Verify Edge Functions are deployed

---

## Next Steps

Once configured:
1. ✅ Test Forge app in Jira
2. ✅ Test desktop app screenshot capture
3. ✅ Test BRD upload and processing
4. ✅ Verify time analytics display correctly

Good luck! 🚀

