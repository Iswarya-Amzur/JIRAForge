# BRD Time Tracker - Comprehensive Feature Documentation

> **Version:** 3.35.0
> **Last Updated:** 2025-11-28
> **Purpose:** Automated time tracking, BRD processing, and Jira integration for development teams

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Feature Catalog](#2-feature-catalog)
3. [Technical Architecture](#3-technical-architecture)
4. [Database Schema](#4-database-schema)
5. [User Workflows](#5-user-workflows)
6. [API Reference](#6-api-reference)
7. [Configuration Guide](#7-configuration-guide)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Application Overview

### 1.1 Purpose

BRD Time Tracker is an intelligent time tracking and automation platform designed for development teams using Jira. It combines automated screenshot capture, AI-powered activity analysis, and seamless Jira integration to provide:

- **Automatic Time Tracking**: Captures work activity without manual logging
- **AI-Powered Analysis**: Uses GPT-4 Vision to detect what you're working on
- **BRD Automation**: Converts Business Requirements Documents into Jira issues
- **Team Analytics**: Provides comprehensive time tracking dashboards

### 1.2 Target Users

- **Developers**: Track time spent on Jira issues automatically
- **Project Managers**: View team time analytics and productivity
- **Jira Admins**: Configure system settings and manage users
- **Business Analysts**: Upload BRDs to auto-create Jira issues

### 1.3 Key Value Propositions

1. **Zero Manual Entry**: Time tracking happens automatically in the background
2. **Accurate Task Detection**: AI identifies which Jira issue you're working on
3. **Privacy-First**: Screenshots stored securely, only you can access your data
4. **Unassigned Work Recovery**: Cluster and assign time that wasn't automatically matched
5. **BRD Automation**: Save hours creating Jira issues from requirement documents

---

## 2. Feature Catalog

### 2.1 Screenshot Capture & Monitoring

**Location**: Desktop Python Application

**Description**: Background application that captures periodic screenshots of your work to enable automatic time tracking.

**How It Works**:
1. Desktop app runs in system tray (Windows/Mac/Linux)
2. Captures screenshot every 5 minutes (configurable)
3. Extracts metadata: window title, application name, timestamp
4. Uploads screenshot + metadata to Supabase storage
5. Triggers AI analysis pipeline

**Key Features**:
- **Configurable Interval**: Set screenshot frequency (default: 5 minutes)
- **Smart Capture**: Only captures when computer is active
- **Lightweight**: Minimal CPU/memory usage
- **Secure Upload**: Direct upload to Supabase with encryption
- **Idle Detection**: Pauses when computer is idle

**Configuration**:
```env
SCREENSHOT_INTERVAL=300  # Seconds between screenshots
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
USER_ID=your-user-id
```

**Privacy Controls**:
- Screenshots only visible to the user who created them
- Can delete individual screenshots from Forge app
- Storage bucket has Row Level Security (RLS) enabled

---

### 2.2 AI-Powered Activity Analysis

**Location**: AI Server (Node.js)

**Description**: Intelligent analysis of screenshots using GPT-4 Vision and OCR to determine what work is being performed.

**Analysis Methods**:

#### 2.2.1 Primary Method: GPT-4 Vision
- **Model**: `gpt-4o` (GPT-4 Omni with vision)
- **Input**: Screenshot image + window title + application name + user's assigned Jira issues
- **Output**: Task detection, work classification, confidence score

**What It Detects**:
```javascript
{
  taskKey: "SCRUM-123",           // Detected Jira issue key
  projectKey: "SCRUM",             // Project key
  workType: "office",              // "office" or "non-office"
  confidenceScore: 0.95,           // 0.0 to 1.0 confidence
  timeSpentSeconds: 300,           // Time spent (5 min default)
  reasoning: "User reviewing code", // AI explanation
  detectedJiraKeys: ["SCRUM-123"]  // All keys found
}
```

**Vision Analysis Prompt**:
The AI is instructed to:
1. Identify if user is working on any assigned Jira issue
2. Look for issue keys in browser tabs, IDE windows, terminal
3. Determine if work is office-related or personal
4. Provide confidence score and reasoning

#### 2.2.2 Fallback Method: OCR + GPT-4 Text
- **OCR**: Tesseract.js extracts text from screenshot
- **Text Analysis**: GPT-4 analyzes extracted text
- **Issue Key Extraction**: Regex pattern matching for JIRA-123 format
- **Validation**: Only accepts keys from user's assigned issues

#### 2.2.3 Last Resort: Heuristic Analysis
- Simple pattern matching for Jira keys
- Basic work type classification
- Lower confidence scores

**Configuration**:
```env
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o
USE_AI_FOR_SCREENSHOTS=true
SCREENSHOT_INTERVAL=300
```

**Files**:
- `ai-server/src/services/screenshot-service.js` - Main analysis logic
- `ai-server/src/services/polling-service.js` - Polls for new screenshots
- `ai-server/src/index.js` - Server entry point

---

### 2.3 Time Tracking & Analytics

**Location**: Forge App (React UI)

**Description**: Comprehensive dashboards for viewing tracked time across multiple time periods.

#### 2.3.1 Dashboard Overview

**Access**: Jira Project Page → "BRD & Time Tracker" tab

**Components**:
1. **Summary Cards**: Today's total, This week's total, This month's total
2. **View Selector**: Switch between Day/Week/Month/Project views
3. **Issue List**: Issues with time tracked and sessions
4. **Calendar View**: Visual calendar with daily totals

**Summary Cards Display**:
- **Today's Total**: Sum of all time tracked today
- **This Week's Total**: Sunday to today's total time
- **This Month's Total**: Month-to-date total time
- Formatted as "Xh Ym" (e.g., "5h 23m")

#### 2.3.2 Day View

**Description**: Shows all issues worked on today with individual session breakdowns.

**Display Format**:
```
Issue: SCRUM-123 - Implement user authentication
Status: In Progress | Priority: High | Type: Story
Total Time: 3h 45m
Sessions:
  Session 1: 9:00 AM → 10:30 AM (1h 30m)
  Session 2: 2:15 PM → 3:30 PM (1h 15m)
  Session 3: 4:00 PM → 5:00 PM (1h 0m)
```

**Session Grouping Logic**:
- Sessions grouped by issue key
- Consecutive work within 10-minute gap = same session
- Uses actual screenshot timestamp (not analysis time)
- Sessions sorted chronologically

**Features**:
- Click issue to view in Jira
- Click session to view screenshot
- Create worklog directly from session

**Files**:
- `forge-app/static/main/src/App.js` (lines 760-990)
- `forge-app/src/services/issueService.js` (session building logic)

#### 2.3.3 Week View

**Description**: 7-day calendar view showing time per issue per day.

**Layout**:
```
Issue          | Sun | Mon | Tue | Wed | Thu | Fri | Sat | Total
SCRUM-123      | 2h  | 3h  | 1h  | -   | 4h  | -   | -   | 10h
SCRUM-124      | -   | 1h  | 2h  | 3h  | -   | -   | -   | 6h
Daily Total    | 2h  | 4h  | 3h  | 3h  | 4h  | 0h  | 0h  | 16h
```

**Features**:
- Shows Sunday through Saturday (or today, whichever is earlier)
- Daily totals row at bottom
- Weekly total column on right
- Color coding by time amount
- Only shows days up to today (no future days)

**Date Handling** (Fixed in v3.34.0):
- Uses local time zone throughout
- No UTC conversion (prevents day-shift bugs)
- Matches month view date logic exactly

**Files**:
- `forge-app/static/main/src/App.js` (lines 998-1100)

#### 2.3.4 Month View

**Description**: Calendar grid showing daily time totals for current month.

**Layout**:
```
        November 2025
Sun  Mon  Tue  Wed  Thu  Fri  Sat
                    1    2    3
     2h   3h   1h   4h   2h   0h

4    5    6    7    8    9    10
3h   4h   2h   5h   3h   0h   0h

...
```

**Features**:
- Full calendar grid with empty cells for non-month days
- Color intensity based on hours worked
- Hover shows exact time
- Click day to view day details
- Highlights today

**Files**:
- `forge-app/static/main/src/App.js` (lines 1165-1350)

#### 2.3.5 Project View

**Description**: Aggregated time per project across all time.

**Display Format**:
```
Project: SCRUM
Total Time: 45h 30m
Unique Issues: 12
Screenshots: 546
First Activity: 2025-10-01
Last Activity: 2025-11-28
```

**Use Cases**:
- Project billing reports
- Cross-project time allocation
- Long-term project analytics

**Files**:
- `forge-app/static/main/src/App.js` (lines 1352-1450)
- Database view: `project_time_summary`

#### 2.3.6 Team Analytics (Admin/PM Only)

**Description**: View team members' time tracking data.

**Access**:
- Jira Admins: See all users
- Project Admins: See team members in their projects

**Display Format**:
```
User: John Doe
Today: 6h 30m | This Week: 32h 15m | This Month: 145h 0m

Recent Activity:
SCRUM-123 | 2h 15m | Last worked: 10 minutes ago
SCRUM-124 | 1h 30m | Last worked: 2 hours ago
```

**Privacy Protection**:
- Team view does NOT show individual screenshots
- Only shows aggregated time data
- Respects Jira project permissions
- No access to screenshot images

**Files**:
- `forge-app/src/resolvers/analyticsResolvers.js`
- `forge-app/src/services/analyticsService.js`

---

### 2.4 Unassigned Work Management

**Location**: Forge App → "Unassigned Work" tab

**Description**: Intelligent clustering and assignment of work sessions that weren't automatically matched to Jira issues.

#### 2.4.1 What is Unassigned Work?

Work sessions where the AI could not confidently match activity to a Jira issue:
- Working without Jira issue visible on screen
- Ad-hoc tasks, meetings, research
- Work on issues not yet assigned to you
- Low confidence detections

**Why It Matters**:
- Prevents time loss
- Ensures accurate time reporting
- Enables retroactive assignment

#### 2.4.2 Automatic Clustering

**Process**:
1. AI Server polls for unassigned work every hour
2. GPT-4 clusters similar sessions together
3. Groups stored in `unassigned_work_groups` table
4. User reviews groups in Forge app

**Clustering Algorithm** (GPT-4):
```
Input: List of unassigned sessions with:
- Activity description (AI reasoning)
- Application name
- Window title
- Duration
- User's assigned issues (for matching)

Output: Groups of similar sessions with:
- Group label (e.g., "Code Review on PR #45")
- Description
- Confidence level (high/medium/low)
- Recommendation (assign to existing or create new issue)
- Suggested issue key (if matches existing issue)
```

**Example Groups**:
```
Group 1: "Code Review - Authentication Module"
  Sessions: 5 sessions, 2h 30m total
  Confidence: High
  Recommendation: Assign to SCRUM-123
  Reason: Window titles mention "auth code review"

Group 2: "Team Meeting - Sprint Planning"
  Sessions: 2 sessions, 1h 15m total
  Confidence: Medium
  Recommendation: Create new issue
  Reason: Not related to any assigned issue
```

**Files**:
- `ai-server/src/services/clustering-service.js` - Clustering algorithm
- `ai-server/src/services/clustering-polling-service.js` - Polling job
- Database tables: `unassigned_work_groups`, `unassigned_group_members`

#### 2.4.3 Manual Assignment Workflow

**UI Components**:

**Group Card**:
```
┌─────────────────────────────────────────────────┐
│ Code Review - Authentication Module             │
│ 5 sessions • 2h 30m • High Confidence           │
│                                                  │
│ Recommendation: Assign to SCRUM-123             │
│ Reason: Window titles mention "auth code review"│
│                                                  │
│ [View Sessions] [Assign to Existing Issue]      │
│                [Create New Issue]                │
└─────────────────────────────────────────────────┘
```

**Assignment Options**:

1. **Assign to Existing Issue**
   - Select from dropdown of your assigned issues
   - Creates worklog in Jira
   - Updates `analysis_results` to link sessions
   - Marks group as assigned

2. **Create New Issue**
   - Fill form: Summary, Description, Project, Issue Type
   - Select status (To Do, In Progress, etc.)
   - Optionally assign to someone
   - Creates issue in Jira
   - Adds initial worklog
   - Updates all sessions to reference new issue

**Modal - Assign to Existing**:
```
┌─────────────────────────────────────┐
│ Assign to Existing Issue            │
├─────────────────────────────────────┤
│ Select Issue:                       │
│ [SCRUM-123 - User Authentication  ▼]│
│                                      │
│ Total Time: 2h 30m                  │
│ Sessions: 5                          │
│                                      │
│ This will:                           │
│ • Link all sessions to SCRUM-123    │
│ • Create worklog for 2h 30m         │
│ • Mark group as assigned             │
│                                      │
│     [Cancel]  [Assign Issue]        │
└─────────────────────────────────────┘
```

**Modal - Create New Issue**:
```
┌─────────────────────────────────────┐
│ Create New Issue                     │
├─────────────────────────────────────┤
│ Project: [SCRUM               ▼]    │
│ Issue Type: [Task              ▼]    │
│ Summary: [                        ]  │
│ Description: [                    ]  │
│ Status: [In Progress          ▼]    │
│ Assign to: [Me (John Doe)     ▼]    │
│                                      │
│ Initial Time: 2h 30m (from 5 session│
│                                      │
│     [Cancel]  [Create & Assign]     │
└─────────────────────────────────────┘
```

**Backend Processing**:
- Updates `unassigned_activity` table
- Updates `analysis_results` with issue key
- Creates Jira worklog via API
- Marks group as assigned
- Caches new issue for future AI detection

**Files**:
- `forge-app/src/resolvers/unassignedWorkResolvers.js`
- `forge-app/static/main/src/components/UnassignedWork.js`

---

### 2.5 BRD Document Processing

**Location**: Forge App → "BRD Upload" section

**Description**: Upload Business Requirements Documents (BRD) and automatically extract requirements to create Jira issues.

#### 2.5.1 Supported Formats

- **PDF**: `.pdf` files
- **Word**: `.docx`, `.doc` files
- **Size Limit**: 10MB per file

#### 2.5.2 Upload Workflow

**Step 1: Upload Document**
```
┌─────────────────────────────────────┐
│ Upload BRD Document                  │
├─────────────────────────────────────┤
│ [Choose File] requirements_v1.pdf    │
│                                      │
│ File: requirements_v1.pdf            │
│ Size: 2.3 MB                         │
│                                      │
│     [Cancel]  [Upload]              │
└─────────────────────────────────────┘
```

**Step 2: Document Uploaded**
- File uploaded to Supabase storage
- Entry created in `documents` table
- Status: `uploaded`

**Step 3: AI Processing** (Triggered by AI Server)

The AI server:
1. Downloads document from storage
2. Extracts text:
   - PDF: Uses `pdf-parse` library
   - DOCX: Uses `mammoth` library
3. Analyzes text with GPT-4:
   ```
   Extract all functional requirements from this BRD.
   For each requirement, identify:
   - Summary (short title)
   - Description (detailed requirement)
   - Priority (High/Medium/Low)
   - Issue Type (Story/Task/Bug)
   - Acceptance Criteria (if mentioned)
   ```
4. Parses response into structured requirements
5. Updates `documents.parsed_requirements`
6. Status: `completed`

**Example Parsed Requirements**:
```json
{
  "requirements": [
    {
      "summary": "User Login with Email",
      "description": "Users must be able to log in using email and password",
      "priority": "High",
      "issueType": "Story",
      "acceptanceCriteria": [
        "Login form with email and password fields",
        "Password must be masked",
        "Error shown for invalid credentials"
      ]
    },
    {
      "summary": "Password Reset Flow",
      "description": "Users should be able to reset forgotten passwords via email",
      "priority": "Medium",
      "issueType": "Story",
      "acceptanceCriteria": [
        "Forgot password link on login page",
        "Email sent with reset link",
        "Link expires after 24 hours"
      ]
    }
  ]
}
```

**Step 4: Review & Create Issues**
```
┌──────────────────────────────────────────────────┐
│ Document: requirements_v1.pdf                     │
│ Status: Completed ✓                               │
│ Requirements Found: 15                            │
├──────────────────────────────────────────────────┤
│ Project: [SCRUM                              ▼]  │
│                                                   │
│ Requirements:                                     │
│ ☑ User Login with Email (Story - High)          │
│ ☑ Password Reset Flow (Story - Medium)          │
│ ☑ User Profile Management (Story - Medium)      │
│ ☐ Admin Dashboard (Story - Low)                 │
│ ... 11 more                                       │
│                                                   │
│     [Select All] [Create Selected Issues]        │
└──────────────────────────────────────────────────┘
```

**Step 5: Issue Creation**

For each selected requirement:
1. Create Jira issue via API:
   ```javascript
   {
     project: { key: "SCRUM" },
     summary: requirement.summary,
     description: {
       type: 'doc',
       version: 1,
       content: [
         { type: 'paragraph', content: [{ type: 'text', text: requirement.description }] },
         { type: 'paragraph', content: [{ type: 'text', text: '\nAcceptance Criteria:' }] },
         ...acceptanceCriteria.map(ac => ({ type: 'listItem', content: [{ type: 'text', text: ac }] }))
       ]
     },
     issuetype: { name: requirement.issueType },
     priority: { name: requirement.priority },
     labels: ['brd-generated', 'auto-created']
   }
   ```
2. Log created issue in `created_issues_log` table
3. Cache issue in `user_jira_issues_cache` for AI detection

**Success Result**:
```
✓ Created 15 issues successfully
  SCRUM-201: User Login with Email
  SCRUM-202: Password Reset Flow
  SCRUM-203: User Profile Management
  ...
```

**Error Handling**:
- Partial success: Some issues created, others failed
- Document processing failures logged
- User notified of errors with details

**Files**:
- `forge-app/src/resolvers/brdResolvers.js`
- `forge-app/src/services/brdService.js`
- `ai-server/src/services/brd-service.js`
- Database tables: `documents`, `created_issues_log`

---

### 2.6 Jira Integration

**Description**: Deep integration with Jira for issue management, worklog creation, and permission checking.

#### 2.6.1 Issue Detection

**How AI Detects Issues**:
1. User's assigned issues fetched from Jira API
2. Cached in Supabase (`user_jira_issues_cache`)
3. Passed to AI analysis as context
4. AI looks for issue keys in screenshot
5. Validates detected keys against cached issues

**Jira API Endpoint**:
```
GET /rest/api/3/search
JQL: assignee = currentUser() AND status in ("In Progress", "To Do", ...)
```

**Issue Fields Retrieved**:
- `key` (e.g., SCRUM-123)
- `summary`
- `status.name`
- `priority.name`
- `issuetype.name`
- `project.key`
- `updated` timestamp

**Cache Refresh**:
- Automatic: Every time dashboard loads
- Manual: "Refresh Issues" button
- After creating new issue via BRD or unassigned work

**Files**:
- `forge-app/src/utils/jira.js` - Jira API wrappers
- `forge-app/src/services/issueService.js` - Issue caching logic

#### 2.6.2 Worklog Creation

**Automatic Worklog**: Created when assigning unassigned work

**Manual Worklog**: From session details in Day view

**Worklog Format**:
```javascript
{
  issueKey: "SCRUM-123",
  timeSpentSeconds: 7200,  // 2 hours
  started: "2025-11-28T14:00:00.000+0000",  // ISO 8601 with timezone
  comment: {
    type: 'doc',
    version: 1,
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Time tracked from 3 work session(s), grouped and assigned manually.'
      }]
    }]
  }
}
```

**Jira API Endpoint**:
```
POST /rest/api/3/issue/{issueKey}/worklog
```

**Worklog Tracking**:
- Logged in `worklogs` table
- Links to `analysis_result_id`
- Tracks sync status
- Stores Jira worklog ID for reference

**Files**:
- `forge-app/src/resolvers/worklogResolvers.js`
- `forge-app/src/services/worklogService.js`

#### 2.6.3 Issue Transitions

**Feature**: Change issue status directly from unassigned work assignment

**Workflow**:
1. User creates new issue from unassigned work
2. Selects desired status (e.g., "In Progress")
3. Issue created in default status (usually "To Do")
4. System fetches available transitions
5. Executes transition to desired status

**Jira API Endpoints**:
```
GET /rest/api/3/issue/{issueKey}/transitions
Response: [
  { id: "11", name: "To Do", to: { name: "To Do" } },
  { id: "21", name: "In Progress", to: { name: "In Progress" } },
  { id: "31", name: "Done", to: { name: "Done" } }
]

POST /rest/api/3/issue/{issueKey}/transitions
Body: { transition: { id: "21" } }
```

**Fallback Handling**:
- If transition fails, issue still created successfully
- Warning logged but operation not failed
- User can manually transition in Jira

**Files**:
- `forge-app/src/utils/jira.js` - `getIssueTransitions`, `transitionIssue`
- `forge-app/src/resolvers/unassignedWorkResolvers.js` - Transition logic

#### 2.6.4 Permission Checks

**Role-Based Access Control**:

**Roles**:
1. **Jira Administrator**: Full access to all features
2. **Project Administrator**: Access to project team analytics
3. **Regular User**: Access to own time tracking only

**Permission Check API**:
```
GET /rest/api/3/mypermissions?permissions=ADMINISTER
Response: { permissions: { ADMINISTER: { havePermission: true } } }

GET /rest/api/3/user/permission/search?projectKey=SCRUM&permissions=ADMINISTER_PROJECTS
Response: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } }
```

**UI Behavior**:
- Team Analytics tab: Only visible to admins/project admins
- Settings page: Only accessible by Jira admins
- Unassigned work: Visible to all users (own data only)
- BRD upload: Requires `CREATE_ISSUES` permission

**Files**:
- `forge-app/src/resolvers/permissionsResolvers.js`
- `forge-app/src/utils/jira.js` - Permission checking functions

---

### 2.7 Settings & Configuration

**Location**: Jira Administration → Apps → "BRD & Time Tracker Settings"

**Access**: Jira Administrators only

**Purpose**: Configure Supabase connection for the Forge app

#### 2.7.1 Supabase Configuration

**Required Fields**:
```
Supabase URL: https://your-project.supabase.co
Supabase Anon Key: eyJhbG...
```

**Storage Format**:
- Stored in Forge Storage (encrypted)
- Scoped to Atlassian account ID
- Separate config per Jira user

**Configuration UI**:
```
┌────────────────────────────────────┐
│ BRD & Time Tracker Settings         │
├────────────────────────────────────┤
│ Supabase Connection                 │
│                                     │
│ Supabase URL:                       │
│ [https://xyz.supabase.co         ]  │
│                                     │
│ Supabase Anon Key:                  │
│ [eyJhbGciOi...                   ]  │
│                                     │
│ Status: ● Connected                 │
│                                     │
│     [Test Connection] [Save]        │
└────────────────────────────────────┘
```

**Test Connection**:
- Verifies URL is reachable
- Validates anon key
- Checks database connectivity
- Tests RLS policies

**Files**:
- `forge-app/src/resolvers/settingsResolvers.js`
- `forge-app/src/services/settingsService.js`
- `forge-app/static/settings/src/App.js`

---

### 2.8 User Management

**Description**: Links Atlassian accounts to Supabase user records

#### 2.8.1 User Creation Flow

**Trigger**: First API call from new user

**Process**:
1. Forge app receives request with `context.accountId`
2. Checks if user exists in `users` table
3. If not, creates new user:
   ```javascript
   {
     atlassian_account_id: context.accountId,
     email: user.emailAddress,
     display_name: user.displayName,
     created_at: NOW(),
     is_active: true,
     settings: {}
   }
   ```
4. Returns user ID for subsequent operations

**Jira User Info API**:
```
GET /rest/api/3/myself
Response: {
  accountId: "5f8...",
  displayName: "John Doe",
  emailAddress: "john@company.com"
}
```

**User Table Fields**:
- `id`: UUID (primary key)
- `atlassian_account_id`: Jira account ID (unique)
- `email`: User email from Jira
- `display_name`: Display name from Jira
- `supabase_user_id`: Optional link to Supabase auth
- `created_at`, `updated_at`: Timestamps
- `last_sync_at`: Last time issues were synced
- `is_active`: User status
- `settings`: JSONB for user preferences

**Files**:
- `forge-app/src/utils/supabase.js` - `getOrCreateUser`
- Database table: `users`

---

### 2.9 Diagnostic Tools

**Location**: Backend only (not in UI)

**Purpose**: Debug timezone and data issues

#### 2.9.1 Date Diagnostic Resolver

**Resolver**: `getDiagnosticDataForDate`

**Usage**:
```javascript
invoke('getDiagnosticDataForDate', {
  targetDate: '2025-11-26'  // YYYY-MM-DD
})
```

**Returns**:
```javascript
{
  targetDate: '2025-11-26',
  currentUser: { display_name: 'John Doe', email: '...' },
  screenshotCount: 15,
  screenshots: [
    {
      id: '...',
      timestamp: '2025-11-26T14:23:15.000Z',
      timestampUTC: '2025-11-26T14:23:15.000Z',
      windowTitle: 'VSCode - auth.js',
      applicationName: 'Code.exe',
      status: 'analyzed',
      analysisResults: [{
        timeSpent: 300,
        taskKey: 'SCRUM-123',
        workType: 'office',
        createdAt: '2025-11-26T14:28:20.000Z'
      }]
    }
  ],
  dailySummary: [{ work_date: '2025-11-26', total_seconds: 7200 }],
  totalTimeSeconds: 7200
}
```

**Use Cases**:
- Verify which date screenshots are assigned to
- Debug timezone conversion issues
- Confirm data exists in database
- Compare raw data vs aggregated views

**Files**:
- `forge-app/src/resolvers/diagnosticResolvers.js`

---

## 3. Technical Architecture

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                     User's Computer                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Python Desktop App                               │  │
│  │  • Screenshot capture every 5 min                 │  │
│  │  • Window title & app name extraction             │  │
│  │  • Direct upload to Supabase Storage              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓ Screenshot + Metadata
┌─────────────────────────────────────────────────────────┐
│                  Supabase (Database & Storage)          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                              │  │
│  │  • users, screenshots, analysis_results            │  │
│  │  • documents, worklogs, activity_log              │  │
│  │  • unassigned_work_groups, created_issues_log     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Object Storage (S3-compatible)                   │  │
│  │  • screenshots bucket (images)                    │  │
│  │  • documents bucket (BRD files)                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓ Poll for new screenshots
┌─────────────────────────────────────────────────────────┐
│                  AI Server (Node.js)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Polling Services                                 │  │
│  │  • Screenshot polling (every 30s)                 │  │
│  │  • Clustering polling (every 1 hour)              │  │
│  │  • BRD processing polling                         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  AI Analysis Services                             │  │
│  │  • GPT-4 Vision (screenshot → task detection)     │  │
│  │  • GPT-4 Text (BRD → requirements extraction)     │  │
│  │  • GPT-4 Clustering (sessions → groups)           │  │
│  │  • Tesseract OCR (fallback text extraction)       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓ Analysis results
┌─────────────────────────────────────────────────────────┐
│                     Jira (Atlassian)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Forge App (Custom Jira App)                      │  │
│  │  • Project Page: Time tracking dashboard          │  │
│  │  • Issue Panel: Issue-specific time analytics     │  │
│  │  • Admin Page: Settings configuration             │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  React Frontend (static/main/build)               │  │
│  │  • Dashboard with Day/Week/Month/Project views    │  │
│  │  • Unassigned Work management UI                  │  │
│  │  • BRD upload and issue creation UI               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Node.js Backend (Forge Resolvers)                │  │
│  │  • Analytics API                                  │  │
│  │  • Screenshot management                          │  │
│  │  • Issue operations                               │  │
│  │  • Worklog creation                               │  │
│  │  • Unassigned work operations                     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Jira REST API                                    │  │
│  │  • Issue CRUD operations                          │  │
│  │  • Worklog creation                               │  │
│  │  • User permissions                               │  │
│  │  • Project management                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

#### 3.2.1 Screenshot Analysis Flow

```
1. Desktop App captures screenshot
   ↓
2. Upload to Supabase Storage (screenshots bucket)
   • File: screenshots/{user_id}/{timestamp}.png
   • Metadata row in screenshots table (status: 'pending')
   ↓
3. AI Server polls for pending screenshots (every 30s)
   SELECT * FROM screenshots WHERE status = 'pending' LIMIT 10
   ↓
4. Download screenshot from storage
   ↓
5. Fetch user's assigned Jira issues from cache
   SELECT * FROM user_jira_issues_cache WHERE user_id = ?
   ↓
6. AI Analysis (GPT-4 Vision)
   • Input: Image + window title + app name + assigned issues
   • Output: Task key, project key, work type, confidence
   ↓
7. Store analysis results
   INSERT INTO analysis_results (screenshot_id, user_id, active_task_key, ...)
   UPDATE screenshots SET status = 'analyzed', analyzed_at = NOW()
   ↓
8. User views in Forge dashboard
   • Queries analysis_results joined with screenshots
   • Grouped by issue, date, project, etc.
```

#### 3.2.2 Unassigned Work Clustering Flow

```
1. AI Server clustering poller runs (every 1 hour)
   ↓
2. Query unassigned sessions
   SELECT * FROM analysis_results
   WHERE active_task_key IS NULL
   AND work_type = 'office'
   AND manually_assigned = FALSE
   ↓
3. Group by user_id, batch process per user
   ↓
4. For each user:
   a. Fetch user's assigned issues
   b. Call GPT-4 clustering API
   c. Parse clustering results
   ↓
5. Store groups in database
   INSERT INTO unassigned_work_groups (user_id, label, description, ...)
   INSERT INTO unassigned_group_members (group_id, unassigned_activity_id)
   ↓
6. User views in Forge "Unassigned Work" tab
   • Queries unassigned_work_groups for current user
   • Displays groups with assignment options
   ↓
7. User assigns group
   • Option A: Assign to existing issue
     - Updates analysis_results.active_task_key
     - Creates Jira worklog
   • Option B: Create new issue
     - Creates issue via Jira API
     - Updates analysis_results.active_task_key
     - Creates initial worklog
     - Caches new issue
   ↓
8. Group marked as assigned
   UPDATE unassigned_work_groups
   SET is_assigned = TRUE, assigned_to_issue_key = ?
```

#### 3.2.3 BRD Processing Flow

```
1. User uploads BRD document in Forge app
   ↓
2. Forge app converts file to base64
   ↓
3. Resolver uploads to Supabase Storage
   • File: documents/{user_id}/{filename}
   • Metadata row in documents table (status: 'uploaded')
   ↓
4. AI Server BRD poller detects new document (every 1 minute)
   SELECT * FROM documents WHERE processing_status = 'uploaded'
   ↓
5. Download document from storage
   ↓
6. Extract text
   • PDF: pdf-parse library
   • DOCX: mammoth library
   UPDATE documents SET processing_status = 'extracting'
   ↓
7. AI Analysis (GPT-4)
   • Prompt: Extract requirements from text
   • Response: JSON array of requirements
   UPDATE documents SET processing_status = 'analyzing'
   ↓
8. Store parsed requirements
   UPDATE documents
   SET parsed_requirements = ?, processing_status = 'completed'
   ↓
9. User views in Forge app
   • Shows parsed requirements
   • User selects which to create
   ↓
10. Create Jira issues
    • For each selected requirement:
      POST /rest/api/3/issue
    • Log created issues:
      INSERT INTO created_issues_log
    • Cache for AI:
      INSERT INTO user_jira_issues_cache
```

### 3.3 Technology Stack

**Desktop App**:
- Python 3.x
- `pillow` - Screenshot capture
- `pygetwindow` - Window title extraction
- `psutil` - Process/application detection
- `supabase-py` - Supabase client

**AI Server**:
- Node.js 20.x
- `openai` - GPT-4 Vision and GPT-4 APIs
- `tesseract.js` - OCR text extraction
- `sharp` - Image processing
- `axios` - HTTP requests
- `pdf-parse` - PDF text extraction
- `mammoth` - DOCX text extraction
- `@supabase/supabase-js` - Supabase client

**Forge App**:
- Atlassian Forge Platform
- Node.js 20.x runtime
- React 18.x (frontend)
- `@forge/api` - Jira API client
- `@forge/resolver` - Backend resolvers
- `@forge/bridge` - React ↔ Resolver bridge

**Database**:
- PostgreSQL 15.x (via Supabase)
- PostgREST API for HTTP access
- Row Level Security (RLS) policies
- Materialized views for analytics

**Storage**:
- Supabase Storage (S3-compatible)
- Buckets: `screenshots`, `documents`
- RLS policies for access control

**External APIs**:
- Jira REST API v3
- OpenAI API (GPT-4 Vision, GPT-4)

---

## 4. Database Schema

### 4.1 Core Tables

#### 4.1.1 users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    atlassian_account_id TEXT UNIQUE NOT NULL,
    email TEXT,
    display_name TEXT,
    supabase_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::JSONB
);
```
**Purpose**: Links Atlassian accounts to application users

**Key Fields**:
- `atlassian_account_id`: Jira user's account ID (from `context.accountId`)
- `display_name`: User's name from Jira
- `last_sync_at`: When assigned issues were last cached

#### 4.1.2 screenshots
```sql
CREATE TABLE screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_url TEXT,
    window_title TEXT,
    application_name TEXT,
    file_size_bytes BIGINT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'analyzed', 'failed', 'deleted')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
```
**Purpose**: Stores screenshot metadata

**Status Values**:
- `pending`: Uploaded, waiting for AI analysis
- `processing`: Currently being analyzed
- `analyzed`: Analysis complete
- `failed`: Analysis failed
- `deleted`: Soft deleted by user

**Key Fields**:
- `timestamp`: When screenshot was captured (work timestamp)
- `storage_path`: Path in Supabase storage
- `window_title`: Active window title at capture time
- `application_name`: Active application name

#### 4.1.3 analysis_results
```sql
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    screenshot_id UUID NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    active_task_key TEXT,
    active_project_key TEXT,
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    extracted_text TEXT,
    detected_jira_keys TEXT[],
    is_active_work BOOLEAN DEFAULT TRUE,
    is_idle BOOLEAN DEFAULT FALSE,
    work_type TEXT DEFAULT 'office' CHECK (work_type IN ('office', 'non-office')),
    analyzed_by TEXT DEFAULT 'ai',
    ai_model_version TEXT,
    analysis_metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    worklog_created BOOLEAN DEFAULT FALSE,
    worklog_id TEXT,
    worklog_created_at TIMESTAMP WITH TIME ZONE,
    manually_assigned BOOLEAN DEFAULT FALSE,
    assignment_group_id UUID REFERENCES unassigned_work_groups(id)
);
```
**Purpose**: Stores AI analysis results for each screenshot

**Key Fields**:
- `active_task_key`: Detected Jira issue key (NULL = unassigned)
- `confidence_score`: AI confidence (0.0-1.0)
- `work_type`: `'office'` or `'non-office'`
- `analysis_metadata`: JSONB with AI reasoning, assigned issues used, etc.
- `manually_assigned`: TRUE if assigned via unassigned work UI
- `assignment_group_id`: Link to unassigned work group

#### 4.1.4 documents
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'doc')),
    file_size_bytes BIGINT NOT NULL,
    storage_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    processing_status TEXT DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'extracting', 'analyzing', 'completed', 'failed')),
    extracted_text TEXT,
    parsed_requirements JSONB,
    project_key TEXT,
    created_issues JSONB DEFAULT '[]'::JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    ai_model_version TEXT,
    processing_metadata JSONB DEFAULT '{}'::JSONB
);
```
**Purpose**: Stores BRD documents and processing results

**Status Flow**: `uploaded` → `extracting` → `analyzing` → `completed`

**Key Fields**:
- `parsed_requirements`: JSONB array of extracted requirements
- `created_issues`: JSONB array of created issue keys
- `error_message`: Error details if processing failed

#### 4.1.5 worklogs
```sql
CREATE TABLE worklogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_result_id UUID REFERENCES analysis_results(id) ON DELETE SET NULL,
    jira_worklog_id TEXT NOT NULL,
    jira_issue_key TEXT NOT NULL,
    time_spent_seconds INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
    error_message TEXT
);
```
**Purpose**: Tracks worklogs created in Jira

**Key Fields**:
- `jira_worklog_id`: ID returned by Jira API
- `analysis_result_id`: Optional link to source analysis result

### 4.2 Unassigned Work Tables

#### 4.2.1 unassigned_activity
```sql
CREATE TABLE unassigned_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_result_id UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    window_title TEXT,
    application_name TEXT,
    time_spent_seconds INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    analysis_metadata JSONB DEFAULT '{}'::JSONB,
    manually_assigned BOOLEAN DEFAULT FALSE,
    assigned_task_key TEXT,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose**: Stores individual unassigned work sessions

**Key Fields**:
- `manually_assigned`: TRUE when user assigns to issue
- `assigned_task_key`: Issue key assigned to
- `assigned_by`: User who made the assignment

#### 4.2.2 unassigned_work_groups
```sql
CREATE TABLE unassigned_work_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    session_count INTEGER NOT NULL DEFAULT 0,
    total_seconds INTEGER NOT NULL DEFAULT 0,
    confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),
    recommended_action TEXT CHECK (recommended_action IN ('assign_to_existing', 'create_new_issue')),
    suggested_issue_key TEXT,
    recommendation_reason TEXT,
    is_assigned BOOLEAN DEFAULT FALSE,
    assigned_to_issue_key TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose**: Stores AI-generated clusters of similar unassigned work

**Key Fields**:
- `label`: Group name (e.g., "Code Review - Auth Module")
- `confidence_level`: Clustering confidence
- `recommended_action`: AI recommendation
- `suggested_issue_key`: AI-suggested issue to assign to

#### 4.2.3 unassigned_group_members
```sql
CREATE TABLE unassigned_group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES unassigned_work_groups(id) ON DELETE CASCADE,
    unassigned_activity_id UUID NOT NULL REFERENCES unassigned_activity(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose**: Junction table linking groups to sessions

### 4.3 Supporting Tables

#### 4.3.1 user_jira_issues_cache
```sql
CREATE TABLE user_jira_issues_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_key TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL,
    project_key TEXT NOT NULL,
    issue_type TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose**: Caches user's assigned Jira issues for AI analysis

**Refresh**: When dashboard loads, when issues created

#### 4.3.2 created_issues_log
```sql
CREATE TABLE created_issues_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_key TEXT NOT NULL,
    issue_summary TEXT NOT NULL,
    session_count INTEGER,
    total_time_seconds INTEGER,
    assignment_group_id UUID REFERENCES unassigned_work_groups(id),
    created_via TEXT CHECK (created_via IN ('brd', 'unassigned_work')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose**: Audit log of issues created by the app

**Created Via**:
- `brd`: From BRD document processing
- `unassigned_work`: From unassigned work assignment

#### 4.3.3 activity_log
```sql
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
**Purpose**: General audit log for system events

### 4.4 Analytics Views

#### 4.4.1 daily_time_summary
```sql
CREATE VIEW daily_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    DATE(s.timestamp AT TIME ZONE 'UTC') as work_date,
    ar.active_project_key,
    ar.active_task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
LEFT JOIN users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'
GROUP BY ar.user_id, u.display_name, DATE(s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
ORDER BY work_date DESC, ar.user_id, active_project_key, active_task_key;
```
**Purpose**: Aggregates time by user, date, project, and task

**Usage**: Powers Day, Week, Month views

**Note**: Uses screenshot timestamp (when work happened), not analysis created_at

#### 4.4.2 weekly_time_summary
```sql
CREATE VIEW weekly_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    DATE_TRUNC('week', s.timestamp AT TIME ZONE 'UTC')::date as week_start,
    ar.active_project_key,
    ar.active_task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
LEFT JOIN users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'
GROUP BY ar.user_id, u.display_name, DATE_TRUNC('week', s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
ORDER BY week_start DESC, ar.user_id, active_project_key, active_task_key;
```
**Purpose**: Aggregates time by week

**Note**: Week starts on Sunday (PostgreSQL default for `DATE_TRUNC('week', ...)`)

#### 4.4.3 monthly_time_summary
```sql
CREATE VIEW monthly_time_summary AS
SELECT
    ar.user_id,
    u.display_name as user_display_name,
    DATE_TRUNC('month', s.timestamp AT TIME ZONE 'UTC')::date as month_start,
    ar.active_project_key,
    ar.active_task_key,
    COUNT(DISTINCT s.id) as screenshot_count,
    SUM(ar.time_spent_seconds) as total_seconds,
    ROUND(SUM(ar.time_spent_seconds) / 3600.0, 2) as total_hours,
    AVG(ar.confidence_score) as avg_confidence
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
LEFT JOIN users u ON u.id = ar.user_id
WHERE ar.work_type = 'office'
GROUP BY ar.user_id, u.display_name, DATE_TRUNC('month', s.timestamp AT TIME ZONE 'UTC'), ar.active_project_key, ar.active_task_key
ORDER BY month_start DESC, ar.user_id, active_project_key, active_task_key;
```

#### 4.4.4 project_time_summary
```sql
CREATE VIEW project_time_summary AS
SELECT
    ar.user_id,
    ar.active_project_key,
    SUM(ar.time_spent_seconds) AS total_seconds,
    COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
    COUNT(DISTINCT s.id) AS screenshot_count,
    MIN(s.timestamp) AS first_activity,
    MAX(s.timestamp) AS last_activity
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE AND ar.is_idle = FALSE AND ar.active_project_key IS NOT NULL
GROUP BY ar.user_id, ar.active_project_key;
```
**Purpose**: Lifetime totals per project per user

---

## 5. User Workflows

### 5.1 Initial Setup Workflow

**Actors**: Jira Admin, End User

**Steps**:

1. **Jira Admin: Install Forge App**
   - Navigate to Jira Administration → Manage Apps
   - Upload or install BRD Time Tracker app
   - Grant required permissions

2. **Jira Admin: Configure Supabase**
   - Go to Jira Administration → Apps → BRD & Time Tracker Settings
   - Enter Supabase URL and Anon Key
   - Test connection
   - Save configuration

3. **End User: Install Desktop App**
   - Download Python desktop app for their OS
   - Install dependencies: `pip install -r requirements.txt`
   - Configure `.env` file:
     ```env
     SUPABASE_URL=https://xyz.supabase.co
     SUPABASE_KEY=eyJhbGciOi...
     USER_ID=<their-user-id>
     SCREENSHOT_INTERVAL=300
     ```
   - Run app: `python main.py`
   - App minimizes to system tray

4. **AI Server Admin: Start AI Server**
   - Navigate to `ai-server/` directory
   - Configure `.env`:
     ```env
     OPENAI_API_KEY=sk-...
     SUPABASE_URL=https://xyz.supabase.co
     SUPABASE_KEY=eyJhbGciOi...
     FORGE_APP_URL=<forge-app-url>
     ```
   - Start server: `npm start`
   - Verify polling services start

5. **End User: First Login to Forge App**
   - Navigate to any Jira project
   - Click "BRD & Time Tracker" tab
   - User record auto-created in database
   - Assigned issues cached
   - Dashboard loads (no data yet)

6. **Wait for First Screenshot**
   - Desktop app captures screenshot (after 5 min)
   - AI server analyzes within 30s
   - Dashboard shows first time entry

### 5.2 Daily Time Tracking Workflow

**Actor**: Developer

**Steps**:

1. **Morning: Start Work**
   - Desktop app already running in system tray
   - Open IDE, browser with Jira
   - Start working on SCRUM-123

2. **Automatic Tracking (Background)**
   - Every 5 minutes: Desktop app captures screenshot
   - Within 30s: AI analyzes screenshot
     - Detects "Code.exe" window
     - Reads window title: "auth.js - SCRUM-123"
     - Matches to assigned issue SCRUM-123
     - Stores 5 min of time to SCRUM-123

3. **Mid-Day: Check Progress**
   - Open Jira → Project → BRD & Time Tracker tab
   - View Day view:
     ```
     SCRUM-123: 2h 30m
       Session 1: 9:00 AM → 11:30 AM (2h 30m)
     ```

4. **Afternoon: Switch Tasks**
   - Switch to working on SCRUM-124
   - No manual action needed
   - AI detects new issue in next screenshot

5. **End of Day: Review**
   - Check day total: 7h 15m
   - Breakdown:
     - SCRUM-123: 3h 45m
     - SCRUM-124: 2h 30m
     - SCRUM-125: 1h 0m

6. **Optional: Create Worklogs**
   - Click session → "Create Worklog"
   - Time logged to Jira issue

### 5.3 Unassigned Work Assignment Workflow

**Actor**: Developer

**Scenario**: Spent 2 hours researching without specific Jira issue

**Steps**:

1. **Work Session**
   - Browse documentation, StackOverflow
   - No Jira issue open or visible
   - Desktop app captures screenshots
   - AI can't match to any assigned issue
   - Time marked as unassigned

2. **Next Day: Review Unassigned Work**
   - Open Jira → Project → BRD & Time Tracker → Unassigned Work tab
   - See group:
     ```
     Research - Authentication Options
     3 sessions • 2h 15m • Medium Confidence

     Recommendation: Create new issue
     Reason: Doesn't match any assigned issue
     ```

3. **View Sessions**
   - Click "View Sessions"
   - See screenshots, window titles
   - Confirm it was research work

4. **Create New Issue**
   - Click "Create New Issue"
   - Fill form:
     - Summary: "Research authentication options"
     - Description: "Evaluated OAuth vs JWT"
     - Project: SCRUM
     - Type: Task
     - Status: Done
   - Click "Create & Assign"

5. **Result**
   - New issue SCRUM-201 created
   - 2h 15m worklog added
   - All 3 sessions linked to SCRUM-201
   - Group marked as assigned
   - Issue cached for future AI detection

6. **Alternative: Assign to Existing**
   - If user realizes it belongs to SCRUM-123
   - Click "Assign to Existing Issue"
   - Select SCRUM-123 from dropdown
   - 2h 15m added as worklog to SCRUM-123

### 5.4 BRD Processing Workflow

**Actor**: Business Analyst / Project Manager

**Scenario**: New project with 20-page requirements document

**Steps**:

1. **Prepare BRD Document**
   - Document in PDF or DOCX format
   - Contains sections: Introduction, Functional Requirements, Non-Functional Requirements
   - Requirements listed as numbered items or bullet points

2. **Upload to Forge App**
   - Open Jira → Project → BRD & Time Tracker → BRD Upload
   - Click "Upload Document"
   - Select file: `product_requirements_v2.pdf`
   - Click "Upload"

3. **Wait for Processing**
   - Document uploads to Supabase
   - AI Server detects new document (within 1 min)
   - Status updates:
     - Uploading... → Uploaded
     - Extracting text... (30s)
     - Analyzing with AI... (1-2 min)
     - Completed ✓

4. **Review Extracted Requirements**
   - See list of 25 requirements:
     ```
     ☑ User Login with Email (Story - High)
     ☑ Password Reset Flow (Story - Medium)
     ☑ Two-Factor Authentication (Story - Medium)
     ☑ User Profile Management (Story - Low)
     ... 21 more
     ```

5. **Select Requirements to Create**
   - Review each requirement
   - Deselect any that are out of scope
   - Select 20 to create

6. **Choose Project**
   - Select project: SCRUM
   - Click "Create Selected Issues"

7. **Issue Creation**
   - Progress indicator: Creating 1 of 20...
   - All 20 issues created in Jira
   - Success message:
     ```
     ✓ Created 20 issues successfully
       SCRUM-201: User Login with Email
       SCRUM-202: Password Reset Flow
       ...
     ```

8. **Verify in Jira**
   - Navigate to Jira project backlog
   - See all 20 new issues
   - Each has:
     - Summary from BRD
     - Description with details
     - Acceptance criteria (if extracted)
     - Labels: `brd-generated`, `auto-created`

9. **Track Created Issues**
   - Issues automatically cached
   - When developer works on them, AI can detect
   - Time tracked automatically

### 5.5 Team Analytics Workflow

**Actor**: Project Manager

**Scenario**: Weekly team productivity review

**Steps**:

1. **Access Team Analytics**
   - Navigate to Jira project
   - Open BRD & Time Tracker tab
   - User is Project Admin, sees "Team View" option
   - Click "Team View"

2. **View Team Summary**
   - See all team members:
     ```
     Alice Johnson
     This Week: 38h 30m | This Month: 152h 15m

     Bob Smith
     This Week: 35h 45m | This Month: 145h 0m

     Charlie Davis
     This Week: 40h 15m | This Month: 158h 30m
     ```

3. **Analyze By Project**
   - Switch to Project view
   - See time distribution:
     ```
     Project SCRUM: 114h 30m (3 developers)
     Project MOBILE: 45h 15m (2 developers)
     ```

4. **Export Data**
   - Click "Export to CSV"
   - Download team time report
   - Use for billing or reporting

5. **Privacy Note**
   - Manager does NOT see individual screenshots
   - Only aggregated time data
   - Respects user privacy

---

## 6. API Reference

### 6.1 Forge Resolvers (Backend API)

All resolvers are called from React frontend using `invoke()`:

```javascript
import { invoke } from '@forge/bridge';

const result = await invoke('resolverName', { payload });
```

#### 6.1.1 Analytics Resolvers

**getTimeAnalytics**
- **Description**: Get current user's time analytics
- **Input**: None (uses `context.accountId`)
- **Output**:
  ```javascript
  {
    success: true,
    data: {
      dailySummary: [{ work_date: '2025-11-28', total_seconds: 7200, ... }],
      weeklySummary: [...],
      monthlySummary: [...],
      projectSummary: [...]
    }
  }
  ```
- **File**: `forge-app/src/resolvers/analyticsResolvers.js`

**getAllAnalytics**
- **Description**: Get all users' analytics (Admin only)
- **Input**: None
- **Output**: Same as `getTimeAnalytics` but for all users
- **Permission**: Jira Administrator

**getProjectAnalytics**
- **Description**: Get analytics for specific project
- **Input**: `{ projectKey: 'SCRUM' }`
- **Output**: Project-specific analytics
- **Permission**: Project Administrator

**getProjectTeamAnalytics**
- **Description**: Get team analytics without screenshots
- **Input**: `{ projectKey: 'SCRUM' }`
- **Output**: Team aggregated data (no individual screenshots)
- **Permission**: Project Administrator

#### 6.1.2 Screenshot Resolvers

**getScreenshots**
- **Description**: Get user's screenshots
- **Input**: `{ limit: 50, offset: 0 }`
- **Output**:
  ```javascript
  {
    success: true,
    data: {
      screenshots: [{ id, timestamp, thumbnail_url, ... }],
      total: 150
    }
  }
  ```

**deleteScreenshot**
- **Description**: Delete a screenshot
- **Input**: `{ screenshotId: 'uuid' }`
- **Output**: `{ success: true, message: '...' }`

#### 6.1.3 BRD Resolvers

**uploadBRD**
- **Description**: Upload BRD document
- **Input**:
  ```javascript
  {
    fileName: 'requirements.pdf',
    fileType: 'pdf',
    fileData: 'base64-encoded-string',
    fileSize: 2500000
  }
  ```
- **Output**: `{ success: true, documentId: 'uuid', message: '...' }`

**createIssuesFromBRD**
- **Description**: Create Jira issues from parsed requirements
- **Input**:
  ```javascript
  {
    documentId: 'uuid',
    projectKey: 'SCRUM'
  }
  ```
- **Output**:
  ```javascript
  {
    success: true,
    createdIssues: ['SCRUM-201', 'SCRUM-202', ...],
    message: 'Created 20 issues'
  }
  ```

**getBRDStatus**
- **Description**: Get document processing status
- **Input**: `{ documentId: 'uuid' }`
- **Output**:
  ```javascript
  {
    success: true,
    document: {
      id: 'uuid',
      file_name: 'requirements.pdf',
      processing_status: 'completed',
      parsed_requirements: { requirements: [...] },
      created_issues: ['SCRUM-201', ...]
    }
  }
  ```

#### 6.1.4 Worklog Resolvers

**createWorklog**
- **Description**: Create worklog in Jira
- **Input**:
  ```javascript
  {
    issueKey: 'SCRUM-123',
    timeSpentSeconds: 7200,
    startedAt: '2025-11-28T14:00:00.000Z'
  }
  ```
- **Output**: `{ success: true, worklog: { id: '12345', ... } }`

#### 6.1.5 Issue Resolvers

**getUserAssignedIssues**
- **Description**: Get user's assigned issues
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    issues: [
      { key: 'SCRUM-123', summary: '...', status: '...' }
    ],
    total: 15
  }
  ```

**updateUserAssignedIssuesCache**
- **Description**: Refresh issue cache
- **Input**: None
- **Output**: `{ success: true, cached: 15, message: '...' }`

**getActiveIssuesWithTime**
- **Description**: Get issues with time tracking data
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    issues: [
      {
        key: 'SCRUM-123',
        summary: '...',
        timeTracked: 7200,
        lastWorkedOn: '2025-11-28T14:00:00.000Z',
        sessions: [
          { startTime: '...', endTime: '...', duration: 300 }
        ]
      }
    ]
  }
  ```

**getIssueTransitions**
- **Description**: Get available status transitions
- **Input**: `{ issueKey: 'SCRUM-123' }`
- **Output**:
  ```javascript
  {
    success: true,
    transitions: [
      { id: '21', name: 'In Progress', to: { name: 'In Progress' } }
    ]
  }
  ```

**updateIssueStatus**
- **Description**: Transition issue to new status
- **Input**: `{ issueKey: 'SCRUM-123', transitionId: '21' }`
- **Output**: `{ success: true, message: '...' }`

#### 6.1.6 Unassigned Work Resolvers

**getUnassignedWork**
- **Description**: Get raw unassigned work sessions
- **Input**: `{ limit: 50, offset: 0, dateFrom: '...', dateTo: '...' }`
- **Output**:
  ```javascript
  {
    success: true,
    sessions: [{ id, timestamp, window_title, time_spent_seconds, ... }],
    total: 25
  }
  ```

**getUnassignedGroups**
- **Description**: Get AI-clustered groups
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    groups: [
      {
        id: 'uuid',
        label: 'Code Review - Auth',
        description: '...',
        session_ids: ['uuid1', 'uuid2'],
        session_count: 5,
        total_seconds: 7200,
        confidence: 'high',
        recommendation: {
          action: 'assign_to_existing',
          suggested_issue_key: 'SCRUM-123',
          reason: '...'
        }
      }
    ],
    total_groups: 3
  }
  ```

**assignToExistingIssue**
- **Description**: Assign group to existing issue
- **Input**:
  ```javascript
  {
    sessionIds: ['uuid1', 'uuid2'],
    issueKey: 'SCRUM-123',
    groupId: 'uuid',
    totalSeconds: 7200
  }
  ```
- **Output**: `{ success: true, assigned_count: 5, worklog_id: '...' }`

**createIssueAndAssign**
- **Description**: Create new issue and assign group
- **Input**:
  ```javascript
  {
    sessionIds: ['uuid1', 'uuid2'],
    issueSummary: 'Research authentication',
    issueDescription: 'Evaluated OAuth vs JWT',
    projectKey: 'SCRUM',
    issueType: 'Task',
    totalSeconds: 7200,
    groupId: 'uuid',
    assigneeAccountId: '5f8...',
    statusName: 'In Progress'
  }
  ```
- **Output**: `{ success: true, issue_key: 'SCRUM-201', ... }`

**getUserProjects**
- **Description**: Get user's accessible projects
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    projects: [
      { key: 'SCRUM', name: 'Scrum Project', id: '10000' }
    ]
  }
  ```

