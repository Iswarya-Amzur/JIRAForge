# BRD Time Tracker - Complete Architecture Guide

> **Application Name**: BRD Time Tracker (JIRAForge)  
> **Purpose**: Automated time tracking solution integrated with Atlassian Jira via the Forge platform  
> **Generated**: 2026-02-18

---

## 📊 Generated Diagrams

| Diagram | Description | Location |
|---------|-------------|----------|
| Full Architecture | System component overview | [full-architecture-diagram.svg](generated-diagrams/full-architecture-diagram.svg) |
| Data Flow Sequence | Step-by-step processing flow | [data-flow-sequence.svg](generated-diagrams/data-flow-sequence.svg) |
| Database Schema | ER diagram with relationships | [database-schema.svg](generated-diagrams/database-schema.svg) |
| Tech Stack Overview | Technologies and features | [tech-stack-overview.svg](generated-diagrams/tech-stack-overview.svg) |

---

## 🏗️ System Architecture Overview

The BRD Time Tracker consists of **4 main components** that work together:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              HIGH-LEVEL ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌──────────────────┐                                        ┌──────────────────────┐  │
│   │  Desktop App     │──────Upload Screenshots───────────────▶│  Supabase Platform   │  │
│   │  (Python)        │                                        │  (PostgreSQL + S3)   │  │
│   │                  │◀─────OAuth Authentication──────────────│                      │  │
│   └──────────────────┘                                        └──────────┬───────────┘  │
│          │                                                               │               │
│          │ User's Workstation                                           │ Cloud         │
│          ▼                                                               ▼               │
│   ┌──────────────────┐                                        ┌──────────────────────┐  │
│   │  User works      │                                        │  AI Server           │  │
│   │  • Coding        │                                        │  (Node.js)           │  │
│   │  • Meetings      │     Polls screenshots every 30s        │  • GPT-4 Analysis    │  │
│   │  • Documentation │◀──────────────────────────────────────▶│  • OCR Fallback      │  │
│   └──────────────────┘                                        └──────────┬───────────┘  │
│                                                                          │               │
│                                                                          ▼               │
│                              ┌────────────────────────────────────────────────────────┐ │
│                              │              Atlassian Jira Cloud                       │ │
│                              │  ┌──────────────────────────────────────────────────┐  │ │
│                              │  │  Forge App (Time Analytics UI)                   │  │ │
│                              │  │  • View time tracking dashboards                 │  │ │
│                              │  │  • Manage unassigned work                        │  │ │
│                              │  │  • Create worklogs                               │  │ │
│                              │  └──────────────────────────────────────────────────┘  │ │
│                              └────────────────────────────────────────────────────────┘ │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Component Details

### 1. Python Desktop Application

**Location**: `python-desktop-app/`

| Aspect | Details |
|--------|---------|
| **Purpose** | Capture screenshots and track user activity on workstations |
| **Language** | Python 3.x |
| **Key Libraries** | Flask, Pillow, pywin32, pystray, supabase-py, pynput |

**Features**:
- 📸 **Screenshot Capture**: Every 5 minutes (configurable)
- 🖥️ **Window Tracking**: Active window title and application name
- ⏸️ **Idle Detection**: Skips capture when user is idle (>5 min)
- 🔄 **Duplicate Detection**: MD5 hash to skip unchanged screenshots
- 🔐 **OAuth 2.0**: Atlassian 3LO authentication for Jira integration
- 📤 **Data Upload**: Screenshots and metadata to Supabase

**Internal Architecture**:
```
Desktop App
├── Authentication Module
│   ├── OAuth 2.0 Flow (Atlassian 3LO)
│   ├── Token Management (Access + Refresh)
│   └── Jira Cloud ID Extraction
├── Screenshot Capture Module
│   ├── Screen Capture (mss/ImageGrab)
│   ├── Thumbnail Generation
│   ├── Image Compression
│   └── Duplicate Detection (MD5)
├── Activity Monitor
│   ├── Window Title Tracking (win32gui)
│   ├── Application Name Detection
│   └── Idle Time Detection (pynput)
├── Data Sync Module
│   ├── Supabase Client
│   ├── Screenshot Upload (Storage)
│   └── Metadata Upload (PostgreSQL)
└── System Tray Integration
    ├── Start/Stop Controls
    └── Status Notifications
```

