# BRD Time Tracker - Features

> **Version:** 3.35.0
> **Last Updated:** 2025-11-28

---

## Application Overview

BRD Time Tracker is an intelligent time tracking and automation platform designed for development teams using Jira. It combines automated screenshot capture, AI-powered activity analysis, and seamless Jira integration to provide:

- **Automatic Time Tracking**: Captures work activity without manual logging
- **AI-Powered Analysis**: Uses GPT-4 Vision to detect what you're working on
- **BRD Automation**: Converts Business Requirements Documents into Jira issues
- **Team Analytics**: Provides comprehensive time tracking dashboards

---

## Feature Catalog

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

**Date Handling**:
- Uses local time zone throughout
- No UTC conversion (prevents day-shift bugs)
- Matches month view date logic exactly

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
1. Create Jira issue via API with:
   - Summary from requirement
   - Description with details
   - Priority and issue type
   - Acceptance criteria (if extracted)
   - Labels: `brd-generated`, `auto-created`
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

#### 2.6.2 Worklog Creation

**Automatic Worklog**: Created when assigning unassigned work

**Manual Worklog**: From session details in Day view

**Worklog Format**:
- Issue key
- Time spent (in seconds)
- Start time (ISO 8601 with timezone)
- Comment describing the work

**Worklog Tracking**:
- Logged in `worklogs` table
- Links to `analysis_result_id`
- Tracks sync status
- Stores Jira worklog ID for reference

#### 2.6.3 Issue Transitions

**Feature**: Change issue status directly from unassigned work assignment

**Workflow**:
1. User creates new issue from unassigned work
2. Selects desired status (e.g., "In Progress")
3. Issue created in default status (usually "To Do")
4. System fetches available transitions
5. Executes transition to desired status

**Fallback Handling**:
- If transition fails, issue still created successfully
- Warning logged but operation not failed
- User can manually transition in Jira

#### 2.6.4 Permission Checks

**Role-Based Access Control**:

**Roles**:
1. **Jira Administrator**: Full access to all features
2. **Project Administrator**: Access to project team analytics
3. **Regular User**: Access to own time tracking only

**UI Behavior**:
- Team Analytics tab: Only visible to admins/project admins
- Settings page: Only accessible by Jira admins
- Unassigned work: Visible to all users (own data only)
- BRD upload: Requires `CREATE_ISSUES` permission

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

---

### 2.8 Desktop App Settings

**Location**: Desktop Python Application

**Description**: Settings page in the desktop app frontend for configuring application tracking preferences.

**Future Plans**:
- **Whitelisted Applications**: Select applications that should always be tracked
- **Blacklisted Applications**: Select applications that should never be tracked

---

### 2.9 Event-Based Tracking

**Location**: Desktop Python Application

**Description**: Enhanced tracking system that captures work activity based on user events and interactions.

**Future Plans**:
- **Window Focus Events**: Track when user switches between applications
- **Active Window Monitoring**: Record time spent in each active window
- **Application Switch Detection**: Capture transitions between different applications
- **Event Logging**: Store detailed event timeline for accurate time attribution
- **Integration with Screenshot Capture**: Events complement periodic screenshot analysis

---

### 2.10 Offline Tracking

**Location**: Desktop Python Application

**Description**: Ability to track work activity and store data locally when internet connection is unavailable, with automatic sync when connection is restored.

**Future Plans**:
- **Local Storage**: Screenshots and metadata stored locally when offline
- **Queue Management**: Maintain queue of pending uploads
- **Automatic Sync**: Automatically upload queued data when connection restored
- **Conflict Resolution**: Handle data conflicts during sync
- **Status Indication**: Visual indicator of online/offline status
- **Data Integrity**: Ensure no data loss during offline periods

---

## Summary

**Key Features**:
1. **Screenshot Capture & Monitoring** - Automatic background screenshot capture
2. **AI-Powered Activity Analysis** - GPT-4 Vision detects work activity
3. **Time Tracking & Analytics** - Day/Week/Month/Project views with detailed analytics
4. **Unassigned Work Management** - AI clustering and manual assignment of unmatched work
5. **BRD Document Processing** - Automatic extraction and Jira issue creation from requirements documents
6. **Jira Integration** - Issue detection, worklog creation, status transitions, permissions
7. **Settings & Configuration** - Supabase connection management

**Future Plans**:
8. **Desktop App Settings** - Application whitelist/blacklist configuration
9. **Event-Based Tracking** - Granular tracking based on user events and window focus
10. **Offline Tracking** - Local storage and automatic sync when connection is restored

