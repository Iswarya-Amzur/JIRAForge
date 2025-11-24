# AI Analysis Flow - Complete Explanation

This document explains what data we send to AI for analysis and what we get back.

---

## 1. WHAT DATA WE SEND TO AI

### Source: Desktop App → Supabase → AI Server (Webhook)

When a screenshot is captured, the following data is sent to the AI server:

```javascript
{
  // Screenshot identification
  id: "uuid-of-screenshot",
  screenshot_id: "uuid-of-screenshot",

  // User info
  user_id: "user-uuid",

  // Screenshot storage
  storage_url: "https://supabase.co/storage/screenshots/user123/screenshot_12345.png",
  storage_path: "user123/screenshot_12345.png",

  // Window context (captured by desktop app)
  window_title: "SCRUM-5 - Jira - Google Chrome",
  application_name: "chrome.exe",

  // Timestamp
  timestamp: "2025-11-23T10:30:00Z",

  // User's assigned Jira issues (from Jira API)
  user_assigned_issues: [
    {
      key: "SCRUM-5",
      summary: "Implement login feature",
      status: "In Progress",
      project: "SCRUM"
    },
    {
      key: "SCRUM-8",
      summary: "Fix bug in dashboard",
      status: "In Progress",
      project: "SCRUM"
    }
  ]
}
```

### Key Fields Explained

| Field | Source | Purpose |
|-------|--------|---------|
| `storage_url` | Supabase Storage | AI downloads the actual screenshot image |
| `window_title` | Desktop App (OS API) | "SCRUM-5 - Jira - Google Chrome" |
| `application_name` | Desktop App (OS API) | "chrome.exe", "vscode.exe", etc. |
| `timestamp` | Desktop App | When screenshot was taken |
| `user_assigned_issues` | Desktop App (Jira API) | User's "In Progress" issues |

---

## 2. WHAT THE AI SERVER DOES

### Step 1: Download Screenshot
```javascript
// AI server downloads the image from Supabase Storage
const imageBuffer = await downloadFile('screenshots', storage_path);
```

### Step 2: OCR (Extract Text)
```javascript
// Uses Tesseract.js to read text from the screenshot
const extractedText = await extractText(imageBuffer);
```

**Example extracted text:**
```
SCRUM-5 Implement login feature
Status: In Progress
Assignee: John Doe
Sprint: Sprint 10
```

### Step 3: Detect Jira Keys
```javascript
// Regex pattern to find Jira keys: PROJECT-123
const jiraKeyPattern = /[A-Z][A-Z0-9]+-\d+/g;
const detectedJiraKeys = extractedText.match(jiraKeyPattern);
// Result: ["SCRUM-5"]
```

### Step 4: Validate Against Assigned Issues
```javascript
// ONLY keep keys that are in user's assigned issues
const validKeys = detectedJiraKeys.filter(key =>
  user_assigned_issues.some(issue => issue.key === key)
);
// If SCRUM-5 is in assigned issues: ["SCRUM-5"]
// If not in assigned issues: [] (empty)
```

### Step 5: AI Enhancement (Optional - if OpenAI configured)
```javascript
// Send to OpenAI GPT to understand context
const aiAnalysis = await analyzeWithAI({
  extractedText: "SCRUM-5 Implement login feature...",
  windowTitle: "SCRUM-5 - Jira - Google Chrome",
  applicationName: "chrome.exe",
  detectedJiraKeys: ["SCRUM-5"],
  userAssignedIssues: [...]
});
```

**OpenAI Prompt (simplified):**
```
Given this screenshot context:
- Window: "SCRUM-5 - Jira - Google Chrome"
- App: chrome.exe
- OCR Text: "SCRUM-5 Implement login feature..."
- Detected Keys: ["SCRUM-5"]
- User's Assigned Issues: ["SCRUM-5", "SCRUM-8"]

Determine:
1. Is this active work? (true/false)
2. Is user idle? (true/false)
3. Which Jira issue are they working on?
4. Confidence score (0-1)
```

**AI Response:**
```json
{
  "taskKey": "SCRUM-5",
  "isActiveWork": true,
  "isIdle": false,
  "confidenceScore": 0.95
}
```

