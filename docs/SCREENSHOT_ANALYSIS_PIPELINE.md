# Screenshot Analysis Pipeline - Detailed Explanation

## Overview

The screenshot analysis pipeline is a multi-stage process that captures user activity, analyzes it using AI, and stores the results for time tracking. This document explains each step in detail.

### **IMPORTANT: Processing Mechanism**

**The system uses POLLING as the ONLY active mechanism**:

- ✅ **AI Server polls Supabase every 30 seconds** for pending screenshots
- ✅ **No webhook configuration needed** - works out of the box
- ✅ **More reliable** - works behind firewalls, handles downtime automatically
- ✅ **Self-healing** - automatically processes backlog after service restart

**Webhook Code Status:**
- ⚠️ Webhook-related code exists in migrations and Edge Functions
- ⚠️ **BUT it's NOT configured and NOT used** - webhook URL is never set
- ⚠️ Database trigger exists but does nothing (webhook URL is NULL)
- ✅ **Polling is the ONLY mechanism that actually runs**

---

## Pipeline Architecture

**PRIMARY MECHANISM: Polling-Based Processing**

```
┌─────────────────┐
│  Desktop App    │  Step 1: Capture & Upload
│  (Python)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │  Step 2: Store (status='pending')
│  (PostgreSQL)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Server      │  Step 3: Polling Service (Every 30s)
│  (Node.js)      │  - Queries: WHERE status='pending'
│                 │  - Processes batch of 10
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Server      │  Step 4: Analysis Processing
│  (Node.js)      │  - Downloads image
│                 │  - Calls AI analysis
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OpenAI API     │  Step 5: AI Analysis
│  (GPT-4 Vision) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │  Step 6: Store Results
│  (Results)      │
└─────────────────┘
```

**Note:** The system uses **polling as the ONLY mechanism** because:
- ✅ More reliable (works behind firewalls/proxies)
- ✅ No configuration needed (works out of the box)
- ✅ Automatically handles missed screenshots
- ✅ Works in all network environments

**Webhook Code Status:** 
- ⚠️ Webhook code exists in migrations (`004_database_triggers.sql`) and Edge Functions
- ⚠️ **BUT it's NOT configured and NOT used** - webhook URL is never set
- ⚠️ Database trigger checks for webhook URL, and if NULL, does nothing
- ✅ **Polling is the ONLY active processing mechanism**

---

## Step-by-Step Detailed Flow

### **Step 1: Screenshot Capture (Desktop App)**

**Location:** `python-desktop-app/desktop_app.py`

#### 1.1 Capture Loop
```python
def tracking_loop(self):
    while self.running:
        # Check idle state
        if idle_duration > self.idle_timeout:
            # Skip capture when idle
            continue
        
        # Capture screenshot
        screenshot = self.capture_screenshot()
        if screenshot:
            window_info = self.get_active_window()
            self.upload_screenshot(screenshot, window_info)
        
        time.sleep(self.capture_interval)  # Default: 300 seconds (5 min)
```

**Key Features:**
- **Interval:** Configurable (default 5 minutes)
- **Idle Detection:** Skips capture when user is idle (>5 min no activity)
- **Duplicate Detection:** Uses MD5 hash to skip unchanged screenshots
- **Window Tracking:** Captures active window title and application name

#### 1.2 Screenshot Capture Function
```python
def capture_screenshot(self):
    screenshot = ImageGrab.grab()  # Full screen capture
    screenshot_bytes = screenshot.tobytes()
    current_hash = hashlib.md5(screenshot_bytes).hexdigest()
    
    # Skip if unchanged
    if current_hash == self.screenshot_hash:
        return None
    
    self.screenshot_hash = current_hash
    return screenshot
```

**What it captures:**
- Full screen image (PNG format)
- Active window title (e.g., "JIRA-123 - Fix bug in login")
- Application name (e.g., "chrome.exe", "code.exe")
- Timestamp (UTC)

#### 1.3 Window Information Extraction
```python
def get_active_window(self):
    hwnd = win32gui.GetForegroundWindow()
    title = win32gui.GetWindowText(hwnd)  # Window title
    
    _, pid = win32process.GetWindowThreadProcessId(hwnd)
    process = psutil.Process(pid)
    app_name = process.name()  # Application executable name
    
    return {'title': title, 'app': app_name}
```

