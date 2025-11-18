# Supabase Setup Guide

This guide will help you set up the Supabase backend for the BRD Automate & Time Tracker application.

## Prerequisites

- Supabase account (sign up at https://supabase.com)
- Supabase CLI installed (`npm install -g supabase`)

## Step 1: Create a New Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in the project details:
   - **Name**: `brd-time-tracker` (or your preferred name)
   - **Database Password**: Create a strong password and save it securely
   - **Region**: Choose the region closest to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (2-3 minutes)

## Step 2: Get Your Project Credentials

Once your project is created, navigate to **Settings > API**:

1. **Project URL**: Copy this (e.g., `https://xxxxx.supabase.co`)
2. **anon/public key**: Copy this for client-side access
3. **service_role key**: Copy this for server-side access (KEEP THIS SECRET!)

Save these credentials - you'll need them later.

## Step 3: Run Database Migrations

### Option A: Using Supabase SQL Editor (Recommended for beginners)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of each migration file in order:
   - `migrations/001_initial_schema.sql`
   - `migrations/002_rls_policies.sql`
   - `migrations/003_storage_buckets.sql`
5. Click **Run** for each query
6. Verify there are no errors

### Option B: Using Supabase CLI

1. Initialize Supabase in your project:
   ```bash
   supabase init
   ```

2. Link to your remote project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Find your project ref in the URL: https://app.supabase.com/project/YOUR_PROJECT_REF)

3. Push migrations to your project:
   ```bash
   supabase db push
   ```

## Step 4: Verify Database Schema

1. Navigate to **Table Editor** in your Supabase dashboard
2. You should see the following tables:
   - `users`
   - `screenshots`
   - `analysis_results`
   - `documents`
   - `worklogs`
   - `activity_log`

3. Navigate to **Database > Policies** to verify RLS policies are enabled

## Step 5: Configure Storage Buckets

The storage buckets should be created automatically by the migration. Verify by:

1. Navigate to **Storage** in your Supabase dashboard
2. You should see two buckets:
   - `screenshots` (10MB file limit, images only)
   - `documents` (50MB file limit, PDF/DOCX only)

3. Verify the bucket policies are in place:
   - Click on each bucket
   - Go to **Policies** tab
   - You should see policies for INSERT, SELECT, UPDATE, DELETE

If buckets are not created automatically, create them manually:

### Create Screenshots Bucket
- Name: `screenshots`
- Public: No
- File size limit: 10485760 (10MB)
- Allowed MIME types: `image/png, image/jpeg, image/jpg, image/webp`

### Create Documents Bucket
- Name: `documents`
- Public: No
- File size limit: 52428800 (50MB)
- Allowed MIME types: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/msword`

## Step 6: Deploy Edge Functions

### Deploy Screenshot Webhook Function

1. Navigate to `supabase/functions/screenshot-webhook/`
2. Deploy using the Supabase CLI:
   ```bash
   supabase functions deploy screenshot-webhook
   ```

3. Set environment variables:
   ```bash
   supabase secrets set AI_SERVER_URL=https://your-ai-server.com
   supabase secrets set AI_SERVER_API_KEY=your-api-key
   ```

### Deploy Document Webhook Function

1. Navigate to `supabase/functions/document-webhook/`
2. Deploy using the Supabase CLI:
   ```bash
   supabase functions deploy document-webhook
   ```

3. The environment variables should already be set from the previous step

### Verify Edge Functions

1. Navigate to **Edge Functions** in your Supabase dashboard
2. You should see:
   - `screenshot-webhook`
   - `document-webhook`
3. Both should show status: **Active**

## Step 7: Set Up Database Webhooks (Optional for Phase 1.4)

To automatically trigger Edge Functions when data is inserted:

1. Navigate to **Database > Webhooks**
2. Create a webhook for screenshots:
   - Name: `screenshot-insert-webhook`
   - Table: `public.screenshots`
   - Events: `INSERT`
   - Type: `HTTP Request`
   - URL: Your Edge Function URL (found in Edge Functions dashboard)
   - HTTP method: `POST`

3. Create a webhook for documents:
   - Name: `document-insert-webhook`
   - Table: `public.documents`
   - Events: `INSERT`
   - Type: `HTTP Request`
   - URL: Your Edge Function URL (found in Edge Functions dashboard)
   - HTTP method: `POST`

## Step 8: Configure Authentication

1. Navigate to **Authentication > Providers**
2. For this application, we'll use custom OAuth with Atlassian:
   - Enable **Custom OAuth** or use the built-in OAuth providers
   - Configuration will be completed in Phase 1.3 (Desktop App & Auth POC)

For now, you can enable **Email authentication** for testing:
- Navigate to **Authentication > Providers**
- Enable **Email**
- Disable **Confirm email** (for development only)

## Step 9: Update Forge Application with Supabase Credentials

1. Open the Forge app settings page (the one you built in `static/settings/`)
2. Enter your Supabase credentials:
   - **Supabase URL**: The project URL from Step 2
   - **Supabase Anon Key**: The anon/public key from Step 2

3. The `service_role` key should be stored securely on the backend (not exposed to clients)
   - You'll add this as an environment variable in the Forge resolver in a later phase

## Step 10: Test the Setup

### Test Database Connection

Run this SQL query in the SQL Editor to verify the schema:

```sql
-- Check tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';
```

You should see:
- All 6 tables listed
- RLS enabled (rowsecurity = true) for all tables
- 3 views: daily_time_summary, weekly_time_summary, project_time_summary

### Test Storage Buckets

1. Navigate to **Storage > screenshots**
2. Try uploading a test image
3. Verify it appears in the bucket
4. Delete the test image

## Environment Variables Summary

For reference, here are all the environment variables you'll need:

### For Desktop App
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Your anon/public key

### For Forge Backend (to be configured later)
- `SUPABASE_URL`: Your project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (KEEP SECRET!)

### For Edge Functions
- `AI_SERVER_URL`: URL of your AI Analysis Server (to be deployed in Phase 1.4)
- `AI_SERVER_API_KEY`: API key for secure communication with AI server

## Database Schema Overview

### Tables Created

1. **users** - User accounts linked to Atlassian
2. **screenshots** - Screenshot metadata and storage references
3. **analysis_results** - AI-analyzed time tracking data
4. **documents** - BRD documents for processing
5. **worklogs** - Created Jira worklogs (for tracking)
6. **activity_log** - System events and audit trail

### Views Created

1. **daily_time_summary** - Daily time aggregation per user/project/task
2. **weekly_time_summary** - Weekly time aggregation per user/project/task
3. **project_time_summary** - Project-level time aggregation

### Storage Buckets

1. **screenshots** - Stores captured screenshots (10MB limit)
2. **documents** - Stores BRD documents (50MB limit)

### Edge Functions

1. **screenshot-webhook** - Triggers AI analysis when screenshot uploaded
2. **document-webhook** - Triggers BRD processing when document uploaded

## Security Considerations

1. **Row Level Security (RLS)**: All tables have RLS enabled - users can only access their own data
2. **Storage Policies**: Users can only upload/view/delete files in their own folders
3. **Service Role Key**: Keep this secret! Never expose it to client-side code
4. **Anon Key**: Safe to use in client-side code (protected by RLS)

## Troubleshooting

### Migration Errors

If you encounter errors during migration:
1. Check the SQL Editor for specific error messages
2. Ensure you're running migrations in order (001, 002, 003)
3. Check that the `uuid-ossp` extension is enabled

### Storage Bucket Issues

If buckets aren't created:
1. Try running the storage migration again
2. Create buckets manually via the dashboard
3. Verify policies are attached to the `storage.objects` table

### Edge Function Deployment Failures

If Edge Functions fail to deploy:
1. Ensure Supabase CLI is up to date: `npm update -g supabase`
2. Check that you're logged in: `supabase login`
3. Verify project is linked: `supabase projects list`

## Next Steps

Once Supabase is set up, you can proceed to:

- **Phase 1.3**: Desktop App & Auth POC
- **Phase 1.4**: AI Server & Data Bridge POC

The database is now ready to receive data from the desktop app and serve data to the Forge application!
