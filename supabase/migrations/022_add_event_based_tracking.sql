-- Migration: Add event-based tracking columns
-- This enables tracking activities based on window switches instead of fixed intervals
-- IMPORTANT: This changes time calculation from analysis_results.time_spent_seconds
--            to screenshots.duration_seconds

-- ============================================================================
-- STEP 1: Add start_time, end_time, and duration_seconds to screenshots table
-- ============================================================================

ALTER TABLE screenshots
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add comments for documentation
COMMENT ON COLUMN screenshots.start_time IS 'When user started this activity (window became active)';
COMMENT ON COLUMN screenshots.end_time IS 'When user ended this activity (switched to another window)';
COMMENT ON COLUMN screenshots.duration_seconds IS 'Duration of activity in seconds (end_time - start_time)';

-- ============================================================================
-- STEP 2: Populate existing data from analysis_results.time_spent_seconds
-- ============================================================================

-- Update existing screenshots with data from analysis_results
UPDATE screenshots s
SET
  duration_seconds = COALESCE(ar.time_spent_seconds, 300),
  end_time = s.timestamp,
  start_time = s.timestamp - (COALESCE(ar.time_spent_seconds, 300) * INTERVAL '1 second')
FROM analysis_results ar
WHERE ar.screenshot_id = s.id
  AND s.duration_seconds IS NULL;

-- For screenshots without analysis_results, use default 300 seconds (5 min)
UPDATE screenshots s
SET
  duration_seconds = 300,
  end_time = s.timestamp,
  start_time = s.timestamp - (300 * INTERVAL '1 second')
WHERE s.duration_seconds IS NULL;

