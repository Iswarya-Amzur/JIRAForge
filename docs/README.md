# BRD Time Tracker - Forge Application

Atlassian Forge application that integrates with Jira to provide time tracking analytics and BRD automation features.

## Features

- **Time Analytics Dashboard**: View daily/weekly time summaries, time by project, and time by issue
- **Screenshot Gallery**: Review and manage captured screenshots
- **BRD Upload**: Upload Business Requirements Documents for automatic Jira issue creation
- **Admin Settings**: Configure Supabase connection, time tracking, and AI server settings

## Project Structure

```
forge-app/
├── manifest.yml              # Forge app configuration
├── package.json              # Dependencies and scripts
├── src/
│   └── index.js             # Resolver functions (backend API)
├── static/
│   ├── main/                # Main dashboard UI
│   │   ├── src/
│   │   │   ├── App.js       # React component
│   │   │   ├── App.css      # Styles
│   │   │   └── index.js     # Entry point
│   │   ├── public/
│   │   │   └── index.html
│   │   └── package.json
│   └── settings/            # Settings page UI
│       ├── src/
│       │   ├── App.js
│       │   ├── App.css
│       │   └── index.js
│       ├── public/
│       │   └── index.html
│       └── package.json
└── README.md                # This file
```

## Prerequisites

- Node.js 20.x or 22.x (Forge recommended versions)
- Forge CLI: `npm install -g @forge/cli`
- Atlassian account with developer access
- Supabase project configured (see `/supabase/SETUP.md`)

## Setup

### 1. Install Dependencies

```bash
cd forge-app

# Install root dependencies
npm install

# Install UI dependencies
cd static/main && npm install && cd ../..
cd static/settings && npm install && cd ../..
```

### 2. Build UI Components

```bash
npm run build
```

This builds both the main dashboard and settings UI.

### 3. Register with Forge

```bash
forge register
```

This creates a new Forge app and updates the `app.id` in `manifest.yml`.

### 4. Deploy to Development

```bash
forge deploy
```

### 5. Install on Jira Site

```bash
forge install
```

Follow the prompts to select your Jira site.

## Development

### Local Development with Tunnel

```bash
forge tunnel
```

This allows you to test changes without deploying each time.

### View Logs

```bash
forge logs
```

### Build UI Only

```bash
npm run build:main      # Build main dashboard only
npm run build:settings  # Build settings page only
```

### Deploy Changes

```bash
forge deploy
```

## Manifest Configuration

### Modules

The app provides three Jira modules:

1. **Project Page** (`jira:projectPage`)
   - Key: `brd-time-tracker-project-page`
   - Displays the main dashboard on project pages

2. **Issue Panel** (`jira:issuePanel`)
   - Key: `brd-time-tracker-issue-panel`
   - Shows time analytics on individual issue pages

3. **Admin Page** (`jira:adminPage`)
   - Key: `brd-time-tracker-settings`
   - Configuration page accessible from Jira settings

### Permissions

Required scopes:
- `read:me` - Get current user information
- `read:jira-work` - Read Jira issues and worklogs
- `write:jira-work` - Create worklogs and issues
- `read:jira-user` - Read user data
- `write:jira-user` - Assign issues to users

External fetch permissions:
- `*.supabase.co` - Communicate with Supabase backend

## Resolver Functions

Backend API endpoints (`src/index.js`):

### Time Analytics
- `getTimeAnalytics` - Fetch user's time tracking data from Supabase
- `getScreenshots` - Retrieve screenshot gallery for the user

### Screenshot Management
- `deleteScreenshot` - Remove a screenshot from storage

### BRD Processing
- `uploadBRD` - Handle BRD document upload to Supabase
- `createIssuesFromBRD` - Process BRD and create Jira issues

### Worklog Management
- `createWorklog` - Create worklog entries in Jira
- `getSettings` - Get user/admin settings
- `saveSettings` - Save configuration settings

## UI Components

### Main Dashboard (`static/main`)

Three main tabs:

1. **Time Analytics**
   - Daily/weekly time summaries
   - Time breakdown by project and issue
   - Visual charts and statistics

2. **Screenshot Gallery**
   - Grid view of captured screenshots
   - Thumbnail previews
   - Delete functionality
   - Timestamp and window title display

3. **BRD Upload**
   - File upload for PDF/DOCX documents
   - Processing status display
   - Created issues list with links

### Settings Page (`static/settings`)

Configuration options:

1. **Supabase Configuration**
   - Supabase URL
   - Supabase Anon Key

2. **Time Tracking Settings**
   - Screenshot interval (60-3600 seconds)
   - Auto-create worklogs toggle

3. **AI Server Configuration**
   - AI server URL

4. **Account Information**
   - User info display
   - Logout functionality

5. **Desktop App Instructions**
   - Installation guide
   - Setup steps

## Integration with Other Components

### Supabase Backend

The Forge app communicates with Supabase to:
- Fetch time analytics from views (`daily_time_summary`, etc.)
- Retrieve screenshots from storage
- Upload BRD documents
- Read processed BRD results

**Setup Required:**
1. Configure Supabase URL and keys in Settings
2. The service role key should be stored securely (not in client-side code)

