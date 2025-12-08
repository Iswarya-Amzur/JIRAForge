# Multi-Tenancy Implementation Guide

## Overview

This guide provides step-by-step instructions to implement multi-tenancy in the BRD Time Tracker application. Based on the corrected understanding that **OAuth already handles site selection**, the implementation is simplified.

---

## Implementation Phases

1. **Phase 1:** Database Migration (Create organization tables)
2. **Phase 2:** Desktop App Updates (Handle cloudId)
3. **Phase 3:** Forge App Updates (Extract cloudId from context)
4. **Phase 4:** AI Server Updates (Include organization_id)
5. **Phase 5:** Testing & Validation

---

## PHASE 1: DATABASE MIGRATION

### Step 1.1: Run Migration Scripts

Execute the migration files in order:

```bash
# Navigate to project directory
cd C:\Users\VishnuK\Desktop\jira1

# Run migrations (using Supabase CLI or SQL editor)
supabase db push

# Or manually run each file in order:
# 1. supabase/migrations/010_create_organizations_tables.sql
# 2. supabase/migrations/011_add_organization_id_columns.sql
# 3. supabase/migrations/012_migrate_existing_data.sql
# 4. supabase/migrations/013_create_rls_policies.sql
# 5. supabase/migrations/014_update_views_for_multi_tenancy.sql
# 6. supabase/migrations/015_enforce_constraints.sql
```

### Step 1.2: Verify Migration

```sql
-- Check organizations table exists
SELECT COUNT(*) FROM organizations;

-- Check all tables have organization_id
SELECT column_name FROM information_schema.columns
WHERE table_name = 'screenshots' AND column_name = 'organization_id';

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'screenshots';
```

---

## PHASE 2: DESKTOP APP UPDATES

### Step 2.1: Update OAuth Flow to Handle CloudID

**File:** `python-desktop-app/desktop_app.py`

**Current code (Lines 510-551):**
```python
def get_jira_cloud_id(self):
    """Get Jira cloud ID from accessible resources"""
    if self.jira_cloud_id:
        return self.jira_cloud_id

    access_token = self.auth_manager.tokens.get('access_token')
    response = requests.get(
        'https://api.atlassian.com/oauth/token/accessible-resources',
        headers={'Authorization': f'Bearer {access_token}'}
    )

    if response.status_code == 200:
        resources = response.json()
        if resources:
            self.jira_cloud_id = resources[0]['id']  # ← Takes first org
            return self.jira_cloud_id
```

**Updated code:**
```python
def get_jira_cloud_id(self):
    """Get Jira cloud ID from accessible resources"""
    if self.jira_cloud_id:
        return self.jira_cloud_id

    access_token = self.auth_manager.tokens.get('access_token')
    if not access_token:
        print("[WARN] No access token found")
        return None

    try:
        print("[INFO] Fetching Jira Cloud ID...")
        response = requests.get(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            headers={'Authorization': f'Bearer {access_token}'}
        )

        # Handle token expiration
        if response.status_code == 401:
            print("[WARN] Token expired, refreshing...")
            if self.auth_manager.refresh_access_token():
                access_token = self.auth_manager.tokens.get('access_token')
                response = requests.get(
                    'https://api.atlassian.com/oauth/token/accessible-resources',
                    headers={'Authorization': f'Bearer {access_token}'}
                )
            else:
                print("[ERROR] Token refresh failed")
                return None

        if response.status_code == 200:
            resources = response.json()
            print(f"[INFO] Found {len(resources)} accessible resource(s)")

            if not resources:
                print("[ERROR] No accessible Jira sites found")
                return None

            # User already selected site during OAuth
            # Use the first resource (their selection)
            selected_resource = resources[0]

            # Store all organization info
            self.jira_cloud_id = selected_resource['id']
            self.organization_name = selected_resource.get('name', 'Unknown')
            self.jira_instance_url = selected_resource.get('url', '')

            print(f"[OK] Organization: {self.organization_name}")
            print(f"[OK] Cloud ID: {self.jira_cloud_id}")

            # Register organization in database
            self.register_organization_in_database()

            return self.jira_cloud_id

        else:
            print(f"[ERROR] Failed to get resources: {response.status_code}")
            return None

    except Exception as e:
        print(f"[ERROR] Failed to get Jira cloud ID: {e}")
        return None
```

### Step 2.2: Add Organization Registration Method

**Add this new method to the `BRDTimeTracker` class:**

