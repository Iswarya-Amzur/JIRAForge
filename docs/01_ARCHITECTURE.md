# BRD Time Tracker - Detailed Architecture Documentation

**Document Version:** 1.0
**Date:** December 4, 2025
**Prepared for:** Management Review

---

## Executive Summary

BRD Time Tracker is a comprehensive time tracking solution integrated with Atlassian Jira via the Forge platform. The system automatically captures work activities, uses AI to categorize them, and syncs time logs with Jira issues.

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ENVIRONMENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Desktop Application (Python)                    │  │
│  │  - Screenshot Capture (every 5 min)                       │  │
│  │  - Activity Monitoring                                     │  │
│  │  - Jira OAuth Authentication                              │  │
│  │  - Data Upload to Supabase                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                    │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      CLOUD INFRASTRUCTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Supabase (PostgreSQL + Storage)               │ │
│  │  - User Data & Organizations                              │ │
│  │  - Screenshots (S3-compatible storage)                    │ │
│  │  - Analysis Results                                       │ │
│  │  - Time Tracking Data                                     │ │
│  │  - RLS (Row Level Security) for Multi-tenancy            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓ ↑                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              AI Server (Node.js + OpenAI)                  │ │
│  │  - Screenshot Analysis (GPT-4 Vision)                     │ │
│  │  - Task Detection & Classification                        │ │
│  │  - Work Type Detection (Office/Non-office)                │ │
│  │  - Unassigned Work Clustering                             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓ ↑                                 │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ATLASSIAN JIRA CLOUD                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Forge App (Atlassian Platform)                │ │
│  │  - Time Analytics UI                                       │ │
│  │  - Unassigned Work Management                             │ │
│  │  - Settings & Configuration                               │ │
│  │  - Worklog Creation                                       │ │
│  │  - User Permissions & RBAC                                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓ ↑                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                 Jira REST API                              │ │
│  │  - Issue Management                                        │ │
│  │  - Worklog API                                            │ │
│  │  - User & Project Data                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Desktop Application (Python)

**Technology Stack:**
- Python 3.x
- Libraries: `tkinter`, `pillow`, `mss`, `pyautogui`, `requests`, `supabase-py`

**Key Features:**
- **Screenshot Capture**: Captures screen every 5 minutes (configurable)
- **Activity Monitoring**: Tracks active window, application, and idle time
- **OAuth Authentication**: Atlassian OAuth 2.0 for Jira integration
- **Data Upload**: Uploads screenshots and metadata to Supabase
- **Organization Registration**: Automatically creates/links organizations by Jira Cloud ID

**Architecture:**
```
Desktop App
├── Authentication Module
│   ├── OAuth 2.0 Flow
│   ├── Token Management (Access + Refresh)
│   └── Jira Cloud ID Extraction
├── Screenshot Capture
│   ├── Screen Capture (mss)
│   ├── Thumbnail Generation
│   └── Image Compression
├── Activity Monitor
│   ├── Window Title Tracking
│   ├── Application Name Detection
│   └── Idle Time Detection
├── Data Sync
│   ├── Supabase Client
│   ├── Screenshot Upload (Storage)
│   └── Metadata Upload (PostgreSQL)
└── Organization Management
    ├── Organization Registration
    ├── User-Organization Linking
    └── Membership Creation
```

**Multi-Tenancy Implementation:**
- Extracts `jira_cloud_id` from Atlassian accessible-resources API
- Creates/updates organization record in Supabase
- Links user to organization
- All uploaded data tagged with `organization_id`

---

### 2.2 Supabase Backend

**Technology Stack:**
- PostgreSQL 15+ (with pgvector for future AI features)
- Supabase Storage (S3-compatible)
- Row Level Security (RLS) Policies

**Database Schema:**

