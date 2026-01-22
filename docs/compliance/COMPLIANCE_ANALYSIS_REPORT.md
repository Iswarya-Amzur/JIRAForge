# Time Tracker - Compliance Analysis Report

## Executive Summary

Your application is a **Forge app with data egress** that captures employee screenshots, stores them in Supabase (external storage), and sends them to OpenAI for AI analysis. This architecture triggers **multiple compliance requirements** that need attention before Marketplace submission.

---

## CRITICAL ISSUES (Must Fix)

### 1. **Missing App Uninstall/Lifecycle Handler**
**Violation**: [Atlassian Data Privacy Guidelines](https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/)

Your app has **no lifecycle event handler** to delete user data when the app is uninstalled. Atlassian requires:
> "When an app is uninstalled, or user consent is revoked, the app should erase personal data that is no longer needed."

**Current State**: No `app:uninstalled` handler found in your Forge app or Supabase.

**Required Action**: Implement a Forge lifecycle event to:
- Delete all user screenshots from Supabase Storage
- Delete all analysis results
- Delete user records from your database
- Provide a 30-day grace period (optional but recommended)

---

### 2. **Missing User Consent for Screenshot Capture**
**Violation**: [GDPR Employee Monitoring Requirements](https://gdprlocal.com/gdpr-employee-monitoring/)

Your desktop app captures screenshots **without explicit consent UI**. Under GDPR:
> "Consent may not be embedded in a privacy policy. Instead, it must be collected from the user directly."

**Current State**: The desktop app starts capturing after OAuth login without a consent prompt.

**Required Action**:
- Add an explicit consent screen before first screenshot capture
- Explain what data is collected (screenshots, window titles, app names)
- Explain how long data is retained
- Provide easy opt-out mechanism
- Consider adding screenshot blur/redaction options

---

### 3. **Missing Privacy Policy URL**
**Violation**: [Atlassian Marketplace Requirements](https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/)

> "If you are listing your app on the Marketplace, you are required to include a URL for your privacy policy."

**Current State**: No privacy policy found in your codebase or manifest.

**Required Action**: Create a privacy policy that includes:
- What data you collect (screenshots, window titles, Jira data, user info)
- How you use the data (AI analysis via OpenAI)
- Where data is stored (Supabase - specify region)
- Data retention periods
- How users can request data deletion
- Third-party data sharing (OpenAI)

---

### 4. **External Data Storage Without Encryption Disclosure**
**Violation**: [Security Requirements for Cloud Apps](https://developer.atlassian.com/platform/marketplace/security-requirements/)

> "At a minimum, developers must enable full disk encryption (FDE) on servers to ensure at-rest encryption for End User Data stored outside of the Atlassian product."

**Current State**: Your app uses Supabase for storage but doesn't document encryption status.

**Required Action**:
- Verify Supabase has at-rest encryption enabled (AES-256)
- Document this in your security questionnaire
- Consider enabling Supabase's additional encryption features

---

### 5. **OpenAI Data Sharing Without Proper Disclosure**
**Violation**: [Data Privacy Guidelines](https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/)

Your app sends **full screenshots** and **Jira issue data** to OpenAI for analysis. This constitutes data egress to a third party.

> "In addition to egressing data for processing, OpenAI may retain API data for 30 days."

**Current State**: No disclosure to users that their screenshots are sent to OpenAI.

**Required Action**:
- Disclose OpenAI data processing in privacy policy
- Consider using [Forge LLMs API](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api/) instead (would qualify for "Runs on Atlassian" badge)
- Add OpenAI's data retention policy to your disclosures

---

## HIGH PRIORITY ISSUES

### 6. **No "Runs on Atlassian" Badge Eligibility**
Your app uses external services (Supabase, OpenAI), so it **cannot** qualify for the "Runs on Atlassian" badge, which means:
- Customers with strict data residency requirements may reject your app
- You must complete additional security questionnaires
- More scrutiny during app review

**Alternatives**:
- Use Forge Storage instead of Supabase for data at rest
- Use Forge LLMs API instead of OpenAI
- Use Forge SQL for database needs

---

### 7. **Soft Delete Only - No Hard Delete**
**File**: `forge-app/src/services/screenshotService.js:158-169`

```javascript
// Soft delete: Update deleted_at timestamp
// Optionally delete from storage (commented out for now to allow recovery)
```

**Issue**: Screenshots are never permanently deleted, which may violate GDPR "right to erasure."

**Required Action**: Implement hard delete functionality with configurable retention period.

---

### 8. **Missing Data Residency Documentation**
**Violation**: [Data Residency Requirements](https://support.atlassian.com/security-and-access-policies/docs/understand-data-residency/)

Supabase stores data in specific AWS regions. EU customers may require data to remain in EU.

**Required Action**:
- Document which Supabase region you use
- Consider offering EU region for EU customers
- Add data residency information to Marketplace listing

---

### 9. **OAuth Tokens Stored in Temp Files**
**File**: `python-desktop-app/desktop_app.py:84`

```python
self.store_path = store_path or os.path.join(tempfile.gettempdir(), 'brd_tracker_auth.json')
```

**Security Concern**: OAuth tokens stored in plaintext in temp directory.

**Required Action**:
- Use OS-native secure credential storage (Windows Credential Manager, macOS Keychain)
- Encrypt tokens at rest if file storage is required

---

### 10. **Missing DPIA (Data Protection Impact Assessment)**
**Violation**: [GDPR Article 35](https://gdprlocal.com/gdpr-employee-monitoring/)

> "If automated decision making is conducted without human involvement, it may be subject to additional requirements under Article 22 of the GDPR."

Your app uses AI to automatically classify work and assign time to Jira issues.

**Required Action**: Conduct and document a DPIA for your AI-based classification system.

---

## MEDIUM PRIORITY ISSUES

### 11. **API Keys Should Rotate Every 90 Days**
**Violation**: [Shared Responsibility Model](https://developer.atlassian.com/platform/forge/shared-responsibility-model/)

> "API keys should be rotated at least every 90 days."

**Required Action**: Implement key rotation procedures for:
- Supabase Service Role Key
- OpenAI API Key
- AI Server API Key

---

### 12. **Missing Egress Domain Declaration**
**File**: `manifest.yml:46-51`

Your manifest declares `*.supabase.co` but doesn't declare OpenAI domains.

```yaml
external:
  fetch:
    backend:
      - address: "*.supabase.co"
```

**Required Action**: Add OpenAI domain to manifest permissions:
```yaml
- address: "api.openai.com"
```

---

### 13. **Screenshots Stored as Public in Supabase**
Based on the storage bucket configuration, screenshots may be publicly accessible.

**Required Action**: Ensure screenshots bucket is private and use signed URLs (which you already do - verify configuration).

---

### 14. **No Data Export Functionality**
**Violation**: GDPR Right to Data Portability (Article 20)

Users cannot export their own data.

**Required Action**: Add a "Download my data" feature in the Forge app.

---

## MARKETPLACE SUBMISSION CHECKLIST

Before submitting to Atlassian Marketplace, ensure:

| Requirement | Status |
|------------|--------|
| Privacy Policy URL | Missing |
| Security Questionnaire | Not completed |
| Privacy & Security Tab answers | Not completed |
| EULA/Terms of Service | Missing |
| Data deletion on uninstall | Not implemented |
| User consent mechanism | Not implemented |
| Egress domains declared | Partial (missing OpenAI) |
| At-rest encryption verified | Needs documentation |
| DPIA completed | Not done |

---

## Key Sources

- [Security Requirements for Cloud Apps](https://developer.atlassian.com/platform/marketplace/security-requirements/)
- [Data Privacy Guidelines for Developers](https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/)
- [Forge Shared Responsibility Model](https://developer.atlassian.com/platform/forge/shared-responsibility-model/)
- [Atlassian Developer Terms](https://developer.atlassian.com/platform/marketplace/atlassian-developer-terms/)
- [Runtime Egress Permissions](https://developer.atlassian.com/platform/forge/runtime-egress-permissions/)
- [Privacy & Security Tab Requirements](https://developer.atlassian.com/platform/marketplace/security-privacy-tab/)
- [GDPR Employee Monitoring Compliance](https://gdprlocal.com/gdpr-employee-monitoring/)
- [Forge LLMs API](https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api/) (Alternative to OpenAI)

---

## Summary

Your BRD Time Tracker has **5 critical issues** that must be addressed before Marketplace submission:

1. **No uninstall handler** - user data persists forever
2. **No user consent UI** - screenshot capture starts without explicit consent
3. **No privacy policy** - required for Marketplace listing
4. **Undisclosed OpenAI data sharing** - users don't know screenshots go to OpenAI
5. **Missing encryption documentation** - required for external storage

The most significant architectural concern is that your app **egresses sensitive data** (screenshots with potentially confidential code/documents) to both Supabase and OpenAI. Consider:
- Using **Forge Storage** instead of Supabase
- Using **Forge LLMs API** instead of OpenAI (would enable "Runs on Atlassian" badge)
