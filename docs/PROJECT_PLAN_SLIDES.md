# BRD Automate & Time Tracker for Jira
## Project Plan - 4 Slide Presentation

---

## Slide 1: Technology Stack

### System Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Technology Stack                          │
└─────────────────────────────────────────────────────────────┘
```

### Frontend & Integration
- **Atlassian Forge** (React + Node.js)
  - Custom UI for Jira integration
  - Backend resolvers for API operations
  - Runtime: Node.js 20.x

### Desktop Application
- **Python Desktop App** (Tkinter)
  - Cross-platform screenshot capture
  - OAuth 3LO authentication
  - System tray integration

### Backend & Database
- **Supabase** (PostgreSQL)
  - Database: PostgreSQL with Row-Level Security
  - Storage: File storage for screenshots and documents
  - Edge Functions: Webhook handlers
  - Authentication: JWT-based user sessions

### AI Processing
- **AI Server** (Node.js + Express)
  - OCR: Tesseract.js for text extraction
  - AI Analysis: OpenAI GPT-4 for intelligent task detection
  - Document Processing: PDF/DOCX parsing

### Key Technologies
| Component | Technology |
|-----------|-----------|
| **Frontend** | React, Atlassian Forge Custom UI |
| **Backend** | Node.js, Express |
| **Database** | PostgreSQL (Supabase) |
| **Storage** | Supabase Storage |
| **Desktop** | Python, Tkinter |
| **AI/ML** | OpenAI GPT-4, Tesseract.js |
| **Auth** | OAuth 3LO (Atlassian), JWT |

---

## Slide 2: Application Workflows

### Workflow 1: Automated Time Tracking

```
┌──────────────┐
│ Desktop App  │
│ Screenshot   │ (Every 5 minutes)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Supabase     │
│ Storage      │ (Upload screenshot)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Edge Function│
│ Webhook      │ (Trigger AI processing)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ AI Server    │
│ OCR + GPT-4  │ (Analyze & detect task)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Supabase DB  │
│ Save Results │ (Time tracking data)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Forge App    │
│ Dashboard    │ (Display analytics)
└──────────────┘
```

### Workflow 2: BRD Document Processing

```
┌──────────────┐
│ User Uploads │
│ BRD (PDF)    │ (Via Forge App)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Supabase     │
│ Storage      │ (Store document)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Edge Function│
│ Webhook      │ (Trigger processing)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ AI Server    │
│ Extract +    │ (Parse requirements)
│ GPT-4 Parse  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Forge App    │
│ Create Issues│ (Epic → Story → Task)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Jira API     │
│ Issues       │ (Created in Jira)
└──────────────┘
```

### Workflow 3: Time Analytics Display

```
┌──────────────┐
│ User Opens   │
│ Jira Project │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Forge App    │
│ Resolver     │ (getTimeAnalytics)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Supabase DB  │
│ Query Views  │ (Daily/Weekly summaries)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Forge UI     │
│ Dashboard    │ (Display charts & data)
└──────────────┘
```

---

## Slide 3: Required Permissions & Scopes

### Forge Application Permissions

#### Jira API Scopes (manifest.yml)
```
permissions:
  scopes:
    - read:me              # Get current user information
    - read:jira-work       # Read Jira issues and worklogs
    - write:jira-work      # Create worklogs and issues
    - read:jira-user       # Read user data
    - storage:app          # Store app settings
```

#### External API Access
```
external:
  fetch:
    backend:
      - address: "*.supabase.co"  # Communicate with Supabase
