# Email Provider Fallback Configuration Guide

## Overview
The enhanced NotifMe wrapper supports **multiple email providers with automatic failover**. If your primary email service fails, emails automatically route through backup providers.

## Quick Start

### Single Provider (Current Setup)
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=noreply@yourapp.com
EMAIL_FROM_NAME=JIRAForge
```

### Multiple Providers with Fallback (Recommended)
```env
# Comma-separated list - providers in any order when using priorities
EMAIL_PROVIDERS=sendgrid,mailgun,smtp

# Primary: SendGrid (priority 1 = highest priority)
SENDGRID_API_KEY=SG.your_sendgrid_key
SENDGRID_PRIORITY=1

# Fallback #1: Mailgun (priority 50 = medium priority)
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_PRIORITY=50

# Fallback #2: SMTP (priority 99 = lowest priority, last resort)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_SECURE=false
SMTP_PRIORITY=99

# Sender info (shared across all providers)
EMAIL_FROM=noreply@yourapp.com
EMAIL_FROM_NAME=JIRAForge

# Optional: Fallback strategy
EMAIL_MULTI_PROVIDER_STRATEGY=fallback  # fallback, roundrobin, or no-fallback
```

**Priority System:**
- **Lower number = Higher priority** (used first)
- Priority 1 = Primary provider
- Priority 50 = Secondary/fallback provider
- Priority 99 = Last resort provider
- If priority not set, uses array order in `EMAIL_PROVIDERS`

## Fallback Strategies

### 1. Fallback (Default - Recommended for Reliability)
```env
EMAIL_MULTI_PROVIDER_STRATEGY=fallback
```
- Tries providers in order until one succeeds
- Primary provider used first, then fallbacks
- **Use case**: Maximum reliability - if SendGrid is down, automatically use Mailgun

### 2. Round Robin (Load Balancing)
```env
EMAIL_MULTI_PROVIDER_STRATEGY=roundrobin
```
- Distributes emails evenly across all providers
- Reduces cost if one provider has usage limits
- **Use case**: High volume apps needing load distribution

### 3. No Fallback (Legacy Mode)
```env
EMAIL_MULTI_PROVIDER_STRATEGY=no-fallback
```
- Only uses first provider
- Fails if that provider fails
- **Use case**: Testing or single-provider preference

## Provider Configuration

### Priority System (Recommended Method)

notifme-sdk supports explicit **priority numbers** for each provider:
- **Lower number = Higher priority** (used first)
- This gives you exact control over fallback order

**Example:**
```env
# Configure multiple providers in any order
EMAIL_PROVIDERS=smtp,sendgrid,mailgun

# Set priorities explicitly (lower = higher priority)
SENDGRID_PRIORITY=1      # Primary (tried first)
MAILGUN_PRIORITY=50      # Fallback #1 (tried second)
SMTP_PRIORITY=99         # Fallback #2 (tried last)

# Add credentials for each
SENDGRID_API_KEY=...
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

**How it works:**
1. Tries SendGrid (priority 1)
2. If SendGrid fails → tries Mailgun (priority 50)
3. If Mailgun fails → tries SMTP (priority 99)
4. If all fail → email send fails

**Priority values:**
- `1-10`: Primary providers
- `11-50`: Secondary/fallback providers
- `51-99`: Last resort providers
- `100+`: Low priority (rarely used)

**Without priorities:** Provider order in `EMAIL_PROVIDERS` determines priority (first = highest)

### SendGrid
```env
SENDGRID_API_KEY=SG.your_api_key_here
```
**Get API Key**: https://app.sendgrid.com/settings/api_keys

### Mailgun
```env
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=mg.yourdomain.com
```
**Get API Key**: https://app.mailgun.com/app/account/security/api_keys

### SMTP (Gmail, Office365, Custom)

**Gmail Example:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password  # Use App Password, NOT regular password
SMTP_SECURE=false
```

**Office365 Example:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your_email@company.com
SMTP_PASSWORD=your_password
SMTP_SECURE=false
```

**Custom SMTP Server:**
```env
SMTP_HOST=mail.yourserver.com
SMTP_PORT=465
SMTP_USER=smtp_username
SMTP_PASSWORD=smtp_password
SMTP_SECURE=true  # Use SSL/TLS
```

