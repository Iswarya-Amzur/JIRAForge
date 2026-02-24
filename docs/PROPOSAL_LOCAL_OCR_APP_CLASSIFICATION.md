# Proposal: Local OCR, Application Classification & Event-Based Activity Tracking

**Date:** February 18, 2026
**Document Type:** Technical Proposal
**Status:** Draft — For Manager Review

---

## 1. Executive Summary

This proposal introduces four key architectural changes to the JIRAForge desktop application:

1. **Application Classification System** — A centralized list of applications stored in Supabase, synced locally to SQLite, classifying each app into three categories: **Productive** (work apps + neutral apps where AI decides from context), **Non-Productive** (entertainment and personal distractions), or **Private** (sensitive personal apps like banking and healthcare where no data is captured beyond app name and time)
2. **Local OCR Processing** — For productive and unknown apps, screenshots are captured temporarily in memory, OCR runs locally to extract text, and the image is immediately discarded. For non-productive and private apps, no screenshot is captured at all — only metadata is logged. For unknown apps, the extracted OCR text is sent to the LLM to classify the app. **No screenshots are ever uploaded or stored — only extracted text and metadata leave the device.**
3. **Event-Based Activity Tracking** — Replacing the current interval-based screenshot capture (every 5 minutes) with an event-driven model that tracks window/tab switches in real-time, accumulates time per activity in local SQLite, and batch-uploads aggregated records to Supabase every 5 minutes
4. **Project-Level Settings** — Moving the application classification and tracking configuration from the organization level down to the project level for finer control

These changes result in significant **cost reduction**, **improved privacy**, **faster processing**, **fewer database calls**, and **better Atlassian compliance**.

---

## 2. Problem Statement

### Current Architecture

Today, the JIRAForge desktop app:

1. Captures a screenshot every 5 minutes (interval-based)
2. Uploads the full PNG screenshot image to Supabase Storage
3. Sends the screenshot to an external AI server
4. The AI server calls a **vision model** (Fireworks AI / LiteLLM) to analyze the image
5. If vision fails, the AI server runs OCR (Tesseract.js) as a fallback and sends extracted text to a text-based AI model
6. The AI determines: what Jira issue the user is working on, whether it's office or non-office work

### Problems with Current Approach

| Problem | Impact |
|---|---|
| **High AI cost** | Every screenshot triggers a vision model API call (~$0.01-0.03 per image). At 12 screenshots/hour/user, costs scale rapidly. |
| **Privacy risk** | Full desktop screenshots (which may contain passwords, personal messages, confidential data) are sent to third-party AI providers (Fireworks, OpenAI, Google). |
| **No privacy protection for sensitive apps** | Banking, healthcare, and personal finance apps are captured and processed the same as everything else. Screenshots may contain account numbers, health records, and financial data. |
| **Atlassian compliance risk** | Sending user screenshots to external AI services is flagged as HIGH RISK in our compliance assessment. No existing Atlassian Marketplace app does this. |
| **Slow processing** | Uploading images + waiting for vision model response adds latency (3-8 seconds per screenshot). |
| **High bandwidth usage** | Full PNG screenshots (~500KB-2MB each) uploaded to Supabase and then downloaded by the AI server. |
| **No pre-filtering** | Every screenshot goes through the same expensive AI pipeline, even when the user is clearly in a non-work app (e.g., YouTube, Netflix, social media). |
| **Excessive database calls** | Each screenshot = 1 Supabase insert + 1 storage upload. At 12/hour/user, this creates unnecessary database load. |
| **Inaccurate time tracking** | Interval-based capture (every 5 min) misses activity between snapshots. A user may switch apps 20 times in 5 minutes, but only one moment is captured. |
| **Organization-level settings are too broad** | Whitelist/blacklist applies to the entire organization. Different projects may have different definitions of what apps are relevant. |

---

## 3. Proposed Solution

### 3.1 Application Classification System

#### Concept

Maintain a master list of applications in Supabase with a **3-way classification** system, aligned with industry standards used by tools like Hubstaff, DeskTime, ActivTrak, and Time Doctor:

| Classification | Description | OCR? | AI? | Data Captured |
|---|---|---|---|---|
| **Productive** | Work-related apps (IDEs, office suites, design tools) AND neutral apps that could be work-related (browsers, chat, email, video conferencing) | **Yes** | **Yes** — matches to Jira issue for work apps; AI decides from OCR context for neutral apps like browsers | App name + window title + OCR text + time |
| **Non-Productive** | Entertainment, personal distractions, gaming | **No** | **No** — just log time as non-work | App name + window title + time |
| **Private** | Sensitive personal apps — banking, healthcare, personal finance, password managers | **No** | **No** — respect user privacy completely | **App name + time only** (window title REDACTED — could contain account numbers, health info, financial data) |

#### Why 3-Way Classification?

Industry research shows that the leading time tracking tools use 3-way (or more) classification systems:

| Tool | Classification System |
|---|---|
| **Hubstaff** | Core / Non-core / Unproductive |
| **DeskTime** | Productive / Unproductive / Neutral |
| **ActivTrak** | Productive / Unproductive / Undefined |
| **Time Doctor** | Productive / Unproductive / Neutral / Unrated |
| **RescueTime** | 5-level scale (Very Productive → Very Distracting) |
| **JIRAForge (current)** | 2-way (office / non-office via whitelist/blacklist) |
| **JIRAForge (proposed)** | **3-way: Productive / Non-Productive / Private** |

Our system adds a **Private** classification that most competitors don't have — this is a **differentiator** that shows we take user privacy seriously, especially important for Atlassian Marketplace compliance.

#### Key Difference Between Non-Productive and Private

| Aspect | Non-Productive | Private |
|---|---|---|
| **Purpose** | Track non-work time for analytics | **Protect sensitive personal data** |
| **Window title logged?** | Yes (e.g., "Spotify - Liked Songs") | **No — redacted** (could contain account numbers, health info) |
| **OCR?** | No | No |
| **AI?** | No | No |
| **What's stored** | App name + window title + time | **App name + time only** |
| **Example** | Netflix, Spotify, Steam | Banking apps, health portals, password managers |
| **Why it matters** | Manager sees "employee spent 20 min on Spotify" | Manager sees "employee spent 5 min in a private app" — **no details exposed** |

#### Predefined Application List

Based on industry research across Hubstaff, Time Doctor, ActivTrak, DeskTime, and RescueTime, here is the comprehensive predefined list. Each entry has a **Match By** column that indicates how the app is identified:

- **process** — Matched by the Windows process name (e.g., `code.exe`). Used for desktop applications.
- **url** — Matched by domain/URL pattern found in the browser window title (e.g., `github.com`). Used when the active app is a browser (`chrome.exe`, `msedge.exe`, `firefox.exe`, etc.). The URL-based classification **overrides** the browser's default "productive" classification.

