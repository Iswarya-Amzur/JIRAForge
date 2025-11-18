# BRD Automate & Time Tracker for Jira

A comprehensive Forge application that provides two powerful features:
1. **Automated Time Tracking** - Desktop app captures screenshots, AI analyzes them, and automatically logs work time to Jira
2. **BRD Automation** - Upload Business Requirements Documents (PDF/DOCX) and automatically generate Jira Epics, Stories, and Tasks

## Architecture

- **Forge Custom UI** - Jira integration with React-based UI
- **Supabase** - Backend database, authentication, and file storage
- **AI Analysis Server** - Processes screenshots and BRD documents
- **Desktop App** - Cross-platform screenshot capture tool

## Project Structure

```
jira1/
├── forge-app/               # Atlassian Forge application (Jira integration)
│   ├── manifest.yml         # Forge app configuration
│   ├── package.json         # Dependencies
│   ├── src/
│   │   └── index.js        # Resolver functions (backend API)
│   ├── static/
│   │   ├── main/           # Main dashboard UI
│   │   └── settings/       # Settings page UI
│   └── README.md           # Forge app documentation
├── supabase/                # Supabase backend configuration
│   ├── migrations/          # Database schema and RLS policies
│   ├── functions/           # Edge Functions (webhooks)
│   ├── config.toml          # Local development config
│   ├── SETUP.md            # Detailed setup guide
│   └── README.md           # Supabase documentation
├── desktop-app/             # Electron desktop application
│   ├── src/
│   │   ├── main.js          # Electron main process
│   │   ├── screenshot-capture.js
│   │   ├── auth-manager.js
│   │   ├── supabase-client.js
│   │   └── renderer/        # UI components
│   ├── package.json
│   └── README.md           # Desktop app documentation
├── ai-server/               # AI Analysis Server (Express.js)
│   ├── src/
│   │   ├── index.js         # Express server
│   │   ├── controllers/     # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth & validation
│   │   └── utils/           # Logger, helpers
│   ├── package.json
│   └── README.md           # AI server documentation
├── README.md                # Project overview (this file)
├── PROJECT_SUMMARY.md       # Detailed project summary
└── plan.txt                 # 9-month development plan
```

## Features Implemented (Phase 1.1)

### Forge Manifest (`manifest.yml`)
- **Modules:**
  - `jira:projectPage` - Main dashboard on project pages
  - `jira:issuePanel` - Time analytics panel on issue pages
  - `jira:adminPage` - Admin settings page
- **Permissions:**
  - `read:me` - Get current user info
  - `read:jira-work` - Read Jira issues and worklogs
  - `write:jira-work` - Create worklogs and issues
  - `read:jira-user` - Read user data
  - `write:jira-user` - Assign issues to users
  - External fetch to `*.supabase.co` for backend communication

### Resolver Functions (`src/index.js`)
Backend API endpoints for the Forge app:
- `getTimeAnalytics` - Fetch time tracking data from Supabase
- `getScreenshots` - Retrieve screenshot gallery for user
- `deleteScreenshot` - Remove a screenshot from storage
- `uploadBRD` - Handle BRD document upload
- `createIssuesFromBRD` - Process BRD and create Jira issues
- `createWorklog` - Create worklog entries in Jira
- `getSettings` / `saveSettings` - Manage app configuration

### Main Dashboard UI (`static/main`)
React application with three main tabs:
1. **Time Analytics** - View daily/weekly summaries, time by project, time by issue
2. **Screenshot Gallery** - Review captured screenshots, delete unwanted ones
3. **BRD Upload** - Upload PDF/DOCX documents for automatic issue creation

### Settings UI (`static/settings`)
Admin configuration interface:
- Supabase connection settings (URL, API key)
- Time tracking configuration (screenshot interval, auto worklog)
- AI server configuration
- Desktop app installation instructions

## Setup Instructions

### Prerequisites
- Node.js 20.x or 22.x
- Forge CLI (`npm install -g @forge/cli`)
- Atlassian account with development access

### Installation

1. **Install Forge app dependencies:**
```bash
cd forge-app
npm install
cd static/main && npm install && cd ../..
cd static/settings && npm install && cd ../..
```

