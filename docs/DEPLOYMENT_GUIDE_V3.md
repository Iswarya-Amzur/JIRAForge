# Deployment Guide - Version 3.0 AI Improvements

## Overview

This guide covers all the changes needed to deploy the V3.0 AI improvements to production.

---

## Summary of Changes

### 1. Database Changes
- **New Column:** `work_type TEXT CHECK (work_type IN ('office', 'non-office'))`
- **Migration File:** `supabase/migrations/003_work_type_column.sql`
- **Views Updated:** daily_time_summary, weekly_time_summary, monthly_time_summary
- **Old Columns Kept:** is_active_work, is_idle (for backward compatibility)

### 2. AI Server Changes
- **Primary Method:** GPT-4 Vision (analyzes image directly)
- **Fallback Method:** OCR + GPT-4 Text (if Vision fails)
- **Files Changed:**
  - `ai-server/src/services/screenshot-service.js` - New Vision analysis
  - `ai-server/src/controllers/screenshot-controller.js` - Updated to use Vision
- **Removed:** Hardcoded work/non-work lists
- **New:** Dynamic AI classification based on actual screenshot content

### 3. Frontend Changes
- **Files Changed:**
  - `forge-app/src/services/analyticsService.js` - Updated all queries
  - `forge-app/src/services/issueService.js` - Updated time tracking query
- **Old:** `is_active_work=eq.true&is_idle=eq.false`
- **New:** `work_type=eq.office`

### 4. Desktop App Changes (TO BE IMPLEMENTED)
- **Feature:** Idle detection with 5-minute timeout
- **Auto-pause:** Stop taking screenshots when idle
- **Auto-resume:** Resume when activity detected
- **Tray Icon:** Orange color when idle

---

## Step-by-Step Deployment

### Step 1: Run Database Migration ⚙️

1. Open Supabase SQL Editor
2. Copy the entire contents of `supabase/migrations/003_work_type_column.sql`
3. Paste and click **Run**
4. Wait for completion

**Verification:**
```sql
-- Check new column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'analysis_results'
AND column_name = 'work_type';

-- Should return:
-- work_type | text | NO

-- Check data migration worked
SELECT
    work_type,
    COUNT(*) as count,
    SUM(time_spent_seconds) / 3600.0 as hours
FROM analysis_results
GROUP BY work_type;

-- Should show 'office' and 'non-office'
```

**Rollback (if needed):**
```sql
-- Drop new column
ALTER TABLE analysis_results DROP COLUMN work_type;

-- Restore old views (copy from backup)
```

---

### Step 2: Deploy AI Server 🤖

**Environment Variables:**

Ensure these are set in your AI server environment:

```bash
# Required
OPENAI_API_KEY=sk-proj-...  # Your OpenAI API key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

# Optional - Model Selection
OPENAI_VISION_MODEL=gpt-4o  # Default, best quality
# OR
OPENAI_VISION_MODEL=gpt-4o-mini  # Cheaper, faster, slightly lower quality

OPENAI_MODEL=gpt-4o-mini  # Fallback text model

# Feature Flags
USE_AI_FOR_SCREENSHOTS=true  # Enable AI analysis
AUTO_CREATE_WORKLOGS=false  # Don't auto-create worklogs yet
SCREENSHOT_INTERVAL=300  # 5 minutes
```

**Deployment Commands:**

```bash
cd ai-server

# Install dependencies (if needed)
npm install

# Test locally first
npm run dev

# Check logs for successful startup
# Should see: "[INFO] Server listening on port 3000"

# Production deployment
npm start

# Or with PM2
pm2 start src/index.js --name ai-server
pm2 save
pm2 startup
```

**Verification:**

```bash
# Check server is running
curl http://localhost:3000/health

# Should return: {"status": "ok"}

# Check OpenAI client initialized
# Look for log: "[INFO] OpenAI client initialized"
```

**Monitor Logs:**

```bash
# If using PM2
pm2 logs ai-server

# Look for successful Vision analysis:
# "[INFO] GPT-4 Vision analysis completed"
# OR fallback:
# "[WARN] GPT-4 Vision analysis failed, falling back to OCR + AI"
```

---

### Step 3: Deploy Forge App 🚀