**Extracted Data:**
- **Window Title:** Often contains Jira issue keys (e.g., "PROJ-123")
- **Application:** Helps classify work type (IDE = coding, Browser = web work)

#### 1.4 Upload to Supabase

**Location:** `python-desktop-app/desktop_app.py:835-925`

```python
def upload_screenshot(self, screenshot, window_info):
    # 1. Convert to bytes
    img_buffer = BytesIO()
    screenshot.save(img_buffer, format='PNG')
    img_bytes = img_buffer.getvalue()
    
    # 2. Create thumbnail (400x300, JPEG, 70% quality)
    thumbnail = screenshot.copy()
    thumbnail.thumbnail((400, 300))
    thumb_buffer = BytesIO()
    thumbnail.save(thumb_buffer, format='JPEG', quality=70)
    
    # 3. Generate storage paths
    timestamp = datetime.now(timezone.utc)
    storage_path = f"{user_id}/screenshot_{timestamp}.png"
    thumb_path = f"{user_id}/thumb_{timestamp}.jpg"
    
    # 4. Upload to Supabase Storage
    storage_client.storage.from_('screenshots').upload(
        storage_path, img_bytes, 
        file_options={'content-type': 'image/png'}
    )
    
    # 5. Fetch user's Jira issues (if cache expired)
    if self.should_refresh_issues_cache():
        self.user_issues = self.fetch_jira_issues()
    
    # 6. Insert metadata into database
    screenshot_data = {
        'user_id': self.current_user_id,
        'organization_id': self.organization_id,  # Multi-tenancy
        'timestamp': timestamp.isoformat(),
        'storage_url': screenshot_url,
        'storage_path': storage_path,
        'thumbnail_url': thumb_url,
        'window_title': window_info['title'],
        'application_name': window_info['app'],
        'file_size_bytes': len(img_bytes),
        'status': 'pending',  # ⚠️ Key status - triggers webhook
        'user_assigned_issues': self.user_issues  # For AI context
    }
    
    db_client.table('screenshots').insert(screenshot_data).execute()
```

**What gets stored:**
- **Storage:** Full image + thumbnail in Supabase Storage
- **Database:** Metadata record with `status='pending'`
- **Multi-tenancy:** All data tagged with `organization_id`

**Storage Structure:**
```
screenshots/
└── {organization_id}/
    └── {user_id}/
        ├── screenshot_1234567890.png  (Full image)
        └── thumb_1234567890.jpg        (Thumbnail)
```

---

### **Step 2: AI Server Polling (PRIMARY MECHANISM)**

**Location:** `ai-server/src/services/polling-service.js`

**This is the PRIMARY mechanism** - AI Server automatically polls for pending screenshots every 30 seconds.

#### 2.1 Polling Service Startup

**Location:** `ai-server/src/index.js:96-98`

```javascript
// Start polling service to process pending screenshots
pollingService.start();
logger.info('Screenshot analysis polling service started - will process pending screenshots automatically');
```

The polling service starts automatically when the AI Server starts.

#### 2.2 Polling Loop

**Location:** `ai-server/src/services/polling-service.js:18-34`

```javascript
class PollingService {
  constructor() {
    this.pollInterval = parseInt(process.env.POLLING_INTERVAL_MS || '30000', 10); // 30 seconds
    this.batchSize = parseInt(process.env.POLLING_BATCH_SIZE || '10', 10); // Process 10 at a time
  }

  start() {
    this.isRunning = true;
    
    // Process immediately on start
    this.processPendingScreenshots();
    
    // Then set up interval (every 30 seconds)
    this.intervalId = setInterval(() => {
      this.processPendingScreenshots();
    }, this.pollInterval);
  }
}
```

**What happens:**
1. **Immediate Processing:** Processes pending screenshots on startup
2. **Interval Polling:** Checks every 30 seconds for new pending screenshots
3. **Batch Processing:** Processes up to 10 screenshots per cycle
4. **Prevents Overlap:** Skips cycle if previous one is still running

#### 2.3 Fetch Pending Screenshots

**Location:** `ai-server/src/services/polling-service.js:56-72`