### Desktop App

The desktop app captures screenshots and uploads them to Supabase. The Forge app then displays:
- Screenshots in the gallery
- Time analytics derived from screenshot analysis

### AI Server

The AI server processes:
- Screenshots for OCR and task correlation
- BRD documents for requirements extraction

Results are stored in Supabase and displayed in the Forge app.

## Data Flow

### Viewing Time Analytics

1. User opens project page in Jira
2. Forge app loads main dashboard UI
3. UI calls `getTimeAnalytics` resolver
4. Resolver fetches data from Supabase using service role key
5. Data filtered by user's RLS policies
6. Results displayed in dashboard

### Deleting a Screenshot

1. User clicks delete on a screenshot
2. UI calls `deleteScreenshot` resolver with screenshot ID
3. Resolver updates Supabase (marks as deleted)
4. UI refreshes screenshot gallery

### Uploading a BRD

1. User selects PDF/DOCX file
2. File converted to base64
3. UI calls `uploadBRD` resolver
4. Resolver uploads to Supabase Storage
5. Supabase webhook triggers AI server
6. AI server processes and creates issues
7. UI displays success and issue links

## Troubleshooting

### Deployment Issues

**Error: "Manifest validation failed"**
- Check `manifest.yml` syntax
- Ensure all required fields are present
- Verify module keys are unique

**Error: "Build failed"**
- Run `npm run build` locally to check for errors
- Check that all UI dependencies are installed
- Verify React components have no syntax errors

### UI Not Loading

**Blank page or "Cannot find module"**
- Ensure UI was built: `npm run build`
- Check browser console for errors
- Verify paths in `manifest.yml` match build output

**Resolver errors**
- Check Forge logs: `forge logs`
- Verify Supabase credentials are correct
- Test Supabase connection manually

### Permission Errors

**Cannot read/write Jira data**
- Verify scopes in `manifest.yml`
- Redeploy after manifest changes: `forge deploy`
- Check user has permissions in Jira

**Cannot fetch external resources**
- Add domain to `external.fetch.backend` in manifest
- Redeploy after changes

## Security Considerations

### Credentials Storage

**DO NOT** store sensitive keys in:
- Client-side code (React components)
- Manifest file
- Git repository

**DO** store sensitive keys in:
- Forge environment variables (for resolvers)
- Forge storage API (encrypted)
- User-entered settings (Supabase anon key only)

### Service Role Key

The Supabase service role key should:
- Only be used in resolver functions (backend)
- Never be exposed to the client
- Be stored in Forge environment variables

### User Data

All user data must:
- Be filtered by RLS policies in Supabase
- Only show data for the authenticated user
- Respect Jira permissions

## Performance Optimization

### Caching

Consider caching:
- Time analytics data (refresh every 5 minutes)
- Screenshot thumbnails
- User settings

### Lazy Loading

- Load screenshots on-demand (pagination)
- Defer loading of large analytics datasets
- Use React.lazy for code splitting

### API Optimization

- Batch Supabase queries where possible
- Use Supabase views for complex aggregations
- Limit screenshot gallery to recent items

## Testing

### Local Testing

```bash
# Start tunnel for local development
forge tunnel

# In another terminal, watch UI changes
cd static/main && npm start
```

### Manual Testing Checklist

- [ ] Dashboard loads successfully
- [ ] Time analytics display (with test data)
- [ ] Screenshot gallery loads
- [ ] Screenshot deletion works
- [ ] BRD upload accepts PDF/DOCX
- [ ] Settings save successfully
- [ ] Worklog creation (when implemented)

## Deployment Checklist

Before deploying to production:

1. [ ] All UI components built: `npm run build`
2. [ ] Manifest validated
3. [ ] Resolver functions tested
4. [ ] Supabase connection configured
5. [ ] Error handling in place
6. [ ] Logs reviewed: `forge logs`
7. [ ] Security review completed
8. [ ] Documentation updated

## Commands Reference

```bash
# Development
forge tunnel              # Local development with hot reload
forge logs               # View application logs
forge lint               # Check for issues

# Build
npm run build            # Build all UI components
npm run build:main       # Build main dashboard only
npm run build:settings   # Build settings page only

# Deployment
forge deploy             # Deploy to Forge
forge deploy --no-verify # Deploy without verification (faster)

# Installation
forge install            # Install on a Jira site
forge install --upgrade  # Upgrade existing installation

# Other
forge settings set       # Set environment variables
forge whoami            # Check logged-in account
forge uninstall         # Remove from Jira site
```

## Resources

- [Forge Documentation](https://developer.atlassian.com/platform/forge/)
- [Forge Custom UI](https://developer.atlassian.com/platform/forge/custom-ui/)
- [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Forge Resolver](https://developer.atlassian.com/platform/forge/runtime-reference/resolver/)

## Support

For issues:
1. Check Forge logs: `forge logs`
2. Review browser console
3. Check Supabase dashboard for errors
4. Verify Jira permissions

## License

MIT

## Next Steps

After setting up the Forge app:
1. Configure Supabase in Settings
2. Install and run Desktop App
3. Deploy AI Server
4. Test end-to-end screenshot flow
5. Test BRD upload and processing
