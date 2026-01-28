-- ============================================================================
-- CLEANUP: Remove Duplicate Groups from Clustering Bug
-- ============================================================================
-- This script cleans up duplicate groups created by the bug where the same
-- activities were being re-clustered every day instead of only new activities.
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ============================================================================

-- ============================================================================
-- STEP 1: ANALYZE THE PROBLEM (Run these first to see the extent)
-- ============================================================================

-- 1.1: Count total groups
SELECT 'Total Groups' as metric, COUNT(*) as count FROM unassigned_work_groups;

-- 1.2: Count total group members (activity-group links)
SELECT 'Total Group Members' as metric, COUNT(*) as count FROM unassigned_group_members;

-- 1.3: Find activities that appear in MULTIPLE groups (this is the bug)
SELECT
    'Activities in Multiple Groups' as metric,
    COUNT(*) as count
FROM (
    SELECT unassigned_activity_id, COUNT(*) as group_count
    FROM unassigned_group_members
    GROUP BY unassigned_activity_id
    HAVING COUNT(*) > 1
) duplicates;

-- 1.4: See the worst offenders (activities in the most groups)
SELECT
    unassigned_activity_id,
    COUNT(*) as appears_in_groups
FROM unassigned_group_members
GROUP BY unassigned_activity_id
HAVING COUNT(*) > 1
ORDER BY appears_in_groups DESC
LIMIT 10;

-- 1.5: Count groups by date to see the pattern
SELECT
    DATE(created_at) as date,
    COUNT(*) as groups_created
FROM unassigned_work_groups
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

-- ============================================================================
-- STEP 2: CLEANUP - Keep only the LATEST group membership for each activity
-- ============================================================================
-- This removes duplicate memberships, keeping only the most recent one

-- 2.1: Preview what will be deleted (run this first to see)
SELECT
    'Duplicate memberships to delete' as action,
    COUNT(*) as count
FROM unassigned_group_members ugm
WHERE EXISTS (
    SELECT 1
    FROM unassigned_group_members newer
    WHERE newer.unassigned_activity_id = ugm.unassigned_activity_id
    AND newer.created_at > ugm.created_at
);

-- 2.2: DELETE duplicate memberships (keeping the latest one for each activity)
-- UNCOMMENT THE LINES BELOW TO ACTUALLY DELETE
/*
DELETE FROM unassigned_group_members
WHERE id IN (
    SELECT ugm.id
    FROM unassigned_group_members ugm
    WHERE EXISTS (
        SELECT 1
        FROM unassigned_group_members newer
        WHERE newer.unassigned_activity_id = ugm.unassigned_activity_id
        AND newer.created_at > ugm.created_at
    )
);
*/

-- ============================================================================
-- STEP 3: CLEANUP - Remove empty groups (groups with no members after cleanup)
-- ============================================================================

-- 3.1: Preview empty groups
SELECT
    'Empty groups to delete' as action,
    COUNT(*) as count
FROM unassigned_work_groups uwg
WHERE NOT EXISTS (
    SELECT 1 FROM unassigned_group_members ugm
    WHERE ugm.group_id = uwg.id
);

-- 3.2: DELETE empty groups
-- UNCOMMENT THE LINES BELOW TO ACTUALLY DELETE
/*
DELETE FROM unassigned_work_groups
WHERE id IN (
    SELECT uwg.id
    FROM unassigned_work_groups uwg
    WHERE NOT EXISTS (
        SELECT 1 FROM unassigned_group_members ugm
        WHERE ugm.group_id = uwg.id
    )
);
*/

-- ============================================================================
-- STEP 4: VERIFY CLEANUP (Run after cleanup to confirm)
-- ============================================================================

-- 4.1: Confirm no activities appear in multiple groups anymore
SELECT
    'Activities still in multiple groups (should be 0)' as metric,
    COUNT(*) as count
FROM (
    SELECT unassigned_activity_id, COUNT(*) as group_count
    FROM unassigned_group_members
    GROUP BY unassigned_activity_id
    HAVING COUNT(*) > 1
) duplicates;

-- 4.2: Final counts
SELECT 'Final Group Count' as metric, COUNT(*) as count FROM unassigned_work_groups
UNION ALL
SELECT 'Final Member Count' as metric, COUNT(*) as count FROM unassigned_group_members;
