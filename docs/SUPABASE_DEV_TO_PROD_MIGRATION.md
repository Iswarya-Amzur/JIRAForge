# Supabase Development to Production Migration Guide

## Overview

This document details the complete process for migrating the JIRAForge Supabase project from development to production. This migration transfers **schema structure only** (no data).

**Migration Date:** January 25, 2026

---

## Environment Details

| Environment | Project Reference | URL |
|-------------|------------------|-----|
| **Development** | `jvijitdewbypqbatfboi` | https://jvijitdewbypqbatfboi.supabase.co |
| **Production** | `jbxabkazpuuphpsahlfh` | https://jbxabkazpuuphpsahlfh.supabase.co |

### Production Credentials

```
Project Ref: jbxabkazpuuphpsahlfh
URL: https://jbxabkazpuuphpsahlfh.supabase.co
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieGFia2F6cHV1cGhwc2FobGZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4Mjk4NCwiZXhwIjoyMDg0ODU4OTg0fQ.jSRh71ENoG5dxVxFFQx7sSoGo1zxQFgxA5FtSahQ36Q
```

---

## Migration Steps Completed

### Step 1: Generate Migration SQL

**Script Location:** `supabase/migrate_to_production.py`

The Python script was created to:
1. Export schema from development (no data)
2. Create storage buckets via Supabase API
3. Generate SQL files for manual execution

**Run Command:**
```powershell
cd C:\ATG\jira3\JIRAForge
python supabase/migrate_to_production.py
```

**Output Files Generated:**
- `supabase/exports/PRODUCTION_SETUP.sql` - Complete database schema (1357 lines)

---

### Step 2: Execute SQL in Production

1. Go to: https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/sql/new
2. Copy contents of `PRODUCTION_SETUP.sql`
3. Paste and click **Run**

**Verification Results:**
- ✅ 15 Tables created
- ✅ 89 Indexes created
- ✅ Functions created
- ✅ Triggers created
- ✅ Views created
- ✅ RLS Policies created
- ✅ Storage buckets created (screenshots: 10MB, documents: 50MB)

---

### Step 3: Deploy Edge Functions

**Prerequisites:**
```powershell
# Login to Supabase CLI
npx supabase login
```

**Deploy Commands (run from project root):**
```powershell
cd C:\ATG\jira3\JIRAForge

# Deploy screenshot webhook
npx supabase functions deploy screenshot-webhook --project-ref jbxabkazpuuphpsahlfh

# Deploy document webhook
npx supabase functions deploy document-webhook --project-ref jbxabkazpuuphpsahlfh

# Deploy issues cache updater
npx supabase functions deploy update-issues-cache --project-ref jbxabkazpuuphpsahlfh
```

**Edge Functions Deployed:**
| Function | Status | Purpose |
|----------|--------|---------|
| `screenshot-webhook` | ✅ Deployed | Handles screenshot INSERT events, sends to AI server |
| `document-webhook` | ✅ Deployed | Handles document INSERT events, processes BRD |
| `update-issues-cache` | ⏳ Pending | Updates Jira issues cache |

---

### Step 4: Set Edge Function Secrets

**AI Server Credentials:**
- **URL:** `https://forgesync.amzur.com`
- **API Key:** `21d9732ecec4f13e642617f141a19f684993159735900267bd1b9edb094a198d`

**Commands:**
```powershell
cd C:\ATG\jira3\JIRAForge

npx supabase secrets set AI_SERVER_URL=https://forgesync.amzur.com --project-ref jbxabkazpuuphpsahlfh

npx supabase secrets set AI_SERVER_API_KEY=21d9732ecec4f13e642617f141a19f684993159735900267bd1b9edb094a198d --project-ref jbxabkazpuuphpsahlfh
```

**Status:** ✅ Completed

---

### Step 5: Create Database Webhooks (Manual)

**Dashboard URL:** https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/database/hooks

#### Webhook 1: Screenshot Processing
| Setting | Value |
|---------|-------|
| Name | `screenshot-insert-webhook` |
| Table | `screenshots` |
| Events | `INSERT` |
| Type | Supabase Edge Function |
| Function | `screenshot-webhook` |

