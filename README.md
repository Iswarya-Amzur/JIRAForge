# BRD Time Tracker Application

A comprehensive time tracking solution that integrates with Jira, automatically captures work activity through screenshots, and provides AI-powered analytics.

## Quick Start

**For new setup, please follow the complete setup guide:**

👉 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete step-by-step setup instructions

👉 **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Quick reference checklist

## Application Components

This application consists of 4 main components:

1. **Supabase** - Database and storage backend
2. **AI Server** - Node.js server for processing screenshots and BRD documents  
3. **Forge App** - Jira Forge application for displaying analytics in Jira
4. **Python Desktop App** - Desktop application for capturing screenshots

## Project Structure

```
jira1/
├── ai-server/              # AI Analysis Server (Node.js)
├── forge-app/              # Jira Forge Application
├── python-desktop-app/     # Desktop Screenshot Capture App
├── supabase/               # Database migrations and Edge Functions
├── docs/                   # Component-specific documentation
├── SETUP_GUIDE.md          # Complete setup guide ⭐
└── SETUP_CHECKLIST.md      # Setup checklist
```

## Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup instructions for all components
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Quick reference checklist
- **[docs/](./docs/)** - Component-specific documentation:
  - `ai-server_README.md` - AI Server details
  - `forge-app_SETUP_GUIDE.md` - Forge App setup
  - `desktop-app_README.md` - Desktop App details
  - `supabase_README.md` - Supabase setup

## Prerequisites

Before starting setup, ensure you have:

- Node.js 20.x or 22.x
- Python 3.8+
- Git
- Atlassian Developer Account
- Supabase Account
- OpenAI API Key

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed prerequisites and installation instructions.

## Getting Help

If you encounter issues during setup:

1. Check the [SETUP_GUIDE.md](./SETUP_GUIDE.md) troubleshooting section
2. Review component-specific documentation in `docs/`
3. Check logs:
   - AI Server: `ai-server/logs/`
   - Forge App: `forge logs`
   - Desktop App: Console output

## Support

For setup assistance, refer to:
- Complete setup guide: [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- Setup checklist: [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)

---

**Ready to set up?** Start with [SETUP_GUIDE.md](./SETUP_GUIDE.md) 📚