```
Organizations (Multi-tenancy)
├── organizations
│   ├── id (UUID, PK)
│   ├── jira_cloud_id (Unique identifier from Atlassian)
│   ├── org_name
│   ├── jira_instance_url
│   ├── subscription_status
│   └── subscription_tier
├── organization_members
│   ├── user_id → users(id)
│   ├── organization_id → organizations(id)
│   ├── role (owner, admin, manager, member)
│   └── permissions (JSONB)
└── organization_settings
    ├── organization_id → organizations(id)
    ├── screenshot_interval
    └── auto_worklog_enabled

Core Data
├── users
│   ├── id (UUID, PK)
│   ├── organization_id → organizations(id)
│   ├── atlassian_account_id (Unique)
│   ├── email
│   └── display_name
├── screenshots
│   ├── id (UUID, PK)
│   ├── user_id → users(id)
│   ├── organization_id → organizations(id)
│   ├── storage_path
│   ├── thumbnail_url
│   ├── window_title
│   ├── application_name
│   └── timestamp
└── analysis_results
    ├── id (UUID, PK)
    ├── screenshot_id → screenshots(id)
    ├── user_id → users(id)
    ├── organization_id → organizations(id)
    ├── active_task_key (JIRA-123)
    ├── active_project_key
    ├── time_spent_seconds
    ├── work_type (office/non-office)
    ├── confidence_score
    └── ai_model_version

Analytics & Views
├── daily_time_summary (VIEW)
│   └── Aggregated by user, date, organization
├── weekly_time_summary (VIEW)
│   └── Aggregated by user, week, organization
├── project_time_summary (VIEW)
│   └── Time spent per project
└── unassigned_activity (VIEW)
    └── Work not linked to Jira tasks
```

**Multi-Tenancy Design:**
- Every table has `organization_id` column
- RLS policies enforce organization-level data isolation
- Queries automatically filter by `organization_id`
- Foreign key constraints ensure referential integrity

**Storage Structure:**
```
screenshots/
└── {organization_id}/
    └── {user_id}/
        ├── screenshot_{timestamp}.png
        └── thumb_{timestamp}.jpg
```

---

### 2.3 AI Server (Node.js)

**Technology Stack:**
- Node.js 20+
- OpenAI GPT-4o (Vision API)
- Supabase JavaScript Client

**Architecture:**
```
AI Server
├── Polling Service
│   ├── Fetch pending screenshots (every 30s)
│   ├── Download from Supabase Storage
│   └── Trigger analysis
├── Screenshot Analysis
│   ├── GPT-4 Vision Analysis (Primary)
│   │   ├── Image analysis
│   │   ├── Window title context
│   │   ├── User's assigned issues
│   │   └── Task detection
│   └── OCR + AI (Fallback)
│       ├── Tesseract OCR
│       └── GPT-4 Text Analysis
├── Work Classification
│   ├── Office vs Non-office detection
│   ├── Jira task key extraction
│   └── Confidence scoring
├── Clustering Service
│   ├── Poll unassigned activities
│   ├── AI-powered grouping
│   └── Issue recommendations
└── Result Storage
    ├── Save to analysis_results
    ├── Update screenshot status
    └── Create unassigned_activity records
```

**AI Analysis Flow:**
```
1. Poll Supabase for pending screenshots
2. Download screenshot image
3. Fetch user's assigned Jira issues (from cache)
4. Send to GPT-4 Vision:
   - Image
   - Window title
   - Application name
   - User's assigned issues
5. GPT-4 returns:
   - work_type: "office" or "non-office"
   - task_key: "JIRA-123" or null
   - confidence_score: 0.0 - 1.0
   - reasoning: AI's explanation
6. Save analysis result to Supabase
7. If no task_key → Save to unassigned_activity
```

**Multi-Tenancy:**
- Processes screenshots from all organizations
- Each screenshot has `organization_id`
- Analysis results inherit `organization_id` from screenshot
- Clustering groups unassigned work by user + organization

---

### 2.4 Forge App (Atlassian Platform)

**Technology Stack:**
- Atlassian Forge (Serverless platform)
- React (UI)
- Forge APIs (Storage, Jira API)

