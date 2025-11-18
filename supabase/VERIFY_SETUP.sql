-- Complete Verification Script for Supabase Setup
-- Run this after QUICK_SETUP.sql to verify everything is configured correctly

-- =====================================================
-- 1. CHECK TABLES
-- =====================================================
SELECT 
    'Tables' as check_type,
    table_name as name,
    'Table exists' as status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected: 6 tables
-- users, screenshots, analysis_results, documents, worklogs, activity_log

-- =====================================================
-- 2. CHECK RLS IS ENABLED
-- =====================================================
SELECT 
    'RLS Status' as check_type,
    tablename as name,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected: All 6 tables should show "✅ Enabled"

-- =====================================================
-- 3. CHECK VIEWS
-- =====================================================
SELECT 
    'Views' as check_type,
    table_name as name,
    'View exists' as status
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: 3 views
-- daily_time_summary, weekly_time_summary, project_time_summary

-- =====================================================
-- 4. CHECK STORAGE BUCKETS
-- =====================================================
SELECT 
    'Storage Buckets' as check_type,
    name as name,
    CASE 
        WHEN public THEN 'Public'
        ELSE 'Private'
    END || ' (' || 
    CASE 
        WHEN file_size_limit = 10485760 THEN '10MB'
        WHEN file_size_limit = 52428800 THEN '50MB'
        ELSE file_size_limit::text || ' bytes'
    END || ')' as status
FROM storage.buckets
ORDER BY name;

-- Expected: 2 buckets
-- screenshots (Private, 10MB)
-- documents (Private, 50MB)

-- =====================================================
-- 5. CHECK RLS POLICIES
-- =====================================================
SELECT 
    'RLS Policies' as check_type,
    schemaname || '.' || tablename as name,
    COUNT(*) || ' policies' as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Expected: Each table should have multiple policies

-- =====================================================
-- 6. CHECK STORAGE POLICIES
-- =====================================================
SELECT 
    'Storage Policies' as check_type,
    'storage.objects' as name,
    COUNT(*) || ' policies' as status
FROM pg_policies
WHERE schemaname = 'storage' 
    AND tablename = 'objects';

-- Expected: Should have multiple policies for screenshots and documents buckets

-- =====================================================
-- 7. CHECK INDEXES
-- =====================================================
SELECT 
    'Indexes' as check_type,
    tablename as name,
    COUNT(*) || ' indexes' as status
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Expected: Each table should have indexes

-- =====================================================
-- 8. CHECK FUNCTIONS
-- =====================================================
SELECT 
    'Functions' as check_type,
    routine_name as name,
    'Function exists' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Expected: 
-- get_current_user_id
-- update_updated_at_column

-- =====================================================
-- 9. SUMMARY
-- =====================================================
SELECT 
    'SUMMARY' as check_type,
    'Total Tables' as name,
    COUNT(*)::text as status
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'SUMMARY' as check_type,
    'Total Views' as name,
    COUNT(*)::text as status
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'SUMMARY' as check_type,
    'Total Buckets' as name,
    COUNT(*)::text as status
FROM storage.buckets
UNION ALL
SELECT 
    'SUMMARY' as check_type,
    'Tables with RLS' as name,
    COUNT(*)::text as status
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Expected Summary:
-- Total Tables: 6
-- Total Views: 3
-- Total Buckets: 2
-- Tables with RLS: 6

