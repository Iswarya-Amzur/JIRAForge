-- ============================================================================
-- RESET GROUPS: Clear all groups to allow re-clustering with improved logic
-- ============================================================================
-- This script removes all existing groups and memberships so that the
-- improved clustering algorithm can re-process all unassigned activities.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ============================================================================

-- ============================================================================
-- STEP 1: BACKUP CHECK - See current state before clearing
-- ============================================================================

-- 1.1: Count current groups and memberships
SELECT 'Current Groups' as metric, COUNT(*) as count FROM unassigned_work_groups
UNION ALL
SELECT 'Current Memberships' as metric, COUNT(*) as count FROM unassigned_group_members
UNION ALL
SELECT 'Total Unassigned Activities' as metric, COUNT(*) as count FROM unassigned_activity WHERE manually_assigned = false;

-- ============================================================================
-- STEP 2: CLEAR ALL GROUPS (Run these to reset)
-- ============================================================================

-- 2.1: Delete all group memberships first (due to foreign key)
-- UNCOMMENT TO RUN:
/*
DELETE FROM unassigned_group_members;
*/

-- 2.2: Delete all groups
-- UNCOMMENT TO RUN:
/*
DELETE FROM unassigned_work_groups;
*/

-- ============================================================================
-- STEP 3: VERIFY RESET
-- ============================================================================

-- 3.1: Confirm everything is cleared
SELECT 'Groups After Reset (should be 0)' as metric, COUNT(*) as count FROM unassigned_work_groups
UNION ALL
SELECT 'Memberships After Reset (should be 0)' as metric, COUNT(*) as count FROM unassigned_group_members;

-- 3.2: Count activities ready for re-clustering
SELECT
    'Activities Ready for Re-clustering' as metric,
    COUNT(*) as count
FROM unassigned_activity
WHERE manually_assigned = false;

-- ============================================================================
-- STEP 4: TRIGGER RE-CLUSTERING
-- ============================================================================
-- After running the DELETE statements above:
-- 1. Restart your AI server to ensure it has the new clustering logic
-- 2. The next scheduled clustering job will automatically re-process all activities
-- 3. Or you can trigger it manually via the API endpoint
-- ============================================================================