#### Webhook 2: Document/BRD Processing
| Setting | Value |
|---------|-------|
| Name | `document-insert-webhook` |
| Table | `documents` |
| Events | `INSERT` |
| Type | Supabase Edge Function |
| Function | `document-webhook` |

**Status:** ⏳ Manual creation required

---

### Step 6: Add Missing Database Functions (Optional)

Some functions present in development were not included in the initial migration. Run this SQL in production if needed:

```sql
-- Get current user's organization ID (no-param version for RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id
    FROM public.users
    WHERE supabase_user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Check if current user has specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  permission_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = get_current_user_id()
    AND om.organization_id = get_current_user_organization_id()
    AND (
      om.role IN ('owner', 'admin')
      OR
      CASE permission_name
        WHEN 'manage_settings' THEN om.can_manage_settings
        WHEN 'view_team_analytics' THEN om.can_view_team_analytics
        WHEN 'manage_members' THEN om.can_manage_members
        WHEN 'delete_screenshots' THEN om.can_delete_screenshots
        WHEN 'manage_billing' THEN om.can_manage_billing
        ELSE false
      END = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = get_current_user_id()
    AND om.organization_id = get_current_user_organization_id()
    AND om.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_current_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated;
```

---

## Database Schema Summary

### Tables (15)

| Table | Purpose |
|-------|---------|
| `users` | User accounts linked to Atlassian |
| `organizations` | Multi-tenant organization data |
| `organization_members` | RBAC membership |
| `organization_settings` | Org-level configuration |
| `screenshots` | Screenshot metadata |
| `analysis_results` | AI analysis results |
| `documents` | BRD/document uploads |
| `worklogs` | Jira worklog sync |
| `activity_log` | User activity events |
| `tracking_settings` | User tracking preferences |
| `user_jira_issues_cache` | Cached Jira issues |
| `unassigned_activity` | Activities without task assignment |
| `unassigned_work_groups` | Grouped unassigned work |
| `unassigned_group_members` | Links activities to groups |
| `created_issues_log` | Issues created from BRD |

### Storage Buckets (2)

| Bucket | Size Limit | Allowed Types |
|--------|------------|---------------|
| `screenshots` | 10MB | PNG, JPEG, JPG, WebP |
| `documents` | 50MB | PDF, DOCX, DOC |

### Views (6)

- `daily_time_summary`
- `weekly_time_summary`
- `monthly_time_summary`
- `project_time_summary`
- `task_time_summary`
- `unassigned_activity_summary`

### Functions (Core)

| Function | Purpose |
|----------|---------|
| `get_current_user_id()` | Get current user's UUID |
| `get_user_organization_id(uuid)` | Get user's organization |
| `user_belongs_to_org(uuid, uuid)` | Check org membership |
| `get_user_role(uuid, uuid)` | Get user's role |
| `update_updated_at_column()` | Auto-update timestamps |
| `calculate_screenshot_duration()` | Calculate activity duration |
| `auto_save_unassigned_activity()` | Auto-save unassigned work |

### Triggers (10)

- `update_users_updated_at`
- `update_organizations_updated_at`
- `update_org_settings_updated_at`
- `update_tracking_settings_updated_at`
- `update_screenshots_updated_at`
- `trigger_calculate_duration`
- `update_user_jira_cache_cached_at`
- `trigger_update_unassigned_groups_updated_at`
- `trigger_auto_save_unassigned`

---

## Development vs Production Comparison

### Database Triggers

| Trigger | Dev | Prod | Notes |
|---------|-----|------|-------|
| `BRD Processing` | ✅ | ❌ | HTTP webhook - create manually |
| `on_screenshot_insert` | ✅ | ❌ | HTTP webhook - create manually |
| `trigger_auto_save_unassig...` | ✅ | ✅ | OK |
| `trigger_calculate_duration` | ✅ | ✅ | OK |
| Other triggers | ✅ | ✅ | OK |

### Database Functions

