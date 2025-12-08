# Comprehensive Research Report

## 1. Architecture & Data Flow for Timesheet Tracker + JIRA + Forge

### Your Application's Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BRD TIME TRACKER ARCHITECTURE                         │
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

### Time Tracking Data Flow (Step by Step)

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

### Forge Time Tracking Provider Module

You can use the `jira:timeTrackingProvider` module to replace Jira's native time tracking:

```yaml
modules:
  jira:timeTrackingProvider:
    - key: brd-time-tracking-provider
      name: BRD Time Tracker
      adminPage: admin-settings
```

This hides Jira's native "Log work" button and lets your app provide custom UI via `jira:issueAction` and `jira:issueActivity` modules.

---

## 2. Upfront Costs for Marketplace App

### Good News: **NO Upfront Listing Fees**

Atlassian uses a **revenue share model** - you don't pay to list your app.

| Cost Type | Amount | Notes |
|-----------|--------|-------|
| **Listing Fee** | **$0** | No fee to list on Marketplace |
| **Review Fee** | **$0** | No fee for app review |
| **Annual Fee** | **$0** | No ongoing listing fees |

### Revenue Share Model (What Atlassian Takes)

| App Type | Year 1 | Year 2+ |
|----------|--------|---------|
| **Forge Apps** (with Atlassian storage) | **You get 95%** | You get 85% |
| **Other Cloud Apps** | You get 85% | You get 85% |
| **Other Products** | You get 75% | You get 75% |

### Forge Platform Costs (Starting January 1, 2026)

**Until December 31, 2025**: Forge is FREE within platform limits

**From January 2026**: Consumption-based pricing

| Resource | Free Monthly Allowance | Overage Cost |
|----------|------------------------|--------------|
| **Function Duration** | 100,000 GB-seconds | $0.000025/GB-sec |
| **KVS Reads** | 0.1 GB | $0.055/GB |
| **KVS Writes** | 0.1 GB | $1.09/GB |
| **SQL Compute** | 1 hour | $0.143/hour |
| **SQL Requests** | 100,000 | $1.93/million |
| **Storage** | 730 GB-hours | $0.00077/GB-hour |

**Your App Uses Supabase** (External) - So your main costs will be:
- Supabase hosting (~$25-100/month for production)
- OpenAI API (~$0.01-0.03 per screenshot analysis)
- Your AI Server hosting

### Estimated Monthly Operating Costs

| Service | Estimated Cost |
|---------|----------------|
| Supabase (Pro) | $25/month |
| AI Server (Cloud VM) | $20-50/month |
| OpenAI API (1000 users × 96 screenshots) | ~$300-500/month |
| **Total** | **~$350-575/month** |

---

## 3. Sandbox Environment Setup

### Option A: Free Developer Site (Recommended for Development)