**No Code Changes Needed**

The frontend changes are already in place. Just rebuild and deploy:

```bash
cd forge-app

# Build the app
npm run build

# Deploy to Forge
forge deploy

# Promote to production environment
forge install --upgrade

# Or install fresh (if first time)
forge install
```

**Verification:**

1. Open Jira
2. Navigate to your Forge app
3. Go to Time Analytics page
4. Check that time totals display correctly
5. Verify no console errors

**Test Queries:**

Open browser console in Time Analytics page:

```javascript
// Should work without errors
fetch('/api/time-analytics/user')
  .then(r => r.json())
  .then(d => console.log('Data:', d));
```

---

### Step 4: Test the System End-to-End 🧪

**Test Plan:**

1. **Take Test Screenshot** (Desktop App)
   - Ensure desktop app is running
   - Take a screenshot (wait for interval or trigger manually)

2. **Check AI Analysis**
   ```sql
   -- Check latest analysis in Supabase
   SELECT
       screenshot_id,
       work_type,
       active_task_key,
       confidence_score,
       ai_model_version,
       created_at
   FROM analysis_results
   ORDER BY created_at DESC
   LIMIT 10;
   ```

   **Expected Results:**
   - `work_type` should be 'office' or 'non-office'
   - `ai_model_version` should be 'v3.0-vision'
   - `confidence_score` should be between 0.0 and 1.0

3. **Check Time Analytics** (Forge App)
   - Open Time Analytics page
   - Verify "Today's Total", "This Week's Total", "This Month's Total" display
   - Check Day/Week/Month views work
   - Ensure team member cards show up

4. **Check AI Logs** (AI Server)
   ```bash
   pm2 logs ai-server --lines 100
   ```

   **Look for:**
   ```
   [INFO] GPT-4 Vision analysis completed
   [INFO] Screenshot analysis completed {
     screenshot_id: '...',
     taskKey: 'SCRUM-5',
     workType: 'office',
     confidenceScore: 0.95
   }
   ```

---

### Step 5: Monitor Performance 📊

**Check Analysis Speed:**

```sql
-- Average analysis time per screenshot
SELECT
    ai_model_version,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (created_at - (
        SELECT timestamp FROM screenshots s
        WHERE s.id = ar.screenshot_id
    )))) as avg_seconds,
    AVG(confidence_score) as avg_confidence
FROM analysis_results ar
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY ai_model_version;
```

**Expected Results:**
- v3.0-vision: 1-3 seconds average
- v2.0-ai-enhanced (fallback): 5-10 seconds average

**Check Work Type Distribution:**

```sql
-- Last 7 days
SELECT
    work_type,
    COUNT(*) as activities,
    SUM(time_spent_seconds) / 3600.0 as hours,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM analysis_results
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY work_type
ORDER BY hours DESC;
```

**Monitor API Costs:**

```sql
-- Count Vision API calls
SELECT
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE ai_model_version = 'v3.0-vision') as vision_calls,
    COUNT(*) FILTER (WHERE ai_model_version != 'v3.0-vision') as fallback_calls
FROM analysis_results
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**Estimated Cost:** ~$0.015 per Vision call = ~$15 per 1000 screenshots

---

## Troubleshooting

### Issue: Database migration fails

**Symptoms:**
```
ERROR: column "work_type" already exists
```

**Solution:**
```sql
-- Skip ADD COLUMN and just run UPDATE statements
UPDATE analysis_results
SET work_type = CASE
    WHEN is_active_work = TRUE AND is_idle = FALSE THEN 'office'
    WHEN is_active_work = FALSE OR is_idle = TRUE THEN 'non-office'
    ELSE 'non-office'
END
WHERE work_type IS NULL;
```

---

### Issue: Vision API returns 404 or 401

**Symptoms:**
```
[ERROR] GPT-4 Vision analysis error: Request failed with status code 401
```

**Solution:**

1. Check API key is valid:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

2. Verify you have access to gpt-4o:
   ```bash
   curl https://api.openai.com/v1/models/gpt-4o \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

3. Check rate limits:
   - Tier 1: 500 RPM (requests per minute)
   - Tier 2: 5000 RPM
   - Upgrade tier if needed: https://platform.openai.com/account/limits