| Function | Dev | Prod | Notes |
|----------|-----|------|-------|
| `notify_screenshot_webhook` | ✅ | ❌ | Legacy - not needed (polling used) |
| `set_webhook_url` | ✅ | ❌ | Legacy - not needed |
| `get_current_user_organization_id()` | ✅ | ❌ | Add if RBAC needed |
| `user_has_permission` | ✅ | ❌ | Add if RBAC needed |
| `user_is_admin` | ✅ | ❌ | Add if RBAC needed |
| Core functions | ✅ | ✅ | OK |

---

## Checklist

### Completed ✅
- [x] Migration script created
- [x] SQL schema exported
- [x] PRODUCTION_SETUP.sql executed
- [x] Storage buckets created (via API)
- [x] Supabase CLI login
- [x] screenshot-webhook deployed
- [x] document-webhook deployed
- [x] AI_SERVER_URL secret set
- [x] AI_SERVER_API_KEY secret set

### Pending ⏳
- [ ] Deploy update-issues-cache edge function
- [ ] Create screenshot-insert-webhook in Dashboard
- [ ] Create document-insert-webhook in Dashboard
- [ ] Add missing RBAC functions (if needed)
- [ ] Test end-to-end screenshot upload flow
- [ ] Test end-to-end document upload flow

---

## Troubleshooting

### Common Issues

#### 1. Edge function deployment fails
```
Error: Cannot find project
```
**Solution:** Run from the project root directory containing `supabase/` folder:
```powershell
cd C:\ATG\jira3\JIRAForge
npx supabase functions deploy <function-name> --project-ref jbxabkazpuuphpsahlfh
```

#### 2. Secrets not working
**Solution:** Verify secrets are set:
```powershell
npx supabase secrets list --project-ref jbxabkazpuuphpsahlfh
```

#### 3. Webhook not triggering
**Check:**
1. Webhook enabled in Dashboard
2. Correct table selected
3. Correct event (INSERT) selected
4. Edge function deployed and active

---

## File References

| File | Purpose |
|------|---------|
| `supabase/migrate_to_production.py` | Migration script |
| `supabase/exports/PRODUCTION_SETUP.sql` | Complete SQL schema |
| `supabase/functions/screenshot-webhook/index.ts` | Screenshot processing function |
| `supabase/functions/document-webhook/index.ts` | Document processing function |
| `supabase/functions/update-issues-cache/index.ts` | Issues cache function |
| `ai-server/.env` | Contains AI_SERVER_API_KEY |
| `python-desktop-app/desktop_app.py` | Contains AI_SERVER_URL |

---

## Quick Reference Commands

```powershell
# Navigate to project
cd C:\ATG\jira3\JIRAForge

# Login to Supabase
npx supabase login

# Deploy all edge functions
npx supabase functions deploy screenshot-webhook --project-ref jbxabkazpuuphpsahlfh
npx supabase functions deploy document-webhook --project-ref jbxabkazpuuphpsahlfh
npx supabase functions deploy update-issues-cache --project-ref jbxabkazpuuphpsahlfh

# Set secrets
npx supabase secrets set AI_SERVER_URL=https://forgesync.amzur.com --project-ref jbxabkazpuuphpsahlfh
npx supabase secrets set AI_SERVER_API_KEY=21d9732ecec4f13e642617f141a19f684993159735900267bd1b9edb094a198d --project-ref jbxabkazpuuphpsahlfh

# List secrets
npx supabase secrets list --project-ref jbxabkazpuuphpsahlfh

# View function logs
npx supabase functions logs screenshot-webhook --project-ref jbxabkazpuuphpsahlfh
```

---

## Dashboard Links

| Resource | URL |
|----------|-----|
| Production Dashboard | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh |
| SQL Editor | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/sql/new |
| Database Webhooks | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/database/hooks |
| Database Functions | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/database/functions |
| Database Triggers | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/database/triggers |
| Edge Functions | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/functions |
| Storage | https://supabase.com/dashboard/project/jbxabkazpuuphpsahlfh/storage/buckets |

---

*Last Updated: January 25, 2026*
