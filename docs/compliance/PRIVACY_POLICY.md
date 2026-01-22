# PRIVACY POLICY

**JIRAForge Time Tracking System**

**Effective Date:** January 21, 2026
**Last Updated:** January 21, 2026

---

## 1. INTRODUCTION

Welcome to JIRAForge. We are committed to protecting your privacy and being transparent about how we collect, use, store, and share your personal information.

This Privacy Policy applies to:
- **Desktop Application** - Windows time tracking client
- **Forge Application** - Jira Cloud app for reporting and dashboards
- **Cloud Services** - Backend infrastructure, AI analysis, and data storage
- **Website and Documentation** - Our public-facing web properties

This Privacy Policy describes:
- What information we collect and why
- How we use and share information
- Your rights and choices
- How we protect your information
- How to contact us

**By using JIRAForge, you consent to the practices described in this Privacy Policy.**

---

## 2. DEFINITIONS

To help you understand this Privacy Policy, here are key terms:

- **"Personal Data"** or **"Personal Information"** - Information that identifies, relates to, or can be linked to an identifiable individual
- **"Processing"** - Any operation performed on personal data, including collection, storage, use, disclosure, or deletion
- **"Data Controller"** - The entity that determines the purposes and means of processing personal data
  - **For Employees**: Your employer (the Organization) is the Data Controller for workplace monitoring data
  - **For Account Management**: JIRAForge is the Data Controller for authentication and service delivery
- **"Data Processor"** - The entity that processes personal data on behalf of the Data Controller
  - JIRAForge acts as a Data Processor when processing employee monitoring data
- **"Sub-Processor"** - A third party engaged by the Data Processor to process personal data
- **"Services"** - JIRAForge Desktop Application, Forge Application, and related services
- **"You," "Your," "User"** - The individual using the Services
- **"Organization"** - The employer or entity that has deployed JIRAForge
- **"We," "Us," "Our"** - JIRAForge

---

## 3. DATA CONTROLLER AND PROCESSOR ROLES

Understanding who controls your data is important for exercising your rights.

### 3.1 When JIRAForge is the Data Controller

We act as the Data Controller for:

- **Account Registration and Authentication**: Your Atlassian account information used to access JIRAForge
- **Service Delivery**: Information necessary to provide and improve the Services
- **Marketing Communications**: If you opt in to receive updates (organizations only, not employees)
- **Website Analytics**: If you visit our website

### 3.2 When Your Organization is the Data Controller

Your employer (the Organization) acts as the Data Controller for:

- **Workplace Monitoring Data**: Screenshots, activity tracking, window titles, and application names
- **Productivity Data**: Time allocation, project assignments, and worklog data
- **Performance Management**: Use of monitoring data for employment decisions

As a Data Processor for this data, we only process it according to your Organization's instructions.

### 3.3 Your Rights Depend on the Controller

- **For account-related data**: Exercise rights by contacting us at privacy@jiraforge.com
- **For monitoring data**: Exercise rights by contacting your employer/Organization first
- If your Organization is unresponsive, you may also contact us for assistance

---

## 4. INFORMATION WE COLLECT

### 4.1 Information You Provide Directly

**Account Registration (via Atlassian OAuth)**:
- Atlassian Account ID (unique identifier)
- Email address
- Display name
- Avatar URL
- Jira Cloud ID and instance URL
- User roles and permissions (admin, project admin, user)
- Groups and application roles
- Timezone and locale preferences

**Consent Records**:
- Timestamp of consent
- Version of Privacy Policy accepted
- IP address at time of consent
- Device information

**Support Communications**:
- Name and email address
- Support ticket content
- Attachments you provide

### 4.2 Information Collected Automatically by Desktop Application

**Screenshot Data**:
- **Full-screen PNG images** captured at configurable intervals (default: every 15 minutes)
- **Compressed JPEG thumbnails** (400x300 pixels, 70% quality)
- **Timestamps** of capture (date, time, timezone)
- **Window title** of the active application window
- **Application name** of the active application
- **Start time** and **end time** of the activity period
- **Duration** calculated from start to end
- **File size** of screenshot
- **Storage path** where screenshot is saved

**Activity Detection (NOT Keylogging)**:
- **Mouse activity** - Detection that mouse movement or clicks occurred (NOT exact coordinates or click locations)
- **Keyboard activity** - Detection that keyboard activity occurred (NOT individual keys pressed or text typed)
- **Purpose**: Used ONLY to determine if the user has been idle for more than 5 minutes (configurable threshold)
- **Important**: We do NOT log, record, or transmit what keys are pressed, what text is typed, where the mouse is positioned, or what is clicked

**Idle State**:
- Boolean flag indicating if user was idle during a period (>5 minutes of inactivity)
- Idle periods typically do NOT trigger screenshot capture (configurable)

