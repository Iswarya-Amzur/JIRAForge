# Multi-Tenancy Implementation Summary

## Overview

This document provides a complete summary of the multi-tenancy implementation, corrected based on the understanding that **Atlassian OAuth already handles site selection**.

---

## What We Learned

### Initial Misunderstanding:
❌ "OAuth doesn't show site selector, we need to build custom UI"

### Corrected Understanding:
✅ **OAuth DOES show site selector where user picks their Jira instance**

**Impact:** Implementation is **simpler** than originally planned!

---

## Architecture Changes

### Database Layer

**New Tables (3):**
1. `organizations` - Tenant root (stores Jira instances)
2. `organization_members` - User roles and permissions
3. `organization_settings` - Per-organization configuration

**Updated Tables (10):**
All data tables now have `organization_id` column:
- users
- screenshots
- analysis_results
- documents
- worklogs
- activity_log
- unassigned_activity
- unassigned_work_groups
- user_jira_issues_cache
- created_issues_log

**New Security (RLS):**
- Row Level Security on all tables
- Users can only access their organization's data
- Helper functions for permission checks

**Updated Views (5 + 1 new):**
- daily_time_summary (updated)
- weekly_time_summary (updated)
- monthly_time_summary (updated)
- project_time_summary (updated)
- unassigned_activity_summary (updated)
- team_analytics_summary (NEW - for admins)

---

## Application Changes

### Desktop App (Python)

**Key Changes:**

1. **Organization Registration:**
   ```python
   # After OAuth completes
   resources = get_accessible_resources()
   selected_site = resources[0]  # User already picked during OAuth

   # Register in database
   register_organization({
       'jira_cloud_id': selected_site['id'],
       'org_name': selected_site['name'],
       'jira_instance_url': selected_site['url']
   })
   ```

2. **Screenshot Upload:**
   ```python
   # Include organization_id
   screenshot_data = {
       'user_id': user_id,
       'organization_id': organization_id,  # ← NEW
       'timestamp': ...,
       'storage_path': ...
   }
   ```

3. **User Registration:**
   ```python
   # Link user to organization
   user_data = {
       'atlassian_account_id': account_id,
       'organization_id': organization_id,  # ← NEW
       'email': email,
       'display_name': name
   }
   ```

**Files Changed:**
- `desktop_app.py` - Lines ~510-551, ~650, ~780

---

### Forge App (JavaScript/React)

**Key Changes:**

1. **Extract cloudId from Context:**
   ```javascript
   async function myResolver(req) {
       const { accountId, cloudId } = req.context;  // ← Extract cloudId

       const org = await getOrCreateOrganization(cloudId);
       const userId = await getOrCreateUser(accountId, org.id);

       // Filter by organization
       const data = await query()
           .eq('user_id', userId)
           .eq('organization_id', org.id);  // ← Filter
   }
   ```

2. **Organization Helper:**
   ```javascript
   async function getOrCreateOrganization(cloudId) {
       // Check if exists
       let org = await supabase
           .from('organizations')
           .select('*')
           .eq('jira_cloud_id', cloudId)
           .single();

       if (!org) {
           // Create new
           org = await supabase
               .from('organizations')
               .insert({ jira_cloud_id: cloudId, ... })
               .single();
       }

       return org;
   }
   ```

3. **All Queries Updated:**
   - Every Supabase query now includes `.eq('organization_id', org.id)`
   - Ensures data isolation

**Files Changed:**
- `src/services/userService.js` - Add organization helpers
- `src/resolvers/*.js` - ALL resolver files (10+)

---

### AI Server (Node.js)

**Key Changes:**

1. **Webhook Handler:**
   ```javascript
   async function analyzeScreenshot(req, res) {
       const { screenshot_id, organization_id } = req.body;  // ← Receive org_id

       // Fetch org settings
       const orgSettings = await getOrgSettings(organization_id);

       // Analyze with org-specific rules
       const analysis = await analyzeWithOrgSettings(screenshot, orgSettings);

       // Save with org_id
       await saveAnalysis({
           screenshot_id,
           organization_id,  // ← Include in save
           work_type: analysis.workType,
           ...
       });
   }
   ```

2. **Organization Settings:**
   ```javascript
   async function getOrgSettings(organizationId) {
       const settings = await supabase
           .from('organization_settings')
           .select('*')
           .eq('organization_id', organizationId)
           .single();

       return settings || DEFAULT_SETTINGS;
   }
   ```