**Architecture:**
```
Forge App
├── UI Modules (React)
│   ├── Global Page: Time Analytics
│   │   ├── Daily/Weekly summaries
│   │   ├── Project breakdown
│   │   ├── Issue-level tracking
│   │   └── Team analytics (for admins)
│   ├── Issue Panel: Task Time Tracker
│   │   ├── Time spent on this issue
│   │   ├── Recent activity
│   │   └── Screenshot previews
│   └── Admin Settings
│       ├── Supabase configuration
│       ├── Screenshot interval
│       └── Auto-worklog settings
├── Backend Resolvers
│   ├── Analytics Service
│   │   ├── fetchTimeAnalytics()
│   │   ├── fetchAllAnalytics() (Admin)
│   │   └── fetchProjectAnalytics()
│   ├── Screenshot Service
│   │   ├── getScreenshots()
│   │   └── deleteScreenshot()
│   ├── Unassigned Work
│   │   ├── getUnassignedWork()
│   │   ├── getUnassignedGroups()
│   │   ├── assignToExistingIssue()
│   │   └── createIssueAndAssign()
│   └── Issue Service
│       ├── getActiveIssuesWithTime()
│       └── updateIssuesCache()
└── Utilities
    ├── Supabase Client
    │   ├── getOrCreateOrganization()
    │   ├── getOrCreateUser()
    │   └── getUserOrganizationMembership()
    └── Jira Utils
        ├── isJiraAdmin()
        ├── checkUserPermissions()
        └── createJiraIssue()
```

**Multi-Tenancy Implementation:**
- Extracts `cloudId` from Forge context (`context.cloudId`)
- Gets/creates organization by `jira_cloud_id = cloudId`
- All Supabase queries filter by `organization_id`
- Users see only their organization's data

**Permissions Model:**
```
Role: Owner (First user in organization)
- Can manage settings
- Can view team analytics
- Can manage members
- Can delete screenshots
- Can manage billing

Role: Admin
- Can manage settings
- Can view team analytics
- Can manage members
- Can delete screenshots

Role: Manager
- Can view team analytics

Role: Member
- Can view own data only
```

---

## 3. Data Flow

### 3.1 Screenshot Capture & Analysis Flow

```
1. Desktop App (Every 5 min)
   ↓
   - Capture screenshot
   - Get active window title
   - Get application name
   - Detect if idle
   ↓
2. Upload to Supabase
   ↓
   - Store image in Storage (screenshots/{org_id}/{user_id}/...)
   - Insert record in screenshots table with organization_id
   ↓
3. AI Server Polling (Every 30s)
   ↓
   - Fetch pending screenshots (status='pending')
   - Download image from Storage
   ↓
4. AI Analysis (GPT-4 Vision)
   ↓
   - Analyze screenshot image
   - Match with user's assigned Jira issues
   - Classify work type (office/non-office)
   - Detect task key
   ↓
5. Save Analysis Result
   ↓
   - Insert into analysis_results with organization_id
   - Update screenshot status to 'analyzed'
   - If no task_key → trigger creates unassigned_activity
   ↓
6. Forge App Display
   ↓
   - User views analytics (filtered by organization_id)
   - Admin views team analytics (filtered by organization_id)
```

### 3.2 Unassigned Work Clustering Flow

```
1. AI Server Polling (Every 5 min)
   ↓
   - Fetch users with unassigned activities (grouped by user + org)
   ↓
2. For each user + organization
   ↓
   - Check if already clustered recently (cooldown: 24h)
   - Fetch unassigned activities (min 2 sessions)
   - Fetch user's active Jira issues
   ↓
3. AI Clustering (GPT-4)
   ↓
   - Group similar activities
   - Suggest issue to assign
   - Provide confidence level
   ↓
4. Save Groups
   ↓
   - Insert into unassigned_work_groups with organization_id
   - Link sessions to groups (unassigned_group_members)
   ↓
5. User Review in Forge App
   ↓
   - View suggested groups
   - Assign to existing issue OR
   - Create new issue from group
```