**Jira Context**:
- **Assigned Jira issues** fetched from Jira API (issue key, summary, status, project, labels)
- **Detected Jira issue keys** visible in screenshots or window titles
- **Project keys** associated with detected tasks

**Device and System Information**:
- Operating system version (e.g., Windows 10)
- Desktop Application version
- Screen resolution
- Local time and timezone

**Local Storage**:
- **SQLite database** at `%LOCALAPPDATA%\TimeTracker\time_tracker_offline.db` containing:
  - Screenshot binary data (PNG and JPEG blobs)
  - Metadata (window titles, app names, timestamps)
  - Sync status
- **OAuth tokens** at `%LOCALAPPDATA%\TimeTracker\brd_tracker_auth.json` (access token, refresh token, expiration)
- **Consent records** at `%LOCALAPPDATA%\TimeTracker\time_tracker_consent.json`

**Note on Local Data Security**:
- ⚠️ **Current Gap**: Local SQLite database is currently **unencrypted**
- ⚠️ **Current Gap**: OAuth tokens are stored in **plain JSON** files
- 🔄 **In Progress**: We are implementing SQLCipher for database encryption and Windows Credential Manager for token storage

### 4.3 Information from AI Analysis

Our AI services analyze screenshots to extract:

- **Detected Jira task keys** visible in the screenshot
- **Confidence score** (0-1 scale) indicating certainty of detection
- **Work type classification** (office work vs. non-office activity)
- **Extracted text** (OCR) from screenshot images
- **Active application context** (e.g., IDE, browser, communication tool)
- **AI model version** used for analysis

**AI Models Used**:
- Primary: Fireworks AI (Qwen-2.5-VL-32B)
- Fallback 1: OpenAI GPT-4o (vision model)
- Fallback 2: Google Gemini (vision model)
- Fallback 3: OCR + heuristics

### 4.4 Information from Forge Application Usage

**Dashboard and Report Access**:
- Which pages you view in the Forge app
- Filters and date ranges you apply
- Reports you generate

**Worklog Actions**:
- Worklogs you create, edit, or delete
- Time entered manually vs. auto-populated
- Projects and issues you log time to

**Activity Logs**:
- Login and logout events
- Screenshot deletion events
- Settings changes
- Consent acceptance or revocation

### 4.5 Information from Third Parties

**From Atlassian (via OAuth and Jira API)**:
- User profile information (see Section 4.1)
- List of Jira issues assigned to you
- Projects you have access to
- Worklogs you've created in Jira
- Organization information (Jira Cloud ID, URL, site name)

**From Sub-Processors**:
- Payment information (processed by Atlassian Marketplace, NOT stored by us)
- AI analysis results (from OpenAI, Fireworks, Google)

---

## 5. HOW WE USE YOUR INFORMATION

### 5.1 To Provide and Improve the Services

We use your information to:

- **Authenticate** you via Atlassian OAuth
- **Capture screenshots** at configured intervals
- **Detect idle time** to pause capture when you're inactive
- **Store screenshots** locally (offline) and in the cloud (Supabase)
- **Analyze screenshots** using AI to detect active Jira tasks
- **Suggest worklog entries** based on detected activity
- **Create Jira worklogs** when you approve suggestions
- **Display dashboards** showing your time allocation and screenshots
- **Generate reports** for productivity analysis
- **Synchronize data** between Desktop and Forge applications
- **Improve AI accuracy** by retraining models with anonymized data

### 5.2 For Security and Compliance

We use your information to:

- **Prevent unauthorized access** to your account
- **Detect and prevent fraud** or misuse of the Services
- **Monitor system health** and performance
- **Log security events** for audit purposes
- **Comply with legal obligations** (e.g., responding to subpoenas, data subject requests)
- **Enforce our Terms of Service and EULA**

### 5.3 For Analytics and Research

We use aggregate, anonymized information to:

- **Understand usage patterns** (e.g., most common capture intervals)
- **Improve AI model accuracy** by analyzing where detection fails
- **Optimize performance** (e.g., database query speeds)
- **Track LLM API costs** in Google Sheets for budgeting
- **Identify bugs and errors** in the application

**Note**: We do NOT share individual employee activity data for analytics. Only aggregated, de-identified data is used.

### 5.4 For Communication

We use your email address to:

- **Send service announcements** (e.g., scheduled maintenance)
- **Notify about security issues** (e.g., password reset requests, suspicious activity)
- **Respond to support requests**
- **Send invoices and receipts** (via Atlassian Marketplace)
- **Request feedback** after support interactions (optional)

**Marketing Communications** (Organizations only):
- If you opt in, we may send newsletters, feature updates, and promotional content
- You can opt out at any time by clicking "Unsubscribe" or contacting privacy@jiraforge.com