```javascript
async processPendingScreenshots() {
  // Skip if already processing (prevent overlapping runs)
  if (this.processing) {
    logger.debug('Previous polling cycle still running, skipping this cycle');
    return;
  }

  this.processing = true;

  try {
    // Fetch pending screenshots from Supabase
    const pendingScreenshots = await supabaseService.getPendingScreenshots(this.batchSize);
    // Query: SELECT * FROM screenshots WHERE status='pending' ORDER BY created_at ASC LIMIT 10

    if (pendingScreenshots.length === 0) {
      logger.debug('No pending screenshots to process');
      return;
    }

    logger.info(`Processing ${pendingScreenshots.length} pending screenshot(s)`);
    
    // Process each screenshot...
  }
}
```

**Database Query:**
```sql
SELECT * FROM screenshots 
WHERE status = 'pending' 
ORDER BY created_at ASC 
LIMIT 10
```

**Why polling is better:**
- ✅ **No configuration needed** - works out of the box
- ✅ **Works behind firewalls** - no inbound connections required
- ✅ **Handles missed screenshots** - automatically processes backlog
- ✅ **More reliable** - doesn't depend on webhook URL configuration
- ✅ **Self-healing** - recovers from downtime automatically

---

### **Step 3: Process Individual Screenshot**

**Location:** `ai-server/src/services/polling-service.js:146-250`

For each pending screenshot found, the polling service processes it:

```javascript
async processScreenshot(screenshot) {
  const {
    id: screenshot_id,
    user_id,
    organization_id,
    storage_url,
    storage_path,
    window_title,
    application_name,
    timestamp,
    user_assigned_issues  // May be in screenshot metadata
  } = screenshot;

  // 1. Update status to 'processing'
  await supabaseService.updateScreenshotStatus(screenshot_id, 'processing');

  // 2. Parse user's assigned issues (if stored in screenshot metadata)
  let parsedAssignedIssues = user_assigned_issues;
  if (typeof parsedAssignedIssues === 'string') {
    parsedAssignedIssues = JSON.parse(parsedAssignedIssues);
  }

  // 3. If no issues in metadata, fetch from cache
  if (!parsedAssignedIssues || parsedAssignedIssues.length === 0) {
    const cachedIssues = await supabaseService.getUserCachedIssues(user_id, organization_id);
    parsedAssignedIssues = cachedIssues.map(issue => ({
      key: issue.issue_key,
      summary: issue.summary,
      status: issue.status,
      projectKey: issue.project_key
    }));
  }

  // 4. Download screenshot from Supabase Storage
  const imageBuffer = await supabaseService.downloadFile('screenshots', storage_path);

  // 5. Analyze using AI
  const analysis = await screenshotService.analyzeActivity({
    imageBuffer,
    windowTitle: window_title,
    applicationName: application_name,
    timestamp,
    userId: user_id,
    userAssignedIssues: parsedAssignedIssues || []
  });

  // 6. Save results to database
  await supabaseService.saveAnalysisResult({
    screenshot_id,
    user_id,
    organization_id,
    time_spent_seconds: analysis.timeSpentSeconds,
    active_task_key: analysis.taskKey,
    active_project_key: analysis.projectKey,
    confidence_score: analysis.confidenceScore,
    work_type: analysis.workType,
    detected_jira_keys: analysis.detectedJiraKeys,
    ai_model_version: analysis.modelVersion,
    analysis_metadata: analysis.metadata
  });

  // 7. Update status to 'analyzed'
  await supabaseService.updateScreenshotStatus(screenshot_id, 'analyzed');
}
```

**Processing Steps:**
1. **Status Update:** `pending` → `processing`
2. **Issue Fetch:** Gets user's assigned Jira issues (from cache or metadata)
3. **Download:** Fetches image from Supabase Storage
4. **Analyze:** Calls AI service (see Step 4)
5. **Store:** Saves analysis results
6. **Complete:** Updates status to `analyzed`

---

### **Webhook Code (NOT USED - Legacy/Unused Code)**

**Status:** Webhook-related code exists but is **NOT configured and NOT used**.

**What exists:**
1. **Database Trigger:** `supabase/migrations/004_database_triggers.sql`
   - Creates `notify_screenshot_webhook()` function
   - Creates trigger `on_screenshot_insert`
   - **BUT:** Trigger checks for webhook URL, and if NULL/empty, does nothing:
     ```sql
     IF webhook_url IS NULL OR webhook_url = '' THEN
         RAISE NOTICE 'Screenshot webhook URL not configured, skipping webhook call';
         RETURN NEW;  -- Does nothing, just returns
     END IF;
     ```

