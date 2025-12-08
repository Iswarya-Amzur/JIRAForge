# Sandbox Environment Setup Guide

**Document Version:** 1.0
**Date:** December 5, 2025
**Author:** Technical Team
**Purpose:** Complete guide for setting up development and sandbox environments

---

## Table of Contents
1. [Overview](#overview)
2. [Environment Strategy](#environment-strategy)
3. [Jira Sandbox Setup](#jira-sandbox-setup)
4. [Supabase Sandbox Setup](#supabase-sandbox-setup)
5. [AI Server Sandbox Setup](#ai-server-sandbox-setup)
6. [Forge App Sandbox Setup](#forge-app-sandbox-setup)
7. [Testing Environment](#testing-environment)
8. [Data Management](#data-management)
9. [CI/CD Pipeline](#cicd-pipeline)
10. [Best Practices](#best-practices)

---

## 1. Overview

### Purpose of Sandbox Environment

A sandbox environment allows you to:
- Test new features without affecting production
- Validate marketplace submissions
- Perform security audits
- Train team members
- Demo to potential customers
- Test database migrations safely

### Environment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ENVIRONMENTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LOCAL DEVELOPMENT          SANDBOX/STAGING      PRODUCTION │
│  ├─ Local Supabase         ├─ Supabase Staging  ├─ Supabase│
│  ├─ Local AI Server        ├─ AI Server (Dev)   ├─ AI Pro  │
│  ├─ Forge Tunnel           ├─ Forge Staging     ├─ Forge   │
│  ├─ Test Jira Site         ├─ Jira Sandbox      ├─ Jira    │
│  └─ Mock Data              └─ Synthetic Data    └─ Real    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Strategy

### 2.1 Three-Tier Environment Strategy

**Tier 1: Local Development**
- Purpose: Individual developer machines
- Data: Mock/test data only
- Cost: Free
- Uptime: On-demand

**Tier 2: Sandbox/Staging**
- Purpose: Integration testing, demos, QA
- Data: Synthetic data similar to production
- Cost: ~$50-100/month
- Uptime: 24/7

**Tier 3: Production**
- Purpose: Live customer data
- Data: Real customer data
- Cost: Variable based on usage
- Uptime: 99.9% SLA

### 2.2 Environment Isolation

Each environment must be completely isolated:
- Separate Supabase projects
- Separate Forge app IDs
- Separate AI server instances
- Separate Jira sites/workspaces
- Separate API keys and secrets
- No data sharing between environments

---

## 3. Jira Sandbox Setup

### 3.1 Create Development Jira Site

**Free Sandbox Site:**

1. **Go to Atlassian Account:**
   - Visit: https://admin.atlassian.com/
   - Sign in with your Atlassian account

2. **Create New Site:**
   - Click "Create site"
   - Choose "Jira Software"
   - Name it: `yourcompany-sandbox` or `yourcompany-dev`
   - Example: `brd-timetracker-dev.atlassian.net`

3. **Free Plan:**
   - Up to 10 users free
   - Full Jira functionality
   - Sufficient for testing

**Cost: $0 (free tier)**

### 3.2 Configure Sandbox Jira Site

1. **Create Test Project:**
   ```
   Project Name: TEST (Test Project)
   Project Key: TEST
   Project Type: Software Development
   Template: Scrum or Kanban
   ```

2. **Add Test Users:**
   - Create 3-5 test user accounts
   - Different roles: Admin, Developer, Manager
   - Example emails: test1@yourcompany.com, test2@yourcompany.com

3. **Create Sample Issues:**
   ```
   TEST-1: Sample task for time tracking
   TEST-2: Another test issue
   TEST-3: Bug fix simulation
   TEST-4: Feature development
   ```

4. **Set Up Test Boards:**
   - Create Scrum board
   - Create Kanban board
   - Add some sample sprints

### 3.3 Jira OAuth App Setup (Sandbox)

**Create Separate OAuth App for Sandbox:**

1. **Go to Developer Console:**
   - Visit: https://developer.atlassian.com/console/myapps/
   - Click "Create" → "OAuth 2.0 integration"

2. **Configure OAuth App (Sandbox):**
   ```
   App Name: BRD Time Tracker (Sandbox)
   Permissions:
   - read:jira-work
   - write:jira-work
   - read:jira-user
   - offline_access

   Callback URL: http://localhost:8000/callback (for local testing)
   ```

3. **Save Credentials:**
   ```
   Client ID: sandbox_client_id_here
   Client Secret: sandbox_client_secret_here
   ```

**Important:** Keep sandbox and production OAuth apps completely separate.

---

## 4. Supabase Sandbox Setup

### 4.1 Create Sandbox Supabase Project

**Option 1: Supabase Free Tier (Recommended for Sandbox)**

1. **Go to Supabase Dashboard:**
   - Visit: https://app.supabase.com/
   - Sign in with GitHub or email

2. **Create New Organization (Optional):**
   - Organization Name: `BRD Time Tracker Sandbox`
   - Keeps sandbox projects separate

3. **Create New Project:**
   ```
   Project Name: brd-timetracker-sandbox
   Database Password: [Strong Password - Save Securely]
   Region: Choose closest to your location
   Pricing Plan: Free (up to 500 MB database)
   ```

4. **Wait for Project Creation:**
   - Takes 2-3 minutes
   - Don't close the browser

**Cost: $0 (free tier)**

### 4.2 Configure Sandbox Database

**1. Run All Migrations:**

```bash
# Navigate to project directory
cd C:\Users\VishnuK\Desktop\jira1

# Run migrations one by one in order
supabase migration up --db-url "postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres"
```

**Run these migrations in order:**
1. `001_initial_schema.sql` - Base tables
2. `002_add_indexes.sql` - Performance indexes
3. `010_create_organizations_tables.sql` - Multi-tenancy tables
4. `011_add_organization_id_columns.sql` - Add org columns
5. `012_migrate_existing_data.sql` - (Skip for fresh sandbox)
6. `013_create_rls_policies.sql` - Security policies
7. `014_update_views_for_multi_tenancy.sql` - Update views
8. `015_enforce_constraints.sql` - Enforce NOT NULL
9. `016_fix_legacy_organization.sql` - (Skip for fresh sandbox)

**Note:** For sandbox, you can skip migrations 012 and 016 since there's no legacy data to migrate.

**2. Enable Storage:**

```sql
-- Enable storage for screenshots bucket
CREATE BUCKET IF NOT EXISTS screenshots PUBLIC;

-- Set storage policies
CREATE POLICY "Allow authenticated users to upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Allow authenticated users to download screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'screenshots');
```

**3. Get Connection Details:**

```
Project URL: https://[project-ref].supabase.co
Anon Key: [Get from Settings → API]
Service Role Key: [Get from Settings → API - Keep Secret]
Database URL: postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres
```

### 4.3 Seed Test Data (Optional)

**Create Test Organization:**

```sql
-- Insert test organization
INSERT INTO public.organizations (
  id,
  jira_cloud_id,
  org_name,
  jira_instance_url,
  subscription_status,
  subscription_tier
) VALUES (
  gen_random_uuid(),
  'sandbox-cloud-id-12345',
  'Sandbox Test Company',
  'https://brd-timetracker-dev.atlassian.net',
  'active',
  'free'
) RETURNING id;
-- Save the returned ID as [ORG_ID]
```

**Create Test User:**

```sql
-- Insert test user
INSERT INTO public.users (
  id,
  atlassian_account_id,
  email,
  display_name,
  organization_id
) VALUES (
  gen_random_uuid(),
  'test-account-id-12345',
  'testuser@sandbox.com',
  'Test User',
  '[ORG_ID from above]'
) RETURNING id;
-- Save the returned ID as [USER_ID]
```

**Create Sample Screenshots:**

```sql
-- Insert sample screenshot record (without actual file)
INSERT INTO public.screenshots (
  id,
  user_id,
  organization_id,
  storage_path,
  storage_url,
  window_title,
  application_name,
  timestamp,
  processing_status
) VALUES (
  gen_random_uuid(),
  '[USER_ID]',
  '[ORG_ID]',
  'sandbox/test-screenshot.png',
  'https://placeholder.com/800x600',
  'Visual Studio Code - test.js',
  'Code.exe',
  NOW(),
  'pending'
);
```

---

## 5. AI Server Sandbox Setup

### 5.1 Local AI Server (Development)

**Prerequisites:**
- Node.js 18+ installed
- OpenAI API key (sandbox can use same key with usage limits)

**Setup Steps:**

1. **Clone or Navigate to AI Server:**
   ```bash
   cd C:\Users\VishnuK\Desktop\jira1\ai-server
   ```

2. **Create Sandbox Environment File:**
   ```bash
   # Create .env.sandbox file
   copy .env.example .env.sandbox
   ```

3. **Configure .env.sandbox:**
   ```env
   # Supabase Configuration (Sandbox)
   SUPABASE_URL=https://[sandbox-project-ref].supabase.co
   SUPABASE_SERVICE_KEY=[sandbox-service-role-key]

   # OpenAI Configuration
   OPENAI_API_KEY=[your-openai-api-key]
   OPENAI_MODEL=gpt-4o  # Same model, but monitor usage

   # Polling Configuration (More frequent for testing)
   POLLING_INTERVAL_MS=15000  # Poll every 15 seconds (faster for testing)
   POLLING_BATCH_SIZE=5       # Smaller batches for testing

   # Clustering Configuration
   CLUSTERING_ENABLED=true

   # Environment Identifier
   NODE_ENV=sandbox
   PORT=3001  # Different port from production (3000)

   # Logging
   LOG_LEVEL=debug  # More verbose logging for sandbox
   ```

4. **Install Dependencies:**
   ```bash
   npm install
   ```

5. **Run Sandbox AI Server:**
   ```bash
   # Using sandbox environment file
   node --env-file=.env.sandbox src/index.js
   ```

**Cost: ~$10-20/month (depending on OpenAI usage)**

### 5.2 Cloud-Hosted Sandbox AI Server (Optional)

**Render.com Setup (Easiest):**

1. **Create Account:**
   - Visit: https://render.com/
   - Sign up with GitHub

2. **Create New Web Service:**
   ```
   Repository: Connect your GitHub repo
   Branch: develop (separate branch for sandbox)
   Build Command: npm install
   Start Command: node src/index.js
   ```

3. **Environment Variables:**
   - Add all variables from .env.sandbox
   - Use Render's environment variable manager

4. **Choose Plan:**
   - Free tier: $0 (sleeps after inactivity)
   - Starter: $7/month (always on)

**DigitalOcean App Platform (Alternative):**

1. **Create App:**
   - Connect GitHub repo
   - Choose sandbox branch

2. **Configure:**
   ```
   Name: brd-ai-server-sandbox
   Region: Closest to Supabase region
   Instance Size: Basic ($5/month)
   ```

3. **Set Environment Variables:**
   - Same as .env.sandbox

**Cost: $0-7/month**

---

## 6. Forge App Sandbox Setup

### 6.1 Forge Development Environment

**Prerequisites:**
- Node.js 18+
- Forge CLI installed: `npm install -g @forge/cli`

**Setup Steps:**

1. **Navigate to Forge App:**
   ```bash
   cd C:\Users\VishnuK\Desktop\jira1\forge-app
   ```

2. **Login to Forge:**
   ```bash
   forge login
   # Follow browser authentication flow
   ```

3. **Register New App (Sandbox):**
   ```bash
   forge register

   # When prompted:
   App name: brd-time-tracker-sandbox
   # This creates a new app ID for sandbox
   ```

4. **Update manifest.yml for Sandbox:**
   ```yaml
   app:
     id: ari:cloud:ecosystem::app/[new-sandbox-app-id]
     name: BRD Time Tracker (Sandbox)

   permissions:
     scopes:
       - read:jira-work
       - write:jira-work
       - read:jira-user
       - storage:app

   modules:
     jira:globalPage:
       - key: timetracker-sandbox-page
         title: Time Tracker (Sandbox)
         resource: main
   ```

5. **Configure Sandbox Supabase:**
   ```javascript
   // In src/config/index.js or environment handler
   const SANDBOX_CONFIG = {
     SUPABASE_URL: 'https://[sandbox-project].supabase.co',
     SUPABASE_ANON_KEY: '[sandbox-anon-key]'
   };
   ```

6. **Deploy to Development Environment:**
   ```bash
   # Build first
   forge build

   # Deploy to development
   forge deploy --environment development
   ```

7. **Install on Sandbox Jira Site:**
   ```bash
   forge install --environment development

   # When prompted:
   # Enter the site URL: brd-timetracker-dev.atlassian.net
   ```

8. **View Logs:**
   ```bash
   forge logs --environment development
   ```

### 6.2 Forge Tunnel for Local Development

**For rapid development and debugging:**

1. **Start Forge Tunnel:**
   ```bash
   cd C:\Users\VishnuK\Desktop\jira1\forge-app
   forge tunnel
   ```

2. **What Tunnel Does:**
   - Runs code locally
   - Hot-reload on file changes
   - Faster iteration
   - Full debugging access

3. **View Local Logs:**
   ```bash
   # In another terminal
   forge logs --follow
   ```

**Note:** Tunnel requires keeping terminal open and is for development only.

---

## 7. Testing Environment

### 7.1 Desktop App Testing

**Create Test Build:**

1. **Navigate to Desktop App:**
   ```bash
   cd C:\Users\VishnuK\Desktop\jira1\python-desktop-app
   ```

2. **Create Virtual Environment:**
   ```bash
   python -m venv venv-sandbox
   venv-sandbox\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create Sandbox Config:**
   ```python
   # config_sandbox.py
   SUPABASE_URL = "https://[sandbox-project].supabase.co"
   SUPABASE_KEY = "[sandbox-anon-key]"

   JIRA_OAUTH_CLIENT_ID = "[sandbox-oauth-client-id]"
   JIRA_OAUTH_CLIENT_SECRET = "[sandbox-oauth-client-secret]"
   JIRA_REDIRECT_URI = "http://localhost:8000/callback"

   # Screenshot settings for faster testing
   SCREENSHOT_INTERVAL = 60  # 1 minute instead of 5 minutes
   ```

5. **Run with Sandbox Config:**
   ```bash
   python desktop_app.py --config config_sandbox.py
   ```

### 7.2 Integration Testing

**Test Scenarios:**

1. **User Onboarding Flow:**
   - Register new test user
   - OAuth flow with sandbox Jira
   - Organization creation
   - First screenshot capture

2. **Screenshot Processing:**
   - Capture test screenshot
   - Verify upload to Supabase sandbox
   - Check AI server processing
   - Verify analysis results

3. **Forge App Integration:**
   - Open Forge app in sandbox Jira
   - Verify time analytics display
   - Test unassigned work clustering
   - Test issue assignment

4. **Multi-Tenancy:**
   - Create multiple test organizations
   - Verify data isolation
   - Test RLS policies

### 7.3 Automated Testing

**Unit Tests:**

```bash
# AI Server tests
cd ai-server
npm test

# Forge App tests (if implemented)
cd forge-app
forge test
```

**Integration Tests:**

```javascript
// Example integration test
describe('Sandbox Integration Tests', () => {
  it('should process screenshot end-to-end', async () => {
    // 1. Upload screenshot
    const screenshot = await uploadTestScreenshot();

    // 2. Wait for AI processing
    await waitForProcessing(screenshot.id);

    // 3. Verify results
    const analysis = await getAnalysisResult(screenshot.id);
    expect(analysis.active_task_key).toBeDefined();
  });
});
```

---

## 8. Data Management

### 8.1 Sandbox Data Strategy

**Principles:**
- No production data in sandbox
- Synthetic data that mimics production
- Regular data refresh
- Easy reset capability

### 8.2 Data Generation Scripts

**Generate Test Data:**

```javascript
// scripts/generate-sandbox-data.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SANDBOX_SUPABASE_URL,
  process.env.SANDBOX_SUPABASE_KEY
);

async function generateTestData() {
  // Create 5 test organizations
  for (let i = 1; i <= 5; i++) {
    const org = await supabase
      .from('organizations')
      .insert({
        jira_cloud_id: `sandbox-org-${i}`,
        org_name: `Test Company ${i}`,
        jira_instance_url: `https://test-${i}.atlassian.net`,
        subscription_status: 'active',
        subscription_tier: i <= 2 ? 'free' : 'professional'
      })
      .select()
      .single();

    // Create 3-10 users per org
    const userCount = Math.floor(Math.random() * 8) + 3;
    for (let j = 1; j <= userCount; j++) {
      await supabase
        .from('users')
        .insert({
          atlassian_account_id: `test-user-${i}-${j}`,
          email: `testuser${j}@testcompany${i}.com`,
          display_name: `Test User ${j}`,
          organization_id: org.data.id
        });
    }
  }

  console.log('Test data generated successfully');
}

generateTestData();
```

**Run Script:**

```bash
node scripts/generate-sandbox-data.js
```

### 8.3 Sandbox Reset

**Complete Environment Reset:**

```sql
-- WARNING: This deletes ALL data in sandbox

-- 1. Disable RLS temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results DISABLE ROW LEVEL SECURITY;
-- ... (disable for all tables)

-- 2. Delete all data
DELETE FROM public.worklogs;
DELETE FROM public.analysis_results;
DELETE FROM public.screenshots;
DELETE FROM public.user_jira_issues_cache;
DELETE FROM public.unassigned_work_groups;
DELETE FROM public.unassigned_activity;
DELETE FROM public.organization_members;
DELETE FROM public.users;
DELETE FROM public.organization_settings;
DELETE FROM public.organizations;

-- 3. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
-- ... (enable for all tables)

-- 4. Re-run seed data script
```

**Create Reset Script:**

```bash
# scripts/reset-sandbox.sh
#!/bin/bash

echo "Resetting sandbox environment..."

# Reset database
psql $SANDBOX_DATABASE_URL -f scripts/reset-sandbox.sql

# Generate fresh test data
node scripts/generate-sandbox-data.js

# Clear storage bucket
supabase storage empty screenshots --project-ref [sandbox-ref]

echo "Sandbox reset complete!"
```

---

## 9. CI/CD Pipeline

### 9.1 GitHub Actions for Sandbox

**Create Workflow File:**

```yaml
# .github/workflows/deploy-sandbox.yml
name: Deploy to Sandbox

on:
  push:
    branches:
      - develop  # Sandbox branch
  pull_request:
    branches:
      - develop

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install AI Server Dependencies
        run: |
          cd ai-server
          npm ci

      - name: Run Tests
        run: |
          cd ai-server
          npm test

  deploy-forge-sandbox:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Forge CLI
        run: npm install -g @forge/cli

      - name: Deploy to Forge Sandbox
        env:
          FORGE_EMAIL: ${{ secrets.FORGE_EMAIL }}
          FORGE_API_TOKEN: ${{ secrets.FORGE_API_TOKEN }}
        run: |
          cd forge-app
          forge deploy --environment development --no-verify

  deploy-ai-server-sandbox:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Render
        env:
          RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}
        run: |
          # Trigger Render deployment via API
          curl -X POST "https://api.render.com/v1/services/[sandbox-service-id]/deploys" \
            -H "Authorization: Bearer $RENDER_API_KEY"
```

### 9.2 Automated Testing in CI/CD

**Add Test Step:**

```yaml
- name: Run Integration Tests
  env:
    SANDBOX_SUPABASE_URL: ${{ secrets.SANDBOX_SUPABASE_URL }}
    SANDBOX_SUPABASE_KEY: ${{ secrets.SANDBOX_SUPABASE_KEY }}
  run: |
    cd ai-server
    npm run test:integration
```

### 9.3 Branch Strategy

```
main (production)
  ├── develop (sandbox/staging)
  │    ├── feature/new-feature-1
  │    └── feature/new-feature-2
  └── hotfix/critical-bug
```

**Workflow:**
1. Develop features in `feature/*` branches
2. Merge to `develop` → Auto-deploy to sandbox
3. Test in sandbox environment
4. Merge `develop` to `main` → Deploy to production

---

## 10. Best Practices

### 10.1 Environment Variable Management

**Never Hardcode Secrets:**

```javascript
// ❌ BAD
const supabaseUrl = 'https://xyz.supabase.co';

// ✅ GOOD
const supabaseUrl = process.env.SUPABASE_URL;
```

**Use Environment-Specific Files:**

```
.env.local          # Local development
.env.sandbox        # Sandbox/staging
.env.production     # Production (never commit!)
.env.example        # Template (safe to commit)
```

### 10.2 Sandbox Usage Guidelines

**DO:**
- Test all new features in sandbox first
- Use synthetic data
- Reset sandbox regularly (weekly)
- Document test scenarios
- Monitor costs (OpenAI, infrastructure)

**DON'T:**
- Use production data in sandbox
- Share sandbox credentials publicly
- Skip sandbox testing
- Leave sandbox running unused
- Use production API keys in sandbox

### 10.3 Cost Management

**Monitor Sandbox Costs:**

1. **Supabase:**
   - Check dashboard for storage/bandwidth usage
   - Stay within free tier limits
   - Set up billing alerts

2. **OpenAI API:**
   - Set monthly spending limit: $20
   - Monitor usage in OpenAI dashboard
   - Use cheaper models for non-critical tests

3. **Infrastructure:**
   - Use free tiers where possible
   - Shut down resources when not in use
   - Scale down instance sizes

**Estimated Monthly Sandbox Costs:**
- Supabase: $0 (free tier)
- AI Server: $0-7 (free tier or basic hosting)
- OpenAI: $10-20 (with spending limits)
- **Total: $10-27/month**

### 10.4 Security in Sandbox

**Sandbox-Specific Security:**

1. **Separate OAuth Apps:**
   - Different client IDs/secrets for sandbox
   - Different callback URLs

2. **Limited Permissions:**
   - Sandbox users should have restricted access
   - No access to production systems

3. **Regular Credential Rotation:**
   - Rotate sandbox API keys quarterly
   - Update OAuth credentials if compromised

4. **Access Control:**
   - Only development team has sandbox access
   - No customer access to sandbox

### 10.5 Documentation

**Maintain Sandbox Docs:**

```markdown
# Sandbox Access Guide

## URLs
- Jira Sandbox: https://brd-timetracker-dev.atlassian.net
- Forge App: [Install URL]
- AI Server: https://sandbox-api.yourdomain.com

## Test Accounts
- Admin: admin@sandbox.com (password in 1Password)
- Developer: dev@sandbox.com (password in 1Password)
- Manager: manager@sandbox.com (password in 1Password)

## Test Data
- Organization: Test Company (ID: xxx)
- Project: TEST
- Sample Issues: TEST-1 through TEST-10

## Reset Schedule
- Full reset: Every Monday 9 AM UTC
- Database backup: Daily at midnight UTC
```

---

## 11. Troubleshooting

### Common Sandbox Issues

**Issue 1: Forge App Not Updating**

```bash
# Solution: Force reinstall
forge uninstall --environment development
forge deploy --environment development
forge install --environment development
```

**Issue 2: Supabase Connection Errors**

```bash
# Check connection
curl https://[sandbox-project].supabase.co/rest/v1/

# Verify API keys in environment variables
echo $SUPABASE_URL
echo $SUPABASE_KEY
```

**Issue 3: AI Server Not Processing**

```bash
# Check logs
forge logs --environment development

# Verify webhook configuration
# Check Supabase database triggers
```

**Issue 4: OAuth Authentication Fails**

```
# Verify callback URL matches
# Check OAuth app configuration
# Ensure correct client ID/secret
```

---

## 12. Sandbox Maintenance Checklist

### Daily
- [ ] Check AI server logs for errors
- [ ] Monitor OpenAI API usage
- [ ] Verify screenshot processing is working

### Weekly
- [ ] Review and clean up test data
- [ ] Check storage usage in Supabase
- [ ] Update dependencies if needed
- [ ] Run integration tests

### Monthly
- [ ] Full sandbox reset
- [ ] Rotate API keys (if policy requires)
- [ ] Review and update test scenarios
- [ ] Check for Forge platform updates
- [ ] Review infrastructure costs

### Quarterly
- [ ] Security audit of sandbox
- [ ] Update all dependencies
- [ ] Review and optimize test data
- [ ] Conduct disaster recovery test

---

## 13. Sandbox to Production Checklist

Before promoting code from sandbox to production:

- [ ] All integration tests passing
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Database migration tested in sandbox
- [ ] Rollback plan documented
- [ ] Production environment variables prepared
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Stakeholder approval obtained
- [ ] Backup taken of production database
- [ ] Deployment scheduled during low-traffic window

---

**Document End**

This sandbox environment setup provides a complete isolated testing environment for development, QA, and demos without affecting production systems.

For questions or support, contact the development team.
