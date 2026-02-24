-- ============================================================================
-- Migration: Remove non-private global defaults
-- Date: 2026-02-26
--
-- The original seed inserted productive/non_productive apps as global defaults.
-- This was wrong — only PRIVATE apps should be global defaults (system-enforced).
-- Productive/non_productive classifications are decided by each org's admin
-- during onboarding setup.
--
-- This migration:
-- 1. Deletes all productive/non_productive global defaults
-- 2. Keeps all private global defaults untouched
-- 3. Does NOT touch org-level or project-level overrides (admin choices)
-- ============================================================================

DELETE FROM public.application_classifications
WHERE is_default = TRUE
  AND organization_id IS NULL
  AND project_key IS NULL
  AND classification IN ('productive', 'non_productive');