### AWS SES
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1  # or AWS_SES_REGION
```
**Setup**: https://console.aws.amazon.com/ses/

### SparkPost
```env
SPARKPOST_API_KEY=your_sparkpost_api_key
```
**Get API Key**: https://app.sparkpost.com/account/api-keys

## How Failover Works

### Example Scenario (With Priority)
```env
EMAIL_PROVIDERS=sendgrid,mailgun,smtp
EMAIL_MULTI_PROVIDER_STRATEGY=fallback

# Explicit priorities
SENDGRID_PRIORITY=1
MAILGUN_PRIORITY=50
SMTP_PRIORITY=99
```

**Flow:**
1. ❌ SendGrid fails (priority 1) → Try next
2. ✅ Mailgun succeeds (priority 50) → **Email delivered!**
3. ⏭️ SMTP (priority 99) → Not tried (Mailgun succeeded)

**Result**: Email delivered via Mailgun

### Example Scenario (Array Order Fallback)
```env
# First provider = highest priority, last = lowest
EMAIL_PROVIDERS=sendgrid,mailgun,smtp
```

**Flow:**
1. Attempt to send via **SendGrid** (first in list)
   - ✅ Success → Done
   - ❌ Failure → Try next provider

2. Attempt to send via **Mailgun**
   - ✅ Success → Done
   - ❌ Failure → Try next provider

3. Attempt to send via **SMTP**
   - ✅ Success → Done
   - ❌ Failure → Email send failed (all providers exhausted)

**Result**: Email gets delivered even if 1-2 providers are down!

## Migration from Current Setup

### Option 1: Keep Using Current Wrapper (No Changes)
Your current wrapper supports **one provider at a time**. No changes needed.

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_key
```

### Option 2: Switch to Enhanced Wrapper (Fallback Support)

**Step 1**: Update the import in services that use the wrapper

**Current:**
```javascript
const notifmeWrapper = require('./notifme-wrapper');
```

**Enhanced:**
```javascript
const notifmeWrapper = require('./notifme-wrapper-enhanced');
```

**Step 2**: Update `.env` to use multiple providers
```env
# Change from single provider
# EMAIL_PROVIDER=sendgrid

# To multiple providers
EMAIL_PROVIDERS=sendgrid,mailgun
```

**Step 3**: Add credentials for fallback providers
```env
MAILGUN_API_KEY=your_mailgun_key
MAILGUN_DOMAIN=mg.yourdomain.com
```

**That's it!** The API remains the same:
```javascript
await notifmeWrapper.send({
    to: 'user@example.com',
    subject: 'Test',
    text: 'Hello world'
});
// Automatically uses fallback if SendGrid fails
```

## Cost Optimization

### Free Tier Maximization
Use free tiers from multiple providers before paying:

```env
# Use all free tiers in rotation
EMAIL_PROVIDERS=sendgrid,mailgun,sparkpost
EMAIL_MULTI_PROVIDER_STRATEGY=roundrobin

# SendGrid: 100 emails/day free
SENDGRID_API_KEY=...

# Mailgun: 100 emails/day free
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...

# SparkPost: 500 emails/month free
SPARKPOST_API_KEY=...
```

With round-robin, you can send **~200 emails/day** using only free tiers!

## Monitoring & Debugging

### Check Configured Providers
```javascript
const status = notifmeWrapper.getStatus();
console.log(status);
// {
//   initialized: true,
//   providers: ['sendgrid', 'mailgun', 'smtp'],
//   multiProviderStrategy: 'fallback',
//   fromEmail: 'noreply@yourapp.com'
// }
```

### Logs
The enhanced wrapper logs which provider was used:
```
[NotifMe] Initialized with 3 providers (fallback chain): sendgrid -> mailgun -> smtp
[NotifMe] Email sent to user@example.com via mailgun
```

If SendGrid failed but Mailgun succeeded, you'll see:
```
[NotifMe] Provider sendgrid failed, trying next...
[NotifMe] Email sent to user@example.com via mailgun
```

## Testing Failover

### 1. Test with Invalid Primary
```env
EMAIL_PROVIDERS=sendgrid,smtp
SENDGRID_API_KEY=invalid_key_for_testing  # Intentionally invalid
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=working_email@gmail.com
SMTP_PASSWORD=working_app_password
```

