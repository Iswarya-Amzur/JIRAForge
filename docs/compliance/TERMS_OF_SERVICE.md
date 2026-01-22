# TERMS OF SERVICE

**JIRAForge Time Tracking System**

**Effective Date:** January 21, 2026
**Last Updated:** January 21, 2026

---

## 1. INTRODUCTION

Welcome to JIRAForge! These Terms of Service ("Terms," "ToS," or "Agreement") govern Your access to and use of the JIRAForge time tracking and productivity monitoring system, including:

1. **Desktop Application** - Windows time tracking client
2. **Forge Application** - Jira Cloud app for reporting and worklog management
3. **Cloud Services** - Backend services, AI analysis, and data storage
4. **Documentation** - User guides, API documentation, and support materials

These Terms constitute a legally binding agreement between You (the "User," "You," or "Your") and JIRAForge ("Company," "We," "Us," or "Our").

**BY ACCESSING OR USING ANY PART OF THE SERVICES, YOU AGREE TO BE BOUND BY THESE TERMS. IF YOU DO NOT AGREE, DO NOT USE THE SERVICES.**

---

## 2. DEFINITIONS

- **"Account"** - Your authorized access to the Services, tied to Your Atlassian account
- **"Content"** - Any data, information, text, graphics, or other materials uploaded or generated through the Services
- **"Customer Data"** - Data submitted by or on behalf of You through the Services
- **"Documentation"** - Our official user guides, technical documentation, and support materials
- **"Forge Platform"** - Atlassian's Forge development platform and related services
- **"Jira"** - Atlassian Jira Cloud project management software
- **"Organization"** - The legal entity that has subscribed to the Services
- **"Personal Data"** - Data relating to an identified or identifiable individual
- **"Services"** - All JIRAForge products, features, and services collectively
- **"Subscription"** - Your active, paid access to the Services
- **"Third-Party Services"** - Services provided by third parties that integrate with or are accessed through our Services

---

## 3. ELIGIBILITY AND ACCOUNT REQUIREMENTS

### 3.1 Eligibility

To use the Services, You must:

- Be at least 18 years of age or the age of legal majority in Your jurisdiction
- Have the legal capacity to enter into binding contracts
- Not be prohibited from using the Services under applicable laws
- Not be located in a country subject to U.S. embargo or trade sanctions
- Have a valid Atlassian Jira Cloud account

### 3.2 Organization Accounts

If You are using the Services on behalf of an Organization:

- You represent that You have the authority to bind the Organization to these Terms
- The Organization is the "Customer" and is responsible for all actions of its authorized users
- The Organization is responsible for maintaining the confidentiality of account credentials
- The Organization must ensure all users comply with these Terms

### 3.3 Account Registration

To use the Services:

1. Install the Forge Application from the Atlassian Marketplace
2. Authenticate with Your Atlassian account via OAuth 2.0
3. Install the Desktop Application on authorized devices
4. Provide accurate, complete, and current information
5. Accept the EULA, these Terms, and our Privacy Policy

### 3.4 Account Security

You are responsible for:

- Maintaining the confidentiality of Your Atlassian account credentials
- All activities that occur under Your account
- Notifying Us immediately of any unauthorized access or security breach
- Using reasonable security measures to prevent unauthorized access

We are not liable for any loss or damage arising from Your failure to maintain account security.

---

## 4. DESCRIPTION OF SERVICES

### 4.1 Desktop Application Features

The Desktop Application provides:

- **Automated Screenshot Capture**: Captures full-screen images at configurable intervals (default: every 15 minutes)
- **Activity Monitoring**: Detects active windows, application names, and idle periods
- **Offline Support**: Stores data locally when internet is unavailable; syncs when online
- **Privacy Controls**: Allows pausing tracking, blacklisting applications, and managing consent
- **Jira Integration**: Fetches assigned issues and suggests task associations

**Important Clarification - No Keylogging:**
- The Desktop Application monitors mouse and keyboard **activity** (movement/presses occur) ONLY to detect idle status
- Individual keystrokes, keys pressed, or text typed are **NOT** recorded, logged, or transmitted
- Mouse coordinates and click locations are **NOT** tracked
- Activity detection is used solely to determine if the user has been idle for >5 minutes (configurable)