**getAllUserAssignedIssues**
- **Description**: Get all assigned issues (for dropdown)
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    issues: [
      { key: 'SCRUM-123', summary: '...', status: '...' }
    ]
  }
  ```

**getProjectStatuses**
- **Description**: Get available statuses for project
- **Input**: `{ projectKey: 'SCRUM' }`
- **Output**:
  ```javascript
  {
    success: true,
    statuses: [
      { name: 'To Do', id: '1' },
      { name: 'In Progress', id: '3' }
    ]
  }
  ```

#### 6.1.7 Settings Resolvers

**getSettings**
- **Description**: Get user's Supabase settings
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    settings: {
      supabaseUrl: 'https://xyz.supabase.co',
      supabaseKey: 'eyJhbGci...'
    }
  }
  ```

**saveSettings**
- **Description**: Save Supabase settings
- **Input**:
  ```javascript
  {
    settings: {
      supabaseUrl: 'https://xyz.supabase.co',
      supabaseKey: 'eyJhbGci...'
    }
  }
  ```
- **Output**: `{ success: true, message: 'Settings saved' }`

#### 6.1.8 Permission Resolvers

**getUserPermissions**
- **Description**: Get user's permissions and roles
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    permissions: {
      isJiraAdmin: true,
      projectAdminProjects: ['SCRUM', 'MOBILE'],
      canCreateIssues: true,
      canEditIssues: true
    }
  }
  ```

#### 6.1.9 User Resolvers

**getCurrentUser**
- **Description**: Get current user info
- **Input**: None
- **Output**:
  ```javascript
  {
    success: true,
    user: {
      accountId: '5f8...',
      displayName: 'John Doe',
      emailAddress: 'john@company.com',
      avatarUrl: '...'
    },
    permissions: { ... }
  }
  ```

#### 6.1.10 Diagnostic Resolvers

**getDiagnosticDataForDate**
- **Description**: Get raw data for date (debugging)
- **Input**: `{ targetDate: '2025-11-26' }`
- **Output**: Raw screenshots and analysis for date

---

## 7. Configuration Guide

### 7.1 Environment Variables

#### Desktop App (.env)
```env
# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_BUCKET=screenshots

