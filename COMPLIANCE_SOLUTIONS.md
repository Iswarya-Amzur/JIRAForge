# BRD Time Tracker - Compliance Solutions Guide

## Overview

All compliance issues identified can be resolved **without losing any features or functionality**. This document provides detailed solutions for each issue.

---

## CRITICAL ISSUES - Solutions

### 1. Missing App Uninstall/Lifecycle Handler

**Impact on Features**: None - adds cleanup functionality

**Solution**: Add a Forge lifecycle event handler in your manifest and resolver.

**Step 1**: Update `manifest.yml`:
```yaml
modules:
  # ... existing modules ...

  trigger:
    - key: app-uninstalled-handler
      function: lifecycleHandler
      events:
        - avi:jira:uninstalled
    - key: app-installed-handler
      function: lifecycleHandler
      events:
        - avi:jira:installed
```

**Step 2**: Create lifecycle handler in `forge-app/src/resolvers/lifecycleResolvers.js`:
```javascript
import { supabaseRequest } from '../utils/supabase.js';

export async function handleAppUninstalled(event, context) {
  const { cloudId } = context;

  try {
    // Get organization by cloudId
    const org = await getOrganizationByCloudId(cloudId);
    if (!org) return;

    // Option A: Immediate deletion
    // await deleteAllOrganizationData(org.id);

    // Option B: Schedule deletion after 30 days (recommended)
    await scheduleDataDeletion(org.id, 30); // days

    console.log(`Scheduled data deletion for org: ${org.id}`);
  } catch (error) {
    console.error('Uninstall cleanup failed:', error);
  }
}

async function scheduleDataDeletion(organizationId, daysDelay) {
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + daysDelay);

  // Mark organization for deletion
  await supabaseRequest(config, `organizations?id=eq.${organizationId}`, {
    method: 'PATCH',
    body: {
      status: 'pending_deletion',
      scheduled_deletion_at: deletionDate.toISOString()
    }
  });
}
```

**Step 3**: Create a Supabase scheduled function to process deletions:
```sql
-- Add columns to organizations table
ALTER TABLE organizations ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN scheduled_deletion_at TIMESTAMP WITH TIME ZONE;

-- Create cleanup function (run via pg_cron or Supabase Edge Function)
CREATE OR REPLACE FUNCTION cleanup_deleted_organizations()
RETURNS void AS $$
BEGIN
  -- Delete data for organizations past their deletion date
  DELETE FROM screenshots
  WHERE organization_id IN (
    SELECT id FROM organizations
    WHERE status = 'pending_deletion'
    AND scheduled_deletion_at <= NOW()
  );

  DELETE FROM analysis_results
  WHERE organization_id IN (
    SELECT id FROM organizations
    WHERE status = 'pending_deletion'
    AND scheduled_deletion_at <= NOW()
  );

  -- Delete the organizations themselves
  DELETE FROM organizations
  WHERE status = 'pending_deletion'
  AND scheduled_deletion_at <= NOW();
END;
$$ LANGUAGE plpgsql;
```

---

### 2. Missing User Consent for Screenshot Capture

**Impact on Features**: None - adds consent flow before capturing starts

**Solution**: Add consent screen in desktop app before first capture.

**Update `desktop_app.py`** - Add consent check after login:

```python
class ConsentManager:
    """Manages user consent for screenshot capture"""

    def __init__(self, store_path=None):
        self.store_path = store_path or os.path.join(
            tempfile.gettempdir(), 'brd_tracker_consent.json'
        )
        self.consent_data = self._load_consent()

    def _load_consent(self):
        try:
            if os.path.exists(self.store_path):
                with open(self.store_path, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _save_consent(self):
        with open(self.store_path, 'w') as f:
            json.dump(self.consent_data, f)

    def has_consented(self, user_id):
        return self.consent_data.get(user_id, {}).get('consented', False)

    def record_consent(self, user_id, consented=True):
        self.consent_data[user_id] = {
            'consented': consented,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'version': '1.0'  # Track consent version for policy updates
        }
        self._save_consent()

    def revoke_consent(self, user_id):
        if user_id in self.consent_data:
            self.consent_data[user_id]['consented'] = False
            self.consent_data[user_id]['revoked_at'] = datetime.now(timezone.utc).isoformat()
            self._save_consent()


# Add consent UI route in Flask app
@app.route('/consent')
def consent_page():
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head>
        <title>BRD Time Tracker - Consent</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                   max-width: 600px; margin: 50px auto; padding: 20px; }
            .consent-box { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .data-item { margin: 10px 0; padding-left: 20px; }
            .btn { padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
            .btn-primary { background: #0052CC; color: white; }
            .btn-secondary { background: #DFE1E6; color: #172B4D; }
        </style>
    </head>
    <body>
        <h1>Screenshot Capture Consent</h1>
        <p>Before we begin tracking your work time, please review what data we collect:</p>

        <div class="consent-box">
            <h3>Data We Collect:</h3>
            <div class="data-item">📸 <strong>Screenshots</strong> - Captured every 5 minutes while tracking is active</div>
            <div class="data-item">🪟 <strong>Window Titles</strong> - The title of your active window</div>
            <div class="data-item">📱 <strong>Application Names</strong> - Which application is in focus</div>
            <div class="data-item">⏱️ <strong>Timestamps</strong> - When each screenshot was taken</div>
        </div>

        <div class="consent-box">
            <h3>How We Use Your Data:</h3>
            <div class="data-item">🤖 Screenshots are analyzed by AI to identify which Jira task you're working on</div>
            <div class="data-item">📊 Time is automatically logged to your Jira issues</div>
            <div class="data-item">🔒 Data is stored securely and encrypted</div>
        </div>

        <div class="consent-box">
            <h3>Data Retention:</h3>
            <div class="data-item">Screenshots are retained for 90 days, then automatically deleted</div>
            <div class="data-item">You can delete your data at any time from the Jira app</div>
        </div>

        <div class="consent-box">
            <h3>Third-Party Processing:</h3>
            <div class="data-item">Screenshots are processed by OpenAI for AI analysis</div>
            <div class="data-item">OpenAI may retain data for up to 30 days (not used for training)</div>
        </div>

        <p><a href="/privacy-policy" target="_blank">Read our full Privacy Policy</a></p>

        <form action="/consent/submit" method="POST">
            <button type="submit" name="consent" value="true" class="btn btn-primary">
                I Agree - Start Tracking
            </button>
            <button type="submit" name="consent" value="false" class="btn btn-secondary">
                I Do Not Agree
            </button>
        </form>
    </body>
    </html>
    ''')

@app.route('/consent/submit', methods=['POST'])
def submit_consent():
    consented = request.form.get('consent') == 'true'
    user_info = auth_manager.get_user_info()

    if user_info and consented:
        consent_manager.record_consent(user_info['account_id'], True)
        # Start screenshot capture
        return redirect('/dashboard')
    else:
        return render_template_string('''
            <h1>Consent Required</h1>
            <p>Screenshot tracking requires your consent. You can close this application.</p>
            <p>If you change your mind, restart the app and accept the consent.</p>
        ''')
```

**Modify the capture start logic**:
```python
def start_capture_if_consented(self):
    user_info = self.auth_manager.get_user_info()
    if not user_info:
        return False

    if not self.consent_manager.has_consented(user_info['account_id']):
        # Open consent page in browser
        webbrowser.open('http://localhost:51777/consent')
        return False

    # Start capturing
    self.start_capture()
    return True
```

---

### 3. Missing Privacy Policy URL

**Impact on Features**: None - documentation only

**Solution**: Create a privacy policy and host it. Here's a template:

**Create `PRIVACY_POLICY.md`** (or host on your website):