### 4.2 Forge Application Features

The Forge Application provides:

- **Dashboard**: View screenshots, time allocations, and project breakdowns
- **Team Analytics**: Organization admins can view aggregated team data (NOT individual screenshots)
- **Project Analytics**: Project admins can view time spent on their projects
- **Worklog Management**: Create, edit, and sync worklogs to Jira
- **AI Analysis Results**: View AI-detected task assignments and confidence scores
- **Reporting**: Generate time tracking reports and exports

### 4.3 AI Analysis Services

Our AI analysis services:

- Analyze screenshots to detect visible Jira issue keys
- Use window titles and application names for context
- Classify work types (office work vs. non-office)
- Generate confidence scores (0-1 scale) for task detection
- Suggest worklog entries based on detected activity

**AI Limitations:**
- AI analysis is **NOT** 100% accurate
- Confidence scores below 0.7 indicate uncertainty
- Human review and approval is **REQUIRED** before creating worklogs
- AI models may change, affecting detection behavior

### 4.4 Cloud Services

Our cloud infrastructure provides:

- **Data Storage**: Secure storage via Supabase (PostgreSQL + S3-compatible storage)
- **Authentication**: OAuth 2.0 with PKCE via Atlassian
- **Synchronization**: Automatic sync between Desktop and Forge apps
- **Backup**: Regular backups of database (NOT user-accessible)
- **API Access**: RESTful APIs for integration (future feature)

### 4.5 Service Availability

- **Target Uptime**: 99.5% availability (excluding scheduled maintenance)
- **Scheduled Maintenance**: Announced 7 days in advance when possible
- **Emergency Maintenance**: May occur without advance notice for critical issues
- **Service Status**: [STATUS PAGE URL TO BE ADDED]

---

## 5. ACCEPTABLE USE POLICY

### 5.1 Permitted Uses

You may use the Services to:

- Track employee work time for legitimate business purposes
- Monitor productivity and task completion
- Generate time reports for billing or project management
- Integrate time data with Jira worklogs
- Analyze team productivity at an aggregate level

### 5.2 Prohibited Uses

You shall NOT use the Services to:

1. **Violate Laws**:
   - Violate any applicable local, state, national, or international law
   - Violate employee privacy rights or surveillance laws
   - Monitor employees without proper legal authorization and notice

2. **Harm Others**:
   - Harass, abuse, threaten, or intimidate individuals
   - Discriminate based on protected characteristics
   - Make employment decisions (termination, discipline) based solely on automated AI analysis

3. **Misuse Data**:
   - Access, collect, or store data You are not authorized to access
   - Share or publicly disclose other users' Screenshot Data without authorization
   - Scrape or extract data using automated tools
   - Use data for purposes unrelated to time tracking and productivity

4. **Compromise Security**:
   - Attempt to gain unauthorized access to the Services or systems
   - Introduce viruses, malware, or malicious code
   - Reverse engineer, decompile, or disassemble the Software
   - Circumvent security features or usage limitations
   - Conduct penetration testing without prior written authorization

5. **Interfere with Services**:
   - Overload or disrupt servers or networks
   - Launch denial-of-service (DoS) attacks
   - Interfere with other users' access to the Services

6. **Impersonate or Mislead**:
   - Impersonate any person or entity
   - Misrepresent Your affiliation with any person or entity
   - Provide false or misleading information during registration

7. **Competitive Use**:
   - Use the Services to develop a competing product
   - Benchmark the Services without written permission
   - Publicly disclose performance metrics without written permission

### 5.3 Monitoring Compliance

We reserve the right to:

- Investigate suspected violations of these Terms
- Report illegal activity to law enforcement
- Suspend or terminate accounts engaged in prohibited activity
- Remove or disable Content that violates these Terms

---

## 6. EMPLOYEE MONITORING REQUIREMENTS

### 6.1 Organizational Responsibilities

If You are an Organization using the Services to monitor employees, You MUST:

1. **Provide Clear Notice**: Inform all employees in writing that they will be monitored, including:
   - The fact that screenshot monitoring is active
   - Frequency of screenshot capture
   - Types of data collected
   - How data will be used and who has access
   - Data retention periods
   - Employee rights regarding their data