**URL**: [go.atlassian.com/cloud-dev](https://go.atlassian.com/cloud-dev)

This gives you a FREE Jira/Confluence instance for development with:
- 5 Jira Software users
- 1 JSM agent user
- Full API access
- No time limit

### Option B: Forge Environments

Forge provides **3 built-in environments**:

| Environment | Use Case | Limitations |
|-------------|----------|-------------|
| **Development** | Day-to-day coding | Can use `forge tunnel` for hot reload |
| **Staging** | Pre-production testing | Cannot use `forge tunnel` |
| **Production** | Live users | No `forge tunnel` or `forge logs` |

**Commands:**
```bash
# Deploy to development (default)
forge deploy

# Deploy to staging
forge deploy --environment staging

# Deploy to production
forge deploy --environment production

# Install on a site
forge install --site your-site.atlassian.net

# Test different license states
forge install --environment development --license active
forge install --environment development --license inactive
forge install --environment development --license trial
```

### Option C: Enterprise Sandbox (Requires Premium/Enterprise Plan)

If you have Premium or Enterprise Atlassian plans:
1. Go to [admin.atlassian.com](https://admin.atlassian.com)
2. Select **Apps > Sandboxes**
3. Create sandbox (takes up to 30 minutes)

### Recommended Development Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT SETUP                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Developer Site (FREE)                                      │
│  └── your-dev.atlassian.net                                │
│       ├── Forge App (DEVELOPMENT)                          │
│       ├── Supabase Dev Project                             │
│       └── AI Server (localhost:3001)                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    STAGING SETUP                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Staging Site                                               │
│  └── your-staging.atlassian.net                            │
│       ├── Forge App (STAGING)                              │
│       ├── Supabase Staging Project                         │
│       └── AI Server (staging-server.com)                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                   PRODUCTION SETUP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Customer Sites                                             │
│  └── *.atlassian.net                                       │
│       ├── Forge App (PRODUCTION)                           │
│       ├── Supabase Production Project                      │
│       └── AI Server (prod-server.com)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Payment Setup - How You Get Paid

### Payment Model: **Paid via Atlassian**

For Cloud/Forge apps, you **must** use "Paid via Atlassian" - you cannot collect payments directly from customers.

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CUSTOMER   │────>│  ATLASSIAN  │────>│    YOU      │
│             │     │             │     │  (Vendor)   │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
    Pays subscription ────┘
    price to Atlassian
                          │
    Atlassian takes ──────┘
    5-15% cut
                          │
    Pays you via ─────────┘
    EFT (bank transfer)
```

### Payment Flow

| Step | What Happens |
|------|--------------|
| **1** | Customer installs your app (30-day free trial) |
| **2** | Trial auto-converts to paid subscription |
| **3** | Customer pays Atlassian monthly |
| **4** | Atlassian accumulates your earnings |
| **5** | When you reach **$500 USD** → Atlassian pays you |
| **6** | Payment via **EFT (Bank Transfer)** within 30-60 days |

### Payment Threshold

| Minimum | Payment Timing |
|---------|----------------|
| **$500 USD** | Paid 30 days after month-end when you hit $500 |

Example:
- January: $200 earned → No payment (below threshold)
- February: $400 earned → $600 total → Payment sent by March 31

### Setting Up Payment

1. **Create Vendor Profile**
   - Go to [Marketplace Portal](https://developer.atlassian.com/platform/marketplace/)
   - Register your organization details

2. **Add Bank Account**
   - Navigate to **Manage vendor account**
   - Add valid bank account in your name/company name
   - Atlassian pays via **Electronic Funds Transfer (EFT)**

3. **Set App Pricing**
   - Go to your app → **Pricing** tab
   - Select Cloud pricing
   - Set monthly price per user tier

### Pricing Tiers You Can Set

| User Tier | Example Price |
|-----------|---------------|
| 1-10 users | $10/month |
| 11-25 users | $25/month |
| 26-50 users | $50/month |
| 51-100 users | $100/month |
| 100+ users | Custom |

### What You Receive

| Gross Sale | Atlassian Takes | You Receive |
|------------|-----------------|-------------|
| $100/month | $5 (Year 1) | **$95** |
| $100/month | $15 (Year 2+) | **$85** |

### Important Notes

- **Refunds**: Atlassian offers full refunds within 30 days (no questions asked)
- **Failed payments**: If customer doesn't pay, their site shuts down - you're not notified
- **License checking**: Your app should check `context.license.active` and restrict features if false

### Enable Licensing in Your App

Add to `manifest.yml`:
```yaml
app:
  licensing:
    enabled: true
```

Check license in resolvers:
```javascript
export const handler = async (req) => {
  const { license } = req.context;

  if (!license?.isActive) {
    return { error: 'License inactive. Please subscribe.' };
  }

  // Continue with functionality...
};
```

---

## Summary Table

| Topic | Key Information |
|-------|-----------------|
| **Architecture** | Desktop → Supabase → AI Server → Forge displays in Jira |
| **Upfront Costs** | **$0** listing fee; Revenue share 5-15% |
| **Sandbox** | Free dev site at [go.atlassian.com/cloud-dev](https://go.atlassian.com/cloud-dev) |
| **Payments** | Atlassian collects → pays you via EFT when you hit $500 |

---

## Sources

- [Atlassian Marketplace Pricing, Payment & Billing](https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/)
- [Forge Platform Pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/)
- [Forge Environments and Versions](https://developer.atlassian.com/platform/forge/environments-and-versions/)
- [Listing Forge Apps](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)
- [Selling on Marketplace](https://developer.atlassian.com/platform/marketplace/selling-on-marketplace/)
- [Time Tracking Provider Module](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-time-tracking-provider/)
- [Forge Will Remain Free Through 2025](https://www.atlassian.com/blog/developer/forge-free-pricing-2025)
- [Updates to Forge Pricing (2026)](https://www.atlassian.com/blog/developer/updates-to-forge-pricing-effective-january-2026)
- [Create a Sandbox](https://support.atlassian.com/organization-administration/docs/create-a-sandbox/)
- [What is a Sandbox?](https://support.atlassian.com/organization-administration/docs/what-are-sandboxes/)
