# Complete Supabase Setup Guide

This guide will walk you through setting up Supabase for the BRD Time Tracker application.

## ✅ Prerequisites

- Supabase account (sign up at https://supabase.com if you don't have one)
- Your Supabase project URL and keys (already in your `.env` files)

## 📋 Current Configuration

Based on your `.env` files, you're using:
- **Project URL**: `https://jvijitdewbypqbatfboi.supabase.co`
- **Anon Key**: Already configured
- **Service Role Key**: Already configured

## 🚀 Step-by-Step Setup

### Step 1: Access Your Supabase Dashboard

1. Go to https://app.supabase.com
2. Sign in to your account
3. Select your project: `jvijitdewbypqbatfboi`

### Step 2: Run Database Migrations

You need to run 4 migration files in order. Here's how:

#### Option A: Using SQL Editor (Recommended - Easiest)

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy and paste the contents of each migration file **one at a time**:

**Migration 1: Initial Schema**
- Open `supabase/migrations/001_initial_schema.sql`
- Copy ALL contents
- Paste into SQL Editor
- Click **Run** (or press Ctrl+Enter)
- Wait for "Success. No rows returned"

**Migration 2: RLS Policies**
- Open `supabase/migrations/002_rls_policies.sql`
- Copy ALL contents
- Paste into SQL Editor
- Click **Run**
- Wait for "Success. No rows returned"

**Migration 3: Storage Buckets**
- Open `supabase/migrations/003_storage_buckets.sql`
- Copy ALL contents
- Paste into SQL Editor
- Click **Run**
- Wait for "Success. No rows returned"

**Migration 4: Database Triggers**
- Open `supabase/migrations/004_database_triggers.sql`
- Copy ALL contents
- Paste into SQL Editor
- Click **Run**
- Wait for "Success. No rows returned"

#### Option B: Using Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref jvijitdewbypqbatfboi

# Push all migrations
supabase db push
```

### Step 3: Verify Database Schema

1. Go to **Table Editor** in your Supabase dashboard
2. You should see these 6 tables:
   - ✅ `users`
   - ✅ `screenshots`
   - ✅ `analysis_results`
   - ✅ `documents`
   - ✅ `worklogs`
   - ✅ `activity_log`

3. Verify RLS is enabled:
   - Go to **Database > Policies**
   - You should see policies for all tables

4. Check views:
   - Go to **SQL Editor**
   - Run this query:
   ```sql
   SELECT table_name
   FROM information_schema.views
   WHERE table_schema = 'public';
   ```
   - You should see: `daily_time_summary`, `weekly_time_summary`, `project_time_summary`

### Step 4: Verify Storage Buckets

1. Go to **Storage** in your Supabase dashboard
2. You should see two buckets:
   - ✅ `screenshots` (10MB limit, private)
   - ✅ `documents` (50MB limit, private)

3. If buckets are missing, create them manually:
   - Click **New bucket**
   - **Screenshots bucket:**
     - Name: `screenshots`
     - Public: **No** (unchecked)
     - File size limit: `10485760` (10MB)
     - Allowed MIME types: `image/png, image/jpeg, image/jpg, image/webp`
   - **Documents bucket:**
     - Name: `documents`
     - Public: **No** (unchecked)
     - File size limit: `52428800` (50MB)
     - Allowed MIME types: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword`

4. Verify storage policies:
   - Click on each bucket
   - Go to **Policies** tab
   - You should see policies for INSERT, SELECT, UPDATE, DELETE

### Step 5: Test the Setup

Run this verification query in SQL Editor:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check views exist
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check storage buckets
SELECT id, name, public, file_size_limit
FROM storage.buckets
ORDER BY name;
```

Expected results:
- 6 tables (users, screenshots, analysis_results, documents, worklogs, activity_log)
- All tables with `rowsecurity = true`
- 3 views (daily_time_summary, weekly_time_summary, project_time_summary)
- 2 storage buckets (screenshots, documents)

### Step 6: Configure Edge Functions (Optional for Now)

Edge Functions are used to trigger AI analysis. You can set these up later, but here's how:

1. **Deploy Screenshot Webhook:**
   ```bash
   cd supabase/functions/screenshot-webhook
   supabase functions deploy screenshot-webhook
   ```

2. **Deploy Document Webhook:**
   ```bash
   cd supabase/functions/document-webhook
   supabase functions deploy document-webhook
   ```

3. **Set Environment Variables:**
   ```bash
   supabase secrets set AI_SERVER_URL=http://localhost:3001
   supabase secrets set AI_SERVER_API_KEY=your-api-key-here
   ```

**Note:** You can skip this step for now if you're just testing the desktop app. Edge Functions are only needed when screenshots are uploaded and need AI analysis.

### Step 7: Update Desktop App Configuration

Your desktop app `.env` already has the correct Supabase URL and Anon Key. The app will use these when you authenticate.

However, you may need to configure Supabase settings in the app UI:

1. Start the desktop app: `npm start` (in `desktop-app` directory)
2. Go to Settings
3. Enter your Supabase credentials:
   - **Supabase URL**: `https://jvijitdewbypqbatfboi.supabase.co`
   - **Supabase Anon Key**: (from your `.env` file)

## 🔍 Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution:** This means the table already exists. You can either:
- Drop the existing table and re-run the migration (⚠️ **WARNING**: This deletes data!)
- Or skip that migration and continue with the next one

### Issue: Storage buckets not created

**Solution:** 
1. Check if the `storage` schema exists
2. Create buckets manually via the dashboard (see Step 4)
3. Then run the storage policies migration again

### Issue: RLS policies not working

**Solution:**
1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
2. Check policies exist: Go to **Database > Policies**
3. If missing, re-run `002_rls_policies.sql`

### Issue: "permission denied" errors

**Solution:**
- Make sure you're using the **service_role** key for backend operations
- Make sure you're using the **anon** key for client-side operations
- Check that RLS policies are correctly set up

## ✅ Verification Checklist

Before proceeding, verify:

- [ ] All 6 tables created (users, screenshots, analysis_results, documents, worklogs, activity_log)
- [ ] RLS enabled on all tables
- [ ] 3 views created (daily_time_summary, weekly_time_summary, project_time_summary)
- [ ] 2 storage buckets created (screenshots, documents)
- [ ] Storage policies configured
- [ ] Desktop app `.env` has correct Supabase URL and Anon Key
- [ ] Can connect to Supabase from desktop app

## 🎯 Next Steps

Once Supabase is set up:

1. **Test Desktop App:**
   - Start the desktop app
   - Try authenticating with Atlassian OAuth
   - Verify you can upload screenshots

2. **Test Forge App:**
   - Configure Supabase settings in Forge app
   - Verify you can see time analytics

3. **Test AI Server:**
   - Start the AI server
   - Verify it can connect to Supabase
   - Test screenshot analysis

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase SQL Editor Guide](https://supabase.com/docs/guides/database/overview)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 🆘 Need Help?

If you encounter issues:

1. Check the error message in SQL Editor
2. Verify your Supabase project is active
3. Check that you have the correct permissions
4. Review the migration files for syntax errors
5. Check Supabase status page: https://status.supabase.com

---

**Quick Test Query:**

Run this in SQL Editor to verify everything:

```sql
-- Quick health check
SELECT 
    'Tables' as type, COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Views' as type, COUNT(*) as count
FROM information_schema.views 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Buckets' as type, COUNT(*) as count
FROM storage.buckets;
```

Expected output:
- Tables: 6
- Views: 3
- Buckets: 2

