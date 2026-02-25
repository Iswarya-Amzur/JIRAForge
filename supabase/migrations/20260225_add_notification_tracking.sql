-- ============================================================================
-- Migration: Add Email Notification Tracking
-- ============================================================================
-- Adds tables for tracking email notifications, user preferences, and cooldowns
-- to support the notification service for login reminders, download reminders,
-- new version alerts, and inactivity notifications.
--
-- Created: 2026-02-25
-- ============================================================================

-- Table to track sent notifications and prevent duplicates
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type TEXT NOT NULL,  -- 'login_reminder', 'download_reminder', 'new_version', 'inactivity_alert'
    email_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'bounced'
    provider TEXT,                           -- 'sendgrid', 'mailgun', 'smtp', etc.
    provider_message_id TEXT,                -- External message ID from provider
    error_message TEXT,
    
    -- Contextual data
    metadata JSONB DEFAULT '{}',             -- Additional context (e.g., version for new_version)
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_notification_type CHECK (
        notification_type IN ('login_reminder', 'download_reminder', 'new_version', 'inactivity_alert')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('pending', 'queued', 'sent', 'failed', 'bounced', 'skipped')
    )
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_type 
ON public.notification_logs(user_id, notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_org_status 
ON public.notification_logs(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_pending 
ON public.notification_logs(status) 
WHERE status = 'pending';

-- Table for notification preferences per user
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Notification types enabled
    login_reminder_enabled BOOLEAN DEFAULT TRUE,
    download_reminder_enabled BOOLEAN DEFAULT TRUE,
    new_version_enabled BOOLEAN DEFAULT TRUE,
    inactivity_alert_enabled BOOLEAN DEFAULT TRUE,
    
    -- Timing preferences
    inactivity_threshold_hours DECIMAL DEFAULT 3.5,
    work_hours_start TIME DEFAULT '09:00:00',
    work_hours_end TIME DEFAULT '18:00:00',
    work_days INTEGER[] DEFAULT '{1,2,3,4,5}',  -- 1=Monday, 7=Sunday
    timezone TEXT DEFAULT 'UTC',
    
    -- Rate limiting
    max_daily_notifications INTEGER DEFAULT 5,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Index for user preferences lookup
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
ON public.notification_preferences(user_id);

-- Table to track notification cooldowns (prevent spam)
CREATE TABLE IF NOT EXISTS public.notification_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    
    -- Last sent timestamp per notification type
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Cooldown settings
    cooldown_hours INTEGER DEFAULT 24,
    
    -- Count for rate limiting
    sent_today_count INTEGER DEFAULT 0,
    count_reset_date DATE DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, notification_type)
);

-- Index for cooldown lookups
CREATE INDEX IF NOT EXISTS idx_notification_cooldowns_user_type
ON public.notification_cooldowns(user_id, notification_type);

-- Function to update cooldown tracking (atomic upsert)
CREATE OR REPLACE FUNCTION public.update_notification_cooldown(
    p_user_id UUID,
    p_notification_type TEXT
) RETURNS void AS $$
BEGIN
    INSERT INTO public.notification_cooldowns (user_id, notification_type, last_sent_at, sent_today_count, count_reset_date)
    VALUES (p_user_id, p_notification_type, NOW(), 1, CURRENT_DATE)
    ON CONFLICT (user_id, notification_type) DO UPDATE SET
        last_sent_at = NOW(),
        sent_today_count = CASE 
            WHEN notification_cooldowns.count_reset_date = CURRENT_DATE 
            THEN notification_cooldowns.sent_today_count + 1 
            ELSE 1 
        END,
        count_reset_date = CURRENT_DATE,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp for notification_logs
CREATE OR REPLACE FUNCTION public.update_notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on notification_logs
DROP TRIGGER IF EXISTS trigger_update_notification_logs_updated_at ON public.notification_logs;
CREATE TRIGGER trigger_update_notification_logs_updated_at
BEFORE UPDATE ON public.notification_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_notification_logs_updated_at();

-- Function to update updated_at timestamp for notification_preferences
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on notification_preferences
DROP TRIGGER IF EXISTS trigger_update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trigger_update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- Enable RLS on new tables
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_cooldowns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_logs
-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs"
ON public.notification_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Service role can do everything
CREATE POLICY "Service role full access to notification_logs"
ON public.notification_logs FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies for notification_preferences
-- Users can view and update their own preferences
CREATE POLICY "Users can view own notification preferences"
ON public.notification_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
ON public.notification_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
ON public.notification_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role can do everything
CREATE POLICY "Service role full access to notification_preferences"
ON public.notification_preferences FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- RLS Policies for notification_cooldowns
-- Service role only (these are managed by the server)
CREATE POLICY "Service role full access to notification_cooldowns"
ON public.notification_cooldowns FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE public.notification_logs IS 'Tracks all email notifications sent to users';
COMMENT ON TABLE public.notification_preferences IS 'User preferences for notification settings';
COMMENT ON TABLE public.notification_cooldowns IS 'Prevents notification spam with cooldown tracking';
COMMENT ON FUNCTION public.update_notification_cooldown IS 'Atomically updates cooldown tracking after sending a notification';

COMMENT ON COLUMN public.notification_logs.notification_type IS 'Type of notification: login_reminder, download_reminder, new_version, inactivity_alert';
COMMENT ON COLUMN public.notification_logs.status IS 'Status of the notification: pending, queued, sent, failed, bounced, skipped';
COMMENT ON COLUMN public.notification_logs.metadata IS 'Additional context data (e.g., version number for new_version notifications)';

COMMENT ON COLUMN public.notification_preferences.work_days IS 'Days of week when inactivity alerts are allowed (1=Monday, 7=Sunday)';
COMMENT ON COLUMN public.notification_preferences.inactivity_threshold_hours IS 'Hours of inactivity before sending an alert';