2. **Obtain Lawful Consent**:
   - Obtain consent where required by applicable law
   - Note: Under GDPR, consent may not be valid in employment contexts due to power imbalances
   - Organizations should document legitimate interest assessments
   - Maintain records of consent or other legal bases

3. **Comply with Jurisdiction-Specific Laws**:
   - **European Union (GDPR)**:
     - Conduct Data Protection Impact Assessment (DPIA) for automated processing
     - Implement data minimization (only collect necessary data)
     - Honor employee data subject rights (access, erasure, portability)
     - Maintain records of processing activities
   - **California (CCPA)**:
     - Provide notice at or before collection
     - Allow employees to opt-out of sale/sharing (if applicable)
     - As of January 1, 2026: Conduct risk assessments for sensitive personal information
   - **Other U.S. States**:
     - Comply with state-specific employee monitoring notice requirements
     - Check Connecticut, Delaware, New York, and other state laws

4. **Limit Access**:
   - Restrict access to Screenshot Data to authorized personnel only
   - Implement role-based access controls (RBAC)
   - Log all access to sensitive employee data

5. **Use Data Appropriately**:
   - Use monitoring data only for stated, legitimate purposes
   - Do NOT use data for discriminatory purposes
   - Do NOT base employment actions solely on AI analysis without human review
   - Ensure supervisors understand AI limitations

6. **Maintain Transparency**:
   - Make Privacy Policy accessible to all employees
   - Update employees when monitoring practices change
   - Provide a channel for employee concerns and complaints

### 6.2 Employee Rights

Employees have the right to:

- Be informed of monitoring practices
- Access their own Screenshot Data (via Forge app dashboard)
- Request deletion of individual screenshots
- Opt-out where legally permitted (may result in disciplinary action by employer)
- File complaints with data protection authorities (GDPR) or state attorneys general (CCPA)

### 6.3 Limitations on Monitoring

The Services are designed for workplace monitoring and should NOT be used to:

- Monitor employees outside of work hours (unless clearly communicated and agreed upon)
- Monitor personal devices without explicit consent
- Surveil protected activities (union organizing, whistleblowing, etc.)
- Monitor sensitive locations (bathrooms, break rooms, medical facilities)
- Capture sensitive personal information beyond work context

### 6.4 Consequences of Non-Compliance

Organizations that fail to comply with applicable monitoring laws may face:

- Fines and penalties from regulatory authorities
- Employment lawsuits from affected employees
- Suspension or termination of Services by JIRAForge
- Reputational harm

**We are NOT responsible for Your failure to comply with applicable laws.**

---

## 7. INTELLECTUAL PROPERTY RIGHTS

### 7.1 Our Intellectual Property

All intellectual property rights in the Services, including but not limited to:

- Software code, algorithms, and architecture
- Trademarks, logos, and brand elements
- Documentation and user guides
- AI models and training methodologies
- User interface designs

are owned by JIRAForge or Our licensors. These Terms do not grant You any ownership rights.

### 7.2 Limited License

Subject to these Terms, We grant You a limited, non-exclusive, non-transferable, revocable license to access and use the Services for Your internal business purposes.

### 7.3 Customer Data Ownership

You retain all ownership rights to Customer Data, including:

- Screenshot images captured from Your devices
- Metadata associated with screenshots
- Worklog entries created by Your users
- Reports and analytics generated from Your data

By using the Services, You grant Us a limited license to:

- Store, process, and transmit Customer Data as necessary to provide the Services
- Use aggregate, anonymized data for analytics and service improvement
- Display Customer Data within the Services to authorized users

### 7.4 Feedback and Suggestions

If You provide Us with feedback, suggestions, or ideas ("Feedback"):

- You grant Us a perpetual, irrevocable, worldwide, royalty-free, transferable license to use, modify, and commercialize such Feedback
- We are not obligated to implement Feedback
- We are not obligated to provide attribution or compensation for Feedback

### 7.5 Trademarks

"JIRAForge" and related marks are trademarks of JIRAForge. You may not use Our trademarks without prior written permission, except as necessary to identify the Services.

"Atlassian," "Jira," and "Forge" are trademarks of Atlassian Pty Ltd.