4. Fall back to gpt-4o-mini (if gpt-4o not available):
   ```bash
   OPENAI_VISION_MODEL=gpt-4o-mini
   ```

---

### Issue: All screenshots classified as 'office'

**Symptoms:**
```sql
-- Returns 100% office, 0% non-office
SELECT work_type, COUNT(*) FROM analysis_results GROUP BY work_type;
```

**Solution:**

1. Check AI analysis reasoning:
   ```sql
   SELECT
       window_title,
       application_name,
       work_type,
       confidence_score,
       analysis_metadata->>'reasoning' as reasoning
   FROM analysis_results
   WHERE created_at > NOW() - INTERVAL '1 day'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

2. Review AI prompt in `screenshot-service.js`:
   - Ensure non-office examples are clear
   - Verify prompt mentions entertainment, social media, etc.

3. Test with obvious non-work screenshot:
   - Open YouTube entertainment video
   - Take screenshot
   - Check if classified as 'non-office'

---

### Issue: Frontend shows no data

**Symptoms:**
- Time Analytics page shows 0h 0m for all periods
- No data in Day/Week/Month views

**Solution:**

1. Check browser console for errors:
   ```javascript
   // Should not see errors
   ```

2. Verify Supabase queries work:
   ```sql
   -- Check daily_time_summary view
   SELECT * FROM daily_time_summary
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY work_date DESC
   LIMIT 10;
   ```

3. Check frontend query syntax:
   ```javascript
   // In browser console
   const response = await fetch('/api/analytics');
   const data = await response.json();
   console.log(data);
   ```

4. Ensure RLS policies allow access:
   ```sql
   -- Check policies on daily_time_summary
   SELECT * FROM pg_policies
   WHERE tablename = 'daily_time_summary';
   ```

---

## Rollback Plan

If you need to rollback:

### 1. Rollback Database

```sql
-- Drop work_type column
ALTER TABLE analysis_results DROP COLUMN work_type;

-- Restore old views
DROP VIEW daily_time_summary;
CREATE VIEW daily_time_summary AS
SELECT
    ar.user_id,
    DATE(s.timestamp) as work_date,
    -- ... (old view definition with is_active_work = TRUE)
FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
WHERE ar.is_active_work = TRUE AND ar.is_idle = FALSE
-- ...
```

### 2. Rollback AI Server

```bash
cd ai-server
git checkout <previous-commit>
npm install
pm2 restart ai-server
```

### 3. Rollback Forge App

```bash
cd forge-app
git checkout <previous-commit>
npm run build
forge deploy
```

---

## Desktop App Idle Detection (TODO)

**Implementation Guide:**

The desktop app needs to be updated with idle detection. Here's the implementation plan:

### Required Python Packages

```bash
pip install pynput  # For keyboard/mouse activity monitoring
```

### Code Changes Needed

**1. Add Idle Detection Variables (around line 280):**

```python
# Tracking state
self.running = False
self.tracking_active = False
self.is_idle = False  # NEW: Idle state
self.last_activity_time = time.time()  # NEW: Last mouse/keyboard activity
self.idle_timeout = 300  # NEW: 5 minutes idle timeout
self._tracking_thread = None
self._activity_monitor_thread = None  # NEW: Activity monitoring thread
self.screenshot_hash = None
```

**2. Add Activity Monitoring Method:**

```python
def monitor_user_activity(self):
    """Monitor mouse and keyboard activity"""
    from pynput import mouse, keyboard

    def on_activity(*args, **kwargs):
        """Called on any mouse or keyboard activity"""
        self.last_activity_time = time.time()

        # Resume tracking if idle
        if self.is_idle:
            print("[INFO] Activity detected, resuming tracking")
            self.is_idle = False
            self.update_tray_icon()

    # Start mouse listener
    mouse_listener = mouse.Listener(
        on_move=on_activity,
        on_click=on_activity,
        on_scroll=on_activity
    )
    mouse_listener.start()

    # Start keyboard listener
    keyboard_listener = keyboard.Listener(
        on_press=on_activity
    )
    keyboard_listener.start()

    print("[OK] Activity monitoring started")
