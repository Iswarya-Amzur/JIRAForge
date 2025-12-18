-- Add retry_count column to screenshots table for retry logic
-- This tracks how many times a failed screenshot has been retried

-- Add retry_count column with default 0
ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add updated_at column if not exists (used for retry backoff)
ALTER TABLE public.screenshots 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient querying of failed screenshots for retry
CREATE INDEX IF NOT EXISTS idx_screenshots_retry 
ON public.screenshots (status, retry_count, updated_at) 
WHERE status = 'failed';

-- Add comment
COMMENT ON COLUMN public.screenshots.retry_count IS 'Number of retry attempts for failed screenshots. Max retries controlled by AI server.';

-- Update trigger to set updated_at on any update
CREATE OR REPLACE FUNCTION update_screenshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS trigger_screenshots_updated_at ON public.screenshots;
CREATE TRIGGER trigger_screenshots_updated_at
    BEFORE UPDATE ON public.screenshots
    FOR EACH ROW
    EXECUTE FUNCTION update_screenshots_updated_at();