### 3.3 Multi-Tenancy Data Isolation

```
Request Flow (Example: Get Time Analytics)

1. User opens Forge app in Jira
   ↓
2. Forge context provides:
   - accountId: "712020:abc..."
   - cloudId: "39b6eab6-88fd-45b6-8bbc-dad801bac3bd"
   ↓
3. Resolver: getTimeAnalytics(accountId, cloudId)
   ↓
4. Get/Create Organization:
   - Query: organizations WHERE jira_cloud_id = cloudId
   - Result: organization_id = "29a10bbb-..."
   ↓
5. Get/Create User:
   - Query: users WHERE atlassian_account_id = accountId
   - Link user to organization_id
   ↓
6. Fetch Analytics:
   - Query: daily_time_summary
     WHERE user_id = userId
     AND organization_id = organization_id
   ↓
7. Return Data (only this organization's data)
```

---

## 4. Security Architecture

### 4.1 Authentication & Authorization

**Desktop App:**
- OAuth 2.0 with Atlassian
- PKCE flow for security
- Token refresh mechanism
- Secure token storage (OS keychain)

**Forge App:**
- Atlassian Platform authentication
- Context-based user identification
- RBAC via organization_members table

**Supabase:**
- Service Role Key (server-side only)
- Row Level Security (RLS) policies
- Organization-level data isolation

### 4.2 Row Level Security (RLS) Policies

```sql
-- Example: Screenshots table RLS
CREATE POLICY "Users can only view their organization's screenshots"
ON screenshots FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM users
    WHERE id = auth.uid()
  )
);

-- Admins can view all in their organization
CREATE POLICY "Admins can view team screenshots"
ON screenshots FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
    AND om.can_view_team_analytics = true
  )
);
```

### 4.3 Data Privacy

- **Screenshot Encryption**: At rest in Supabase Storage
- **Access Control**: Signed URLs with expiration (1 hour)
- **Data Retention**: Configurable per organization
- **GDPR Compliance**: User data deletion on request
- **Soft Deletes**: Screenshots marked as deleted, not hard deleted

---

## 5. Scalability & Performance

### 5.1 Current Capacity

| Metric | Capacity |
|--------|----------|
| Screenshots/day per user | ~96 (every 5 min for 8h) |
| Users per organization | 1,000+ |
| Organizations | Unlimited |
| AI analysis time | ~2-5 seconds per screenshot |
| Storage per user/month | ~500 MB (compressed) |

### 5.2 Scaling Strategy

**Horizontal Scaling:**
- AI Server: Multiple instances behind load balancer
- Supabase: Auto-scaling PostgreSQL
- Forge: Serverless (auto-scales)

**Optimization:**
- Screenshot compression (JPG thumbnails)
- Signed URL caching
- Database indexing on organization_id, user_id, timestamp
- Materialized views for analytics

### 5.3 Cost Optimization

- Image compression reduces storage by 70%
- Thumbnail generation (200x150) for previews
- AI analysis only on "pending" screenshots
- View caching reduces query load

---

## 6. Deployment Architecture

### 6.1 Environments

```
Development
├── Forge: development environment
├── Supabase: Dev project
└── AI Server: Local/Dev instance

Production
├── Forge: production environment
├── Supabase: Production project
└── AI Server: Cloud deployment (e.g., AWS/Azure)
```

### 6.2 CI/CD Pipeline

```
Code Changes
↓
GitHub Repository
↓
CI Pipeline (GitHub Actions)
├── Run tests
├── Build Forge app (npm run build)
├── Deploy AI Server (Docker)
└── Run migrations (Supabase)
↓
Deployment
├── forge deploy --environment production
├── AI Server: Deploy to cloud
└── Database: Run migrations
```

---

## 7. Integration Points

### 7.1 Atlassian Jira

