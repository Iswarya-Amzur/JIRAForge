# Setup Checklist - Quick Reference

Use this checklist to track your setup progress. Check off each item as you complete it.

## Prerequisites
- [ ] Node.js 20.x or 22.x installed (`node --version`)
- [ ] Python 3.8+ installed (`python --version`)
- [ ] Git installed
- [ ] Atlassian Developer Account created
- [ ] Supabase Account created
- [ ] OpenAI API Key obtained

## Repository Setup
- [ ] Repository cloned
- [ ] Navigated to project directory

## Supabase Setup
- [ ] Supabase project created
- [ ] Project URL saved
- [ ] Anon key saved
- [ ] Service role key saved (keep secret!)
- [ ] Migration `001_initial_schema.sql` run
- [ ] Migration `002_rls_policies.sql` run
- [ ] Migration `002_unassigned_activity.sql` run
- [ ] Migration `003_storage_buckets.sql` run
- [ ] Migration `003_work_type_column.sql` run
- [ ] Migration `004_add_display_names_to_views.sql` run
- [ ] Migration `004_database_triggers.sql` run
- [ ] Migration `005_user_jira_issues_cache.sql` run
- [ ] Migration `006_add_user_assigned_issues_to_screenshots.sql` run
- [ ] Storage bucket `screenshots` created
- [ ] Storage bucket `documents` created

## AI Server Setup
- [ ] Navigated to `ai-server` directory
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured with:
  - [ ] `AI_SERVER_API_KEY` (generated secure key)
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY`
- [ ] `logs` directory created
- [ ] Server started (`npm run dev` or `npm start`)
- [ ] Health check passed (`curl http://localhost:3001/health`)

## Forge App Setup
- [ ] Forge CLI installed (`npm install -g @forge/cli`)
- [ ] Navigated to `forge-app` directory
- [ ] Root dependencies installed (`npm install`)
- [ ] Main UI dependencies installed (`cd static/main && npm install`)
- [ ] Settings UI dependencies installed (`cd static/settings && npm install`)
- [ ] UI components built (`npm run build`)
- [ ] Logged in to Forge (`forge login`)
- [ ] App registered (`forge register`)
- [ ] App deployed (`forge deploy`)
- [ ] App installed on Jira site (`forge install`)
- [ ] Settings configured in Jira (Supabase URL, keys, AI Server URL)

## Desktop App Setup
- [ ] Navigated to `python-desktop-app` directory
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file created with:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `ATLASSIAN_CLIENT_ID`
  - [ ] `ATLASSIAN_CLIENT_SECRET`
- [ ] OAuth client configured (choose one):
  - [ ] Option A: Using existing shared OAuth client (Client ID and Secret obtained)
  - [ ] Option B: Created own OAuth app (recommended)
- [ ] OAuth redirect URL configured: `http://localhost:7777/auth/callback`
- [ ] OAuth scopes enabled (read:me, read:jira-work, write:jira-work, offline_access)
- [ ] Desktop app launched (`python desktop_app.py`)

## Testing & Verification
- [ ] AI Server health check works
- [ ] Forge app appears in Jira project page
- [ ] Forge app appears in Jira issue panel
- [ ] Forge app settings page loads
- [ ] Desktop app launches successfully
- [ ] Desktop app OAuth login works
- [ ] Desktop app can start tracking
- [ ] Screenshot captured and uploaded to Supabase
- [ ] Screenshot appears in Forge app gallery
- [ ] AI analysis processes screenshot (check logs)
- [ ] Time analytics display in Forge app

## Production Deployment (Optional)
- [ ] AI Server deployed to production
- [ ] Production environment variables configured
- [ ] Desktop app packaged for distribution
- [ ] Security review completed
- [ ] Monitoring/logging configured

## Notes
- Write down any issues encountered:
  - 
  - 
  - 

- Write down any custom configurations:
  - 
  - 
  - 

---

**Setup Date:** _______________

**Completed By:** _______________

**System Info:**
- OS: _______________
- Node.js Version: _______________
- Python Version: _______________

