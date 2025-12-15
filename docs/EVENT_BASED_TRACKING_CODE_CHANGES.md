# Event-Based Tracking Migration - Code Changes Required

## Overview

Migration `022_add_event_based_tracking.sql` changes the time calculation from `analysis_results.time_spent_seconds` to `screenshots.duration_seconds`. This document lists all code changes required to support this migration.

## Database Changes (Already in Migration)

✅ **Completed in migration:**
- Added `start_time`, `end_time`, `duration_seconds` columns to `screenshots` table
- Updated all database views to use `screenshots.duration_seconds`
- Updated `unassigned_activity` trigger to use `screenshots.duration_seconds`

## Code Changes Required

### 1. Forge App Services

#### 1.1 `forge-app/src/services/analyticsService.js`

**Lines 68-69, 84:** Query `analysis_results.time_spent_seconds` directly
- **Change:** Query should join with `screenshots` and use `s.duration_seconds` instead
- **Impact:** `fetchTimeAnalytics()` function - time by issue aggregation

**Lines 200, 250, 264:** Query `analysis_results.time_spent_seconds` for project analytics
- **Change:** Join with `screenshots` and use `s.duration_seconds`
- **Impact:** `fetchProjectAnalytics()` and `fetchProjectTeamAnalytics()` functions

**Example Fix:**
```javascript
// OLD:
`analysis_results?organization_id=eq.${organization.id}&active_task_key=not.is.null&select=active_task_key,active_project_key,time_spent_seconds,work_type&order=created_at.desc`

// NEW:
`analysis_results?organization_id=eq.${organization.id}&active_task_key=not.is.null&select=active_task_key,active_project_key,work_type,screenshots(duration_seconds)&order=created_at.desc`
```

Then update aggregation:
```javascript
// OLD:
issueAggregation[key].totalSeconds += result.time_spent_seconds || 0;

// NEW:
issueAggregation[key].totalSeconds += result.screenshots?.duration_seconds || 0;
```

#### 1.2 `forge-app/src/services/issueService.js`

**Line 111:** Query includes `time_spent_seconds` from `analysis_results`
- **Change:** Join with `screenshots` and select `screenshots.duration_seconds`
- **Impact:** `getActiveIssuesWithTime()` function

**Lines 139, 150:** Uses `entry.time_spent_seconds`
- **Change:** Use `entry.screenshots?.duration_seconds` instead
- **Impact:** Time aggregation and session building logic

**Example Fix:**
```javascript
// OLD:
`analysis_results?user_id=eq.${userId}&organization_id=eq.${organization.id}&work_type=eq.office&active_task_key=not.is.null&select=id,screenshot_id,active_task_key,time_spent_seconds,created_at,screenshots(id,timestamp,storage_path,window_title,application_name)&order=created_at.desc&limit=1000`

// NEW:
`analysis_results?user_id=eq.${userId}&organization_id=eq.${organization.id}&work_type=eq.office&active_task_key=not.is.null&select=id,screenshot_id,active_task_key,created_at,screenshots(id,timestamp,duration_seconds,storage_path,window_title,application_name)&order=created_at.desc&limit=1000`
```

Then update usage:
```javascript
// OLD:
timeByIssue[issueKey] += entry.time_spent_seconds || 0;
const timeSpent = entry.time_spent_seconds || 0;

// NEW:
timeByIssue[issueKey] += entry.screenshots?.duration_seconds || 0;
const timeSpent = entry.screenshots?.duration_seconds || 0;
```

#### 1.3 `forge-app/src/services/screenshotService.js`

**Line 39:** Query includes `time_spent_seconds` from `analysis_results`
- **Change:** Join with `screenshots` and select `screenshots.duration_seconds`
- **Impact:** `fetchScreenshots()` function - screenshot list display

**Example Fix:**
```javascript
// OLD:
`screenshots?user_id=eq.${userId}&organization_id=eq.${organization.id}&deleted_at=is.null&select=*,analysis_results(active_task_key,active_project_key,time_spent_seconds)&order=timestamp.desc&limit=${limit}&offset=${offset}`

// NEW:
`screenshots?user_id=eq.${userId}&organization_id=eq.${organization.id}&deleted_at=is.null&select=*,duration_seconds,analysis_results(active_task_key,active_project_key)&order=timestamp.desc&limit=${limit}&offset=${offset}`
```

#### 1.4 `forge-app/src/resolvers/diagnosticResolvers.js`

**Line 53:** Query includes `time_spent_seconds` from `analysis_results`
- **Change:** Select `screenshots.duration_seconds` instead
- **Impact:** Diagnostic data display

**Line 88:** Uses `ar.time_spent_seconds`
- **Change:** Use `screenshot.duration_seconds` or join with screenshots
- **Impact:** Diagnostic response mapping

