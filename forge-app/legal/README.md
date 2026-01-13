# Legal Documents - BRD Time Tracker

This folder contains the legal documents required for Atlassian Marketplace listing.

## Files

| File | Purpose |
|------|---------|
| `PRIVACY_POLICY.md` | Privacy Policy for the BRD Time Tracker app |
| `TERMS_OF_SERVICE.md` | Terms of Service for the BRD Time Tracker app |

## Before Publishing

### 1. Update Placeholders

Replace these placeholders in both documents:

| Placeholder | Replace With |
|-------------|--------------|
| `[INSERT DATE]` | Today's date (e.g., January 13, 2026) |
| `[SPECIFY YOUR REGION]` | Your Supabase region (e.g., "US East (N. Virginia)") |
| `[YOUR JURISDICTION]` | Your legal jurisdiction (e.g., "State of Florida, USA") |

### 2. Verify Email Addresses

Ensure these email addresses exist:
- `privacy@amzur.com`
- `support@amzur.com`
- `legal@amzur.com`
- `sales@amzur.com`

### 3. Host on Your Website

Upload these documents to your website:

```
https://amzur.com/products/time-tracker/privacy-policy
https://amzur.com/products/time-tracker/terms-of-service
```

Or use a subdomain:
```
https://time-tracker.amzur.com/privacy
https://time-tracker.amzur.com/terms
```

### 4. Add URLs to Developer Console

Go to: https://developer.atlassian.com/console/myapps/c8bab1dc-ae32-4e6f-9dbd-eb242cc6c14a/manage/distribution

Enter your hosted URLs in the appropriate fields.

### 5. Update Desktop App

Update the consent page in `python-desktop-app/desktop_app.py` line 5074:

```python
# Change from:
<a href="#" onclick="alert('Privacy policy will be available...')">

# To:
<a href="https://amzur.com/products/time-tracker/privacy-policy" target="_blank">
```

Also update line 5050 to match actual retention:
```python
# Change from:
<span>Screenshots are retained for 90 days, then automatically deleted</span>

# To:
<span>Screenshots are retained for 2 months, then automatically deleted</span>
```

## Converting to HTML

To host these on your website, you can convert Markdown to HTML using:

1. **Online converters**: https://markdowntohtml.com/
2. **VS Code extensions**: Markdown Preview Enhanced
3. **Command line**: `pandoc PRIVACY_POLICY.md -o privacy-policy.html`

## Legal Review

**IMPORTANT**: These documents are templates based on your application's code and data flows. We recommend having a legal professional review them before publishing.

## Questions?

For questions about these documents or Marketplace compliance:
- Atlassian Developer Community: https://community.developer.atlassian.com/
- Atlassian Marketplace Support: https://developer.atlassian.com/platform/marketplace/