2. **Edge Function:** `supabase/functions/screenshot-webhook/index.ts`
   - Exists but is never called (webhook URL not set)

3. **Controller Endpoint:** `ai-server/src/controllers/screenshot-controller.js`
   - `/api/analyze-screenshot` endpoint exists
   - **BUT:** Only used by polling service internally, not by webhooks

**Why it's not used:**
- Webhook URL is never configured in database
- Polling service handles everything automatically
- No need for webhook configuration
- Polling is more reliable

**Conclusion:** Webhook code is **legacy/unused code** - can be ignored. Polling is the **ONLY active mechanism**.

---

### **Step 4: AI Server Processing**

**Location:** `ai-server/src/services/polling-service.js:146-250`

The polling service processes screenshots directly. The controller endpoint (`screenshot-controller.js`) exists but is **not used by webhooks** - it's legacy code. All processing happens in the polling service.

**Processing Steps (in polling service):**
1. **Download:** Fetches image from Supabase Storage
2. **Analyze:** Calls AI service (see Step 5)
3. **Store:** Saves analysis results to database
4. **Update:** Changes status to `analyzed`
5. **Worklog:** Optionally creates Jira worklog

---

### **Step 5: AI Analysis (Core Intelligence)**

**Location:** `ai-server/src/services/screenshot-service.js`

#### 5.1 Main Analysis Function

```javascript
exports.analyzeActivity = async ({ 
  imageBuffer, 
  windowTitle, 
  applicationName, 
  timestamp, 
  userId, 
  userAssignedIssues = [] 
}) => {
  // Calculate time spent (based on screenshot interval)
  const timeSpentSeconds = parseInt(
    process.env.SCREENSHOT_INTERVAL || '300'
  );
  
  // PRIMARY METHOD: GPT-4 Vision (analyzes image directly)
  let visionAnalysis = null;
  if (openai && imageBuffer) {
    try {
      visionAnalysis = await analyzeWithVision({
        imageBuffer,
        windowTitle,
        applicationName,
        userAssignedIssues
      });
    } catch (visionError) {
      logger.warn('Vision failed, falling back to OCR');
    }
  }
  
  // FALLBACK METHOD: OCR + GPT-4 Text (if Vision fails)
  if (!visionAnalysis && imageBuffer) {
    const extractedText = await extractText(imageBuffer);  // Tesseract OCR
    const detectedJiraKeys = extractJiraKeys(extractedText, windowTitle);
    
    visionAnalysis = await analyzeWithAI({
      extractedText,
      windowTitle,
      applicationName,
      detectedJiraKeys,
      userAssignedIssues
    });
  }
  
  // Return analysis results
  return {
    taskKey: visionAnalysis?.taskKey || null,
    projectKey: visionAnalysis?.projectKey || null,
    workType: visionAnalysis?.workType || 'office',
    confidenceScore: visionAnalysis?.confidenceScore || 0.0,
    detectedJiraKeys: visionAnalysis?.detectedJiraKeys || [],
    timeSpentSeconds,
    modelVersion: visionAnalysis?.modelVersion || 'v3.0-vision',
    metadata: {
      application: applicationName,
      windowTitle,
      reasoning: visionAnalysis?.reasoning || '',
      usedVision: !!visionAnalysis
    }
  };
};
```

**Analysis Strategy:**
1. **Primary:** GPT-4 Vision (direct image analysis) - Fast, accurate
2. **Fallback:** OCR + GPT-4 Text (if Vision fails) - Slower, less accurate
3. **Last Resort:** Basic heuristics (if both fail)

---

#### 5.2 GPT-4 Vision Analysis (Primary Method)

**Location:** `ai-server/src/services/screenshot-service.js:140-329`

```javascript
async function analyzeWithVision({ 
  imageBuffer, 
  windowTitle, 
  applicationName, 
  userAssignedIssues = [] 
}) {
  // 1. Convert image to base64
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;
  
  // 2. Build user's assigned issues context
  let assignedIssuesText = 'None - track all work';
  if (userAssignedIssues.length > 0) {
    assignedIssuesText = userAssignedIssues
      .slice(0, 20)  // Limit to 20 to avoid token limits
      .map(issue => {
        let text = `- ${issue.key}: ${issue.summary} (Status: ${issue.status})`;
        if (issue.description) {
          text += `\n  Description: ${issue.description.substring(0, 200)}`;
        }
        if (issue.labels) {
          text += `\n  Labels: ${issue.labels.join(', ')}`;
        }
        return text;
      })
      .join('\n');
  }
  
  // 3. Build comprehensive prompt
  const prompt = `You are analyzing a screenshot to determine:
1. What Jira task the user is working on (if any)
2. Whether this is office work or non-office work

Context:
- Application: ${applicationName}
- Window Title: ${windowTitle}

User's Assigned Issues (from Jira):
${assignedIssuesText}

Analyze the screenshot and determine:
1. Work Type: 'office' or 'non-office'
2. Task Key: Which Jira issue (or null)
3. Confidence Score: 0.0 to 1.0
4. Detected Jira Keys: All visible keys
5. Reasoning: Brief explanation

Return ONLY valid JSON:
{
  "workType": "office" or "non-office",
  "taskKey": "PROJECT-123" or null,
  "projectKey": "PROJECT" or null,
  "confidenceScore": 0.0-1.0,
  "detectedJiraKeys": ["KEY1", "KEY2"],
  "reasoning": "Brief explanation"
}`;
  
  // 4. Call OpenAI GPT-4 Vision API
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',  // Has vision capabilities
    messages: [
      {
        role: 'system',
        content: 'You are an expert at analyzing work activity from screenshots...'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { 
            type: 'image_url', 
            image_url: { 
              url: imageDataUrl,
              detail: 'high'  // High detail for better analysis
            }
          }
        ]
      }
    ],
    temperature: 0.3,  // Lower = more consistent
    max_tokens: 500
  });
  
  // 5. Parse JSON response
  const content = response.choices[0].message.content.trim();
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonString = jsonMatch ? jsonMatch[1] : content;
  const aiResult = JSON.parse(jsonString);
  
  // 6. Validate and filter results
  // - Ensure taskKey is in user's assigned issues
  // - Filter detectedJiraKeys to only assigned issues
  // - Clamp confidence score between 0 and 1
  
  return {
    workType: aiResult.workType,
    taskKey: validatedTaskKey,
    projectKey: aiResult.projectKey,
    confidenceScore: Math.min(Math.max(aiResult.confidenceScore, 0), 1),
    detectedJiraKeys: filteredKeys,
    reasoning: aiResult.reasoning,
    modelVersion: 'v3.0-vision'
  };
}
```

**What GPT-4 Vision Analyzes:**
- **Visual Content:** Code, text, UI elements, browser tabs
- **Jira Keys:** Visible issue keys (e.g., "PROJ-123")
- **Context:** File names, code comments, application UI
- **Work Classification:** Office vs non-office based on visual cues

**Key Features:**
- **High Detail Mode:** Analyzes image at full resolution
- **Context-Aware:** Uses window title, app name, assigned issues
- **Validation:** Only returns task keys from assigned issues
- **Confidence Scoring:** Provides reliability metric

---

#### 5.3 OCR Fallback Method

**Location:** `ai-server/src/services/screenshot-service.js:462-488`

If Vision API fails, falls back to OCR:

```javascript
async function extractText(imageBuffer) {
  // 1. Preprocess image for better OCR
  const processedImage = await sharp(imageBuffer)
    .greyscale()      // Convert to grayscale
    .normalize()     // Enhance contrast
    .toBuffer();
  
  // 2. Perform OCR using Tesseract
  const { data: { text } } = await Tesseract.recognize(
    processedImage,
    'eng',  // English language
    {
      logger: info => {
        if (info.status === 'recognizing text') {
          logger.debug(`OCR progress: ${(info.progress * 100).toFixed(0)}%`);
        }
      }
    }
  );
  
  return text.trim();
}

function extractJiraKeys(text, windowTitle = '') {
  // Regex pattern: PROJECT-123
  const jiraKeyPattern = /\b([A-Z]{2,10}-\d+)\b/g;
  const combinedText = `${text} ${windowTitle}`;
  const matches = combinedText.match(jiraKeyPattern);
  return matches ? [...new Set(matches)] : [];
}
```

**OCR Process:**
1. **Preprocess:** Grayscale + normalization
2. **Extract Text:** Tesseract OCR
3. **Find Keys:** Regex pattern matching
4. **Filter:** Only keys from assigned issues
5. **AI Analysis:** Send text to GPT-4 (not Vision)