3. **Clustering Service:**
   ```javascript
   // Filter unassigned work by organization
   const sessions = await supabase
       .from('unassigned_activity')
       .select('*')
       .eq('user_id', userId)
       .eq('organization_id', organizationId);  // ← Filter
   ```

**Files Changed:**
- `src/controllers/screenshot-controller.js`
- `src/services/clustering-service.js`
- Webhook trigger SQL

---

## Data Flow (Before vs After)

### Before Multi-Tenancy:

```
Desktop App → Upload Screenshot
    ↓
    {
        user_id: "user-123",
        timestamp: "...",
        storage_path: "..."
    }
    ↓
Supabase → Save with user_id only
    ↓
AI Server → Analyze
    ↓
    {
        screenshot_id: "...",
        user_id: "user-123",
        work_type: "office"
    }
    ↓
Forge App → Query by user_id only
    ↓
    SELECT * FROM screenshots WHERE user_id = 'user-123'
```

### After Multi-Tenancy:

```
Desktop App → Register Organization (OAuth)
    ↓
    {
        jira_cloud_id: "abc-123-xyz",
        org_name: "Acme Corp",
        jira_instance_url: "acme.atlassian.net"
    }
    ↓
Desktop App → Upload Screenshot
    ↓
    {
        user_id: "user-123",
        organization_id: "org-456",  ← NEW
        timestamp: "...",
        storage_path: "..."
    }
    ↓
Supabase → Save with user_id AND organization_id
    ↓
AI Server → Analyze with Org Settings
    ↓
    {
        screenshot_id: "...",
        user_id: "user-123",
        organization_id: "org-456",  ← NEW
        work_type: "office"
    }
    ↓
Forge App → Query by user_id AND organization_id
    ↓
    SELECT * FROM screenshots
    WHERE user_id = 'user-123'
    AND organization_id = 'org-456'  ← NEW

    (RLS also enforces this at database level)
```

---

## Security Model

### Row Level Security (RLS)

**Every table has policies like:**

```sql
-- Users can only see their organization's data
CREATE POLICY "org_isolation"
ON screenshots FOR SELECT
USING (
    organization_id = get_current_user_organization_id()
    AND (
        user_id = get_current_user_id()  -- Own data
        OR user_has_permission('view_team_analytics')  -- OR admin
    )
);
```

