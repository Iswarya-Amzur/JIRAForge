-- ============================================================================
-- Migration: Convert existing whitelist/blacklist to application_classifications
-- Date: 2026-02-25
--
-- Migrates existing tracking_settings data:
--   - whitelisted_apps → productive classifications
--   - blacklisted_apps → non_productive classifications
--   - private_sites → private URL entries
--
-- This is a one-time migration for existing organizations.
-- New organizations will use the application_classifications table directly.
-- ============================================================================

-- Step 1: Migrate whitelisted apps → productive (process-based)
-- These are stored as text arrays in tracking_settings.whitelisted_apps
DO $$
DECLARE
    org RECORD;
    app_name TEXT;
BEGIN
    FOR org IN
        SELECT ts.organization_id, ts.whitelisted_apps
        FROM public.tracking_settings ts
        WHERE ts.whitelisted_apps IS NOT NULL
          AND array_length(ts.whitelisted_apps, 1) > 0
          AND ts.organization_id IS NOT NULL
    LOOP
        FOREACH app_name IN ARRAY org.whitelisted_apps
        LOOP
            -- Skip empty strings
            IF app_name IS NOT NULL AND app_name != '' THEN
                INSERT INTO public.application_classifications
                    (organization_id, project_key, identifier, display_name, classification, match_by, is_default, created_by)
                VALUES
                    (org.organization_id, NULL, app_name, app_name, 'productive', 'process', FALSE, 'migration')
                ON CONFLICT (organization_id, identifier, match_by) WHERE organization_id IS NOT NULL AND project_key IS NULL DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migrated whitelisted apps to productive classifications';
END $$;

-- Step 2: Migrate blacklisted apps → non_productive (process-based)
DO $$
DECLARE
    org RECORD;
    app_name TEXT;
BEGIN
    FOR org IN
        SELECT ts.organization_id, ts.blacklisted_apps
        FROM public.tracking_settings ts
        WHERE ts.blacklisted_apps IS NOT NULL
          AND array_length(ts.blacklisted_apps, 1) > 0
          AND ts.organization_id IS NOT NULL
    LOOP
        FOREACH app_name IN ARRAY org.blacklisted_apps
        LOOP
            IF app_name IS NOT NULL AND app_name != '' THEN
                INSERT INTO public.application_classifications
                    (organization_id, project_key, identifier, display_name, classification, match_by, is_default, created_by)
                VALUES
                    (org.organization_id, NULL, app_name, app_name, 'non_productive', 'process', FALSE, 'migration')
                ON CONFLICT (organization_id, identifier, match_by) WHERE organization_id IS NOT NULL AND project_key IS NULL DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migrated blacklisted apps to non_productive classifications';
END $$;

-- Step 3: Migrate private_sites → private (url-based)
DO $$
DECLARE
    org RECORD;
    site TEXT;
BEGIN
    FOR org IN
        SELECT ts.organization_id, ts.private_sites
        FROM public.tracking_settings ts
        WHERE ts.private_sites IS NOT NULL
          AND array_length(ts.private_sites, 1) > 0
          AND ts.organization_id IS NOT NULL
    LOOP
        FOREACH site IN ARRAY org.private_sites
        LOOP
            IF site IS NOT NULL AND site != '' THEN
                INSERT INTO public.application_classifications
                    (organization_id, project_key, identifier, display_name, classification, match_by, is_default, created_by)
                VALUES
                    (org.organization_id, NULL, site, site, 'private', 'url', FALSE, 'migration')
                ON CONFLICT (organization_id, identifier, match_by) WHERE organization_id IS NOT NULL AND project_key IS NULL DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migrated private sites to private URL classifications';
END $$;

-- Add comment documenting the migration
COMMENT ON TABLE public.application_classifications IS
    'Master list of application classifications. Migrated from tracking_settings whitelist/blacklist/private_sites on 2026-02-25.';