**When OCR is Used:**
- Vision API unavailable
- Vision API rate limit exceeded
- Vision API returns error
- Network issues with OpenAI

---

### **Step 6: Store Analysis Results**

**Location:** `ai-server/src/services/supabase-service.js:36-53`

```javascript
exports.saveAnalysisResult = async (analysisData) => {
  const { data, error } = await supabase
    .from('analysis_results')
    .insert({
      screenshot_id: analysisData.screenshot_id,
      user_id: analysisData.user_id,
      organization_id: analysisData.organization_id,  // Multi-tenancy
      time_spent_seconds: analysisData.time_spent_seconds,
      active_task_key: analysisData.active_task_key,  // JIRA-123 or null
      active_project_key: analysisData.active_project_key,  // PROJECT or null
      confidence_score: analysisData.confidence_score,  // 0.0-1.0
      work_type: analysisData.work_type,  // 'office' or 'non-office'
      detected_jira_keys: analysisData.detected_jira_keys,  // Array
      ai_model_version: analysisData.ai_model_version,  // 'v3.0-vision'
      analysis_metadata: analysisData.analysis_metadata  // JSONB with reasoning
    })
    .select()
    .single();
  
  return data;
};
```

**What Gets Stored:**
- **Task Key:** Detected Jira issue (or null if unassigned)
- **Work Type:** 'office' or 'non-office'
- **Confidence:** 0.0-1.0 reliability score
- **Time Spent:** Seconds (based on screenshot interval)
- **Metadata:** AI reasoning, extracted text, model version

**Database Schema:**
```sql
analysis_results (
  id UUID PRIMARY KEY,
  screenshot_id UUID REFERENCES screenshots(id),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),  -- Multi-tenancy
  active_task_key TEXT,  -- JIRA-123 or NULL
  active_project_key TEXT,  -- PROJECT or NULL
  work_type TEXT,  -- 'office' or 'non-office'
  confidence_score DECIMAL,
  time_spent_seconds INTEGER,
  detected_jira_keys TEXT[],
  ai_model_version TEXT,
  analysis_metadata JSONB,  -- { reasoning, extractedText, ... }
  created_at TIMESTAMPTZ
)
```

---

### **Step 7: Handle Unassigned Work**

**Location:** `ai-server/src/services/supabase-service.js` (via triggers)

If `active_task_key` is `null`, the system creates an `unassigned_activity` record:

```sql
-- Database trigger (simplified)
CREATE TRIGGER create_unassigned_activity
AFTER INSERT ON analysis_results
FOR EACH ROW
WHEN (NEW.active_task_key IS NULL)
EXECUTE FUNCTION create_unassigned_activity_record();
```

**Unassigned Activity Record:**
```json
{
  "id": "uuid",
  "analysis_result_id": "uuid",
  "screenshot_id": "uuid",
  "user_id": "uuid",
  "organization_id": "uuid",
  "timestamp": "2025-12-04T10:30:00Z",
  "window_title": "Code Editor",
  "application_name": "code.exe",
  "time_spent_seconds": 300,
  "reason": "no_task_key",  // Why it's unassigned
  "confidence_score": 0.5,
  "manually_assigned": false
}
```

**Why Unassigned?**
- No Jira key visible in screenshot
- Work doesn't match any assigned issue
- Low confidence score (< 0.4)
- Generic work (browsing, meetings)

---

## Polling Service (PRIMARY MECHANISM)

**Location:** `ai-server/src/services/polling-service.js`

**The polling service is the PRIMARY mechanism** - it runs continuously and processes all pending screenshots automatically.

**Key Features:**
- ✅ **Automatic:** Starts when AI Server starts
- ✅ **Continuous:** Polls every 30 seconds
- ✅ **Batch Processing:** Processes up to 10 screenshots per cycle
- ✅ **Self-Healing:** Automatically processes backlog after downtime
- ✅ **No Configuration:** Works out of the box

**Configuration:**
- `POLLING_INTERVAL_MS`: Polling interval (default: 30000ms = 30 seconds)
- `POLLING_BATCH_SIZE`: Screenshots per batch (default: 10)

