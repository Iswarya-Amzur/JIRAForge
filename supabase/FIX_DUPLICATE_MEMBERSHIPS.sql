-- ============================================================================
-- FIX: Remove Duplicate Group Memberships and Add Unique Constraint
-- ============================================================================
-- This script:
-- 1. Cleans up existing duplicate memberships (keeping the first one added)
-- 2. Adds a UNIQUE constraint to prevent future duplicates
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ============================================================================

-- ============================================================================
-- STEP 1: ANALYZE - Find the 5 duplicate activities
-- ============================================================================

-- 1.1: Show activities that appear in multiple groups
SELECT
    ugm.unassigned_activity_id,
    COUNT(*) as appears_in_groups,
    ARRAY_AGG(uwg.group_label ORDER BY ugm.created_at) as group_labels,
    ARRAY_AGG(ugm.group_id ORDER BY ugm.created_at) as group_ids,
    ARRAY_AGG(ugm.id ORDER BY ugm.created_at) as membership_ids
FROM unassigned_group_members ugm
JOIN unassigned_work_groups uwg ON uwg.id = ugm.group_id
GROUP BY ugm.unassigned_activity_id
HAVING COUNT(*) > 1
ORDER BY appears_in_groups DESC;

-- ============================================================================
-- STEP 2: CLEANUP - Remove duplicate memberships (keep the FIRST one)
-- ============================================================================
-- We keep the earliest membership (first group assignment) and remove later duplicates

-- 2.1: Preview what will be deleted
SELECT
    'Duplicate memberships to delete' as action,
    COUNT(*) as count
FROM unassigned_group_members ugm
WHERE EXISTS (
    SELECT 1
    FROM unassigned_group_members earlier
    WHERE earlier.unassigned_activity_id = ugm.unassigned_activity_id
    AND earlier.created_at < ugm.created_at
);

-- 2.2: DELETE duplicate memberships (keeping the earliest one for each activity)
-- UNCOMMENT TO RUN:
/*
DELETE FROM unassigned_group_members
WHERE id IN (
    SELECT ugm.id
    FROM unassigned_group_members ugm
    WHERE EXISTS (
        SELECT 1
        FROM unassigned_group_members earlier
        WHERE earlier.unassigned_activity_id = ugm.unassigned_activity_id
        AND earlier.created_at < ugm.created_at
    )
);
*/

-- ============================================================================
-- STEP 3: UPDATE GROUP COUNTS - Fix session_count on affected groups
-- ============================================================================
-- After removing duplicate memberships, update the session_count on groups

-- 3.1: Preview groups that need count updates
SELECT
    uwg.id,
    uwg.group_label,
    uwg.session_count as current_count,
    COUNT(ugm.id) as actual_count,
    uwg.session_count - COUNT(ugm.id) as difference
FROM unassigned_work_groups uwg
LEFT JOIN unassigned_group_members ugm ON ugm.group_id = uwg.id
GROUP BY uwg.id, uwg.group_label, uwg.session_count
HAVING uwg.session_count != COUNT(ugm.id);

-- 3.2: Update session counts to match actual membership count
-- UNCOMMENT TO RUN:
/*
UPDATE unassigned_work_groups uwg
SET session_count = (
    SELECT COUNT(*) FROM unassigned_group_members ugm WHERE ugm.group_id = uwg.id
)
WHERE session_count != (
    SELECT COUNT(*) FROM unassigned_group_members ugm WHERE ugm.group_id = uwg.id
);
*/

-- ============================================================================
-- STEP 4: ADD UNIQUE CONSTRAINT - Prevent future duplicates
-- ============================================================================

-- 4.1: Check if constraint already exists
SELECT
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conname LIKE '%unassigned_activity_id%';

-- 4.2: Add UNIQUE constraint on unassigned_activity_id
-- This ensures each activity can only belong to ONE group
-- UNCOMMENT TO RUN:
/*
ALTER TABLE unassigned_group_members
ADD CONSTRAINT unassigned_group_members_activity_unique
UNIQUE (unassigned_activity_id);
*/

-- ============================================================================
-- STEP 5: VERIFY - Confirm cleanup and constraint
-- ============================================================================

-- 5.1: Verify no duplicates remain
SELECT
    'Activities in multiple groups (should be 0)' as metric,
    COUNT(*) as count
FROM (
    SELECT unassigned_activity_id
    FROM unassigned_group_members
    GROUP BY unassigned_activity_id
    HAVING COUNT(*) > 1
) duplicates;

-- 5.2: Verify final counts
SELECT 'Total Groups' as metric, COUNT(*) as count FROM unassigned_work_groups
UNION ALL
SELECT 'Total Memberships' as metric, COUNT(*) as count FROM unassigned_group_members
UNION ALL
SELECT 'Unique Activities in Groups' as metric, COUNT(DISTINCT unassigned_activity_id) as count FROM unassigned_group_members;

-- 5.3: Verify constraint exists
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'unassigned_group_members'
AND tc.constraint_type = 'UNIQUE';