```

### Desktop Application Permissions

#### OAuth 3LO Scopes (Atlassian)
- ✅ `read:me` - Read user information
- ✅ `read:jira-work` - Read Jira issues and worklogs
- ✅ `write:jira-work` - Create worklogs and issues
- ✅ `offline_access` - Refresh tokens for long-lived sessions

#### System Permissions
- **Screenshot Capture:** Screen recording permission (macOS/Windows)
- **Network Access:** HTTPS connections to Supabase
- **File System:** Local storage for tokens and settings

### Supabase Permissions

#### Database Access
- **Service Role Key:** Backend operations (Forge resolvers)
- **Anon Key:** Client-side operations (Desktop app)
- **Row-Level Security (RLS):** User-specific data access

#### Storage Buckets
- **screenshots:** Private bucket, user-specific folders
- **documents:** Private bucket, user-specific folders
- **Policies:** Users can only access their own files

### AI Server Permissions

#### API Authentication
- **Bearer Token:** API key authentication
- **Rate Limiting:** 100 requests per 15 minutes

#### External Services
- **OpenAI API:** GPT-4 access for AI analysis
- **Supabase API:** Read/write access via service role key

### Permission Summary Table

| Component | Permission Type | Purpose |
|-----------|----------------|---------|
| **Forge App** | `read:jira-work` | Read issues/worklogs |
| **Forge App** | `write:jira-work` | Create issues/worklogs |
| **Forge App** | `read:jira-user` | Read user data |
| **Desktop App** | OAuth 3LO | Authenticate with Atlassian |
| **Desktop App** | Screen Capture | Take screenshots |
| **Supabase** | Service Role Key | Backend database access |
| **Supabase** | RLS Policies | User data isolation |
| **AI Server** | OpenAI API Key | AI analysis |
| **AI Server** | Supabase Access | Read/write analysis results |

---

## Slide 4: System Integration & Data Flow

### Complete System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Environment                          │
│                                                              │
│  ┌──────────────────┐         ┌──────────────────────┐      │
│  │  Jira (Browser)  │         │   Desktop App       │      │
│  │                  │         │   (Python)          │      │
│  │  Forge App UI    │         │  - Screenshot       │      │
│  │  - Analytics     │         │    Capture          │      │
│  │  - Screenshots   │         │  - OAuth Auth       │      │
│  │  - BRD Upload    │         │  - File Upload      │      │
│  └────────┬─────────┘         └──────────┬───────────┘      │
│           │                               │                  │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │
            ▼                               ▼
    ┌────────────────┐              ┌──────────────────┐
    │ Forge Backend  │              │   Supabase       │
    │  (Resolvers)   │◄────────────►│   (PostgreSQL)   │
    │                │              │                  │
    │ - Jira API     │              │ - Database       │
    │ - Data Fetch   │              │ - Storage        │
    │ - Issue Create │              │ - Auth           │
    └────────────────┘              │ - Edge Functions │
                                    └────────┬─────────┘
                                             │
                                             │ Webhooks
                                             ▼
                                    ┌──────────────────┐
                                    │   AI Server     │
                                    │   (Node.js)     │
                                    │                 │
                                    │ - OCR           │
                                    │ - GPT-4         │
                                    │ - Document Parse│
                                    └──────────────────┘
```

### Key Integration Points

1. **Forge ↔ Jira**
   - Uses Jira REST API with OAuth tokens
   - Creates/reads issues and worklogs
   - Displays data in Jira UI

2. **Desktop App ↔ Supabase**
   - OAuth 3LO authentication
   - Uploads screenshots to storage
   - Stores metadata in database

3. **Forge ↔ Supabase**
   - Service role key for backend access
   - Fetches analytics data
   - Uploads BRD documents

4. **Supabase ↔ AI Server**
   - Edge Functions trigger webhooks
   - AI Server processes files
   - Results stored back in Supabase

5. **AI Server ↔ OpenAI**
   - GPT-4 API for intelligent analysis
   - OCR for text extraction
   - Document parsing

### Data Flow Summary

| Flow | Source | Destination | Purpose |
|------|--------|-------------|---------|
| **Screenshot** | Desktop App | Supabase Storage | Store screenshot |
| **Analysis** | Supabase Webhook | AI Server | Process screenshot |
| **Results** | AI Server | Supabase DB | Save analysis |
| **Analytics** | Supabase DB | Forge App | Display dashboard |
| **BRD Upload** | Forge App | Supabase Storage | Store document |
| **BRD Process** | Supabase Webhook | AI Server | Parse requirements |
| **Issue Create** | Forge App | Jira API | Create issues |

---

**Presentation Version:** 2.0 (4-Slide Format)  
**Last Updated:** Current Date  
**Focus:** Tech Stack, Workflows, Permissions