```python
def register_organization_in_database(self):
    """Register or update organization in Supabase"""
    if not self.jira_cloud_id:
        print("[WARN] Cannot register organization: No cloud ID")
        return None

    try:
        print("[INFO] Registering organization in database...")

        # Check if organization exists
        response = self.supabase.table('organizations') \
            .select('id') \
            .eq('jira_cloud_id', self.jira_cloud_id) \
            .execute()

        if response.data and len(response.data) > 0:
            # Organization exists
            org_id = response.data[0]['id']
            print(f"[OK] Organization already exists: {org_id}")
        else:
            # Create new organization
            org_data = {
                'jira_cloud_id': self.jira_cloud_id,
                'org_name': self.organization_name,
                'jira_instance_url': self.jira_instance_url,
                'subscription_status': 'active',
                'subscription_tier': 'free'
            }

            response = self.supabase.table('organizations') \
                .insert(org_data) \
                .execute()

            if response.data and len(response.data) > 0:
                org_id = response.data[0]['id']
                print(f"[OK] Created new organization: {org_id}")
            else:
                print("[ERROR] Failed to create organization")
                return None

        self.organization_id = org_id
        return org_id

    except Exception as e:
        print(f"[ERROR] Failed to register organization: {e}")
        return None
```

### Step 2.3: Update User Registration to Include organization_id

**Modify the user creation/update logic:**

```python
def ensure_user_exists(self):
    """Ensure current user exists in database with organization link"""
    if not self.current_user_id:
        user_info = self.auth_manager.get_user_info()
        if not user_info:
            return False

        account_id = user_info.get('account_id')
        email = user_info.get('email')
        name = user_info.get('name', 'Unknown User')

        # Ensure organization is registered first
        if not self.organization_id:
            self.get_jira_cloud_id()

        if not self.organization_id:
            print("[ERROR] Cannot create user: No organization ID")
            return False

        try:
            # Check if user exists
            response = self.supabase.table('users') \
                .select('id, organization_id') \
                .eq('atlassian_account_id', account_id) \
                .execute()

            if response.data and len(response.data) > 0:
                # User exists - update organization if needed
                user = response.data[0]
                self.current_user_id = user['id']

                if user['organization_id'] != self.organization_id:
                    # Update user's organization
                    print(f"[INFO] Updating user organization...")
                    self.supabase.table('users') \
                        .update({'organization_id': self.organization_id}) \
                        .eq('id', self.current_user_id) \
                        .execute()

                print(f"[OK] User exists: {self.current_user_id}")
            else:
                # Create new user
                user_data = {
                    'atlassian_account_id': account_id,
                    'email': email,
                    'display_name': name,
                    'organization_id': self.organization_id  # ← Link to organization
                }

                response = self.supabase.table('users') \
                    .insert(user_data) \
                    .execute()

                if response.data and len(response.data) > 0:
                    self.current_user_id = response.data[0]['id']
                    print(f"[OK] Created new user: {self.current_user_id}")
                else:
                    print("[ERROR] Failed to create user")
                    return False

            return True

        except Exception as e:
            print(f"[ERROR] Failed to ensure user exists: {e}")
            return False
```

### Step 2.4: Update Screenshot Upload to Include organization_id

**Modify the `upload_screenshot` method:**

```python
def upload_screenshot(self, screenshot, window_info):
    """Upload screenshot to Supabase storage with organization context"""
    try:
        if not self.current_user_id or not self.organization_id:
            print("[WARN] Cannot upload: Missing user or organization ID")
            return False

        # Generate filename and path
        timestamp = datetime.now(timezone.utc)
        filename = f"{self.current_user_id}_{timestamp.strftime('%Y%m%d_%H%M%S')}.png"
        storage_path = f"screenshots/{self.organization_id}/{self.current_user_id}/{filename}"

        # Save screenshot as PNG
        img_byte_arr = io.BytesIO()
        screenshot.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        # Upload to Supabase Storage
        print(f"[INFO] Uploading screenshot: {storage_path}")
        self.supabase.storage.from_('screenshots').upload(
            path=storage_path,
            file=img_byte_arr.getvalue(),
            file_options={"content-type": "image/png"}
        )

        # Get public URL
        storage_url = self.supabase.storage.from_('screenshots').get_public_url(storage_path)

        # Insert metadata into database
        screenshot_data = {
            'user_id': self.current_user_id,
            'organization_id': self.organization_id,  # ← Include organization_id
            'timestamp': timestamp.isoformat(),
            'storage_path': storage_path,
            'storage_url': storage_url,
            'window_title': window_info.get('title', ''),
            'application_name': window_info.get('app', ''),
            'status': 'pending',
            'user_assigned_issues': self.user_issues
        }

        response = self.supabase.table('screenshots').insert(screenshot_data).execute()

        if response.data:
            print(f"[OK] Screenshot uploaded successfully")
            return True
        else:
            print(f"[ERROR] Failed to insert screenshot metadata")
            return False

    except Exception as e:
        print(f"[ERROR] Failed to upload screenshot: {e}")
        return False
```