**Benefits:**
- ✅ Database enforces isolation (can't be bypassed)
- ✅ Even if application code has bugs, data is protected
- ✅ Users cannot access other organizations' data
- ✅ Admins can see team data within their organization

---

## Migration Strategy

### Phase 1: Create Tables
- Add organizations, organization_members, organization_settings

### Phase 2: Add Columns
- Add organization_id to all data tables (nullable initially)

### Phase 3: Migrate Data
- Create "legacy" organization
- Assign all existing users to legacy org
- Populate organization_id in all tables

### Phase 4: Enable Security
- Create RLS policies
- Add helper functions
- Enable RLS on all tables

### Phase 5: Update Views
- Add organization_id to all views
- Create team analytics view

### Phase 6: Enforce Constraints
- Make organization_id NOT NULL
- Verify no orphaned records

**Result:** Backward compatible migration with zero downtime!

---

## Key Features Enabled

### 1. Team Analytics (NEW)

Admins can now see:
- Total team hours
- Active users
- Project workload distribution
- Team productivity metrics

**Query:**
```sql
SELECT * FROM team_analytics_summary
WHERE organization_id = 'current-org'
ORDER BY work_date DESC;
```

### 2. Organization Settings (NEW)

Each organization can configure:
- Screenshot interval
- Auto-worklog creation
- Application whitelist/blacklist
- Private sites exclusion
- Non-work threshold

**Storage:**
```sql
SELECT * FROM organization_settings
WHERE organization_id = 'org-id';
```

### 3. Role-Based Access Control (NEW)

Users have roles within organizations:
- **Owner:** Full control
- **Admin:** Manage settings, view team data
- **Manager:** View team analytics only
- **Member:** View personal data only

**Check:**
```sql
SELECT role FROM organization_members
WHERE user_id = 'user-id'
AND organization_id = 'org-id';
```

### 4. Complete Data Isolation (NEW)

Each organization's data is completely isolated:
- Screenshots
- Analysis results
- Documents
- Worklogs
- Unassigned work

**Enforced by:** RLS policies + application-level filtering

---

## Performance Optimizations

### Indexes Added

**Organization lookups:**
```sql
CREATE INDEX idx_organizations_cloud_id ON organizations(jira_cloud_id);
```

**User queries:**
```sql
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_org_active ON users(organization_id, is_active);
```

**Data queries:**
```sql
CREATE INDEX idx_screenshots_org_id ON screenshots(organization_id);
CREATE INDEX idx_screenshots_org_user_date ON screenshots(
    organization_id, user_id, timestamp DESC
);
```

**Analysis queries:**
```sql
CREATE INDEX idx_analysis_results_org_id ON analysis_results(organization_id);
CREATE INDEX idx_analysis_results_org_work_type ON analysis_results(
    organization_id, work_type
) WHERE work_type = 'office';
```

**Result:** Fast queries even with millions of rows across multiple organizations!

---

## Testing Coverage

### Unit Tests
- [ ] Organization registration
- [ ] User-organization linking
- [ ] RLS policy enforcement
- [ ] Permission checking

### Integration Tests
- [ ] Desktop app OAuth flow
- [ ] Screenshot upload with org_id
- [ ] AI analysis with org settings
- [ ] Forge app data filtering

### End-to-End Tests
- [ ] Complete workflow (desktop → AI → Forge)
- [ ] User with single organization
- [ ] User with multiple organizations
- [ ] Admin viewing team data
- [ ] Data isolation verification

---

## Deployment Plan

### Stage 1: Database (Development)
```bash
# Run on development database first
psql dev_db < 010_create_organizations_tables.sql
psql dev_db < 011_add_organization_id_columns.sql
# ... etc
```

### Stage 2: Application Code (Development)
```bash
# Deploy desktop app updates
# Deploy Forge app updates
# Deploy AI server updates
```

### Stage 3: Testing (Development)
```bash
# Run test suite
npm test

# Manual testing
# - Test OAuth flow
# - Test screenshot upload
# - Test Forge dashboard
```

### Stage 4: Production Database
```bash
# Backup first!
pg_dump production_db > backup.sql

# Run migrations
psql production_db < migrations/*.sql

# Verify
psql production_db -c "SELECT COUNT(*) FROM organizations;"
```

### Stage 5: Production Application
```bash
# Deploy with zero downtime
# - Deploy AI server (new version)
# - Deploy Forge app (forge deploy)
# - Release desktop app (new installer)
```

---

## Rollback Plan

If issues occur:

**Level 1: Disable RLS**
```sql
ALTER TABLE screenshots DISABLE ROW LEVEL SECURITY;
-- Continue working without RLS temporarily
```

**Level 2: Revert to Legacy Org**
```sql
UPDATE screenshots SET organization_id = (
    SELECT id FROM organizations WHERE jira_cloud_id = 'legacy-migration-org'
);
```

**Level 3: Full Rollback**
```bash
# Restore from backup
psql production_db < backup.sql

# Revert application code
git revert <commit-hash>
```

---

## Documentation Created

### For Developers:
1. **OAUTH_FLOW_CORRECTED.md** - OAuth flow explained
2. **IMPLEMENTATION_GUIDE.md** - Step-by-step implementation
3. **MULTI_TENANCY_DATABASE_ARCHITECTURE.md** - Database schema
4. **MULTI_TENANCY_MIGRATION_PLAN.md** - Migration scripts

### For Understanding:
5. **MULTI_TENANCY_SIMPLE_EXPLANATION.md** - Concepts explained simply
6. **QUICK_START_MULTI_TENANCY.md** - Quick reference
7. **IMPLEMENTATION_SUMMARY.md** - This document

### Total: 7 comprehensive documents covering all aspects!

---

## Estimated Timeline

### Database Migration: 2-4 hours
- Write/test migration scripts: 1 hour
- Run on development: 30 min
- Test and verify: 1 hour
- Run on production: 30 min
- Verify and monitor: 1 hour

### Desktop App Updates: 4-6 hours
- Code changes: 2 hours
- Testing: 2 hours
- Build and release: 2 hours

### Forge App Updates: 3-4 hours
- Code changes: 2 hours
- Testing: 1 hour
- Deploy: 30 min

### AI Server Updates: 2-3 hours
- Code changes: 1 hour
- Testing: 1 hour
- Deploy: 30 min

### Total: 11-17 hours (1-2 days of focused work)

---

## Success Metrics

### Immediate (Day 1):
- ✅ All migrations complete
- ✅ No errors in logs
- ✅ Existing users can log in
- ✅ Screenshots uploading

### Short-term (Week 1):
- ✅ New users registering correctly
- ✅ Organizations created automatically
- ✅ Data properly isolated
- ✅ RLS working correctly

### Long-term (Month 1):
- ✅ Multiple organizations using app
- ✅ Team analytics being used
- ✅ No data leaks between orgs
- ✅ Performance remains good

---

## Key Contacts & Resources

### Atlassian Documentation:
- OAuth 3LO: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- Accessible Resources API: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/#3--accessing-resources

### Supabase Documentation:
- RLS: https://supabase.com/docs/guides/auth/row-level-security
- Multi-tenancy: https://supabase.com/docs/guides/database/row-level-security#multi-tenancy

### Internal Documentation:
- All files in `docs/` folder
- Migration scripts in `supabase/migrations/`

---

## Summary

**What Changed:**
- Database: 3 new tables, 10 updated tables, RLS on all tables
- Desktop App: Organization registration, org_id in uploads
- Forge App: Extract cloudId, filter by org_id
- AI Server: Org-aware analysis, org-specific settings

**Why It's Better:**
- ✅ True multi-tenancy support
- ✅ Team analytics for admins
- ✅ Organization-specific settings
- ✅ Complete data isolation
- ✅ Database-level security (RLS)

**Key Insight:**
- OAuth already handles site selection!
- No need for custom selector UI
- Implementation simpler than expected

**Ready to implement!** 🚀

All documentation is in the `docs/` folder. Start with `QUICK_START_MULTI_TENANCY.md` for immediate action items!






 🏗️ Core Structure

  TENANT HIERARCHY:

  organizations (Tenant Root)
      ├── jira_cloud_id (Unique ID from Atlassian)
      ├── org_name
      └── subscription_tier
           │
           ├─── users (belongs to org)
           │     ├── organization_id (FK)
           │     └── atlassian_account_id
           │          │
           │          └─── organization_members (roles & permissions)
           │                ├── role (owner, admin, manager, member)
           │                └── permissions (can_manage_settings, etc.)
           │
           ├─── organization_settings (org-specific config)
           │     ├── screenshot_interval
           │     ├── application_whitelist[]
           │     └── application_blacklist[]
           │
           └─── ALL DATA TABLES (org-isolated)
                ├── screenshots (organization_id)
                ├── analysis_results (organization_id)
                ├── documents (organization_id)
                ├── worklogs (organization_id)
                └── unassigned_activity (organization_id)









📱 WHAT HAPPENS WHEN USERS LOG IN

  Let me walk you through both scenarios:

  ---
  Scenario 1: User Logs Into JIRA APP (Forge App)

  ┌─────────────────────────────────────────────────────────────┐
  │  USER: John from Acme Corp                                  │
  │  Opens Jira in browser: acme-corp.atlassian.net            │
  └─────────────────────────────────────────────────────────────┘

  STEP 1: User Opens Jira
  ├─ John opens his Jira workspace in Chrome
  ├─ URL: https://acme-corp.atlassian.net
  └─ He sees his Jira projects

  STEP 2: User Clicks "BRD & Time Tracker" Tab
  ├─ Your Forge app loads inside Jira
  ├─ Forge automatically gives you:
  │   ├─ accountId: "john-account-123"
  │   └─ cloudId: "abc-123-xyz"  ← This is the company identifier
  └─ No login needed - Jira already authenticated him

  STEP 3: Your App Checks Database
  ├─ Query: "Does organization with cloudId = 'abc-123-xyz' exist?"
  ├─ If YES: Load John's data from that organization
  ├─ If NO: Create new organization entry:
  │   {
  │     jira_cloud_id: "abc-123-xyz",
  │     org_name: "Acme Corp",
  │     jira_instance_url: "acme-corp.atlassian.net"
  │   }
  └─ Link John to this organization

  STEP 4: Show John His Dashboard
  ├─ Query database:
  │   SELECT * FROM screenshots
  │   WHERE user_id = John's ID
  │   AND organization_id = Acme Corp's ID
  ├─ Database ALSO checks (via RLS):
  │   "Does John belong to this organization?"
  └─ Result: John sees only Acme Corp's data

  STEP 5: If John is Admin
  ├─ Show extra button: "View Team Analytics"
  ├─ Query:
  │   SELECT * FROM screenshots
  │   WHERE organization_id = Acme Corp's ID
  │   (all users, not just John)
  ├─ Result: John sees his whole team's time tracking

  Simple Version:
  1. John opens Jira → Your app gets his company's Cloud ID automatically
  2. You check: "Does this company exist in database?" If not, create it.
  3. You show John only his company's data
  4. If he's admin, he can see his whole team's data

  ---
  Scenario 2: User Logs Into DESKTOP APP (Python App)

  ┌─────────────────────────────────────────────────────────────┐
  │  USER: Sarah from Tech Startup                              │
  │  Downloads and installs desktop app                         │
  └─────────────────────────────────────────────────────────────┘

  STEP 1: User Launches Desktop App
  ├─ Sarah runs the .exe file
  ├─ App shows: "Welcome! Click 'Login with Atlassian'"
  └─ She clicks the button

  STEP 2: OAuth Login
  ├─ Browser opens: https://auth.atlassian.com/authorize
  ├─ Sarah logs in with her Atlassian account
  ├─ Atlassian asks: "Allow BRD Time Tracker to access your Jira?"
  └─ Sarah clicks "Allow"

  STEP 3: Get Access Token
  ├─ Desktop app receives: access_token
  ├─ App calls Atlassian API:
  │   GET https://api.atlassian.com/oauth/token/accessible-resources
  │   Headers: { Authorization: "Bearer <access_token>" }
  └─ Atlassian responds:
      [
        {
          "id": "def-456-uvw",  ← Cloud ID
          "name": "Tech Startup",
          "url": "https://tech-startup.atlassian.net"
        }
      ]

  STEP 4: Organization Selection
  ├─ If Sarah has access to MULTIPLE Jira workspaces:
  │   ┌───────────────────────────────────────┐
  │   │ Select Your Organization:             │
  │   │ 1. Tech Startup (work account)        │
  │   │ 2. Personal Projects (personal)       │
  │   │ Enter choice: _                       │
  │   └───────────────────────────────────────┘
  │   Sarah types: 1
  │
  ├─ If Sarah has access to ONLY ONE workspace:
  │   Automatically select it (no prompt)
  │
  └─ Store locally:
      {
        "jira_cloud_id": "def-456-uvw",
        "organization_name": "Tech Startup",
        "organization_id": "<database-uuid>"
      }

  STEP 5: Register Organization (if new)
  ├─ Desktop app calls your Supabase API:
  │   POST /organizations
  │   {
  │     "jira_cloud_id": "def-456-uvw",
  │     "org_name": "Tech Startup",
  │     "jira_instance_url": "tech-startup.atlassian.net"
  │   }
  ├─ Database checks: "Does this cloudId already exist?"
  │   ├─ YES: Return existing organization
  │   └─ NO: Create new organization
  └─ Return organization_id to desktop app

  STEP 6: Link User to Organization
  ├─ Desktop app creates/updates user record:
  │   {
  │     "atlassian_account_id": "sarah-account-456",
  │     "organization_id": "<org-uuid>",
  │     "email": "sarah@techstartup.com",
  │     "display_name": "Sarah Johnson"
  │   }
  └─ User is now linked to "Tech Startup" organization

  STEP 7: Start Tracking
  ├─ Every 5 minutes, app captures screenshot
  ├─ Uploads to Supabase:
  │   {
  │     "user_id": Sarah's ID,
  │     "organization_id": Tech Startup's ID,  ← CRITICAL!
  │     "screenshot": <image-data>,
  │     "window_title": "VS Code - main.py"
  │   }
  └─ Database saves with organization_id attached

  STEP 8: AI Analysis
  ├─ AI server receives webhook with organization_id
  ├─ Fetches organization settings:
  │   SELECT * FROM organization_settings
  │   WHERE organization_id = Tech Startup's ID
  ├─ Applies Tech Startup's rules:
  │   ├─ Whitelist: ['vscode.exe', 'chrome.exe']
  │   └─ Blacklist: ['spotify.exe', 'netflix.com']
  └─ Analyzes screenshot with company-specific rules

  Simple Version:
  1. Sarah logs in via Atlassian OAuth
  2. App asks Atlassian: "Which Jira workspaces can Sarah access?"
  3. Sarah picks: "Tech Startup" (her work account)
  4. App stores: Sarah belongs to "Tech Startup" organization
  5. From now on, all her screenshots include organization_id
  6. AI uses Tech Startup's settings (whitelist/blacklist)

  ---
  🔒 HOW DATA ISOLATION WORKS

  Let's say Sarah (Tech Startup) and John (Acme Corp) both use your app:

  DATABASE TABLE: screenshots
  ┌─────────────┬──────────────┬──────────────────┬─────────────────┐
  │ screenshot  │ user_id      │ organization_id  │ window_title    │
  ├─────────────┼──────────────┼──────────────────┼─────────────────┤
  │ img_001.png │ john-id      │ acme-corp-id     │ "Jira - Issue"  │
  │ img_002.png │ sarah-id     │ tech-startup-id  │ "VS Code"       │
  │ img_003.png │ john-id      │ acme-corp-id     │ "Slack"         │
  │ img_004.png │ sarah-id     │ tech-startup-id  │ "GitHub"        │
  └─────────────┴──────────────┴──────────────────┴─────────────────┘

  When John queries:
  ├─ SELECT * FROM screenshots WHERE organization_id = 'acme-corp-id'
  ├─ Database RLS checks: "Does John belong to acme-corp-id?" → YES
  └─ Returns: img_001.png, img_003.png

  When Sarah queries:
  ├─ SELECT * FROM screenshots WHERE organization_id = 'tech-startup-id'
  ├─ Database RLS checks: "Does Sarah belong to tech-startup-id?" → YES
  └─ Returns: img_002.png, img_004.png

  When Sarah tries to hack (manually query Acme Corp's data):
  ├─ SELECT * FROM screenshots WHERE organization_id = 'acme-corp-id'
  ├─ Database RLS checks: "Does Sarah belong to acme-corp-id?" → NO
  └─ Returns: NOTHING (blocked by database)

  Simple Version:
  - Every screenshot, analysis, document has organization_id
  - Database automatically filters: "Show only data from user's company"
  - Even if your app code has a bug, database prevents data leaks

  ---
  👥 TEAM FEATURES

  Regular User (Member)

  Sarah (Member at Tech Startup)
  ├─ Can see: Her own screenshots
  ├─ Can see: Her own time analytics
  ├─ Cannot see: Other team members' screenshots
  └─ Cannot change: Organization settings

  Admin User

  Mike (Admin at Tech Startup)
  ├─ Can see: ALL team members' screenshots
  ├─ Can see: Team analytics dashboard
  │   ├─ Total team hours this week
  │   ├─ Who worked on which projects
  │   └─ Productivity metrics
  ├─ Can manage: Organization settings
  │   ├─ Change screenshot interval
  │   ├─ Set whitelist/blacklist apps
  │   └─ Add/remove team members
  └─ Cannot see: Data from other companies (Acme Corp, etc.)

  ---
  ⚙️ ORGANIZATION SETTINGS

  Each company configures their own rules:

  Acme Corp Settings:
  ├─ Screenshot interval: 5 minutes
  ├─ Whitelist (always track): ['jira.com', 'vscode.exe', 'slack.exe']
  ├─ Blacklist (never track): ['facebook.com', 'netflix.com']
  └─ Private sites (don't capture): ['bankofamerica.com', 'personalmail.com']

  Tech Startup Settings:
  ├─ Screenshot interval: 10 minutes
  ├─ Whitelist: ['figma.com', 'github.com', 'notion.so']
  ├─ Blacklist: ['twitter.com', 'reddit.com']
  └─ Private sites: ['wellsfargo.com']

  When AI analyzes screenshots, it uses the company's settings, not global settings.

  ---
  🔑 THE MAGIC: jira_cloud_id

  What is jira_cloud_id?
  ├─ It's a unique identifier for each Jira workspace
  ├─ Format: "abc-123-xyz-789-def"
  ├─ Provided by Atlassian
  └─ Never changes (even if company renames their workspace)

  Examples:
  ├─ Acme Corp → jira_cloud_id: "abc-123"
  ├─ Tech Startup → jira_cloud_id: "def-456"
  └─ Enterprise Inc → jira_cloud_id: "ghi-789"

  This becomes your "tenant key" - the way you separate companies.

  ---
  📊 DATABASE STRUCTURE (SIMPLIFIED)

  organizations (The Companies)
  ├─ id: uuid-1234
  ├─ jira_cloud_id: "abc-123"
  └─ org_name: "Acme Corp"
       │
       ├─── users (People in the company)
       │    ├─ user-john: organization_id = uuid-1234
       │    └─ user-jane: organization_id = uuid-1234
       │
       ├─── screenshots (All screenshots)
       │    ├─ screenshot-1: organization_id = uuid-1234, user_id = user-john
       │    └─ screenshot-2: organization_id = uuid-1234, user_id = user-jane
       │
       └─── organization_settings (Company rules)
            └─ settings for uuid-1234:
                ├─ whitelist: ['jira.com']
                └─ blacklist: ['facebook.com']

  Every row in every table has organization_id pointing to the company.







   ✅ CORRECTED: OAuth Flow DOES Include Site Selection

  What I See in Your Screenshot:

  ┌─────────────────────────────────────────────────────────────┐
  │ BRD Time Tracker Desktop App is requesting access to your   │
  │ Atlassian account.                                          │
  │                                                             │
  │ Use app on *                                                │
  │ ┌─────────────────────────────────────┐                    │
  │ │ Choose a site                    ▼  │                    │
  │ └─────────────────────────────────────┘                    │
  │   ├─ amzur-team-pq9sjopg.atlassian.net                     │
  │   └─ amzur.atlassian.net                                   │
  │                                                             │
  │ Update                                                      │
  │   › jira-work                                               │
  │                                                             │
  │ In User, it would like to:                                 │
  │ View                                                        │
  │   › me                                                      │
  └─────────────────────────────────────────────────────────────┘

  ---
  So What Does This Mean?

  ✅ Good News:

  1. Atlassian OAuth DOES show a site selector during authorization
  2. The user picks their Jira site during the OAuth flow
  3. The selected site determines which cloudId the access token is valid for

  🤔 But There's a Catch:

  The OAuth flow lets user pick ONE site at authorization time, but:

  1. After authorization, you still need to call accessible-resources to get the cloudId
  2. The token response still doesn't include cloudId directly
  3. If user wants to switch organizations, they need to re-authorize

  ---
  Updated Understanding:

  Desktop App OAuth Flow (CORRECTED):

  Step 1: User clicks "Login with Atlassian"
      ↓
  Step 2: Atlassian shows login page (email + password)
      ↓
  Step 3: ✅ ATLASSIAN SHOWS SITE SELECTOR
          User picks: "amzur-team-pq9sjopg.atlassian.net"
      ↓
  Step 4: Atlassian shows permissions (Allow/Deny)
      ↓
  Step 5: User clicks "Accept"
      ↓
  Step 6: Redirect back with authorization code
      ↓
  Step 7: You exchange code for access_token
      ↓
  Step 8: You call accessible-resources API
          Returns: [
            {
              "id": "cloudId-for-amzur-team",  ← The site they selected
              "url": "https://amzur-team-pq9sjopg.atlassian.net",
              ...
            }
          ]
      ↓
  Step 9: You get the cloudId for the selected site

  ---
  Key Insight:

  Your screenshot shows that during OAuth, the user is prompted with:

  **"Use app on "* with a dropdown to "Choose a site"

  This means:
  - ✅ User picks their Jira site during authorization
  - ✅ Access token is scoped to that specific site
  - ✅ When you call accessible-resources, you'll get that site's cloudId

  ---
  But Why Do You Still Need accessible-resources API?

  Even though user picks a site during OAuth, you still need to call the API because:

  1. Token response doesn't include cloudId - You only get access_token, refresh_token, expires_in
  2. You need the cloudId to make Jira API calls
  3. User might have access to multiple sites - The API returns all sites they can access

  ---
  What If User Has Multiple Sites?

  Looking at your screenshot, the dropdown shows:
  - amzur-team-pq9sjopg.atlassian.net
  - amzur.atlassian.net

  Two scenarios:

  Scenario A: User Picks ONE Site During OAuth

  1. User logs in
  2. User selects "amzur-team-pq9sjopg.atlassian.net"
  3. Access token is granted for THAT site only
  4. accessible-resources API returns only THAT site
  5. You use that cloudId

  Result: ✅ Simple case - user already chose

  Scenario B: User Wants to Switch Sites Later

  1. User authorized for "amzur-team-pq9sjopg.atlassian.net"
  2. Later, user wants to track time for "amzur.atlassian.net"
  3. They must RE-AUTHORIZE and pick the other site

  Result: ⚠️ Need to re-authenticate to switch sites