| Identifier | Display Name | Type | Match By |
|---|---|---|---|
| `code.exe` | Visual Studio Code | productive | process |
| `devenv.exe` | Visual Studio | productive | process |
| `idea64.exe` | IntelliJ IDEA | productive | process |
| `pycharm64.exe` | PyCharm | productive | process |
| `webstorm64.exe` | WebStorm | productive | process |
| `phpstorm64.exe` | PhpStorm | productive | process |
| `rider64.exe` | JetBrains Rider | productive | process |
| `goland64.exe` | GoLand | productive | process |
| `sublime_text.exe` | Sublime Text | productive | process |
| `notepad++.exe` | Notepad++ | productive | process |
| `eclipse.exe` | Eclipse | productive | process |
| `atom.exe` | Atom | productive | process |
| `cursor.exe` | Cursor | productive | process |
| `AndroidStudio64.exe` | Android Studio | productive | process |
| `WINWORD.EXE` | Microsoft Word | productive | process |
| `EXCEL.EXE` | Microsoft Excel | productive | process |
| `POWERPNT.EXE` | Microsoft PowerPoint | productive | process |
| `ONENOTE.EXE` | Microsoft OneNote | productive | process |
| `MSACCESS.EXE` | Microsoft Access | productive | process |
| `VISIO.EXE` | Microsoft Visio | productive | process |
| `MSPUB.EXE` | Microsoft Publisher | productive | process |
| `Figma.exe` | Figma | productive | process |
| `Photoshop.exe` | Adobe Photoshop | productive | process |
| `Illustrator.exe` | Adobe Illustrator | productive | process |
| `XD.exe` | Adobe XD | productive | process |
| `AfterFX.exe` | Adobe After Effects | productive | process |
| `Premiere Pro.exe` | Adobe Premiere Pro | productive | process |
| `InDesign.exe` | Adobe InDesign | productive | process |
| `SketchUp.exe` | SketchUp | productive | process |
| `Blender.exe` | Blender | productive | process |
| `AutoCAD.exe` | AutoCAD | productive | process |
| `Postman.exe` | Postman | productive | process |
| `insomnia.exe` | Insomnia | productive | process |
| `docker.exe` | Docker Desktop | productive | process |
| `com.docker.backend.exe` | Docker Backend | productive | process |
| `GitHubDesktop.exe` | GitHub Desktop | productive | process |
| `SourceTree.exe` | Sourcetree | productive | process |
| `gitkraken.exe` | GitKraken | productive | process |
| `WindowsTerminal.exe` | Windows Terminal | productive | process |
| `powershell.exe` | PowerShell | productive | process |
| `cmd.exe` | Command Prompt | productive | process |
| `git-bash.exe` | Git Bash | productive | process |
| `putty.exe` | PuTTY | productive | process |
| `wsl.exe` | WSL | productive | process |
| `mintty.exe` | MinTTY (Git Bash) | productive | process |
| `dbeaver.exe` | DBeaver | productive | process |
| `pgAdmin4.exe` | pgAdmin | productive | process |
| `ssms.exe` | SQL Server Management Studio | productive | process |
| `DataGrip64.exe` | DataGrip | productive | process |
| `MongoDB Compass.exe` | MongoDB Compass | productive | process |
| `MySQLWorkbench.exe` | MySQL Workbench | productive | process |
| `chrome.exe` | Google Chrome | productive | process |
| `msedge.exe` | Microsoft Edge | productive | process |
| `firefox.exe` | Mozilla Firefox | productive | process |
| `brave.exe` | Brave Browser | productive | process |
| `opera.exe` | Opera | productive | process |
| `vivaldi.exe` | Vivaldi | productive | process |
| `arc.exe` | Arc Browser | productive | process |
| `slack.exe` | Slack | productive | process |
| `Teams.exe` | Microsoft Teams | productive | process |
| `Zoom.exe` | Zoom | productive | process |
| `Discord.exe` | Discord | productive | process |
| `Skype.exe` | Skype | productive | process |
| `Webex.exe` | Cisco Webex | productive | process |
| `OUTLOOK.EXE` | Microsoft Outlook | productive | process |
| `Thunderbird.exe` | Thunderbird | productive | process |
| `Notion.exe` | Notion | productive | process |
| `Obsidian.exe` | Obsidian | productive | process |
| `Trello.exe` | Trello | productive | process |
| `Evernote.exe` | Evernote | productive | process |
| `explorer.exe` | File Explorer | productive | process |
| `SnippingTool.exe` | Snipping Tool | productive | process |
| `mspaint.exe` | Paint | productive | process |
| `calc.exe` | Calculator | productive | process |
| `Acrobat.exe` | Adobe Acrobat | productive | process |
| `FoxitPDFReader.exe` | Foxit PDF Reader | productive | process |
| `spotify.exe` | Spotify | non_productive | process |
| `steam.exe` | Steam | non_productive | process |
| `steamwebhelper.exe` | Steam Web Helper | non_productive | process |
| `epicgameslauncher.exe` | Epic Games Launcher | non_productive | process |
| `Battle.net.exe` | Battle.net | non_productive | process |
| `Origin.exe` | EA Origin | non_productive | process |
| `vlc.exe` | VLC Media Player | non_productive | process |
| `wmplayer.exe` | Windows Media Player | non_productive | process |
| `iTunes.exe` | iTunes | non_productive | process |
| `Netflix.exe` | Netflix (Desktop) | non_productive | process |
| `Twitch.exe` | Twitch | non_productive | process |
| `foobar2000.exe` | foobar2000 | non_productive | process |
| `CandyCrush*.exe` | Candy Crush | non_productive | process |
| `Solitaire.exe` | Microsoft Solitaire | non_productive | process |
| `1Password.exe` | 1Password | private | process |
| `Bitwarden.exe` | Bitwarden | private | process |
| `KeePass.exe` | KeePass | private | process |
| `LastPass.exe` | LastPass | private | process |
| `Dashlane.exe` | Dashlane | private | process |
| `WhatsApp.exe` | WhatsApp | private | process |
| `Telegram.exe` | Telegram | private | process |
| `Signal.exe` | Signal | private | process |
| `Messenger.exe` | Facebook Messenger | private | process |
| `github.com` | GitHub | productive | url |
| `gitlab.com` | GitLab | productive | url |
| `bitbucket.org` | Bitbucket | productive | url |
| `stackoverflow.com` | Stack Overflow | productive | url |
| `stackexchange.com` | Stack Exchange | productive | url |
| `dev.to` | DEV Community | productive | url |
| `medium.com` | Medium | productive | url |
| `docs.google.com` | Google Docs | productive | url |
| `sheets.google.com` | Google Sheets | productive | url |
| `slides.google.com` | Google Slides | productive | url |
| `drive.google.com` | Google Drive | productive | url |
| `mail.google.com` | Gmail | productive | url |
| `outlook.office.com` | Outlook Web | productive | url |
| `outlook.live.com` | Outlook.com | productive | url |
| `calendar.google.com` | Google Calendar | productive | url |
| `meet.google.com` | Google Meet | productive | url |
| `zoom.us` | Zoom Web | productive | url |
| `app.slack.com` | Slack Web | productive | url |
| `teams.microsoft.com` | Teams Web | productive | url |
| `*.atlassian.net` | Atlassian (Jira/Confluence) | productive | url |
| `trello.com` | Trello Web | productive | url |
| `asana.com` | Asana | productive | url |
| `monday.com` | Monday.com | productive | url |
| `clickup.com` | ClickUp | productive | url |
| `linear.app` | Linear | productive | url |
| `notion.so` | Notion Web | productive | url |
| `figma.com` | Figma Web | productive | url |
| `canva.com` | Canva | productive | url |
| `miro.com` | Miro | productive | url |
| `lucidchart.com` | Lucidchart | productive | url |
| `vercel.com` | Vercel | productive | url |
| `netlify.com` | Netlify | productive | url |
| `aws.amazon.com` | AWS Console | productive | url |
| `console.cloud.google.com` | Google Cloud Console | productive | url |
| `portal.azure.com` | Azure Portal | productive | url |
| `app.supabase.com` | Supabase Dashboard | productive | url |
| `firebase.google.com` | Firebase Console | productive | url |
| `hub.docker.com` | Docker Hub | productive | url |
| `npmjs.com` | npm | productive | url |
| `pypi.org` | PyPI | productive | url |
| `packagist.org` | Packagist | productive | url |
| `nuget.org` | NuGet | productive | url |
| `codepen.io` | CodePen | productive | url |
| `codesandbox.io` | CodeSandbox | productive | url |
| `replit.com` | Replit | productive | url |
| `w3schools.com` | W3Schools | productive | url |
| `developer.mozilla.org` | MDN Web Docs | productive | url |
| `learn.microsoft.com` | Microsoft Learn | productive | url |
| `udemy.com` | Udemy | productive | url |
| `coursera.org` | Coursera | productive | url |
| `pluralsight.com` | Pluralsight | productive | url |
| `linkedin.com/learning` | LinkedIn Learning | productive | url |
| `chat.openai.com` | ChatGPT | productive | url |
| `claude.ai` | Claude AI | productive | url |
| `gemini.google.com` | Gemini AI | productive | url |
| `copilot.microsoft.com` | Microsoft Copilot | productive | url |
| `youtube.com` | YouTube | non_productive | url |
| `netflix.com` | Netflix | non_productive | url |
| `disneyplus.com` | Disney+ | non_productive | url |
| `hulu.com` | Hulu | non_productive | url |
| `primevideo.com` | Amazon Prime Video | non_productive | url |
| `twitch.tv` | Twitch | non_productive | url |
| `reddit.com` | Reddit | non_productive | url |
| `9gag.com` | 9GAG | non_productive | url |
| `imgur.com` | Imgur | non_productive | url |
| `facebook.com` | Facebook | non_productive | url |
| `instagram.com` | Instagram | non_productive | url |
| `twitter.com` | Twitter / X | non_productive | url |
| `x.com` | X (Twitter) | non_productive | url |
| `tiktok.com` | TikTok | non_productive | url |
| `pinterest.com` | Pinterest | non_productive | url |
| `snapchat.com` | Snapchat | non_productive | url |
| `tumblr.com` | Tumblr | non_productive | url |
| `buzzfeed.com` | BuzzFeed | non_productive | url |
| `open.spotify.com` | Spotify Web | non_productive | url |
| `music.youtube.com` | YouTube Music | non_productive | url |
| `soundcloud.com` | SoundCloud | non_productive | url |
| `store.steampowered.com` | Steam Store | non_productive | url |
| `epicgames.com` | Epic Games Store | non_productive | url |
| `amazon.com` | Amazon Shopping | non_productive | url |
| `ebay.com` | eBay | non_productive | url |
| `flipkart.com` | Flipkart | non_productive | url |
| `myntra.com` | Myntra | non_productive | url |
| `*.bank.*` | Banking Sites (pattern) | private | url |
| `*.bankofamerica.com` | Bank of America | private | url |
| `*.chase.com` | Chase Bank | private | url |
| `*.wellsfargo.com` | Wells Fargo | private | url |
| `*.citi.com` | Citibank | private | url |
| `*.hdfcbank.com` | HDFC Bank | private | url |
| `*.icicibank.com` | ICICI Bank | private | url |
| `*.sbi.co.in` | SBI | private | url |
| `*.axisbank.com` | Axis Bank | private | url |
| `*.kotak.com` | Kotak Mahindra Bank | private | url |
| `paypal.com` | PayPal | private | url |
| `*.venmo.com` | Venmo | private | url |
| `web.whatsapp.com` | WhatsApp Web | private | url |
| `web.telegram.org` | Telegram Web | private | url |
| `messages.google.com` | Google Messages | private | url |
| `messenger.com` | Facebook Messenger Web | private | url |
| `myaccount.google.com` | Google Account | private | url |
| `account.microsoft.com` | Microsoft Account | private | url |
| `*.healthcare.gov` | Healthcare.gov | private | url |
| `*.mycharthealth.com` | MyChart (Health) | private | url |
| `*.patient.*` | Patient Portals (pattern) | private | url |
| `*.health.*` | Health Portals (pattern) | private | url |
| `mint.intuit.com` | Mint (Finance) | private | url |
| `*.creditkarma.com` | Credit Karma | private | url |
| `*.turbotax.com` | TurboTax | private | url |
| `*.hrblock.com` | H&R Block | private | url |