# User Configuration
USER_ID=uuid-from-supabase-users-table

# Screenshot Settings
SCREENSHOT_INTERVAL=300  # Seconds (5 minutes)
IDLE_THRESHOLD=300       # Seconds before considered idle
```

#### AI Server (.env)
```env
# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o
USE_AI_FOR_SCREENSHOTS=true

# Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Polling Configuration
SCREENSHOT_POLLING_INTERVAL=30000    # ms (30 seconds)
CLUSTERING_POLLING_INTERVAL=3600000  # ms (1 hour)
BRD_POLLING_INTERVAL=60000           # ms (1 minute)

# Processing Limits
SCREENSHOT_BATCH_SIZE=10
MAX_CONCURRENT_ANALYSES=5

# Forge App Integration (for fetching user issues)
FORGE_APP_URL=https://your-forge-app.atlassian.net
```

### 7.2 Supabase Setup

#### Storage Buckets

Create two storage buckets:

**screenshots**:
```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', false);

-- RLS Policy: Users can only access their own screenshots
CREATE POLICY "Users can read own screenshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots' AND auth.uid() = owner);

CREATE POLICY "Users can upload own screenshots"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'screenshots' AND auth.uid() = owner);
```

**documents**:
```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- RLS Policy: Users can only access their own documents
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid() = owner);

CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid() = owner);
```

#### Row Level Security

Apply RLS policies to all tables:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Example policy: Users can only see their own data
CREATE POLICY "Users see own screenshots"
ON screenshots FOR SELECT
USING (user_id = auth.uid());
```

### 7.3 Forge App Deployment

#### Prerequisites
- Node.js 20.x
- Forge CLI: `npm install -g @forge/cli`
- Atlassian account with app development enabled

#### Deployment Steps

```bash
# 1. Navigate to forge-app directory
cd forge-app

# 2. Install dependencies
npm install

# 3. Build React frontends
cd static/main && npm install && npm run build && cd ../..
cd static/settings && npm install && npm run build && cd ../..

# 4. Deploy to Forge
forge deploy

# 5. Install on Jira site
forge install

# 6. Upgrade (for updates)
forge deploy
```

#### manifest.yml Configuration

Key sections:
```yaml
app:
  runtime:
    name: nodejs20.x

modules:
  jira:projectPage:
    - key: brd-time-tracker-project-page
      title: BRD & Time Tracker

  jira:adminPage:
    - key: brd-time-tracker-settings
      title: BRD & Time Tracker Settings

permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - read:jira-user
  external:
    fetch:
      backend:
        - address: "*.supabase.co"
```

---

## 8. Troubleshooting

