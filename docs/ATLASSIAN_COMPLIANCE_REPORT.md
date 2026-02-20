# Atlassian Compliance Report for JIRAForge

## Overall Verdict: Your app is **ALLOWED**, but with caveats

The good news is that **nothing you're doing is outright prohibited**. Several apps already do similar things on the marketplace. However, there are risk areas that need attention.

---

## Risk Assessment by Feature

| Feature | Risk | Allowed? | Details |
|---|---|---|---|
| Screenshot capture | **MODERATE** | Yes | Monitask, Hubstaff, Time Doctor already do this |
| External storage (Supabase) | **MODERATE** | Yes | Must declare domains, encrypt at rest, handle GDPR |
| AI analysis of screenshots | **HIGH** | Yes, with caveats | Must declare, need DPAs with AI providers, full transparency |
| Employee monitoring | **MODERATE** | Yes | Must NOT use AI for employment decisions |
| Auto worklog creation | **LOW** | Yes | Standard Jira API pattern, many apps do this |
| OAuth middleman server | **HIGH** | Questionable for Forge | Forge has built-in auth — external server is non-standard |
| GDPR/Data retention | **HIGH (effort)** | Required | Extensive compliance work needed |

---

## Key Findings

### 1. Screenshot Capture & External Storage — ALLOWED

- Forge explicitly supports **remote storage that you manage** (like Supabase)
- **Precedent exists**: Monitask, Hubstaff, Time Doctor, Everhour all capture screenshots and store them externally
- **Requirements**: Declare all external domains in `manifest.yml`, encrypt data at rest, TLS 1.2+
- **Trade-off**: Your app will **NOT qualify for the "Runs on Atlassian" badge** due to data egress

#### What Atlassian's Official Policy Says

- Forge provides three storage options: Forge-hosted storage, Atlassian app REST APIs, and **remote storage that you manage**. Using external databases like Supabase is permitted.
- However, you **must declare all external domains** in the `permissions.external.fetch.backend` section of your `manifest.yml`. Calls to undeclared domains are rejected.
- You are **responsible for encrypting data at rest** for any data stored outside Atlassian infrastructure.
- Storing data externally makes your app **ineligible for the "Runs on Atlassian" badge** and PINNED data residency status unless you configure region-pinned URLs.
- The "Runs on Atlassian" program states: **"Apps should not be egressing data. If an app must egress data, then the egress should only be for the purpose of analytics, and the app should not egress any in-scope End-User Data."** Screenshots of user desktops would almost certainly be considered in-scope End-User Data.

#### Risks and Concerns

- **HIGH RISK**: Screenshots are user-generated content and contain personal data (desktop contents, potentially passwords, personal messages, etc.). Sending these to Supabase constitutes egressing in-scope End-User Data, which disqualifies you from the "Runs on Atlassian" program.
- You must disclose in your marketplace listing **what data is sent externally, to which hosts, and why**.
- Atlassian **recommends apps do NOT store user personal data** and instead retrieve it at time of use.
- You must handle GDPR right-to-erasure requests and delete user data upon request and/or uninstall.

#### Existing Similar Apps

- **Monitask** — captures screenshots at random intervals, stores them on Monitask's servers (external to Atlassian), and syncs worklogs to Jira.
- **Hubstaff** — syncs time tracking data to Jira worklogs (screenshot capture happens in the Hubstaff desktop app, not within the Jira app itself).

---

### 2. Sending Data to External AI Services — ALLOWED BUT HIGH RISK

- Forge permits external API calls — you must declare all domains
- **No existing marketplace app sends screenshots to AI** — your app is novel here
- **Critical requirements**:
  - Data Processing Agreements (DPAs) with Fireworks AI, OpenAI, Google ensuring they **don't train on or retain** user data
  - Full disclosure in marketplace listing
  - Cross-border transfer mechanisms (SCCs) if AI services process data outside EEA
- Atlassian has an **AI apps category** on the marketplace, so AI-powered apps are broadly accepted

#### What Atlassian's Official Policy Says