---

### 2. Supabase Backend

**Location**: `supabase/`

| Aspect | Details |
|--------|---------|
| **Purpose** | Central data storage, API layer, and file storage |
| **Database** | PostgreSQL 15+ via Supabase |
| **Storage** | S3-compatible object storage for screenshots |
| **Functions** | Deno Edge Functions for webhooks (backup) |

**Database Schema**:
```
Core Tables:
├── organizations          # Jira Cloud instances (tenants)
├── organization_members   # User-org relationships with roles
├── organization_settings  # Per-org configuration
├── users                  # User accounts linked to Atlassian
├── screenshots            # Screenshot metadata
├── analysis_results       # AI analysis output
├── unassigned_activity    # Work not linked to Jira tasks
├── unassigned_work_groups # AI-clustered work groups
├── user_jira_issues_cache # Cached assigned issues

Views (Analytics):
├── daily_time_summary     # Aggregated by user + date
├── weekly_time_summary    # Aggregated by user + week
├── project_time_summary   # Time per project
└── unassigned_activity    # Work needing assignment
```

**Storage Structure**:
```
screenshots/
└── {organization_id}/
    └── {user_id}/
        ├── screenshot_{timestamp}.png   # Full resolution
        └── thumb_{timestamp}.jpg        # Thumbnail
```

**Multi-Tenancy Enforcement**:
- Every table has `organization_id` column
- Row Level Security (RLS) policies enforce data isolation
- All queries automatically filtered by organization
- Foreign key constraints ensure referential integrity

---

### 3. AI Server (Node.js)

**Location**: `ai-server/`

| Aspect | Details |
|--------|---------|
| **Purpose** | Process screenshots, extract work context, detect Jira tasks |
| **Language** | Node.js 20+ |
| **AI Provider** | OpenAI GPT-4 Vision (primary) + GPT-4 Text (fallback) |
| **OCR** | Tesseract.js for text extraction |

**Key Services**:

| Service | Interval | Function |
|---------|----------|----------|
| **Polling Service** | Every 30s | Fetches pending screenshots, triggers analysis |
| **Screenshot Analyzer** | On-demand | Sends images to GPT-4 Vision API |
| **Clustering Service** | Every 5 min | Groups unassigned activities using AI |

**Analysis Flow**:
```
1. Poll Supabase for screenshots WHERE status='pending'
2. Download screenshot image from Storage
3. Fetch user's assigned Jira issues from cache
4. Send to GPT-4 Vision:
   ├── Image (base64 encoded)
   ├── Window title
   ├── Application name
   └── User's assigned Jira issue keys
5. GPT-4 returns:
   ├── work_type: "office" or "non-office"
   ├── task_key: "PROJ-123" or null
   ├── confidence_score: 0.0 - 1.0
   └── reasoning: Explanation of detection
6. Save to analysis_results table
7. If no task_key detected → Create unassigned_activity record
```

**Internal Architecture**:
```
AI Server
├── API Routes
│   ├── POST /api/analyze-screenshot  # Webhook endpoint (backup)
│   ├── GET /health                   # Health check
│   └── POST /api/cluster             # Manual clustering trigger
├── Services
│   ├── pollingService                # Main processing loop
│   ├── screenshotAnalyzer            # AI analysis logic
│   ├── imagePreprocessor             # Sharp image optimization
│   ├── ocrService                    # Tesseract fallback
│   └── clusteringService             # Unassigned work grouping
└── Utilities
    ├── supabaseClient                # Database connection
    ├── openaiClient                  # GPT-4 API calls
    └── logger                        # Winston logging
```