### 8.1 Common Issues

#### Issue: Screenshots not appearing in dashboard

**Symptoms**:
- Desktop app running
- Screenshots uploaded to Supabase
- No data in Forge dashboard

**Possible Causes**:
1. AI Server not running
2. Analysis failing
3. User not linked correctly

**Debug Steps**:
```sql
-- Check if screenshots exist
SELECT COUNT(*) FROM screenshots WHERE user_id = '<user-id>';

-- Check analysis status
SELECT status, COUNT(*)
FROM screenshots
WHERE user_id = '<user-id>'
GROUP BY status;

-- Check analysis results
SELECT COUNT(*) FROM analysis_results WHERE user_id = '<user-id>';
```

**Solutions**:
- Restart AI Server
- Check AI Server logs for errors
- Verify OpenAI API key is valid
- Check Supabase connection

---

#### Issue: Wrong dates showing in week view

**Symptoms**:
- Data appears on wrong day
- Off-by-one day error

**Cause**: Timezone mixing (UTC vs local)

**Solution**: Ensure using local time formatting everywhere (fixed in v3.34.0)

**Verification**:
```javascript
// Check date formatting in App.js
const formatLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
```

---

#### Issue: AI not detecting Jira issues

**Symptoms**:
- All work marked as unassigned
- AI not matching to issues

