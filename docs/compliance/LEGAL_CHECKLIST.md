# LEGAL COMPLIANCE CHECKLIST

**JIRAForge - Pre-Launch Legal Compliance**
**Date:** January 21, 2026

---

## DOCUMENT STATUS

| Document | Status | Location |
|----------|--------|----------|
| End User License Agreement (EULA) | ✅ Draft Complete | `/docs/compliance/EULA.md` |
| Terms of Service (ToS) | ✅ Draft Complete | `/docs/compliance/TERMS_OF_SERVICE.md` |
| Privacy Policy | ✅ Draft Complete | `/docs/compliance/PRIVACY_POLICY.md` |
| Summary and Implementation Guide | ✅ Complete | `/docs/compliance/LEGAL_DOCUMENTS_SUMMARY.md` |

---

## PRE-LAUNCH CRITICAL CHECKLIST

### ⚠️ MUST COMPLETE BEFORE LAUNCH

#### 1. Legal Review
- [ ] Engage U.S. attorney for CCPA, ECPA, employment law review
- [ ] Engage EU attorney for GDPR review (if serving EU customers)
- [ ] Review all three documents (EULA, ToS, Privacy Policy)
- [ ] Incorporate attorney feedback and revisions
- [ ] Obtain attorney sign-off

**Timeline:** 2-4 weeks
**Cost:** $6,500-$15,000

---

#### 2. Document Customization
- [ ] Replace `[JURISDICTION TO BE SPECIFIED]` with actual jurisdiction
- [ ] Replace `[ARBITRATION BODY TO BE SPECIFIED]` with actual arbitration provider
- [ ] Replace `[PHYSICAL ADDRESS TO BE ADDED]` with registered business address
- [ ] Replace `[URL TO BE ADDED]` with actual website URLs
- [ ] Replace `[STATUS PAGE URL TO BE ADDED]` with status page URL
- [ ] Replace all placeholder email addresses with actual addresses
- [ ] Add free trial duration (if applicable)
- [ ] Finalize pricing and refund policies
- [ ] Verify company name is correct ("JIRAForge" vs. legal entity name)

**Timeline:** 1 day
**Owner:** Legal/Operations team

---