### Step 2.5: Save Organization Preference Locally

**Add method to persist organization choice:**

```python
def save_organization_preference(self):
    """Save organization preference to local config file"""
    config_path = os.path.join(os.path.expanduser('~'), '.brd_time_tracker', 'config.json')

    # Ensure directory exists
    os.makedirs(os.path.dirname(config_path), exist_ok=True)

    config = {
        'organization_id': self.organization_id,
        'jira_cloud_id': self.jira_cloud_id,
        'organization_name': self.organization_name,
        'jira_instance_url': self.jira_instance_url,
        'updated_at': datetime.now().isoformat()
    }

    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

    print(f"[OK] Saved organization preference: {self.organization_name}")

def load_organization_preference(self):
    """Load organization preference from local config file"""
    config_path = os.path.join(os.path.expanduser('~'), '.brd_time_tracker', 'config.json')

    if not os.path.exists(config_path):
        return None

    try:
        with open(config_path, 'r') as f:
            config = json.load(f)

        self.organization_id = config.get('organization_id')
        self.jira_cloud_id = config.get('jira_cloud_id')
        self.organization_name = config.get('organization_name')
        self.jira_instance_url = config.get('jira_instance_url')

        print(f"[OK] Loaded organization preference: {self.organization_name}")
        return config

    except Exception as e:
        print(f"[WARN] Failed to load organization preference: {e}")
        return None
```

---

## PHASE 3: FORGE APP UPDATES

### Step 3.1: Extract cloudId from Context

**File:** `forge-app/src/services/userService.js`

**Add helper function to get organization:**

```javascript
import api, { route } from "@forge/api";

/**
 * Get or create organization from Jira cloudId
 */
export async function getOrCreateOrganization(cloudId, context) {
  const supabaseConfig = await getSupabaseConfig();

  // Check if organization exists
  const { data: existingOrg, error: fetchError } = await supabase
    .from('organizations')
    .select('id, org_name, jira_instance_url')
    .eq('jira_cloud_id', cloudId)
    .single();

  if (existingOrg) {
    return existingOrg;
  }

  // Organization doesn't exist - create it
  // Fetch organization name from Jira
  const serverInfo = await api.asApp().requestJira(
    route`/rest/api/3/serverInfo`,
    {
      headers: { Accept: 'application/json' }
    }
  );

  const serverInfoData = await serverInfo.json();

  const orgData = {
    jira_cloud_id: cloudId,
    org_name: serverInfoData.serverTitle || 'Unknown Organization',
    jira_instance_url: serverInfoData.baseUrl,
    subscription_status: 'active',
    subscription_tier: 'free'
  };

  const { data: newOrg, error: createError } = await supabase
    .from('organizations')
    .insert(orgData)
    .select()
    .single();

  if (createError) {
    console.error('Failed to create organization:', createError);
    throw new Error('Failed to create organization');
  }

  return newOrg;
}

/**
 * Get or create user with organization link
 */
export async function getOrCreateUser(accountId, organizationId, supabaseConfig) {
  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, organization_id')
    .eq('atlassian_account_id', accountId)
    .single();

  if (existingUser) {
    // Update organization if changed
    if (existingUser.organization_id !== organizationId) {
      await supabase
        .from('users')
        .update({ organization_id: organizationId })
        .eq('id', existingUser.id);
    }
    return existingUser.id;
  }

  // Create new user
  const jiraUser = await getJiraUser(accountId);

  const userData = {
    atlassian_account_id: accountId,
    organization_id: organizationId,
    email: jiraUser.emailAddress,
    display_name: jiraUser.displayName
  };

  const { data: newUser } = await supabase
    .from('users')
    .insert(userData)
    .select('id')
    .single();

  return newUser.id;
}
```

### Step 3.2: Update All Resolvers to Include organization_id

**Example: Update `analyticsResolvers.js`**

