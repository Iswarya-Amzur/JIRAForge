# Multi-Tenancy Quick Start Guide

## TL;DR - What Changed

### Before Multi-Tenancy:
- Users are isolated individuals
- No team features
- No organization concept
- Data filtered by `user_id` only

### After Multi-Tenancy:
- Users belong to organizations (Jira instances)
- Team analytics for admins
- Organization-specific settings
- Data filtered by `user_id` + `organization_id`

---

## 🚀 Quick Implementation Steps

### 1. Run Database Migrations (15 minutes)

```bash
cd C:\Users\VishnuK\Desktop\jira1\supabase\migrations

# Run in order:
# 010_create_organizations_tables.sql
# 011_add_organization_id_columns.sql
# 012_migrate_existing_data.sql
# 013_create_rls_policies.sql
# 014_update_views_for_multi_tenancy.sql
# 015_enforce_constraints.sql
```

**Verify:**
```sql
SELECT COUNT(*) FROM organizations;  -- Should return 1 (legacy org)
SELECT COUNT(*) FROM users WHERE organization_id IS NOT NULL;  -- All users
```

---

### 2. Update Desktop App (30 minutes)

**Key changes in `desktop_app.py`:**

**A. After OAuth, register organization:**
```python
# Line ~543 - Update get_jira_cloud_id()
selected_resource = resources[0]  # User picked during OAuth
self.jira_cloud_id = selected_resource['id']
self.organization_name = selected_resource['name']
self.register_organization_in_database()  # NEW METHOD
```

**B. Add organization registration:**
```python
def register_organization_in_database(self):
    """Create/update organization in Supabase"""
    org_data = {
        'jira_cloud_id': self.jira_cloud_id,
        'org_name': self.organization_name,
        'jira_instance_url': self.jira_instance_url
    }

    response = self.supabase.table('organizations').upsert(
        org_data,
        on_conflict='jira_cloud_id'
    ).execute()

    self.organization_id = response.data[0]['id']
```

**C. Update screenshot upload:**
```python
# Line ~780 - Add organization_id
screenshot_data = {
    'user_id': self.current_user_id,
    'organization_id': self.organization_id,  # ← ADD THIS
    'timestamp': timestamp.isoformat(),
    'storage_path': storage_path,
    # ... rest
}
```

---

### 3. Update Forge App (20 minutes)

**Key changes in resolvers:**

**A. Extract cloudId from context:**
```javascript
// In ANY resolver
async function myResolver(req) {
  const { accountId, cloudId } = req.context;  // ← ADD cloudId

  // Get/create organization
  const org = await getOrCreateOrganization(cloudId);

  // Get user with org link
  const userId = await getOrCreateUser(accountId, org.id);

  // Query with org filter
  const data = await supabase
    .from('screenshots')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', org.id);  // ← ADD THIS
}
```

**B. Add helper function in `userService.js`:**
```javascript
export async function getOrCreateOrganization(cloudId) {
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('jira_cloud_id', cloudId)
    .single();

  if (org) return org;

  // Create new org
  const { data: newOrg } = await supabase
    .from('organizations')
    .insert({ jira_cloud_id: cloudId, org_name: 'New Org' })
    .select()
    .single();

  return newOrg;
}
```

**C. Update ALL resolver files:**
- `analyticsResolvers.js`
- `screenshotResolvers.js`
- `worklogResolvers.js`
- `unassignedWorkResolvers.js`
- `brdResolvers.js`

---

### 4. Update AI Server (15 minutes)

**Key changes in `screenshot-controller.js`:**

**A. Add organization_id to webhook handler:**
```javascript
async function analyzeScreenshot(req, res) {
  const { screenshot_id, organization_id } = req.body;  // ← ADD

  // Fetch org settings
  const orgSettings = await getOrgSettings(organization_id);

  // Analyze with org-specific rules
  const analysis = await analyzeWithOrgSettings(screenshot, orgSettings);

  // Save with organization_id
  await supabase.from('analysis_results').insert({
    screenshot_id,
    organization_id,  // ← ADD
    work_type: analysis.workType,
    // ... rest
  });
}
```

**B. Update Supabase webhook trigger:**
```sql
-- Include organization_id in webhook payload
CREATE TRIGGER screenshot_webhook
AFTER INSERT ON screenshots
FOR EACH ROW
EXECUTE FUNCTION trigger_webhook(
  NEW.id,
  NEW.user_id,
  NEW.organization_id  -- ← ADD
);
```

---

## 📊 Data Flow Summary

### Desktop App Flow:
```
1. User logs in via OAuth
   └─ User selects Jira site during OAuth

2. App calls accessible-resources API
   └─ Gets cloudId for selected site

3. App registers organization in database
   └─ Creates/updates organizations table

4. App uploads screenshots
   └─ Includes organization_id in metadata

5. AI analyzes screenshots
   └─ Saves analysis with organization_id
```

