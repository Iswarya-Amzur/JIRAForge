-- ============================================================================
-- Migration: Add App Releases Table for Version Control
-- ============================================================================
-- Stores information about desktop app releases for version checking
-- and update notifications.
--
-- Created: 2026-02-03
-- ============================================================================

-- Create app_releases table
CREATE TABLE IF NOT EXISTS public.app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Version information
    version TEXT NOT NULL,                          -- Semantic version e.g., "1.1.0"
    platform TEXT NOT NULL DEFAULT 'windows',       -- windows, macos, linux
    
    -- Download information
    download_url TEXT NOT NULL,                     -- Supabase storage URL or external URL
    file_size_bytes BIGINT,                         -- Size of the executable
    checksum TEXT,                                  -- SHA256 hash for integrity verification
    
    -- Release details
    release_notes TEXT,                             -- What's new in this version
    min_supported_version TEXT,                     -- Minimum version that can upgrade (for breaking changes)
    
    -- Flags
    is_mandatory BOOLEAN DEFAULT FALSE,             -- Force users to update
    is_latest BOOLEAN DEFAULT TRUE,                 -- Mark as current latest release
    is_active BOOLEAN DEFAULT TRUE,                 -- Can be downloaded (false = deprecated)
    
    -- Metadata
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Ensure unique version per platform
    UNIQUE(version, platform)
);

-- Create index for quick latest version lookup
CREATE INDEX IF NOT EXISTS idx_app_releases_latest 
ON public.app_releases(platform, is_latest) 
WHERE is_latest = TRUE AND is_active = TRUE;

-- Create index for version lookups
CREATE INDEX IF NOT EXISTS idx_app_releases_version 
ON public.app_releases(version, platform);

-- Create index for platform queries
CREATE INDEX IF NOT EXISTS idx_app_releases_platform 
ON public.app_releases(platform);

-- Function to automatically set is_latest = false for older releases when a new one is added
CREATE OR REPLACE FUNCTION public.update_latest_release()
RETURNS TRIGGER AS $$
BEGIN
    -- If this new release is marked as latest, unmark all other releases for this platform
    IF NEW.is_latest = TRUE THEN
        UPDATE public.app_releases
        SET is_latest = FALSE, updated_at = NOW()
        WHERE platform = NEW.platform 
          AND id != NEW.id 
          AND is_latest = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update is_latest on insert/update
DROP TRIGGER IF EXISTS trigger_update_latest_release ON public.app_releases;
CREATE TRIGGER trigger_update_latest_release
AFTER INSERT OR UPDATE OF is_latest ON public.app_releases
FOR EACH ROW
WHEN (NEW.is_latest = TRUE)
EXECUTE FUNCTION public.update_latest_release();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_app_releases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_app_releases_updated_at ON public.app_releases;
CREATE TRIGGER trigger_update_app_releases_updated_at
BEFORE UPDATE ON public.app_releases
FOR EACH ROW
EXECUTE FUNCTION public.update_app_releases_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.app_releases IS 'Stores desktop app release information for version control and update notifications';
COMMENT ON COLUMN public.app_releases.version IS 'Semantic version number (e.g., 1.0.0, 1.1.0)';
COMMENT ON COLUMN public.app_releases.platform IS 'Target platform: windows, macos, or linux';
COMMENT ON COLUMN public.app_releases.download_url IS 'URL to download the executable (Supabase storage or external)';
COMMENT ON COLUMN public.app_releases.is_mandatory IS 'If true, users must update to continue using the app';
COMMENT ON COLUMN public.app_releases.is_latest IS 'Marks this as the current latest release for the platform';
COMMENT ON COLUMN public.app_releases.min_supported_version IS 'Minimum version that can upgrade to this release';

-- Enable RLS
ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone can read releases, only admins can modify
CREATE POLICY "Anyone can view active releases" ON public.app_releases
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Service role can manage releases" ON public.app_releases
    FOR ALL USING (auth.role() = 'service_role');

-- Insert initial release record for the current version
-- This ensures there's always a baseline version in the table
INSERT INTO public.app_releases (version, platform, download_url, release_notes, is_latest, is_mandatory)
VALUES (
    '1.0.0',
    'windows',
    'https://jvijitdewbypqbatfboi.supabase.co/storage/v1/object/public/desktop%20app/TimeTracker.exe',
    'Initial release of Time Tracker desktop application.',
    TRUE,
    FALSE
) ON CONFLICT (version, platform) DO NOTHING;