**APIs Used:**
- `/rest/api/3/myself` - Current user info
- `/rest/api/3/issue/{issueKey}` - Issue details
- `/rest/api/3/issue/{issueKey}/worklog` - Worklog creation
- `/rest/api/3/search` - JQL queries for user's issues
- `/rest/api/3/mypermissions` - Permission checks
- `/oauth/token/accessible-resources` - Get Jira Cloud ID

**Webhooks:**
- Issue created/updated → Update cache
- User assigned/unassigned → Refresh issues

### 7.2 Supabase

**APIs Used:**
- REST API for CRUD operations
- Storage API for screenshots
- Realtime (future feature for live updates)

### 7.3 OpenAI

**APIs Used:**
- GPT-4o Vision API for screenshot analysis
- GPT-4o for text-based clustering
- Token usage: ~500-1000 tokens per screenshot

---

## 8. Monitoring & Observability

### 8.1 Logging

**Desktop App:**
- Local logs (rotated daily)
- Error tracking to Supabase

**AI Server:**
- Structured logging (Winston)
- Log aggregation (CloudWatch/Datadog)

**Forge App:**
- `forge logs` for production monitoring
- Error tracking in Atlassian console

### 8.2 Metrics

- Screenshot processing rate
- AI analysis success rate
- API response times
- Storage usage per organization
- Active users per organization

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

**Supabase:**
- Automated daily backups
- Point-in-time recovery (7 days)
- Manual backup trigger available

**Screenshots:**
- Replicated across availability zones
- Versioning enabled on Storage bucket

### 9.2 Recovery Procedures

1. **Database Failure**: Restore from latest backup
2. **Storage Failure**: Restore from replicated copy
3. **AI Server Failure**: Auto-restart, queue processing resumes
4. **Forge App Failure**: Atlassian handles (99.9% uptime SLA)

---

## 10. Future Enhancements

### 10.1 Planned Features

1. **Real-time Activity Tracking**: Live updates via Supabase Realtime
2. **Advanced Analytics**: ML-powered productivity insights
3. **Mobile App**: iOS/Android for time tracking
4. **Integrations**: Slack, Teams, Calendar sync
5. **Automated Reporting**: Weekly/monthly reports
6. **Custom Workflows**: Configurable approval flows

### 10.2 Architecture Evolution

```
Phase 2: Advanced Analytics
├── Machine Learning Models
│   ├── Productivity pattern detection
│   ├── Task estimation
│   └── Anomaly detection
├── Data Warehouse
│   └── BigQuery/Snowflake for analytics
└── Business Intelligence
    └── Tableau/Looker dashboards

Phase 3: Enterprise Features
├── SSO Integration (SAML/OIDC)
├── Advanced RBAC
├── Audit Logs
├── Compliance Reports (SOC 2, GDPR)
└── Custom integrations via Webhooks
```

---

## Appendix

### A. Technology Stack Summary

| Component | Technology |
|-----------|------------|
| Desktop App | Python 3.x, tkinter, Supabase |
| Database | PostgreSQL 15 (Supabase) |
| Storage | S3-compatible (Supabase Storage) |
| AI Engine | OpenAI GPT-4o Vision |
| Backend | Node.js 20, Forge Resolvers |
| Frontend | React, Forge UI Kit |
| Deployment | Atlassian Forge, Cloud VMs |

### B. Dependencies

**NPM Packages (Forge App):**
- `@forge/api` - Forge platform APIs
- `@forge/resolver` - Resolver framework
- `@supabase/supabase-js` - Supabase client

**NPM Packages (AI Server):**
- `@supabase/supabase-js` - Supabase client
- `openai` - OpenAI API client
- `sharp` - Image processing
- `tesseract.js` - OCR (fallback)

**Python Packages (Desktop App):**
- `supabase` - Supabase client
- `requests` - HTTP client
- `pillow` - Image processing
- `mss` - Screenshot capture

---

**End of Document**