---

## 8. DATA PROCESSING AND PRIVACY

### 8.1 Privacy Policy

Our collection, use, and disclosure of Personal Data is governed by our **Privacy Policy**, which is incorporated into these Terms by reference. By using the Services, You also agree to the Privacy Policy.

### 8.2 Data Controller and Processor Roles

- **For Organization Customers**: The Organization is the Data Controller; We are the Data Processor
- **For Individual Users**: We are the Data Controller for authentication and service delivery; The Organization is the Data Controller for monitoring data

### 8.3 Data Processing Addendum (DPA)

Organizations that are subject to GDPR or other data protection laws may execute a Data Processing Addendum with Us. To request a DPA, contact legal@jiraforge.com.

### 8.4 Sub-Processors

We use the following sub-processors to provide the Services:

| Sub-Processor | Purpose | Location | DPA Executed |
|---------------|---------|----------|---------------|
| Supabase | Database and file storage | USA (AWS) | Yes |
| OpenAI | AI screenshot analysis | USA | Yes |
| Fireworks AI | AI screenshot analysis | USA | Yes |
| Google Cloud | AI and OCR (fallback) | USA | Yes |
| Atlassian | Authentication and worklog sync | USA/Australia | Yes (via platform) |

We maintain a complete list of sub-processors at [URL TO BE ADDED] and will notify You of changes.

### 8.5 Data Location and Transfers

- **Primary Data Location**: United States (AWS via Supabase)
- **Data Residency Options**: Not currently available; planned for future
- **International Transfers**: We use Standard Contractual Clauses (SCCs) for transfers outside the EEA
- **GDPR Compliance**: We comply with GDPR requirements for data transfers

### 8.6 Data Security

We implement appropriate technical and organizational measures to protect Personal Data, including:

- Encryption in transit (TLS 1.2+) and at rest (AES-256)
- Access controls and authentication (OAuth 2.0, Row-Level Security)
- Regular security assessments and audits
- Incident response procedures
- Employee confidentiality obligations

**Known Gaps** (actively being remediated):
- Local SQLite database currently unencrypted (implementing SQLCipher)
- OAuth tokens stored in plain JSON (migrating to Windows Credential Manager)

### 8.7 Data Breach Notification

In the event of a data breach affecting Personal Data:

- We will notify affected Organization customers within **72 hours** of discovery
- Notifications will include: nature of breach, categories of data affected, likely consequences, and mitigation measures
- Organizations are responsible for notifying their employees as required by law

### 8.8 Data Retention

See our Privacy Policy and EULA for complete retention details:

- **Screenshot files**: 2 months (auto-deleted)
- **Screenshot metadata**: Until deletion request
- **User profiles**: Duration of subscription + 30 days
- **Activity logs**: 12 months

### 8.9 Data Deletion

- **Soft Delete**: Currently sets `deleted_at` flag; data remains in database
- **Hard Delete**: Planned implementation for full GDPR Article 17 compliance
- **Backup Retention**: Deleted data may persist in backups for up to 90 days

---

## 9. THIRD-PARTY SERVICES

### 9.1 Atlassian Forge Platform

The Forge Application runs on the Atlassian Forge platform and is subject to:

- Atlassian's Forge Terms: https://developer.atlassian.com/platform/forge/developer-terms/
- Atlassian's Marketplace Terms: https://www.atlassian.com/licensing/marketplace/termsofuse
- Atlassian's Privacy Policy: https://www.atlassian.com/legal/privacy-policy

Your use of Jira and Atlassian services is governed by Atlassian's terms, not these Terms.

### 9.2 AI Service Providers

We use third-party AI services to analyze screenshots:

- **OpenAI**: Subject to OpenAI's Terms and DPA (https://openai.com/policies/)
- **Fireworks AI**: Subject to Fireworks' terms
- **Google Cloud**: Subject to Google's terms

These providers may temporarily access Your Screenshot Data for analysis purposes. See our Privacy Policy for data retention details.

### 9.3 No Endorsement

We do not endorse, warrant, or assume responsibility for third-party services. Your use of third-party services is at Your own risk.

### 9.4 Third-Party Changes