- Forge apps **can make external API calls** to third-party services, but all external domains must be declared in the manifest.
- The analytics tool policy has a **strict allowlist** of approved analytics providers (Google Analytics, Mixpanel, Sentry, etc.). AI services like Fireworks AI, OpenAI, or Google Gemini are **NOT on this allowlist**.
- For "Runs on Atlassian" apps, **only analytics egress is permitted**, and no in-scope End-User Data can be egressed. Sending screenshots to AI services is definitively NOT analytics.
- The Acceptable Use Policy requires compliance when **using artificial intelligence features**, including not making automated decisions with "legal or similarly significant effects" on individuals.
- Atlassian's own AI (Rovo/Atlassian Intelligence) has contractual restrictions with LLM providers preventing them from storing or training on customer data. Your app would need **similar contractual protections** with your AI providers.

#### Risks and Concerns

- **HIGH RISK**: Sending user desktop screenshots to third-party AI services raises major privacy concerns. These screenshots could contain sensitive information (passwords, personal data, confidential business data).
- You must ensure AI providers do **not train on or retain** the submitted data.
- **GDPR cross-border transfer**: If AI services process data outside the EEA, you need adequate transfer mechanisms (standard contractual clauses).
- The app will **NOT qualify for "Runs on Atlassian"** if it sends data to external AI services.
- Atlassian performs **safety screening on AI agents** and may suspend access if issues are identified.

#### Existing Similar Apps

- Atlassian's own AI features (Rovo) use OpenAI but under strict contractual protections and SOC 2/ISO 27001 certifications.
- There is an **AI apps category** on the Atlassian Marketplace, showing that AI-powered apps are broadly permitted.
- However, apps that send **screenshots** (not just text data) to AI services are a distinct and more sensitive category.

---

### 3. Employee Monitoring / Screenshot Capture — ALLOWED

- **NOT explicitly prohibited** in Atlassian's Acceptable Use Policy
- Multiple monitoring apps already exist on marketplace (Monitask, Hubstaff)
- **Red line**: You must NEVER use AI to:
  - Infer emotions in workplace settings
  - Make automated employment decisions (firing, demotion based on "productivity scores")
  - Classify individuals based on social behavior leading to detrimental treatment

#### What Atlassian's Official Policy Says

- The Acceptable Use Policy **does NOT explicitly prohibit** employee monitoring or screenshot capture tools.
- The AUP **does prohibit** specific high-risk AI uses:
  - Inferring emotions of individuals in workplace settings
  - Evaluating/classifying individuals based on social behavior leading to detrimental treatment
  - Making automated decisions with "legal or similarly significant effects" on employment
- General screenshot-based time tracking (without AI emotion inference or automated employment decisions) appears to be **permitted**.
- The security requirements and marketplace listing requirements **do not mention** employee monitoring as a prohibited category.

#### Risks and Concerns

- **MODERATE RISK**: While not explicitly prohibited, employee monitoring tools can attract negative attention from:
  - Atlassian's security review team during marketplace approval
  - GDPR regulators (employee consent issues)
  - Customers' works councils (especially in EU jurisdictions)
- Your app should **never use AI to make employment-affecting decisions** based on screenshots (e.g., productivity scoring that leads to termination recommendations) as this would violate the AUP.
- You must clearly disclose the monitoring capabilities in your privacy policy and marketplace listing.

#### Existing Similar Apps

Several employee monitoring / screenshot-based time tracking apps already exist on the Atlassian Marketplace:

1. **Monitask** — Explicitly captures screenshots at employer-defined intervals, provides live dashboard with screenshots and activity levels. Released November 2020.
2. **Hubstaff** — Time tracking with optional screenshot capture in the desktop app, syncs to Jira worklogs. 33 installs.
3. **Time Doctor** — Takes screenshots at specified intervals, shows activity levels alongside screenshots.
4. **Everhour** — Offers optional screenshots for contractor verification.

---

### 4. Automatic Worklog Creation — FULLY ALLOWED

- Standard Jira REST API operation (`POST /rest/api/3/issue/{issueId}/worklog`)
- Forge's `api.asUser()` is designed for this exact use case
- Tempo, Monitask, Hubstaff all do this

#### What Atlassian's Official Policy Says