**Benefits:**
- **Reliability:** Ensures no screenshots are missed
- **Recovery:** Processes backlog after downtime automatically
- **Firewall-Friendly:** Works behind corporate firewalls (no inbound connections)
- **Simple:** No webhook URL configuration needed

---

## Data Flow Summary

### Complete Timeline (Polling-Based)

```
T+0s    Desktop App: Capture screenshot
T+1s    Desktop App: Upload to Supabase Storage
T+2s    Desktop App: Insert record (status='pending')
        └─► Screenshot now waiting in database

T+0-30s AI Server: Polling service checks for pending (every 30s)
        └─► Finds screenshot with status='pending'

T+3s    AI Server: Updates status='processing'
T+4s    AI Server: Fetches user's assigned issues from cache
T+5s    AI Server: Downloads screenshot from Storage
T+6s    AI Server: Calls OpenAI GPT-4 Vision API
T+8s    OpenAI: Returns analysis (workType, taskKey, confidence)
T+9s    AI Server: Validates taskKey against assigned issues
T+10s   AI Server: Saves to analysis_results table
T+11s   AI Server: Updates screenshot status='analyzed'
T+12s   Database: Creates unassigned_activity (if taskKey=null)
T+13s   Forge App: User can view results in analytics
```

**Total Processing Time:** 
- **Best Case:** ~10-15 seconds (if polled immediately)
- **Average Case:** ~20-25 seconds (average wait for next poll cycle)
- **Worst Case:** ~40 seconds (just missed a poll cycle)

**Note:** Processing happens within 0-30 seconds of upload, depending on when the next polling cycle runs.

---

## Error Handling & Fallbacks

### Error Scenarios

1. **Vision API Fails**
   - Fallback: OCR + GPT-4 Text
   - Last Resort: Basic heuristics

2. **Polling Service Down**
   - Screenshots remain 'pending' in database
   - When service restarts, automatically processes backlog
   - No data loss - all pending screenshots will be processed

3. **AI Server Down**
   - Status: Set to 'failed'
   - Recovery: Polling service retries later

4. **Storage Download Fails**
   - Error logged
   - Status: Set to 'failed'
   - Retry: Via polling service

5. **Database Insert Fails**
   - Error logged
   - Status: Remains 'processing'
   - Retry: Via polling service

---

## Performance Optimizations

1. **Screenshot Deduplication:** MD5 hash prevents duplicate uploads
2. **Thumbnail Generation:** Smaller images for UI preview
3. **Issue Caching:** User's issues cached to reduce API calls
4. **Batch Processing:** Polling service processes multiple screenshots
5. **Async Processing:** Non-blocking webhook handling

---

## Multi-Tenancy Considerations

Every step includes `organization_id`:

1. **Desktop App:** Tags screenshot with `organization_id`
2. **Database:** All queries filter by `organization_id`
3. **AI Server:** Inherits `organization_id` from screenshot
4. **Results:** Analysis results tagged with `organization_id`
5. **RLS Policies:** Enforce organization-level isolation

---

## Key Configuration

**Environment Variables:**
- `SCREENSHOT_INTERVAL`: Capture interval (default: 300s)
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_VISION_MODEL`: Model name (default: 'gpt-4o')
- `USE_AI_FOR_SCREENSHOTS`: Enable/disable AI (default: 'true')
- `AUTO_CREATE_WORKLOGS`: Auto-create Jira worklogs (default: 'false')
- `POLLING_INTERVAL_MS`: Polling service interval (default: 30000ms)

---

## Monitoring & Observability

**Key Metrics to Track:**
- Screenshot capture rate
- Analysis success rate
- Vision API vs OCR fallback rate
- Average processing time
- Unassigned work percentage
- Confidence score distribution

**Log Points:**
- Screenshot capture (Desktop App)
- Webhook trigger (Edge Function)
- AI analysis start/end (AI Server)
- Results storage (AI Server)
- Error conditions (All services)

---

## Conclusion

The screenshot analysis pipeline is a sophisticated multi-stage process that:

1. **Captures** user activity automatically
2. **Analyzes** using state-of-the-art AI (GPT-4 Vision)
3. **Classifies** work as office/non-office
4. **Detects** Jira task keys intelligently
5. **Stores** results for time tracking
6. **Handles** errors gracefully with fallbacks
7. **Supports** multi-tenancy throughout

The system is designed for **reliability**, **accuracy**, and **scalability**.

---

**Last Updated:** December 2025
