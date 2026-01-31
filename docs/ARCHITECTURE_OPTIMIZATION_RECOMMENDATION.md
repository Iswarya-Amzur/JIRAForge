# Architecture Optimization Recommendation

## BRD Time Tracker - Reducing Supabase API Costs While Maintaining Atlassian Compliance

**Date:** January 31, 2026  
**Status:** Recommendation  
**Priority:** High

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Problem Statement](#problem-statement)
4. [Available Solutions](#available-solutions)
5. [Recommended Solution: Hybrid Approach](#recommended-solution-hybrid-approach)
6. [Implementation Plan](#implementation-plan)
7. [Detailed File Changes](#detailed-file-changes)
8. [Migration Strategy](#migration-strategy)
9. [Cost Analysis](#cost-analysis)
10. [Risk Assessment](#risk-assessment)

---

## Executive Summary

The current architecture routes **ALL Forge app data requests** through the AI Server proxy to reach Supabase. This creates:
- **Increased latency** (2 network hops instead of 1)
- **Higher Supabase API costs** (every page load = multiple API calls)
- **Single point of failure** (AI Server must be available for basic data access)

### Recommended Solution
Implement a **Hybrid Approach** using:
1. **Forge SQL** for hot/frequently accessed data (time entries, user data, dashboard data)
2. **Forge KVS** for user preferences and small cached data
3. **Supabase** retained only for screenshot storage and AI analysis results
4. **AI Server** used only for actual AI operations (GPT-4 Vision analysis)

**Estimated Cost Reduction:** 70-80% reduction in Supabase API calls

---

## Current Architecture Analysis

### Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Desktop App   │────▶│    Supabase     │◀────│   AI Server     │
│  (Python/Windows)│     │  (PostgreSQL +  │     │   (Node.js)     │
└─────────────────┘     │    Storage)     │     └────────▲────────┘
                        └─────────────────┘              │
                                                         │ invokeRemote
                                                         │ (FIT Token)
                        ┌─────────────────┐              │
                        │    Forge App    │──────────────┘
                        │  (Jira UI/React)│
                        └─────────────────┘
```

### Current Request Flow (Every Dashboard Load)

```
User Opens Dashboard
        │
        ▼
┌─────────────────────────┐
│  Forge App (resolvers)  │
│  analyticsResolvers.js  │
└───────────┬─────────────┘
            │ invokeRemote('ai-server')
            ▼
┌─────────────────────────┐
│      AI Server          │
│ forge-proxy-controller  │
└───────────┬─────────────┘
            │ Supabase REST API
            ▼
┌─────────────────────────┐
│       Supabase          │
│    (8+ queries)         │
└─────────────────────────┘
```

### Key Files in Current Architecture

| Component | File | Purpose |
|-----------|------|---------|
| Forge App | `forge-app/src/utils/remote.js` | All Supabase requests via invokeRemote |
| Forge App | `forge-app/src/utils/cache.js` | In-memory cache (per-request only) |
| Forge App | `forge-app/manifest.yml` | Remote definition for AI server |
| AI Server | `ai-server/src/controllers/forge-proxy-controller.js` | Proxies all Supabase queries |
| Supabase | `supabase/migrations/*` | Database schema definitions |

---

## Problem Statement

### Issue 1: Every Forge Request Hits Supabase

**File:** `forge-app/src/utils/remote.js` (Lines 58-66)

```javascript
// CURRENT: Every query goes through AI server proxy
export async function supabaseQuery(table, options = {}) {
  return remoteRequest('/api/forge/supabase/query', {
    body: {
      table,
      method: options.method || 'GET',
      query: options.query,
      body: options.body,
      select: options.select
    }
  });
}
```

### Issue 2: Cache is Per-Request Only

**File:** `forge-app/src/utils/cache.js` (Lines 1-11)

```javascript
// CURRENT: Cache does NOT persist across requests
// Forge apps run in isolated containers, so this cache is per-request-context.
const cache = new Map();
```

### Issue 3: No Direct Forge Storage Usage

The manifest already has `storage:app` permission but it's not being utilized:

**File:** `forge-app/manifest.yml` (Lines 48-52)

```yaml
permissions:
  scopes:
    - storage:app  # ← NOT BEING USED!
```

---

## Available Solutions

### Option 1: Forge SQL (Full Migration)

| Aspect | Details |
|--------|---------|
| **What** | Migrate all data to Forge-hosted SQL database |
| **Compliance** | ✅ "Runs on Atlassian" eligible |
| **Limits** | 1 GiB storage, 150 RPS, 200 tables |
| **Pricing** | Free: 730 GB-hours/month, Overage: $0.00077/GB-hour |
| **Migration Effort** | High (schema redesign, data migration) |

### Option 2: Forge KVS + Custom Entities

| Aspect | Details |
|--------|---------|
| **What** | Use Key-Value Store for simple data, Custom Entities for structured |
| **Compliance** | ✅ "Runs on Atlassian" eligible |
| **Limits** | Read: 0.1 GB free, Write: 0.1 GB free |
| **Pricing** | Read: $0.055/GB, Write: $1.09/GB |
| **Migration Effort** | Medium |

### Option 3: Direct Forge → Supabase Fetch

| Aspect | Details |
|--------|---------|
| **What** | Use Forge fetch API directly to Supabase (bypass AI Server) |
| **Compliance** | ❌ NOT "Runs on Atlassian" eligible |
| **Limits** | No Forge limits, Supabase limits apply |
| **Note** | Already configured in manifest.yml but not used |

### Option 4: Aggressive Caching (Quick Win)

| Aspect | Details |
|--------|---------|
| **What** | Use Forge Storage API for cross-request caching |
| **Compliance** | ✅ "Runs on Atlassian" eligible |
| **Implementation** | Replace in-memory cache with Forge KVS |
| **Migration Effort** | Low |

---

## Recommended Solution: Hybrid Approach

### Architecture After Implementation

```
┌─────────────────┐     ┌─────────────────┐
│   Desktop App   │────▶│    Supabase     │
│  (Screenshots)  │     │  (Storage +     │
└─────────────────┘     │   AI Results)   │
                        └────────▲────────┘
                                 │ (AI analysis only)
                        ┌────────┴────────┐
                        │    AI Server    │
                        │ (GPT-4 Vision)  │
                        └─────────────────┘
                        
┌─────────────────┐     ┌─────────────────┐
│    Forge App    │────▶│   Forge SQL     │
│   (Dashboard)   │     │  (Time entries, │
└────────┬────────┘     │   User data)    │
         │              └─────────────────┘
         │              ┌─────────────────┐
         └─────────────▶│   Forge KVS     │
                        │  (Cache, Prefs) │
                        └─────────────────┘
```

### Data Distribution

| Data Type | Current Location | New Location | Reason |
|-----------|------------------|--------------|--------|
| Screenshots (blobs) | Supabase Storage | **Supabase Storage** | Forge Object Store is EAP |
| AI Analysis Results | Supabase | **Supabase** | Generated by AI Server |
| Time Entries | Supabase | **Forge SQL** | Frequently queried |
| Daily/Weekly Summaries | Supabase | **Forge SQL** | Dashboard performance |
| User Profiles | Supabase | **Forge SQL** | Fast access needed |
| Organization Data | Supabase | **Forge SQL** | Core app data |
| User Preferences | Supabase | **Forge KVS** | Small, fast access |
| Cached Dashboard Data | In-memory | **Forge KVS** | Cross-request persistence |
| Historical Data (>90 days) | Supabase | **Supabase** | Archival, rarely accessed |

---

## Implementation Plan

### Phase 1: Quick Wins (Week 1-2)

**Goal:** Reduce API calls by 40% with minimal changes

1. Implement Forge KVS caching for cross-request persistence
2. Extend batch endpoint usage
3. Add ETag/Last-Modified headers for conditional requests

### Phase 2: Forge SQL Migration (Week 3-6)

**Goal:** Migrate hot data to Forge SQL, reduce API calls by additional 40%

1. Set up Forge SQL schema
2. Implement sync mechanism (Supabase → Forge SQL)
3. Update resolvers to read from Forge SQL
4. Keep Supabase as source of truth for writes

### Phase 3: Optimization (Week 7-8)

**Goal:** Fine-tune and optimize

1. Remove redundant Supabase queries
2. Optimize AI Server to only handle AI operations
3. Implement data archival strategy

---

## Detailed File Changes

### Phase 1: Forge KVS Caching

#### 1.1 Update Manifest for Storage

**File:** `forge-app/manifest.yml`

```yaml
# ADD: SQL module for Forge SQL (Phase 2)
modules:
  sql:
    - key: brd-sql-database
      name: BRD Time Tracker Database

# EXISTING: Ensure storage:app scope is present
permissions:
  scopes:
    - storage:app  # Already exists - enables KVS and SQL
```

#### 1.2 Create Persistent Cache Utility

**File:** `forge-app/src/utils/persistentCache.js` (NEW FILE)

```javascript
/**
 * Persistent Cache using Forge Storage API
 * Provides cross-request caching using Forge KVS
 */
import { storage } from '@forge/api';

const CACHE_PREFIX = 'cache:';
const DEFAULT_TTL = 5 * 60; // 5 minutes in seconds

/**
 * Get item from Forge KVS cache
 */
export async function getCached(key) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const item = await storage.get(cacheKey);
    
    if (!item) return null;
    
    // Check expiration
    if (item.expiresAt && Date.now() > item.expiresAt) {
      await storage.delete(cacheKey);
      return null;
    }
    
    return item.value;
  } catch (error) {
    console.warn('[PersistentCache] Get error:', error.message);
    return null;
  }
}

/**
 * Set item in Forge KVS cache
 */
export async function setCached(key, value, ttlSeconds = DEFAULT_TTL) {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    await storage.set(cacheKey, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now()
    });
    return true;
  } catch (error) {
    console.warn('[PersistentCache] Set error:', error.message);
    return false;
  }
}

/**
 * Delete item from cache
 */
export async function deleteCached(key) {
  try {
    await storage.delete(`${CACHE_PREFIX}${key}`);
    return true;
  } catch (error) {
    return false;
  }
}

// Cache key generators
export const CacheKeys = {
  dashboard: (cloudId, userId) => `dashboard:${cloudId}:${userId}`,
  organization: (cloudId) => `org:${cloudId}`,
  userProfile: (cloudId, accountId) => `user:${cloudId}:${accountId}`,
  timeEntries: (cloudId, userId, date) => `time:${cloudId}:${userId}:${date}`,
};

// TTL constants (in seconds)
export const CacheTTL = {
  DASHBOARD: 2 * 60,      // 2 minutes - frequently updated
  ORGANIZATION: 30 * 60,  // 30 minutes - rarely changes
  USER_PROFILE: 10 * 60,  // 10 minutes
  TIME_ENTRIES: 1 * 60,   // 1 minute - can change often
};
```

#### 1.3 Update Analytics Service to Use Persistent Cache

**File:** `forge-app/src/services/analyticsService.js`

```javascript
// ADD at top of file:
import { getCached, setCached, CacheKeys, CacheTTL } from '../utils/persistentCache.js';

// MODIFY fetchTimeAnalyticsBatch function:
export async function fetchTimeAnalyticsBatch(accountId, cloudId) {
  // Check persistent cache first
  const cacheKey = CacheKeys.dashboard(cloudId, accountId);
  const cached = await getCached(cacheKey);
  
  if (cached) {
    console.log('[Analytics] Returning cached dashboard data');
    return cached;
  }
  
  // ... existing fetch logic ...
  
  // Cache the result
  await setCached(cacheKey, result, CacheTTL.DASHBOARD);
  
  return result;
}
```

---

### Phase 2: Forge SQL Migration

#### 2.1 Create Forge SQL Schema

**File:** `forge-app/src/sql/schema.js` (NEW FILE)

```javascript
/**
 * Forge SQL Schema Definitions
 * Uses DDL operations for schema management
 */
import { sql } from '@forge/sql';

export const SCHEMA_VERSION = 1;

export const ddlOperations = [
  // Organizations table
  {
    version: 1,
    operation: `
      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(36) PRIMARY KEY,
        jira_cloud_id VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        jira_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cloud_id (jira_cloud_id)
      )
    `
  },
  
  // Users table
  {
    version: 1,
    operation: `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        jira_account_id VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        display_name VARCHAR(255),
        avatar_url VARCHAR(500),
        role VARCHAR(50) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_org_account (organization_id, jira_account_id),
        INDEX idx_org_id (organization_id),
        INDEX idx_account_id (jira_account_id)
      )
    `
  },
  
  // Daily time summaries (hot data)
  {
    version: 1,
    operation: `
      CREATE TABLE IF NOT EXISTS daily_time_summary (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        summary_date DATE NOT NULL,
        total_tracked_minutes INT DEFAULT 0,
        total_assigned_minutes INT DEFAULT 0,
        total_unassigned_minutes INT DEFAULT 0,
        issue_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (organization_id, user_id, summary_date),
        INDEX idx_org_date (organization_id, summary_date),
        INDEX idx_user_date (user_id, summary_date)
      )
    `
  },
  
  // Weekly time summaries
  {
    version: 1,
    operation: `
      CREATE TABLE IF NOT EXISTS weekly_time_summary (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        total_tracked_minutes INT DEFAULT 0,
        total_assigned_minutes INT DEFAULT 0,
        total_unassigned_minutes INT DEFAULT 0,
        issue_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_week (organization_id, user_id, week_start),
        INDEX idx_org_week (organization_id, week_start)
      )
    `
  },
  
  // Time entries (recent - last 90 days)
  {
    version: 1,
    operation: `
      CREATE TABLE IF NOT EXISTS time_entries (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        issue_key VARCHAR(50),
        issue_id VARCHAR(50),
        project_key VARCHAR(50),
        tracked_minutes INT DEFAULT 0,
        entry_date DATE NOT NULL,
        entry_type VARCHAR(50) DEFAULT 'assigned',
        source VARCHAR(50) DEFAULT 'screenshot',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_org_user_date (organization_id, user_id, entry_date),
        INDEX idx_issue (issue_key),
        INDEX idx_project (project_key)
      )
    `
  },
  
  // User preferences (from KVS, for backup)
  {
    version: 1,
    operation: `
      CREATE TABLE IF NOT EXISTS user_preferences (
        id VARCHAR(36) PRIMARY KEY,
        organization_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        preferences JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_prefs (organization_id, user_id)
      )
    `
  }
];
```

#### 2.2 Create SQL Migration Runner

**File:** `forge-app/src/sql/migrate.js` (NEW FILE)

```javascript
/**
 * Forge SQL Migration Runner
 * Executes DDL operations in order
 */
import { sql } from '@forge/sql';
import { ddlOperations, SCHEMA_VERSION } from './schema.js';

export async function runMigrations() {
  console.log('[SQL Migration] Starting migrations...');
  
  // Create migrations tracking table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INT PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    console.log('[SQL Migration] Migrations table may already exist');
  }
  
  // Get current version
  let currentVersion = 0;
  try {
    const result = await sql`SELECT MAX(version) as version FROM _migrations`;
    currentVersion = result.rows[0]?.version || 0;
  } catch (error) {
    currentVersion = 0;
  }
  
  console.log(`[SQL Migration] Current version: ${currentVersion}, Target: ${SCHEMA_VERSION}`);
  
  // Run pending migrations
  for (const migration of ddlOperations) {
    if (migration.version > currentVersion) {
      console.log(`[SQL Migration] Running migration version ${migration.version}`);
      try {
        await sql.raw(migration.operation);
        await sql`INSERT INTO _migrations (version) VALUES (${migration.version})`;
        console.log(`[SQL Migration] Version ${migration.version} completed`);
      } catch (error) {
        console.error(`[SQL Migration] Version ${migration.version} failed:`, error);
        throw error;
      }
    }
  }
  
  console.log('[SQL Migration] All migrations completed');
  return { success: true, version: SCHEMA_VERSION };
}
```

#### 2.3 Create Forge SQL Data Access Layer

**File:** `forge-app/src/services/forgeSqlService.js` (NEW FILE)

```javascript
/**
 * Forge SQL Data Access Service
 * Provides data access methods for Forge SQL database
 */
import { sql } from '@forge/sql';

/**
 * Get organization by Jira Cloud ID
 */
export async function getOrganization(cloudId) {
  const result = await sql`
    SELECT * FROM organizations 
    WHERE jira_cloud_id = ${cloudId}
    LIMIT 1
  `;
  return result.rows[0] || null;
}

/**
 * Create or update organization
 */
export async function upsertOrganization(cloudId, name, jiraUrl) {
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO organizations (id, jira_cloud_id, name, jira_url, updated_at)
    VALUES (${id}, ${cloudId}, ${name}, ${jiraUrl}, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE 
      name = ${name},
      jira_url = ${jiraUrl},
      updated_at = CURRENT_TIMESTAMP
  `;
  return getOrganization(cloudId);
}

/**
 * Get user by Jira account ID
 */
export async function getUser(cloudId, accountId) {
  const result = await sql`
    SELECT u.* FROM users u
    JOIN organizations o ON u.organization_id = o.id
    WHERE o.jira_cloud_id = ${cloudId}
    AND u.jira_account_id = ${accountId}
    LIMIT 1
  `;
  return result.rows[0] || null;
}

/**
 * Get daily time summary for dashboard
 */
export async function getDailySummary(cloudId, userId, date) {
  const result = await sql`
    SELECT * FROM daily_time_summary
    WHERE organization_id = (
      SELECT id FROM organizations WHERE jira_cloud_id = ${cloudId}
    )
    AND user_id = ${userId}
    AND summary_date = ${date}
  `;
  return result.rows[0] || null;
}

/**
 * Get weekly time summary
 */
export async function getWeeklySummary(cloudId, userId, weekStart) {
  const result = await sql`
    SELECT * FROM weekly_time_summary
    WHERE organization_id = (
      SELECT id FROM organizations WHERE jira_cloud_id = ${cloudId}
    )
    AND user_id = ${userId}
    AND week_start = ${weekStart}
  `;
  return result.rows[0] || null;
}

/**
 * Get recent time entries (last N days)
 */
export async function getRecentTimeEntries(cloudId, userId, days = 7) {
  const result = await sql`
    SELECT * FROM time_entries
    WHERE organization_id = (
      SELECT id FROM organizations WHERE jira_cloud_id = ${cloudId}
    )
    AND user_id = ${userId}
    AND entry_date >= DATE_SUB(CURRENT_DATE, INTERVAL ${days} DAY)
    ORDER BY entry_date DESC, created_at DESC
  `;
  return result.rows;
}

/**
 * Get dashboard data (optimized single query)
 */
export async function getDashboardData(cloudId, userId) {
  // Get organization
  const org = await getOrganization(cloudId);
  if (!org) {
    return null;
  }
  
  // Get user
  const user = await getUser(cloudId, userId);
  
  // Get today's summary
  const today = new Date().toISOString().split('T')[0];
  const todaySummary = await getDailySummary(cloudId, userId, today);
  
  // Get this week's summary
  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];
  const weekSummary = await getWeeklySummary(cloudId, userId, weekStart);
  
  // Get recent entries
  const recentEntries = await getRecentTimeEntries(cloudId, userId, 7);
  
  return {
    organization: org,
    user,
    todaySummary,
    weekSummary,
    recentEntries
  };
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
```

#### 2.4 Create Data Sync Service

**File:** `forge-app/src/services/dataSyncService.js` (NEW FILE)

```javascript
/**
 * Data Sync Service
 * Syncs data from Supabase to Forge SQL
 * Runs on scheduled trigger or on-demand
 */
import { sql } from '@forge/sql';
import { supabaseQuery } from '../utils/remote.js';

/**
 * Sync daily summaries from Supabase to Forge SQL
 */
export async function syncDailySummaries(cloudId, days = 7) {
  console.log(`[DataSync] Syncing daily summaries for last ${days} days`);
  
  try {
    // Fetch from Supabase via AI Server
    const summaries = await supabaseQuery('daily_time_summary', {
      query: {
        eq: { jira_cloud_id: cloudId },
        gte: { summary_date: getDateDaysAgo(days) },
        order: { column: 'summary_date', ascending: false }
      }
    });
    
    if (!summaries || summaries.length === 0) {
      console.log('[DataSync] No summaries to sync');
      return { synced: 0 };
    }
    
    // Upsert into Forge SQL
    let synced = 0;
    for (const summary of summaries) {
      await sql`
        INSERT INTO daily_time_summary (
          id, organization_id, user_id, summary_date,
          total_tracked_minutes, total_assigned_minutes,
          total_unassigned_minutes, issue_count, updated_at
        ) VALUES (
          ${summary.id},
          ${summary.organization_id},
          ${summary.user_id},
          ${summary.summary_date},
          ${summary.total_tracked_minutes || 0},
          ${summary.total_assigned_minutes || 0},
          ${summary.total_unassigned_minutes || 0},
          ${summary.issue_count || 0},
          CURRENT_TIMESTAMP
        )
        ON DUPLICATE KEY UPDATE
          total_tracked_minutes = ${summary.total_tracked_minutes || 0},
          total_assigned_minutes = ${summary.total_assigned_minutes || 0},
          total_unassigned_minutes = ${summary.total_unassigned_minutes || 0},
          issue_count = ${summary.issue_count || 0},
          updated_at = CURRENT_TIMESTAMP
      `;
      synced++;
    }
    
    console.log(`[DataSync] Synced ${synced} daily summaries`);
    return { synced };
  } catch (error) {
    console.error('[DataSync] Error syncing daily summaries:', error);
    throw error;
  }
}

/**
 * Sync user data from Supabase
 */
export async function syncUsers(cloudId) {
  console.log('[DataSync] Syncing users');
  
  try {
    const users = await supabaseQuery('users', {
      query: {
        eq: { jira_cloud_id: cloudId }
      }
    });
    
    let synced = 0;
    for (const user of users || []) {
      await sql`
        INSERT INTO users (
          id, organization_id, jira_account_id, email,
          display_name, avatar_url, role, updated_at
        ) VALUES (
          ${user.id},
          ${user.organization_id},
          ${user.jira_account_id},
          ${user.email},
          ${user.display_name},
          ${user.avatar_url},
          ${user.role || 'member'},
          CURRENT_TIMESTAMP
        )
        ON DUPLICATE KEY UPDATE
          email = ${user.email},
          display_name = ${user.display_name},
          avatar_url = ${user.avatar_url},
          role = ${user.role || 'member'},
          updated_at = CURRENT_TIMESTAMP
      `;
      synced++;
    }
    
    console.log(`[DataSync] Synced ${synced} users`);
    return { synced };
  } catch (error) {
    console.error('[DataSync] Error syncing users:', error);
    throw error;
  }
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}
```

#### 2.5 Add Scheduled Trigger for Sync

**File:** `forge-app/manifest.yml` (MODIFY)

```yaml
# ADD to modules section:
modules:
  # ... existing modules ...
  
  # SQL module for Forge SQL
  sql:
    - key: brd-sql-database
      name: BRD Time Tracker Database
  
  # Scheduled trigger for data sync
  scheduledTrigger:
    - key: data-sync-trigger
      function: sync-data
      interval: hour  # Runs every hour
  
  function:
    - key: main
      handler: index.handler
    
    # ADD: Sync function
    - key: sync-data
      handler: index.syncHandler
```

#### 2.6 Update Index Handler

**File:** `forge-app/src/index.js` (MODIFY)

```javascript
// ADD imports at top:
import { runMigrations } from './sql/migrate.js';
import { syncDailySummaries, syncUsers } from './services/dataSyncService.js';

// ADD: Sync handler for scheduled trigger
export async function syncHandler(event, context) {
  console.log('[Sync] Starting scheduled data sync');
  
  try {
    // Run migrations first (ensures schema is up to date)
    await runMigrations();
    
    // Get all organizations that need sync
    // For now, we'll sync based on the trigger context
    const cloudId = context?.cloudId;
    
    if (cloudId) {
      await syncUsers(cloudId);
      await syncDailySummaries(cloudId, 7);
    }
    
    return { success: true };
  } catch (error) {
    console.error('[Sync] Error:', error);
    return { success: false, error: error.message };
  }
}

// ADD: App installed handler to run migrations
export async function onInstalled(event, context) {
  console.log('[Install] Running initial setup');
  await runMigrations();
  return { success: true };
}
```

#### 2.7 Update Analytics Service to Use Forge SQL

**File:** `forge-app/src/services/analyticsService.js` (MODIFY)

```javascript
// ADD imports:
import * as forgeSql from './forgeSqlService.js';
import { getCached, setCached, CacheKeys, CacheTTL } from '../utils/persistentCache.js';

// MODIFY: Add Forge SQL fallback
export async function fetchTimeAnalyticsBatch(accountId, cloudId) {
  const cacheKey = CacheKeys.dashboard(cloudId, accountId);
  
  // 1. Check persistent cache
  const cached = await getCached(cacheKey);
  if (cached) {
    console.log('[Analytics] Cache HIT - returning cached data');
    return cached;
  }
  
  // 2. Try Forge SQL first (faster, no network hop to AI server)
  try {
    console.log('[Analytics] Trying Forge SQL...');
    const sqlData = await forgeSql.getDashboardData(cloudId, accountId);
    
    if (sqlData && sqlData.todaySummary) {
      console.log('[Analytics] Forge SQL HIT');
      await setCached(cacheKey, sqlData, CacheTTL.DASHBOARD);
      return sqlData;
    }
  } catch (error) {
    console.log('[Analytics] Forge SQL miss or error, falling back to Supabase');
  }
  
  // 3. Fallback to Supabase via AI Server
  console.log('[Analytics] Falling back to Supabase via AI Server');
  const result = await fetchFromSupabase(accountId, cloudId);
  
  // Cache the result
  await setCached(cacheKey, result, CacheTTL.DASHBOARD);
  
  return result;
}

// Rename existing implementation
async function fetchFromSupabase(accountId, cloudId) {
  // ... existing supabase fetch logic ...
}
```

---

### Phase 3: AI Server Cleanup

#### 3.1 Remove Non-AI Proxy Routes

**File:** `ai-server/src/controllers/forge-proxy-controller.js` (MODIFY)

After full migration, remove or deprecate:
- `supabaseQuery` (generic proxy)
- Keep only AI-related endpoints:
  - `analyzeScreenshot`
  - `getAIAnalysisResults`

```javascript
// DEPRECATION NOTICE
/**
 * @deprecated This endpoint will be removed in v2.0
 * Forge app now uses Forge SQL directly
 * Only kept for backwards compatibility during migration
 */
exports.supabaseQuery = async (req, res) => {
  console.warn('[DEPRECATED] supabaseQuery called - migrate to Forge SQL');
  // ... existing code ...
};
```

---

## Summary of All File Changes

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `forge-app/src/utils/persistentCache.js` | Forge KVS caching utility |
| `forge-app/src/sql/schema.js` | Forge SQL schema definitions |
| `forge-app/src/sql/migrate.js` | Migration runner |
| `forge-app/src/services/forgeSqlService.js` | Forge SQL data access |
| `forge-app/src/services/dataSyncService.js` | Supabase → Forge SQL sync |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `forge-app/manifest.yml` | Add SQL module, scheduled trigger |
| `forge-app/src/index.js` | Add sync handler, install handler |
| `forge-app/src/services/analyticsService.js` | Use Forge SQL with fallback |
| `forge-app/src/utils/cache.js` | Optional: keep for in-request cache |
| `ai-server/src/controllers/forge-proxy-controller.js` | Deprecate non-AI endpoints |

### Files Unchanged

| File Path | Reason |
|-----------|--------|
| `python-desktop-app/desktop_app.py` | Still writes to Supabase |
| `supabase/migrations/*` | Keep as source of truth |
| `ai-server/src/controllers/screenshot-controller.js` | Still handles AI analysis |

---

## Cost Analysis

### Current Costs (Estimated)

| Item | Monthly Cost |
|------|--------------|
| Supabase API Calls | ~$50-100 (depending on users) |
| AI Server Hosting | ~$20-50 |
| Supabase Storage | ~$10-25 |
| **Total** | **~$80-175/month** |

### After Migration (Estimated)

| Item | Monthly Cost |
|------|--------------|
| Forge SQL | Free tier (730 GB-hours) |
| Forge KVS | Free tier (0.1 GB reads/writes) |
| Supabase Storage (screenshots only) | ~$5-10 |
| AI Server (AI only) | ~$10-20 |
| **Total** | **~$15-30/month** |

### Savings: 70-85%

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Forge SQL downtime | High | Keep Supabase as fallback |
| Data sync lag | Medium | Real-time sync for critical data |
| Migration data loss | High | Backup before migration, dual-write during transition |
| Forge SQL limits hit | Medium | Monitor usage, archive old data |
| Complexity increase | Medium | Clear documentation, gradual rollout |

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 (Caching) | 1-2 weeks | 40% API reduction |
| Phase 2 (Forge SQL) | 3-4 weeks | 80% API reduction |
| Phase 3 (Cleanup) | 1-2 weeks | Final optimization |
| **Total** | **6-8 weeks** | Full migration |

---

## Conclusion

The **Hybrid Approach** provides the best balance of:
- ✅ Atlassian compliance ("Runs on Atlassian" eligible)
- ✅ Cost reduction (70-80%)
- ✅ Performance improvement (single network hop)
- ✅ Manageable migration effort
- ✅ Maintains existing functionality

The key is to use **Forge SQL for hot data** (frequently accessed) and **keep Supabase for cold storage** (screenshots, historical data).

---

## Next Steps

1. Review and approve this recommendation
2. Create feature branch for Phase 1
3. Implement persistent caching (quick win)
4. Begin Forge SQL schema design
5. Set up monitoring for API call reduction

---

*Document created: January 31, 2026*  
*Author: GitHub Copilot*  
*Version: 1.0*
