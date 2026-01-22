# LEGAL DOCUMENTS SUMMARY

**Generated:** January 21, 2026
**Status:** Draft - Requires Legal Review and Customization

---

## DOCUMENTS CREATED

Three comprehensive legal documents have been drafted for JIRAForge:

1. **EULA.md** - End User License Agreement
2. **TERMS_OF_SERVICE.md** - Terms of Service
3. **PRIVACY_POLICY.md** - Privacy Policy

**Location:** `/docs/compliance/`

---

## DOCUMENT OVERVIEW

### 1. END USER LICENSE AGREEMENT (EULA)

**Purpose**: Governs the installation and use of JIRAForge software

**Key Sections:**
- License grant and restrictions
- Organizational responsibilities for employee monitoring
- Data collection and privacy overview
- AI analysis disclaimer
- Security measures and known gaps
- System requirements and permissions
- Subscription and payment terms
- Limitation of liability and indemnification
- Dispute resolution and arbitration

**Highlights:**
- ✅ Comprehensive employee monitoring obligations for Organizations
- ✅ Clear disclosure of AI limitations and accuracy
- ✅ Transparent about known security gaps (unencrypted local DB, plain JSON tokens)
- ✅ No keylogging clarification (activity detection only)
- ✅ Data retention policies (2 months for files)
- ✅ Third-party sub-processor disclosure

**Length:** ~20 pages

---

### 2. TERMS OF SERVICE (ToS)

**Purpose**: Governs access to and use of JIRAForge services

**Key Sections:**
- Eligibility and account requirements
- Description of services (Desktop, Forge, AI analysis)
- Acceptable use policy and prohibited uses
- Employee monitoring legal requirements (GDPR, CCPA)
- Intellectual property rights
- Data processing and privacy
- Third-party services (Atlassian, OpenAI, Supabase)
- Fees and payment
- Termination and data export
- Disclaimers and limitation of liability

**Highlights:**
- ✅ Detailed acceptable use policy
- ✅ Comprehensive employee monitoring compliance requirements
- ✅ GDPR and CCPA guidance for Organizations
- ✅ Sub-processor table with DPA status
- ✅ International data transfer disclosures
- ✅ Class action waiver and arbitration agreement

**Length:** ~22 pages

---

### 3. PRIVACY POLICY

**Purpose**: Explains data collection, use, sharing, and user rights

**Key Sections:**
- Data Controller vs. Processor roles
- Information collected (screenshots, metadata, AI analysis)
- How information is used
- How information is shared (sub-processors, Organization)
- Data retention (2 months for files, 12 months for logs)
- Data security (encryption, access controls, known gaps)
- International data transfers (US-based, SCCs)
- User rights (GDPR, CCPA)
- Employee monitoring notice template
- DPIA guidance
- Legitimate interest assessment framework

**Highlights:**
- ✅ Transparent about all data collection practices
- ✅ No keylogging clarification (activity detection for idle only)
- ✅ Sub-processor table with locations and DPA status
- ✅ Comprehensive GDPR and CCPA rights explanations
- ✅ Employee notice template for Organizations
- ✅ Known security gaps disclosed
- ✅ Compliance summary table
- ✅ Resources and best practice links

**Length:** ~25 pages

---

## CUSTOMIZATION REQUIRED

Before using these documents, you MUST customize the following placeholders:

### Global Replacements Needed:

| Placeholder | Where Used | What to Add |
|-------------|------------|-------------|
| `[JURISDICTION TO BE SPECIFIED]` | EULA, ToS | e.g., "State of Delaware, United States" |
| `[ARBITRATION BODY TO BE SPECIFIED]` | EULA, ToS | e.g., "American Arbitration Association (AAA)" |
| `[LOCATION TO BE SPECIFIED]` | ToS | Arbitration location, e.g., "New York, NY" |
| `[PHYSICAL ADDRESS TO BE ADDED]` | EULA, ToS, Privacy | Your registered business address |
| `[URL TO BE ADDED]` | All | Your website URL |
| `[STATUS PAGE URL TO BE ADDED]` | ToS | Service status page URL (e.g., status.jiraforge.com) |
| `[DURATION TO BE SPECIFIED]` | ToS | Free trial duration (e.g., "14 days") |
| `support@jiraforge.com` | All | Your actual support email |
| `legal@jiraforge.com` | All | Your actual legal email |
| `security@jiraforge.com` | All | Your actual security email |
| `privacy@jiraforge.com` | All | Your actual privacy email |
| `dpo@jiraforge.com` | Privacy | Your Data Protection Officer email |
| `sales@jiraforge.com` | Privacy | Your sales email |

