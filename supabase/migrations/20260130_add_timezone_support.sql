-- Migration: Add timezone support for correct date grouping
-- This migration adds user_timezone and work_date columns to the screenshots table
-- to properly handle sessions that cross midnight in the user's local timezone.

-- ============================================================================
-- STEP 1: Add new columns to screenshots table
-- ============================================================================

ALTER TABLE public.screenshots
ADD COLUMN IF NOT EXISTS user_timezone TEXT,
ADD COLUMN IF NOT EXISTS work_date DATE;

-- ============================================================================
-- STEP 2: Create index for efficient date-based queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_screenshots_user_work_date
ON public.screenshots (user_id, work_date DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_screenshots_org_user_work_date
ON public.screenshots (organization_id, user_id, work_date DESC)
WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 3: Create trigger function to auto-compute work_date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.compute_work_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    -- IMPORTANT: Only compute work_date if it's NOT already provided
    -- The desktop app sends the correct local date directly, so we should use that
    -- This trigger is a fallback for old desktop apps or missing data

    IF NEW.work_date IS NULL AND NEW.timestamp IS NOT NULL THEN
        -- Fallback: extract date from timestamp as stored
        -- Note: Since timestamps are stored without proper timezone context,
        -- we extract the date directly from the stored value
        NEW.work_date := DATE(NEW.timestamp);
    END IF;

    RETURN NEW;
END;
$function$;

-- ============================================================================
-- STEP 4: Create trigger on screenshots table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_compute_work_date ON public.screenshots;

CREATE TRIGGER trigger_compute_work_date
BEFORE INSERT OR UPDATE ON public.screenshots
FOR EACH ROW EXECUTE FUNCTION public.compute_work_date();

-- ============================================================================
-- STEP 5: Backfill work_date for existing records
-- Using UTC date as fallback since we don't know original timezone
-- ============================================================================

UPDATE public.screenshots
SET work_date = DATE(timestamp)
WHERE work_date IS NULL AND timestamp IS NOT NULL;

-- ============================================================================
-- VERIFICATION: Check migration success
-- ============================================================================

DO $$
BEGIN
    -- Verify columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'screenshots'
        AND column_name = 'user_timezone'
    ) THEN
        RAISE EXCEPTION 'Migration failed: user_timezone column not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'screenshots'
        AND column_name = 'work_date'
    ) THEN
        RAISE EXCEPTION 'Migration failed: work_date column not created';
    END IF;

    RAISE NOTICE 'Migration 20260130_add_timezone_support completed successfully';
END $$;