```javascript
// BEFORE
async function getTimeAnalytics(req) {
  const { accountId } = req.context;

  const userId = await getOrCreateUser(accountId);

  const data = await supabase
    .from('daily_time_summary')
    .select('*')
    .eq('user_id', userId);

  return { success: true, data };
}

// AFTER
async function getTimeAnalytics(req) {
  const { accountId, cloudId } = req.context;  // ← Extract cloudId

  // Get or create organization
  const organization = await getOrCreateOrganization(cloudId, req.context);

  // Get or create user with organization link
  const userId = await getOrCreateUser(accountId, organization.id);

  // Query with organization filter
  const data = await supabase
    .from('daily_time_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organization.id)  // ← Filter by organization
    .order('work_date', { ascending: false });

  return { success: true, data };
}
```

**Apply this pattern to ALL resolvers:**
- `analyticsResolvers.js`
- `screenshotResolvers.js`
- `worklogResolvers.js`
- `brdResolvers.js`
- `unassignedWorkResolvers.js`
- etc.

### Step 3.3: Update Team Analytics for Admins

**Add new resolver for team-level data:**

```javascript
/**
 * Get team analytics (for admins/managers)
 */
async function getTeamAnalytics(req) {
  const { accountId, cloudId } = req.context;

  // Get organization
  const organization = await getOrCreateOrganization(cloudId, req.context);

  // Check if user has permission to view team data
  const userId = await getOrCreateUser(accountId, organization.id);
  const hasPermission = await checkUserPermission(userId, organization.id, 'view_team_analytics');

  if (!hasPermission) {
    return { success: false, error: 'Access denied: Insufficient permissions' };
  }

  // Get team analytics
  const data = await supabase
    .from('team_analytics_summary')
    .select('*')
    .eq('organization_id', organization.id)
    .order('work_date', { ascending: false })
    .limit(30);

  return { success: true, data: data.data };
}
```

---

## PHASE 4: AI SERVER UPDATES

### Step 4.1: Update Screenshot Analysis to Include organization_id

**File:** `ai-server/src/controllers/screenshot-controller.js`

```javascript
// BEFORE
async function analyzeScreenshot(req, res) {
  const { screenshot_id, user_id } = req.body;

  const screenshot = await supabase
    .from('screenshots')
    .select('*')
    .eq('id', screenshot_id)
    .single();

  // ... analyze and save
}

// AFTER
async function analyzeScreenshot(req, res) {
  const { screenshot_id, user_id, organization_id } = req.body;  // ← Add organization_id

  // Security: Verify screenshot belongs to claimed organization
  const { data: screenshot } = await supabase
    .from('screenshots')
    .select('*')
    .eq('id', screenshot_id)
    .eq('organization_id', organization_id)  // ← Verify organization
    .single();

  if (!screenshot) {
    return res.status(404).json({ error: 'Screenshot not found or access denied' });
  }

  // Fetch organization-specific settings
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', organization_id)
    .single();

  // Analyze with organization-specific rules
  const analysis = await analyzeWithOrgSettings(screenshot, orgSettings);

  // Save analysis with organization_id
  const { data: analysisResult } = await supabase
    .from('analysis_results')
    .insert({
      screenshot_id: screenshot.id,
      user_id: user_id,
      organization_id: organization_id,  // ← Include organization_id
      active_task_key: analysis.taskKey,
      confidence_score: analysis.confidence,
      work_type: analysis.workType,
      // ... other fields
    })
    .select()
    .single();

  return res.json({ success: true, data: analysisResult });
}
```

### Step 4.2: Update Webhook Payload

**Update Supabase webhook trigger to include organization_id:**

```sql
-- Update screenshot webhook trigger
CREATE OR REPLACE FUNCTION trigger_screenshot_webhook()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-ai-server.com/api/analyze-screenshot',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_API_KEY"}'::jsonb,
    body := jsonb_build_object(
      'screenshot_id', NEW.id,
      'user_id', NEW.user_id,
      'organization_id', NEW.organization_id,  -- ← Include organization_id
      'storage_url', NEW.storage_url,
      'storage_path', NEW.storage_path,
      'window_title', NEW.window_title,
      'application_name', NEW.application_name,
      'timestamp', NEW.timestamp
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Step 4.3: Update Clustering Service

**File:** `ai-server/src/services/clustering-service.js`

```javascript
// BEFORE
async function clusterUnassignedWork(userId) {
  const sessions = await supabase
    .from('unassigned_activity')
    .select('*')
    .eq('user_id', userId);

  // ... cluster
}

