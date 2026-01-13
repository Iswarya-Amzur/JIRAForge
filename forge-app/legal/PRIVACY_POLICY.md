# PRIVACY POLICY - BRD TIME TRACKER

**Last Updated:** [INSERT DATE]
**Version:** 1.0

Amzur Technologies, Inc. ("Amzur", "we", "us", or "our") operates the BRD Time Tracker application ("App"), a time tracking solution that integrates with Atlassian Jira. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our App.

Please read this Privacy Policy carefully. By using the App, you consent to the data practices described in this policy.

---

## 1. INFORMATION WE COLLECT

### 1.1 INFORMATION FROM ATLASSIAN (VIA OAUTH 2.0)

When you authenticate with your Atlassian account, we receive:

- **Atlassian Account ID** - Your unique identifier in Atlassian's system
- **Email Address** - Your registered email with Atlassian
- **Display Name** - Your name as shown in Atlassian products
- **Jira Cloud ID** - Your organization's Jira instance identifier
- **Jira Instance URL** - The URL of your Jira Cloud instance

**Legal Basis:** Contract performance (to provide the service you requested)

### 1.2 INFORMATION CAPTURED BY THE DESKTOP APPLICATION

While time tracking is active, the Desktop App collects:

- **Screenshots** - Periodic captures of your screen at configurable intervals (default: every 5 minutes)
- **Window Titles** - The title of your active application window
- **Application Names** - The name of the currently focused application
- **Timestamps** - Date and time of each capture
- **Duration** - Calculated time spent on activities
- **Keyboard/Mouse Activity** - Only to detect idle state (activity is NOT logged)

**IMPORTANT:** Screenshots are ONLY captured when:
- You have explicitly started tracking
- You have provided consent
- You are NOT in idle state (no activity for 5+ minutes)

**Legal Basis:** Consent (you explicitly agree before any data is collected)

### 1.3 INFORMATION FROM JIRA

To match your activities to tasks, we access:

- Your assigned Jira issues (issue keys, summaries, project keys)
- Jira project information
- Worklog data (we create worklogs on your behalf)

**Legal Basis:** Contract performance

### 1.4 AUTOMATICALLY COLLECTED INFORMATION

- **IP Address** - Logged for security and audit purposes
- **User Agent** - Browser/client identification
- **Activity timestamps** - When you perform actions in the App

**Legal Basis:** Legitimate interest (security and service improvement)

---

## 2. HOW WE USE YOUR INFORMATION

We use collected information to:

### 2.1 PROVIDE CORE FUNCTIONALITY
- Capture screenshots during active tracking sessions
- Analyze screenshots using AI to identify relevant Jira tasks
- Calculate time spent on different activities
- Create worklogs in your Jira instance
- Display time tracking reports and analytics

### 2.2 IMPROVE THE SERVICE
- Analyze usage patterns to improve AI accuracy
- Debug issues and provide support
- Monitor system performance

### 2.3 SECURITY AND COMPLIANCE
- Detect and prevent unauthorized access
- Maintain audit logs
- Comply with legal obligations

---

## 3. AI PROCESSING AND THIRD-PARTY SERVICES

### 3.1 SCREENSHOT ANALYSIS

Screenshots are analyzed by artificial intelligence to:
- Identify which Jira task you may be working on
- Classify work type (office work, non-office, etc.)
- Extract relevant context from screen content

**AI Provider Details:**
- **Primary:** LiteLLM Proxy (hosted by Amzur Technologies)
- **Models Used:** GPT-4o (OpenAI), Gemini (Google), or Qwen (Fireworks)
- **Processing:** Images are sent to AI for analysis and immediately discarded
- **Retention by AI:** OpenAI may retain data for up to 30 days for abuse monitoring (NOT used for model training per our enterprise agreement)

### 3.2 DATA STORAGE - SUPABASE

