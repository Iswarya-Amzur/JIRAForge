-- ============================================================================
-- Migration: Add application_classifications table
-- Date: 2026-02-20
--
-- Stores the master list of app classifications (productive/non_productive/private)
-- with support for global defaults, organization-level, and project-level overrides.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.application_classifications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_key TEXT,
    identifier TEXT NOT NULL,
    display_name TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('productive', 'non_productive', 'private')),
    match_by TEXT NOT NULL CHECK (match_by IN ('process', 'url')),
    is_default BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one classification per identifier per match_by per org per project
-- Use a proper UNIQUE CONSTRAINT (not expression index) so ON CONFLICT DO NOTHING works
-- We handle NULLs by using sentinel values in the columns directly
-- For global defaults: organization_id IS NULL and project_key IS NULL
-- We need partial unique indexes for the NULL combinations

-- Case 1: Both org and project are NULL (global defaults)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_class_unique_global
    ON public.application_classifications(identifier, match_by)
    WHERE organization_id IS NULL AND project_key IS NULL;

-- Case 2: Org is set, project is NULL (org-level overrides)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_class_unique_org
    ON public.application_classifications(organization_id, identifier, match_by)
    WHERE organization_id IS NOT NULL AND project_key IS NULL;

-- Case 3: Both org and project are set (project-level overrides)
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_class_unique_project
    ON public.application_classifications(organization_id, project_key, identifier, match_by)
    WHERE organization_id IS NOT NULL AND project_key IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_class_org ON public.application_classifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_class_identifier ON public.application_classifications(identifier);
CREATE INDEX IF NOT EXISTS idx_app_class_match_by ON public.application_classifications(match_by);
CREATE INDEX IF NOT EXISTS idx_app_class_classification ON public.application_classifications(classification);
CREATE INDEX IF NOT EXISTS idx_app_class_default ON public.application_classifications(is_default) WHERE is_default = TRUE;

-- Update trigger
CREATE OR REPLACE FUNCTION update_app_classifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_app_classifications_updated_at ON public.application_classifications;
CREATE TRIGGER trigger_app_classifications_updated_at
    BEFORE UPDATE ON public.application_classifications
    FOR EACH ROW
    EXECUTE FUNCTION update_app_classifications_updated_at();

-- RLS
ALTER TABLE public.application_classifications ENABLE ROW LEVEL SECURITY;

-- Everyone can read defaults (is_default = true, org = NULL)
DROP POLICY IF EXISTS "app_class_select_defaults" ON public.application_classifications;
CREATE POLICY "app_class_select_defaults" ON public.application_classifications
    FOR SELECT
    USING (is_default = TRUE AND organization_id IS NULL);

-- Org members can read their org's classifications
DROP POLICY IF EXISTS "app_class_select_org" ON public.application_classifications;
CREATE POLICY "app_class_select_org" ON public.application_classifications
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT get_current_user_id())
        )
    );

-- Admins can insert
DROP POLICY IF EXISTS "app_class_insert_admin" ON public.application_classifications;
CREATE POLICY "app_class_insert_admin" ON public.application_classifications
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT get_current_user_id())
            AND role IN ('admin', 'owner')
        )
    );

-- Admins can update
DROP POLICY IF EXISTS "app_class_update_admin" ON public.application_classifications;
CREATE POLICY "app_class_update_admin" ON public.application_classifications
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT get_current_user_id())
            AND role IN ('admin', 'owner')
        )
    );

-- Admins can delete
DROP POLICY IF EXISTS "app_class_delete_admin" ON public.application_classifications;
CREATE POLICY "app_class_delete_admin" ON public.application_classifications
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = (SELECT get_current_user_id())
            AND role IN ('admin', 'owner')
        )
    );

-- Service role can do everything
DROP POLICY IF EXISTS "app_class_service_role" ON public.application_classifications;
CREATE POLICY "app_class_service_role" ON public.application_classifications
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.application_classifications IS 'Master list of application classifications (productive/non_productive/private)';