Third-party services may change their terms, pricing, or functionality without notice. We are not responsible for such changes, but will make reasonable efforts to adapt the Services.

---

## 10. FEES AND PAYMENT

### 10.1 Subscription Plans

The Services are offered under a usage-based subscription model:

- **Free Trial**: [DURATION TO BE SPECIFIED] with full functionality
- **Paid Subscription**: Billed per tracked user per month or year
- **Pricing Tiers**: See Atlassian Marketplace listing for current pricing

### 10.2 Payment Processing

- All payments are processed through Atlassian Marketplace
- Payment methods accepted: Credit card, bank transfer (via Atlassian)
- Billing currency: USD or local currency (Atlassian determines)
- Taxes: You are responsible for all applicable taxes

### 10.3 Billing Cycle

- **Monthly Subscriptions**: Billed on the same day each month
- **Annual Subscriptions**: Billed annually on the subscription anniversary
- **Usage-Based**: Charged based on the number of active tracked users in the billing period
- **Pro-Rated**: New users added mid-cycle are pro-rated

### 10.4 Price Changes

- We may change pricing with **30 days' notice**
- Price changes will take effect at the start of Your next billing cycle
- Continued use after a price change constitutes acceptance
- You may cancel before the price change takes effect to avoid increased fees

### 10.5 Refund Policy

- **Free Trial**: No charges, no refunds necessary
- **Paid Subscriptions**: Refunds are subject to Atlassian Marketplace refund policies
- **Service Issues**: If the Services are unavailable for >24 hours (excluding maintenance), You may request a pro-rated refund for the downtime
- **Cancellation**: No refunds for early cancellation; access continues until end of billing period

### 10.6 Suspension for Non-Payment

If payment fails:

1. **Day 1**: Automated retry
2. **Day 3**: Email notification with payment update request
3. **Day 7**: Second email notification
4. **Day 15**: Account suspended; Desktop app stops capturing; Forge app is read-only
5. **Day 30**: Account may be terminated and data deleted

To restore access, update Your payment method through Atlassian Marketplace.

### 10.7 Disputes

To dispute a charge:

1. Contact support@jiraforge.com within **30 days** of the charge
2. Provide: Order number, date, amount, and reason for dispute
3. We will investigate and respond within **14 business days**
4. Atlassian is the merchant of record; final disputes are handled through Atlassian

---

## 11. TERM AND TERMINATION

### 11.1 Term

These Terms commence when You first access the Services and continue until terminated as described below.

### 11.2 Termination by You

You may terminate at any time by:

1. Canceling Your subscription through Atlassian Marketplace
2. Uninstalling the Desktop Application
3. Uninstalling the Forge Application from Jira
4. Contacting support@jiraforge.com to request account deletion

### 11.3 Termination by Us

We may terminate or suspend Your access immediately without notice if:

1. You breach these Terms, the EULA, or Privacy Policy
2. You use the Services for illegal, fraudulent, or harmful purposes
3. Your subscription payment fails for 15+ days
4. We are required to do so by law or court order
5. You engage in activity that threatens the security or integrity of the Services

We may also terminate the Services entirely with **90 days' notice**.

### 11.4 Effect of Termination

Upon termination:

- Your license to use the Services immediately ceases
- You must uninstall the Desktop Application from all devices
- Access to the Forge Application will be revoked
- You will not be entitled to any refunds (except as specified in Section 10.6)
- Your data will be retained for **30 days** to allow export
- After 30 days, Your data will be permanently deleted (subject to backup retention)

### 11.5 Data Export

Before termination, You may request a data export by contacting support@jiraforge.com at least **14 days** before termination. We will provide:

- Screenshot metadata in CSV format
- Analysis results in JSON format
- Worklog data in CSV format
- Screenshot image files (if storage space permits)

**Note**: Self-service export is not yet available but is planned.

### 11.6 Survival

The following sections survive termination: Sections 7 (Intellectual Property), 8 (Data Processing - sub-sections on security obligations), 12 (Disclaimers), 13 (Limitation of Liability), 14 (Indemnification), 16 (Dispute Resolution), and 17 (General Provisions).

---

## 12. DISCLAIMERS

### 12.1 "AS IS" and "AS AVAILABLE"

THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING:

- **Implied warranties of merchantability**
- **Fitness for a particular purpose**
- **Non-infringement**
- **Title**
- **Accuracy, completeness, or reliability of Content**
- **Uninterrupted, error-free, or secure operation**
- **Correction of defects or errors**

### 12.2 AI Analysis Disclaimer

WE MAKE NO WARRANTIES REGARDING:

- The accuracy or reliability of AI analysis results
- The correctness of AI-detected task assignments
- The precision of time allocations suggested by AI
- The suitability of AI output for any particular purpose

AI analysis is provided as a convenience and should NOT be the sole basis for employment decisions.

### 12.3 Third-Party Services Disclaimer

We are not responsible for:

- Availability, performance, or security of third-party services
- Changes to third-party terms, pricing, or functionality
- Loss of data or functionality due to third-party service issues

### 12.4 Legal Compliance Disclaimer

We provide tools for time tracking and monitoring. YOU ARE SOLELY RESPONSIBLE FOR:

- Ensuring Your use complies with applicable laws
- Obtaining proper employee consent and providing notice
- Implementing organizational policies for data access and use
- Training supervisors on appropriate use of monitoring data

We are not responsible for Your violations of employment, privacy, or data protection laws.

### 12.5 No Professional Advice

The Services do not provide legal, accounting, HR, or other professional advice. Consult qualified professionals for advice specific to Your situation.

---

## 13. LIMITATION OF LIABILITY

### 13.1 Exclusion of Consequential Damages

TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL JIRAFORGE, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:

- Loss of profits, revenue, or business opportunities
- Loss of data or information
- Loss of goodwill or reputation
- Cost of substitute goods or services
- Business interruption
- Personal injury or emotional distress

THIS EXCLUSION APPLIES REGARDLESS OF THE LEGAL THEORY (CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE) AND EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

### 13.2 Cap on Direct Damages

TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICES SHALL NOT EXCEED THE GREATER OF:

- **$100 USD**, or
- **The amount You paid Us in the 12 months preceding the claim**

### 13.3 Exceptions

Some jurisdictions do not allow the exclusion or limitation of certain liabilities. In such jurisdictions, Our liability is limited to the greatest extent permitted by law.

The limitations in this section do NOT apply to:

- Our indemnification obligations in Section 14.2
- Liability for gross negligence or willful misconduct
- Liability for death or personal injury caused by Our negligence
- Liability that cannot be excluded by law

### 13.4 Basis of the Bargain

You acknowledge that We have set Our prices and entered into these Terms in reliance on the disclaimers and limitations in Sections 12 and 13, and that they form an essential basis of the bargain between Us.

---

## 14. INDEMNIFICATION

### 14.1 Your Indemnification Obligations

You agree to indemnify, defend, and hold harmless JIRAForge, its officers, directors, employees, agents, affiliates, and licensors ("Indemnified Parties") from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from or related to:

1. Your use or misuse of the Services
2. Your violation of these Terms, the EULA, or Privacy Policy
3. Your violation of any applicable law or regulation
4. Your violation of any third-party rights, including intellectual property, privacy, or publicity rights
5. Your failure to obtain proper employee consent or provide adequate monitoring notice
6. Employment-related claims arising from Your use of monitoring data (termination, discrimination, harassment, etc.)
7. Data breaches resulting from Your failure to secure account credentials
8. Content You upload or transmit through the Services

### 14.2 Our Indemnification Obligations

We agree to indemnify, defend, and hold You harmless from claims by third parties that the Services infringe such third party's intellectual property rights, provided that:

- You promptly notify Us in writing of the claim
- You give Us sole control of the defense and settlement
- You provide reasonable cooperation in the defense

If the Services are found to infringe, or We believe they may infringe, We may at Our option:

- Obtain the right for You to continue using the Services
- Replace or modify the Services to make them non-infringing
- Terminate the Services and refund pre-paid, unused fees on a pro-rated basis

This indemnification does NOT apply if the alleged infringement arises from:

- Your modification of the Services
- Your combination of the Services with third-party products
- Your use of the Services contrary to these Terms or Documentation

### 14.3 Indemnification Process

The indemnified party must:

1. Provide prompt written notice of the claim
2. Allow the indemnifying party sole control of the defense and settlement (with the indemnified party's reasonable approval for settlements imposing obligations on them)
3. Provide reasonable cooperation in the defense at the indemnifying party's expense

Failure to provide prompt notice does not relieve the indemnifying party of obligations except to the extent prejudiced by the delay.

---

## 15. MODIFICATIONS TO TERMS

### 15.1 Right to Modify

We reserve the right to modify these Terms at any time. When We make changes:

- **Minor Changes** (typos, clarifications): Effective immediately upon posting
- **Material Changes** (new restrictions, reduced functionality, increased liability): Effective **30 days** after notice

### 15.2 Notice of Changes

We will notify You of material changes by:

- Posting the updated Terms on our website with a "Last Updated" date
- Sending an email to the address associated with Your account
- Displaying a notification in the Services

### 15.3 Acceptance of Changes

By continuing to use the Services after changes take effect, You accept the modified Terms. If You do not agree to the changes:

- You must stop using the Services
- Cancel Your subscription before the changes take effect
- You will be bound by the prior Terms until the effective date of the changes

### 15.4 Version History

Previous versions of these Terms are available upon request at legal@jiraforge.com.

---

## 16. DISPUTE RESOLUTION

### 16.1 Governing Law

These Terms shall be governed by and construed in accordance with the laws of **[JURISDICTION TO BE SPECIFIED - e.g., State of Delaware, United States]**, without regard to its conflict of law provisions.

The United Nations Convention on Contracts for the International Sale of Goods shall not apply.

### 16.2 Informal Dispute Resolution

Before filing a claim, You agree to contact Us at legal@jiraforge.com to attempt to resolve the dispute informally. We will attempt to resolve the dispute through good-faith negotiations for at least **30 days**.

### 16.3 Binding Arbitration

If the dispute cannot be resolved informally, You agree that any dispute arising from these Terms or the Services shall be resolved through **binding arbitration** in accordance with the **[ARBITRATION BODY TO BE SPECIFIED - e.g., American Arbitration Association's Commercial Arbitration Rules]**.

**Arbitration Terms:**
- **Location**: [LOCATION TO BE SPECIFIED]
- **Language**: English
- **Arbitrator**: One arbitrator mutually agreed upon, or appointed per AAA rules
- **Discovery**: Limited discovery as determined by the arbitrator
- **Costs**: Each party bears its own costs unless the arbitrator awards costs to the prevailing party

**Exceptions to Arbitration:**
- Either party may seek injunctive relief in court for intellectual property infringement
- Either party may bring claims in small claims court if they qualify
- Either party may seek emergency provisional relief in court pending arbitration

### 16.4 Class Action Waiver

**YOU AGREE TO BRING CLAIMS AGAINST US ONLY IN YOUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, REPRESENTATIVE, OR COLLECTIVE ACTION OR PROCEEDING.**

Unless both You and We agree otherwise, the arbitrator may not consolidate more than one party's claims and may not preside over any form of representative or class proceeding.

If this class action waiver is found to be unenforceable, the entire arbitration agreement in Section 16.3 shall be void, and disputes shall be resolved in court.

### 16.5 Opt-Out of Arbitration

You may opt out of the arbitration agreement by sending written notice to legal@jiraforge.com within **30 days** of first accepting these Terms. The notice must include:

- Your name and Atlassian account email
- A statement that You opt out of the arbitration agreement

If You opt out, disputes will be resolved in court per Section 16.6.

### 16.6 Jurisdiction and Venue (If Arbitration Waived)

If the arbitration agreement is waived or found unenforceable, You agree that any judicial proceedings shall be brought exclusively in the state or federal courts located in **[JURISDICTION TO BE SPECIFIED]**, and You consent to personal jurisdiction and venue in such courts.

### 16.7 Statute of Limitations

Any claim arising from these Terms or the Services must be filed within **one (1) year** after the cause of action arises, or it shall be permanently barred.

---

## 17. GENERAL PROVISIONS

### 17.1 Entire Agreement

These Terms, together with the EULA and Privacy Policy, constitute the entire agreement between You and JIRAForge regarding the Services and supersede all prior or contemporaneous agreements, communications, and understandings (written or oral).

### 17.2 Severability

If any provision of these Terms is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.

### 17.3 Waiver

No waiver of any term or condition of these Terms shall be deemed a further or continuing waiver of such term or any other term. Our failure to enforce any right or provision shall not constitute a waiver of such right or provision.

### 17.4 Assignment

You may not assign, transfer, or delegate these Terms or Your rights and obligations hereunder without Our prior written consent. Any attempted assignment in violation of this section shall be void.

We may assign these Terms, in whole or in part, to any affiliate, successor, or acquirer without Your consent.

These Terms are binding upon and inure to the benefit of the parties and their permitted successors and assigns.

### 17.5 Force Majeure

Neither party shall be liable for any failure or delay in performance under these Terms due to causes beyond its reasonable control, including but not limited to:

- Acts of God (earthquakes, floods, fires)
- War, terrorism, or civil unrest
- Government actions or regulations
- Labor disputes or strikes
- Internet service provider failures
- Power outages
- Pandemics or public health emergencies

The affected party shall notify the other party promptly and use reasonable efforts to mitigate the impact. If the force majeure event continues for more than **30 days**, either party may terminate these Terms without liability.

### 17.6 Independent Contractors

The parties are independent contractors. These Terms do not create a partnership, joint venture, agency, franchise, employment, or fiduciary relationship.

### 17.7 Third-Party Beneficiaries

These Terms do not create any third-party beneficiary rights except as expressly stated herein. Indemnified Parties in Section 14 are express third-party beneficiaries with the right to enforce indemnification provisions.

### 17.8 Language

These Terms are prepared in English. Any translation is provided for convenience only. In the event of any conflict, the English version shall prevail.

### 17.9 Headings

Section headings are for convenience only and do not affect the interpretation of these Terms.

### 17.10 Notices

All notices under these Terms shall be in writing and shall be deemed given when:

- Delivered personally
- Sent by confirmed email
- Sent by certified or registered mail, return receipt requested
- Delivered by a nationally recognized overnight courier service

**To JIRAForge:**
Email: legal@jiraforge.com
Address: [PHYSICAL ADDRESS TO BE ADDED]

**To You:**
The email address associated with Your Atlassian account or Jira instance admin email

### 17.11 Export Compliance

You agree to comply with all applicable export and import laws and regulations. You represent that You are not:

- Located in a country subject to U.S. embargo or designated as a "terrorist supporting" country
- Listed on any U.S. government list of prohibited or restricted parties

You will not use the Services for any purpose prohibited by U.S. law, including development of nuclear, chemical, or biological weapons.

### 17.12 Government Use

If You are a U.S. government entity, the Services are "Commercial Items" as defined in 48 C.F.R. §2.101, and are provided with only those rights as are granted to all other users per these Terms.

### 17.13 California Residents

Per California Civil Code §1789.3, California residents are entitled to the following specific consumer rights notice:

- **Complaint Assistance**: Contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, CA 95834, or by telephone at (916) 445-1254 or (800) 952-5210.

### 17.14 Feedback and Contact

We welcome Your feedback! To provide suggestions, report issues, or contact Us:

- **Support**: support@jiraforge.com
- **Legal**: legal@jiraforge.com
- **Security**: security@jiraforge.com
- **Data Protection Officer**: dpo@jiraforge.com
- **Website**: [URL TO BE ADDED]
- **Documentation**: [URL TO BE ADDED]

---

## 18. ACKNOWLEDGMENT AND ACCEPTANCE

BY CLICKING "I AGREE," INSTALLING THE SOFTWARE, OR USING THE SERVICES, YOU ACKNOWLEDGE THAT:

1. You have read and understood these Terms of Service
2. You have read and understood the EULA and Privacy Policy
3. You agree to be bound by these Terms, the EULA, and Privacy Policy
4. You have the authority to enter into these Terms on behalf of Yourself or Your Organization
5. You will comply with all applicable laws regarding employee monitoring and privacy
6. You understand the limitations of AI analysis and will use human review
7. You have provided or will provide proper notice and obtain consent from employees as required by law

---

**Version 1.0**
**Effective Date: January 21, 2026**

---

**END OF TERMS OF SERVICE**
