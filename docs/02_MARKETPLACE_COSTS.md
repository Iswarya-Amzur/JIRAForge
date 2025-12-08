# Upfront Costs for Atlassian Marketplace App

**Document Version:** 1.0
**Date:** December 5, 2025
**Author:** Technical Team
**Purpose:** Cost analysis for listing BRD Time Tracker on Atlassian Marketplace

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Marketplace Listing Costs](#marketplace-listing-costs)
3. [Infrastructure Costs](#infrastructure-costs)
4. [Development & Compliance Costs](#development--compliance-costs)
5. [Operational Costs](#operational-costs)
6. [Revenue Model & Pricing Strategy](#revenue-model--pricing-strategy)
7. [Cost Projections](#cost-projections)
8. [Break-Even Analysis](#break-even-analysis)

---

## 1. Executive Summary

### Total Upfront Investment Required: $5,000 - $8,000

**One-Time Costs:** $2,500 - $4,000
**First Year Recurring Costs:** $2,500 - $4,000

### Key Cost Categories:
- Atlassian Marketplace listing and compliance: $500 - $1,000
- Infrastructure setup and hosting: $1,500 - $2,500
- Security audits and compliance: $500 - $1,500
- First year operational costs: $2,500 - $4,000

---

## 2. Marketplace Listing Costs

### 2.1 Atlassian Vendor Registration

**Cost: $0 (FREE)**

- Creating an Atlassian Partner account is free
- No upfront fee to register as a vendor
- Access to Atlassian Developer Console

**Requirements:**
- Valid business email
- Company/individual details
- Bank account for payments

### 2.2 App Review & Security Assessment

**Cost: $0 - $500**

**Free Tier:**
- Atlassian provides free app review for Cloud apps
- Basic security scanning included

**Optional Paid Security Review:**
- Third-party security audit: $500 - $1,000
- Penetration testing: $500 - $1,500
- Recommended for enterprise customers

### 2.3 Marketplace Commission

**Cost: Revenue Share (No Upfront Cost)**

Atlassian takes a **25% commission** on all sales:
- First $10,000/month: 25% commission
- $10,001 - $100,000/month: 25% commission
- Above $100,000/month: 15% commission (tiered pricing)

**Example:**
- If you charge $10/month per user
- Customer has 10 users = $100/month
- Atlassian takes $25, you receive $75

### 2.4 Marketing & Assets

**Cost: $500 - $1,500**

**Required Marketing Materials:**
- Professional app icon/logo: $100 - $300
- Demo video production: $200 - $500
- Screenshot editing and graphics: $50 - $100
- Product description copywriting: $150 - $300
- Privacy policy and terms of service: $0 - $300 (can use templates)

**Optional:**
- Marketplace advertising: $500+/month
- SEO optimization: $200 - $500

---

## 3. Infrastructure Costs

### 3.1 Supabase (Database & Storage)

**Development Environment:**
- **Free Tier:** $0/month
  - 500 MB database space
  - 1 GB file storage
  - 2 GB bandwidth
  - Sufficient for initial development and testing

**Production Environment:**
- **Pro Plan:** $25/month ($300/year)
  - 8 GB database space
  - 100 GB file storage
  - 250 GB bandwidth
  - Daily backups
  - Point-in-time recovery
  - Email support

**Scaling:**
- Additional storage: $0.125/GB/month
- Additional bandwidth: $0.09/GB

**Estimated First Year:** $300 - $600 (depending on usage)

### 3.2 AI Server Hosting

**Option 1: AWS EC2 (Recommended)**

**Development:**
- t3.micro instance: $8/month ($96/year)
  - 1 vCPU, 1 GB RAM
  - Sufficient for testing

**Production:**
- t3.small instance: $17/month ($204/year)
  - 2 vCPU, 2 GB RAM
  - Good for 10-50 users
- Elastic IP: $3.60/month ($43/year)
- EBS Storage (30 GB): $3/month ($36/year)

**Total AWS First Year:** $283/year

**Option 2: DigitalOcean Droplet**

- Basic Droplet: $12/month ($144/year)
  - 2 vCPU, 2 GB RAM, 50 GB SSD
- Load balancer (optional): $12/month ($144/year)

**Total DigitalOcean First Year:** $144 - $288/year

**Option 3: Render.com (Easiest)**

- Standard Plan: $25/month ($300/year)
  - Auto-scaling
  - Zero-config deployments
  - Built-in SSL

**Total Render First Year:** $300/year

### 3.3 OpenAI API Costs

**GPT-4 Vision API Pricing:**
- Input: $10 per 1M tokens (~750,000 words)
- Output: $30 per 1M tokens

**Estimated Usage:**
- Average screenshot analysis: ~2,000 input tokens + 500 output tokens
- Cost per analysis: $0.035
- 100 screenshots/day = $3.50/day = $105/month
- 1,000 screenshots/day = $35/day = $1,050/month

**Cost Optimization:**
- Use GPT-4 Turbo (cheaper): $10 input / $30 output per 1M tokens
- Cache common prompts: 50% cost reduction
- Batch processing: Reduce API overhead

**Estimated First Year (100-500 screenshots/day):** $1,200 - $3,600/year

### 3.4 Domain & SSL

**Domain Name:**
- Custom domain: $10 - $15/year
- .com, .app, or .io extension

**SSL Certificate:**
- Free (Let's Encrypt): $0
- Or included with hosting provider

**Total:** $10 - $15/year

### 3.5 Total Infrastructure First Year

**Conservative Estimate (100 users):**
- Supabase Pro: $300/year
- AWS EC2 Production: $283/year
- OpenAI API: $1,200/year
- Domain: $12/year
- **Total: $1,795/year** (~$150/month)

**Moderate Estimate (500 users):**
- Supabase Pro + scaling: $600/year
- AWS EC2 scaled: $500/year
- OpenAI API: $3,600/year
- Domain: $12/year
- **Total: $4,712/year** (~$393/month)

---

## 4. Development & Compliance Costs

### 4.1 Security & Compliance

**Required:**
- GDPR compliance documentation: $0 - $500 (templates available)
- Privacy policy legal review: $200 - $500
- Terms of service legal review: $200 - $500

**Recommended:**
- Security audit: $500 - $1,500
- Penetration testing: $500 - $1,500
- SOC 2 compliance (for enterprise): $15,000 - $50,000 (not needed initially)

**Estimated First Year:** $900 - $2,500

### 4.2 Atlassian App Approval

**Cost: $0 (Time Investment)**

**Requirements:**
- Security self-assessment questionnaire
- Data handling disclosure
- Privacy policy
- Support documentation
- Demo video

**Timeline:**
- Submission to approval: 1-2 weeks
- No direct cost, but requires development time

### 4.3 Bug Fixes & Updates

**Cost: Internal Development Time**

**Recommended Budget:**
- Minor updates: 20 hours/month
- Major feature releases: 40-80 hours/quarter
- Bug fixes: 10-15 hours/month

If outsourced:
- Developer rate: $50 - $100/hour
- Estimated: $1,500 - $3,000/month

---

## 5. Operational Costs

### 5.1 Customer Support

**Tools:**
- Email support: $0 (use business email)
- Help desk (Freshdesk/Zendesk): $15 - $49/month per agent
- Community forum (free): $0

**Estimated:** $0 - $50/month initially

### 5.2 Monitoring & Logging

**Tools:**
- Supabase logs: Included in Pro plan
- Application monitoring (Sentry): $26/month
- Uptime monitoring (UptimeRobot): $0 (free tier)
- Error tracking: $0 - $26/month

**Estimated:** $0 - $26/month

### 5.3 Backup & Disaster Recovery

**Included in Hosting:**
- Supabase daily backups: Included
- AWS automated snapshots: $2 - $5/month

**Estimated:** $2 - $5/month

### 5.4 Total Operational Costs

**First Year:** $200 - $1,000

---

## 6. Revenue Model & Pricing Strategy

### 6.1 Recommended Pricing Tiers

**Free Tier (Lead Generation):**
- Up to 3 users
- 100 screenshots/month
- Basic time tracking
- 7-day data retention

**Starter Plan: $5/user/month**
- Up to 10 users
- 1,000 screenshots/month
- Advanced analytics
- 30-day data retention
- Email support

**Professional Plan: $8/user/month**
- Up to 50 users
- Unlimited screenshots
- AI-powered work clustering
- 90-day data retention
- Priority support
- Custom reports

**Enterprise Plan: $12/user/month**
- Unlimited users
- Unlimited screenshots
- 1-year data retention
- Dedicated support
- SSO integration
- SLA guarantee
- Custom integrations

### 6.2 Competitive Analysis

**Similar Apps on Marketplace:**

| App | Pricing | Features |
|-----|---------|----------|
| Tempo Timesheets | $5-10/user/month | Manual time entry |
| Clockify for Jira | $4.99-11.99/user/month | Manual tracking |
| Everhour | $8.50/user/month | Manual + automatic |

**BRD Time Tracker Differentiation:**
- Fully automated screenshot-based tracking
- AI-powered task detection
- No manual time entry required
- Competitive pricing: $5-12/user/month

### 6.3 Revenue Projections

**Scenario 1: Conservative (First Year)**
- 20 customers
- Average 10 users each = 200 users
- Average plan: $6/user/month
- Gross revenue: $1,200/month = $14,400/year
- After 25% marketplace fee: $10,800/year

**Scenario 2: Moderate (First Year)**
- 50 customers
- Average 8 users each = 400 users
- Average plan: $7/user/month
- Gross revenue: $2,800/month = $33,600/year
- After 25% marketplace fee: $25,200/year

**Scenario 3: Optimistic (First Year)**
- 100 customers
- Average 10 users each = 1,000 users
- Average plan: $8/user/month
- Gross revenue: $8,000/month = $96,000/year
- After 25% marketplace fee: $72,000/year

---

## 7. Cost Projections

### 7.1 First Year Cost Summary

| Category | Low Estimate | High Estimate |
|----------|--------------|---------------|
| **ONE-TIME COSTS** | | |
| Marketing assets | $500 | $1,500 |
| Security audit | $500 | $1,500 |
| Legal/compliance | $400 | $1,000 |
| **Subtotal One-Time** | **$1,400** | **$4,000** |
| | | |
| **RECURRING COSTS (Year 1)** | | |
| Infrastructure | $1,795 | $4,712 |
| Monitoring & support | $200 | $1,000 |
| Development/maintenance | $0 | $3,000 |
| **Subtotal Recurring** | **$1,995** | **$8,712** |
| | | |
| **TOTAL FIRST YEAR** | **$3,395** | **$12,712** |

### 7.2 Monthly Recurring Costs (After Launch)

**Low Volume (100 users):**
- Infrastructure: $150/month
- Support & monitoring: $20/month
- **Total: $170/month**

**Medium Volume (400 users):**
- Infrastructure: $300/month
- Support & monitoring: $50/month
- **Total: $350/month**

**High Volume (1,000 users):**
- Infrastructure: $600/month
- Support & monitoring: $100/month
- **Total: $700/month**

---

## 8. Break-Even Analysis

### 8.1 Break-Even Point Calculation

**Assumptions:**
- Average revenue per user: $6/month (after 25% marketplace fee)
- Monthly recurring costs: $170 (low volume) to $350 (medium volume)

**Break-Even Users:**
- Low volume: 170 ÷ 6 = **29 users** to break even monthly
- Medium volume: 350 ÷ 6 = **59 users** to break even monthly

**Break-Even Timeline:**

**Conservative Scenario (20 customers, 200 users):**
- Monthly net revenue: $1,200 - $250 = $950
- One-time costs: $3,000
- Break even in: 3,000 ÷ 950 = **3-4 months**

**Moderate Scenario (50 customers, 400 users):**
- Monthly net revenue: $2,800 - $350 = $2,450
- One-time costs: $4,000
- Break even in: 4,000 ÷ 2,450 = **2 months**

### 8.2 ROI Projections

**Year 1:**
- Total investment: $3,400 - $12,700
- Conservative revenue: $10,800 (net after fees)
- Moderate revenue: $25,200 (net after fees)
- ROI: -$2,500 to +$21,800 (depends on adoption)

**Year 2 (Projected):**
- Recurring costs only: $2,000 - $10,000
- 2x customer growth: $21,600 - $50,400 revenue
- Profit: $11,600 - $40,400

**Year 3 (Projected):**
- 3x original customers: $32,400 - $75,600 revenue
- Profit: $22,400 - $65,600

---

## 9. Cost Optimization Strategies

### 9.1 Reduce Infrastructure Costs

1. **Use Free Tiers Initially:**
   - Start with Supabase free tier
   - Use AWS free tier (12 months)
   - Total savings: $500/year

2. **Optimize AI Costs:**
   - Cache common analysis results
   - Batch API requests
   - Use GPT-4 Turbo instead of GPT-4
   - Potential savings: 30-50% ($400-600/year)

3. **Reserved Instances:**
   - AWS 1-year reserved instance: 40% discount
   - Savings: $120/year

### 9.2 Leverage Free Tools

1. **Development & Testing:**
   - GitHub Actions (CI/CD): Free for public repos
   - Postman (API testing): Free tier
   - Figma (design): Free tier

2. **Monitoring:**
   - UptimeRobot: Free for 50 monitors
   - Google Analytics: Free
   - Supabase logs: Included

3. **Customer Support:**
   - Email: Free
   - Discord community: Free
   - Documentation: GitHub Pages (free)

**Total Potential Savings: $1,000 - $2,000/year**

---

## 10. Funding Recommendations

### 10.1 Minimum Viable Budget

**Essential Costs Only: $2,000**
- Marketing assets: $500
- Legal templates: $200
- Infrastructure (first 6 months): $900
- Domain: $12
- Buffer: $388

### 10.2 Recommended Budget

**Comfortable Launch: $5,000**
- Marketing & assets: $1,000
- Security audit: $1,000
- Legal compliance: $500
- Infrastructure (first year): $2,000
- Buffer & contingency: $500

### 10.3 Optimal Budget

**Professional Launch: $10,000**
- Marketing & assets: $2,000
- Security & compliance: $2,500
- Infrastructure (first year): $3,000
- Development support: $2,000
- Buffer & contingency: $500

---

## 11. Key Takeaways

### Upfront Investment Needed:

**Minimum:** $2,000 (bootstrap approach)
**Recommended:** $5,000 (professional launch)
**Optimal:** $10,000 (enterprise-ready)

### Monthly Costs After Launch:

**Low volume (0-100 users):** $170/month
**Medium volume (100-500 users):** $350/month
**High volume (500+ users):** $600-700/month

### Break-Even Point:

- **29-59 paid users** to break even on monthly costs
- **3-4 months** to recover one-time investment (conservative scenario)
- **2 months** with moderate adoption

### Risk Mitigation:

1. Start with free tiers to minimize initial costs
2. Use AWS free tier for first 12 months
3. Launch with minimal marketing budget
4. Scale infrastructure as revenue grows
5. Outsource development only when profitable

---

## 12. Next Steps

1. **Secure Initial Funding:** $3,000 - $5,000 for launch
2. **Set Up Infrastructure:** Use free tiers initially
3. **Complete Compliance:** Privacy policy, terms of service
4. **Create Marketing Assets:** Logo, demo video, screenshots
5. **Submit to Marketplace:** Complete security questionnaire
6. **Launch Beta:** Free tier to gather feedback
7. **Monitor Costs:** Track actual vs. projected expenses
8. **Scale Gradually:** Upgrade infrastructure as revenue increases

---

**Document End**

For questions or clarifications, please contact the technical team.