**Total: 195 predefined classifications** (126 productive, 42 non-productive, 27 private) — 93 desktop apps (match by process) + 102 web apps (match by url)

##### Classification Lookup Logic

```
Window switch detected → Get process name + window title
                                    ↓
                    Is the process a browser? (chrome.exe, msedge.exe, firefox.exe, etc.)
                                    ↓
                ┌──── YES ──────────┴──────────── NO ────┐
                ↓                                         ↓
    Check window title against              Check process name against
    URL-based entries (match_by=url)        process-based entries (match_by=process)
                ↓                                         ↓
        Match found?                              Match found?
        ├── YES → Use URL entry's type            ├── YES → Use process entry's type
        └── NO  → Default to "productive"         └── NO  → UNKNOWN (send to LLM)
                  (browser default, OCR + AI)
```

> **Examples:**
> - `chrome.exe` + title contains "youtube.com" → matches `youtube.com` (url) → **non_productive**
> - `chrome.exe` + title contains "HDFC Bank" → matches `*.hdfcbank.com` (url) → **private** (window title redacted)
> - `chrome.exe` + title contains "PROJ-421 - Jira" → matches `*.atlassian.net` (url) → **productive**
> - `chrome.exe` + title "Some Unknown Site" → no URL match → defaults to **productive** (OCR + AI decides)
> - `code.exe` → matches process → **productive**
> - `spotify.exe` → matches process → **non_productive**
> - `1Password.exe` → matches process → **private**
> - `SomeNewApp.exe` → no process match → **unknown** (LLM classifies)

> **Note:** The web-based classification list works alongside the existing `organization_settings.private_sites` feature. Admins can add additional domains through the settings UI. The desktop app checks both the predefined list and the admin-configured private sites when classifying browser activity.

#### Storage & Sync

- **Primary source:** Supabase database (`application_classifications` table)
- **Local cache:** SQLite database on the desktop app
- **Sync frequency:** On app startup + every 30 minutes
- **Offline support:** Desktop app uses the local SQLite cache when Supabase is unreachable. Stale cache is acceptable — it just uses the last known classifications.

#### Configuration Level