#### 3. Privacy Policy Publication
- [ ] Create public webpage for Privacy Policy (e.g., https://jiraforge.com/privacy)
- [ ] Create public webpage for Terms of Service (e.g., https://jiraforge.com/terms)
- [ ] Create public webpage for EULA (e.g., https://jiraforge.com/eula)
- [ ] Ensure pages are accessible without login
- [ ] Add "Last Updated" date prominently
- [ ] Add versioning system for future updates
- [ ] Test links from all locations

**Timeline:** 1 day
**Owner:** Web development team

---

#### 4. Desktop Application - First-Run Consent Flow
**Current Issue:** Users NOT explicitly consenting before screenshot capture begins

**Required Implementation:**
- [ ] Add first-run consent dialog on initial launch
- [ ] Display summary of data collection practices
- [ ] Link to full Privacy Policy
- [ ] Require "I Accept" button click (not pre-checked)
- [ ] Store consent in `time_tracker_consent.json` with timestamp
- [ ] Block screenshot capture until consent given
- [ ] Add "Revoke Consent" option in settings

**Code Location:** `python-desktop-app/desktop_app.py` - ConsentManager class

**Timeline:** 3-5 days
**Owner:** Desktop app development team

---

#### 5. Desktop Application - Uninstall Handler
**Current Issue:** Data persists after uninstall (GDPR/CCPA violation)

**Required Implementation:**
- [ ] Add Windows uninstall handler script
- [ ] Delete `time_tracker_offline.db` on uninstall
- [ ] Delete `brd_tracker_auth.json` on uninstall
- [ ] Delete `time_tracker_consent.json` on uninstall
- [ ] Prompt user: "Delete local data?" with Yes/No option
- [ ] If "No," inform user where data is located
- [ ] Log uninstall event to Supabase (before deletion)

**Code Location:** Windows installer script or `desktop_app.py` exit handler

**Timeline:** 2-3 days
**Owner:** Desktop app development team

---

#### 6. Atlassian Marketplace Listing - Privacy & Security Tab
- [ ] Add Privacy Policy URL
- [ ] Add EULA/Terms of Service URL
- [ ] List all third-party services:
  - [ ] Supabase (database and storage)
  - [ ] OpenAI (AI analysis - fallback)
  - [ ] Fireworks AI (AI analysis - primary)
  - [ ] Google Cloud (OCR - fallback)
- [ ] Disclose screenshot capture frequency (default 15 min)
- [ ] Disclose data retention (2 months for files)
- [ ] Disclose data location (USA - AWS)
- [ ] Confirm GDPR and CCPA compliance
- [ ] Add Data Processing Addendum (DPA) availability

**Timeline:** 1 day
**Owner:** Product/Legal team

---

#### 7. Sub-Processor Notifications
- [ ] Create public sub-processor list webpage (e.g., https://jiraforge.com/subprocessors)
- [ ] Include: Name, Purpose, Location, DPA Status
- [ ] Add "Last Updated" date
- [ ] Implement 30-day advance notice mechanism for changes
- [ ] Add email notification signup for sub-processor updates

**Timeline:** 1 day
**Owner:** Web development team

---

#### 8. Data Subject Request Handling Process
- [ ] Create privacy@jiraforge.com email address
- [ ] Create dpo@jiraforge.com email address (Data Protection Officer)
- [ ] Document internal process for handling requests:
  - [ ] Access requests (GDPR Article 15, CCPA §1798.100)
  - [ ] Deletion requests (GDPR Article 17, CCPA §1798.105)
  - [ ] Portability requests (GDPR Article 20)
  - [ ] Rectification requests (GDPR Article 16, CCPA correction)
  - [ ] Objection requests (GDPR Article 21)
- [ ] Set up ticket tracking system for requests
- [ ] Train support team on privacy request handling
- [ ] Create templates for responding to requests

**Timeline:** 2-3 days
**Owner:** Support/Legal team

---

## HIGH-PRIORITY COMPLIANCE FIXES

### Should Complete Before Launch (Not Blocking, But Important)

#### 9. Encrypt Local SQLite Database
**Current Issue:** `time_tracker_offline.db` is unencrypted, exposing screenshots locally

**Fix:**
- [ ] Integrate SQLCipher library
- [ ] Generate encryption key on first run
- [ ] Store key in Windows Credential Manager (not in code)
- [ ] Migrate existing databases to encrypted format
- [ ] Update documentation

**Code Location:** `python-desktop-app/desktop_app.py` - OfflineManager class

**Timeline:** 5-7 days
**Owner:** Desktop app development team

---

#### 10. Migrate OAuth Tokens to Windows Credential Manager
**Current Issue:** Tokens stored in plain JSON at `%TEMP%\brd_tracker_auth.json`

**Fix:**
- [ ] Install `keyring` library
- [ ] Update OAuth storage to use Windows Credential Manager
- [ ] Migrate existing tokens on next launch
- [ ] Delete plain JSON files after migration
- [ ] Handle keyring unavailability gracefully (fallback to JSON with warning)

**Code Location:** `python-desktop-app/desktop_app.py` - AtlassianAuthManager class

**Timeline:** 3-5 days
**Owner:** Desktop app development team

---

#### 11. Implement Hard Delete (Not Just Soft Delete)
**Current Issue:** Deletion only sets `deleted_at` flag; data remains in database

**Fix:**
- [ ] Add `hard_delete` parameter to deletion functions
- [ ] Implement permanent deletion from database
- [ ] Update Forge app UI: "Delete" vs "Delete Permanently"
- [ ] Add confirmation dialog for permanent deletion
- [ ] Comply with GDPR Article 17 ("Right to Erasure")

**Code Location:**
- `ai-server/src/services/cleanup-service.js`
- `forge-app/src/` (screenshot deletion endpoints)

**Timeline:** 3-4 days
**Owner:** Backend development team

---

#### 12. Add Self-Service Data Export
**Current Issue:** Users must email support for data export (GDPR Article 20 violation)

**Fix:**
- [ ] Add "Export My Data" button in Forge app settings
- [ ] Generate CSV export: Screenshot metadata, timestamps, window titles, projects
- [ ] Generate JSON export: Analysis results, AI confidence scores
- [ ] Optionally include screenshot image files (ZIP)
- [ ] Limit export frequency (e.g., once per 30 days)
- [ ] Email download link when ready (async processing)

**Code Location:** New endpoint `/api/users/{userId}/export`

**Timeline:** 5-7 days
**Owner:** Backend + Forge app development teams

---

#### 13. Remove Hardcoded Admin Password
**Current Issue:** Default admin password is hardcoded in source code

**Fix:**
- [ ] Generate random password on first application run
- [ ] Display password to user in console or dialog (copy-to-clipboard)
- [ ] Store hashed password in secure location (Windows Credential Manager)
- [ ] Add "Reset Admin Password" option in settings
- [ ] Remove hardcoded password from codebase

**Code Location:** `python-desktop-app/desktop_app.py` - Authentication setup

**Timeline:** 2-3 days
**Owner:** Desktop app development team

---

#### 14. Implement Log Sanitization (PII Masking)
**Current Issue:** Email addresses and user IDs logged in plaintext

**Fix:**
- [ ] Create utility function to mask PII in logs:
  - Email: `user@example.com` → `u***@example.com`
  - User ID: `12345678-1234-1234-1234-123456789abc` → `12345678-****-****-****-********9abc`
- [ ] Apply to all logging statements
- [ ] Test log output for PII leakage
- [ ] Update error reporting to sanitize before sending to monitoring services

**Code Location:** All files with logging (create shared utility)

**Timeline:** 3-4 days
**Owner:** All development teams

---

## MEDIUM-PRIORITY ENHANCEMENTS

### Can Complete Post-Launch (Within 90 Days)

#### 15. Employee Notice Template Generator
- [ ] Create web-based template generator
- [ ] Allow Organizations to customize:
  - Monitoring frequency
  - Purpose of monitoring
  - Who has access
  - Retention period
- [ ] Generate downloadable PDF or Word document
- [ ] Add to Forge app "Settings" → "Compliance Tools"

**Timeline:** 5-7 days
**Owner:** Forge app development team

---

#### 16. DPIA (Data Protection Impact Assessment) Template
- [ ] Create DPIA template document
- [ ] Include sections:
  - Description of processing
  - Necessity and proportionality
  - Risks to employee rights
  - Mitigation measures
  - Legitimate interest balancing test
- [ ] Provide as downloadable Word/PDF
- [ ] Add guidance notes for Organizations

**Timeline:** 2-3 days
**Owner:** Legal team

---

#### 17. Data Breach Notification System
- [ ] Create incident response plan document
- [ ] Implement automated breach detection:
  - Unusual access patterns
  - Large-scale data exports
  - Failed authentication spikes
- [ ] Create notification email templates:
  - To Organizations (72-hour GDPR requirement)
  - To individuals (if high risk)
  - To supervisory authorities
- [ ] Add incident tracking dashboard

**Timeline:** 1-2 weeks
**Owner:** Backend development + Security teams

---

#### 18. Consent Version Management
**Current:** Consent version is "1.0" hardcoded

**Enhancement:**
- [ ] Add consent version to database
- [ ] Track consent history per user
- [ ] Prompt users to re-consent when Privacy Policy materially changes
- [ ] Compare user's consent version to current version on login
- [ ] Add "View Privacy Policy Changes" link showing what changed

**Timeline:** 3-5 days
**Owner:** Desktop app + Backend teams

---

#### 19. EU Data Residency Option
**Current:** All data stored in USA (AWS via Supabase)

**Enhancement:**
- [ ] Research Supabase EU region availability
- [ ] Implement region selection during onboarding
- [ ] Migrate EU customers to EU region
- [ ] Update Privacy Policy with data residency options
- [ ] Add pricing premium for EU residency (if cost differential)

**Timeline:** 2-3 weeks
**Owner:** Backend + DevOps teams

---

#### 20. Cookie Consent Management (If Website Has Non-Essential Cookies)
- [ ] Audit website for cookies used
- [ ] Categorize: Essential, Analytics, Marketing
- [ ] Implement cookie banner (EU ePrivacy Directive)
- [ ] Allow users to accept/reject by category
- [ ] Integrate with cookie management platform (e.g., OneTrust, Cookiebot)

**Timeline:** 3-5 days (with third-party tool)
**Owner:** Web development team

---

## ONGOING COMPLIANCE TASKS

### Continuous Monitoring and Maintenance

#### 21. Quarterly Legal Review
- [ ] Q1 2026: Review for new laws/regulations
- [ ] Q2 2026: Audit data retention compliance
- [ ] Q3 2026: Review sub-processor list
- [ ] Q4 2026: Update Privacy Policy if needed

**Owner:** Legal team

---

#### 22. Annual Privacy Policy Update
- [ ] Review Privacy Policy annually (January each year)
- [ ] Incorporate regulatory changes
- [ ] Update sub-processor list
- [ ] Add new features/data uses
- [ ] Notify users 30 days before material changes

**Owner:** Legal + Product teams

---

#### 23. Data Subject Request Tracking
- [ ] Track all privacy requests in database or ticketing system
- [ ] Monitor response times (30 days GDPR, 45 days CCPA)
- [ ] Generate monthly reports on request types and volumes
- [ ] Identify trends (e.g., spike in deletion requests → investigate)

**Owner:** Support + Legal teams

---

#### 24. Security Audit (Biannual)
- [ ] Conduct penetration testing
- [ ] Review encryption implementations
- [ ] Audit access controls and RLS policies
- [ ] Check for PII leakage in logs
- [ ] Review third-party security postures

**Owner:** Security team

---

#### 25. Employee Training (Organizations)
- [ ] Create training module for Organizations' HR/IT teams
- [ ] Cover:
  - Legal obligations for employee monitoring
  - How to provide employee notice
  - Handling data subject requests
  - Best practices for data access control
- [ ] Deliver as webinar or self-paced course

**Owner:** Customer Success team

---

## METRICS TO TRACK

### Compliance KPIs

| Metric | Target | Frequency |
|--------|--------|-----------|
| Data subject access request response time | <30 days (GDPR) | Weekly |
| Data subject deletion request response time | <30 days (GDPR) | Weekly |
| Privacy policy acceptance rate | 100% (before usage) | Daily |
| Data breach detection time | <24 hours | Continuous |
| Data breach notification time | <72 hours (GDPR) | Per incident |
| Sub-processor change notice | 30 days advance | Per change |
| Screenshot file auto-deletion success rate | 100% | Monthly |
| Hard delete request fulfillment rate | 100% | Weekly |
| Uninstall data deletion rate | 100% | Weekly |

---

## BUDGET SUMMARY

| Item | Cost | Timeline | Priority |
|------|------|----------|----------|
| Legal review (U.S.) | $3,000-$7,000 | 2-3 weeks | P0 |
| Legal review (EU) | $2,000-$5,000 | 2-3 weeks | P0 (if EU) |
| Development (Critical fixes 4-8) | $8,000-$15,000 | 4-6 weeks | P0 |
| Development (High-priority fixes 9-14) | $10,000-$20,000 | 4-6 weeks | P1 |
| Development (Medium-priority 15-20) | $8,000-$15,000 | 8-12 weeks | P2 |
| Ongoing legal retainer | $500-$2,000/month | Ongoing | P1 |
| Compliance software/tools | $100-$500/month | Ongoing | P2 |
| **Total Initial Investment** | **$31,000-$62,000** | **12-18 weeks** | - |

---

## RISKS OF NON-COMPLIANCE

### Legal Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GDPR fine (up to €20M or 4% revenue) | Medium | Catastrophic | Complete P0 checklist |
| CCPA fine (up to $7,500 per violation) | Medium | High | Complete P0 checklist |
| Employment lawsuit (wrongful termination based on monitoring) | Medium | High | Provide clear disclaimers on AI limitations |
| Marketplace rejection by Atlassian | High (if non-compliant) | High | Complete P0 items 3, 4, 6 |
| Data breach with inadequate response | Low | Catastrophic | Implement breach notification system |
| Consent violations (monitoring without notice) | High (current state) | Medium-High | Implement consent flow (item 4) |

### Reputational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Negative reviews citing privacy concerns | Medium | Medium | Transparency in Privacy Policy |
| Media coverage of security gaps | Low | High | Proactively disclose and remediate |
| Loss of customer trust | Medium | High | Demonstrate commitment to compliance |
| Competitive disadvantage | Medium | Medium | Be first to implement EU data residency |

---

## SUCCESS CRITERIA

### Launch Readiness

All of the following MUST be completed before marketplace launch:

- [x] ✅ EULA, ToS, Privacy Policy drafted (COMPLETE)
- [ ] ❌ Legal review completed and approved
- [ ] ❌ All placeholders customized
- [ ] ❌ Privacy Policy published on public website
- [ ] ❌ First-run consent flow implemented (Item 4)
- [ ] ❌ Uninstall handler implemented (Item 5)
- [ ] ❌ Marketplace Privacy & Security tab completed (Item 6)
- [ ] ❌ Data subject request process documented (Item 8)

**Progress:** 1/8 items complete (12.5%)

---

## CONTACT FOR ASSISTANCE

| Topic | Contact |
|-------|---------|
| Legal review recommendations | legal@jiraforge.com |
| Development priorities | support@jiraforge.com |
| Privacy questions | privacy@jiraforge.com |
| Security concerns | security@jiraforge.com |
| Marketplace listing | marketplace@jiraforge.com |

---

## APPROVAL SIGN-OFF

Before proceeding to launch, obtain sign-off from:

- [ ] **CEO/Founder**: Overall approval to launch
- [ ] **Legal Counsel**: Confirms legal documents are adequate
- [ ] **CTO/VP Engineering**: Confirms P0 technical fixes are complete
- [ ] **Data Protection Officer**: Confirms GDPR compliance readiness
- [ ] **Product Manager**: Confirms feature completeness for compliance

**Sign-Off Date:** ________________

**Approved By:**

- CEO: _________________________ Date: __________
- Legal: _________________________ Date: __________
- CTO: _________________________ Date: __________
- DPO: _________________________ Date: __________
- PM: _________________________ Date: __________

---

**Checklist Version:** 1.0
**Date Created:** January 21, 2026
**Next Review:** After P0 items completed

---

**END OF CHECKLIST**