**We do NOT send marketing emails to individual employees**, only to Organization administrators.

### 5.5 For Legal Compliance

We may use or disclose your information to:

- Comply with legal obligations (e.g., court orders, subpoenas)
- Respond to law enforcement requests
- Enforce our legal rights
- Protect the safety of users or the public

---

## 6. HOW WE SHARE YOUR INFORMATION

We do NOT sell your personal information to third parties. We share your information only as described below.

### 6.1 With Sub-Processors (Third-Party Service Providers)

We share your information with trusted third-party services that help us operate:

| Sub-Processor | What We Share | Purpose | Location | DPA Status |
|---------------|---------------|---------|----------|------------|
| **Supabase** | All collected data (screenshots, metadata, user profiles) | Cloud database and file storage | USA (AWS) | ✅ Executed |
| **OpenAI** | Screenshots, window titles, Jira issue list | AI vision analysis (fallback) | USA | ✅ Executed |
| **Fireworks AI** | Screenshots, window titles, Jira issue list | AI vision analysis (primary) | USA | ✅ Executed |
| **Google Cloud** | Screenshots (when used) | AI vision and OCR (fallback) | USA | ✅ Executed |
| **Atlassian** | User ID, worklog data | OAuth authentication, worklog sync | USA/Australia | ✅ Via Platform |

**Data Processing Addendums (DPAs)**: We have executed DPAs with all sub-processors handling personal data, ensuring they comply with GDPR and other data protection laws.

**Sub-Processor List**: A complete, up-to-date list is available at [URL TO BE ADDED]. We will notify Organizations at least **30 days** before adding new sub-processors.

### 6.2 With Your Organization (Employer)

If you are an employee using JIRAForge:

- **Your Organization has access to all monitoring data** captured by the Desktop Application
- **Organization administrators** can view your screenshots, time allocation, and activity reports
- **Project administrators** can view time data for their projects (may include your screenshots if configured)
- **We act as a Data Processor**; your Organization determines how your data is used

**What Your Organization Can See**:
- All screenshots captured from your device
- Window titles and application names
- Time spent on each task/project
- Idle periods
- AI-detected task assignments
- Worklogs created in Jira

**What Your Organization Cannot See (without your device access)**:
- Content of personal files on your device (only screenshot captures are sent)
- Keystrokes or specific text you type
- Mouse coordinates or click locations
- Personal accounts or credentials

### 6.3 With Other Users in Your Organization

Depending on your Organization's configuration and your role:

- **Organization Admins**: Can view all users' data within the Organization
- **Project Admins**: Can view time data for projects they manage (may include screenshots if configured)
- **Regular Users**: Can view ONLY their own data (default)

**Team Dashboards**:
- Aggregated team data (e.g., "Total team hours: 120") may be visible to project managers
- Individual screenshots are NOT shown in team aggregations unless specifically configured by the Organization

### 6.4 For Legal Requirements

We may disclose your information if required by law or legal process:

- **Court orders and subpoenas**
- **Law enforcement requests** (we will notify you unless prohibited by law)
- **Government investigations**
- **Legal disputes** involving JIRAForge

We will make reasonable efforts to:
- Verify the legitimacy of the request
- Disclose only the minimum information required
- Notify affected users unless legally prohibited

### 6.5 In Business Transfers

If JIRAForge is involved in a merger, acquisition, or sale of assets:

- Your information may be transferred to the acquiring entity
- We will notify you via email and/or prominent notice on our website **30 days** before the transfer
- The acquiring entity must honor the commitments made in this Privacy Policy
- You may delete your account before the transfer if you do not consent

### 6.6 With Your Consent

We may share your information for other purposes with your explicit consent.

### 6.7 Anonymized and Aggregated Data

We may share anonymized, aggregated data that cannot identify you:

- **Public reporting**: "JIRAForge users save an average of 5 hours/week on time tracking"
- **Research publications**: Academic studies on workplace productivity (with ethical review)
- **Benchmarking**: Industry reports on time allocation by sector

---

## 7. DATA RETENTION

### 7.1 How Long We Keep Your Data

| Data Type | Retention Period | Rationale |
|-----------|------------------|-----------|
| **Screenshot files (PNG/JPEG)** | **2 months** from capture date | Balances utility with storage costs and privacy |
| **Screenshot metadata** | Until user or Organization deletion request | Required for historical reporting |
| **AI analysis results** | Until user or Organization deletion request | Required for worklog accuracy |
| **User profiles** | Duration of subscription + **30 days** | Account recovery and support |
| **Activity logs** | **12 months** | Security auditing and troubleshooting |
| **Consent records** | **7 years** | Legal compliance (GDPR Article 30) |
| **Worklogs in Jira** | Per Jira's retention (controlled by Atlassian) | Outside JIRAForge's control |
| **Backups** | Up to **90 days** | Disaster recovery |