---

### 4. Forge App (Jira Integration)

**Location**: `forge-app/`

| Aspect | Details |
|--------|---------|
| **Purpose** | Jira integration for viewing analytics and managing worklogs |
| **Platform** | Atlassian Forge (serverless) |
| **Frontend** | React 18 with @forge/react |
| **Backend** | Forge Resolvers (Node.js functions) |

**UI Modules**:

| Module | Location | Function |
|--------|----------|----------|
| **Global Page** | Jira sidebar | Time analytics dashboard |
| **Issue Panel** | Issue view | Time spent on specific issue |
| **Admin Settings** | App settings | Configuration management |

**Features**:
- 📊 **Time Analytics**: Daily, weekly, monthly summaries
- 📈 **Project Breakdown**: Time per project/issue
- 👥 **Team View**: Admins see all team members' data
- 📋 **Unassigned Work**: View and assign uncategorized time
- ✅ **Worklog Sync**: Create Jira worklogs from tracked time

**Internal Architecture**:
```
Forge App
├── UI Modules (static/frontend/)
│   ├── TimeAnalyticsPage             # Main dashboard
│   ├── IssueTimePanel                # Issue-specific view
│   ├── UnassignedWorkView            # Unassigned management
│   └── SettingsPage                  # Admin configuration
├── Resolvers (src/resolvers/)
│   ├── analyticsResolver             # Time data queries
│   ├── screenshotResolver            # Screenshot management
│   ├── unassignedWorkResolver        # Grouping and assignment
│   └── issueResolver                 # Jira issue operations
└── Utilities (src/utils/)
    ├── supabaseClient                # Supabase connection
    ├── jiraUtils                     # Jira API helpers
    └── permissionUtils               # RBAC checks
```

---

## 🔄 Data Flow

### Complete Flow: Screenshot to Analytics

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE DATA FLOW                                              │
└──────────────────────────────────────────────────────────────────────────────────────────┘

STEP 1: CAPTURE (Desktop App)
─────────────────────────────
Every 5 minutes:
  └─▶ Check if user is idle → Skip if idle >5 min
  └─▶ Capture screenshot → Skip if unchanged (MD5 hash)
  └─▶ Get window title: "PROJ-123 - Fix login bug | VS Code"
  └─▶ Get app name: "code.exe"

STEP 2: UPLOAD (Desktop App → Supabase)
───────────────────────────────────────
  └─▶ Upload image to Storage: screenshots/{org_id}/{user_id}/screenshot_{ts}.png
  └─▶ Insert metadata to PostgreSQL:
      {
        user_id, organization_id, storage_path,
        window_title, application_name, status: 'pending'
      }

STEP 3: AI PROCESSING (AI Server - Polls every 30s)
──────────────────────────────────────────────────
  └─▶ Query: SELECT * FROM screenshots WHERE status = 'pending' LIMIT 10
  └─▶ Download image from Storage
  └─▶ Fetch user's cached Jira issues
  └─▶ Call GPT-4 Vision API with:
      ├── Image (base64)
      ├── Window title
      ├── Application name
      └── Context: "User is assigned to: PROJ-123, PROJ-456, PROJ-789"

STEP 4: AI RESPONSE
──────────────────
GPT-4 returns:
  {
    "work_type": "office",
    "task_key": "PROJ-123",
    "confidence_score": 0.92,
    "reasoning": "VS Code shows file from PROJ-123 repository, window title contains issue key"
  }

STEP 5: SAVE RESULTS (AI Server → Supabase)
──────────────────────────────────────────
  └─▶ INSERT into analysis_results
  └─▶ UPDATE screenshots SET status = 'analyzed'
  └─▶ If task_key is null → INSERT into unassigned_activity

STEP 6: CLUSTERING (AI Server - Every 5 min)
───────────────────────────────────────────
  └─▶ Query unassigned activities grouped by user
  └─▶ Send descriptions to GPT-4 for clustering
  └─▶ Create unassigned_work_groups with recommendations