### Company-Specific Information:

1. **Entity Name**: Verify "JIRAForge" is the correct legal entity name
2. **Incorporation**: Add state/country of incorporation
3. **Registration Number**: Add business registration/tax ID if required
4. **Contact Details**: Add phone numbers if desired
5. **Pricing**: Finalize pricing tiers and payment terms
6. **Service Regions**: Confirm which countries you serve
7. **Data Residency**: Update if EU data residency is available

### Legal Review Required:

⚠️ **CRITICAL**: These documents were drafted based on codebase analysis and web research, but **MUST be reviewed by a qualified attorney** before use. Legal requirements vary by jurisdiction.

**Recommended Reviews:**
1. **U.S. Attorney**: For CCPA, ECPA, state employment law compliance
2. **EU Attorney**: For GDPR compliance (if serving EU customers)
3. **Employment Law Attorney**: For employee monitoring compliance
4. **Intellectual Property Attorney**: For licensing and IP provisions

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Legal Review and Customization (Weeks 1-2)

- [ ] Engage qualified attorney(s) for legal review
- [ ] Customize all placeholder text
- [ ] Finalize governing law and arbitration provisions
- [ ] Review and approve language on known security gaps
- [ ] Confirm sub-processor list is complete and accurate
- [ ] Verify data retention periods align with business needs
- [ ] Finalize pricing and refund policies

### Phase 2: Technical Implementation (Weeks 3-4)

- [ ] Add EULA acceptance flow to Desktop Application first launch
- [ ] Add Terms of Service acceptance to Forge Application installation
- [ ] Create Privacy Policy webpage (public URL)
- [ ] Add "Privacy Policy" link to Desktop Application settings
- [ ] Add "Terms of Service" and "Privacy Policy" links to Forge Application footer
- [ ] Implement consent management UI (see DESKTOP_APP_COMPLIANCE.md)
- [ ] Add "View Privacy Policy" button before consent acceptance

### Phase 3: Organizational Support Materials (Week 5)

- [ ] Create employee monitoring notice template (customizable)
- [ ] Create DPIA template for Organizations
- [ ] Create legitimate interest assessment template
- [ ] Create data subject request handling guide
- [ ] Create data breach notification template
- [ ] Publish sub-processor list on website with update notification mechanism

### Phase 4: Marketplace Submission (Week 6)

- [ ] Add Privacy Policy URL to Atlassian Marketplace listing
- [ ] Add EULA URL to Atlassian Marketplace listing
- [ ] Complete Marketplace "Privacy and Security" tab
- [ ] Disclose all third-party services (OpenAI, Supabase, Fireworks)
- [ ] Submit for Marketplace review

### Phase 5: Ongoing Compliance

- [ ] Review legal documents annually or when laws change
- [ ] Update sub-processor list within 30 days of changes
- [ ] Notify users of material changes 30 days in advance
- [ ] Monitor regulatory developments (GDPR, CCPA, state laws)
- [ ] Track data subject requests and response times
- [ ] Conduct regular security audits
- [ ] Update documents when security gaps are remediated

---

## COMPLIANCE GAPS TO ADDRESS

Based on codebase analysis, these compliance issues should be resolved BEFORE marketplace launch:

### Critical (P0 - Block Launch)

1. **No App Uninstall Handler** (EULA Section 13.3, Privacy Section 7.3)
   - **Issue**: Data persists after Desktop Application uninstall
   - **Fix**: Implement uninstall handler to delete local SQLite DB and OAuth tokens
   - **Code**: Add to `desktop_app.py` or Windows installer

2. **Missing User Consent UI** (Privacy Section 10, EULA Section 5.1)
   - **Issue**: Users don't explicitly consent before screenshot capture begins
   - **Fix**: Implement first-run consent dialog showing Privacy Policy
   - **Code**: See `COMPLIANCE_SOLUTIONS.md` for implementation

