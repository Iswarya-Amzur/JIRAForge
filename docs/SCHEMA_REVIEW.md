# Database Schema Review

## Executive Summary

Your database schema is **mostly correct**, but there are **3 critical issues** and **several recommendations** that need attention.

---

## Critical Issues

### 1. ❌ **Timezone Inconsistency in `created_issues_log`**

**Issue:**
```sql
created_at timestamp without time zone DEFAULT now()
```

**Problem:**
- All other tables use `timestamp with time zone`
- This causes timezone inconsistencies
- Can lead to date calculation errors

**Fix:**
```sql
ALTER TABLE public.created_issues_log
ALTER COLUMN created_at TYPE timestamp with time zone
USING created_at AT TIME ZONE 'UTC';
```

---

### 2. ⚠️ **Missing Indexes**

Your schema dump doesn't show indexes, but based on migrations, you should have these indexes. Verify they exist:

**Critical Indexes Missing from Schema:**
- `idx_analysis_results_work_type` (on `work_type` column)
- `idx_analysis_results_unassigned` (on `user_id, active_task_key WHERE active_task_key IS NULL`)
- `idx_analysis_results_manual_assignment` (on `manually_assigned, assignment_group_id`)
- `idx_created_issues_user` (on `user_id, created_at DESC`)
- `idx_unassigned_groups_user_id` (on `unassigned_work_groups.user_id`)
- `idx_unassigned_groups_is_assigned` (on `unassigned_work_groups.is_assigned`)
- `idx_unassigned_group_members_group_id` (on `unassigned_group_members.group_id`)

**Verification Query:**
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

### 3. ⚠️ **Data Type Precision for `confidence_score`**

**Issue:**
Your schema shows:
```sql
confidence_score numeric
```

**Expected (from migrations):**
```sql
confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1)
```

**Problem:**
- Missing precision specification
- Missing explicit CHECK constraint (though it may be inherited)

**Fix:**
```sql
ALTER TABLE public.analysis_results
ALTER COLUMN confidence_score TYPE DECIMAL(3, 2);

-- Verify CHECK constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.analysis_results'::regclass
AND conname LIKE '%confidence%';
```

---

## Schema Validation Checklist

### ✅ **Correct Tables**

1. ✅ `users` - All columns present, correct types
2. ✅ `screenshots` - Includes `user_assigned_issues` JSONB column
3. ✅ `analysis_results` - Includes `work_type`, `manually_assigned`, `assignment_group_id`
4. ✅ `documents` - Correct structure
5. ✅ `worklogs` - Correct structure
6. ✅ `activity_log` - Correct structure
7. ✅ `unassigned_activity` - Correct structure
8. ✅ `unassigned_work_groups` - Correct structure
9. ✅ `unassigned_group_members` - Correct structure
10. ✅ `user_jira_issues_cache` - Correct structure
11. ✅ `created_issues_log` - Structure correct, but timezone issue

### ✅ **Correct Foreign Keys**

All foreign key constraints are properly defined:
- ✅ All `user_id` references `users(id)`
- ✅ All `screenshot_id` references `screenshots(id)`
- ✅ All `analysis_result_id` references `analysis_results(id)`
- ✅ Cascade deletes are appropriate

### ✅ **Correct Check Constraints**

All CHECK constraints are properly defined:
- ✅ `work_type IN ('office', 'non-office')`
- ✅ `confidence_score` range check
- ✅ Status enums are correct
- ✅ File type enums are correct

### ⚠️ **Missing from Schema Dump (But Should Exist)**

These are not shown in your schema dump but should exist based on migrations:

1. **Views:**
   - `daily_time_summary`
   - `weekly_time_summary`
   - `monthly_time_summary`
   - `unassigned_activity_summary`
   - `project_time_summary`

2. **Functions:**
   - `update_updated_at_column()`
   - `update_unassigned_groups_updated_at()`
   - `auto_save_unassigned_activity()`
   - `update_cached_at_column()`

3. **Triggers:**
   - `update_users_updated_at`
   - `trigger_update_unassigned_groups_updated_at`
   - `trigger_auto_save_unassigned`
   - `update_user_jira_cache_cached_at`