```markdown
# BRD Time Tracker Privacy Policy

Last Updated: [DATE]

## 1. Information We Collect

### Automatically Collected Data
- **Screenshots**: Captured at configurable intervals (default: 5 minutes)
- **Window Titles**: Title of your active application window
- **Application Names**: Name of the application in focus
- **Timestamps**: When each screenshot was captured

### Jira Data
- Your Atlassian account ID and email
- Your assigned Jira issues (for task matching)
- Project information

## 2. How We Use Your Information

- **AI Analysis**: Screenshots are analyzed to identify which Jira task you're working on
- **Time Tracking**: Automatically log time to Jira issues
- **Analytics**: Provide productivity insights and reports

## 3. Data Storage

- **Location**: Data is stored in Supabase (AWS region: [SPECIFY YOUR REGION])
- **Encryption**: All data is encrypted at rest (AES-256) and in transit (TLS 1.2+)
- **Retention**: Screenshots are retained for 90 days unless you delete them earlier

## 4. Third-Party Services

### OpenAI
- Screenshots are sent to OpenAI for AI-powered analysis
- OpenAI may retain API data for up to 30 days
- Data is NOT used for model training
- See: https://openai.com/policies/api-data-usage-policies

### Supabase
- Database and file storage provider
- See: https://supabase.com/privacy

### Atlassian
- Authentication and Jira integration
- See: https://www.atlassian.com/legal/privacy-policy

## 5. Your Rights

You have the right to:
- **Access**: Request a copy of your data
- **Delete**: Delete your screenshots and analysis data
- **Export**: Download your data in a portable format
- **Revoke Consent**: Stop screenshot capture at any time

## 6. Data Deletion

- **Manual Deletion**: Delete individual screenshots from the Jira app
- **Account Deletion**: Contact us to delete all your data
- **App Uninstall**: Data is scheduled for deletion 30 days after app uninstall

## 7. Contact Us

For privacy inquiries: [YOUR EMAIL]

## 8. Changes to This Policy

We will notify you of significant changes via the application.
```

**Add to `manifest.yml`**:
```yaml
app:
  id: ari:cloud:ecosystem::app/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a
  name: BRD Time Tracker
  # Add these:
  privacyPolicy: https://your-domain.com/privacy-policy
  termsOfService: https://your-domain.com/terms
```

---

### 4. External Data Storage Without Encryption Disclosure

**Impact on Features**: None - Supabase already has encryption

**Solution**: Document and verify Supabase encryption settings.

**Verification Steps**:

1. **Supabase automatically provides**:
   - Encryption at rest (AES-256)
   - Encryption in transit (TLS 1.2+)
   - Database encryption via AWS RDS

2. **Add to your security documentation**:
```markdown
## Data Encryption

### At Rest
- Database: AES-256 encryption via Supabase/AWS RDS
- Storage: AES-256 encryption via Supabase Storage/AWS S3

### In Transit
- All API calls use TLS 1.2+
- HTTPS enforced for all endpoints

### Supabase Security Features
- Row Level Security (RLS) enabled
- Multi-tenant data isolation
- Automatic backups with encryption
```

3. **For Marketplace Security Questionnaire**, answer:
   - "Yes" to at-rest encryption
   - "Yes" to in-transit encryption
   - Specify "Supabase (AWS)" as your hosting provider

---

### 5. OpenAI Data Sharing Without Proper Disclosure

**Impact on Features**: None if you keep OpenAI (just add disclosure), OR potential impact if switching to Forge LLMs

**Solution A - Keep OpenAI (Recommended for full functionality)**:

Add disclosure in:
1. Privacy Policy (done above)
2. Consent screen (done above)
3. Marketplace listing Privacy & Security tab

**Add to Forge app UI** - Settings or About section:
```javascript
// In your React settings component
const AIDisclosure = () => (
  <div className="ai-disclosure">
    <h4>AI Processing</h4>
    <p>Screenshots are analyzed using OpenAI's GPT-4 Vision to identify your work tasks.</p>
    <p>OpenAI may retain data for up to 30 days but does not use it for model training.</p>
    <a href="https://openai.com/policies/api-data-usage-policies" target="_blank">
      Learn more about OpenAI's data policies
    </a>
  </div>
);
```

**Solution B - Switch to Forge LLMs (For "Runs on Atlassian" badge)**:

> ⚠️ **Note**: Forge LLMs may not support vision/image analysis. You would need to use OCR-first approach.

```javascript
// In forge-app, use Forge LLMs instead of OpenAI
import { llm } from '@forge/ai';

async function analyzeWithForgeLLM(ocrText, windowTitle, assignedIssues) {
  const response = await llm.generate({
    model: 'claude-3-sonnet', // or available Forge LLM model
    prompt: buildAnalysisPrompt(ocrText, windowTitle, assignedIssues),
    maxTokens: 500
  });

  return parseAnalysisResponse(response);
}
```

**Hybrid Approach** (Best of both worlds):
- Use Tesseract OCR locally in AI server (no external API)
- Send only extracted TEXT to Forge LLMs (not images)
- This qualifies for "Runs on Atlassian" while maintaining functionality

---