STEP 7: VIEW ANALYTICS (Forge App in Jira)
─────────────────────────────────────────
  └─▶ User opens Time Analytics in Jira
  └─▶ Forge App queries Supabase (filtered by organization_id)
  └─▶ Display dashboard: time per issue, project, day, week
  └─▶ Show unassigned work groups for assignment
```

---

## 🏢 Multi-Tenancy Architecture

### Tenant Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MULTI-TENANCY MODEL: Each Jira Cloud Instance = 1 Organization (Tenant)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Jira Cloud Instance A                    Jira Cloud Instance B             │
│  jira_cloud_id: "abc-123"                 jira_cloud_id: "xyz-789"          │
│  ┌─────────────────────────┐              ┌─────────────────────────┐       │
│  │ organization_id: org_1  │              │ organization_id: org_2  │       │
│  ├─────────────────────────┤              ├─────────────────────────┤       │
│  │ Users                   │              │ Users                   │       │
│  │  • user_1 (owner)       │              │  • user_5 (owner)       │       │
│  │  • user_2 (admin)       │              │  • user_6 (member)      │       │
│  │  • user_3, user_4       │              │                         │       │
│  ├─────────────────────────┤              ├─────────────────────────┤       │
│  │ Data (isolated)         │   COMPLETE   │ Data (isolated)         │       │
│  │  • 1,500 screenshots    │◀──ISOLATION─▶│  • 800 screenshots      │       │
│  │  • 1,500 analysis       │      via     │  • 800 analysis         │       │
│  │  • Settings, groups     │     RLS      │  • Settings, groups     │       │
│  └─────────────────────────┘              └─────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Row Level Security (RLS) Policies

```sql
-- Example RLS policy for screenshots table
CREATE POLICY "Users can only see their organization's screenshots"
ON screenshots
FOR ALL
USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- All tables follow the same pattern:
-- • organizations
-- • users  
-- • screenshots
-- • analysis_results
-- • unassigned_activity
-- • unassigned_work_groups
```

---

## 👥 Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Owner** | Full access: settings, team analytics, billing, member management, delete screenshots |
| **Admin** | Settings management, team analytics, member management, delete screenshots |
| **Manager** | View team analytics (read-only) |
| **Member** | View own data only |

```
Permissions Matrix:
─────────────────────────────────────────────────────────────
Permission              │ Owner │ Admin │ Manager │ Member │
─────────────────────────────────────────────────────────────
View own analytics      │  ✅   │  ✅   │   ✅    │   ✅   │
View team analytics     │  ✅   │  ✅   │   ✅    │   ❌   │
Manage settings         │  ✅   │  ✅   │   ❌    │   ❌   │
Manage members          │  ✅   │  ✅   │   ❌    │   ❌   │
Delete screenshots      │  ✅   │  ✅   │   ❌    │   ❌   │
Manage billing          │  ✅   │  ❌   │   ❌    │   ❌   │
─────────────────────────────────────────────────────────────
```

---

## 🛠️ Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Desktop App** | Python 3.x, Flask, Pillow, pywin32 | Screenshot capture, activity monitoring |
| **Backend** | Node.js 20+, Express.js | AI processing server |
| **Database** | PostgreSQL 15+ (Supabase) | Data storage with RLS |
| **Storage** | Supabase Storage (S3) | Screenshot file storage |
| **AI/ML** | OpenAI GPT-4 Vision, GPT-4 Text | Image analysis, clustering |
| **OCR** | Tesseract.js | Text extraction (fallback) |
| **Image Processing** | Sharp | Image optimization |
| **Frontend** | React 18, @forge/react | Jira UI components |
| **Platform** | Atlassian Forge | Jira app hosting |
| **Auth** | Atlassian OAuth 3LO | User authentication |

---

## 🔗 Integration Points

### 1. Desktop App ↔ Supabase
- **Protocol**: HTTPS (PostgREST API)
- **Authentication**: Supabase anon key + user JWT
- **Data**: Screenshots (Storage), metadata (PostgreSQL)

### 2. AI Server ↔ Supabase
- **Protocol**: HTTPS (PostgREST API)
- **Authentication**: Supabase service role key
- **Data**: Polls screenshots, saves analysis results

### 3. AI Server ↔ OpenAI
- **Protocol**: HTTPS
- **Authentication**: OpenAI API key
- **Endpoints**: `/v1/chat/completions` (Vision & Text)

### 4. Forge App ↔ Supabase
- **Protocol**: HTTPS (PostgREST API)
- **Authentication**: Supabase anon key + user context
- **Data**: Queries analytics, manages assignments

### 5. Forge App ↔ Jira API
- **Protocol**: Atlassian Forge APIs
- **Authentication**: Automatic via Forge platform
- **Operations**: Create worklogs, fetch issues, user data

### 6. Desktop App ↔ Jira (OAuth)
- **Protocol**: OAuth 2.0 (3LO)
- **Flow**: Authorization code with PKCE
- **Purpose**: Link user to Atlassian account, get Jira Cloud ID

---

## 📁 Project Structure

```
JIRAForge/
├── ai-server/              # Node.js AI processing server
│   ├── src/
│   │   ├── api/            # Express routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Helpers
│   ├── tests/              # Test files
│   └── package.json
│
├── python-desktop-app/     # Python desktop application
│   ├── desktop_app.py      # Main application
│   ├── requirements.txt    # Dependencies
│   └── config/             # Configuration
│
├── forge-app/              # Atlassian Forge application
│   ├── src/
│   │   ├── resolvers/      # Backend functions
│   │   └── utils/          # Utilities
│   ├── static/frontend/    # React UI
│   ├── manifest.yml        # Forge configuration
│   └── package.json
│
├── supabase/               # Database configuration
│   ├── migrations/         # SQL migrations
│   ├── functions/          # Edge Functions
│   └── config.toml
│
└── docs/                   # Documentation
    ├── generated-diagrams/ # Architecture diagrams
    └── *.md                # Documentation files