### 7.2 Automated Deletion

**Monthly Cleanup Job**:
- Runs on the **1st of each month at 3:00 AM UTC**
- Deletes screenshot files older than **2 months**
- Processes **50 files per batch** to avoid overloading systems
- Sets `deleted_at` timestamp on database records (soft delete)
- Configurable via environment variables:
  - `CLEANUP_SCHEDULE_DAY` (default: 1)
  - `CLEANUP_MONTHS_TO_KEEP` (default: 2)

**Code Reference**: `ai-server/src/services/cleanup-service.js`

### 7.3 Manual Deletion

You or your Organization may request data deletion at any time:

- **Individual screenshots**: Delete via Forge app dashboard
- **Bulk deletion**: Contact support@jiraforge.com
- **Account deletion**: Contact support@jiraforge.com or cancel subscription

**Processing Time**:
- Individual screenshot deletions: Immediate (soft delete)
- Bulk deletions: Within **14 days**
- Account deletions: Within **30 days**

### 7.4 Hard Delete vs. Soft Delete

**Current Implementation** (Soft Delete):
- Sets `deleted_at` timestamp on database records
- Data remains in the database but is hidden from queries
- Allows potential recovery in case of accidental deletion

**Planned Implementation** (Hard Delete):
- Permanently removes data from the database
- Required for full GDPR Article 17 compliance ("Right to Erasure")
- Target implementation: Q2 2026

### 7.5 What Happens After Deletion

- **Deleted data is no longer accessible** via the Services
- **Backups may retain deleted data** for up to **90 days** (disaster recovery)
- **Anonymized data** used in aggregate reports is not deleted
- **Legal holds**: If data is subject to legal preservation requirements, deletion may be delayed

---

## 8. DATA SECURITY

### 8.1 Security Measures We Implement

We take security seriously and implement industry-standard measures:

**Encryption**:
- ✅ **In Transit**: TLS 1.2+ encryption for all network communications
- ✅ **At Rest (Cloud)**: AES-256 encryption for data stored in Supabase
- ⚠️ **At Rest (Local)**: SQLite database currently **unencrypted** (implementing SQLCipher)

**Authentication and Access Control**:
- ✅ **OAuth 2.0 with PKCE** (RFC 9700) for secure authentication
- ✅ **Row-Level Security (RLS)** in Supabase to isolate user data
- ✅ **Role-Based Access Control (RBAC)** in Forge app (admin, project admin, user)
- ✅ **Token rotation**: OAuth refresh tokens are rotated on each use

**Application Security**:
- ✅ **Single instance lock**: Prevents multiple Desktop Application instances
- ✅ **CSRF protection**: OAuth state parameter validation
- ✅ **Input validation**: Sanitization of user inputs
- ⚠️ **Hardcoded admin password**: Default admin password exists (implementing first-run generation)

**Infrastructure Security**:
- ✅ **Supabase managed infrastructure**: SOC 2 Type II certified
- ✅ **AWS hosting**: Physical security, DDoS protection, redundancy
- ✅ **Regular backups**: Automated daily backups
- ✅ **Monitoring and alerting**: 24/7 system health monitoring

**Organizational Security**:
- Employee confidentiality agreements
- Background checks for employees with data access
- Security awareness training
- Incident response plan

### 8.2 Known Security Gaps (In Remediation)

We are actively addressing the following issues:

| Issue | Risk Level | Status | Target Date |
|-------|------------|--------|-------------|
| Unencrypted local SQLite database | 🔴 High | Implementing SQLCipher | Q1 2026 |
| OAuth tokens in plain JSON | 🔴 High | Migrating to Windows Credential Manager | Q1 2026 |
| Hardcoded admin password | 🟡 Medium | Implementing first-run password setup | Q1 2026 |
| No PII masking in error logs | 🟡 Medium | Implementing log sanitization | Q2 2026 |

**Transparency Commitment**: We disclose known security gaps proactively and update this list as issues are resolved.

### 8.3 Your Security Responsibilities

You are responsible for:

- **Keeping your Atlassian account credentials secure** (use strong, unique passwords)
- **Enabling two-factor authentication (2FA)** on your Atlassian account
- **Securing devices** where the Desktop Application is installed
- **Reporting suspicious activity** to security@jiraforge.com
- **Not sharing account credentials** with others

**Organization Responsibilities**:
- Implementing organizational access controls
- Training employees on data security
- Monitoring for unauthorized access
- Reporting security incidents to us promptly

### 8.4 Data Breach Response

In the event of a data breach:

1. **Detection**: We monitor for anomalies and suspicious access
2. **Assessment**: Determine scope, affected users, and sensitivity of data
3. **Containment**: Immediately contain the breach and prevent further exposure
4. **Notification**:
   - **Organizations**: Notified within **72 hours** of discovery (GDPR requirement)
   - **Individuals**: Notified if high risk to rights and freedoms (GDPR Article 34)
   - **Authorities**: Notified per legal requirements (e.g., supervisory authorities)
5. **Remediation**: Fix vulnerabilities and implement additional safeguards
6. **Post-Incident Review**: Analyze root cause and improve security practices

**What We Will Tell You**:
- Nature of the breach (e.g., unauthorized access, data exfiltration)
- Categories of data affected
- Approximate number of affected individuals
- Likely consequences
- Measures taken to address the breach
- Contact information for further inquiries

**Contact for Security Issues**: security@jiraforge.com

---

## 9. INTERNATIONAL DATA TRANSFERS

### 9.1 Where Your Data is Stored

**Primary Storage Location**: United States (Amazon Web Services via Supabase)

**Sub-Processor Locations**:
- Supabase: USA (AWS)
- OpenAI: USA
- Fireworks AI: USA
- Google Cloud: USA
- Atlassian: USA and Australia

### 9.2 Transfers from the European Economic Area (EEA)

If you are located in the EEA, your personal data will be transferred to the United States, which may not provide an equivalent level of data protection as EEA law.

**Legal Basis for Transfers**:

1. **Standard Contractual Clauses (SCCs)**: We use European Commission-approved SCCs with our sub-processors (Supabase, OpenAI, etc.)

2. **Adequacy Decisions**: Where available (e.g., Atlassian may rely on frameworks like the EU-U.S. Data Privacy Framework)

3. **Your Consent**: By using the Services, you consent to the transfer of your data to the United States

**Additional Safeguards**:
- Data Processing Addendums (DPAs) with all sub-processors
- Encryption in transit and at rest
- Access controls and audit logging
- Contractual obligations on sub-processors to protect data

### 9.3 Data Residency Options

**Current Status**: All data is stored in the United States.

**Planned Feature**: We are exploring EU data residency options (storing data within the EU) for organizations that require it. Expected availability: Q3 2026.

If data residency is critical for your Organization, contact sales@jiraforge.com to express interest.

---

## 10. YOUR RIGHTS AND CHOICES

### 10.1 Rights Under GDPR (European Economic Area)

If you are located in the EEA, you have the following rights:

1. **Right to Access (Article 15)**:
   - Request a copy of your personal data
   - Receive information about how your data is processed
   - Access via Forge app dashboard or by contacting privacy@jiraforge.com

2. **Right to Rectification (Article 16)**:
   - Correct inaccurate personal data
   - Update your profile information
   - Contact support@jiraforge.com or update via Atlassian account settings

3. **Right to Erasure / "Right to be Forgotten" (Article 17)**:
   - Request deletion of your personal data
   - Delete individual screenshots via Forge app
   - Request bulk deletion by contacting privacy@jiraforge.com
   - **Note**: Soft delete is currently used; hard delete implementation in progress

4. **Right to Restriction of Processing (Article 18)**:
   - Request that we limit processing of your data
   - Pause screenshot capture via Desktop Application settings
   - Contact privacy@jiraforge.com for additional restrictions

5. **Right to Data Portability (Article 20)**:
   - Receive your data in a structured, machine-readable format (CSV, JSON)
   - Transfer your data to another service
   - Request export by contacting support@jiraforge.com (14-day notice preferred)
   - **Note**: Self-service export not yet available; planned for Q2 2026

6. **Right to Object (Article 21)**:
   - Object to processing based on legitimate interests
   - Object to direct marketing (Organizations only)
   - Opt out by contacting privacy@jiraforge.com

7. **Rights Related to Automated Decision-Making (Article 22)**:
   - You have the right not to be subject to decisions based solely on automated processing
   - **Our Practice**: AI suggestions are NOT automatically applied; human review and approval required

8. **Right to Withdraw Consent**:
   - Withdraw consent at any time (where consent is the legal basis)
   - Revoke consent via Desktop Application or by contacting privacy@jiraforge.com
   - Withdrawal does not affect lawfulness of processing before withdrawal

9. **Right to Lodge a Complaint**:
   - File a complaint with your local supervisory authority
   - EEA Data Protection Authorities: https://edpb.europa.eu/about-edpb/board/members_en

**How to Exercise Your Rights**:
- **For monitoring data**: Contact your Organization first (they are the Data Controller)
- **For account data**: Contact privacy@jiraforge.com
- We will respond within **30 days** (may extend by 60 days for complex requests)

### 10.2 Rights Under CCPA (California, USA)