```

**3. Update Tracking Loop (around line 770):**

```python
def tracking_loop(self):
    """Main tracking loop with idle detection"""
    print("[OK] Tracking started")

    while self.running:
        try:
            if not self.tracking_active:
                time.sleep(1)
                continue

            # Check for idle timeout
            idle_duration = time.time() - self.last_activity_time
            if idle_duration > self.idle_timeout:
                if not self.is_idle:
                    print(f"[INFO] No activity for {self.idle_timeout}s, pausing tracking")
                    self.is_idle = True
                    self.update_tray_icon()

                # Skip screenshot capture when idle
                time.sleep(5)  # Check every 5 seconds
                continue

            # Resume from idle if needed
            if self.is_idle:
                print("[INFO] Resuming from idle")
                self.is_idle = False
                self.update_tray_icon()

            # Capture screenshot (only when not idle)
            screenshot = self.capture_screenshot()
            if screenshot:
                # Get window info
                window_info = self.get_active_window()

                # Upload screenshot
                self.upload_screenshot(screenshot, window_info)

            # Wait for next interval
            time.sleep(self.capture_interval)

        except Exception as e:
            print(f"[ERROR] Tracking loop error: {e}")
            traceback.print_exc()
            time.sleep(5)
```

**4. Update start_tracking (around line 797):**

```python
def start_tracking(self):
    """Start screenshot tracking"""
    if self.running:
        return

    if not self.current_user_id:
        print("[WARN] Cannot start tracking - user not authenticated")
        return

    self.running = True
    self.tracking_active = True
    self.is_idle = False
    self.last_activity_time = time.time()

    # Start tracking thread
    self._tracking_thread = threading.Thread(target=self.tracking_loop, daemon=True)
    self._tracking_thread.start()

    # Start activity monitoring thread (NEW)
    self._activity_monitor_thread = threading.Thread(
        target=self.monitor_user_activity, daemon=True
    )
    self._activity_monitor_thread.start()

    # Update tray icon to green
    self.update_tray_icon()

    print("[OK] Tracking started")
```

**5. Update Tray Icon State (around line 875):**

```python
def get_tray_icon_state(self):
    """Determine the current state for tray icon color"""
    if not self.current_user:
        return 'red'  # Not logged in
    elif self.is_idle:
        return 'orange'  # NEW: Logged in but idle
    elif self.tracking_active:
        return 'green'  # Logged in and tracking
    else:
        return 'blue'  # Logged in but not tracking
```

**6. Add Orange Color to create_tray_icon (around line 841):**

```python
# Color mapping based on state
color_map = {
    'red': (220, 53, 69, 255),      # Red - not logged in
    'blue': (0, 82, 204, 255),      # Atlassian blue - logged in, not tracking
    'green': (40, 167, 69, 255),    # Green - logged in and tracking
    'orange': (255, 152, 0, 255)    # NEW: Orange - logged in, tracking, but idle
}
```

### Testing Idle Detection

1. Start desktop app
2. Login and start tracking
3. Wait 5 minutes without moving mouse or typing
4. Check tray icon turns orange
5. Move mouse
6. Check tray icon turns green again
7. Verify no screenshots taken during idle period

---

## Next Steps

1. ✅ Run database migration
2. ✅ Deploy AI server
3. ✅ Deploy Forge app
4. ✅ Test end-to-end
5. ⏳ Implement desktop app idle detection
6. ⏳ Monitor performance for 1 week
7. ⏳ Optionally drop old columns (is_active_work, is_idle) after verification

---

## Support

If you encounter issues:

1. Check logs:
   - AI Server: `pm2 logs ai-server`
   - Forge App: `forge logs`
   - Supabase: SQL Editor → "Logs" tab

2. Review documentation:
   - `docs/AI_ANALYSIS_FLOW.md` - Complete data flow
   - `docs/AI_IMPROVEMENTS_V3.md` - Technical details
   - `docs/DEPLOYMENT_GUIDE_V3.md` - This file

3. Common issues:
   - API key issues → Check OpenAI account
   - Database issues → Check migration SQL
   - Frontend issues → Check browser console

---

**Version:** 3.0
**Last Updated:** 2025-11-23
**Status:** Ready for Deployment (except desktop app idle detection)
