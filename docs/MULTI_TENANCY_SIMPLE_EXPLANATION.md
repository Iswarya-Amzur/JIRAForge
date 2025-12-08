# Multi-Tenancy: Simple Explanation for Developers

## 🎯 THE BIG IDEA IN SIMPLE TERMS

**Problem:** Right now, your app treats everyone as separate individuals. There's no concept of "company" or "team."

**Solution:** Add "Organizations" so teams can work together while keeping their data private from other companies.

---

## 🏢 REAL-WORLD EXAMPLE

Imagine three companies using your app:

```
Company A (Acme Corp)
├── 50 employees
├── Jira URL: acme-corp.atlassian.net
└── Cloud ID: abc-123-xyz

Company B (Tech Startup)
├── 10 employees
├── Jira URL: tech-startup.atlassian.net
└── Cloud ID: def-456-uvw

Company C (Enterprise Inc)
├── 200 employees
├── Jira URL: enterprise.atlassian.net
└── Cloud ID: ghi-789-rst
```

**Each company should:**
- ✅ See only their own team's data
- ✅ Have their own admin who controls settings
- ✅ Configure their own rules (like which apps to track)
- ❌ NEVER see data from other companies

---

## 📱 WHAT HAPPENS WHEN USERS LOG IN

Let me walk you through both scenarios:

---

### Scenario 1: User Logs Into JIRA APP (Forge App)

```
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
```

**Simple Version:**
1. John opens Jira → Your app gets his company's Cloud ID automatically
2. You check: "Does this company exist in database?" If not, create it.
3. You show John only his company's data
4. If he's admin, he can see his whole team's data

---

### Scenario 2: User Logs Into DESKTOP APP (Python App)

```
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
```

**Simple Version:**
1. Sarah logs in via Atlassian OAuth
2. App asks Atlassian: "Which Jira workspaces can Sarah access?"
3. Sarah picks: "Tech Startup" (her work account)
4. App stores: Sarah belongs to "Tech Startup" organization
5. From now on, all her screenshots include organization_id
6. AI uses Tech Startup's settings (whitelist/blacklist)

---

## 🔒 HOW DATA ISOLATION WORKS

Let's say Sarah (Tech Startup) and John (Acme Corp) both use your app:

```
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
```

**Simple Version:**
- Every screenshot, analysis, document has `organization_id`
- Database automatically filters: "Show only data from user's company"
- Even if your app code has a bug, database prevents data leaks

---

## 👥 TEAM FEATURES

### Regular User (Member)

```
Sarah (Member at Tech Startup)
├─ Can see: Her own screenshots
├─ Can see: Her own time analytics
├─ Cannot see: Other team members' screenshots
└─ Cannot change: Organization settings
```

### Admin User

```
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
```

---

## ⚙️ ORGANIZATION SETTINGS

Each company configures their own rules:

```
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
```

When AI analyzes screenshots, it uses the **company's settings**, not global settings.

---

## 🔑 THE MAGIC: jira_cloud_id

```
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
```

---

## 📊 DATABASE STRUCTURE (SIMPLIFIED)

```
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
```

Every row in every table has `organization_id` pointing to the company.

---

## 🚀 IMPLEMENTATION SUMMARY

### What You Need to Change:

#### 1. Forge App (Jira Integration)

```javascript
// BEFORE
const accountId = req.context.accountId;

// AFTER
const accountId = req.context.accountId;
const cloudId = req.context.cloudId;  // ← ADD THIS

// Create/find organization
const org = await findOrCreateOrganization(cloudId);

// All queries now include:
WHERE organization_id = org.id
```

#### 2. Desktop App (Python)

```python
# BEFORE
def handle_oauth_callback(code):
    tokens = exchange_code(code)
    user_info = get_user_info(tokens)
    # Done

# AFTER
def handle_oauth_callback(code):
    tokens = exchange_code(code)

    # NEW: Get user's Jira workspaces
    resources = get_accessible_resources(tokens)
    # Returns: [{ id: "abc-123", name: "Acme Corp", ... }]

    # NEW: Let user pick which company
    selected_org = user_selects_org(resources)

    # NEW: Store organization_id
    self.organization_id = create_or_find_org(selected_org)

    # Now all uploads include organization_id
```