- Forge provides `api.asUser().requestJira()` and `api.asApp().requestJira()` methods for making authenticated Jira API calls.
- Using `asUser()` makes requests on behalf of the currently authenticated user (their permissions apply). Using `asApp()` makes requests as the app itself.
- The Jira REST API supports creating worklogs via `POST /rest/api/3/issue/{issueId}/worklog`. This is a **standard, documented API operation**.
- Forge supports **scheduled triggers** that can run functions periodically, enabling automated worklog creation.
- Developers should use `asUser()` for user-behalf operations and verify permissions before calling `asApp()`.

#### Risks and Concerns

- **LOW-MODERATE RISK**: Automatic worklog creation is a standard Jira API operation. The main concerns are:
  - When using `asApp()`, the worklog author may show as the app rather than the user. Developers have reported challenges specifying which user the worklog should be attributed to.
  - Users should clearly consent to having worklogs created automatically on their behalf.
  - The app should follow the **Principle of Least Privilege** and only request necessary scopes.

#### Existing Similar Apps

- **Monitask** and **Hubstaff** both automatically sync time tracking data into Jira worklogs.
- **Tempo Timesheets** and many other time tracking apps create worklogs programmatically.

---

### 5. OAuth and Token Handling (AI Server as Middleman) — QUESTIONABLE

- For **Forge apps**, authentication should use Forge's built-in mechanisms (`api.asUser()`, `api.asApp()`)
- Having a separate AI server hold `CLIENT_SECRET` and exchange tokens is the **Connect app pattern**, not the Forge pattern
- This is the **highest architectural risk** — consider using Forge's `withProvider` method for external OAuth instead
- If you keep the current pattern, the server must meet strict security requirements (TLS, secret rotation every 90 days, no token logging)

#### What Atlassian's Official Policy Says

- For Forge apps, authentication is **built into the framework** — you don't need to handle OAuth manually. The Forge platform manages tokens automatically.
- For Connect apps or standalone 3LO apps, OAuth 2.0 (3LO) requires a server-side token exchange using the `client_secret`.
- **Critical policy**: "Apps that collect API tokens or instruct customers to create individual 3LO apps don't comply with our Security requirements." You must build **a single, distributable 3LO app**.
- Apps **must not** expose `sharedSecret` or tokens in URLs, referer headers, public repositories, or client-side storage.
- For Forge apps using external OAuth providers, the Forge platform manages tokens via the `withProvider` method — apps **never have direct access** to OAuth 2.0 tokens.

#### Risks and Concerns

- **HIGH RISK**: If your architecture has a separate AI server acting as an OAuth middleman (holding CLIENT_SECRET, exchanging tokens), this is a **non-standard and potentially problematic pattern** for a Forge app:
  - Forge apps should use Forge's built-in authentication, not a separate server handling token exchange.
  - If the AI server stores/handles Atlassian OAuth tokens, it becomes a high-value attack target.
  - The secret must be stored securely (not in source code), rotated every 90 days, and the server must use TLS 1.2+.
  - This pattern is more typical of a Connect app or standalone 3LO integration, not a Forge app.

#### Recommendation

- If building a **Forge app**: Use Forge's built-in `api.asUser()` and `api.asApp()` methods. Use the `withProvider` mechanism for external OAuth if needed.
- If building a **Connect/3LO app**: Having a server exchange tokens is standard, but ensure the server meets all security requirements (TLS, secret rotation, no logging of tokens).

---

### 6. Data Retention and Privacy (GDPR) — REQUIRED, HIGH EFFORT

- **Privacy policy URL** must be in marketplace listing
- **Right to erasure**: Must delete all user data on request
- **Periodic reporting**: Every 7 days, report which `accountId`s you store data for
- **Clean-up on uninstall**: External data (Supabase) is YOUR responsibility to delete
- **Data minimization**: Only collect what's necessary
- Screenshots are especially sensitive — could capture passwords, personal messages, confidential data

#### What Atlassian's Official Policy Says