3. **Missing Privacy Policy URL** (Marketplace Requirement)
   - **Issue**: Required for Marketplace listing
   - **Fix**: Publish Privacy Policy on public website
   - **Action**: Create privacy.jiraforge.com or similar

4. **Undisclosed OpenAI Data Sharing** (Privacy Section 6.1)
   - **Issue**: Users not informed that screenshots are sent to OpenAI
   - **Fix**: Already disclosed in Privacy Policy; add to consent dialog
   - **Code**: Update consent dialog text

### High Priority (P1 - Fix Soon)

5. **OAuth Tokens in Plain JSON** (EULA Section 7.2, Privacy Section 8.2)
   - **Issue**: Tokens in `%TEMP%\brd_tracker_auth.json` unencrypted
   - **Fix**: Migrate to Windows Credential Manager (keyring library)
   - **Code**: `desktop_app.py` - replace JSON storage with keyring

6. **Unencrypted SQLite Database** (Privacy Section 8.2)
   - **Issue**: Local `time_tracker_offline.db` stores screenshots in plaintext
   - **Fix**: Implement SQLCipher encryption
   - **Code**: Requires SQLCipher library and encryption key management

7. **No Hard Delete, Only Soft Delete** (Privacy Section 7.4, GDPR Article 17)
   - **Issue**: `deleted_at` flag set, but data remains in database
   - **Fix**: Implement hard delete function that permanently removes records
   - **Code**: Update `cleanup_synced()` and add `hard_delete()` method

8. **No Data Export Endpoint** (Privacy Section 10.1, GDPR Article 20)
   - **Issue**: Users must email support for data export
   - **Fix**: Add "Export My Data" button in Forge app
   - **Code**: New API endpoint `/api/users/{userId}/export`

9. **Hardcoded Admin Password** (EULA Section 7.2)
   - **Issue**: Default admin password is hardcoded
   - **Fix**: Generate random password on first run
   - **Code**: `desktop_app.py` - implement password generation and secure storage

10. **PII in Logs** (Privacy Section 8.2)
    - **Issue**: Email addresses and user IDs logged unmasked
    - **Fix**: Implement log sanitization to mask PII
    - **Code**: Add utility function to sanitize logs before writing

---

## RESEARCH SOURCES USED

This drafting was informed by the following research:

### GDPR and Employee Monitoring:
- [How to Implement Employee Screenshot Monitoring Legally](https://www.workexaminer.com/blog/how-to-implement-employee-screenshot-monitoring-in-a-legal-way.html)
- [GDPR Compliance in Employee Monitoring Software](https://apploye.com/blog/gdpr-compliance-in-employee-monitoring-software/)
- [GDPR Requirements for Employee Monitoring - Monitask](https://www.monitask.com/en/blog/gdpr-requirements-for-employee-monitoring-a-comprehensive-guide)
- [Employee Monitoring Laws: Legal Guide 2026](https://flowace.ai/blog/employee-monitoring-laws/)
- [Employee Monitoring Data Protection: GDPR Guide 2025](https://flowace.ai/blog/employee-monitoring-data-protection/)

### Atlassian Marketplace Requirements:
- [List a Forge App on Atlassian Marketplace](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)
- [Atlassian Developer Terms: Changes Summary](https://developer.atlassian.com/platform/marketplace/atlassian-developer-terms-changes-dec25/)
- [Forge Terms](https://developer.atlassian.com/platform/forge/developer-terms/)
- [Atlassian Marketplace Terms of Use](https://www.atlassian.com/licensing/marketplace/termsofuse)

### OpenAI Data Processing:
- [OpenAI Data Processing Addendum](https://openai.com/policies/data-processing-addendum/)
- [OpenAI Services Agreement](https://openai.com/policies/services-agreement/)
- [Enterprise Privacy at OpenAI](https://openai.com/enterprise-privacy/)

### CCPA and Time Tracking:
- [Time Tracking and Data Privacy](https://www.hivedesk.com/blog/time-tracking-data-privacy/)
- [Time Tracking Compliance: Accuracy vs Trust](https://www.timedoctor.com/blog/time-tracking-compliance/)
- [CCPA Requirements 2026: Complete Guide](https://secureprivacy.ai/blog/ccpa-requirements-2026-complete-compliance-guide)

---

## BENEFITS OF THESE DOCUMENTS

### For JIRAForge:

1. **Legal Protection**: Clear limitation of liability, indemnification, and disclaimer clauses
2. **Marketplace Compliance**: Meets Atlassian Marketplace requirements for privacy and security disclosure
3. **Regulatory Compliance**: Addresses GDPR, CCPA, and employment monitoring laws
4. **Transparency**: Builds trust by disclosing all data practices, including gaps
5. **User Rights**: Provides clear mechanisms for data access, deletion, and portability
6. **Risk Mitigation**: Arbitration clause reduces litigation costs

### For Organizations (Customers):

1. **Legal Guidance**: Clear obligations for employee monitoring compliance
2. **Employee Notice Template**: Ready-to-use template for informing employees
3. **DPIA Support**: Guidance on conducting Data Protection Impact Assessments
4. **Legitimate Interest Framework**: Assessment template for GDPR compliance
5. **Clarity on Roles**: Understands when they are Data Controller vs. JIRAForge as Processor

### For Employees (End Users):

1. **Transparency**: Knows exactly what data is collected and how it's used
2. **Rights Awareness**: Understands GDPR, CCPA, and employment rights
3. **Control**: Can delete screenshots, pause tracking, and access own data
4. **No Keylogging Assurance**: Clearly informed that keystrokes are NOT logged
5. **AI Limitations**: Understands AI analysis is not 100% accurate

---

## NEXT STEPS

1. **Legal Review** (Priority 1)
   - Engage attorney(s) immediately
   - Budget: $3,000-$10,000 for comprehensive review
   - Timeline: 2-4 weeks

2. **Customize Placeholders** (Priority 1)
   - Complete all bracketed placeholders
   - Add company-specific information
   - Timeline: 1 week

3. **Implement Technical Changes** (Priority 2)
   - Add EULA/ToS acceptance flows
   - Create public Privacy Policy webpage
   - Implement consent management UI
   - Timeline: 2-3 weeks

4. **Create Supporting Materials** (Priority 2)
   - Employee notice template
   - DPIA template
   - Data subject request process
   - Timeline: 1 week

5. **Remediate Compliance Gaps** (Priority 3)
   - See "Compliance Gaps to Address" section above
   - Focus on Critical (P0) items before launch
   - Timeline: 4-6 weeks

6. **Marketplace Submission** (Priority 4)
   - After legal review and critical gaps fixed
   - Complete Privacy and Security tab
   - Submit for review
   - Timeline: 1 week submission + 2-4 weeks review

---

## COST ESTIMATES

| Item | Estimated Cost | Timeline |
|------|----------------|----------|
| Legal review (U.S.) | $3,000-$7,000 | 2-3 weeks |
| Legal review (EU/GDPR) | $2,000-$5,000 | 2-3 weeks |
| Employment law review | $1,500-$3,000 | 1-2 weeks |
| Ongoing legal retainer | $500-$2,000/mo | Ongoing |
| Privacy Policy hosting | $0 (static page) | N/A |
| Compliance software (DPIA, consent mgmt) | $0-$500/mo | Ongoing |
| **Total Initial Cost** | **$6,500-$15,000** | **4-6 weeks** |

---

## DISCLAIMER

⚠️ **IMPORTANT**: These legal documents were drafted by an AI based on codebase analysis and web research. They are **NOT a substitute for professional legal advice**.

**DO NOT USE THESE DOCUMENTS WITHOUT REVIEW BY A QUALIFIED ATTORNEY.**

Laws vary by jurisdiction and are subject to change. This drafting is current as of January 2026 but may not reflect the latest legal developments in your jurisdiction.

JIRAForge assumes all responsibility for ensuring legal compliance. Claude (the AI that drafted these documents) provides no warranties regarding their legal sufficiency.

---

## SUPPORT

For questions about these documents or implementation guidance:

- **Support**: support@jiraforge.com
- **Legal**: legal@jiraforge.com
- **Privacy**: privacy@jiraforge.com

For recommendations on attorneys:
- **U.S. GDPR/Privacy Specialists**: IAPP (International Association of Privacy Professionals) directory
- **Employment Law Specialists**: National Employment Lawyers Association (NELA)
- **Tech Law Specialists**: Legal referrals from Atlassian Partner Network

---

**Document Version:** 1.0
**Generated:** January 21, 2026
**Next Review:** After attorney review and customization

---

**END OF SUMMARY**
