# BRD Time Tracker - Desktop App

Cross-platform desktop application for automatic time tracking via screenshot capture. Integrates with Jira and Supabase to automatically log work time.

## Features

- **Automatic Screenshot Capture**: Captures screenshots at configurable intervals
- **Active Window Detection**: Identifies which application and window you're working in
- **Atlassian OAuth Integration**: Secure authentication with your Atlassian account
- **Supabase Integration**: Uploads screenshots and metadata to Supabase for AI analysis
- **System Tray Integration**: Runs in the background with easy access from system tray
- **Privacy Controls**: Pause tracking anytime, delete screenshots as needed

## Prerequisites

- Node.js 18.x or higher
- Supabase project configured (see `/supabase/SETUP.md`)
- Atlassian OAuth app configured

## Setup

### 1. Install Dependencies

```bash
cd desktop-app
npm install
```

### 2. Configure Atlassian OAuth App

1. Go to https://developer.atlassian.com/console/myapps/
2. Create a new app
3. Add OAuth 2.0 (3LO) authorization
4. Set redirect URL to: `brd-time-tracker://oauth/callback`
5. Enable these scopes:
   - `read:me`
   - `read:jira-work`
   - `write:jira-work`
   - `offline_access`
6. Copy the Client ID and Client Secret

### 3. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
ATLASSIAN_CLIENT_ID=your_client_id
ATLASSIAN_CLIENT_SECRET=your_client_secret
SUPABASE_AUTH_URL=https://your-project.supabase.co/functions/v1
```

### 4. Run the App

Development mode:
```bash
npm start
```

Or:
```bash
npm run dev
```

## Building for Distribution

### Windows
```bash
npm run build:win
```

Builds:
- NSIS installer (.exe)
- Output in `dist/` directory

### macOS
```bash
npm run build:mac
```

Builds:
- DMG installer
- Output in `dist/` directory

### Linux
```bash
npm run build:linux
```

Builds:
- AppImage
- Debian package (.deb)
- Output in `dist/` directory

## Project Structure

```
desktop-app/
├── src/
│   ├── main.js                 # Electron main process
│   ├── screenshot-capture.js   # Screenshot capture module
│   ├── auth-manager.js         # OAuth authentication
│   ├── supabase-client.js      # Supabase integration
│   └── renderer/
│       ├── index.html          # Main UI
│       ├── styles.css          # Styling
│       └── renderer.js         # UI logic
├── assets/
│   ├── icon.png               # App icon (Linux)
│   ├── icon.ico               # App icon (Windows)
│   └── icon.icns              # App icon (macOS)
├── package.json
├── .env.example
└── README.md
```

## How It Works

### 1. Authentication Flow

1. User clicks "Sign In with Atlassian"
2. Opens browser to Atlassian OAuth page
3. User authorizes the app
4. Browser redirects to `brd-time-tracker://oauth/callback?code=...`
5. App intercepts the custom protocol URL
6. Exchanges code for access token
7. Authenticates with Supabase using Atlassian account
8. Stores JWT tokens securely

### 2. Screenshot Capture Flow

1. User clicks "Start Tracking"
2. App captures screenshot at configured interval (default: 5 minutes)
3. Detects active window title and application name
4. Generates thumbnail version
5. Uploads full screenshot and thumbnail to Supabase Storage
6. Saves metadata to `screenshots` table
7. Supabase webhook triggers AI analysis (Phase 1.4)

### 3. Data Storage

All user data is stored securely:
- **OAuth tokens**: Encrypted in OS keychain via `electron-store`
- **Screenshots**: Uploaded to Supabase Storage (user-specific folders)
- **Metadata**: Stored in Supabase PostgreSQL with RLS enabled
- **Settings**: Stored locally in `electron-store`

## Configuration

### Screenshot Interval

Adjustable from 60 seconds to 3600 seconds (1 hour):
- Default: 300 seconds (5 minutes)
- Configured in Settings tab
- Can be changed while tracking (will restart capture)

### Supabase Settings

Must be configured before starting tracking:
- Supabase URL (from Supabase dashboard)
- Supabase Anon Key (safe to store client-side)

## System Tray

The app includes a system tray icon with these options:
- **Show App**: Open the main window
- **Start Tracking**: Begin screenshot capture
- **Pause Tracking**: Stop screenshot capture
- **Settings**: Open settings page
- **Quit**: Exit the application

## Privacy & Security

### What is Captured

- Screenshot of active monitor
- Window title of active window
- Application name
- Timestamp

### What is NOT Captured

- Keyboard input
- Mouse movements
- Audio
- Webcam
- Browser history
- File system access

### User Controls

- **Pause/Resume**: Stop tracking anytime
- **Delete Screenshots**: Remove individual screenshots from dashboard
- **Logout**: Revoke access and clear local tokens
- **Configurable Interval**: Adjust capture frequency

### Security Features

- OAuth 2.0 (3LO) for secure Atlassian authentication
- HTTPS-only connections to Supabase
- Row-Level Security in Supabase (users can only access their own data)
- Encrypted token storage using OS keychain
- Custom protocol handler prevents token exposure in browser

## Troubleshooting

### App won't start

- Check Node.js version: `node --version` (should be 18+)
- Delete `node_modules` and reinstall: `npm install`
- Check console for errors: Open DevTools in the app

### Authentication fails

- Verify Atlassian OAuth app settings
- Check redirect URI is exactly: `brd-time-tracker://oauth/callback`
- Ensure client ID and secret are correct in `.env`
- Check Supabase Auth endpoint is accessible

### Screenshots not uploading

- Verify Supabase URL and Anon Key in Settings
- Check network connectivity
- Verify Supabase Storage buckets are created (see `/supabase/SETUP.md`)
- Check Supabase Storage policies allow user uploads

### Permission errors (macOS/Linux)

macOS may require screen recording permission:
1. System Preferences > Security & Privacy > Privacy
2. Screen Recording > Add the app

Linux may require:
```bash
sudo chmod +x BRD-Time-Tracker.AppImage
```

## Development

### Adding Features

1. **Main Process** (`src/main.js`): Electron main process, handles system-level operations
2. **Renderer Process** (`src/renderer/`): UI and user interactions
3. **IPC Communication**: Use `ipcMain` (main) and `ipcRenderer` (renderer)

### Debugging

Enable DevTools:
```javascript
// In src/main.js
mainWindow.webContents.openDevTools();
```

### Testing OAuth Locally

For local development, you may need to:
1. Use ngrok or similar to tunnel OAuth callbacks
2. Or set up a local test OAuth app

## Dependencies

### Core
- **electron**: Cross-platform desktop framework
- **@supabase/supabase-js**: Supabase client
- **electron-store**: Persistent settings storage

### Screenshot Capture
- **screenshot-desktop**: Cross-platform screenshot capture
- **sharp**: Image processing (thumbnails)
- **active-win**: Active window detection

### Authentication
- **axios**: HTTP client for API calls

## Platform-Specific Notes

### Windows
- Requires Visual C++ Redistributable
- NSIS installer includes all dependencies
- May require admin rights for installation

### macOS
- Requires screen recording permission
- App must be signed for distribution
- DMG contains complete app bundle

### Linux
- AppImage is portable (no installation needed)
- .deb package for Debian/Ubuntu
- May need to mark as executable

## License

MIT

## Support

For issues and questions:
- Check the main project README
- Review Supabase setup guide
- Check Electron documentation

## Next Steps

Once the desktop app is running:
1. Complete Phase 1.4: AI Analysis Server
2. Implement screenshot analysis
3. Integrate Jira worklog creation
4. Add BRD document upload feature
