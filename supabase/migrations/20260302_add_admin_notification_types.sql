-- Migration: Add admin notification types to notification_logs check constraint
-- Adds: admin_inactivity_digest, admin_download_digest
-- These are digest emails sent to org admins, added as part of the admin notifications feature.

ALTER TABLE public.notification_logs
    DROP CONSTRAINT IF EXISTS valid_notification_type;

ALTER TABLE public.notification_logs
    ADD CONSTRAINT valid_notification_type CHECK (
        notification_type IN (
            'login_reminder',
            'download_reminder',
            'new_version',
            'inactivity_alert',
            'admin_inactivity_digest',
            'admin_download_digest'
        )
    );