- Application classifications will be configurable at the **project level**
- Project admins can customize which apps are considered productive/non-productive/private for their specific project
- A **default/global list** is provided as a starting point that projects can override
- Admins can override at organization or project level (same as Time Doctor's hierarchy: Global → Organization → Project)

---

### 3.2 Local OCR Processing

#### Concept

Move the OCR (Optical Character Recognition) step from the cloud AI server to the Python desktop app itself.

A screenshot is captured **temporarily in memory** on every window switch — OCR needs an image to extract text from. The image is processed locally and then **immediately discarded from memory**. It is never uploaded to Supabase, never stored on disk, and never sent to any external service.

#### How It Works for Each Classification

**Productive Apps:**
```
Window switch detected → app is "productive"
    ↓
Capture screenshot (in memory)
    ↓
Run Tesseract OCR locally → extract text
    ↓
Save OCR text + app name + window title + time to SQLite
    ↓
Discard screenshot from memory
    ↓
On batch upload: send OCR text to AI for Jira task matching
```

**Non-Productive Apps:**
```
Window switch detected → app is "non_productive"
    ↓
No screenshot captured — not needed (no OCR)
    ↓
Save app name + window title + time to SQLite (no OCR text)
    ↓
On batch upload: send metadata only, no AI call
```

**Private Apps:**
```
Window switch detected → app is "private"
    ↓
No screenshot captured — not needed (no OCR)
    ↓
Save app name + time ONLY to SQLite (window title REDACTED)
    ↓
On batch upload: send app name + time only, no AI call, no window title
```

**Unknown Apps (not in classification list):**
```
Window switch detected → app not found in classification cache
    ↓
Capture screenshot (in memory)
    ↓
Run Tesseract OCR locally → extract text
    ↓
Send OCR text + window title + app name to LLM
    ↓
LLM classifies: "productive", "non_productive", or "private"
    ↓
Save to SQLite with LLM's classification + OCR text (if productive) or metadata only (if non-productive/private)
    ↓
Discard screenshot from memory
    ↓
Flag app for admin to permanently classify
    ↓
On batch upload: handled based on LLM's classification
```

#### Why This Matters

| Aspect | Before (Current) | After (Proposed) |
|---|---|---|
| What leaves the device | Full screenshot image (PNG) | **Text only (productive). Metadata only (non-productive). App name + time only (private). No images ever.** |
| Screenshots captured | Every 5 min, all apps, uploaded & stored | **Only for productive & unknown apps (in memory, discarded after OCR). None for non-productive & private.** |
| Images stored in cloud | Supabase Storage (all screenshots) | **None — zero images stored anywhere** |
| AI model type | Vision model for everything (expensive) | **Text-only model (cheap) — no vision AI at all** |
| Privacy for sensitive apps | No protection — banking, health apps screenshotted and sent to AI | **Private apps: zero data captured beyond app name and time** |
| Processing speed | 3-8 seconds (upload + vision) | **<1 second (local OCR) + <1 second (text AI)** |
| Bandwidth | 500KB-2MB per screenshot | **~1-5KB of text per batch record** |

---

### 3.3 Event-Based Activity Tracking with Batch Upload

#### Concept

Replace the current **interval-based screenshot capture** (blind capture every 5 minutes) with an **event-driven tracking model**:

1. **Window switch detection** — Desktop app monitors active window changes in real-time
2. **Activity records in SQLite** — Each unique combination of `window_title + application_name` gets a single record in local SQLite
3. **Time accumulation** — When the user revisits the same window/tab, the existing record's accumulated time is updated (not a new record)
4. **OCR on switch** — OCR runs locally each time the user switches to a new window (for productive and unknown apps only)
5. **Batch upload every 5 minutes** — All accumulated records are sent to Supabase in a single batch API call, then SQLite is cleared for a fresh accumulation cycle

#### How a Record is Identified

A record is **uniquely identified** by the combination of:
- **Window Title** (e.g., "auth.service.ts - Jiraforge")
- **Application Name** (e.g., "code.exe")

This means:
- Two different files in VS Code = **two separate records**
- Same file revisited after switching away = **same record, time accumulated**
- Chrome with different tabs = **separate records per tab title**

#### What Happens on Each Event

| Event | Action |
|---|---|
| User switches to a **new** window/tab (**productive** app) | Stop timer on previous record. Classify app (process or browser URL match). Capture screenshot in memory → run OCR → discard image. Create new SQLite record with OCR text, start timer. |
| User switches to a **new** window/tab (**non-productive** app) | Stop timer on previous record. Classify app (process or browser URL match). No screenshot needed. Create new SQLite record with app name + window title + time, start timer. |
| User switches to a **new** window/tab (**private** app) | Stop timer on previous record. Classify app (process or browser URL match). No screenshot needed. Create new SQLite record with **app name + time only (window title redacted)**, start timer. |
| User switches to a **new** window/tab (**unknown** app) | Stop timer on previous record. Not found in process or URL entries. Capture screenshot → run OCR → send to LLM for classification → discard image. Create SQLite record, start timer. Flag for admin. |
| User switches to a **previously visited** window/tab | Stop timer on previous record. Find existing record, reset timer to 0, start counting. Accumulated time will be updated. |
| **5-minute batch interval** reached | Stop current timer. Upload all records to Supabase as a single batch. Send productive records' OCR text to AI for Jira task matching. Clear SQLite. Start fresh cycle. |

---

### 3.4 Detailed Example: Developer "Ravi" — Morning Work Session

#### Activity Timeline

**T0 (9:00:00 AM)** — Ravi opens **Slack** to check messages

```
App lookup: slack.exe → classified as "productive"
Screenshot captured in memory → OCR runs → text extracted → image discarded

SQLite Record A created:
  Key: "general - MyTeam - Slack" + "slack.exe"
  Classification: productive
  OCR: "Hey Ravi, can you check the login bug? ..."
  Time: 0s (timer running)
```

**T45 (9:00:45 AM)** — Ravi switches to **Jira in Chrome** to look at the bug ticket

```
Record A timer stops → accumulated time: 45s

App lookup: chrome.exe → browser detected → check window title
  Window title: "PROJ-421 Fix login redirect loop - Jira - Google Chrome"
  URL match: *.atlassian.net → classified as "productive"
Screenshot captured in memory → OCR runs → text extracted → image discarded

SQLite Record B created:
  Key: "PROJ-421 Fix login redirect loop - Jira - Google Chrome" + "chrome.exe"
  Classification: productive
  OCR: "PROJ-421 | Status: In Progress | Assignee: Ravi | Description: Users are getting..."
  Time: 0s (timer running)
```

**T120 (9:02:00 AM)** — Ravi switches to **VS Code** to fix the bug

```
Record B timer stops → accumulated time: 75s

App lookup: code.exe → classified as "productive"
Screenshot captured in memory → OCR runs → text extracted → image discarded

SQLite Record C created:
  Key: "auth.service.ts - Jiraforge - Visual Studio Code" + "code.exe"
  Classification: productive
  OCR: "import { AuthService } from './auth'; function handleRedirect()..."
  Time: 0s (timer running)
```

**T180 (9:03:00 AM)** — Ravi switches to **Chrome** to check the Jira ticket again

```
Record C timer stops → accumulated time: 60s

Record B FOUND (same window title + app name)
  Timer resets to 0, starts counting
  Previous accumulated time: 75s
```

**T200 (9:03:20 AM)** — Ravi goes back to **VS Code** (same file as before)

```
Record B timer stops → accumulated time: 75 + 20 = 95s

Record C FOUND (same window title + app name)
  Timer resets to 0, starts counting
  Previous accumulated time: 60s
```

**T230 (9:03:50 AM)** — Ravi opens **Spotify** to play music

```
Record C timer stops → accumulated time: 60 + 30 = 90s

App lookup: spotify.exe → classified as "non_productive"
No screenshot captured — not needed (no OCR for non-productive apps)

SQLite Record D created:
  Key: "Liked Songs - Spotify" + "spotify.exe"
  Classification: non_productive
  OCR: null (skipped — non-productive app)
  Time: 0s (timer running)
```

**T240 (9:04:00 AM)** — Ravi opens his **banking app** to check a transaction

```
Record D timer stops → accumulated time: 10s

App lookup: 1Password.exe → classified as "private"
No screenshot captured — not needed (no OCR for private apps)

SQLite Record E created:
  Key: "[PRIVATE]" + "1Password.exe"       ← window title REDACTED
  Classification: private
  OCR: null (skipped — private app)
  Time: 0s (timer running)
```

**T260 (9:04:20 AM)** — Ravi opens **Postman** (not in classification list)

```
Record E timer stops → accumulated time: 20s

App lookup: Postman.exe → NOT FOUND (unknown app)
Screenshot captured in memory → OCR runs → text extracted
OCR text + "Postman.exe" + window title sent to LLM
LLM responds: "productive" (Postman is an API testing tool)
Image discarded

SQLite Record F created:
  Key: "POST /api/auth/login - Jiraforge API - Postman" + "Postman.exe"
  Classification: productive (determined by LLM)
  OCR: "POST /api/auth/login | Headers: Authorization Bearer... | Body: {email: test@..."
  Time: 0s (timer running)
  Flagged: admin notified to permanently classify "Postman.exe"
```

**T300 (9:05:00 AM)** — **BATCH UPLOAD triggered** (5-minute mark)

Record F timer stops → accumulated time: 40s

#### What Gets Uploaded to Supabase (Single Batch — 1 API Call)

```json
[
  {
    "user_id": "67856b9e-ae76-49c0-bb1e-d2d2bb60d2fa",
    "organization_id": "29a10bbb-964f-4492-b040-77c624070887",
    "window_title": "general - MyTeam - Slack",
    "application_name": "slack.exe",
    "classification": "productive",
    "ocr_text": "Hey Ravi, can you check the login bug? ...",
    "total_time_seconds": 45,
    "duration_seconds": 45,
    "visit_count": 1,
    "start_time": "2026-02-18T09:00:00+05:30",
    "end_time": "2026-02-18T09:00:45+05:30",
    "user_assigned_issues": "[{\"key\": \"PROJ-421\", ...}]",
    "user_timezone": "Asia/Calcutta",
    "work_date": "2026-02-18",
    "status": "pending"
  },
  {
    "user_id": "67856b9e-ae76-49c0-bb1e-d2d2bb60d2fa",
    "organization_id": "29a10bbb-964f-4492-b040-77c624070887",
    "window_title": "PROJ-421 Fix login redirect loop - Jira - Google Chrome",
    "application_name": "chrome.exe",
    "classification": "productive",
    "ocr_text": "PROJ-421 | Status: In Progress | Assignee: Ravi...",
    "total_time_seconds": 95,
    "duration_seconds": 95,
    "visit_count": 2,
    "start_time": "2026-02-18T09:00:45+05:30",
    "end_time": "2026-02-18T09:03:20+05:30",
    "user_assigned_issues": "[{\"key\": \"PROJ-421\", ...}]",
    "user_timezone": "Asia/Calcutta",
    "work_date": "2026-02-18",
    "status": "pending"
  },
  {
    "user_id": "67856b9e-ae76-49c0-bb1e-d2d2bb60d2fa",
    "organization_id": "29a10bbb-964f-4492-b040-77c624070887",
    "window_title": "auth.service.ts - Jiraforge - Visual Studio Code",
    "application_name": "code.exe",
    "classification": "productive",
    "ocr_text": "import { AuthService } from './auth'; function handleRedirect()...",
    "total_time_seconds": 90,
    "duration_seconds": 90,
    "visit_count": 2,
    "start_time": "2026-02-18T09:02:00+05:30",
    "end_time": "2026-02-18T09:03:50+05:30",
    "user_assigned_issues": "[{\"key\": \"PROJ-421\", ...}]",
    "user_timezone": "Asia/Calcutta",
    "work_date": "2026-02-18",
    "status": "pending"
  },
  {
    "user_id": "67856b9e-ae76-49c0-bb1e-d2d2bb60d2fa",
    "organization_id": "29a10bbb-964f-4492-b040-77c624070887",
    "window_title": "Liked Songs - Spotify",
    "application_name": "spotify.exe",
    "classification": "non_productive",
    "ocr_text": null,
    "total_time_seconds": 10,
    "duration_seconds": 10,
    "visit_count": 1,
    "start_time": "2026-02-18T09:03:50+05:30",
    "end_time": "2026-02-18T09:04:00+05:30",
    "user_assigned_issues": null,
    "user_timezone": "Asia/Calcutta",
    "work_date": "2026-02-18",
    "status": "analyzed"
  },
  {
    "user_id": "67856b9e-ae76-49c0-bb1e-d2d2bb60d2fa",
    "organization_id": "29a10bbb-964f-4492-b040-77c624070887",
    "window_title": "[PRIVATE]",
    "application_name": "1Password.exe",
    "classification": "private",
    "ocr_text": null,
    "total_time_seconds": 20,
    "duration_seconds": 20,
    "visit_count": 1,
    "start_time": "2026-02-18T09:04:00+05:30",
    "end_time": "2026-02-18T09:04:20+05:30",
    "user_assigned_issues": null,
    "user_timezone": "Asia/Calcutta",
    "work_date": "2026-02-18",
    "status": "analyzed"
  },
  {
    "user_id": "67856b9e-ae76-49c0-bb1e-d2d2bb60d2fa",
    "organization_id": "29a10bbb-964f-4492-b040-77c624070887",
    "window_title": "POST /api/auth/login - Jiraforge API - Postman",
    "application_name": "Postman.exe",
    "classification": "productive",
    "ocr_text": "POST /api/auth/login | Headers: Authorization Bearer...",
    "total_time_seconds": 40,
    "duration_seconds": 40,
    "visit_count": 1,
    "start_time": "2026-02-18T09:04:20+05:30",
    "end_time": "2026-02-18T09:05:00+05:30",
    "user_assigned_issues": "[{\"key\": \"PROJ-421\", ...}]",
    "user_timezone": "Asia/Calcutta",
    "work_date": "2026-02-18",
    "status": "pending"
  }
]
```

**After upload:**
- Productive records' OCR text sent to AI server for Jira task matching (text-based AI, single batch call)
- Non-productive records (Spotify) — no AI call, already marked as analyzed
- Private records (1Password) — no AI call, no window title, already marked as analyzed
- SQLite cleared. Fresh accumulation cycle begins at T300.

#### Key Observations from This Example

1. **Process names used** — `slack.exe`, `chrome.exe`, `code.exe`, `spotify.exe` — matching actual desktop app data format
2. **Chrome Jira tab** was visited **twice** (T45 and T180) — time accumulated: 75 + 20 = **95s total**, stored as a single record
3. **VS Code auth.service.ts** was also visited **twice** (T120 and T200) — time accumulated: 60 + 30 = **90s total**, stored as a single record
4. **Spotify** is non-productive — OCR skipped, window title still captured ("Liked Songs - Spotify") for analytics
5. **1Password** is private — OCR skipped, window title **redacted to "[PRIVATE]"** — manager cannot see what the user was doing
6. **Postman** was unknown — OCR ran, LLM classified it as productive, admin flagged to permanently classify it
7. **Zero screenshots uploaded** — productive/unknown apps: images captured in memory, OCR'd locally, discarded. Non-productive/private apps: no screenshot captured at all
8. **Zero vision AI calls** — all AI analysis uses text-only models
9. **Data format matches current Supabase schema** — `user_id`, `organization_id`, `user_assigned_issues`, `user_timezone`, `work_date`, `start_time`, `end_time`, `duration_seconds`, `status` all present
10. **Every second accounted for** — 45 + 95 + 90 + 10 + 20 + 40 = 300 seconds = exactly 5 minutes

---

### 3.5 Processing Flow by App Classification

```
Window Switch Detected → Get Active Application (process name) + Window Title
                                         ↓
                          Is it a browser? (chrome.exe, msedge.exe, firefox.exe, etc.)
                                         ↓
                   ┌──── YES ────────────┴──────────────── NO ────┐
                   ↓                                               ↓
     Check window title against                      Check process name against
     URL-based entries in cache                      process-based entries in cache
     (match_by = "url")                              (match_by = "process")
                   ↓                                               ↓
           Match found?                                    Match found?
           ├── YES → Use URL entry's type                  ├── YES → Use process entry's type
           └── NO  → Default to "productive"               └── NO  → UNKNOWN
                                         ↓
                     Classification determined (or UNKNOWN)
                                         ↓
                     Capture Screenshot (in memory)
                                         ↓
        ┌───────────────────────────┼───────────────────────────┐
        ↓                           ↓                           ↓
   PRODUCTIVE                 NON-PRODUCTIVE                 PRIVATE
        ↓                           ↓                           ↓
 1. Capture screenshot       1. No screenshot needed     1. No screenshot needed
    (in memory)              2. Save app name +          2. Save app name +
 2. Run OCR locally             window title +              time ONLY
 3. Save OCR text +             time to SQLite              (window title
    app name +               3. On batch upload:              REDACTED)
    window title +              metadata only             3. On batch upload:
    time to SQLite              (no AI)                     app name + time
 4. Discard image                                           only (no AI)
 5. On batch upload:
    send OCR text
    to AI for task
    matching
                     ┌──────────────┐
                     ↓              │
                UNKNOWN APP         │
                     ↓              │
                1. Run OCR locally  │
                2. Send OCR text +  │
                   app name +       │
                   window title     │
                   to LLM           │
                3. LLM classifies:  │
                   productive /     │
                   non_productive / │
                   private          │
                4. Save accordingly │
                5. Discard image    │
                6. Flag for admin   │
                └───────────────────┘
```

---

### 3.6 Moving Settings to Project Level

#### Current State

| Setting | Current Level | Table |
|---|---|---|
| Application whitelist | Organization | `organization_settings.application_whitelist` |
| Application blacklist | Organization | `organization_settings.application_blacklist` |
| Screenshot interval | Organization | `organization_settings.screenshot_interval` |
| Auto worklog sync | Organization | `organization_settings.auto_worklog_enabled` |
| Non-work threshold | Organization | `organization_settings.non_work_threshold` |
| Private sites | Organization | `organization_settings.private_sites` |
| Tracked statuses | Project | `project_settings.tracked_statuses` |

#### Proposed State

| Setting | Proposed Level | Table |
|---|---|---|
| Application classifications (productive / non-productive / private) | Project (with global defaults) | `application_classifications` (NEW) |
| Batch upload interval | Project (with org default) | `project_settings` (extended) |
| Auto worklog sync | Project (with org default) | `project_settings` (extended) |
| Non-work threshold | Project (with org default) | `project_settings` (extended) |
| Private sites (for browser URLs) | Project (with org default) | `project_settings` (extended) |
| Tracked statuses | Project (unchanged) | `project_settings` (existing) |

#### Inheritance Model (Aligned with Time Doctor's Approach)

```
Global Defaults (system-wide predefined list)
    ↓ (inherited by)
Organization Defaults (admin can override global)
    ↓ (inherited by)
Project Settings (project admin can override org defaults)
```

If a project doesn't define its own app classifications, it inherits from the organization. If the organization doesn't define them, the system defaults apply.

---

## 4. New Database Schema

### 4.1 New Table: `application_classifications`

This is the master list of app classifications.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK to organizations |
| `project_key` | TEXT | Jira project key (NULL = org-wide default) |
| `identifier` | TEXT | Process name (e.g., "chrome.exe", "code.exe") OR domain/URL pattern (e.g., "github.com", "*.atlassian.net") |
| `display_name` | TEXT | Human-readable name (e.g., "Google Chrome", "VS Code", "GitHub") |
| `classification` | TEXT | "productive", "non_productive", or "private" |
| `match_by` | TEXT | "process" (match by Windows process name) or "url" (match by domain pattern in browser window title) |
| `is_default` | BOOLEAN | Whether this is a system-provided default |
| `created_by` | TEXT | Atlassian account ID of who added it |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Unique constraint:** `(organization_id, project_key, identifier, match_by)`

### 4.2 New Table: `activity_records`

Replaces the current `screenshots` table as the primary tracking data. Carries forward all essential fields from the current schema, mapped to the actual data format used by the desktop app.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to users (NOT NULL) |
| `organization_id` | UUID | FK to organizations |
| `window_title` | TEXT | Active window title (set to "[PRIVATE]" for private apps) |
| `application_name` | TEXT | Process name (e.g., "chrome.exe", "code.exe") |
| `classification` | TEXT | "productive", "non_productive", "private", or "unknown" |
| `ocr_text` | TEXT | Extracted text (NULL for non-productive and private apps) |
| `total_time_seconds` | INTEGER | Accumulated time in this batch cycle |
| `visit_count` | INTEGER | Number of times user visited this window in the batch cycle |
| `start_time` | TIMESTAMPTZ | First activity timestamp in this record |
| `end_time` | TIMESTAMPTZ | Last activity timestamp in this record |
| `duration_seconds` | INTEGER | Same as total_time_seconds (for compatibility with existing analytics) |
| `batch_timestamp` | TIMESTAMPTZ | When this batch was uploaded |
| `batch_start` | TIMESTAMPTZ | Start of the 5-min batch window |
| `batch_end` | TIMESTAMPTZ | End of the 5-min batch window |
| `work_date` | DATE | User's local date (for timezone-correct analytics) |
| `user_timezone` | TEXT | User's timezone (e.g., "Asia/Calcutta") |
| `project_key` | TEXT | Jira project key (populated after AI analysis) |
| `user_assigned_issue_key` | TEXT | Matched Jira issue key (populated after AI analysis) |
| `user_assigned_issues` | TEXT | JSON string of user's cached Jira issues at time of capture |
| `status` | TEXT | "pending", "processing", "analyzed", "failed" (DEFAULT "pending") |
| `metadata` | JSONB | Additional metadata (DEFAULT '{}') |
| `retry_count` | INTEGER | AI analysis retry count (DEFAULT 0) |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |
| `analyzed_at` | TIMESTAMPTZ | When AI analysis completed |

**Notes:**
- Non-productive and private records are inserted with `status: "analyzed"` since they don't need AI processing
- Private records have `window_title: "[PRIVATE]"` and `ocr_text: null`
- `user_assigned_issues` is carried forward from the current schema — the desktop app caches Jira issues locally and includes them with each record

**Indexes:**
- `idx_activity_user_work_date` on (user_id, work_date)
- `idx_activity_org_user_work_date` on (organization_id, user_id, work_date)
- `idx_activity_batch_timestamp` on (batch_timestamp)
- `idx_activity_status` on (status)
- `idx_activity_user_timestamp` on (user_id, start_time)
- `idx_activity_project_key` on (project_key)

### 4.3 Extended Table: `project_settings`

Adding new columns to the existing `project_settings` table:

| New Column | Type | Default | Description |
|---|---|---|---|
| `batch_upload_interval` | INTEGER | NULL (inherit from org) | Batch upload frequency in seconds (default 300) |
| `auto_worklog_enabled` | BOOLEAN | NULL (inherit from org) | Auto-sync worklogs |
| `non_work_threshold` | INTEGER | NULL (inherit from org) | Non-work percentage threshold |

NULL values mean "inherit from organization settings."

### 4.4 New SQLite Tables (Desktop App)

#### Table: `app_classifications_cache`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary key |
| `organization_id` | TEXT | Organization ID |
| `project_key` | TEXT | Project key (NULL = org default) |
| `identifier` | TEXT | Process name (e.g., "chrome.exe") or domain pattern (e.g., "github.com") |
| `display_name` | TEXT | Human-readable name |
| `classification` | TEXT | "productive", "non_productive", or "private" |
| `match_by` | TEXT | "process" or "url" |
| `cached_at` | TEXT | When this was last synced |

#### Table: `active_sessions`

This is the real-time activity tracking table that accumulates data between batch uploads.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary key |
| `window_title` | TEXT | Active window title ("[PRIVATE]" for private apps) |
| `application_name` | TEXT | Process name (e.g., "code.exe") |
| `classification` | TEXT | "productive", "non_productive", "private", or "unknown" |
| `ocr_text` | TEXT | Latest OCR extraction (NULL for non-productive/private) |
| `total_time_seconds` | REAL | Accumulated time across all visits |
| `visit_count` | INTEGER | Number of times visited in this cycle |
| `first_seen` | TEXT | First time seen in this batch cycle (ISO 8601) |
| `last_seen` | TEXT | Last time seen in this batch cycle (ISO 8601) |
| `timer_started_at` | TEXT | When the current visit timer started (NULL if not active) |

**Unique constraint:** `(window_title, application_name)`

---

## 5. Desktop App Changes

### 5.1 New Dependency: Tesseract OCR

- Add `pytesseract` to Python requirements
- Bundle the Tesseract OCR binary with the PyInstaller build
- Tesseract is open-source (Apache 2.0 license) — no licensing concerns
- Supports 100+ languages, works offline
- Estimated addition to installer size: ~30-40 MB

### 5.2 New SQLite Tables

- Add `app_classifications_cache` table for synced app list
- Add `active_sessions` table for real-time activity tracking
- Sync classifications from Supabase on startup and every 30 minutes
- Handle offline gracefully using stale cache

### 5.3 Replaced Capture Loop

The main tracking loop fundamentally changes:

**Before (Interval-Based):**
```
Every 5 minutes:
  → Capture screenshot
  → Upload PNG to Supabase Storage
  → Insert record to Supabase database
  → AI server analyzes image
```

**After (Event-Based):**
```
Continuously:
  → Monitor active window for changes
  → On window switch:
      → Get process name + window title
      → Classify app:
          - If browser → check window title against URL entries in SQLite cache
          - If not browser → check process name against process entries in SQLite cache
          - If no match → UNKNOWN
      → If productive: capture screenshot in memory → run OCR locally → save text + metadata to SQLite → discard image
      → If non-productive: save app name + window title + time to SQLite (no screenshot needed)
      → If private: save app name + time only to SQLite, redact window title (no screenshot needed)
      → If unknown: capture screenshot → run OCR → send to LLM for classification → save accordingly → discard image → flag for admin
      → Create or update active_sessions record
  → Every 5 minutes:
      → Stop current timer
      → Batch upload all active_sessions to Supabase (1 API call)
      → Send productive records' OCR text to AI for task matching (1 API call)
      → Clear active_sessions table
      → Resume tracking
```

### 5.4 New API Endpoints on AI Server

**Endpoint 1: Batch text-based analysis (for productive app task matching)**

```
POST /api/analyze-batch
Body: {
    records: [
      {
        id: "uuid",
        window_title: "auth.service.ts - Jiraforge - Visual Studio Code",
        application_name: "code.exe",
        ocr_text: "import { AuthService } from ...",
        total_time_seconds: 110,
        start_time: "2026-02-18T09:02:00+05:30",
        end_time: "2026-02-18T09:04:10+05:30",
        classification: "productive"
      },
      ...
    ],
    user_assigned_issues: ["PROJ-421", "PROJ-389", ...],
    user_id: "...",
    organization_id: "..."
}
```

This endpoint uses a **text-only AI model** (much cheaper than vision) to match each activity to a Jira issue. A single API call handles the entire batch.

**Endpoint 2: App classification (for unknown apps)**

```
POST /api/classify-app
Body: {
    application_name: "Postman.exe",
    window_title: "POST /api/auth/login - Jiraforge API - Postman",
    ocr_text: "POST /api/auth/login | Headers: Authorization Bearer..."
}

Response: {
    classification: "productive",
    confidence: 0.95,
    reasoning: "Postman is an API testing tool commonly used for development work"
}
```

This endpoint uses the LLM to classify unknown applications. Called in real-time when an unknown app is encountered.

---

## 6. Settings UI Changes (Forge App)

### 6.1 Project Settings Panel (Enhanced)

The existing project settings page will be extended with:

- **Application Classifications Manager**
  - View all classified apps for this project
  - Three-way classification: Productive / Non-Productive / Private
  - Add/remove/reclassify applications
  - Import from organization defaults
  - Bulk import from CSV
  - "Unknown Apps" queue — apps detected by the desktop app but not yet permanently classified by admin, with LLM-suggested classification shown

- **Tracking Configuration**
  - Batch upload interval (override org default or inherit)
  - Auto worklog sync toggle
  - Non-work threshold
  - Tracked statuses (existing feature, unchanged)

### 6.2 Organization Settings Panel (Simplified)

- Becomes the "default template" for all projects
- Admins configure org-wide defaults here
- Projects that don't customize will use these defaults

---

## 7. Comparison: Current vs. Proposed Architecture

### Data Flow Comparison

**Current (Interval-Based, Screenshot-Centric):**

```
Every 5 min → Capture PNG → Upload to Supabase Storage → Insert DB record
           → AI Server downloads image → Vision AI analyzes → Store result

Per hour: 12 screenshots × (1 storage upload + 1 DB insert + 1 vision API call) = 36 operations
```

**Proposed (Event-Based, Text-Centric):**

```
Continuously → Detect window switch → Capture in memory → Classify app
  → Productive: OCR locally → save text → discard image
  → Non-productive: skip OCR → save metadata → discard image
  → Private: skip OCR → save app name + time only → discard image
  → Unknown: OCR → LLM classifies → save → discard image → flag admin
Every 5 min → Batch upload all records (1 API call)
           → Text AI analyzes productive batch (1 API call)
           → 0 storage uploads, 0 vision API calls

Per hour: 12 batch uploads × (1 batch DB insert + 1 text AI call) = 24 operations
```

### Side-by-Side Comparison

| Aspect | Current | Proposed |
|---|---|---|
| Tracking model | Interval (every 5 min) | Event (every window switch) |
| Screenshot images | Captured, uploaded, stored | **Productive/unknown: captured in memory, OCR'd, discarded. Non-productive/private: no screenshot at all.** |
| OCR location | Cloud (AI server fallback) | **Local (desktop app)** |
| AI model | Vision (image analysis) | **Text-only (no vision AI at all)** |
| Data uploaded | PNG image + metadata | **Text + metadata only** |
| Upload frequency | Every 5 min per capture | **Every 5 min, single batch** |
| DB calls per hour | ~12 inserts + 12 updates | **~12 batch inserts** |
| Non-productive handling | Same expensive pipeline | **Metadata only, no OCR, no AI** |
| Private app handling | No protection — screenshotted and processed | **Window title redacted, no OCR, no AI, minimal data** |
| Unknown app handling | N/A | **LLM classifies based on OCR text, flags for admin** |
| Time accuracy | Snapshot of one moment | **Every second tracked** |
| Privacy | Screenshots leave device | **No images leave device — ever** |

---

## 8. Cost Impact Analysis

### Current Cost Per User Per Month

| Item | Volume | Unit Cost | Monthly Cost |
|---|---|---|---|
| AI Vision API calls | ~2,016/month (12/hr x 8hr x 21 days) | ~$0.02/call | **~$40.32** |
| Supabase Storage (screenshots) | ~2,016 images x 1MB avg | $0.021/GB | **~$0.04** |
| Supabase DB operations | ~4,032/month (insert + update per screenshot) | Included | — |
| **Total per user** | | | **~$40.36** |

### Proposed Cost Per User Per Month

Assuming 60% productive, 10% non-productive, 5% private, 10% unknown (decreasing), 15% idle:

| Item | Volume | Unit Cost | Monthly Cost |
|---|---|---|---|
| AI Text API calls (batch, productive task matching) | ~2,016 batches × ~60% need text AI | ~$0.001/call | **~$1.21** |
| AI Text API calls (unknown app classification) | ~50/month (decreases as admins classify) | ~$0.001/call | **~$0.05** |
| AI Vision API calls | **0** (eliminated entirely) | — | **$0** |
| Supabase Storage | **0** (no screenshots stored) | — | **$0** |
| Supabase DB operations | ~2,016 batch inserts/month | Included | — |
| **Total per user** | | | **~$1.26** |

### Savings

| Metric | Before | After | Savings |
|---|---|---|---|
| AI cost per user/month | ~$40.36 | ~$1.26 | **~97% reduction** |
| Vision model calls | ~2,016/month | **0** | **100% eliminated** |
| Screenshots uploaded | ~2,016/month | **0** | **100% eliminated** |
| Supabase Storage used | ~2 GB/month | **0 GB** | **100% eliminated** |
| DB operations per hour | ~24 (12 inserts + 12 updates) | ~12 (batch inserts) | **~50% reduction** |
| Data sent to external AI | Full images | Text only | **No images leave device — ever** |

**For a 50-user organization:**

| Metric | Before | After | Monthly Savings |
|---|---|---|---|
| AI costs | ~$2,018 | ~$63 | **~$1,955/month** |
| Annual savings | | | **~$23,460/year** |
| Supabase Storage | ~100 GB/month | 0 GB | **100% eliminated** |

*Note: Costs are estimates and will vary based on AI provider pricing, actual usage patterns, and the ratio of productive/non-productive/private/unknown apps.*

---

## 9. Privacy & Compliance Impact

| Concern | Before | After |
|---|---|---|
| Screenshots captured | All activity, stored in cloud | **Productive/unknown: captured in memory for OCR, immediately discarded. Non-productive/private: no screenshot at all.** |
| Images sent to AI providers | All screenshots (100%) | **None — zero images sent, ever** |
| Data sent to AI | Full images (may contain passwords, personal info) | **Extracted text only (productive apps). No data for non-productive/private.** |
| Data stored in Supabase | Screenshots (PNG) for all activity + metadata | **Text + metadata only. Zero images.** |
| Sensitive app protection | No protection — banking, health apps captured and processed | **Private classification: window title redacted, no OCR, no AI, minimal data** |
| Atlassian compliance risk | HIGH (all screenshots to external AI) | **SIGNIFICANTLY REDUCED (no images leave the device)** |
| GDPR data minimization | Poor (all screenshots processed and stored externally) | **Good (no images, minimal text data, private apps fully protected)** |
| "Runs on Atlassian" eligibility | Not eligible | Still not eligible (external AI server), but risk profile vastly improved |
| Employee monitoring sensitivity | High (visual surveillance via screenshots) | **Much lower (text-based activity logging, private apps protected)** |

---

## 10. Performance Impact

| Metric | Before | After |
|---|---|---|
| Time to record (productive app) | 3-8 sec (upload + vision API) | **<1 sec (local OCR, stored in SQLite)** |
| Time to record (non-productive app) | 3-8 sec (upload + vision API) | **<0.1 sec (SQLite insert, no OCR)** |
| Time to record (private app) | 3-8 sec (upload + vision API) | **<0.1 sec (SQLite insert, no OCR, no window title)** |
| Time to record (unknown app) | N/A | **~1-2 sec (local OCR + LLM classification call)** |
| Network bandwidth per cycle | 500KB-2MB per screenshot (x12/hr) | **~5-20KB per batch (x12/hr). Zero image uploads.** |
| Supabase API calls per hour | ~24 (inserts + updates) | **~12 (batch inserts only)** |
| Desktop app CPU usage | Low (just capture) | Moderate during OCR (~1-2 sec spike per window switch for productive/unknown apps) |
| Desktop app memory | ~100-150MB | ~150-200MB (Tesseract engine loaded) |
| Installer size | ~50MB | ~80-90MB (Tesseract binary bundled) |
| Time tracking accuracy | ~5 min granularity (snapshot moments) | **Per-second accuracy (continuous tracking)** |

---

## 11. Implementation Phases

### Phase 1: Database & Backend (Week 1-2)

- Create `application_classifications` table in Supabase (productive / non-productive / private)
- Seed predefined application list (~195 desktop + web apps with correct process names and domain patterns)
- Create `activity_records` table in Supabase matching current data format (with new fields: classification, ocr_text, visit_count, batch_timestamp)
- Extend `project_settings` table with new columns
- Create new AI server endpoint: `POST /api/analyze-batch` (text-based batch task matching)
- Create new AI server endpoint: `POST /api/classify-app` (LLM-based unknown app classification)
- Add Forge resolvers for managing app classifications (CRUD + unknown apps queue)
- Add RLS policies for new tables
- Write migration scripts
- Update analytics views (`daily_time_summary`, `weekly_time_summary`, `monthly_time_summary`) to work with new `activity_records` table

### Phase 2: Desktop App Changes (Week 2-3)

- Integrate `pytesseract` into the desktop app
- Bundle Tesseract binary with PyInstaller
- Create `app_classifications_cache` SQLite table
- Create `active_sessions` SQLite table
- Implement Supabase → SQLite sync logic for classifications
- Implement window switch detection (event-driven tracking)
- Implement local OCR processing with image preprocessing (grayscale, contrast)
- Implement 4-path classification logic (productive → OCR, non-productive → skip, private → skip + redact, unknown → OCR + LLM)
- Implement window title redaction for private apps
- Implement time accumulation logic (per window_title + application_name)
- Implement batch upload mechanism (every 5 minutes)
- Update offline handling for new data model
- Testing across different applications and screen content

### Phase 3: Settings UI (Week 3-4)

- Build project-level app classification manager in Forge UI (productive / non-productive / private)
- Build "Unknown Apps" review queue showing LLM-suggested classifications
- Add project-level tracking settings UI
- Implement inheritance display (show what's inherited vs. overridden)
- Update organization settings to show it's the "default template"
- Update analytics dashboard to work with new `activity_records` data
- Add privacy indicators in dashboard (show private time as aggregate, no details)

### Phase 4: Testing & Rollout (Week 4-5)

- End-to-end testing of all four paths (productive, non-productive, private, unknown)
- OCR quality testing across various applications (IDEs, browsers, Office apps, dark mode, etc.)
- LLM classification accuracy testing for unknown apps
- Private app redaction testing (verify window titles are never captured)
- Performance testing (CPU/memory impact on desktop)
- Batch upload reliability testing (network interruptions, large batches)
- Time accumulation accuracy testing
- Migration testing for existing organizations
- Staged rollout (internal → beta users → all users)

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OCR quality is poor for certain apps (dark themes, small fonts, canvas/video apps) | Medium | Medium | Implement image preprocessing (grayscale, contrast enhancement) before OCR. Even if OCR output is poor, the AI still has window title + app name for task matching. |
| Tesseract increases installer size significantly | Low | Low | ~30-40MB increase is acceptable. Can use Tesseract's "fast" model instead of "best" to reduce size. |
| Desktop app CPU spike during OCR on frequent window switches | Medium | Medium | Throttle OCR to max once per 3-5 seconds. If user switches rapidly, only OCR the final window they land on. |
| LLM classification of unknown apps adds latency | Low | Low | Classification call is ~1 second. Only happens once per new unknown app. After admin classifies, future encounters are instant (local cache lookup). |
| Admins don't classify apps, leading to repeated LLM classification calls | Medium | Medium | Provide comprehensive default list (195 desktop + web apps). Show "unknown apps" count prominently in admin dashboard. LLM classifications cached locally for the session. |
| Private app window title accidentally captured | Low | High | Redaction happens immediately at capture time in the desktop app, before SQLite insert. Window title is never stored even temporarily. Code reviewed for this. |
| Browser-based banking/healthcare not caught by app classification | Low | Medium | URL-based entries in the classification table already cover major banking/healthcare domains (e.g., `*.hdfcbank.com`, `*.healthcare.gov`). Additionally, the existing `private_sites` list in organization settings provides a second layer of protection for any domains not in the predefined list. Admins can add custom domains through the settings UI. |
| Project-level settings create management overhead | Low | Low | Inheritance model means projects only need to configure overrides. Org defaults handle 80% of cases. |
| Breaking change for existing users | Medium | High | Migration script auto-creates org-level defaults from existing `organization_settings` whitelist/blacklist. No user action needed. |
| Batch upload fails mid-cycle (network drop) | Medium | Medium | Keep records in SQLite until confirmed uploaded. Retry on next cycle. Records are not cleared until upload succeeds. |
| Window title changes within same app without user switching | Low | Low | Debounce window title changes — only treat as a "switch" if the title differs significantly or the application changes. |

---

## 13. Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| AI cost reduction | >95% decrease | Compare monthly AI API spend before/after |
| Vision API calls | **0** (fully eliminated) | Monitor AI server logs |
| Screenshots stored in cloud | **0** | Monitor Supabase Storage usage |
| Supabase API calls | >40% reduction | Compare DB operation counts |
| Analysis speed (productive apps) | <1 second per batch record | Measure in desktop app |
| Unknown app classification accuracy | >90% correct | Compare LLM classification vs. admin override |
| Private app data protection | 100% window title redaction | Audit Supabase for private records — verify no window titles leaked |
| Time tracking accuracy | Per-second granularity | Compare against manual time logs |
| Unknown app percentage | <10% after 2 weeks | Track unclassified app encounters |
| OCR extraction quality | >85% usable text for productive apps | Compare AI task matching accuracy before/after |
| Batch upload reliability | >99.5% success rate | Monitor upload failures vs. successes |

---

## 14. Summary

This proposal transforms the JIRAForge desktop app from a **"capture screenshot every 5 minutes, upload everything, send everything to AI vision"** model to an **intelligent, event-driven, privacy-first, cost-efficient** model with industry-standard 3-way application classification:

| What Changes | From | To |
|---|---|---|
| Tracking model | Interval-based (every 5 min) | Event-based (every window switch) |
| App classification | 2-way (office / non-office) | **3-way: Productive / Non-Productive / Private** |
| Screenshots | Captured, uploaded, stored in cloud | **Productive/unknown: in memory for OCR, discarded. Non-productive/private: none at all.** |
| OCR | Cloud-side (AI server fallback) | **Local on user's device** |
| AI analysis | Vision model on every screenshot | **Text-only model, batch, productive apps only** |
| Non-productive apps | Same expensive pipeline as productive | **Metadata only, no OCR, zero AI cost** |
| Private apps | No protection — screenshotted and processed | **Window title redacted, no OCR, no AI, app name + time only** |
| Unknown apps | N/A (no classification existed) | **LLM classifies from OCR text, flags for admin** |
| Database calls | 1 per screenshot (12/hr) | **1 batch per 5 min (12/hr, fewer total ops)** |
| Time accuracy | 5-minute snapshots | **Per-second continuous tracking** |

**Key outcomes:**
- **~97% reduction in AI costs** (~$40/user/month → ~$1.26/user/month)
- **Zero screenshots stored** — complete elimination of image storage
- **Zero images sent to AI** — only extracted text, no vision AI at all
- **Private app protection** — banking, healthcare, personal finance apps fully protected with window title redaction
- **Industry-standard classification** — 3-way system aligned with Hubstaff, DeskTime, ActivTrak
- **Per-second time tracking** — far more accurate than 5-minute snapshots
- **~50% fewer database operations** — batch uploads instead of individual inserts
- **Self-improving classification** — unknown apps auto-classified by LLM, permanently classified by admin
- **Better Atlassian compliance** — no screenshots leaving the device, private data protected

---

*Prepared by: JIRAForge Development Team*
*Date: February 18, 2026*