If you are a California resident, you have the following rights under the California Consumer Privacy Act (CCPA):

1. **Right to Know**:
   - Categories of personal information collected
   - Categories of sources
   - Business or commercial purpose for collection
   - Categories of third parties with whom we share information
   - Specific pieces of personal information collected

2. **Right to Delete**:
   - Request deletion of personal information
   - Subject to exceptions (e.g., completing transactions, legal compliance)

3. **Right to Opt-Out of Sale/Sharing**:
   - **We do NOT sell personal information**
   - We share data with sub-processors for service provision (not considered "sale" under CCPA)

4. **Right to Non-Discrimination**:
   - We will not discriminate against you for exercising your CCPA rights
   - We will not deny services, charge different prices, or provide different quality of service

5. **Right to Correct**:
   - Request correction of inaccurate personal information

6. **Right to Limit Use of Sensitive Personal Information** (as of January 1, 2026):
   - California law now requires risk assessments for processing sensitive personal information
   - **Our Practice**: We minimize collection of sensitive data

**How to Exercise Your Rights**:
- Email: privacy@jiraforge.com
- Subject line: "CCPA Request - [Your Name]"
- Include: Name, email address, description of request
- **Verification**: We will verify your identity before processing requests
- **Response Time**: 45 days (may extend by 45 days for complex requests)

**Authorized Agents**:
- You may designate an authorized agent to submit requests on your behalf
- We will require proof of authorization

### 10.3 Other Privacy Rights (U.S. States)

Several U.S. states have enacted privacy laws similar to CCPA. If you are a resident of Virginia, Colorado, Connecticut, Utah, or other states with privacy laws, you may have similar rights. Contact privacy@jiraforge.com to exercise these rights.

### 10.4 Employee Rights (Workplace Monitoring Context)

If you are an employee being monitored by your Organization:

- **Right to Notice**: Your employer must inform you of monitoring practices
- **Right to Access**: View your own screenshots and activity data via Forge app
- **Right to Consent** (where applicable): Your employer must obtain lawful consent
- **Right to Complain**: Report concerns to your employer's HR department
- **Right to Regulator Complaints**: File complaints with data protection authorities or state agencies

**Note**: Your employer (the Organization) determines the purposes and means of monitoring. Exercise rights with your employer first.

### 10.5 How to Delete Your Account

**For Individual Users**:
1. Contact your Organization administrator to request removal
2. Your Organization will revoke your access
3. Request data export before deletion if desired

**For Organizations**:
1. Cancel subscription via Atlassian Marketplace
2. Uninstall Desktop Application from all devices
3. Uninstall Forge Application from Jira
4. Contact support@jiraforge.com to request account deletion
5. Data will be deleted within **30 days**

**What Gets Deleted**:
- All screenshots and thumbnails
- Screenshot metadata and analysis results
- User profiles and activity logs
- OAuth tokens and consent records

**What Does NOT Get Deleted**:
- Worklogs already synced to Jira (controlled by Atlassian)
- Aggregate, anonymized analytics data
- Legal records required for compliance (e.g., consent logs for 7 years)

---

## 11. COOKIES AND TRACKING TECHNOLOGIES

### 11.1 Desktop Application

The Desktop Application does NOT use cookies or browser-based tracking. It operates as a native Windows application.

### 11.2 Forge Application

The Forge Application runs within Jira Cloud and is subject to Atlassian's cookie policies. We do NOT set additional cookies in the Forge app.

### 11.3 Website (If Applicable)

If we operate a public-facing website, we may use:

- **Essential Cookies**: Required for website functionality (e.g., session management)
- **Analytics Cookies**: To understand website usage (e.g., Google Analytics)
- **Marketing Cookies**: To deliver targeted advertising (if applicable)

**Cookie Consent**: We will display a cookie banner allowing you to accept or reject non-essential cookies (EU ePrivacy Directive compliance).

**How to Control Cookies**: Use your browser settings to block or delete cookies. Note that blocking essential cookies may impair website functionality.

### 11.4 No Third-Party Advertising

We do NOT use third-party advertising networks or sell your data to advertisers.

---

## 12. CHILDREN'S PRIVACY

The Services are NOT intended for individuals under the age of 18. We do not knowingly collect personal information from children.

If you are a parent or guardian and believe your child has provided us with personal information, contact privacy@jiraforge.com. We will promptly delete such information.

**Age Verification**: By using the Services, you represent that you are at least 18 years old or the age of legal majority in your jurisdiction.

---

## 13. CHANGES TO THIS PRIVACY POLICY

### 13.1 How We Update This Policy

We may update this Privacy Policy from time to time to reflect:

- Changes in data collection or processing practices
- New features or services
- Legal or regulatory requirements
- Best practices and industry standards