## HIGH PRIORITY ISSUES - Solutions

### 6. No "Runs on Atlassian" Badge Eligibility

**Impact on Features**: None - badge is optional

**Options**:

| Option | Effort | Badge Eligible | Feature Impact |
|--------|--------|----------------|----------------|
| Keep current architecture | None | No | None |
| Move to Forge Storage | High | Partial | None |
| Move to Forge LLMs + OCR | Medium | Yes | Slightly less accurate AI |
| Full Forge migration | Very High | Yes | None |

**Recommendation**: For MVP, keep current architecture and just ensure proper disclosures. Migrate to Forge services in v2 if customers require the badge.

---

### 7. Soft Delete Only - No Hard Delete

**Impact on Features**: None - adds functionality

**Solution**: Add hard delete option with retention period.

**Update `screenshotService.js`**:
```javascript
/**
 * Hard delete a screenshot (permanent)
 */
export async function hardDeleteScreenshot(accountId, cloudId, screenshotId) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

  // Get screenshot to find storage path
  const screenshot = await supabaseRequest(
    supabaseConfig,
    `screenshots?id=eq.${screenshotId}&user_id=eq.${userId}&organization_id=eq.${organization.id}&select=id,storage_path`
  );

  if (!screenshot || screenshot.length === 0) {
    throw new Error('Screenshot not found or access denied');
  }

  // Delete from storage first
  const storagePath = screenshot[0].storage_path;
  await deleteFromSupabaseStorage(supabaseConfig, 'screenshots', storagePath);

  // Delete thumbnail
  const thumbPath = storagePath.replace('screenshot_', 'thumb_').replace('.png', '.jpg');
  await deleteFromSupabaseStorage(supabaseConfig, 'screenshots', thumbPath);

  // Delete analysis results
  await supabaseRequest(
    supabaseConfig,
    `analysis_results?screenshot_id=eq.${screenshotId}`,
    { method: 'DELETE' }
  );

  // Delete screenshot record
  await supabaseRequest(
    supabaseConfig,
    `screenshots?id=eq.${screenshotId}`,
    { method: 'DELETE' }
  );
}

/**
 * Cleanup old soft-deleted screenshots (run via cron)
 */
export async function cleanupDeletedScreenshots(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Find soft-deleted screenshots older than retention period
  const toDelete = await supabaseRequest(
    supabaseConfig,
    `screenshots?deleted_at=not.is.null&deleted_at=lt.${cutoffDate.toISOString()}&select=id,storage_path`
  );

  for (const screenshot of toDelete) {
    await hardDeleteScreenshot(screenshot.id);
  }
}
```

**Add Supabase scheduled cleanup**:
```sql
-- Run daily via pg_cron or Edge Function scheduler
SELECT cron.schedule(
  'cleanup-deleted-screenshots',
  '0 3 * * *', -- 3 AM daily
  $$SELECT cleanup_soft_deleted_screenshots(30)$$
);
```

---

### 8. Missing Data Residency Documentation

**Impact on Features**: None - documentation only

**Solution**: Document your Supabase region and add to Marketplace listing.

```markdown
## Data Residency

### Current Data Location
- **Primary Region**: [Your Supabase region, e.g., "US East (N. Virginia)"]
- **Provider**: Supabase (hosted on AWS)

### Available Regions
Contact us for data residency in specific regions:
- US (default)
- EU (Frankfurt) - available on request
- Australia (Sydney) - available on request

### For Enterprise Customers
We can provision dedicated Supabase instances in your preferred region.
Contact: enterprise@your-domain.com
```

---

### 9. OAuth Tokens Stored in Temp Files

**Impact on Features**: None - improves security

**Solution**: Use OS-native secure storage.

