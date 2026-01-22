# END USER LICENSE AGREEMENT (EULA)

**JIRAForge Time Tracking System**
**Desktop Application and Forge Application**

**Effective Date:** January 21, 2026
**Last Updated:** January 21, 2026

---

## 1. ACCEPTANCE OF TERMS

This End User License Agreement ("Agreement" or "EULA") is a legal agreement between you (either an individual or a single entity, referred to as "You," "Your," or "User") and JIRAForge ("Company," "We," "Us," or "Our") for the use of:

1. **Desktop Application** - JIRAForge Time Tracker (Windows desktop software)
2. **Forge Application** - JIRAForge app installed on Atlassian Jira Cloud

BY INSTALLING, ACCESSING, OR USING THE SOFTWARE, YOU AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT INSTALL OR USE THE SOFTWARE.

---

## 2. DEFINITIONS

- **"Software"** means both the Desktop Application and Forge Application, including all updates, modifications, and documentation.
- **"Organization"** means the legal entity (company, institution, or organization) that has purchased or subscribed to the Software.
- **"Employee"** or **"End User"** means an individual authorized by the Organization to use the Software.
- **"Screenshot Data"** means screen captures, thumbnails, window titles, application names, and associated metadata collected by the Software.
- **"Services"** means cloud-based services provided by JIRAForge, including data storage, AI analysis, and synchronization.
- **"Atlassian Platform"** means Jira Cloud and related Atlassian services.

---

## 3. LICENSE GRANT

### 3.1 Desktop Application License

Subject to the terms of this Agreement, We grant You a limited, non-exclusive, non-transferable, revocable license to:

- Install and use the Desktop Application on devices owned or controlled by the Organization
- Use the Desktop Application for employee time tracking and productivity monitoring purposes
- Access Services associated with the Desktop Application

### 3.2 Forge Application License

Subject to the terms of this Agreement and Atlassian's Forge Terms, We grant You a limited, non-exclusive, non-transferable, revocable license to:

- Install and use the Forge Application within Your Jira Cloud instance
- Access time tracking dashboards and reports
- Create and manage worklogs based on tracked activity

### 3.3 License Restrictions

You shall NOT:

- Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Software
- Modify, adapt, translate, or create derivative works based on the Software
- Remove, alter, or obscure any proprietary notices on the Software
- Rent, lease, lend, sell, sublicense, or distribute the Software to third parties
- Use the Software for any illegal, unauthorized, or malicious purposes
- Circumvent or disable any security features or usage limitations
- Use the Software to monitor individuals without proper authorization and consent
- Share, distribute, or publicly disclose Screenshot Data of other users
- Access or use the Software to build a competitive product or service

---

## 4. ORGANIZATIONAL RESPONSIBILITY

### 4.1 Employer Obligations

If You are an Organization deploying the Software to monitor employees:

1. **Legal Compliance**: You are solely responsible for ensuring Your use of the Software complies with all applicable laws, including but not limited to:
   - General Data Protection Regulation (GDPR) - EU
   - California Consumer Privacy Act (CCPA) - United States
   - Electronic Communications Privacy Act (ECPA) - United States
   - State and local employee monitoring laws
   - Employment contracts and labor agreements

2. **Employee Notice**: You must provide clear, conspicuous notice to all employees that they will be monitored, including:
   - The fact that screenshot monitoring is active
   - The frequency of screenshot capture (default: every 15 minutes)
   - What data is collected (see Privacy Policy)
   - How data will be used and who has access
   - Employee rights regarding the data

3. **Consent**: You must obtain legally valid consent from employees where required by applicable law. Note: In employment contexts, consent may not be a valid legal basis under GDPR due to power imbalances. Organizations should rely on legitimate interest with proper balancing assessments.

4. **Data Controller Role**: The Organization acts as the Data Controller under GDPR. We act as a Data Processor. You are responsible for fulfilling all Data Controller obligations.

5. **Access Control**: You must implement appropriate access controls to ensure Screenshot Data is accessed only by authorized personnel with legitimate business needs.

### 4.2 Individual User Obligations

If You are an individual employee using the Software:

