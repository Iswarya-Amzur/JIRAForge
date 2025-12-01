# Technical Stack Overview

## Desktop Application

**Language & Runtime:**
- Python 3.x

**Core Frameworks & Libraries:**
- **Flask** (v3.0.0) - Web framework for OAuth callback server
- **Flask-CORS** (v4.0.0) - Cross-origin resource sharing
- **Pillow/PIL** (v10.1.0) - Image processing and screenshot capture
- **pystray** (v0.19.5) - System tray integration
- **psutil** (v5.9.6) - Process and system monitoring
- **pywin32** (v306) - Windows-specific APIs (window detection, system calls)
- **pynput** (v1.7.6) - Input monitoring (keyboard/mouse)
- **Supabase** (v2.0.0) - Python client for database and storage
- **requests** (v2.31.0) - HTTP client for API calls
- **python-dotenv** (v1.0.0) - Environment variable management
- **cryptography** (v41.0.7) - Encryption and security
- **PyInstaller** (v6.2.0) - Application packaging and distribution

**Key Features:**
- Automatic screenshot capture at configurable intervals
- System tray integration with start/stop controls
- Windows window title and application detection
- OAuth 3LO authentication with Atlassian
- Screenshot upload to Supabase Storage
- Metadata extraction (window title, application name, timestamp)

---

## Backend / AI Server

**Language & Runtime:**
- Node.js 20.x

**Core Frameworks & Libraries:**
- **Express.js** (v4.18.2) - Web framework and HTTP server
- **Winston** (v3.11.0) - Logging framework
- **Helmet** (v7.1.0) - Security headers middleware
- **express-rate-limit** (v7.1.0) - Rate limiting and DDoS protection
- **CORS** (v2.8.5) - Cross-origin resource sharing
- **dotenv** (v16.3.1) - Environment variable management
- **axios** (v1.6.0) - HTTP client for external API calls

**Database & Storage:**
- **@supabase/supabase-js** (v2.39.0) - Supabase JavaScript client

**Image Processing & OCR:**
- **Sharp** (v0.33.0) - High-performance image processing (resize, normalize, grayscale)
- **Tesseract.js** (v5.0.3) - OCR engine for text extraction from images

**Document Processing:**
- **pdf-parse** (v1.1.1) - PDF text extraction
- **mammoth** (v1.6.0) - DOCX text extraction

**Key Features:**
- Screenshot analysis via webhook from Supabase Edge Functions
- BRD document processing and requirement extraction
- Polling service for missed screenshots
- Clustering service for unassigned work grouping
- Image preprocessing and optimization
- OCR fallback when AI analysis fails

---

## Forge Application (Jira Integration)

**Language & Runtime:**
- Node.js 20.x
- Atlassian Forge Platform

**Core Frameworks & Libraries:**
- **@forge/api** (v3.0.0) - Forge API client for Jira integration
- **@forge/resolver** (v1.5.0) - Forge resolver framework for backend functions
- **@forge/cli** (v12.0.0) - Forge CLI for development and deployment

**Frontend:**
- **React** (v18.2.0) - UI framework
- **React DOM** (v18.2.0) - React rendering
- **@forge/react** (v7.0.0) - Forge React integration
- **@forge/bridge** (v3.0.0) - Forge bridge for frontend-backend communication
- **react-scripts** (v5.0.1) - Create React App build tools

**Key Features:**
- Jira issue management and worklog creation
- Time tracking analytics and dashboards
- Unassigned work clustering and assignment
- BRD document upload and processing
- User authentication via Atlassian OAuth
- Real-time data synchronization with Supabase

---

## Database

**Platform:**
- **Supabase** (PostgreSQL-based Backend-as-a-Service)

**Database Engine:**
- **PostgreSQL** (via Supabase)
- **PostgREST** - REST API layer for PostgreSQL

**Storage:**
- **Supabase Storage** - Object storage for screenshots and documents

**Key Features:**
- RESTful API via PostgREST
- Real-time subscriptions
- Row-level security (RLS)
- Automatic backups
- Database views for analytics (daily, weekly, monthly summaries)
- Triggers for automatic data processing
- Edge Functions for webhook handling

**Database Schema Highlights:**
- `users` - User accounts and Atlassian integration
- `screenshots` - Screenshot metadata and storage references
- `analysis_results` - AI analysis results and time tracking
- `unassigned_activity` - Unassigned work sessions
- `unassigned_work_groups` - AI-clustered work groups
- `documents` - BRD documents and processing status
- `worklogs` - Jira worklog entries
- `created_issues_log` - Audit log of created Jira issues

---

## LLM Tools & AI Frameworks

**Primary AI Service:**
- **OpenAI GPT-4 Vision** (via `openai` v4.20.0)
  - Direct image analysis (primary method)
  - Faster processing (1-2 seconds)
  - Better context understanding
  - Visual UI and code recognition

**Fallback AI Service:**
- **OpenAI GPT-4** (Text model)
  - Used when Vision API fails
  - Analyzes OCR-extracted text
  - Requirements parsing for BRD documents

**OCR Engine:**
- **Tesseract.js** (v5.0.3)
  - Text extraction from screenshots
  - Fallback when Vision API unavailable
  - Pattern matching for Jira issue keys

**Image Processing:**
- **Sharp** (v0.33.0)
  - Image preprocessing (grayscale, normalization)
  - Format conversion
  - Optimization for OCR

**AI Use Cases:**
1. **Screenshot Analysis:**
   - Detect active Jira issue keys
   - Classify work type (office/non-office)
   - Determine work context and confidence
   - Identify idle vs. active work

2. **BRD Document Processing:**
   - Extract requirements from PDF/DOCX
   - Structure into Epics, Stories, Tasks
   - Generate Jira issue hierarchies
   - Parse technical specifications

3. **Work Clustering:**
   - Group similar unassigned work sessions
   - Suggest issue assignments
   - Generate work summaries
   - Confidence scoring

---

## Additional Tools & Services

**Development Tools:**
- **Nodemon** (v3.0.2) - Auto-restart for Node.js development
- **Jest** (v29.7.0) - Testing framework

**Infrastructure:**
- **Supabase Edge Functions** (Deno runtime) - Serverless functions for webhooks
- **Atlassian OAuth 3LO** - Authentication and authorization
- **Jira REST API v3** - Issue management and worklog creation

**Deployment:**
- **Forge CLI** - Atlassian Forge app deployment
- **PyInstaller** - Desktop app packaging for Windows
- **npm** - Node.js package management
- **pip** - Python package management

---

## Architecture Overview

```
┌─────────────────┐
│  Desktop App    │  Python + Flask
│  (Screenshot    │  → Captures screenshots
│   Capture)      │  → Uploads to Supabase
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │  PostgreSQL + Storage
│  (Database &    │  → Stores screenshots
│   Storage)      │  → Triggers webhook
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Server      │  Node.js + Express
│  (Analysis)     │  → Downloads screenshot
│                 │  → GPT-4 Vision analysis
│                 │  → OCR fallback (Tesseract)
│                 │  → Saves results to DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Forge App      │  Node.js + React
│  (Jira UI)      │  → Displays analytics
│                 │  → Creates worklogs
│                 │  → Manages issues
└─────────────────┘
```

---

## Version Information

**Last Updated:** November 2025

**Key Versions:**
- Python: 3.x
- Node.js: 20.x
- React: 18.2.0
- Express: 4.18.2
- OpenAI API: 4.20.0
- Supabase JS: 2.39.0
- Forge CLI: 12.0.0+


