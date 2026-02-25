-- Migration: Add webhook trigger for activity_records table
-- Uses FOR EACH STATEMENT with transition tables so that a batch insert
-- of N records fires only ONE webhook call (not N individual calls).
--
-- How it works:
--   1. Desktop app batch-inserts 5-15 activity records in one statement
--   2. Trigger fires ONCE after the entire statement completes
--   3. Function collects all pending rows from the transition table
--   4. Sends them as a single JSON array in one pg_net HTTP call
--   5. Edge function forwards the batch to AI server /api/analyze-batch
--
-- This is more efficient than FOR EACH ROW because:
--   - 1 HTTP call instead of N
--   - 1 LLM call instead of N (AI server processes the whole batch together)
--   - Matches how the polling service already batches records

-- ============================================================================
-- FUNCTION: notify_activity_webhook
-- ============================================================================
-- Uses pg_net extension to HTTP POST to the activity-webhook edge function.
-- Receives the transition table 'new_rows' containing ALL inserted rows.
-- Filters for status='pending' rows only (non_productive/private are pre-analyzed).
-- SECURITY DEFINER so it can read the service_role_key from app.settings.
-- Note: No SET search_path here — matches notify_screenshot_webhook() pattern.
-- pg_net creates its own 'net' schema, and transition tables are ephemeral,
-- so both are accessible regardless of search_path.

CREATE OR REPLACE FUNCTION public.notify_activity_webhook()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  pending_records jsonb;
  pending_count integer;
BEGIN
  -- Collect only 'pending' rows from the transition table into a JSON array.
  -- Non-productive and private records are inserted with status='analyzed'
  -- and don't need AI processing.
  SELECT jsonb_agg(row_to_json(r)), count(*)
    INTO pending_records, pending_count
    FROM new_rows r
   WHERE r.status = 'pending';

  -- Nothing to process — all records were pre-analyzed (non_productive/private)
  IF pending_count = 0 OR pending_records IS NULL THEN
    RETURN NULL;
  END IF;

  -- Single HTTP call with all pending records as a JSON array
  PERFORM net.http_post(
    url := 'https://jvijitdewbypqbatfboi.supabase.co/functions/v1/activity-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'activity_records',
      'record_count', pending_count,
      'records', pending_records
    )
  );

  RETURN NULL;
END;
$function$;

-- ============================================================================
-- TRIGGER: on_activity_record_insert
-- ============================================================================
-- FOR EACH STATEMENT fires once per INSERT statement (not once per row).
-- REFERENCING NEW TABLE AS new_rows gives the function access to ALL inserted
-- rows via a transition table, so we can aggregate them into one webhook call.
--
-- Note: WHEN clause is not supported with FOR EACH STATEMENT triggers,
-- so the function itself filters for status='pending' rows.

CREATE TRIGGER on_activity_record_insert
  AFTER INSERT ON public.activity_records
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_activity_webhook();