### Forge App Flow:
```
1. User opens Jira in browser
   └─ Already on specific Jira site

2. Forge app loads
   └─ Gets cloudId from req.context

3. App finds/creates organization
   └─ Queries organizations table

4. App shows dashboard
   └─ Filters data by organization_id
```

---

## 🔒 Security (RLS) Quick Check

**Test RLS is working:**

```sql
-- Try to access another org's data
SELECT COUNT(*) FROM screenshots
WHERE organization_id != get_current_user_organization_id();

-- Should return 0 (RLS blocks it)
```

**If returns > 0, RLS is NOT working!**

Fix:
```sql
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
```

---

## ✅ Testing Checklist

### Desktop App:
- [ ] OAuth completes successfully
- [ ] Organization registered in database
- [ ] Screenshots include organization_id
- [ ] Can see screenshots in Supabase

### Forge App:
- [ ] Dashboard loads
- [ ] Shows only user's data
- [ ] cloudId extracted from context
- [ ] Organization exists in database

### AI Server:
- [ ] Webhook receives organization_id
- [ ] Analysis includes organization_id
- [ ] Results saved to database

### End-to-End:
- [ ] Desktop uploads screenshot
- [ ] AI analyzes screenshot
- [ ] Forge shows screenshot in dashboard
- [ ] Data isolated by organization

---

## 🐛 Common Issues & Fixes

### Issue 1: "organization_id cannot be null"

**Cause:** Constraint enforced before data migrated

**Fix:**
```sql
-- Temporarily allow NULL
ALTER TABLE screenshots ALTER COLUMN organization_id DROP NOT NULL;

-- Migrate data
UPDATE screenshots s
SET organization_id = u.organization_id
FROM users u
WHERE s.user_id = u.id;

-- Re-enforce constraint
ALTER TABLE screenshots ALTER COLUMN organization_id SET NOT NULL;
```

### Issue 2: Desktop app error "No organization ID"

**Cause:** OAuth didn't register organization

**Fix:** Check `get_jira_cloud_id()` method:
```python
# Ensure this is called after OAuth
self.get_jira_cloud_id()
self.register_organization_in_database()
```

### Issue 3: Forge app shows no data

**Cause:** Not filtering by organization_id

**Fix:** Add to all queries:
```javascript
.eq('organization_id', organization.id)
```

### Issue 4: RLS blocking legitimate access

**Cause:** User not linked to organization

**Fix:**
```sql
-- Check user's organization
SELECT id, organization_id FROM users WHERE atlassian_account_id = 'xxx';

-- Update if NULL
UPDATE users SET organization_id = 'xxx' WHERE id = 'yyy';
```

---

## 📁 File Locations

### Database Migrations:
```
supabase/migrations/
├── 010_create_organizations_tables.sql
├── 011_add_organization_id_columns.sql
├── 012_migrate_existing_data.sql
├── 013_create_rls_policies.sql
├── 014_update_views_for_multi_tenancy.sql
└── 015_enforce_constraints.sql
```

### Desktop App Changes:
```
python-desktop-app/desktop_app.py
├── get_jira_cloud_id() - Line ~510
├── register_organization_in_database() - NEW
├── ensure_user_exists() - Line ~650
└── upload_screenshot() - Line ~780
```

### Forge App Changes:
```
forge-app/src/
├── services/userService.js - Add getOrCreateOrganization()
├── resolvers/analyticsResolvers.js - Add org filtering
├── resolvers/screenshotResolvers.js - Add org filtering
└── ... (all resolvers)
```

### AI Server Changes:
```
ai-server/src/
├── controllers/screenshot-controller.js
├── services/clustering-service.js
└── (update webhook payloads)
```

---

## 🎯 Key Takeaways

1. **OAuth already handles site selection** - User picks during authorization
2. **Just call accessible-resources** - To get cloudId
3. **Always filter by organization_id** - In every query
4. **RLS enforces isolation** - Database-level security
5. **Forge gets cloudId for free** - In req.context

---

## 📚 Full Documentation

For detailed information, see:
- `OAUTH_FLOW_CORRECTED.md` - OAuth flow details
- `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation
- `MULTI_TENANCY_DATABASE_ARCHITECTURE.md` - Database schema
- `MULTI_TENANCY_MIGRATION_PLAN.md` - Migration scripts
- `MULTI_TENANCY_SIMPLE_EXPLANATION.md` - Concepts explained

---

## 🚀 Ready to Implement?

**Next step:** Run database migrations!

```bash
cd supabase/migrations
# Run migration scripts in order
```

**Questions?** Review the full implementation guide or ask for help!