// AFTER
async function clusterUnassignedWork(userId, organizationId) {
  // Fetch only this organization's unassigned work
  const { data: sessions } = await supabase
    .from('unassigned_activity')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)  // ← Filter by organization
    .eq('manually_assigned', false);

  // Fetch organization's cached issues
  const { data: orgIssues } = await supabase
    .from('user_jira_issues_cache')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId);

  // Cluster with organization-specific context
  const groups = await performClustering(sessions, orgIssues);

  // Save groups with organization_id
  for (const group of groups) {
    await supabase
      .from('unassigned_work_groups')
      .insert({
        user_id: userId,
        organization_id: organizationId,  // ← Include organization_id
        group_label: group.label,
        group_description: group.description,
        // ... other fields
      });
  }

  return groups;
}
```

---

## PHASE 5: TESTING & VALIDATION

### Test Case 1: Single Organization User

```
1. User logs into desktop app
   ✓ OAuth shows site selector
   ✓ User selects "amzur-team-pq9sjopg.atlassian.net"
   ✓ App fetches cloudId
   ✓ Organization created in database

2. Desktop app uploads screenshots
   ✓ Screenshots include organization_id
   ✓ Screenshots visible in database

3. AI analyzes screenshots
   ✓ Analysis includes organization_id
   ✓ Analysis visible in database

4. User views Forge app
   ✓ Dashboard shows their data
   ✓ Only their organization's data visible
```

### Test Case 2: Multiple Organization User

```
1. User logs into desktop app (Site A)
   ✓ Selects "Site A" during OAuth
   ✓ Screenshots tagged with Site A's organization_id

2. User wants to track for Site B
   ✓ Clicks "Switch Organization"
   ✓ Re-authenticates, selects "Site B"
   ✓ New screenshots tagged with Site B's organization_id

3. Verify data isolation
   ✓ Site A data not visible when tracking for Site B
   ✓ Site B data not visible when tracking for Site A
```

### Test Case 3: RLS Enforcement

```sql
-- Test RLS as authenticated user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<user_supabase_id>"}';

-- Try to access another organization's data
SELECT * FROM screenshots
WHERE organization_id != get_current_user_organization_id();

-- Should return 0 rows (blocked by RLS)
```

---

## Deployment Checklist

### Database:
- [ ] Run all migration files
- [ ] Verify organizations table exists
- [ ] Verify all tables have organization_id
- [ ] Verify RLS policies are active
- [ ] Test RLS with different users

### Desktop App:
- [ ] Update OAuth flow code
- [ ] Add organization registration
- [ ] Update screenshot upload
- [ ] Add organization preference saving
- [ ] Test with single organization
- [ ] Test with multiple organizations

### Forge App:
- [ ] Extract cloudId from context
- [ ] Update all resolvers
- [ ] Add team analytics resolver
- [ ] Test personal dashboard
- [ ] Test team dashboard (admin)

### AI Server:
- [ ] Update webhook handler
- [ ] Add organization_id to analysis
- [ ] Update clustering service
- [ ] Test webhook payload
- [ ] Test analysis results

### Final Verification:
- [ ] End-to-end test (desktop → AI → Forge)
- [ ] Verify data isolation
- [ ] Test user switching organizations
- [ ] Check performance (indexes working)
- [ ] Monitor error logs

---

## Rollback Plan

If issues occur:

1. **Disable RLS temporarily:**
   ```sql
   ALTER TABLE screenshots DISABLE ROW LEVEL SECURITY;
   -- ... disable on all tables
   ```

2. **Revert to legacy organization:**
   ```sql
   UPDATE screenshots SET organization_id = (
     SELECT id FROM organizations WHERE jira_cloud_id = 'legacy-migration-org'
   );
   ```

3. **Complete rollback:**
   - Run rollback script from migration plan
   - Restore from backup

---

## Summary

**Implementation simplified because:**
- ✅ OAuth already handles site selection
- ✅ No need to build custom site selector UI
- ✅ Just call accessible-resources and use cloudId
- ✅ Forge app gets cloudId from context automatically

**Key changes:**
1. Database: Add organization tables and organization_id columns
2. Desktop: Register organization, include organization_id in uploads
3. Forge: Extract cloudId from context, filter by organization_id
4. AI Server: Include organization_id in analysis

**Ready to implement!** 🚀
