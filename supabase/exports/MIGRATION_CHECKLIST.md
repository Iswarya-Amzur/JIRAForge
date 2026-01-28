# JIRAForge Production Migration Checklist

**Generated:** 2026-01-25 04:16:09  
**Target Project:** jbxabkazpuuphpsahlfh  
**Target URL:** https://jbxabkazpuuphpsahlfh.supabase.co

---

## Pre-Migration Checklist

- [ ] Backup development database (optional, for reference)
- [ ] Verify production Supabase project is created
- [ ] Note down production API keys (anon, service_role)
- [ ] Ensure you have Supabase CLI installed (`npm install -g supabase`)
- [ ] Login to Supabase CLI (`supabase login`)

---

## Step 1: Database Schema Migration

1. Open Supabase Dashboard for production:
   https://jbxabkazpuuphpsahlfh.supabase.co/project/jbxabkazpuuphpsahlfh

2. Go to **SQL Editor** → **New Query**

3. Copy and paste the contents of:
   `C:\ATG\jira3\JIRAForge\supabase\exports\PRODUCTION_SETUP.sql`

4. Click **Run** to execute the entire script

5. Verify the output shows:
   - ✅ Tables created
   - ✅ Functions created
   - ✅ Triggers created
   - ✅ Views created
   - ✅ RLS policies created
   - ✅ Storage buckets created

- [ ] Schema migration completed successfully

---

## Step 2: Storage Buckets Verification

The main script should have created the buckets. Verify in Dashboard:

1. Go to **Storage** section
2. Verify these buckets exist:
   - [ ] `screenshots` bucket (private, 10MB limit)
   - [ ] `documents` bucket (private, 50MB limit)

If missing, run the SQL in:
`C:\ATG\jira3\JIRAForge\supabase\exports\STORAGE_SETUP.sql`

---

## Step 3: Deploy Edge Functions

Using Supabase CLI:

```powershell
cd C:\ATG\jira3\JIRAForge\supabase

# Link to production project
supabase link --project-ref jbxabkazpuuphpsahlfh

# Deploy all functions
supabase functions deploy screenshot-webhook --project-ref jbxabkazpuuphpsahlfh
supabase functions deploy document-webhook --project-ref jbxabkazpuuphpsahlfh  
supabase functions deploy update-issues-cache --project-ref jbxabkazpuuphpsahlfh

# Set secrets
supabase secrets set AI_SERVER_URL=<your-ai-server-url> --project-ref jbxabkazpuuphpsahlfh
supabase secrets set AI_SERVER_API_KEY=<your-api-key> --project-ref jbxabkazpuuphpsahlfh
```

- [ ] screenshot-webhook deployed
- [ ] document-webhook deployed
- [ ] update-issues-cache deployed
- [ ] Secrets configured

---

## Step 4: Configure Database Webhooks

1. Go to **Database** → **Webhooks** in Dashboard

2. Create **screenshot-insert-webhook**:
   - Table: `screenshots`
   - Events: INSERT
   - Type: Supabase Edge Function
   - Function: `screenshot-webhook`
   
3. Create **document-insert-webhook**:
   - Table: `documents`
   - Events: INSERT
   - Type: Supabase Edge Function
   - Function: `document-webhook`

- [ ] screenshot-insert-webhook created
- [ ] document-insert-webhook created

---

## Step 5: Update Application Configurations

### Desktop App (python-desktop-app)
Update `.env` or configuration:
```
SUPABASE_URL=https://jbxabkazpuuphpsahlfh.supabase.co
SUPABASE_ANON_KEY=<production-anon-key>
```

### Forge App (forge-app)
Update `manifest.yml` or environment:
```yaml
SUPABASE_URL: https://jbxabkazpuuphpsahlfh.supabase.co
SUPABASE_SERVICE_ROLE_KEY: <production-service-role-key>
```

### AI Server (ai-server)
Update `.env`:
```
SUPABASE_URL=https://jbxabkazpuuphpsahlfh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
```

- [ ] Desktop app configured
- [ ] Forge app configured
- [ ] AI server configured

---

## Step 6: Verification Tests

### Test 1: Database Connection
```python
import requests
url = "https://jbxabkazpuuphpsahlfh.supabase.co/rest/v1/"
headers = {"apikey": "<anon-key>"}
response = requests.get(url, headers=headers)
print(f"Status: {response.status_code}")  # Should be 200
```

### Test 2: Table Existence
In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
```

### Test 3: Storage Bucket Access
```python
url = "https://jbxabkazpuuphpsahlfh.supabase.co/storage/v1/bucket"
headers = {"apikey": "<service-role-key>", "Authorization": "Bearer <service-role-key>"}
response = requests.get(url, headers=headers)
print(response.json())  # Should list buckets
```

- [ ] Database connection works
- [ ] All tables exist
- [ ] Storage buckets accessible

---

## Step 7: Go Live Checklist

- [ ] All tests passed
- [ ] Team notified of migration
- [ ] DNS/URLs updated if applicable
- [ ] Monitoring configured
- [ ] First user test successful

---

## Troubleshooting

### Issue: "relation already exists"
This is OK - it means the table already exists. The script uses `IF NOT EXISTS`.

### Issue: "permission denied"
Check that you're using the `service_role` key, not the `anon` key.

### Issue: Edge function deployment fails
1. Ensure you're logged in: `supabase login`
2. Ensure project is linked: `supabase link --project-ref jbxabkazpuuphpsahlfh`
3. Check function syntax for errors

### Issue: Webhooks not triggering
1. Verify webhook is enabled in Dashboard
2. Check Edge Function logs in Dashboard
3. Verify secrets are set correctly

---

## Support Files Generated

| File | Purpose |
|------|---------|
| `PRODUCTION_SETUP.sql` | Complete database schema |
| `STORAGE_SETUP.sql` | Storage bucket SQL |
| `WEBHOOK_SETUP_GUIDE.md` | Webhook configuration |
| `EDGE_FUNCTION_DEPLOYMENT.md` | Edge function deployment |
| `ENV_VARIABLES_GUIDE.md` | Environment variables |

---

**Migration prepared successfully! Follow the steps above to complete the migration.**
