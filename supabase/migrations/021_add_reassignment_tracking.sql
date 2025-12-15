-- Migration: Add reassignment tracking columns to analysis_results
-- This allows tracking when a work session is reassigned from one issue to another

-- Add reassignment tracking columns
ALTER TABLE public.analysis_results
ADD COLUMN IF NOT EXISTS reassigned_from TEXT,
ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.analysis_results.reassigned_from IS 'Original issue key if this record was reassigned from another issue';
COMMENT ON COLUMN public.analysis_results.reassigned_at IS 'Timestamp when this record was reassigned';

-- Create index for efficient querying of reassigned records
CREATE INDEX IF NOT EXISTS idx_analysis_results_reassigned
ON public.analysis_results (reassigned_from)
WHERE reassigned_from IS NOT NULL;
