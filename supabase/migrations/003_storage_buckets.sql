-- BRD Automate & Time Tracker - Storage Buckets Configuration
-- This migration creates and configures storage buckets for screenshots and documents

-- =====================================================
-- CREATE STORAGE BUCKETS
-- =====================================================

-- Create bucket for screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'screenshots',
    'screenshots',
    false,
    10485760, -- 10MB limit per file
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for BRD documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    52428800, -- 50MB limit per file
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STORAGE POLICIES FOR SCREENSHOTS BUCKET
-- =====================================================

-- Allow authenticated users to upload screenshots to their own folder
CREATE POLICY "Users can upload own screenshots"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'screenshots' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Allow users to view their own screenshots
CREATE POLICY "Users can view own screenshots"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'screenshots' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Allow users to update their own screenshots (e.g., replace thumbnails)
CREATE POLICY "Users can update own screenshots"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'screenshots' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'screenshots' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Allow users to delete their own screenshots
CREATE POLICY "Users can delete own screenshots"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'screenshots' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access to screenshots bucket
CREATE POLICY "Service role full access to screenshots"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'screenshots')
WITH CHECK (bucket_id = 'screenshots');

-- =====================================================
-- STORAGE POLICIES FOR DOCUMENTS BUCKET
-- =====================================================

-- Allow authenticated users to upload documents to their own folder
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Allow users to view their own documents
CREATE POLICY "Users can view own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Allow users to update their own documents
CREATE POLICY "Users can update own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = (
        SELECT id::text FROM public.users WHERE supabase_user_id = auth.uid()
    )
);

-- Service role has full access to documents bucket
CREATE POLICY "Service role full access to documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Users can upload own screenshots" ON storage.objects IS
    'Allows users to upload screenshot files to their user-specific folder';

COMMENT ON POLICY "Users can upload own documents" ON storage.objects IS
    'Allows users to upload BRD documents to their user-specific folder';