**Update `desktop_app.py`**:
```python
import keyring  # pip install keyring

class SecureTokenStorage:
    """Secure storage for OAuth tokens using OS keychain"""

    SERVICE_NAME = "BRDTimeTracker"

    def save_tokens(self, user_id, tokens):
        """Save tokens to secure storage"""
        keyring.set_password(
            self.SERVICE_NAME,
            f"{user_id}_tokens",
            json.dumps(tokens)
        )

    def get_tokens(self, user_id):
        """Retrieve tokens from secure storage"""
        try:
            data = keyring.get_password(self.SERVICE_NAME, f"{user_id}_tokens")
            return json.loads(data) if data else {}
        except Exception:
            return {}

    def delete_tokens(self, user_id):
        """Delete tokens from secure storage"""
        try:
            keyring.delete_password(self.SERVICE_NAME, f"{user_id}_tokens")
        except keyring.errors.PasswordDeleteError:
            pass  # Already deleted


# Update AtlassianAuthManager to use secure storage
class AtlassianAuthManager:
    def __init__(self, web_port=51777):
        self.client_id = get_env_var('ATLASSIAN_CLIENT_ID', '')
        self.client_secret = get_env_var('ATLASSIAN_CLIENT_SECRET', '')
        self.redirect_uri = f'http://localhost:{web_port}/auth/callback'
        self.authorization_url = 'https://auth.atlassian.com/authorize'
        self.token_url = 'https://auth.atlassian.com/oauth/token'
        self.secure_storage = SecureTokenStorage()
        self.current_user_id = None
        self.tokens = {}

    def _save_tokens(self):
        if self.current_user_id:
            self.secure_storage.save_tokens(self.current_user_id, self.tokens)

    def _load_tokens(self, user_id):
        self.current_user_id = user_id
        self.tokens = self.secure_storage.get_tokens(user_id)
        return self.tokens
```

**Add to requirements.txt**:
```
keyring>=24.0.0
```

---

### 10. Missing DPIA (Data Protection Impact Assessment)

**Impact on Features**: None - documentation only

**Solution**: Create a DPIA document.

**Create `DPIA.md`**:
```markdown
# Data Protection Impact Assessment (DPIA)
## BRD Time Tracker

### 1. Project Overview
- **Purpose**: Automated time tracking for Jira using screenshot analysis
- **Data Controller**: [Your Company Name]
- **Assessment Date**: [Date]

### 2. Data Processing Description

| Data Type | Purpose | Legal Basis | Retention |
|-----------|---------|-------------|-----------|
| Screenshots | Task identification | Legitimate Interest / Consent | 90 days |
| Window titles | Context for AI analysis | Legitimate Interest | 90 days |
| Atlassian ID | User identification | Contract performance | Account lifetime |
| Analysis results | Time tracking | Legitimate Interest | 90 days |

### 3. Necessity and Proportionality

**Why is screenshot capture necessary?**
- Automatic time tracking requires understanding what users are working on
- Manual time entry is error-prone and time-consuming
- Screenshots provide accurate context for AI task matching

**Why not less intrusive methods?**
- Keyboard/mouse tracking doesn't identify tasks
- Manual logging is burdensome and inaccurate
- Window titles alone are insufficient for accurate matching

**Proportionality measures**:
- Screenshots captured at intervals (not continuous recording)
- Users control when tracking is active
- Users can delete any screenshot
- Data automatically expires after 90 days

### 4. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Unauthorized access | Low | High | Encryption, RLS, auth |
| Data breach | Low | High | Security monitoring |
| Excessive surveillance | Medium | Medium | User controls, consent |
| AI misclassification | Medium | Low | Human review option |

### 5. Automated Decision Making

**Does the app make automated decisions?**
- Yes: AI assigns time to Jira tasks automatically
- Safeguards:
  - Users can review and correct assignments
  - "Unassigned work" section for manual review
  - Confidence scores shown for transparency
  - No punitive actions based on data

### 6. Data Subject Rights

| Right | How Supported |
|-------|---------------|
| Access | View all screenshots in app |
| Rectification | Edit task assignments |
| Erasure | Delete screenshots, request full deletion |
| Portability | Export data feature (to be implemented) |
| Object | Revoke consent, stop tracking |

### 7. Conclusion

This processing is **justified** because:
- Clear user benefit (automatic time tracking)
- Proportionate data collection
- Strong security measures
- Full user control and transparency

**Approved by**: [Name, Role]
**Date**: [Date]
**Review Date**: [Date + 1 year]
```

---

## MEDIUM PRIORITY ISSUES - Solutions

### 11. API Keys Should Rotate Every 90 Days

**Impact on Features**: None - operational procedure

**Solution**: Create rotation procedure and reminders.