```

---

## 🚀 Key Features Summary

| Feature | Description | Component |
|---------|-------------|-----------|
| **Auto Screenshot Capture** | Captures screen every 5 min with duplicate detection | Desktop App |
| **Activity Monitoring** | Tracks window titles and application names | Desktop App |
| **AI-Powered Analysis** | GPT-4 Vision detects Jira tasks from screenshots | AI Server |
| **Work Classification** | Categorizes as office/non-office work | AI Server |
| **Unassigned Work Clustering** | Groups similar unknown activities | AI Server |
| **Time Analytics Dashboard** | Daily/weekly/project time summaries | Forge App |
| **Worklog Sync** | Creates Jira worklogs from tracked time | Forge App |
| **Multi-Tenant Isolation** | Complete data separation per Jira instance | Supabase RLS |
| **Role-Based Access** | Owner/Admin/Manager/Member permissions | All layers |

---

## 📈 Processing Flow Diagram

```
User Activity                AI Processing                    User Consumption
─────────────                ──────────────                   ────────────────

   Work                         Poll                          View Dashboard
    │                            │                                  │
    ▼                            ▼                                  ▼
┌─────────┐               ┌─────────────┐                    ┌───────────┐
│ Desktop │──screenshot──▶│  AI Server  │──results──────────▶│ Forge App │
│   App   │    (5 min)    │  (30s poll) │                    │           │
└────┬────┘               └──────┬──────┘                    └─────┬─────┘
     │                           │                                 │
     │                           ▼                                 ▼
     │                    ┌─────────────┐                    ┌───────────┐
     └───metadata───────▶│  Supabase   │◀────queries────────│   User    │
                         │   (RLS)     │                    │ in Jira   │
                         └─────────────┘                    └───────────┘
```

---

*Last Updated: 2026-02-18*