2. **Build the UI components:**
```bash
npm run build
```

3. **Register the app with Forge:**
```bash
forge register
```
This will update the `app.id` in `manifest.yml`.

4. **Deploy to development:**
```bash
forge deploy
```

5. **Install on a Jira site:**
```bash
forge install
```

6. **Return to project root:**
```bash
cd ..
```

### Development

- **Local tunneling (for UI development):**
```bash
forge tunnel
```

- **View logs:**
```bash
forge logs
```

- **Build UI only:**
```bash
npm run build:main    # Build main dashboard
npm run build:settings # Build settings page
```

## Phase 1: Foundation & Core Infrastructure ✓ COMPLETE

All Phase 1 components have been implemented:

### Phase 1.1: Forge Environment & Manifest Setup ✓
- [x] Forge project initialized with Custom UI
- [x] Manifest configured with required modules and scopes
- [x] Basic settings page UI implemented
- [x] Main dashboard with Time Analytics, Screenshot Gallery, and BRD Upload tabs

### Phase 1.2: Supabase Architecture & Schema ✓
- [x] Database schema defined (6 tables + 3 views)
- [x] Row-Level Security (RLS) policies implemented
- [x] Storage buckets configured (screenshots, documents)
- [x] Edge Functions created (screenshot-webhook, document-webhook)
- [x] Database triggers for automatic webhook notifications
- [x] Comprehensive setup documentation

### Phase 1.3: Desktop App & Auth POC ✓
- [x] Electron framework setup complete
- [x] OAuth 3LO authentication flow implemented
- [x] JWT storage mechanism with electron-store
- [x] Screenshot capture with active window detection
- [x] Supabase integration for file uploads
- [x] System tray integration

### Phase 1.4: AI Server & Data Bridge POC ✓
- [x] Express server with REST API
- [x] Screenshot analysis endpoint (OCR + Jira correlation)
- [x] BRD processing endpoint (PDF/DOCX extraction + AI parsing)
- [x] Supabase integration for data storage
- [x] Bearer token authentication
- [x] Comprehensive logging with Winston

## Next Steps

### Phase 2: Core Feature Implementation (Months 3-5)
- [ ] Complete screenshot tracking end-to-end flow
- [ ] Implement time analytics aggregation
- [ ] Build interactive dashboard with charts
- [ ] Integrate automatic worklog creation
- [ ] Add screenshot review and deletion features
- [ ] Implement notification system

### Phase 3: BRD Automation & Polish (Months 6-7)
- [ ] Complete BRD processing with GPT-4/Gemini
- [ ] Implement Jira bulk issue creation
- [ ] Add confirmation UI for created issues
- [ ] Performance optimization
- [ ] End-to-end testing
- [ ] Security review

### Phase 4: Launch & Marketplace Submission (Months 8-9)
- [ ] Beta testing program (30-50 testers)
- [ ] Documentation and video tutorials
- [ ] Privacy policy and legal documents
- [ ] Marketplace assets (screenshots, demo video)
- [ ] Atlassian marketplace submission
- [ ] Launch marketing plan

## Technologies Used

### Frontend
- **React 18**: UI framework for Forge Custom UI
- **Forge Custom UI**: Atlassian's framework for building Jira apps
- **Electron**: Cross-platform desktop application framework

### Backend
- **Forge Resolver API**: Serverless functions for Jira integration
- **Express.js**: AI Analysis Server REST API
- **Supabase Edge Functions**: Webhooks for screenshot and document processing

### Database & Storage
- **Supabase (PostgreSQL)**: Main database with RLS
- **Supabase Storage**: File storage for screenshots and documents
- **electron-store**: Secure local settings and token storage

### AI & Machine Learning
- **Tesseract.js**: OCR for screenshot text extraction
- **OpenAI GPT-4**: BRD requirements parsing
- **Sharp**: Image processing and thumbnail generation

### Document Processing
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX text extraction

### Infrastructure & DevOps
- **Winston**: Logging framework
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: DDoS protection

## License

MIT

## Support

For issues and questions, please refer to the project documentation or contact the development team.