#### 3. Database

```sql
-- Add organization_id to every table
ALTER TABLE screenshots ADD COLUMN organization_id UUID;
ALTER TABLE analysis_results ADD COLUMN organization_id UUID;
-- ... etc

-- Add RLS to prevent cross-company data access
CREATE POLICY "org_isolation"
ON screenshots FOR SELECT
USING (organization_id = get_user_org_id());
```

#### 4. AI Server

```javascript
// BEFORE
async function analyzeScreenshot(screenshotId) {
    const screenshot = await db.get(screenshotId);
    // Use global settings
    return analyzeWithGPT4(screenshot);
}

// AFTER
async function analyzeScreenshot(screenshotId, organizationId) {
    const screenshot = await db.get(screenshotId);

    // Get THIS company's settings
    const orgSettings = await db.getOrgSettings(organizationId);

    // Apply company-specific whitelist/blacklist
    if (orgSettings.blacklist.includes(screenshot.app)) {
        return { workType: 'non-office' };
    }

    return analyzeWithGPT4(screenshot, orgSettings);
}
```

---

## ✅ FINAL SIMPLE SUMMARY

### Before Multi-Tenancy:
- Everyone is separate individuals
- No team features
- All users share same settings
- No company concept

### After Multi-Tenancy:
- Companies are separate "organizations"
- Each company has teams
- Each company has their own settings
- Complete data isolation
- Admins can see team analytics
- Users identified by: `user_id` + `organization_id`

### The Key Change:
> Add `organization_id` to everything, and make sure every query filters by it.

### The Security:
> Database enforces isolation - even if code has bugs, companies can't see each other's data.

---

## 📋 VISUAL COMPARISON

### Current Architecture (Single User)

```
User A → Screenshots A → Analysis A → Personal Dashboard A
User B → Screenshots B → Analysis B → Personal Dashboard B
User C → Screenshots C → Analysis C → Personal Dashboard C

❌ No relationship between users
❌ No team concept
❌ No shared settings
```

### Multi-Tenant Architecture (Organization-Based)

```
Organization 1 (Acme Corp)
├─ User A → Screenshots → Analysis → Personal Dashboard
├─ User B → Screenshots → Analysis → Personal Dashboard
└─ Admin View: Team Dashboard (sees A + B combined)
    Settings: Acme Corp's rules

Organization 2 (Tech Startup)
├─ User C → Screenshots → Analysis → Personal Dashboard
└─ Admin View: Team Dashboard (sees C)
    Settings: Tech Startup's rules

✅ Users grouped by company
✅ Team analytics for admins
✅ Company-specific settings
✅ Complete data isolation
```

---

## 🎯 KEY TAKEAWAYS

1. **Organization = Company = Tenant**
   - Identified by `jira_cloud_id` from Atlassian
   - All users belong to one organization
   - All data belongs to one organization

2. **Every Table Gets organization_id**
   - screenshots, analysis_results, documents, worklogs, etc.
   - Always query: `WHERE organization_id = user's_org`
   - Database RLS enforces this automatically

3. **Two Types of Users**
   - **Regular users**: See only their own data
   - **Admins**: See all team data within their organization

4. **Settings Are Per-Organization**
   - Each company configures their own rules
   - Whitelist, blacklist, screenshot interval, etc.
   - Stored in `organization_settings` table

5. **Security at Database Level**
   - Row Level Security (RLS) policies
   - Even if application code has bugs, database blocks cross-org access
   - Defense in depth approach

---

## 🚀 NEXT STEPS

1. **Review the detailed architecture**: See `MULTI_TENANCY_DATABASE_ARCHITECTURE.md`
2. **Confirm approach**: Make sure this matches your vision
3. **Start implementation**:
   - Database migrations (create tables, add columns)
   - Update Forge app (capture cloudId)
   - Update desktop app (organization selection)
   - Update AI server (org-aware processing)
4. **Test thoroughly**: Verify data isolation works correctly

---

**Ready to start coding? Let's do this! 🎉**