1. You represent that You have been authorized by Your employer to use the Software
2. You acknowledge that Your activity will be monitored as described in the Privacy Policy
3. You may not disable, circumvent, or interfere with the monitoring functionality
4. You are responsible for the security of Your Atlassian account credentials

---

## 5. DATA COLLECTION AND PRIVACY

### 5.1 Data Collected

The Software collects the following data:

**Desktop Application:**
- **Screenshots**: Full-screen PNG images captured at configurable intervals (default: 15 minutes)
- **Thumbnails**: Compressed JPEG versions of screenshots
- **Window Metadata**: Active window title, application name, timestamp
- **Activity Metadata**: Duration, idle state, start/end times
- **User Identity**: Atlassian Account ID, email, display name, organization
- **Jira Context**: Assigned issues, project keys, task associations

**Activity Detection (NOT Keylogging):**
- The Software monitors mouse and keyboard **activity only** to detect if the user is idle
- **No keystroke logging**: Individual keys pressed are NOT recorded or transmitted
- **No mouse tracking**: Exact cursor positions or click locations are NOT recorded
- Activity detection is used solely to determine if >5 minutes of inactivity has occurred
- During idle periods, screenshots are paused (configurable)

**Forge Application:**
- User profile data from Atlassian (email, name, account ID)
- Worklog entries created by users
- Dashboard and report access logs

### 5.2 How Data is Used

We use collected data to:

1. **Time Tracking**: Calculate time spent on tasks and projects
2. **AI Analysis**: Analyze screenshots to detect active Jira issues and categorize work
3. **Worklog Automation**: Suggest or auto-create Jira worklogs
4. **Reporting**: Generate productivity reports and dashboards
5. **Service Improvement**: Improve AI accuracy and Software functionality
6. **Security**: Detect and prevent unauthorized access or misuse

### 5.3 Third-Party Data Sharing

Screenshot Data is shared with the following third-party services:

| Service | Purpose | Data Shared | Data Retention |
|---------|---------|-------------|-----------------|
| **Supabase** | Cloud storage and database | All collected data | Per retention policy (2 months for files) |
| **OpenAI** | AI screenshot analysis | Full screenshots, window titles, Jira context | 30 days (not used for training) |
| **Fireworks AI** | Primary AI vision analysis | Full screenshots, window titles | Per Fireworks policy |
| **Google Gemini** | Fallback AI analysis | Full screenshots | Per Google policy |
| **Atlassian Jira** | OAuth authentication, worklog creation | User identity, worklog entries | Per Atlassian policy |

**Data Processing Agreements**: We have executed Data Processing Addendums (DPAs) with all sub-processors handling personal data.

### 5.4 Privacy Policy

For complete details on data collection, use, storage, retention, and Your rights, please review our separate **Privacy Policy** at [URL TO BE ADDED].

---

## 6. DATA RETENTION AND DELETION

### 6.1 Retention Periods

- **Screenshot Files**: Automatically deleted after **2 months** from capture date
- **Screenshot Metadata**: Retained until user or organization deletion request
- **Analysis Results**: Retained until user or organization deletion request
- **User Profiles**: Retained for duration of subscription
- **Activity Logs**: Retained for **12 months**

### 6.2 Data Deletion

- **Individual Screenshots**: Users can delete individual screenshots via the Forge app dashboard
- **Bulk Deletion**: Contact support@jiraforge.com to request bulk data deletion
- **Account Deletion**: Upon account deletion, all associated data will be permanently deleted within **30 days**
- **Organization Offboarding**: Upon subscription termination, all organization data will be permanently deleted within **30 days**

**Note**: Soft delete (setting `deleted_at` flag) is currently used. We are implementing hard delete functionality for GDPR Article 17 compliance.

---

## 7. SECURITY

### 7.1 Our Security Measures

We implement industry-standard security measures:

- **Encryption in Transit**: TLS 1.2+ for all network communications
- **Encryption at Rest**: AES-256 encryption for cloud storage (Supabase)
- **Authentication**: OAuth 2.0 with PKCE for secure authentication
- **Access Control**: Row-Level Security (RLS) policies to isolate user data
- **Token Security**: OAuth refresh tokens rotated on each use
- **Monitoring**: Activity logging and anomaly detection

### 7.2 Known Security Gaps (To Be Addressed)

