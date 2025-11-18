# Supabase Backend

This directory contains all Supabase configuration, migrations, and Edge Functions for the BRD Automate & Time Tracker application.

## Directory Structure

```
supabase/
├── migrations/              # Database schema migrations
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_storage_buckets.sql
│   └── 004_database_triggers.sql
├── functions/              # Edge Functions
│   ├── screenshot-webhook/
│   │   └── index.ts
│   └── document-webhook/
│       └── index.ts
├── config.toml             # Local development config
├── SETUP.md               # Detailed setup guide
└── README.md              # This file
```

## Quick Start

### 1. Create Supabase Project

- Sign up at https://supabase.com
- Create a new project
- Save your project URL and API keys

### 2. Run Migrations

**Option A: SQL Editor (Recommended)**
1. Open Supabase SQL Editor
2. Run each migration file in order (001 → 004)

**Option B: Supabase CLI**
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy screenshot-webhook
supabase functions deploy document-webhook
```

### 4. Configure Environment Variables

```bash
supabase secrets set AI_SERVER_URL=https://your-ai-server.com
supabase secrets set AI_SERVER_API_KEY=your-api-key
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts linked to Atlassian |
| `screenshots` | Screenshot metadata and storage refs |
| `analysis_results` | AI-analyzed time tracking data |
| `documents` | BRD documents for processing |
| `worklogs` | Jira worklogs created by the system |
| `activity_log` | System events and audit trail |

### Analytics Views

| View | Purpose |
|------|---------|
| `daily_time_summary` | Daily time aggregation per user/project/task |
| `weekly_time_summary` | Weekly time aggregation |
| `project_time_summary` | Project-level time aggregation |

### Storage Buckets

| Bucket | Size Limit | File Types |
|--------|------------|------------|
| `screenshots` | 10MB | PNG, JPEG, WEBP |
| `documents` | 50MB | PDF, DOCX, DOC |

## Security Features

### Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data through the following policies:

- Users can view/update their own profile
- Users can manage (CRUD) their own screenshots
- Users can manage their own documents
- Users can view their own analysis results and worklogs
- Service role has full access for backend operations

### Storage Policies

Storage buckets enforce user-specific folder access:
- Users can only upload to: `{bucket}/{user_id}/*`
- Users can only read/delete their own files
- Service role has full access

## Edge Functions

### screenshot-webhook

**Trigger**: When a new screenshot is inserted into the database
**Purpose**: Notifies the AI Analysis Server to process the screenshot
**Flow**:
1. Screenshot inserted → trigger fires
2. Update status to 'processing'
3. Call AI server with screenshot details
4. AI server processes asynchronously

### document-webhook

**Trigger**: When a new document is inserted into the database
**Purpose**: Notifies the AI Analysis Server to extract requirements
**Flow**:
1. Document inserted → trigger fires
2. Update status to 'extracting'
3. Call AI server with document details
4. AI server processes and creates Jira issues

## Environment Variables

### Edge Functions
- `AI_SERVER_URL` - URL of the AI Analysis Server
- `AI_SERVER_API_KEY` - API key for secure communication

### Application Config (stored in app settings)
- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Public/anon key for client-side
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend (KEEP SECRET!)

## Local Development

To run Supabase locally for development:

```bash
# Start local Supabase instance
supabase start

# Run migrations
supabase db reset

# View local Studio
# Open http://localhost:54323
```

Local endpoints:
- API: http://localhost:54321
- Studio: http://localhost:54323
- Inbucket (email testing): http://localhost:54324

## Migrations

Migrations are run in numerical order. Each migration file should:
- Be idempotent (safe to run multiple times)
- Use `IF NOT EXISTS` where appropriate
- Include helpful comments
- Have a descriptive filename

To create a new migration:

```bash
supabase migration new description_of_change
```

## Testing

### Test Database Connection

```sql
-- Verify all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

### Test RLS Policies

```sql
-- Insert test user
INSERT INTO public.users (atlassian_account_id, email, display_name)
VALUES ('test-123', 'test@example.com', 'Test User');

-- Try to insert a screenshot as that user
-- Should work if authenticated as that user
-- Should fail if authenticated as a different user
```

### Test Edge Functions

```bash
# Invoke function locally
supabase functions serve screenshot-webhook

# Call the function
curl -i --location --request POST 'http://localhost:54321/functions/v1/screenshot-webhook' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"type":"INSERT","table":"screenshots","record":{"id":"test-id"}}'
```

## Troubleshooting

### Common Issues

**Migrations fail**
- Ensure migrations are run in order
- Check for syntax errors in SQL
- Verify `uuid-ossp` extension is enabled

**RLS prevents access**
- Verify user is authenticated
- Check RLS policies match your use case
- Use service_role key for backend operations

**Storage upload fails**
- Check file size limits
- Verify MIME types are allowed
- Ensure storage policies are configured

**Edge Functions don't trigger**
- Verify webhook URLs are set
- Check Edge Function logs
- Ensure environment variables are set

For detailed troubleshooting, see [SETUP.md](./SETUP.md)

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Storage Guide](https://supabase.com/docs/guides/storage)

## Next Steps

Once Supabase is configured, proceed to:
- **Phase 1.3**: Desktop App & Auth POC
- **Phase 1.4**: AI Server & Data Bridge POC