All application data is stored in Supabase:
- **Provider:** Supabase (https://supabase.com)
- **Infrastructure:** Amazon Web Services (AWS)
- **Region:** [SPECIFY YOUR REGION - e.g., US East (N. Virginia)]
- **Encryption:** AES-256 at rest, TLS 1.2+ in transit

### 3.3 ATLASSIAN INTEGRATION

We interact with Atlassian services to:
- Authenticate users via OAuth 2.0
- Read Jira issue data
- Create worklogs in Jira

Atlassian's privacy practices: https://www.atlassian.com/legal/privacy-policy

---

## 4. DATA STORAGE AND SECURITY

### 4.1 STORAGE LOCATIONS

| Data Type | Storage Location | Encryption |
|-----------|------------------|------------|
| User profiles | Supabase PostgreSQL | AES-256 at rest |
| Screenshots | Supabase Storage (S3) | AES-256 at rest |
| Analysis results | Supabase PostgreSQL | AES-256 at rest |
| Activity logs | Supabase PostgreSQL | AES-256 at rest |
| Consent records | Local device + Supabase | AES-256 at rest |

### 4.2 SECURITY MEASURES

- All data encrypted in transit using TLS 1.2 or higher
- All data encrypted at rest using AES-256
- Row-Level Security (RLS) ensures tenant data isolation
- OAuth 2.0 authentication (we never store your Atlassian password)
- Private storage buckets (no public access to screenshots)
- Regular security audits and vulnerability scanning

### 4.3 ACCESS CONTROLS

- Your data is only accessible to you and authorized personnel in your organization (based on roles configured by your admin)
- Amzur support staff may access data only for troubleshooting with your explicit permission
- We do not sell or share your data with third parties for marketing

---

## 5. DATA RETENTION

### 5.1 RETENTION PERIODS

| Data Type | Retention Period |
|-----------|------------------|
| Screenshot files | 2 months (automatically deleted on 1st of each month for files older than 2 months) |
| Screenshot metadata | Retained until account/organization deletion |
| Analysis results | Retained until account/organization deletion |
| User profile | Retained until account deletion |
| Worklogs in Jira | Governed by your Jira retention policy |
| Consent records | Retained for compliance purposes |
| Activity logs | 12 months |

### 5.2 AUTOMATIC CLEANUP

Our cleanup service automatically deletes screenshot files older than 2 months to minimize data storage. Database records are retained for time tracking history and reporting purposes.

---

## 6. YOUR RIGHTS AND CHOICES

### 6.1 CONSENT MANAGEMENT

- You must provide explicit consent before any screenshots are captured
- You can revoke consent at any time through the Desktop App settings
- Revoking consent stops all future data collection
- Previously collected data remains until you request deletion

### 6.2 DATA ACCESS

You have the right to:
- View all screenshots captured from your account
- Access your time tracking history and reports
- Export your data (contact support)

### 6.3 DATA DELETION

You have the right to:
- Delete individual screenshots from your dashboard
- Request deletion of all your data by contacting support@amzur.com
- Upon organization uninstallation, all organization data is marked for deletion

### 6.4 DATA PORTABILITY

You can request an export of your data in a machine-readable format by contacting support@amzur.com.

### 6.5 TRACKING CONTROLS

- **Start/Stop:** You control when tracking is active
- **Pause:** You can pause tracking at any time
- **Private Apps:** Configure apps that should never be tracked
- **Blacklist:** Block specific applications from tracking

---

## 7. GDPR COMPLIANCE (FOR EU USERS)

If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):

### 7.1 DATA CONTROLLER AND PROCESSOR

- **Data Controller:** Your organization (the entity that deployed the App)
- **Data Processor:** Amzur Technologies, Inc.
- **Sub-processors:** Supabase, OpenAI/Google (AI processing), Atlassian

### 7.2 LEGAL BASES FOR PROCESSING

| Processing Activity | Legal Basis |
|---------------------|-------------|
| Account creation | Contract performance |
| Screenshot capture | Consent |
| AI analysis | Consent |
| Worklog creation | Contract performance |
| Security logging | Legitimate interest |
| Analytics | Legitimate interest |

### 7.3 YOUR GDPR RIGHTS

- Right to Access (Article 15)
- Right to Rectification (Article 16)
- Right to Erasure / "Right to be Forgotten" (Article 17)
- Right to Restrict Processing (Article 18)
- Right to Data Portability (Article 20)
- Right to Object (Article 21)
- Right to Withdraw Consent (Article 7)

To exercise these rights, contact: privacy@amzur.com

### 7.4 DATA TRANSFERS

Data may be transferred to the United States for processing. We ensure appropriate safeguards through:
- Standard Contractual Clauses (SCCs)
- Supabase's compliance certifications (SOC 2 Type II)

---

## 8. CHILDREN'S PRIVACY

The App is not intended for individuals under 16 years of age. We do not knowingly collect personal information from children under 16. If you become aware that a child has provided us with personal information, please contact us.

---

## 9. CHANGES TO THIS PRIVACY POLICY

We may update this Privacy Policy from time to time. Changes will be:
- Posted on this page with an updated "Last Updated" date
- Communicated through the App if changes are significant
- Effective immediately upon posting unless otherwise stated

If we make material changes to how we treat your personal information, we will notify you through the App and may require re-consent.

---

## 10. CONTACT US

If you have questions about this Privacy Policy or our data practices:

**Amzur Technologies, Inc.**
Email: privacy@amzur.com
Website: https://amzur.com
Support: support@amzur.com

For GDPR-related inquiries:
Data Protection Contact: privacy@amzur.com

---

## 11. DATA PROCESSING AGREEMENT

Enterprise customers may request a Data Processing Agreement (DPA) that includes Standard Contractual Clauses. Contact sales@amzur.com for details.