**Effective Date**: The "Last Updated" date at the top of this Policy indicates when it was last revised.

### 13.2 Notice of Changes

**Minor Changes** (e.g., typos, clarifications):
- Posted on our website immediately
- No additional notice required

**Material Changes** (e.g., new data uses, additional third parties):
- Email notification to account holders at least **30 days** before effective date
- Prominent notice in the Services
- May require re-consent for certain processing activities

### 13.3 Your Acceptance

**Continued use of the Services after changes take effect constitutes acceptance of the updated Privacy Policy.**

If you do not agree to the changes:
- Stop using the Services
- Delete your account before the effective date
- Contact privacy@jiraforge.com with concerns

### 13.4 Version History

Previous versions of this Privacy Policy are available upon request at privacy@jiraforge.com.

---

## 14. CONTACT US

### 14.1 Privacy Inquiries

For questions, concerns, or requests related to this Privacy Policy or your personal data:

**Email**: privacy@jiraforge.com
**Subject Line**: "Privacy Inquiry - [Your Name]"

**Mailing Address**:
JIRAForge
Attn: Data Protection Officer
[PHYSICAL ADDRESS TO BE ADDED]

### 14.2 Data Protection Officer (DPO)

We have appointed a Data Protection Officer to oversee GDPR compliance:

**Email**: dpo@jiraforge.com

### 14.3 Support and Security

**General Support**: support@jiraforge.com
**Security Issues**: security@jiraforge.com
**Legal Inquiries**: legal@jiraforge.com

### 14.4 Response Times

- **Privacy Requests**: 30 days (GDPR), 45 days (CCPA)
- **Security Issues**: 24 hours (initial response)
- **General Support**: 2 business days

---

## 15. DATA PROTECTION IMPACT ASSESSMENT (DPIA)

Under GDPR Article 35, Organizations using JIRAForge for employee monitoring should conduct a Data Protection Impact Assessment (DPIA) because:

1. **Systematic Monitoring**: The Services involve systematic monitoring of employees
2. **Automated Decision-Making**: AI analysis is used (though not for solely automated decisions)
3. **Large-Scale Processing**: May involve processing data of many employees

**We provide a DPIA template** to assist Organizations. Request it at dpo@jiraforge.com.

**DPIA Components**:
- Description of processing operations and purposes
- Assessment of necessity and proportionality
- Assessment of risks to employee rights and freedoms
- Measures to address risks (e.g., encryption, access controls)
- Legitimate interest assessment (if relying on legitimate interest as legal basis)

**Organizational Responsibility**: The Organization (employer) is responsible for conducting the DPIA, not JIRAForge. We provide documentation and support.

---

## 16. SPECIAL CATEGORIES OF PERSONAL DATA

We do NOT intentionally collect "special categories" of personal data under GDPR Article 9, such as:

- Racial or ethnic origin
- Political opinions
- Religious or philosophical beliefs
- Trade union membership
- Genetic data
- Biometric data (for identification purposes)
- Health data
- Sex life or sexual orientation

**However**, screenshots MAY incidentally capture such information if visible on your screen (e.g., a medical appointment visible in a calendar, a health-related browser tab).

**Mitigation Measures**:
- Users can blacklist applications from being captured (e.g., personal health apps)
- Users can pause tracking when handling sensitive personal matters
- AI analysis does NOT attempt to extract or classify special categories of data

**If you are concerned about incidental capture of sensitive data**:
1. Pause tracking when viewing sensitive content
2. Use blacklist feature to exclude specific applications
3. Contact your Organization to discuss privacy concerns

---

## 17. LEGITIMATE INTEREST ASSESSMENT

For Organizations relying on **legitimate interest** as the legal basis for processing (GDPR Article 6(1)(f)), we provide the following assessment framework:

### 17.1 Legitimate Interests Pursued

Potential legitimate interests include:

- **Productivity Monitoring**: Understanding how work time is allocated
- **Project Costing**: Accurate time tracking for billing clients
- **Security**: Detecting unauthorized use of company systems
- **Compliance**: Ensuring employees follow company policies
- **Performance Management**: Identifying training needs

### 17.2 Necessity Test

- Is monitoring necessary to achieve the legitimate interest?
- Are there less intrusive alternatives? (e.g., self-reporting, periodic check-ins)

### 17.3 Balancing Test

- **Impact on Employees**: High (continuous monitoring, screenshots)
- **Employee Expectations**: Employees may not expect this level of monitoring
- **Mitigations**: Transparency, consent, access controls, limited retention

**Outcome**: Legitimate interest may be valid if:
- Employees are clearly informed
- Monitoring is proportionate to business needs
- Employees have some control (e.g., pause tracking)
- Data access is restricted to authorized personnel