```markdown
## API Key Rotation Procedure

### Keys to Rotate
1. Supabase Service Role Key
2. OpenAI API Key
3. AI Server API Key

### Rotation Steps

#### Supabase Service Role Key
1. Go to Supabase Dashboard > Settings > API
2. Click "Regenerate" on Service Role Key
3. Update in:
   - Forge app settings (via UI)
   - AI Server .env file
4. Restart AI Server

#### OpenAI API Key
1. Go to OpenAI Dashboard > API Keys
2. Create new key
3. Update AI Server .env
4. Delete old key after verification

#### AI Server API Key
1. Generate new key: `openssl rand -hex 32`
2. Update AI Server .env
3. Update Supabase webhook URL
4. Verify webhook works

### Automation
Set calendar reminders for every 90 days, or use a secrets manager with automatic rotation.
```

---

### 12. Missing Egress Domain Declaration

**Impact on Features**: None - manifest update only

**Solution**: Update `manifest.yml`:

```yaml
permissions:
  scopes:
    - read:me
    - read:jira-work
    - write:jira-work
    - read:jira-user
    - storage:app
  external:
    fetch:
      backend:
        - address: "*.supabase.co"
        - address: "api.openai.com"  # ADD THIS
    images:
      - address: "*.supabase.co"
```

---

### 13. Screenshots Stored as Public in Supabase

**Impact on Features**: None - you already use signed URLs

**Solution**: Verify bucket is private and RLS is enabled.

**Check Supabase Storage settings**:
```sql
-- Verify RLS is enabled on storage.objects
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Should return: objects | true
```

**Verify bucket policy** in Supabase Dashboard:
- Go to Storage > screenshots bucket > Policies
- Ensure NO public SELECT policy exists
- Only authenticated/service role access

**Your signed URL approach is correct** - just verify the bucket isn't accidentally public.

---

### 14. No Data Export Functionality

**Impact on Features**: Adds new feature

**Solution**: Add data export endpoint.

**Add to `forge-app/src/resolvers/userResolvers.js`**:
```javascript
export async function exportUserData(accountId, cloudId) {
  const supabaseConfig = await getSupabaseConfig(accountId);
  const organization = await getOrCreateOrganization(cloudId, supabaseConfig);
  const userId = await getOrCreateUser(accountId, supabaseConfig, organization.id);

  // Gather all user data
  const userData = {
    exportDate: new Date().toISOString(),
    user: await supabaseRequest(supabaseConfig, `users?id=eq.${userId}`),
    screenshots: await supabaseRequest(
      supabaseConfig,
      `screenshots?user_id=eq.${userId}&organization_id=eq.${organization.id}&select=id,timestamp,window_title,application_name,status`
    ),
    analysisResults: await supabaseRequest(
      supabaseConfig,
      `analysis_results?user_id=eq.${userId}&select=*`
    ),
    activityLog: await supabaseRequest(
      supabaseConfig,
      `activity_log?user_id=eq.${userId}&select=*`
    )
  };

  return userData;
}
```

**Add UI button** in settings:
```javascript
const ExportDataButton = () => {
  const handleExport = async () => {
    const data = await invoke('exportUserData');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brd-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  return (
    <Button onClick={handleExport}>
      Download My Data
    </Button>
  );
};
```

---

## Summary: Feature Impact Assessment

| Issue | Can Fix? | Feature Loss? | Effort |
|-------|----------|---------------|--------|
| 1. Uninstall handler | ✅ Yes | None | Medium |
| 2. User consent | ✅ Yes | None | Medium |
| 3. Privacy policy | ✅ Yes | None | Low |
| 4. Encryption docs | ✅ Yes | None | Low |
| 5. OpenAI disclosure | ✅ Yes | None | Low |
| 6. "Runs on Atlassian" | ⚠️ Optional | None if skipped | High if migrating |
| 7. Hard delete | ✅ Yes | None (adds feature) | Low |
| 8. Data residency docs | ✅ Yes | None | Low |
| 9. Secure token storage | ✅ Yes | None | Low |
| 10. DPIA | ✅ Yes | None | Medium |
| 11. Key rotation | ✅ Yes | None | Low |
| 12. Egress domains | ✅ Yes | None | Trivial |
| 13. Storage privacy | ✅ Yes | None | Low |
| 14. Data export | ✅ Yes | None (adds feature) | Low |

**Total Effort Estimate**: 2-3 weeks of development work

**Conclusion**: All issues are fixable with **zero feature loss**. The app will actually be improved with additional features (data export, hard delete, better security).