-- ============================================================================
-- STEP 3: Add indexes for efficient time range queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_screenshots_time_range
ON screenshots(user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_screenshots_org_time_range
ON screenshots(organization_id, user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_screenshots_duration
ON screenshots(user_id, duration_seconds) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 4: Create trigger to auto-calculate duration on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_screenshot_duration()
RETURNS TRIGGER AS $$
BEGIN
  -- If start_time and end_time are set, calculate duration
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INTEGER;
  END IF;

  -- Set end_time from timestamp if not provided (backward compatibility)
  IF NEW.end_time IS NULL AND NEW.timestamp IS NOT NULL THEN
    NEW.end_time := NEW.timestamp;
  END IF;

  -- Set timestamp from end_time if not provided
  IF NEW.timestamp IS NULL AND NEW.end_time IS NOT NULL THEN
    NEW.timestamp := NEW.end_time;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_duration ON screenshots;

CREATE TRIGGER trigger_calculate_duration
BEFORE INSERT OR UPDATE ON screenshots
FOR EACH ROW
EXECUTE FUNCTION calculate_screenshot_duration();

-- ============================================================================
-- STEP 5: Update daily_time_summary view to use screenshots.duration_seconds
-- ============================================================================

DROP VIEW IF EXISTS daily_time_summary CASCADE;

CREATE OR REPLACE VIEW daily_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE(s.timestamp) AS work_date,
  ar.active_project_key AS project_key,
  ar.active_task_key AS task_key,
  ar.work_type,
  COUNT(*) AS session_count,
  SUM(s.duration_seconds) AS total_seconds,
  ROUND(SUM(s.duration_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM analysis_results ar
JOIN screenshots s ON ar.screenshot_id = s.id
LEFT JOIN users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE(s.timestamp), ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY work_date DESC, total_seconds DESC;

-- ============================================================================
-- STEP 6: Update weekly_time_summary view
-- ============================================================================

DROP VIEW IF EXISTS weekly_time_summary CASCADE;

CREATE OR REPLACE VIEW weekly_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('week', s.timestamp)::DATE AS week_start,
  ar.active_project_key AS project_key,
  ar.active_task_key AS task_key,
  ar.work_type,
  COUNT(*) AS session_count,
  SUM(s.duration_seconds) AS total_seconds,
  ROUND(SUM(s.duration_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM analysis_results ar
JOIN screenshots s ON ar.screenshot_id = s.id
LEFT JOIN users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('week', s.timestamp), ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY week_start DESC, total_seconds DESC;

-- ============================================================================
-- STEP 7: Update monthly_time_summary view
-- ============================================================================

DROP VIEW IF EXISTS monthly_time_summary CASCADE;

CREATE OR REPLACE VIEW monthly_time_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  u.display_name AS user_display_name,
  DATE_TRUNC('month', s.timestamp)::DATE AS month_start,
  ar.active_project_key AS project_key,
  ar.active_task_key AS task_key,
  ar.work_type,
  COUNT(*) AS session_count,
  SUM(s.duration_seconds) AS total_seconds,
  ROUND(SUM(s.duration_seconds)::NUMERIC / 3600.0, 2) AS total_hours,
  AVG(ar.confidence_score) AS avg_confidence
FROM analysis_results ar
JOIN screenshots s ON ar.screenshot_id = s.id
LEFT JOIN users u ON ar.user_id = u.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id, u.display_name, DATE_TRUNC('month', s.timestamp), ar.active_project_key, ar.active_task_key, ar.work_type
ORDER BY month_start DESC, total_seconds DESC;

-- ============================================================================
-- STEP 8: Update user_activity_summary view
-- ============================================================================

DROP VIEW IF EXISTS user_activity_summary CASCADE;

CREATE OR REPLACE VIEW user_activity_summary AS
SELECT
  ar.user_id,
  ar.organization_id,
  SUM(s.duration_seconds) AS total_seconds,
  COUNT(*) AS total_screenshots,
  COUNT(DISTINCT ar.active_task_key) AS unique_tasks,
  MIN(s.timestamp) AS first_activity,
  MAX(s.timestamp) AS last_activity
FROM analysis_results ar
JOIN screenshots s ON ar.screenshot_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY ar.user_id, ar.organization_id;

-- ============================================================================
-- STEP 9: Update project_time_summary view
-- ============================================================================

DROP VIEW IF EXISTS project_time_summary CASCADE;

CREATE OR REPLACE VIEW project_time_summary AS
SELECT
  ar.active_project_key AS project_key,
  ar.organization_id,
  SUM(s.duration_seconds) AS total_seconds,
  COUNT(DISTINCT ar.user_id) AS unique_users,
  COUNT(*) AS total_sessions,
  ROUND(SUM(s.duration_seconds)::NUMERIC / 3600.0, 2) AS total_hours
FROM analysis_results ar
JOIN screenshots s ON ar.screenshot_id = s.id
WHERE s.deleted_at IS NULL
  AND ar.active_project_key IS NOT NULL
GROUP BY ar.active_project_key, ar.organization_id
ORDER BY total_seconds DESC;

-- ============================================================================
-- STEP 10: Update team_analytics_summary view
-- ============================================================================

DROP VIEW IF EXISTS team_analytics_summary CASCADE;

CREATE OR REPLACE VIEW team_analytics_summary AS
SELECT
  ar.organization_id,
  DATE(s.timestamp) AS work_date,

  -- User metrics
  COUNT(DISTINCT ar.user_id) AS active_users,

  -- Time metrics (using screenshots.duration_seconds)
  SUM(s.duration_seconds) AS total_team_seconds,
  ROUND(SUM(s.duration_seconds)::NUMERIC / 3600.0, 2) AS total_team_hours,
  ROUND(AVG(s.duration_seconds)::NUMERIC / 3600.0, 2) AS avg_hours_per_session,

  -- Issue metrics
  COUNT(DISTINCT ar.active_task_key) AS unique_issues_worked,
  COUNT(*) AS total_screenshots,

  -- Project metrics
  COUNT(DISTINCT ar.active_project_key) AS active_projects,
  ARRAY_AGG(DISTINCT ar.active_project_key) FILTER (WHERE ar.active_project_key IS NOT NULL) AS project_keys

FROM analysis_results ar
JOIN screenshots s ON s.id = ar.screenshot_id
WHERE ar.work_type = 'office'
  AND s.deleted_at IS NULL
GROUP BY ar.organization_id, DATE(s.timestamp)
ORDER BY work_date DESC;

-- ============================================================================
-- STEP 11: Update unassigned_activity trigger to use screenshots.duration_seconds
-- ============================================================================

-- Update the trigger function to get duration from screenshots instead of analysis_results
CREATE OR REPLACE FUNCTION public.auto_save_unassigned_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if task_key is NULL or empty
    IF (NEW.active_task_key IS NULL OR NEW.active_task_key = '') THEN
        -- Insert into unassigned_activity table
        INSERT INTO public.unassigned_activity (
            analysis_result_id,
            screenshot_id,
            user_id,
            organization_id,
            timestamp,
            window_title,
            application_name,
            extracted_text,
            detected_jira_keys,
            confidence_score,
            time_spent_seconds,  -- Now populated from screenshots.duration_seconds
            reason,
            metadata
        )
        SELECT
            NEW.id,
            NEW.screenshot_id,
            NEW.user_id,
            NEW.organization_id,
            s.timestamp,
            s.window_title,
            s.application_name,
            NEW.extracted_text,
            NEW.detected_jira_keys,
            NEW.confidence_score,
            COALESCE(s.duration_seconds, NEW.time_spent_seconds, 300),  -- Use screenshots.duration_seconds first, fallback to analysis_results.time_spent_seconds
            CASE
                WHEN NEW.active_task_key IS NULL THEN 'no_task_key'
                WHEN NEW.active_task_key = '' THEN 'no_task_key'
                ELSE 'invalid_task_key'
            END,
            jsonb_build_object(
                'is_active_work', NEW.is_active_work,
                'is_idle', NEW.is_idle,
                'ai_model_version', NEW.ai_model_version,
                'active_project_key', NEW.active_project_key,
                'work_type', NEW.work_type
            )
        FROM public.screenshots s
        WHERE s.id = NEW.screenshot_id
        ON CONFLICT (analysis_result_id) DO UPDATE SET
          -- Update time_spent_seconds if screenshot was updated
          time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, unassigned_activity.time_spent_seconds);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================================================
-- STEP 12: Update unassigned_activity records to use screenshots.duration_seconds
-- ============================================================================

-- Backfill existing unassigned_activity records with duration from screenshots
UPDATE public.unassigned_activity ua
SET time_spent_seconds = COALESCE(s.duration_seconds, ua.time_spent_seconds)
FROM public.screenshots s
WHERE s.id = ua.screenshot_id
  AND s.duration_seconds IS NOT NULL;

-- ============================================================================
-- STEP 13: Create activity_sessions view for easy querying
-- ============================================================================

DROP VIEW IF EXISTS activity_sessions CASCADE;

CREATE OR REPLACE VIEW activity_sessions AS
SELECT
  s.id,
  s.user_id,
  s.organization_id,
  s.start_time,
  s.end_time,
  s.duration_seconds,
  s.window_title,
  s.application_name,
  s.timestamp AS captured_at,
  s.storage_path,
  s.thumbnail_url,
  ar.active_task_key,
  ar.active_project_key,
  ar.work_type,
  ar.confidence_score,
  ar.id AS analysis_result_id
FROM screenshots s
LEFT JOIN analysis_results ar ON ar.screenshot_id = s.id
WHERE s.deleted_at IS NULL
ORDER BY s.start_time DESC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  col_count INTEGER;
  null_duration_count INTEGER;
BEGIN
  -- Check columns exist
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'screenshots'
    AND column_name IN ('start_time', 'end_time', 'duration_seconds');

  IF col_count = 3 THEN
    RAISE NOTICE '✓ All new columns added successfully';
  ELSE
    RAISE EXCEPTION 'Migration failed: Not all columns were created';
  END IF;

  -- Check data migration
  SELECT COUNT(*) INTO null_duration_count
  FROM screenshots
  WHERE duration_seconds IS NULL;

  IF null_duration_count = 0 THEN
    RAISE NOTICE '✓ All existing screenshots have duration_seconds populated';
  ELSE
    RAISE NOTICE '⚠ % screenshots still have NULL duration_seconds', null_duration_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION SUMMARY ===';
  RAISE NOTICE 'New columns: start_time, end_time, duration_seconds';
  RAISE NOTICE 'Updated views: daily_time_summary, weekly_time_summary, monthly_time_summary';
  RAISE NOTICE '                user_activity_summary, project_time_summary, team_analytics_summary';
  RAISE NOTICE '                activity_sessions';
  RAISE NOTICE 'Updated trigger: auto_save_unassigned_activity (now uses screenshots.duration_seconds)';
  RAISE NOTICE '';
  RAISE NOTICE 'TIME CALCULATION CHANGE:';
  RAISE NOTICE '  OLD: SUM(analysis_results.time_spent_seconds)';
  RAISE NOTICE '  NEW: SUM(screenshots.duration_seconds)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠ CODE CHANGES REQUIRED:';
  RAISE NOTICE '  - Forge app services need to query screenshots.duration_seconds instead of';
  RAISE NOTICE '    analysis_results.time_spent_seconds';
  RAISE NOTICE '  - AI server needs to write duration_seconds to screenshots table';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Event-based tracking migration completed';
END $$;