**Possible Causes**:
1. Issue cache not populated
2. Issues not visible in screenshot
3. User not assigned to issues

**Debug Steps**:
```sql
-- Check issue cache
SELECT * FROM user_jira_issues_cache WHERE user_id = '<user-id>';

-- Check AI analysis metadata
SELECT analysis_metadata
FROM analysis_results
WHERE user_id = '<user-id>'
ORDER BY created_at DESC
LIMIT 5;
```

**Solutions**:
- Click "Refresh Issues" in dashboard
- Ensure issue key visible in browser tab or window title
- Verify user is assigned to issues in Jira

---

#### Issue: Unassigned work groups empty

**Symptoms**:
- Have unassigned work
- No groups appearing

**Cause**: Clustering poller not running or failed

**Debug Steps**:
```sql
-- Check if unassigned work exists
SELECT COUNT(*) FROM analysis_results
WHERE user_id = '<user-id>' AND active_task_key IS NULL;

-- Check if groups exist
SELECT COUNT(*) FROM unassigned_work_groups
WHERE user_id = '<user-id>';
```

**Solutions**:
- Check AI Server clustering logs
- Manually trigger clustering (if implemented)
- Wait for next polling cycle (1 hour)

---

#### Issue: BRD processing stuck

**Symptoms**:
- Document uploaded
- Status stuck on "Extracting" or "Analyzing"