**Recommendation**: Organizations should document their legitimate interest assessment and make it available to employees.

---

## 18. EMPLOYEE NOTICE TEMPLATE

To assist Organizations in complying with notice requirements, we provide a sample employee notice:

---

**EMPLOYEE MONITORING NOTICE**

[ORGANIZATION NAME] uses JIRAForge time tracking software to monitor employee work activity. This notice explains what data is collected and how it is used.

**What is Monitored**:
- Full-screen screenshots every [X] minutes
- Window titles and application names
- Active and idle time
- Tasks detected via AI analysis

**Purpose**:
- Time tracking for projects and billing
- Productivity analysis
- Workload allocation

**Who Has Access**:
- Your direct manager: [YES/NO]
- HR department: [YES/NO]
- IT administrators: [YES/NO]

**Your Rights**:
- View your own screenshots and activity data
- Request corrections to inaccurate data
- Request deletion of specific screenshots
- Pause tracking during breaks (if permitted)

**Data Retention**: Screenshots are deleted after 2 months.

**Questions or Concerns**: Contact [HR CONTACT] or privacy@jiraforge.com.

---

Organizations should customize this template and provide it to employees before monitoring begins.

---

## 19. COMPLIANCE SUMMARY

This table summarizes our compliance with major privacy regulations:

| Requirement | GDPR (EU) | CCPA (California) | Status |
|-------------|-----------|-------------------|--------|
| **Notice/Transparency** | Article 13 | §1798.100 | ✅ This Privacy Policy |
| **Lawful Basis** | Article 6 | N/A | ✅ Consent, Legitimate Interest, Contract |
| **Data Minimization** | Article 5(1)(c) | N/A | ⚠️ Screenshots are broad; improving |
| **Purpose Limitation** | Article 5(1)(b) | N/A | ✅ Used only for time tracking |
| **Storage Limitation** | Article 5(1)(e) | N/A | ✅ 2-month retention for files |
| **Right to Access** | Article 15 | §1798.100 | ✅ Via Forge app and requests |
| **Right to Erasure** | Article 17 | §1798.105 | ⚠️ Soft delete only; hard delete in progress |
| **Right to Portability** | Article 20 | N/A | ⚠️ Manual export only; self-service planned |
| **Data Breach Notification** | Article 33 | §1798.82 | ✅ 72-hour notification |
| **DPO Appointment** | Article 37 | N/A | ✅ dpo@jiraforge.com |
| **DPIA** | Article 35 | Risk Assessment (2026) | ⚠️ Template provided; Org responsibility |
| **DPA with Processors** | Article 28 | N/A | ✅ Executed with all sub-processors |
| **International Transfers** | Chapter V | N/A | ✅ SCCs implemented |
| **Consent Management** | Article 7 | N/A | ✅ ConsentManager class |
| **Opt-Out of Sale** | N/A | §1798.120 | ✅ We don't sell data |

---

## 20. RESOURCES AND FURTHER INFORMATION

- **GDPR Full Text**: https://gdpr-info.eu/
- **CCPA Full Text**: https://oag.ca.gov/privacy/ccpa
- **Atlassian Privacy Policy**: https://www.atlassian.com/legal/privacy-policy
- **OpenAI Privacy Policy**: https://openai.com/policies/privacy-policy
- **Supabase Security**: https://supabase.com/security
- **EDPB Guidelines on Employee Monitoring**: https://edpb.europa.eu/

**Employee Monitoring Best Practices**:
- [GDPR Requirements for Employee Monitoring](https://www.monitask.com/en/blog/gdpr-requirements-for-employee-monitoring-a-comprehensive-guide)
- [CCPA Requirements 2026](https://secureprivacy.ai/blog/ccpa-requirements-2026-complete-compliance-guide)
- [Employee Monitoring Laws: Legal Guide 2026](https://flowace.ai/blog/employee-monitoring-laws/)

---

## 21. ACKNOWLEDGMENT

By using JIRAForge, you acknowledge that:

1. You have read and understood this Privacy Policy
2. You consent to the collection, use, and sharing of your information as described
3. You understand that your Organization (employer) has access to monitoring data
4. You understand the limitations of AI analysis
5. You have been informed of your rights under applicable privacy laws

**If you are an Organization administrator**, you acknowledge that:

1. You are responsible for providing notice to employees
2. You will obtain lawful consent or document legitimate interest
3. You will comply with all applicable data protection laws
4. You will implement appropriate access controls
5. You will conduct a DPIA if required

---

**Version 1.0**
**Effective Date: January 21, 2026**

**FOR QUESTIONS OR CONCERNS, CONTACT:**
privacy@jiraforge.com | dpo@jiraforge.com

---

**END OF PRIVACY POLICY**
