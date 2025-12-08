# BRD Time Tracker - Marketplace Deployment Guide

> Complete guide for deploying your Forge app to Atlassian Marketplace including architecture, costs, sandbox setup, and payment configuration.

---

## Table of Contents

1. [Architecture & Data Flow](#1-architecture--data-flow)
2. [Upfront Costs for Marketplace](#2-upfront-costs-for-marketplace)
3. [Sandbox Environment Setup](#3-sandbox-environment-setup)
4. [Payment Setup & Monetization](#4-payment-setup--monetization)
5. [Marketplace Listing Checklist](#5-marketplace-listing-checklist)
6. [Sources & References](#6-sources--references)

---

## 1. Architecture & Data Flow

### 1.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        BRD TIME TRACKER ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  PYTHON DESKTOP  │     │    SUPABASE      │     │    AI SERVER     │
│       APP        │     │   (PostgreSQL)   │     │   (Node.js)      │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  1. OAuth Login        │                        │
         │ ───────────────────────┼───────────────────────>│
         │  (Atlassian 3LO)       │                        │
         │                        │                        │
         │  2. Get jira_cloud_id  │                        │
         │<───────────────────────┼────────────────────────│
         │                        │                        │
         │  3. Register Org +     │                        │
         │     User               │                        │
         │ ───────────────────────>                        │
         │                        │                        │
         │  4. Capture Screenshot │                        │
         │     (every 5 min)      │                        │
         │ ───────────────────────>                        │
         │   [Upload to Storage]  │                        │
         │   [Insert metadata     │                        │
         │    with org_id]        │                        │
         │                        │                        │
         │                        │  5. Poll for pending   │
         │                        │<───────────────────────│
         │                        │     (every 30s)        │
         │                        │                        │
         │                        │  6. Return screenshots │
         │                        │ ───────────────────────>
         │                        │                        │
         │                        │  7. GPT-4 Vision       │
         │                        │     Analysis           │
         │                        │     - Match to Jira    │
         │                        │       issue            │
         │                        │     - Detect task_key  │
         │                        │     - Classify work    │
         │                        │                        │
         │                        │  8. Save results       │
         │                        │<───────────────────────│
         │                        │                        │
┌────────┴─────────┐              │                        │
│   FORGE APP      │              │                        │
│   (Jira Plugin)  │              │                        │
└────────┬─────────┘              │                        │
         │                        │                        │
         │  9. User opens Jira    │                        │
         │     - Get cloudId      │                        │
         │     - Get/create org   │                        │
         │                        │                        │
         │  10. Fetch analytics   │                        │
         │ ───────────────────────>                        │
         │   (filtered by org_id) │                        │
         │                        │                        │
         │  11. Display dashboard │                        │
         │<───────────────────────│                        │
         │                        │                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Technology | Primary Responsibility |
|-----------|------------|------------------------|
| **Desktop App** | Python 3.8+ | Screenshot capture, OAuth, upload to Supabase |
| **Supabase** | PostgreSQL + S3 Storage | Data persistence, RLS security, file storage |
| **AI Server** | Node.js + Express | Screenshot analysis via GPT-4 Vision |
| **Forge App** | React + Forge Platform | UI in Jira, analytics display, user management |

### 1.3 Time Tracking Data Flow (Step by Step)

| Step | Component | Action | Data |
|------|-----------|--------|------|
| **1** | Desktop App | User authenticates via Atlassian OAuth | Gets `access_token`, `refresh_token` |
| **2** | Desktop App | Calls `/oauth/token/accessible-resources` | Extracts `jira_cloud_id` |
| **3** | Desktop App | Registers with Supabase | Creates `organization` + `user` records |
| **4** | Desktop App | Captures screenshot every 5 min | `image`, `window_title`, `app_name`, `is_idle` |
| **5** | Desktop App | Uploads to Supabase | Stores in `screenshots/{org_id}/{user_id}/` |
| **6** | AI Server | Polls for `status='pending'` | Fetches batch of 10 screenshots |
| **7** | AI Server | GPT-4 Vision analysis | Returns `task_key`, `confidence`, `work_type` |
| **8** | AI Server | Saves to `analysis_results` | Links `screenshot_id`, `organization_id` |
| **9** | Forge App | User opens Jira project page | Resolver gets `cloudId` from context |
| **10** | Forge App | Queries Supabase | Fetches analytics filtered by `organization_id` |
| **11** | Forge App | Renders dashboard | Shows time per day/week/project/issue |

### 1.4 Multi-Tenancy Data Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION MODEL                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Jira Cloud Instance A          Jira Cloud Instance B      │
│  (cloud_id: abc-123)            (cloud_id: xyz-789)        │
│         │                              │                    │
│         ▼                              ▼                    │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │ Organization A  │          │ Organization B  │          │
│  │ (org_id: 1)     │          │ (org_id: 2)     │          │
│  └────────┬────────┘          └────────┬────────┘          │
│           │                            │                    │
│     ┌─────┴─────┐                ┌─────┴─────┐             │
│     ▼           ▼                ▼           ▼             │
│  Users A     Data A           Users B     Data B           │
│  (org_id=1)  (org_id=1)       (org_id=2)  (org_id=2)       │
│                                                             │
│  RLS Policy: WHERE organization_id = current_user_org()    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 Forge Time Tracking Provider Module

You can optionally replace Jira's native time tracking UI:

```yaml
# manifest.yml
modules:
  jira:timeTrackingProvider:
    - key: brd-time-tracking-provider
      name: BRD Time Tracker
      adminPage: admin-settings

  jira:adminPage:
    - key: admin-settings
      function: admin-resolver
      title: BRD Time Tracker Settings
```

This hides Jira's native "Log work" button and lets your app provide custom UI via `jira:issueAction` and `jira:issueActivity` modules.

---

## 2. Upfront Costs for Marketplace

### 2.1 Marketplace Listing Fees

**Good News: NO Upfront Listing Fees**

| Cost Type | Amount | Notes |
|-----------|--------|-------|
| **Listing Fee** | **$0** | No fee to list on Marketplace |
| **Review Fee** | **$0** | No fee for app review |
| **Annual Fee** | **$0** | No ongoing listing fees |
| **Per-Sale Fee** | **$0** | No transaction fees |

Atlassian uses a **revenue share model** instead of upfront fees.

### 2.2 Revenue Share Model

| App Type | Year 1 | Year 2+ |
|----------|--------|---------|
| **Forge Apps** (using Atlassian storage) | **You keep 95%** | You keep 85% |
| **Other Cloud Apps** | You keep 85% | You keep 85% |
| **Data Center/Server Apps** | You keep 75% | You keep 75% |

> **Note**: To qualify for 95% revenue share, your Forge app must use Atlassian-hosted storage and compute.

### 2.3 Forge Platform Costs

#### Free Period (Until December 31, 2025)

Forge is **completely FREE** within platform limits until end of 2025.

#### Consumption-Based Pricing (Starting January 1, 2026)

| Resource | Free Monthly Allowance | Overage Cost |
|----------|------------------------|--------------|
| **Function Duration** | 100,000 GB-seconds | $0.000025/GB-sec |
| **KVS Reads** | 0.1 GB | $0.055/GB |
| **KVS Writes** | 0.1 GB | $1.09/GB |
| **Logs Writes** | 1 GB | $1.005/GB |
| **SQL Compute Duration** | 1 hour | $0.143/hour |
| **SQL Compute Requests** | 100,000 requests | $1.93/million |
| **SQL Data Storage** | 730 GB-hours | $0.00077/GB-hour |

### 2.4 Your External Infrastructure Costs

Since your app uses external services (Supabase, OpenAI), these are your primary costs:

| Service | Tier | Estimated Monthly Cost |
|---------|------|------------------------|
| **Supabase** | Pro Plan | $25/month |
| **Supabase** | Team Plan (scaling) | $599/month |
| **AI Server Hosting** | Basic Cloud VM | $20-50/month |
| **AI Server Hosting** | Production VM | $50-150/month |
| **OpenAI API** | GPT-4 Vision | $0.01-0.03/screenshot |
| **Domain + SSL** | Annual | ~$50/year |

### 2.5 Cost Projections by Scale

| Users | Screenshots/Month | OpenAI Cost | Supabase | Server | **Total** |
|-------|-------------------|-------------|----------|--------|-----------|
| 10 | 19,200 | ~$200 | $25 | $20 | **~$245/mo** |
| 100 | 192,000 | ~$2,000 | $25 | $50 | **~$2,075/mo** |
| 500 | 960,000 | ~$10,000 | $599 | $150 | **~$10,749/mo** |
| 1000 | 1,920,000 | ~$20,000 | $599 | $300 | **~$20,899/mo** |

> **Calculation**: 1 user × 96 screenshots/day × 20 work days = 1,920 screenshots/month

### 2.6 Break-Even Analysis

Assuming $10/user/month pricing with 95% revenue share (Year 1):

| Users | Monthly Revenue | Your Share (95%) | Costs | **Net Profit** |
|-------|-----------------|------------------|-------|----------------|
| 10 | $100 | $95 | $245 | **-$150** |
| 50 | $500 | $475 | $600 | **-$125** |
| 100 | $1,000 | $950 | $2,075 | **-$1,125** |
| 250 | $2,500 | $2,375 | $5,200 | **-$2,825** |

> **Important**: AI costs are significant. Consider:
> - Reducing screenshot frequency
> - Using cheaper models (GPT-4o-mini)
> - Caching similar screenshots
> - Tiered pricing ($15-20/user)

---

## 3. Sandbox Environment Setup

### 3.1 Development Environment Options

#### Option A: Free Developer Site (Recommended)

**URL**: https://go.atlassian.com/cloud-dev

This provides a FREE Jira/Confluence instance for development:

| Feature | Limit |
|---------|-------|
| Jira Software Users | 5 |
| JSM Agent Users | 1 |
| Time Limit | None (perpetual) |
| API Access | Full |
| App Installation | Unlimited |

**Setup Steps:**
1. Go to https://go.atlassian.com/cloud-dev
2. Sign in with your Atlassian account
3. Create a new site (e.g., `yourname-dev.atlassian.net`)
4. Wait for provisioning (~5 minutes)
5. Access your Jira instance

#### Option B: Enterprise Sandbox (Premium/Enterprise Plans Only)

If you have Atlassian Premium or Enterprise subscription:

1. Go to https://admin.atlassian.com
2. Select your organization
3. Navigate to **Apps > Sandboxes**
4. Click **Create Sandbox**
5. Wait up to 30 minutes for provisioning

| Feature | Details |
|---------|---------|
| Cost | Included with Premium/Enterprise |
| Data | Can sync from production |
| Users | Mirrors production limits |
| Isolation | Completely separate from production |

#### Option C: Paid Test Instance

| Plan | Cost | Users |
|------|------|-------|
| Free Tier | $0 | 10 users (limited features) |
| Standard | $7/user/month | Minimum 1 user |
| Trial | $0 for 7 days | Full features |

### 3.2 Forge Environments

Forge provides **3 built-in environments** automatically:

| Environment | Purpose | App Title Suffix | Debugging |
|-------------|---------|------------------|-----------|
| **Development** | Daily development | `(DEVELOPMENT)` | Full (`tunnel`, `logs`) |
| **Staging** | Pre-production testing | `(STAGING)` | Partial (no `tunnel`) |
| **Production** | Live users | None | None |

### 3.3 Forge CLI Commands

```bash
# Deploy to development (default)
forge deploy

# Deploy to staging
forge deploy --environment staging

# Deploy to production
forge deploy --environment production

# Install on a specific site
forge install --site your-dev.atlassian.net

# Install with specific environment
forge install --environment staging --site your-staging.atlassian.net

# Test different license states (development only)
forge install --environment development --license active
forge install --environment development --license inactive
forge install --environment development --license trial

# Use tunnel for hot-reload development
forge tunnel

# View logs (development and staging only)
forge logs

# Create additional development environment
forge environments create

# List all environments
forge environments list

# Set environment variables
forge variables set MY_API_KEY my-secret-value
forge variables set --encrypt SENSITIVE_KEY encrypted-value
forge variables list
```

### 3.4 Recommended Multi-Environment Setup

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         RECOMMENDED ENVIRONMENT SETUP                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        DEVELOPMENT                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  Jira Site:     your-dev.atlassian.net (FREE developer site)            │   │
│  │  Forge Env:     development                                              │   │
│  │  Supabase:      dev-project (separate from prod)                         │   │
│  │  AI Server:     localhost:3001 (via forge tunnel)                        │   │
│  │  Features:      Hot reload, full logging, license testing                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          STAGING                                         │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  Jira Site:     your-staging.atlassian.net (paid or sandbox)            │   │
│  │  Forge Env:     staging                                                  │   │
│  │  Supabase:      staging-project                                          │   │
│  │  AI Server:     staging.your-server.com                                  │   │
│  │  Features:      Pre-production testing, no tunnel                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         PRODUCTION                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  Jira Sites:    *.atlassian.net (customer sites)                        │   │
│  │  Forge Env:     production                                               │   │
│  │  Supabase:      production-project                                       │   │
│  │  AI Server:     api.your-server.com                                      │   │
│  │  Features:      Live users, billing active, no debugging                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Environment Variables Configuration

```bash
# Development
forge variables set --environment development SUPABASE_URL https://dev-xxx.supabase.co
forge variables set --environment development AI_SERVER_URL http://localhost:3001
forge variables set --encrypt --environment development SUPABASE_SERVICE_KEY dev-key

# Staging
forge variables set --environment staging SUPABASE_URL https://staging-xxx.supabase.co
forge variables set --environment staging AI_SERVER_URL https://staging.your-server.com
forge variables set --encrypt --environment staging SUPABASE_SERVICE_KEY staging-key

# Production
forge variables set --environment production SUPABASE_URL https://prod-xxx.supabase.co
forge variables set --environment production AI_SERVER_URL https://api.your-server.com
forge variables set --encrypt --environment production SUPABASE_SERVICE_KEY prod-key
```

---

## 4. Payment Setup & Monetization

### 4.1 Payment Model Overview

For Cloud/Forge apps, you **must** use **"Paid via Atlassian"**. You cannot collect payments directly from customers.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PAYMENT FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│    CUSTOMER                    ATLASSIAN                      YOU (VENDOR)     │
│        │                           │                               │            │
│        │   1. Install App          │                               │            │
│        │ ─────────────────────────>│                               │            │
│        │                           │                               │            │
│        │   2. 30-Day Free Trial    │                               │            │
│        │<─────────────────────────>│                               │            │
│        │                           │                               │            │
│        │   3. Trial → Paid         │                               │            │
│        │   (Auto-converts)         │                               │            │
│        │                           │                               │            │
│        │   4. Monthly Payment      │                               │            │
│        │ ─────────────────────────>│                               │            │
│        │   ($X to Atlassian)       │                               │            │
│        │                           │                               │            │
│        │                           │   5. Accumulate Revenue       │            │
│        │                           │ ─────────────────────────────>│            │
│        │                           │   (Until $500 threshold)      │            │
│        │                           │                               │            │
│        │                           │   6. EFT Payment              │            │
│        │                           │ ─────────────────────────────>│            │
│        │                           │   (30 days after month-end)   │            │
│        │                           │                               │            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Payment Threshold & Timing

| Threshold | Payment Method | Payment Timing |
|-----------|----------------|----------------|
| **$500 USD minimum** | Electronic Funds Transfer (EFT) | Within 30 days after month-end |

**Example Timeline:**
```
January:   $200 earned  → Total: $200   → No payment (below $500)
February:  $400 earned  → Total: $600   → Payment triggered!
March 30:  Atlassian sends $600 via EFT to your bank account
```

### 4.3 Setting Up Vendor Account

#### Step 1: Create Vendor Profile

1. Go to https://marketplace.atlassian.com
2. Click **"List your app"** or **"Become a Marketplace Partner"**
3. Fill in organization details:
   - Company name
   - Contact information
   - Business address
   - Tax information

#### Step 2: Add Banking Information

1. Navigate to **Manage Vendor Account**
2. Go to **Payment Settings**
3. Add bank account details:
   - Bank name
   - Account holder name (must match vendor name)
   - Account number
   - Routing number / SWIFT code
   - Bank address

> **Important**: Bank account must be in your name or company name.

#### Step 3: Tax Configuration

1. Complete W-9 (US) or W-8BEN (International) form
2. Provide VAT/GST number if applicable
3. Set up tax withholding preferences

### 4.4 Setting App Pricing

#### Step 1: Enable Licensing in manifest.yml

```yaml
app:
  id: ari:cloud:ecosystem::app/your-app-id
  licensing:
    enabled: true
```

#### Step 2: Configure Pricing in Marketplace Portal

1. Go to **Manage Vendor Account**
2. Select your app
3. Click **Pricing** tab
4. Select **Cloud**
5. Set pricing tiers:

| User Tier | Suggested Monthly Price |
|-----------|-------------------------|
| 1-10 users | $10 |
| 11-25 users | $25 |
| 26-50 users | $50 |
| 51-100 users | $100 |
| 101-250 users | $200 |
| 251-500 users | $400 |
| 501-1000 users | $700 |
| 1000+ users | Custom/Contact |

6. Click **Submit Pricing**
7. Changes go live within 24 hours

### 4.5 Implementing License Checks

#### In Forge Resolvers (Backend)

```javascript
// src/resolvers/analyticsResolvers.js
export const getAnalytics = async (req) => {
  const { license } = req.context;

  // Check if license is active
  if (!license || !license.isActive) {
    return {
      success: false,
      error: 'LICENSE_INACTIVE',
      message: 'Your subscription is inactive. Please subscribe to continue using BRD Time Tracker.'
    };
  }

  // Check if in trial
  if (license.type === 'TRIAL') {
    const trialDaysRemaining = calculateTrialDays(license.trialEndDate);
    // Optionally show trial warning
  }

  // Continue with normal functionality
  return await fetchAnalytics(req);
};
```

#### In Forge UI (Frontend)

```javascript
// static/main/src/App.js
import { view } from '@forge/bridge';

const App = () => {
  const [license, setLicense] = useState(null);

  useEffect(() => {
    const getContext = async () => {
      const context = await view.getContext();
      setLicense(context.license);
    };
    getContext();
  }, []);

  if (!license?.active) {
    return (
      <div className="license-warning">
        <h2>Subscription Required</h2>
        <p>Please subscribe to BRD Time Tracker to access this feature.</p>
        <a href="https://marketplace.atlassian.com/apps/YOUR_APP_ID">
          Subscribe Now
        </a>
      </div>
    );
  }

  return <MainDashboard />;
};
```

### 4.6 Revenue Calculations

#### Year 1 (95% Revenue Share for Forge Apps)

| Monthly Revenue | Atlassian Takes (5%) | You Receive |
|-----------------|----------------------|-------------|
| $100 | $5 | **$95** |
| $500 | $25 | **$475** |
| $1,000 | $50 | **$950** |
| $5,000 | $250 | **$4,750** |
| $10,000 | $500 | **$9,500** |

#### Year 2+ (85% Revenue Share)

| Monthly Revenue | Atlassian Takes (15%) | You Receive |
|-----------------|----------------------|-------------|
| $100 | $15 | **$85** |
| $500 | $75 | **$425** |
| $1,000 | $150 | **$850** |
| $5,000 | $750 | **$4,250** |
| $10,000 | $1,500 | **$8,500** |

### 4.7 Handling Refunds & Cancellations

| Scenario | Policy |
|----------|--------|
| **Refund within 30 days** | Full refund, no questions asked |
| **Refund 31-60 days** | At Atlassian's discretion |
| **Refund >$1,500 total** | Atlassian seeks your approval first |
| **Customer cancels** | App remains installed but license becomes inactive |
| **Customer fails to pay** | Site shut down; you're not notified |

### 4.8 Important Payment Notes

1. **Minimum Threshold**: No payment until you accumulate $500
2. **Payment Timing**: 30-60 days after sale
3. **Currency**: Payments in USD
4. **Tax Withholding**: May apply based on your location
5. **Refunds**: Deducted from your revenue share
6. **Chargebacks**: Rare but possible; handled by Atlassian

---

## 5. Marketplace Listing Checklist

### 5.1 Pre-Submission Requirements

- [ ] **App deployed to production** (`forge deploy --environment production`)
- [ ] **Licensing enabled** in manifest.yml
- [ ] **License checks implemented** in code
- [ ] **Privacy policy** URL ready
- [ ] **Terms of service** URL ready
- [ ] **Support URL** ready (email or help desk)
- [ ] **App icon** (144x144 PNG)
- [ ] **Screenshots** (min 3, showing key features)
- [ ] **App description** (detailed, with features list)
- [ ] **Data Processing Addendum (DPA)** if storing personal data

### 5.2 Submission Steps

1. **Enable App Sharing**
   - Go to Atlassian Developer Console
   - Select your app
   - Click **Distribution** → **Sharing**
   - Enable sharing

2. **Create Partner Profile**
   - Go to https://marketplace.atlassian.com
   - Click **"Become a Partner"**
   - Complete vendor registration

3. **Submit for Review**
   - Click **"List a new app"**
   - Select your Forge app
   - Fill in all required fields
   - Provide API scope justifications
   - List remote hostnames/IPs used
   - Submit for review

4. **Review Process**
   - **Timeline**: Usually within 1 week
   - **Communication**: Via email
   - **Possible outcomes**: Approved, Revisions needed, Rejected

### 5.3 Post-Listing Tasks

- [ ] Monitor app reviews and ratings
- [ ] Respond to support requests
- [ ] Track revenue in Vendor Portal
- [ ] Update app regularly
- [ ] Maintain security compliance

---

## 6. Sources & References

### Official Atlassian Documentation

| Topic | URL |
|-------|-----|
| Marketplace Pricing & Billing | https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/ |
| Forge Platform Pricing | https://developer.atlassian.com/platform/forge/forge-platform-pricing/ |
| Forge Environments | https://developer.atlassian.com/platform/forge/environments-and-versions/ |
| Listing Forge Apps | https://developer.atlassian.com/platform/marketplace/listing-forge-apps/ |
| Selling on Marketplace | https://developer.atlassian.com/platform/marketplace/selling-on-marketplace/ |
| Time Tracking Provider | https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-time-tracking-provider/ |
| Create Developer Site | https://go.atlassian.com/cloud-dev |
| Sandbox Documentation | https://support.atlassian.com/organization-administration/docs/what-are-sandboxes/ |

### Atlassian Blog Posts

| Topic | URL |
|-------|-----|
| Forge Free Through 2025 | https://www.atlassian.com/blog/developer/forge-free-pricing-2025 |
| Forge Pricing 2026 Updates | https://www.atlassian.com/blog/developer/updates-to-forge-pricing-effective-january-2026 |

### Community Resources

| Topic | URL |
|-------|-----|
| Forge Developer Community | https://community.developer.atlassian.com/c/forge/ |
| Marketplace Partner Portal | https://marketplace.atlassian.com |
| Atlassian Developer Documentation | https://developer.atlassian.com |

---

## Document Information

| Field | Value |
|-------|-------|
| **Created** | December 2024 |
| **Last Updated** | December 2024 |
| **Author** | BRD Time Tracker Team |
| **Version** | 1.0 |

---

*This document is part of the BRD Time Tracker documentation suite.*