### Step 6: Determine Final Result

**Priority order:**
1. **Detected Jira key** (from OCR, validated against assigned issues) → Confidence: 0.9
2. **AI-inferred key** (from OpenAI, validated against assigned issues) → Confidence: varies
3. **Heuristic-inferred key** (from context, validated against assigned issues) → Confidence: 0.6
4. **No key found** → taskKey = NULL → Goes to `unassigned_activity`

### Step 7: Calculate Time Spent
```javascript
// Time between screenshots (from .env)
const timeSpentSeconds = parseInt(process.env.SCREENSHOT_INTERVAL || '300');
// Default: 300 seconds = 5 minutes
```

### Step 8: Determine Work Type
```javascript
// Check if it's idle time
const isIdle = checkIfIdle(applicationName, windowTitle, extractedText);
// Lock screen, screensaver, "Away" → isIdle = true

// Check if it's work-related
const isActiveWork = !isIdle && isWorkRelated(applicationName, windowTitle);
// Jira, VS Code, Slack → isActiveWork = true
// YouTube, Facebook → isActiveWork = false
```

---

## 3. WHAT DATA WE GET BACK FROM AI

### Saved to `analysis_results` Table

```javascript
{
  // Link to screenshot
  screenshot_id: "uuid",
  user_id: "user-uuid",

  // ✅ MAIN RESULTS
  active_task_key: "SCRUM-5",           // or NULL if not found
  active_project_key: "SCRUM",          // or NULL
  time_spent_seconds: 300,              // 5 minutes

  // Confidence & Classification
  confidence_score: 0.95,               // 0.0 to 1.0
  is_active_work: true,                 // true/false
  is_idle: false,                       // true/false

  // Raw data
  extracted_text: "SCRUM-5 Implement...", // Full OCR text
  detected_jira_keys: ["SCRUM-5"],        // All keys found

  // Metadata
  ai_model_version: "v2.0-ai-enhanced", // or "v1.0-tesseract"
  analysis_metadata: {
    application: "chrome.exe",
    windowTitle: "SCRUM-5 - Jira...",
    hasText: true,
    textLength: 250,
    aiEnhanced: true,
    assignedIssuesCount: 2,
    usedAssignedIssues: true
  },

  // Worklog tracking
  worklog_created: false,               // Set to true if worklog created
  worklog_id: null,

  // Timestamps
  created_at: "2025-11-23T10:30:05Z"
}
```

### Key Result Fields

| Field | Type | Example | Meaning |
|-------|------|---------|---------|
| `active_task_key` | String/NULL | "SCRUM-5" | Which Jira issue user was working on |
| `active_project_key` | String/NULL | "SCRUM" | Which project (extracted from task key) |
| `time_spent_seconds` | Integer | 300 | Time between screenshots (5 min) |
| `confidence_score` | Decimal | 0.95 | How confident AI is (0.0 - 1.0) |
| `is_active_work` | Boolean | true | Is this productive work? |
| `is_idle` | Boolean | false | Is user away/idle? |
| `extracted_text` | Text | "SCRUM-5..." | Full text from OCR |
| `detected_jira_keys` | Array | ["SCRUM-5"] | All Jira keys AI found |

---

## 4. COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│ DESKTOP APP                                             │
├─────────────────────────────────────────────────────────┤
│ 1. Capture screenshot every 5 minutes                   │
│ 2. Get window title: "SCRUM-5 - Jira - Chrome"         │
│ 3. Get app name: "chrome.exe"                           │
│ 4. Fetch user's Jira "In Progress" issues: [SCRUM-5]   │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ SUPABASE DATABASE                                       │
├─────────────────────────────────────────────────────────┤
│ INSERT INTO screenshots:                                │
│ - storage_url: "https://..."                            │
│ - window_title: "SCRUM-5 - Jira"                        │
│ - application_name: "chrome.exe"                        │
│ - user_assigned_issues: [{"key": "SCRUM-5", ...}]      │
│ - status: "pending"                                     │
└────────────────────┬────────────────────────────────────┘
                     ↓
                  WEBHOOK
                     ↓