- Apps **must have a privacy policy** disclosed in the marketplace listing.
- Privacy policy must clearly explain what data is collected, how it's used, and who has access.
- **Data minimization**: Collect only necessary data; do not retain data "because you think it may be useful later."
- **Right to erasure**: If a user requests data deletion, the app must comply.
- **Right to rectification**: Users can have their data updated or erased.
- If storing personal data, **periodic reporting** is required (default 7-day cycle) listing which `accountId`s the app stores data for.
- Upon app uninstall, Forge automatically deletes Forge-hosted storage data (recoverable for 30 days). **External data is your responsibility to clean up.**
- **Cross-border transfers**: If processing EEA resident data outside the EEA, implement adequate transfer mechanisms (SCCs, adequacy decisions).
- GDPR Article 28 compliance: You may need data processing agreements with customers.

#### Risks and Concerns

- **HIGH RISK for this app specifically**: Storing screenshots, AI analysis results, and activity data creates a large personal data footprint:
  - Screenshots may capture sensitive personal information beyond work activities.
  - AI analysis results constitute derived personal data.
  - You need clear retention schedules and automated deletion.
  - GDPR data subject access requests (DSARs) require you to provide all stored data for a given user.
  - Cross-border data flows (Supabase locations, AI service locations) must be legally justified.

#### Requirements Checklist

1. Privacy policy URL in marketplace listing
2. Data processing agreements available for enterprise customers
3. Right-to-erasure implementation
4. Periodic personal data reporting (every 7 days)
5. Data retention schedules
6. Clean-up on uninstall for external data
7. Cross-border transfer mechanisms (if applicable)
8. Encryption at rest for all external storage
9. TLS 1.2+ for all data in transit

---

### 7. Atlassian Marketplace Listing Requirements and Security Review

#### What Atlassian's Official Policy Says

- New app submissions take **5-10 business days** for review.
- As of 2025, new security checks include:
  - **Partner Security Questionnaire**: Covers security practices, infrastructure, development processes, policy documentation, vulnerability management.
  - **KYC/KYB verification**: All partners must complete Know Your Customer / Know Your Business verification.
  - **Privacy & Security Tab**: Mandatory for cloud app onboarding, including disclosures about PATs, permission justification, and Trust Center links.
- Apps are **not tested before listing** but are subject to **continuous review** by Atlassian's security team.
- Security gaps identified post-listing must be fixed per the **security bug fix policy**.
- Atlassian may flag, revoke, or downgrade certifications at any time based on complaints, policy violations, or at their discretion.
- Automatic security evaluation with **fail signals** that block apps from listing.

#### For This App Specifically

You will need to:
1. Complete partner security questionnaire
2. Pass KYC/KYB verification
3. Fully populate the Privacy & Security tab (disclosing external data storage, AI processing, screenshot capture)
4. Justify all requested permissions
5. Provide a privacy policy URL
6. Disclose all external domains (Supabase, Fireworks AI, LiteLLM endpoints)
7. Designate at least one security contact with `ecosystem.atlassian.net` access

---

### 8. Existing Similar Apps (Precedent)

#### Screenshot-Based Time Tracking Apps on Atlassian Marketplace

| App | Screenshots | External Storage | AI Analysis | Jira Worklog Sync | Status |
|---|---|---|---|---|---|
| **Monitask** | Yes (random/interval) | Yes (Monitask servers) | No | Yes | Active on Marketplace |
| **Hubstaff** | Yes (desktop app) | Yes (Hubstaff servers) | No | Yes | Active (33 installs) |
| **Time Doctor** | Yes (interval-based) | Yes (Time Doctor servers) | No | Yes | External integration |
| **Everhour** | Optional | Yes (Everhour servers) | No | Yes | Active on Marketplace |

#### Key Differences from Your App

Your app differs from existing marketplace apps in these ways:
1. **AI analysis of screenshots** — No existing marketplace app sends screenshots to AI services for analysis. This is novel and adds risk.
2. **Automated categorization** — Using AI to categorize work and auto-create worklogs based on screenshot analysis is unique.
3. **Multiple external services** — Your app sends data to Supabase AND multiple AI providers (Fireworks, OpenAI, Google), creating a more complex data flow than existing apps.

---

## Critical Recommendations