4. **Indexes:**
   - All indexes from migrations (see Critical Issues #2)

---

## Recommendations

### 1. **Add Composite Index for Common Queries**

```sql
-- For filtering unassigned work by user and date
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_date_unassigned
ON public.analysis_results(user_id, created_at DESC)
WHERE active_task_key IS NULL AND work_type = 'office';
```

### 2. **Add Index for Assignment Groups**

```sql
-- For querying by assignment groups
CREATE INDEX IF NOT EXISTS idx_analysis_results_assignment_group
ON public.analysis_results(assignment_group_id)
WHERE assignment_group_id IS NOT NULL;
```

### 3. **Verify RLS Policies**

Your schema doesn't show RLS policies. Verify they exist:

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4. **Add Unique Constraint for User-Issue Cache**

Already exists in your schema:
```sql
UNIQUE(user_id, issue_key)  -- ✅ Present
```

### 5. **Consider Adding NOT NULL Constraints**

These columns should probably be NOT NULL:
- `analysis_results.work_type` - Already NOT NULL ✅
- `unassigned_work_groups.group_label` - Already NOT NULL ✅
- `unassigned_work_groups.session_count` - Already NOT NULL ✅
- `unassigned_work_groups.total_seconds` - Already NOT NULL ✅

---

## Migration Script to Fix Issues

```sql
-- =====================================================
-- Schema Fixes Migration
-- =====================================================

-- Fix 1: Timezone issue in created_issues_log
ALTER TABLE public.created_issues_log
ALTER COLUMN created_at TYPE timestamp with time zone
USING created_at AT TIME ZONE 'UTC';

-- Fix 2: Verify confidence_score precision
ALTER TABLE public.analysis_results
ALTER COLUMN confidence_score TYPE DECIMAL(3, 2);

-- Fix 3: Add missing indexes
CREATE INDEX IF NOT EXISTS idx_analysis_results_work_type
ON public.analysis_results(work_type);

CREATE INDEX IF NOT EXISTS idx_analysis_results_unassigned
ON public.analysis_results(user_id, active_task_key)
WHERE active_task_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_results_manual_assignment
ON public.analysis_results(manually_assigned, assignment_group_id);

CREATE INDEX IF NOT EXISTS idx_created_issues_user
ON public.created_issues_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unassigned_groups_user_id
ON public.unassigned_work_groups(user_id);

CREATE INDEX IF NOT EXISTS idx_unassigned_groups_is_assigned
ON public.unassigned_work_groups(is_assigned);

CREATE INDEX IF NOT EXISTS idx_unassigned_groups_created_at
ON public.unassigned_work_groups(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_group_id
ON public.unassigned_group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_unassigned_group_members_activity_id
ON public.unassigned_group_members(unassigned_activity_id);

-- Fix 4: Add composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_date_unassigned
ON public.analysis_results(user_id, created_at DESC)
WHERE active_task_key IS NULL AND work_type = 'office';

CREATE INDEX IF NOT EXISTS idx_analysis_results_assignment_group
ON public.analysis_results(assignment_group_id)
WHERE assignment_group_id IS NOT NULL;
```

---

## Verification Queries

Run these queries to verify your schema is complete:

### 1. Check All Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected:** 11 tables

### 2. Check All Views Exist
```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected:** At least 5 views

### 3. Check All Indexes
```sql
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Expected:** At least 30+ indexes

### 4. Check All Foreign Keys
```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

### 5. Check All Functions
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### 6. Check All Triggers
```sql
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

---

## Summary

### ✅ **What's Correct:**
- All 11 tables are properly defined
- All foreign key constraints are correct
- All CHECK constraints are correct
- Column types are mostly correct
- Unique constraints are present where needed

### ❌ **What Needs Fixing:**
1. **Timezone issue** in `created_issues_log.created_at`
2. **Missing indexes** (verify they exist)
3. **Data type precision** for `confidence_score` (verify)

### ⚠️ **What to Verify:**
1. All indexes from migrations exist
2. All views are created and up-to-date
3. All functions and triggers are present
4. RLS policies are configured

---

## Next Steps

1. **Run the migration script** above to fix critical issues
2. **Run verification queries** to ensure everything is complete
3. **Apply the timezone fix migration** (`007_fix_timezone_date_calculation.sql`) if not already done
4. **Verify views** are using UTC for date calculations

---

**Overall Assessment: 85% Complete** - Schema is solid but needs the fixes above.