**Cause**: AI Server BRD poller error

**Debug Steps**:
```sql
-- Check document status
SELECT processing_status, error_message
FROM documents
WHERE id = '<document-id>';
```

**Solutions**:
- Check AI Server logs for errors
- Verify document is valid PDF/DOCX
- Check OpenAI API quota
- Manually update status to retry:
  ```sql
  UPDATE documents
  SET processing_status = 'uploaded'
  WHERE id = '<document-id>';
  ```

---

#### Issue: Session times incorrect

**Symptoms**:
- Session duration shows wrong time
- E.g., 7 minutes showing as 1 hour

**Cause**: Using analysis `created_at` instead of screenshot `timestamp` (fixed in v3.25.0)

**Verification**:
```javascript
// Check issueService.js line 124
const screenshotTimestamp = entry.screenshots?.timestamp || entry.created_at;
```

**Solution**: Ensure using v3.25.0 or later

---

#### Issue: Changes not appearing after deployment

**Symptoms**:
- Deployed new version
- UI still shows old code

**Cause**: Browser caching

**Solutions**:
1. Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
2. Empty Cache and Hard Reload:
   - Open DevTools (F12)
   - Right-click refresh button
   - Select "Empty Cache and Hard Reload"
3. Clear all browsing data:
   - Settings → Privacy → Clear browsing data
   - Select "Cached images and files"