┌─────────────────────────────────────────────────────────┐
│ AI SERVER (Node.js)                                     │
├─────────────────────────────────────────────────────────┤
│ 1. Download screenshot image from Supabase Storage      │
│ 2. OCR: Extract text from image                         │
│    → "SCRUM-5 Implement login feature..."               │
│ 3. Regex: Find Jira keys in text                        │
│    → ["SCRUM-5"]                                         │
│ 4. Validate: Check if in assigned issues                │
│    → "SCRUM-5" ✅ IN assigned issues                     │
│ 5. AI (optional): OpenAI GPT analysis                   │
│    → confidence: 0.95, isActiveWork: true                │
│ 6. Classify: Work type determination                    │
│    → isIdle: false, isActiveWork: true                   │
│ 7. Calculate: time_spent = 300 seconds                  │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ SUPABASE DATABASE                                       │
├─────────────────────────────────────────────────────────┤
│ INSERT INTO analysis_results:                           │
│ - active_task_key: "SCRUM-5"                            │
│ - active_project_key: "SCRUM"                           │
│ - time_spent_seconds: 300                               │
│ - confidence_score: 0.95                                │
│ - is_active_work: true                                  │
│ - is_idle: false                                        │
│ - extracted_text: "SCRUM-5 Implement..."                │
│ - detected_jira_keys: ["SCRUM-5"]                       │
│                                                          │
│ UPDATE screenshots:                                     │
│ - status: "analyzed"                                    │
└────────────────────┬────────────────────────────────────┘
                     ↓
                     ↓ (if trigger fires)
                     ↓
┌─────────────────────────────────────────────────────────┐
│ IF active_task_key IS NULL:                             │
│                                                          │
│ INSERT INTO unassigned_activity:                        │
│ - screenshot_id, user_id                                │
│ - window_title, application_name                        │
│ - extracted_text, time_spent_seconds                    │
│ - reason: "no_task_key"                                 │
│ - manually_assigned: false                              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. EXAMPLE SCENARIOS

### Scenario 1: Working on SCRUM-5 (Assigned Issue)

**Input:**
```
Window: "SCRUM-5 - Jira - Chrome"
App: chrome.exe
OCR Text: "SCRUM-5 Implement login feature Status: In Progress"
Assigned Issues: ["SCRUM-5", "SCRUM-8"]
```

**Output:**
```
active_task_key: "SCRUM-5" ✅
active_project_key: "SCRUM"
confidence_score: 0.95
is_active_work: true
is_idle: false
```

**Result:** Time counted for SCRUM-5

---

### Scenario 2: On YouTube (Not Working)

**Input:**
```
Window: "Cat Videos - YouTube - Chrome"
App: chrome.exe
OCR Text: "Subscribe Like Share"
Assigned Issues: ["SCRUM-5"]
```

**Output:**
```
active_task_key: NULL ❌
active_project_key: NULL
confidence_score: 0.0
is_active_work: false (entertainment)
is_idle: false
```

**Result:** Goes to `unassigned_activity` table, NOT counted in time analytics

---

### Scenario 3: Working on Unassigned Issue

**Input:**
```
Window: "PROJ-999 - Jira - Chrome"
App: chrome.exe
OCR Text: "PROJ-999 New feature"
Assigned Issues: ["SCRUM-5"]  ← PROJ-999 NOT in assigned issues
```

**Output:**
```
active_task_key: NULL ❌ (not in assigned issues)
active_project_key: NULL
confidence_score: 0.0
is_active_work: true
is_idle: false
```

**Result:** Goes to `unassigned_activity` even though working on Jira issue

---

## 6. KEY VALIDATION RULES

✅ **AI WILL SET task_key ONLY IF:**
1. Jira key detected in screenshot (via OCR or window title)
2. AND that key exists in user's assigned issues list
3. AND is_active_work = true
4. AND is_idle = false

❌ **AI WILL SET task_key = NULL IF:**
1. No Jira key detected
2. OR detected key NOT in user's assigned issues
3. OR is_idle = true (user away from computer)
4. OR is_active_work = false (entertainment/personal use)

---

This is exactly how your time tracking system works!