1. **Fix OAuth architecture** — Use Forge's built-in auth instead of the AI server middleman pattern
2. **Get DPAs from AI providers** — Fireworks AI, OpenAI, Google must contractually agree not to train on/retain your data
3. **Implement full GDPR compliance** — Right-to-erasure, periodic data reporting, retention schedules, cleanup on uninstall
4. **Be fully transparent** in marketplace listing — Disclose screenshot capture, external storage, AI processing
5. **Don't apply for "Runs on Atlassian"** — Your app won't qualify due to data egress
6. **Encrypt everything at rest** in Supabase
7. **Consider region-pinned Supabase instances** for enterprise data residency requirements
8. **Never use AI for employment decisions** — Keep it strictly as time tracking assistance

---

## Sources

### Atlassian Official Documentation

- [Forge Storage](https://developer.atlassian.com/platform/forge/storage/)
- [Forge Data Residency](https://developer.atlassian.com/platform/forge/data-residency/)
- [Runtime Egress Permissions](https://developer.atlassian.com/platform/forge/runtime-egress-permissions/)
- [Build Runs on Atlassian Apps](https://developer.atlassian.com/platform/forge/runs-on-atlassian-apps/)
- [Forge Permissions / Manifest Reference](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/)
- [Analytics Tool Policy](https://developer.atlassian.com/platform/forge/analytics-tool-policy/)
- [Forge Remote](https://developer.atlassian.com/platform/forge/remote/)
- [Forge Developer Terms](https://developer.atlassian.com/platform/forge/developer-terms/)
- [Security for Forge Apps](https://developer.atlassian.com/platform/forge/security/)
- [Forge API Reference - Product REST API](https://developer.atlassian.com/platform/forge/apis-reference/product-rest-api-reference/)
- [Automation with Forge](https://developer.atlassian.com/platform/forge/automation-with-forge/)
- [Shared Responsibility Model](https://developer.atlassian.com/platform/forge/shared-responsibility-model/)
- [External OAuth 2.0 with Forge (withProvider)](https://developer.atlassian.com/platform/forge/use-an-external-oauth-2.0-api-with-fetch/)
- [User Privacy Guidelines (Forge)](https://developer.atlassian.com/platform/forge/user-privacy-guidelines/)
- [Listing Forge Apps](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/)

### Atlassian Security & Marketplace Policies

- [Security Requirements for Cloud Apps](https://developer.atlassian.com/platform/marketplace/security-requirements/)
- [Security Requirements - Additional Info](https://developer.atlassian.com/platform/marketplace/security-requirements-more-info/)
- [Security Guidelines](https://developer.atlassian.com/platform/marketplace/security-guidelines/)
- [Data Privacy Guidelines](https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/)
- [App Approval Security Workflow](https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/)
- [Partner Security Questionnaire](https://developer.atlassian.com/platform/marketplace/partner-security-questionnaire/)
- [Privacy & Security Tab](https://developer.atlassian.com/platform/marketplace/security-privacy-tab/)

### Atlassian Legal & Trust

- [Atlassian Acceptable Use Policy](https://www.atlassian.com/legal/acceptable-use-policy)
- [Marketplace Partner Agreement](https://www.atlassian.com/licensing/marketplace/partneragreement)
- [Atlassian AI Trust](https://www.atlassian.com/trust/atlassian-intelligence)

### Atlassian OAuth Documentation

- [OAuth 2.0 (3LO) Apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)

### Atlassian Community

- [Adding Worklog Examples - Community Discussion](https://community.developer.atlassian.com/t/adding-worklog-examples-in-documentation-uses-asapp-how-to-specify-the-user/43281)

### Existing Marketplace Apps (Precedent)

- [Monitask - Time Tracking for Jira with Screenshots](https://marketplace.atlassian.com/apps/1223737/time-tracking-for-jira-with-monitask)
- [Hubstaff for Jira](https://marketplace.atlassian.com/apps/1237435/hubstaff-for-jira)
- [Hubstaff Jira Time Tracking Integration](https://hubstaff.com/jira-time-tracking)
- [Time Doctor Jira Integration](https://www.timedoctor.com/integrations/jira)
- [Everhour - Time Tracking Integration for Jira](https://marketplace.atlassian.com/apps/1217523/everhour-time-tracking-integration-for-jira)
- [Atlassian Marketplace - Artificial Intelligence Apps](https://marketplace.atlassian.com/collections/artificial-intelligence)

---

*Report generated: February 18, 2026*