4. Test in Incognito mode

---

### 8.2 Logging and Debugging

#### Enable Debug Logging

**AI Server**:
```javascript
// Add to .env
LOG_LEVEL=debug

// Check logs
tail -f logs/ai-server.log
```

**Forge App**:
```javascript
// Add console.log statements
console.log('[DEBUG] Variable:', variable);

// View in browser console (F12)
```

**Supabase**:
```sql
-- Enable query logging
SET log_statement = 'all';

-- View logs in Supabase dashboard
```

---

## Conclusion

This comprehensive documentation covers all features, technical architecture, workflows, API reference, configuration, and troubleshooting for the BRD Time Tracker application.

**Key Takeaways**:
- Automated time tracking with zero manual entry
- AI-powered activity detection using GPT-4 Vision
- Intelligent unassigned work clustering and recovery
- BRD automation for rapid issue creation
- Privacy-first architecture with user-owned data
- Seamless Jira integration

**For Further Assistance**:
- Check source code comments for implementation details
- Review database schema for data relationships
- Consult API reference for integration options
- Use diagnostic tools for troubleshooting

**Version History**:
- v3.35.0: Latest stable release
- v3.34.0: Fixed timezone bugs in week view
- v3.25.0: Fixed session duration calculation
- v3.0.0: Initial release with core features
