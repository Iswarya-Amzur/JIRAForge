-- BRD Automate & Time Tracker - Database Triggers
-- This migration sets up database triggers for automatic webhook notifications

-- =====================================================
-- ENABLE HTTP EXTENSION FOR WEBHOOK CALLS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- =====================================================
-- FUNCTION TO CALL SCREENSHOT WEBHOOK
-- =====================================================
CREATE OR REPLACE FUNCTION notify_screenshot_webhook()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT;
    payload JSONB;
BEGIN
    -- Get the webhook URL from environment or settings
    -- In production, this should be set via Supabase dashboard
    webhook_url := current_setting('app.screenshot_webhook_url', TRUE);

    IF webhook_url IS NULL OR webhook_url = '' THEN
        -- If no webhook URL is configured, just log and continue
        RAISE NOTICE 'Screenshot webhook URL not configured, skipping webhook call';
        RETURN NEW;
    END IF;

    -- Build the payload
    payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
    );

    -- Make async HTTP POST request to webhook
    PERFORM extensions.http_post(
        webhook_url,
        payload::TEXT,
        'application/json'
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the insert
        RAISE WARNING 'Failed to call screenshot webhook: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION TO CALL DOCUMENT WEBHOOK
-- =====================================================
CREATE OR REPLACE FUNCTION notify_document_webhook()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT;
    payload JSONB;
BEGIN
    -- Get the webhook URL from environment or settings
    webhook_url := current_setting('app.document_webhook_url', TRUE);

    IF webhook_url IS NULL OR webhook_url = '' THEN
        RAISE NOTICE 'Document webhook URL not configured, skipping webhook call';
        RETURN NEW;
    END IF;

    -- Build the payload
    payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
    );

    -- Make async HTTP POST request to webhook
    PERFORM extensions.http_post(
        webhook_url,
        payload::TEXT,
        'application/json'
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to call document webhook: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CREATE TRIGGERS
-- =====================================================

-- Trigger for screenshot inserts
CREATE TRIGGER on_screenshot_insert
    AFTER INSERT ON public.screenshots
    FOR EACH ROW
    EXECUTE FUNCTION notify_screenshot_webhook();

-- Trigger for screenshot updates (in case status changes)
CREATE TRIGGER on_screenshot_update
    AFTER UPDATE ON public.screenshots
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_screenshot_webhook();

-- Trigger for document inserts
CREATE TRIGGER on_document_insert
    AFTER INSERT ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION notify_document_webhook();

-- Trigger for document updates (in case status changes)
CREATE TRIGGER on_document_update
    AFTER UPDATE ON public.documents
    FOR EACH ROW
    WHEN (OLD.processing_status IS DISTINCT FROM NEW.processing_status)
    EXECUTE FUNCTION notify_document_webhook();

-- =====================================================
-- HELPER FUNCTION TO SET WEBHOOK URLS
-- =====================================================
-- This function allows admins to set webhook URLs
CREATE OR REPLACE FUNCTION set_webhook_url(webhook_type TEXT, url TEXT)
RETURNS VOID AS $$
BEGIN
    IF webhook_type = 'screenshot' THEN
        EXECUTE format('ALTER DATABASE %I SET app.screenshot_webhook_url = %L', current_database(), url);
    ELSIF webhook_type = 'document' THEN
        EXECUTE format('ALTER DATABASE %I SET app.document_webhook_url = %L', current_database(), url);
    ELSE
        RAISE EXCEPTION 'Invalid webhook type: %. Must be "screenshot" or "document"', webhook_type;
    END IF;

    RAISE NOTICE 'Webhook URL set for %. Reconnect to database for changes to take effect.', webhook_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION set_webhook_url FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_webhook_url TO service_role;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION notify_screenshot_webhook() IS
    'Automatically calls the screenshot webhook when a screenshot is inserted or updated';

COMMENT ON FUNCTION notify_document_webhook() IS
    'Automatically calls the document webhook when a document is inserted or updated';

COMMENT ON FUNCTION set_webhook_url(TEXT, TEXT) IS
    'Helper function to configure webhook URLs. Usage: SELECT set_webhook_url(''screenshot'', ''https://...'')';

-- =====================================================
-- EXAMPLE USAGE (for documentation)
-- =====================================================
-- To set webhook URLs after deploying Edge Functions:
-- SELECT set_webhook_url('screenshot', 'https://your-project.supabase.co/functions/v1/screenshot-webhook');
-- SELECT set_webhook_url('document', 'https://your-project.supabase.co/functions/v1/document-webhook');