**Result**: SendGrid fails → Automatically falls back to SMTP ✅

### 2. Test with All Invalid
```env
EMAIL_PROVIDERS=sendgrid,mailgun
SENDGRID_API_KEY=invalid
MAILGUN_API_KEY=invalid
```

**Result**: Both fail → Email send fails (expected) ❌

## Recommended Configurations

### Priority vs Array Order

**❌ Array Order Method (less explicit):**
```env
EMAIL_PROVIDERS=sendgrid,mailgun,smtp
# Provider order determines priority
# sendgrid = tried first, smtp = tried last
```

**✅ Priority Method (explicit, recommended):**
```env
EMAIL_PROVIDERS=sendgrid,mailgun,smtp

# Explicit priorities - clear and maintainable
SENDGRID_PRIORITY=1
MAILGUN_PRIORITY=50
SMTP_PRIORITY=99
```

**Why use priorities?**
- ✅ More explicit and readable
- ✅ Easy to reorder without changing `EMAIL_PROVIDERS` string
- ✅ Can add/remove providers without breaking priority order
- ✅ Self-documenting (you see the priority in the config)

### Development
```env
# Single SMTP for simplicity
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.mailtrap.io  # Or other test SMTP
SMTP_PORT=2525
SMTP_USER=...
SMTP_PASSWORD=...
```

### Production (High Reliability)
```env
# Primary + backup for 99.9% uptime
EMAIL_PROVIDERS=sendgrid,mailgun
EMAIL_MULTI_PROVIDER_STRATEGY=fallback

# Explicit priorities
SENDGRID_PRIORITY=1       # Primary
MAILGUN_PRIORITY=50       # Fallback

SENDGRID_API_KEY=...
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...
```

### Production (High Volume + Cost Optimization)
```env
# Distribute load across providers
EMAIL_PROVIDERS=sendgrid,mailgun,ses
EMAIL_MULTI_PROVIDER_STRATEGY=roundrobin

# Equal priorities for even distribution
SENDGRID_PRIORITY=10
MAILGUN_PRIORITY=10
SES_PRIORITY=10

SENDGRID_API_KEY=...
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Production (Critical Emails - 3-Tier Fallback)
```env
# Maximum reliability with 3 fallback layers
EMAIL_PROVIDERS=sendgrid,mailgun,ses,smtp
EMAIL_MULTI_PROVIDER_STRATEGY=fallback

# Priority tiers
SENDGRID_PRIORITY=1       # Tier 1: Premium service
MAILGUN_PRIORITY=25       # Tier 2: Backup premium
SES_PRIORITY=50           # Tier 3: AWS infrastructure
SMTP_PRIORITY=99          # Tier 4: Direct SMTP fallback

# All credentials configured
SENDGRID_API_KEY=...
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

## FAQ

**Q: Do I need to change my code to use fallback?**  
A: No! Just change environment variables. The API is identical.

**Q: What happens if credentials are missing for a provider?**  
A: That provider is skipped with a warning. Other providers still work.

**Q: Can I use the same provider multiple times?**  
A: Not recommended, but technically possible with different credentials.

**Q: Which strategy should I use?**  
A: Use **`fallback`** for reliability (recommended), **`roundrobin`** for load distribution.

**Q: How do I know which provider was used?**  
A: Check logs or the return value: `result.provider`

**Q: What if all providers fail?**  
A: The send operation fails and returns `{ success: false, error: '...' }`

**Q: How do priority numbers work?**  
A: Lower number = higher priority. Priority 1 is tried first, then priority 50, then priority 99. If you don't set priorities, array order in `EMAIL_PROVIDERS` is used.

**Q: Can two providers have the same priority?**  
A: Yes! With the same priority, providers are tried in array order. Useful for `roundrobin` strategy.

**Q: What happens if I don't set any priorities?**  
A: Providers are used in the order listed in `EMAIL_PROVIDERS`. First = highest priority, last = lowest.

**Q: Which is better: priorities or array order?**  
A: Priorities are more explicit and maintainable, especially with 3+ providers. Array order works fine for simple 2-provider setups.

**Q: Is this compatible with the existing wrapper?**  
A: Yes! The enhanced wrapper is a drop-in replacement with added features.
