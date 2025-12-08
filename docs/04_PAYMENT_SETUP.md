# Payment Setup for Atlassian Marketplace

**Document Version:** 1.0
**Date:** December 5, 2025
**Author:** Technical Team
**Purpose:** Complete guide for setting up payments and monetization on Atlassian Marketplace

---

## Table of Contents
1. [Overview](#overview)
2. [Vendor Registration](#vendor-registration)
3. [Pricing Models](#pricing-models)
4. [Payment Gateway Setup](#payment-gateway-setup)
5. [Subscription Management](#subscription-management)
6. [Tax & Legal Compliance](#tax--legal-compliance)
7. [Free Trial Strategy](#free-trial-strategy)
8. [Revenue Optimization](#revenue-optimization)
9. [Financial Reporting](#financial-reporting)
10. [Customer Billing Support](#customer-billing-support)

---

## 1. Overview

### How Atlassian Marketplace Payments Work

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Customer                Atlassian             You          │
│  ┌─────────┐            ┌──────────┐       ┌──────────┐   │
│  │ Buys App├───────────>│ Processes├──────>│ Receives │   │
│  │ $10/mo  │            │ Payment  │       │ $7.50/mo │   │
│  └─────────┘            │ (Stripe) │       └──────────┘   │
│                         │          │                       │
│                         │ Takes 25%│                       │
│                         │ Commission                       │
│                         └──────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Atlassian handles ALL payment processing
- You don't need your own payment gateway
- Money flows: Customer → Atlassian → You
- Monthly payouts (Net 30 terms)
- 25% marketplace fee automatically deducted

---

## 2. Vendor Registration

### 2.1 Create Atlassian Partner Account

**Step 1: Register as Partner**

1. **Go to Atlassian Partner Portal:**
   - Visit: https://www.atlassian.com/partnerships
   - Click "Become a Solution Partner"

2. **Fill Out Registration:**
   ```
   Company Information:
   - Legal Company Name: [Your Company Name]
   - Business Email: [admin@yourcompany.com]
   - Country: [Your Country]
   - Business Address: [Full Address]
   - Phone Number: [Contact Number]

   Contact Person:
   - First Name: [Your Name]
   - Last Name: [Your Last Name]
   - Role: Developer / CTO / CEO
   - Email: [your@email.com]
   ```

3. **Accept Terms:**
   - Atlassian Developer Distribution Agreement
   - Privacy Policy
   - Marketplace Terms of Service

4. **Verification:**
   - Email verification (automatic)
   - Business verification (may take 1-2 business days)

**Cost: FREE**

### 2.2 Set Up Marketplace Vendor Profile

**Step 2: Create Vendor Profile**

1. **Go to Developer Console:**
   - Visit: https://developer.atlassian.com/console/myapps/
   - Sign in with your Atlassian account

2. **Navigate to Marketplace Settings:**
   - Click on your account name
   - Select "Marketplace" or "Vendor Profile"

3. **Complete Vendor Profile:**
   ```
   Vendor Display Name: [Your Company or Brand Name]
   Vendor Description: [Brief description of your company]
   Website: https://yourcompany.com
   Support Email: support@yourcompany.com
   Support URL: https://yourcompany.com/support

   Social Links (Optional):
   - LinkedIn: https://linkedin.com/company/yourcompany
   - Twitter: https://twitter.com/yourcompany
   ```

4. **Upload Vendor Logo:**
   - Size: 200x200 pixels
   - Format: PNG with transparent background
   - File size: < 500 KB

### 2.3 Tax Information (W-9 or W-8BEN)

**Step 3: Submit Tax Forms**

**For US-Based Vendors (W-9 Form):**

1. **Navigate to Tax Settings:**
   - Developer Console → Settings → Tax Information

2. **Fill Out W-9:**
   ```
   Legal Name: [As registered with IRS]
   Business Name (if different): [DBA name]
   Federal Tax Classification:
   - [ ] Individual/Sole Proprietor
   - [ ] Corporation
   - [ ] Partnership
   - [X] LLC (check appropriate tax classification)

   Address: [US Address]
   Tax ID (SSN or EIN): [Your Tax ID]
   ```

3. **Sign and Submit:**
   - Electronic signature accepted
   - Must match IRS records

**For Non-US Vendors (W-8BEN or W-8BEN-E):**

1. **Fill Out W-8BEN (Individual) or W-8BEN-E (Entity):**
   ```
   Legal Name: [Your Name or Company]
   Country of Tax Residence: [Your Country]
   Tax ID Number: [Your Country's Tax ID]
   Foreign Tax Identifying Number: [If applicable]

   Tax Treaty Information:
   - Check if your country has tax treaty with US
   - May reduce withholding tax from 30% to 0-15%
   ```

2. **Upload Supporting Documents:**
   - Business registration certificate
   - Tax residency certificate
   - Bank account verification

**Important:**
- US vendors: No withholding tax
- Non-US vendors without treaty: 30% withholding
- Non-US vendors with treaty: 0-15% withholding (varies by country)

---

## 3. Pricing Models

### 3.1 Atlassian Marketplace Pricing Tiers

**Supported Pricing Models:**

1. **User-Based Pricing (Recommended)**
   - Price per active user
   - Most common model
   - Scales with customer size

2. **Flat-Rate Pricing**
   - Single price regardless of users
   - Simple but less scalable

3. **Tiered Pricing**
   - Different features at different price points
   - Free, Starter, Professional, Enterprise

4. **Free App**
   - No cost to customers
   - Good for lead generation
   - Can upgrade to paid later

### 3.2 Recommended Pricing Structure for BRD Time Tracker

**Pricing Tier Table:**

| Tier | Monthly Price | User Limit | Features | Target Customer |
|------|---------------|------------|----------|-----------------|
| **Free** | $0 | 3 users | Basic tracking, 100 screenshots/month, 7-day retention | Individuals, small teams |
| **Starter** | $5/user | 10 users | 1,000 screenshots/month, 30-day retention, AI analysis | Small teams |
| **Professional** | $8/user | 50 users | Unlimited screenshots, 90-day retention, clustering, priority support | Growing companies |
| **Enterprise** | $12/user | Unlimited | 1-year retention, SSO, custom integrations, SLA | Large enterprises |

**Atlassian Standard User Tiers:**

Atlassian uses standard user tiers for pricing:
- 1-10 users
- 11-25 users
- 26-50 users
- 51-100 users
- 101-250 users
- 251-500 users
- 501-1,000 users
- 1,001-2,000 users
- 2,001-5,000 users
- 5,001-10,000 users
- 10,001+ users (custom pricing)

**Example Pricing Configuration:**

```json
{
  "free": {
    "price": 0,
    "users": 3,
    "features": ["basic_tracking", "limited_screenshots"]
  },
  "starter": {
    "tiers": [
      { "users": "1-10", "pricePerUser": 5.00 },
      { "users": "11-25", "pricePerUser": 4.50 },
      { "users": "26-50", "pricePerUser": 4.00 }
    ]
  },
  "professional": {
    "tiers": [
      { "users": "1-10", "pricePerUser": 8.00 },
      { "users": "11-25", "pricePerUser": 7.50 },
      { "users": "26-50", "pricePerUser": 7.00 },
      { "users": "51-100", "pricePerUser": 6.50 },
      { "users": "101-250", "pricePerUser": 6.00 }
    ]
  },
  "enterprise": {
    "tiers": [
      { "users": "1-10", "pricePerUser": 12.00 },
      { "users": "11-25", "pricePerUser": 11.00 },
      { "users": "26-50", "pricePerUser": 10.00 },
      { "users": "51-100", "pricePerUser": 9.00 },
      { "users": "101+", "pricePerUser": 8.00 }
    ]
  }
}
```

### 3.3 Configure Pricing in Marketplace

**Step 1: Access App Pricing Settings**

1. **Go to Developer Console:**
   - Navigate to your app
   - Click "Pricing" tab

2. **Choose Pricing Model:**
   - Select "Tiered User Pricing"

3. **Set Up Each Tier:**

**Free Tier:**
```
Tier Name: Free
Price: $0
User Limit: 3 users
Description: Perfect for individuals and small teams
Features:
- Basic time tracking
- 100 screenshots per month
- 7-day data retention
- Community support
```

**Starter Tier:**
```
Tier Name: Starter
Price Structure: Per User
Pricing:
- 1-10 users: $5.00 per user/month
- 11-25 users: $4.50 per user/month
- 26-50 users: $4.00 per user/month

Description: Ideal for small teams starting with automated time tracking
Features:
- All Free features
- 1,000 screenshots per month
- 30-day data retention
- AI-powered task detection
- Email support
```

**Professional Tier:**
```
Tier Name: Professional
Price Structure: Per User
Pricing:
- 1-10 users: $8.00 per user/month
- 11-25 users: $7.50 per user/month
- 26-50 users: $7.00 per user/month
- 51-100 users: $6.50 per user/month
- 101-250 users: $6.00 per user/month

Description: For growing teams needing advanced features
Features:
- All Starter features
- Unlimited screenshots
- 90-day data retention
- Work clustering and analytics
- Priority support
- Custom reports
```

**Enterprise Tier:**
```
Tier Name: Enterprise
Price Structure: Per User
Pricing:
- 1-10 users: $12.00 per user/month
- 11-25 users: $11.00 per user/month
- 26-50 users: $10.00 per user/month
- 51-100 users: $9.00 per user/month
- 101+ users: $8.00 per user/month

Description: For large organizations requiring enterprise features
Features:
- All Professional features
- 1-year data retention
- Single Sign-On (SSO)
- Dedicated support
- 99.9% SLA guarantee
- Custom integrations
- On-premise deployment option
```

**Step 2: Set Free Trial Period**

```
Free Trial: 30 days
Applies to: Starter, Professional, Enterprise tiers
Credit Card Required: No (recommended for higher conversion)
```

---

## 4. Payment Gateway Setup

### 4.1 Banking Information

**Step 1: Add Bank Account**

1. **Navigate to Payment Settings:**
   - Developer Console → Settings → Payments

2. **Select Country:**
   - Choose your bank account country

3. **Enter Bank Details:**

**For US Banks:**
```
Bank Name: [Your Bank Name]
Account Holder Name: [Legal Name or Company Name]
Routing Number: [9-digit routing number]
Account Number: [Your account number]
Account Type: Checking or Savings
```

**For Non-US Banks (SWIFT/IBAN):**
```
Bank Name: [Your Bank Name]
Account Holder Name: [Legal Name or Company Name]
SWIFT/BIC Code: [Bank's SWIFT code]
IBAN: [Your IBAN number]
Bank Address: [Bank's address]
Currency: USD (Atlassian pays in USD)
```

4. **Verify Bank Account:**
   - Atlassian will send 2 small test deposits (< $1 each)
   - Verify amounts within 3-5 business days
   - Enter amounts to confirm account

**Important:** Bank account must match the name on your tax forms.

### 4.2 Payment Schedule

**Atlassian Payment Terms:**

- **Frequency:** Monthly
- **Payment Terms:** Net 30 days
- **Minimum Threshold:** $10 (some countries may have different thresholds)
- **Currency:** USD (converted to local currency if non-US bank)

**Example Timeline:**
```
January 1-31: Customer subscriptions and usage
February 28: Atlassian calculates your earnings
March 30: Payment sent to your bank account
April 2-5: Funds arrive in your account (depends on bank)
```

### 4.3 Currency and Conversion

**Pricing Display:**
- Atlassian displays prices in customer's local currency
- Automatic conversion based on daily exchange rates
- You receive payment in USD

**Customer Pricing Examples:**
- US customer sees: $8.00 per user/month
- EU customer sees: €7.20 per user/month (approximate)
- UK customer sees: £6.50 per user/month (approximate)

**You receive:** USD equivalent after 25% marketplace fee

---

## 5. Subscription Management

### 5.1 Implement License Validation

**Forge App License Check:**

```javascript
// src/utils/licensing.js
import api, { route } from '@forge/api';

/**
 * Check if the user's organization has an active paid license
 */
export async function checkLicense() {
  try {
    // Get current license information
    const response = await api.asApp().requestJira(
      route`/rest/atlassian-connect/1/addons/{addonKey}/properties/license`
    );

    const license = await response.json();

    return {
      isActive: license.active,
      tier: license.licenseType, // 'free', 'starter', 'professional', 'enterprise'
      maxUsers: license.maxUsers,
      expiryDate: license.expiryDate
    };
  } catch (error) {
    console.error('License check failed:', error);
    return { isActive: false, tier: 'free', maxUsers: 3 };
  }
}

/**
 * Check if feature is available in current license tier
 */
export function hasFeatureAccess(license, feature) {
  const featureMatrix = {
    'free': ['basic_tracking', 'limited_screenshots'],
    'starter': ['basic_tracking', 'ai_analysis', 'email_support'],
    'professional': ['basic_tracking', 'ai_analysis', 'email_support', 'clustering', 'priority_support', 'custom_reports'],
    'enterprise': ['basic_tracking', 'ai_analysis', 'email_support', 'clustering', 'priority_support', 'custom_reports', 'sso', 'sla', 'custom_integrations']
  };

  const tierFeatures = featureMatrix[license.tier] || featureMatrix['free'];
  return tierFeatures.includes(feature);
}
```

**Usage in Resolver:**

```javascript
// src/resolvers/analyticsResolvers.js
import { checkLicense, hasFeatureAccess } from '../utils/licensing';

resolver.define('getAdvancedAnalytics', async (req) => {
  const license = await checkLicense();

  // Check if user has access to advanced analytics
  if (!hasFeatureAccess(license, 'custom_reports')) {
    return {
      error: 'This feature requires Professional or Enterprise plan',
      upgradeUrl: 'https://marketplace.atlassian.com/apps/YOUR_APP_ID'
    };
  }

  // Feature is available, proceed
  return await fetchAdvancedAnalytics();
});
```

### 5.2 Handle License Changes

**Listen to License Events:**

```javascript
// Forge automatically handles license changes
// You can query the current license status at any time

// Example: Check license before processing screenshot
async function processScreenshot(screenshot) {
  const license = await checkLicense();

  // Check screenshot quota based on tier
  const quotas = {
    'free': 100,
    'starter': 1000,
    'professional': -1, // unlimited
    'enterprise': -1
  };

  const monthlyQuota = quotas[license.tier];
  const currentUsage = await getMonthlyScreenshotCount();

  if (monthlyQuota !== -1 && currentUsage >= monthlyQuota) {
    throw new Error('Monthly screenshot quota exceeded. Please upgrade your plan.');
  }

  // Proceed with processing
  // ...
}
```

### 5.3 Supabase Subscription Tracking

**Update Subscription Status in Database:**

```javascript
// Sync Atlassian license status to Supabase
async function syncLicenseToSupabase(organizationId, license) {
  const supabase = createSupabaseClient();

  // Update organization subscription info
  await supabase
    .from('organizations')
    .update({
      subscription_status: license.isActive ? 'active' : 'expired',
      subscription_tier: license.tier,
      max_users: license.maxUsers,
      subscription_end_date: license.expiryDate,
      updated_at: new Date().toISOString()
    })
    .eq('id', organizationId);

  // Update organization settings
  await supabase
    .from('organization_settings')
    .update({
      screenshot_quota: getQuotaForTier(license.tier),
      data_retention_days: getRetentionForTier(license.tier),
      features_enabled: getFeaturesForTier(license.tier)
    })
    .eq('organization_id', organizationId);
}

function getQuotaForTier(tier) {
  const quotas = {
    'free': 100,
    'starter': 1000,
    'professional': -1,
    'enterprise': -1
  };
  return quotas[tier] || 100;
}

function getRetentionForTier(tier) {
  const retention = {
    'free': 7,
    'starter': 30,
    'professional': 90,
    'enterprise': 365
  };
  return retention[tier] || 7;
}

function getFeaturesForTier(tier) {
  const features = {
    'free': ['basic_tracking'],
    'starter': ['basic_tracking', 'ai_analysis'],
    'professional': ['basic_tracking', 'ai_analysis', 'clustering', 'custom_reports'],
    'enterprise': ['basic_tracking', 'ai_analysis', 'clustering', 'custom_reports', 'sso', 'sla']
  };
  return features[tier] || features['free'];
}
```

---

## 6. Tax & Legal Compliance

### 6.1 Sales Tax and VAT

**Atlassian Handles Most Tax:**
- Atlassian automatically calculates and collects sales tax/VAT
- Remits tax to appropriate authorities
- You receive net payment after tax

**Tax Responsibilities:**

**Your Responsibilities:**
- Report Atlassian payments as income
- Pay income tax in your country
- Maintain accounting records

**Atlassian's Responsibilities:**
- Collect sales tax/VAT from customers
- Remit to tax authorities
- Provide you with tax documents (1099-K for US vendors)

### 6.2 Required Legal Documents

**Must Have:**

1. **Privacy Policy**
   - How you collect and use data
   - Data storage and security
   - GDPR compliance (if applicable)
   - URL required in marketplace listing

2. **Terms of Service**
   - License grant
   - Usage restrictions
   - Limitation of liability
   - Termination clause

3. **End User License Agreement (EULA)**
   - Software license terms
   - Warranty disclaimers
   - Intellectual property rights

4. **Data Processing Agreement (DPA)**
   - Required for GDPR compliance
   - Customer data handling
   - Sub-processor disclosure (Supabase, OpenAI)

**Templates Available:**
- Atlassian provides templates for common documents
- Customize for your specific app
- Have legal counsel review if handling sensitive data

### 6.3 GDPR and Data Privacy

**Compliance Requirements:**

1. **Data Collection Notice:**
   - What data you collect (screenshots, user info)
   - Why you collect it (time tracking, AI analysis)
   - How long you keep it (based on tier)

2. **Right to Access:**
   - Users can request their data
   - Provide data export functionality

3. **Right to Erasure:**
   - Users can request data deletion
   - Implement account deletion feature

4. **Data Breach Notification:**
   - Notify users within 72 hours of breach
   - Have incident response plan

**GDPR Checklist:**
- [ ] Privacy policy published
- [ ] Cookie consent (if applicable)
- [ ] Data export functionality
- [ ] Data deletion functionality
- [ ] DPA available for customers
- [ ] Sub-processors listed
- [ ] Data encryption in transit and at rest
- [ ] Regular security audits

---

## 7. Free Trial Strategy

### 7.1 Free Trial Configuration

**Recommended Free Trial:**

```
Duration: 30 days
No Credit Card Required: YES (higher conversion rate)
Access Level: Full features of selected tier
Limitations: None during trial
Auto-Downgrade: To Free tier after trial ends
```

**Implementation in App:**

```javascript
// Check if organization is in trial period
async function isInTrialPeriod(organizationId) {
  const supabase = createSupabaseClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('created_at, subscription_status, trial_end_date')
    .eq('id', organizationId)
    .single();

  if (org.subscription_status === 'trial') {
    const trialEnd = new Date(org.trial_end_date);
    const now = new Date();
    return now < trialEnd;
  }

  return false;
}

// Grant trial access
async function startTrial(organizationId, tier) {
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days from now

  await supabase
    .from('organizations')
    .update({
      subscription_status: 'trial',
      subscription_tier: tier,
      trial_end_date: trialEndDate.toISOString()
    })
    .eq('id', organizationId);
}
```

### 7.2 Trial Conversion Tactics

**Email Sequence:**

**Day 1 (Welcome):**
```
Subject: Welcome to BRD Time Tracker! 🎉

Hi [Name],

Thank you for starting your 30-day trial of BRD Time Tracker Professional!

Here's how to get started:
1. Install the desktop app
2. Capture your first screenshot
3. View analytics in Jira

You have 30 days of full access. No credit card required.

Questions? Reply to this email!

Best,
BRD Time Tracker Team
```

**Day 7 (Check-in):**
```
Subject: How's your first week going?

Hi [Name],

You've been using BRD Time Tracker for a week. Here's what we've noticed:
- [X] screenshots captured
- [X] hours tracked
- [X] tasks auto-detected

23 days left in your trial. Need help getting more value?

[Schedule a demo call]

Best,
BRD Time Tracker Team
```

**Day 21 (Reminder):**
```
Subject: 9 days left in your trial

Hi [Name],

Your trial ends in 9 days. Don't lose access to:
✓ Unlimited screenshot tracking
✓ AI-powered work clustering
✓ Advanced analytics

[Upgrade now] and save 20% with code: TRIAL20

Best,
BRD Time Tracker Team
```

**Day 28 (Last Chance):**
```
Subject: Your trial ends in 2 days

Hi [Name],

Your trial ends on [Date]. After that, you'll be downgraded to the Free plan (limited to 3 users).

To keep full access:
[Upgrade to Professional] - $8/user/month

Questions before you decide? Let's talk: [Schedule call]

Best,
BRD Time Tracker Team
```

**Day 31 (Downgrade Notification):**
```
Subject: Your trial has ended

Hi [Name],

Your 30-day trial has ended. You've been moved to our Free plan.

Free plan includes:
- Up to 3 users
- 100 screenshots/month
- 7-day data retention

Want to upgrade? [View plans]

Thank you for trying BRD Time Tracker!

Best,
BRD Time Tracker Team
```

---

## 8. Revenue Optimization

### 8.1 Conversion Rate Optimization

**Key Metrics to Track:**

```javascript
// Track conversion funnel
const conversionFunnel = {
  marketplace_visits: 1000,        // People who view your app listing
  installs: 300,                   // 30% install rate
  trial_starts: 250,               // 83% start trial
  active_users: 150,               // 60% actively use
  paid_conversions: 30             // 20% convert to paid
};

// Overall conversion: 30 / 1000 = 3%
```

**Optimization Tactics:**

1. **Improve Listing:**
   - Professional screenshots
   - Demo video (2-3 minutes)
   - Customer testimonials
   - Clear value proposition

2. **Optimize Onboarding:**
   - Quick start guide
   - Interactive tutorial
   - Sample data pre-loaded
   - "Aha moment" within 5 minutes

3. **Feature Discovery:**
   - In-app tips and tooltips
   - Email drip campaign
   - Webinars and demos

4. **Pricing Psychology:**
   - Anchor pricing (show most expensive first)
   - Highlight most popular plan
   - Show annual savings (15% discount)

5. **Social Proof:**
   - Customer logos
   - Reviews and ratings
   - Case studies

### 8.2 Upselling Strategies

**In-App Upgrade Prompts:**

```javascript
// Show upgrade prompt when user hits limit
function checkQuotaAndPrompt(currentUsage, quota, tier) {
  if (quota !== -1 && currentUsage >= quota * 0.8) {
    // User is at 80% of quota
    showUpgradePrompt({
      message: `You've used ${currentUsage} of ${quota} screenshots this month. Upgrade to Professional for unlimited screenshots.`,
      cta: 'Upgrade Now',
      url: '/upgrade?plan=professional'
    });
  }
}

// Feature gating with upgrade CTA
function renderAdvancedFeature(license) {
  if (license.tier === 'free' || license.tier === 'starter') {
    return (
      <LockedFeature>
        <p>Work clustering is available in Professional and Enterprise plans.</p>
        <Button onClick={navigateToUpgrade}>Upgrade to Unlock</Button>
      </LockedFeature>
    );
  }

  return <AdvancedFeatureComponent />;
}
```

**Tier Upgrade Paths:**

```
Free → Starter:
- "You've maxed out 3 users. Add more team members with Starter plan."

Starter → Professional:
- "Unlock unlimited screenshots and work clustering."

Professional → Enterprise:
- "Get SSO, dedicated support, and 1-year retention."
```

### 8.3 Annual Billing Discount

**Incentivize Annual Commitments:**

```
Monthly Billing: $8/user/month = $96/user/year
Annual Billing: $6.80/user/month = $81.60/user/year (15% discount)

Customer Saves: $14.40 per user per year
You Get: More predictable revenue + lower churn
```

**Implementation:**

```javascript
// Pricing configuration
const pricing = {
  professional: {
    monthly: {
      pricePerUser: 8.00,
      billingInterval: 'month'
    },
    annual: {
      pricePerUser: 6.80,
      billingInterval: 'year',
      discount: '15%',
      savingsMessage: 'Save $14.40 per user per year'
    }
  }
};
```

---

## 9. Financial Reporting

### 9.1 Atlassian Marketplace Reports

**Available Reports:**

1. **Sales Report:**
   - Daily/monthly/yearly sales
   - Revenue by tier
   - New customers vs. renewals
   - Churned customers

2. **Transaction Report:**
   - Individual transactions
   - Refunds and chargebacks
   - Commission breakdown

3. **Payout Report:**
   - Payment history
   - Pending payouts
   - Bank transfer details

**Access Reports:**
- Developer Console → Reports
- Export to CSV for accounting

### 9.2 Revenue Tracking in Supabase

**Create Analytics Tables:**

```sql
-- Track subscription events
CREATE TABLE subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  event_type TEXT NOT NULL, -- 'trial_started', 'subscribed', 'upgraded', 'downgraded', 'cancelled'
  from_tier TEXT,
  to_tier TEXT,
  event_date TIMESTAMPTZ DEFAULT NOW(),
  revenue_impact DECIMAL(10,2), -- Monthly recurring revenue change
  metadata JSONB
);

-- Track monthly recurring revenue
CREATE TABLE mrr_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  total_mrr DECIMAL(10,2),
  tier_breakdown JSONB, -- { "starter": 500, "professional": 2000, "enterprise": 5000 }
  customer_count INTEGER,
  average_revenue_per_customer DECIMAL(10,2),
  churn_rate DECIMAL(5,2)
);
```

**Calculate MRR:**

```javascript
// Calculate Monthly Recurring Revenue
async function calculateMRR() {
  const supabase = createSupabaseClient();

  // Get all active subscriptions
  const { data: orgs } = await supabase
    .from('organizations')
    .select('subscription_tier, max_users, subscription_status')
    .eq('subscription_status', 'active');

  const pricing = {
    'starter': 5.00,
    'professional': 8.00,
    'enterprise': 12.00
  };

  let totalMRR = 0;
  const tierBreakdown = {};

  orgs.forEach(org => {
    const pricePerUser = pricing[org.subscription_tier] || 0;
    const orgMRR = pricePerUser * org.max_users * 0.75; // After 25% marketplace fee

    totalMRR += orgMRR;
    tierBreakdown[org.subscription_tier] = (tierBreakdown[org.subscription_tier] || 0) + orgMRR;
  });

  // Save snapshot
  await supabase.from('mrr_snapshots').insert({
    snapshot_date: new Date().toISOString().split('T')[0],
    total_mrr: totalMRR,
    tier_breakdown: tierBreakdown,
    customer_count: orgs.length,
    average_revenue_per_customer: totalMRR / orgs.length
  });

  return { totalMRR, tierBreakdown };
}
```

### 9.3 Key Financial Metrics

**Metrics to Monitor:**

1. **MRR (Monthly Recurring Revenue):**
   - Total predictable monthly revenue
   - Target: Grow 10-20% month-over-month

2. **ARR (Annual Recurring Revenue):**
   - MRR × 12
   - Key metric for SaaS valuation

3. **Customer Acquisition Cost (CAC):**
   - Total marketing + sales costs / New customers
   - Target: Recover CAC within 12 months

4. **Customer Lifetime Value (LTV):**
   - Average revenue per customer × Average customer lifetime
   - Target: LTV > 3× CAC

5. **Churn Rate:**
   - (Customers lost / Total customers) × 100
   - Target: < 5% monthly churn

6. **Net Revenue Retention:**
   - (Starting MRR + Upgrades - Downgrades - Churn) / Starting MRR × 100
   - Target: > 100% (means upgrades exceed churn)

---

## 10. Customer Billing Support

### 10.1 Handle Billing Inquiries

**Common Questions:**

**Q: How do I upgrade/downgrade my plan?**
A: Go to Jira → Apps → Manage Apps → BRD Time Tracker → Subscription → Change Plan

**Q: Will I be charged immediately?**
A: Yes, charges are prorated. If you upgrade mid-month, you pay the difference for remaining days.

**Q: Can I get a refund?**
A: Atlassian handles all refunds. Contact Atlassian Support within 30 days of purchase.

**Q: Do you offer annual billing?**
A: Yes! Annual billing saves 15%. Switch in subscription settings.

**Q: What happens when I cancel?**
A: You keep access until the end of your billing period, then downgrade to Free plan.

### 10.2 Refund Policy

**Atlassian Refund Policy:**
- 30-day money-back guarantee
- Atlassian processes all refunds
- You don't handle refund requests directly

**Your Role:**
- Help customers resolve issues before they request refund
- Provide excellent support to reduce refund requests
- Track refund reasons to improve product

### 10.3 Support Channels

**Set Up Support:**

1. **Email Support:**
   - support@yourcompany.com
   - Use help desk software (Freshdesk, Zendesk)
   - Response time SLA based on tier

2. **Documentation:**
   - Knowledge base
   - FAQs
   - Video tutorials

3. **Community Forum:**
   - Atlassian Community
   - Your own forum (Discourse, etc.)

4. **Premium Support (Enterprise):**
   - Dedicated Slack channel
   - Video call support
   - Custom onboarding

**Response Time SLAs:**

| Tier | Email Response | Resolution Time |
|------|----------------|-----------------|
| Free | 5 business days | Best effort |
| Starter | 2 business days | 5 business days |
| Professional | 24 hours | 3 business days |
| Enterprise | 4 hours | 1 business day |

---

## 11. Payment Setup Checklist

### Pre-Launch

- [ ] Register Atlassian Partner account
- [ ] Complete vendor profile
- [ ] Submit tax forms (W-9 or W-8BEN)
- [ ] Add bank account details
- [ ] Verify bank account
- [ ] Create privacy policy
- [ ] Create terms of service
- [ ] Create EULA
- [ ] Configure pricing tiers
- [ ] Set up free trial (30 days)
- [ ] Implement license validation in app
- [ ] Test subscription flows in sandbox
- [ ] Set up support email
- [ ] Create billing FAQ documentation

### Post-Launch

- [ ] Monitor first sales
- [ ] Verify first payout received
- [ ] Track conversion rates
- [ ] Analyze customer feedback
- [ ] Optimize pricing based on data
- [ ] Set up revenue tracking
- [ ] Calculate MRR and churn
- [ ] Implement upsell strategies
- [ ] Create customer success programs
- [ ] Plan annual pricing incentive

---

## 12. Financial Projections

### Conservative First Year

```
Month 1-3 (Launch):
- Customers: 5
- Average users per customer: 8
- Average tier: Starter ($5/user)
- MRR: $300 (5 × 8 × $5)
- After marketplace fee (75%): $225
- Monthly costs: $200
- Net: $25/month

Month 4-6:
- Customers: 15 (+10)
- MRR: $900
- After fees: $675
- Net: $475/month

Month 7-9:
- Customers: 30 (+15)
- MRR: $1,800
- After fees: $1,350
- Net: $1,050/month

Month 10-12:
- Customers: 50 (+20)
- MRR: $3,000
- After fees: $2,250
- Net: $1,950/month

Year 1 Total Net Revenue: ~$10,000
```

### Moderate First Year

```
Month 1-3:
- MRR: $500 → After fees: $375

Month 4-6:
- MRR: $1,500 → After fees: $1,125

Month 7-9:
- MRR: $3,000 → After fees: $2,250

Month 10-12:
- MRR: $5,000 → After fees: $3,750

Year 1 Total Net Revenue: ~$20,000
```

---

**Document End**

This payment setup guide provides everything needed to monetize BRD Time Tracker on the Atlassian Marketplace.

For questions or assistance, contact the technical team.
