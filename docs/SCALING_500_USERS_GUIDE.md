# JIRAForge Scaling Guide: 500+ Users

> **Document Version:** 1.0  
> **Date:** January 24, 2026  
> **Author:** DevOps Team  
> **Status:** Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Overview](#current-architecture-overview)
3. [Load Profile Analysis](#load-profile-analysis)
4. [Supabase Cost Analysis](#supabase-cost-analysis)
5. [Recommended Architecture Changes](#recommended-architecture-changes)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Estimated Costs](#estimated-costs)
8. [Customer Questionnaire](#customer-questionnaire)
9. [Monitoring & Alerts](#monitoring--alerts)

---

## Executive Summary

This document outlines the strategy for scaling JIRAForge to support a new enterprise customer with **500 users**. The primary challenges are:

- **Database Connections**: Current Micro instance supports only 200 pooler connections
- **Egress Costs**: High data transfer costs from Supabase at scale
- **Storage Growth**: Screenshots accumulate at ~500 MB/user/month
- **AI/LLM Costs**: OpenAI API costs scale linearly with screenshot volume

**Key Recommendations:**
1. Upgrade Supabase compute to Medium tier ($60/month)
2. Add Upstash Redis caching (~$10/month) to reduce egress by 70-80%
3. Implement aggressive storage retention policies
4. Switch to transaction pooler for AI server connections

**Estimated Total Monthly Cost:** $670-1,220/month (including AI costs)

---

## Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        JIRAFORGE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│   │  Desktop App │────▶│   Supabase   │◀────│  Forge App   │            │
│   │   (Python)   │     │  (Postgres)  │     │  (Atlassian) │            │
│   └──────────────┘     └──────┬───────┘     └──────┬───────┘            │
│          │                    │                    │                     │
│          │                    ▼                    │                     │
│          │             ┌──────────────┐            │                     │
│          └────────────▶│  AI Server   │◀───────────┘                     │
│                        │  (Node.js)   │                                  │
│                        └──────┬───────┘                                  │
│                               │                                          │
│                               ▼                                          │
│                        ┌──────────────┐                                  │
│                        │   OpenAI     │                                  │
│                        │  GPT-4 Vision│                                  │
│                        └──────────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Current Configuration

| Component | Current Setup | Limitation |
|-----------|---------------|------------|
| Supabase Compute | Micro (1 GB RAM) | 60 direct / 200 pooler connections |
| Connection Mode | Direct (port 5432) | Not optimized for serverless |
| Caching | In-memory (per-request) | No persistence across requests |
| Storage Retention | 30 days | Full images retained |
| AI Server | Single instance | No horizontal scaling |

---

## Load Profile Analysis

### Per-User Daily Activity

| Activity | Frequency | Details |
|----------|-----------|---------|
| Screenshots | 96/day | Every 5 minutes × 8 working hours |
| Dashboard loads | 10/day | Morning, throughout day, end of day |
| Settings changes | 1/week | Minimal |
| Screenshot views | 20/day | Reviewing work history |

### 500-User Scale Projections

| Metric | Calculation | Daily Volume |
|--------|-------------|--------------|
| **Screenshots captured** | 500 × 96 | 48,000 |
| **AI analysis calls** | 48,000 × 1 | 48,000 |
| **Dashboard API calls** | 500 × 10 × 8 (queries) | 40,000 |
| **Storage uploads** | 48,000 × 200 KB avg | ~9.6 GB/day |

### Monthly Projections

| Resource | Monthly Volume |
|----------|----------------|
| Screenshots stored | ~1,000,000 |
| Database rows (analysis_results) | ~1,000,000 |
| Storage growth | ~250 GB |
| Supabase egress | ~500 GB |
| OpenAI API tokens | ~50-100 million |

---

## Supabase Cost Analysis

### Pricing Reference (January 2026)

| Tier | Base Cost | Compute | Direct Connections | Pooler Connections |
|------|-----------|---------|-------------------|-------------------|
| Free | $0 | Nano (0.5 GB) | 60 | 200 |
| Pro | $25 | Micro (1 GB) | 60 | 200 |
| Pro + Small | $25 + $15 | Small (2 GB) | 90 | 400 |
| Pro + Medium | $25 + $60 | Medium (4 GB) | 120 | 600 |
| Pro + Large | $25 + $110 | Large (8 GB) | 160 | 800 |

### Overage Costs

| Resource | Included (Pro) | Overage Rate |
|----------|----------------|--------------|
| Database size | 8 GB | $0.125/GB |
| Egress | 250 GB | $0.09/GB |
| Cached Egress (CDN) | 250 GB | $0.03/GB |
| Storage | 100 GB | $0.021/GB |

### Projected Monthly Supabase Costs (500 Users)

| Item | Usage | Included | Overage | Cost |
|------|-------|----------|---------|------|
| Pro Plan | - | - | - | $25 |
| Compute (Medium) | - | - | - | $60 |
| Database Size | ~50 GB | 8 GB | 42 GB | $5.25 |
| Egress (before caching) | ~500 GB | 250 GB | 250 GB | $22.50 |
| Storage | ~150 GB | 100 GB | 50 GB | $1.05 |
| **Subtotal** | | | | **~$114/month** |

### With Optimization (Redis Caching + CDN)

| Item | Optimized Usage | Cost |
|------|-----------------|------|
| Egress (75% cached) | ~125 GB overage | $11.25 |
| Cached Egress | ~375 GB | Free (included) |
| **Optimized Total** | | **~$102/month** |

---

## Recommended Architecture Changes

### A. Add Server-Side Redis Caching (CRITICAL)

**Purpose:** Reduce Supabase egress and database load by 70-80%

**Recommended Provider:** [Upstash Redis](https://upstash.com)
- Serverless, pay-per-request model
- ~$0.20 per 100K commands
- Estimated cost: $5-15/month for 500 users

#### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CACHING STRATEGY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Data Type              │ TTL          │ Cache Key Pattern               │
│  ──────────────────────────────────────────────────────────────────────  │
│  Organization data      │ 10 minutes   │ org:{cloudId}                   │
│  User data              │ 5 minutes    │ user:{accountId}                │
│  Membership data        │ 5 minutes    │ member:{userId}:{orgId}         │
│  Dashboard analytics    │ 30 seconds   │ dash:{orgId}:{userId}           │
│  Daily summaries        │ 5 minutes    │ daily:{orgId}:{date}            │
│  Weekly summaries       │ 10 minutes   │ weekly:{orgId}:{weekStart}      │
│  Project summaries      │ 5 minutes    │ projects:{orgId}                │
│  Analysis results       │ 1 hour       │ analysis:{screenshotId}         │
│  User's Jira issues     │ 2 minutes    │ issues:{accountId}              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Implementation Location

```javascript
// ai-server/src/services/cache/redis-cache.js (NEW FILE)

const Redis = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

async function getOrSet(key, ttlSeconds, fetchFn) {
  const cached = await redis.get(key);
  if (cached) return cached;
  
  const data = await fetchFn();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}

module.exports = { redis, getOrSet };
```

#### Cache Invalidation Points

| Event | Keys to Invalidate |
|-------|-------------------|
| User updates profile | `user:{accountId}` |
| Membership changes | `member:{userId}:{orgId}` |
| New screenshot analyzed | `daily:{orgId}:{date}`, `weekly:{orgId}:*` |
| Settings changed | `org:{cloudId}` |

---

### B. Upgrade Supabase Compute Instance

**Current:** Micro (1 GB RAM, 200 pooler connections)  
**Recommended:** Medium (4 GB RAM, 600 pooler connections)

#### Why Medium?

| Factor | Calculation | Requirement |
|--------|-------------|-------------|
| Peak concurrent users | 500 × 20% active | 100 users |
| Connections per user | ~3-5 (dashboard, polling) | 300-500 |
| AI server connections | 10-20 (polling service) | 20 |
| Buffer for spikes | 20% | 100 |
| **Total needed** | | **~500-600** |

#### Upgrade Process

1. Navigate to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select Project → Settings → Compute and Disk
3. Select "Medium" compute size
4. Click "Apply changes"
5. **Note:** ~2 minutes of downtime during upgrade

---

### C. Switch to Transaction Pooler Mode

**Current:** Direct connection (port 5432)  
**Recommended:** Transaction pooler (port 6543)

#### Why Transaction Mode?

- AI server uses short-lived queries (polling every 30 seconds)
- Desktop app uploads are transactional
- Connection reuse improves efficiency
- Prevents "connection exhausted" errors

#### Configuration Change

```env
# ai-server/.env

# BEFORE (Direct Connection)
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# AFTER (Transaction Pooler)
SUPABASE_DB_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

#### Code Consideration

Transaction mode doesn't support prepared statements. Ensure your Supabase client is configured:

```javascript
// ai-server/src/services/db/supabase-client.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
    },
  }
);
```

---

### D. Enable Smart CDN for Storage

**Available on:** Pro Plan (automatic)

Smart CDN caches screenshots at edge locations, reducing origin egress.

#### Optimize Upload Headers

```python
# python-desktop-app/desktop_app.py

# When uploading screenshots, set cache-control
storage_client.storage.from_('screenshots').upload(
    storage_path, 
    img_bytes,
    file_options={
        'content-type': 'image/png',
        'cache-control': 'max-age=31536000'  # 1 year (immutable content)
    }
)
```

#### Thumbnail Caching

```python
# Thumbnails are also immutable once created
file_options={
    'content-type': 'image/jpeg',
    'cache-control': 'max-age=31536000'
}
```

---

### E. Implement Storage Retention Policy

**Goal:** Reduce storage from ~250 GB/month to ~50 GB/month

#### Retention Rules

| Content Type | Keep Full Image | Keep Thumbnail | Keep Metadata |
|--------------|-----------------|----------------|---------------|
| < 7 days old | ✅ | ✅ | ✅ |
| 7-30 days old | ❌ (delete) | ✅ | ✅ |
| > 30 days old | ❌ | ❌ (delete) | ✅ |

#### Configuration

```env
# ai-server/.env

STORAGE_RETENTION_DAYS=7          # Delete full screenshots after 7 days
THUMBNAIL_RETENTION_DAYS=30       # Delete thumbnails after 30 days
CLEANUP_ENABLED=true              # Enable cleanup service
CLEANUP_BATCH_SIZE=100            # Process 100 files per batch
CLEANUP_INTERVAL_HOURS=6          # Run every 6 hours
```

#### Existing Implementation

The cleanup service already exists at:
- `ai-server/src/services/cleanup-service.js`

Just ensure environment variables are configured correctly.

---

### F. AI Cost Optimization (Future)

For the largest cost component (OpenAI), consider:

#### Option 1: Use GPT-4o-mini for Basic Analysis

| Model | Cost per 1M tokens | Use Case |
|-------|-------------------|----------|
| GPT-4 Vision | $10-30 | Complex analysis |
| GPT-4o-mini | $0.15 | Simple classification |

#### Option 2: Screenshot Deduplication

Skip analysis for near-identical consecutive screenshots:

```javascript
// Compare current screenshot hash with previous
const currentHash = md5(screenshotBuffer);
const previousHash = await redis.get(`last-hash:${userId}`);

if (currentHash === previousHash) {
  // Skip AI analysis, copy previous result
  return copyPreviousAnalysis(userId);
}
```

#### Option 3: Reduce Analysis Frequency

- Current: Every 5 minutes (96/day/user)
- Optimized: Every 10 minutes (48/day/user)
- **Savings:** 50% reduction in AI costs

---

## Implementation Roadmap

### Phase 1: Immediate (Before 500-User Onboarding)

| Task | Effort | Owner | Impact |
|------|--------|-------|--------|
| Upgrade Supabase to Medium compute | 10 min | DevOps | Prevents outages |
| Switch AI server to transaction pooler | 30 min | Backend | Prevents connection errors |
| Configure storage retention (7 days) | 30 min | Backend | Reduces storage costs |
| Verify Smart CDN is active | 15 min | DevOps | Reduces egress costs |

**Timeline:** 1 day

### Phase 2: Week 1

| Task | Effort | Owner | Impact |
|------|--------|-------|--------|
| Set up Upstash Redis account | 30 min | DevOps | - |
| Add Redis client to AI server | 2 hours | Backend | - |
| Implement org/user/membership caching | 4 hours | Backend | 30% egress reduction |
| Implement dashboard batch caching | 4 hours | Backend | 40% egress reduction |

**Timeline:** 3-4 days

### Phase 3: Week 2

| Task | Effort | Owner | Impact |
|------|--------|-------|--------|
| Add Redis caching for analysis results | 4 hours | Backend | 10% egress reduction |
| Implement screenshot deduplication | 8 hours | Backend | 20-30% AI cost reduction |
| Add per-organization rate limiting | 4 hours | Backend | Prevents abuse |
| Set up monitoring dashboards | 4 hours | DevOps | Visibility |

**Timeline:** 4-5 days

### Phase 4: Ongoing

| Task | Frequency | Owner |
|------|-----------|-------|
| Monitor Supabase metrics | Daily | DevOps |
| Review cache hit rates | Weekly | Backend |
| Tune cache TTLs | Monthly | Backend |
| Cost optimization review | Monthly | Team |

---

## Estimated Costs

### Monthly Cost Breakdown (500 Users)

| Service | Cost | Notes |
|---------|------|-------|
| **Supabase** | | |
| └─ Pro Plan | $25 | Base subscription |
| └─ Medium Compute | $60 | Upgraded instance |
| └─ Storage Overage | $5-10 | After retention policy |
| └─ Egress Overage | $10-20 | After Redis caching |
| **Upstash Redis** | $10-15 | ~5-10M commands/month |
| **AI Server Hosting** | $50-100 | DigitalOcean/AWS |
| **OpenAI API** | $500-1,000 | GPT-4 Vision analysis |
| **Domain/SSL** | $10 | Optional custom domain |
| **Monitoring** | $0-50 | Datadog/New Relic optional |
| | | |
| **TOTAL** | **$670-1,280/month** | |

### Cost Per User

| Metric | Value |
|--------|-------|
| Monthly cost | $670-1,280 |
| Users | 500 |
| **Cost per user** | **$1.34-2.56/month** |

### Break-Even Analysis

If charging customers per-user:

| Price Point | Monthly Revenue | Profit Margin |
|-------------|-----------------|---------------|
| $3/user/month | $1,500 | 17-55% |
| $5/user/month | $2,500 | 49-73% |
| $10/user/month | $5,000 | 74-87% |

---

## Customer Questionnaire

Before onboarding a 500-user customer, gather these requirements:

### Technical Requirements

1. **Geographic Distribution**
   - [ ] Single region (which?)
   - [ ] Multi-region (list regions)
   - [ ] Global distribution

2. **Working Hours**
   - [ ] Standard business hours (9-5)
   - [ ] 24/7 operations
   - [ ] Shift-based (specify shifts)

3. **Screenshot Frequency**
   - [ ] Every 5 minutes (default)
   - [ ] Every 10 minutes (reduced)
   - [ ] Custom interval: ___

4. **Peak Usage Pattern**
   - [ ] All users active simultaneously
   - [ ] Distributed throughout day
   - [ ] Specific peak hours: ___

### Compliance Requirements

5. **Data Retention**
   - [ ] 7 days (recommended)
   - [ ] 30 days
   - [ ] 90 days
   - [ ] 1 year+
   - [ ] Custom: ___

6. **Data Residency**
   - [ ] No requirements
   - [ ] US only
   - [ ] EU only
   - [ ] Specific region: ___

7. **Compliance Certifications**
   - [ ] SOC 2
   - [ ] HIPAA
   - [ ] GDPR
   - [ ] Other: ___

### Business Requirements

8. **Budget Constraints**
   - Monthly budget: $___
   - Per-user budget: $___

9. **SLA Requirements**
   - Uptime requirement: ____%
   - Support response time: ___

10. **Integration Requirements**
    - [ ] SSO/SAML
    - [ ] Custom reporting
    - [ ] API access
    - [ ] Other: ___

---

## Monitoring & Alerts

### Supabase Dashboard Metrics

Monitor these in [Supabase Dashboard](https://supabase.com/dashboard):

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| Database connections | 70% of max | 90% of max |
| CPU usage | 70% | 90% |
| Memory usage | 70% | 90% |
| Disk I/O | 50% burst used | 80% burst used |
| Egress (daily) | 8 GB | 15 GB |

### Redis Metrics (Upstash)

| Metric | Target | Alert If |
|--------|--------|----------|
| Cache hit rate | > 80% | < 60% |
| Latency (p99) | < 10ms | > 50ms |
| Memory usage | < 80% | > 90% |
| Commands/sec | Baseline × 2 | Baseline × 5 |

### Application Metrics

| Metric | Target | Alert If |
|--------|--------|----------|
| API response time (p95) | < 500ms | > 2s |
| Error rate | < 1% | > 5% |
| Screenshot processing backlog | < 100 | > 500 |
| AI analysis latency | < 10s | > 30s |

### Recommended Alerting Setup

```yaml
# Example: Datadog/PagerDuty alert configuration

alerts:
  - name: "High Database Connections"
    condition: supabase.connections > 500
    severity: warning
    notify: devops-slack

  - name: "Critical Database Connections"
    condition: supabase.connections > 550
    severity: critical
    notify: pagerduty

  - name: "Low Cache Hit Rate"
    condition: redis.hit_rate < 0.6
    severity: warning
    notify: devops-slack

  - name: "Screenshot Backlog Growing"
    condition: pending_screenshots > 500
    severity: warning
    notify: devops-slack
```

---

## Appendix A: Quick Reference Commands

### Supabase Connection Check

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check connections by application
SELECT application_name, count(*) 
FROM pg_stat_activity 
GROUP BY application_name;

-- Check connections by state
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;
```

### Redis Cache Commands

```bash
# Check cache stats (Upstash CLI)
upstash redis info

# Clear specific cache pattern
upstash redis keys "org:*" | xargs upstash redis del

# Monitor cache in real-time
upstash redis monitor
```

### Storage Cleanup (Manual)

```bash
# Trigger cleanup manually
curl -X POST https://your-ai-server/api/admin/cleanup \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Appendix B: Environment Variables Template

```env
# ai-server/.env.production

# Supabase (Transaction Pooler)
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

# Upstash Redis
UPSTASH_REDIS_URL=https://[id].upstash.io
UPSTASH_REDIS_TOKEN=AX...

# OpenAI
OPENAI_API_KEY=sk-...

# Storage Retention
STORAGE_RETENTION_DAYS=7
THUMBNAIL_RETENTION_DAYS=30
CLEANUP_ENABLED=true
CLEANUP_BATCH_SIZE=100
CLEANUP_INTERVAL_HOURS=6

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=200

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-24 | DevOps Team | Initial document |

---

**Next Steps:**
1. Review this document with the team
2. Complete customer questionnaire
3. Begin Phase 1 implementation
4. Schedule Phase 2-3 sprints