We are actively working to remediate the following security issues:

1. **Local SQLite Database**: Currently unencrypted. We are implementing SQLCipher encryption.
2. **OAuth Token Storage**: Tokens currently stored in plain JSON. We are migrating to Windows Credential Manager.
3. **Hardcoded Admin Password**: Default admin password exists. First-run password generation will be implemented.

### 7.3 Your Security Responsibilities

You are responsible for:

- Maintaining the confidentiality of Atlassian account credentials
- Securing devices where the Desktop Application is installed
- Implementing organizational access controls
- Promptly reporting any suspected security breaches to security@jiraforge.com

---

## 8. SYSTEM REQUIREMENTS AND PERMISSIONS

### 8.1 Desktop Application Requirements

**Operating System:**
- Windows 10 or later (64-bit)

**Permissions Required:**
- **Screen Capture**: Required for screenshot functionality
- **Window Detection**: Required to detect active applications
- **File System Access**:
  - Read/Write to `%LOCALAPPDATA%\TimeTracker\`
  - Read/Write to `%TEMP%\` for OAuth callbacks
- **Network Access**: Required for cloud synchronization and OAuth
- **Local Web Server**: Binds to `localhost:51777` for OAuth callbacks

**Third-Party Services:**
- Active internet connection
- Atlassian Jira Cloud account
- Compatible with screen readers and accessibility tools

### 8.2 Forge Application Requirements

- Atlassian Jira Cloud (not compatible with Jira Server/Data Center)
- Organization administrator privileges for installation
- Modern web browser (Chrome, Firefox, Safari, Edge)

---

## 9. AI ANALYSIS DISCLAIMER

### 9.1 AI Accuracy

The Software uses artificial intelligence to analyze screenshots and detect active Jira tasks. AI analysis is **not 100% accurate**. Accuracy depends on:

- Visual clarity of the screenshot
- Presence of visible Jira issue keys
- Context provided by window titles
- Quality of training data

**Confidence Scores**: Each AI analysis includes a confidence score (0-1). Scores below 0.7 indicate lower confidence and should be manually reviewed.

### 9.2 No Warranties on AI Output

WE MAKE NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING:

- The accuracy, completeness, or reliability of AI analysis results
- The suitability of AI-generated worklog suggestions
- The categorization of work types (office vs. non-office)
- The detection of unassigned work

### 9.3 Human Review Required

Organizations and users should:

- Manually review AI-detected task assignments before approving worklogs
- Verify time allocations for accuracy
- Report inaccuracies to improve future analysis
- Not rely solely on AI output for performance evaluations or disciplinary actions

### 9.4 Continuous Improvement

AI models are continuously retrained and updated. Model updates may result in:

- Changes to analysis accuracy
- Different task detection behavior
- Modified confidence scores

---

## 10. INTELLECTUAL PROPERTY

### 10.1 Software Ownership

The Software, including all intellectual property rights, is and shall remain the exclusive property of JIRAForge. This Agreement does not grant You any ownership rights to the Software.

### 10.2 User Data Ownership

You retain all ownership rights to Your data, including Screenshot Data, worklog entries, and other content submitted through the Software.

### 10.3 Feedback License

If You provide feedback, suggestions, or ideas about the Software ("Feedback"), You grant Us a perpetual, irrevocable, worldwide, royalty-free license to use, modify, and incorporate such Feedback into the Software without attribution or compensation.

---

## 11. SUBSCRIPTION AND PAYMENT

### 11.1 Pricing Model

The Software is offered under a usage-based subscription model:

- **Forge Application**: Priced per tracked user/month (see Atlassian Marketplace listing)
- **Desktop Application**: Included with Forge subscription
- **AI Analysis**: Included (subject to usage-based limits)

### 11.2 Free Trial

We may offer a free trial period. During the trial:

- Full functionality is available
- No payment information required initially
- Data retention policies apply
- Trial automatically expires unless subscription is activated

### 11.3 Payment Terms

- Payments are processed through Atlassian Marketplace
- Subscriptions are billed monthly or annually (Your choice)
- Pricing is subject to change with 30 days' notice
- Refunds are subject to Atlassian Marketplace policies

### 11.4 Suspension for Non-Payment

If payment fails or subscription lapses:

- Access to the Forge Application will be suspended
- Desktop Application will stop capturing screenshots
- Data will be retained for **30 days** to allow reactivation
- After 30 days, data may be permanently deleted

---

## 12. UPDATES AND MAINTENANCE

### 12.1 Automatic Updates

The Desktop Application may automatically download and install updates. You agree to receive such updates as part of Your use of the Software.

### 12.2 Update Types

- **Security Updates**: Critical security patches (automatic, immediate)
- **Feature Updates**: New functionality and improvements (automatic, scheduled)
- **Major Version Updates**: Significant architectural changes (may require manual action)

### 12.3 Maintenance Windows

We perform scheduled maintenance on cloud Services:

- **Scheduled Maintenance**: Announced 7 days in advance
- **Emergency Maintenance**: May occur without advance notice
- **Service Availability**: We target 99.5% uptime (excluding scheduled maintenance)

---

## 13. TERMINATION

### 13.1 Termination by You

You may terminate this Agreement at any time by:

1. Uninstalling the Desktop Application from all devices
2. Uninstalling the Forge Application from Your Jira instance
3. Canceling Your subscription through Atlassian Marketplace
4. Contacting support@jiraforge.com to request account deletion

### 13.2 Termination by Us

We may terminate or suspend Your access immediately if:

- You breach any term of this Agreement
- You use the Software for illegal or unauthorized purposes
- Your subscription payment fails and remains unresolved for 15 days
- We are required to do so by law or legal process
- We discontinue the Software (with 90 days' notice)

### 13.3 Effect of Termination

Upon termination:

- Your license to use the Software immediately ceases
- You must uninstall the Desktop Application from all devices
- Access to the Forge Application will be revoked
- Your data will be retained for **30 days** to allow export requests
- After 30 days, all data will be permanently deleted unless otherwise required by law

### 13.4 Data Export Before Termination

To export Your data before termination, contact support@jiraforge.com at least **14 days** before Your intended termination date. We will provide Your data in CSV and JSON formats.

**Note**: Self-service data export is not currently available but is planned for implementation.

---

## 14. LIMITATION OF LIABILITY

### 14.1 Disclaimer of Warranties

THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:

- IMPLIED WARRANTIES OF MERCHANTABILITY
- FITNESS FOR A PARTICULAR PURPOSE
- NON-INFRINGEMENT
- ACCURACY OR RELIABILITY OF DATA
- UNINTERRUPTED OR ERROR-FREE OPERATION

### 14.2 Limitation of Damages

TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL JIRAFORGE BE LIABLE FOR:

1. **Indirect, Incidental, Special, Consequential, or Punitive Damages**, including but not limited to:
   - Loss of profits, revenue, or business opportunities
   - Loss of data or information
   - Cost of substitute services
   - Business interruption
   - Reputational harm

2. **Direct Damages exceeding the amount You paid to Us in the 12 months preceding the claim**

### 14.3 Exceptions

Some jurisdictions do not allow the exclusion or limitation of certain warranties or liabilities. In such jurisdictions, Our liability shall be limited to the greatest extent permitted by law.

### 14.4 AI Analysis Liability

We are not liable for:

- Inaccurate task detection or time allocation by AI
- Business decisions made based on AI analysis results
- Employment actions (discipline, termination, promotion) based on tracked data
- Disputes arising from AI-generated worklogs or reports

---

## 15. INDEMNIFICATION

### 15.1 Your Indemnification Obligations

You agree to indemnify, defend, and hold harmless JIRAForge, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising from:

1. Your use or misuse of the Software
2. Your violation of this Agreement
3. Your violation of any applicable laws or regulations
4. Your violation of third-party rights, including employee privacy rights
5. Your failure to obtain proper employee consent or provide adequate notice
6. Employment-related claims arising from Your use of monitoring data

### 15.2 Procedure

If You are obligated to indemnify Us:

- We will provide prompt notice of any claim
- You will have sole control of the defense and settlement (with Our approval)
- We will cooperate reasonably in the defense
- You will not settle any claim that imposes obligations on Us without Our written consent

---

## 16. COMPLIANCE WITH LAWS

### 16.1 General Compliance

You agree to comply with all applicable laws and regulations in Your use of the Software, including but not limited to:

- Data protection and privacy laws (GDPR, CCPA, etc.)
- Employment and labor laws
- Electronic surveillance and wiretapping laws
- Export control laws
- Anti-discrimination laws

### 16.2 Prohibited Jurisdictions

You may not use the Software if:

- You are located in a country subject to U.S. embargo or trade sanctions
- You are on any U.S. list of prohibited or restricted parties
- Local laws prohibit employee monitoring or screenshot capture

### 16.3 Export Compliance

The Software may be subject to U.S. export control laws. You agree not to export or re-export the Software to prohibited countries or persons.

---

## 17. DISPUTE RESOLUTION

### 17.1 Governing Law

This Agreement shall be governed by and construed in accordance with the laws of **[JURISDICTION TO BE SPECIFIED]**, without regard to its conflict of law provisions.

### 17.2 Arbitration

Any dispute arising from this Agreement shall be resolved through binding arbitration in accordance with the rules of **[ARBITRATION BODY TO BE SPECIFIED]**, except that:

- Either party may seek injunctive relief in court for intellectual property violations
- You may bring claims in small claims court if they qualify

### 17.3 Class Action Waiver

You agree to bring claims against Us only in Your individual capacity and not as a plaintiff or class member in any class or representative action.

### 17.4 Informal Resolution

Before initiating arbitration, You agree to first contact Us at legal@jiraforge.com to attempt informal resolution for at least **30 days**.

---

## 18. GENERAL PROVISIONS

### 18.1 Entire Agreement

This Agreement, together with the Privacy Policy and Terms of Service, constitutes the entire agreement between You and JIRAForge regarding the Software and supersedes all prior agreements and understandings.

### 18.2 Amendments

We may modify this Agreement by:

- Posting the updated Agreement on our website
- Notifying You via email (for material changes)
- Requiring acceptance before continued use (for material changes)

Continued use of the Software after modifications constitutes acceptance, except for material changes requiring explicit consent.

### 18.3 Severability

If any provision of this Agreement is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force.

### 18.4 Waiver

No waiver of any term of this Agreement shall be deemed a further or continuing waiver of such term or any other term.

### 18.5 Assignment

You may not assign or transfer this Agreement without Our prior written consent. We may assign this Agreement to any affiliate or successor without Your consent.

### 18.6 Force Majeure

We shall not be liable for any failure to perform due to causes beyond Our reasonable control, including natural disasters, war, terrorism, labor disputes, or internet service provider failures.

### 18.7 Notices

All notices under this Agreement shall be sent to:

**To JIRAForge:**
Email: legal@jiraforge.com
Address: [PHYSICAL ADDRESS TO BE ADDED]

**To You:**
The email address associated with Your Atlassian account

### 18.8 Third-Party Beneficiaries

This Agreement does not create any third-party beneficiary rights except as expressly stated.

### 18.9 Survival

The following sections shall survive termination of this Agreement: Sections 5 (Data Collection), 7 (Security - Your Responsibilities), 10 (Intellectual Property), 14 (Limitation of Liability), 15 (Indemnification), 17 (Dispute Resolution), and 18 (General Provisions).

---

## 19. CONTACT INFORMATION

For questions about this EULA, please contact:

**JIRAForge Support**
Email: support@jiraforge.com
Legal Inquiries: legal@jiraforge.com
Security Issues: security@jiraforge.com
Data Protection Officer: dpo@jiraforge.com

Website: [URL TO BE ADDED]
Documentation: [URL TO BE ADDED]

---

## 20. ACKNOWLEDGMENT

BY INSTALLING OR USING THE SOFTWARE, YOU ACKNOWLEDGE THAT:

1. You have read and understood this Agreement
2. You agree to be bound by its terms
3. You have the authority to enter into this Agreement
4. If representing an Organization, You have the authority to bind that Organization
5. You have reviewed the Privacy Policy and Terms of Service
6. You understand the data collection and AI analysis practices
7. You will comply with all applicable laws regarding employee monitoring

**Version 1.0**
**Effective Date: January 21, 2026**

---

**END OF END USER LICENSE AGREEMENT**