**Example Fix:**
```javascript
// OLD:
`screenshots?organization_id=eq.${organization.id}&select=id,timestamp,window_title,application_name,status,analysis_results(id,time_spent_seconds,active_task_key,work_type,created_at)&order=timestamp.asc&limit=1000`

// NEW:
`screenshots?organization_id=eq.${organization.id}&select=id,timestamp,duration_seconds,window_title,application_name,status,analysis_results(id,active_task_key,work_type,created_at)&order=timestamp.asc&limit=1000`
```

Then update mapping:
```javascript
// OLD:
timeSpent: ar.time_spent_seconds,

// NEW:
timeSpent: s.duration_seconds,  // Use from screenshot, not analysis_result
```

### 2. Frontend Code

#### 2.1 `forge-app/static/main/src/App.js`

**Lines 1678-1679:** Displays `time_spent_seconds` from `analysis_results`
- **Change:** Display `screenshot.duration_seconds` instead
- **Impact:** Screenshot list UI display

**Example Fix:**
```javascript
// OLD:
{screenshot.analysis_results[0].time_spent_seconds &&
  ` (${formatTime(screenshot.analysis_results[0].time_spent_seconds)})`
}

// NEW:
{screenshot.duration_seconds &&
  ` (${formatTime(screenshot.duration_seconds)})`
}
```

**Line 872:** Comment mentions `time_spent_seconds`
- **Change:** Update comment to reference `duration_seconds`

### 3. AI Server Code

#### 3.1 `ai-server/src/controllers/screenshot-controller.js`

**Line 71:** Writes `time_spent_seconds` to `analysis_results`
- **Change:** Also write `duration_seconds`, `start_time`, `end_time` to `screenshots` table
- **Impact:** New screenshots will have event-based tracking data

**Example Fix:**
```javascript
// After saving analysis result, also update screenshot with duration
await supabaseService.updateScreenshotDuration({
  screenshot_id,
  duration_seconds: analysis.timeSpentSeconds,
  start_time: analysis.startTime,  // When window became active
  end_time: analysis.endTime      // When screenshot was taken (or window switched)
});
```

#### 3.2 `ai-server/src/services/supabase-service.js`

**Line 456:** Saves `time_spent_seconds` to `analysis_results`
- **Change:** Add method to update `screenshots` table with `duration_seconds`, `start_time`, `end_time`
- **Impact:** Need new method `updateScreenshotDuration()`

**Example Implementation:**
```javascript
async updateScreenshotDuration(screenshotId, { duration_seconds, start_time, end_time }) {
  const { error } = await this.supabase
    .from('screenshots')
    .update({
      duration_seconds,
      start_time,
      end_time: end_time || new Date().toISOString()  // Default to now if not provided
    })
    .eq('id', screenshotId);

  if (error) {
    throw error;
  }
}
```

#### 3.3 `ai-server/src/services/polling-service.js`

**Line 209:** Similar to screenshot-controller, needs to update screenshots table
- **Change:** After saving analysis result, update screenshot with duration data

### 4. Unassigned Activity (Already Handled)

✅ **Already updated in migration:**
- `unassigned_activity` trigger now uses `screenshots.duration_seconds`
- Existing `unassigned_activity` records backfilled with `screenshots.duration_seconds`
- `unassigned_activity_summary` view uses `ua.time_spent_seconds` (which is now populated from screenshots)

**Note:** `unassignedWorkResolvers.js` queries `unassigned_activity.time_spent_seconds` - this is fine because the trigger now populates it from `screenshots.duration_seconds`.

## Migration Strategy

### Phase 1: Database Migration (Complete)
1. ✅ Run migration `022_add_event_based_tracking.sql`
2. ✅ Verify all views are updated
3. ✅ Verify trigger is updated

### Phase 2: Backend Code Updates
1. Update Forge app services to query `screenshots.duration_seconds`
2. Update AI server to write `duration_seconds` to screenshots
3. Test all analytics endpoints

### Phase 3: Frontend Updates
1. Update UI to display `screenshot.duration_seconds`
2. Test screenshot list display

### Phase 4: Desktop App Updates
1. Update desktop app to send `start_time`, `end_time` with screenshots
2. Implement event-based tracking (window switch detection)

## Testing Checklist

- [ ] Analytics: Daily/weekly/monthly summaries show correct time
- [ ] Analytics: Time by issue aggregation is correct
- [ ] Analytics: Project time summaries are correct
- [ ] Screenshots: Display shows correct duration
- [ ] Unassigned work: Time calculations are correct
- [ ] Diagnostic: Time spent values are correct
- [ ] AI Server: New screenshots have `duration_seconds` populated
- [ ] Views: All database views return correct totals

## Backward Compatibility

⚠️ **Important:** The migration maintains backward compatibility:
- `analysis_results.time_spent_seconds` still exists (not removed)
- Existing queries will still work but may show incorrect totals
- New code should use `screenshots.duration_seconds` for accurate event-based tracking

## Rollback Plan

If issues occur, you can:
1. Keep the new columns (they don't break anything)
2. Revert views to use `analysis_results.time_spent_seconds` temporarily
3. Code changes can be reverted independently

