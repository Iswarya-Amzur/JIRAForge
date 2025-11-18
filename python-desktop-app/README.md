# BRD Time Tracker - Python Desktop App

Python desktop application for automatic time tracking via screenshot capture with Atlassian OAuth integration.

## Features

- **Atlassian OAuth Authentication**: Secure login with your Atlassian account
- **Automatic Screenshot Capture**: Captures screenshots at configurable intervals
- **Supabase Integration**: Uploads screenshots and metadata to Supabase
- **System Tray Integration**: Runs in background with system tray icon
- **Web Dashboard**: View tracking status and recent screenshots

## Prerequisites

- Python 3.8 or higher
- Windows (for system tray and window detection)
- Supabase project configured
- Atlassian OAuth app configured

## Setup

### 1. Install Dependencies

```bash
cd python-desktop-app
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `ATLASSIAN_CLIENT_ID` - From Atlassian Developer Console
- `ATLASSIAN_CLIENT_SECRET` - From Atlassian Developer Console
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for user creation)

### 3. Configure Atlassian OAuth

1. Go to https://developer.atlassian.com/console/myapps/
2. Create a new OAuth 2.0 (3LO) app
3. Set Authorization callback URL to: `http://localhost:7777/auth/callback`
   - **Note**: The Python app uses HTTP localhost callback (not a custom protocol like the Electron app)
4. Enable scopes: `read:me`, `read:jira-work`, `write:jira-work`, `offline_access`
5. Copy Client ID and Client Secret to `.env`

## Running the Application

### Development Mode

```bash
python desktop_app.py
```

The app will:
1. Start a Flask web server on `http://localhost:7777`
2. Open browser for authentication (if not already authenticated)
3. Start capturing screenshots automatically after login
4. Show system tray icon

### Building Executable

Build a standalone `.exe` file using PyInstaller:

```bash
pyinstaller desktop_app.spec
```

The executable will be in `dist/BRDTimeTracker.exe`

## How It Works

1. **Authentication**: User clicks "Sign in with Atlassian" → OAuth flow → User authenticated
2. **User Creation**: App creates/updates user in Supabase `users` table with `atlassian_account_id`
3. **Screenshot Capture**: App captures screenshots at configured interval (default: 5 minutes)
4. **Upload**: Screenshots are uploaded to Supabase Storage and metadata saved to `screenshots` table
5. **AI Analysis**: Supabase webhook triggers AI server to analyze screenshots (see `ai-server/`)

## Configuration

- `CAPTURE_INTERVAL`: Screenshot capture interval in seconds (default: 300 = 5 minutes)
- `WEB_PORT`: Flask web server port (default: 7777)
- `USE_AI_FOR_SCREENSHOTS`: Enable OpenAI for enhanced screenshot analysis (default: false)

## Troubleshooting

### OAuth Redirect Not Working

- Check that callback URL in Atlassian Console matches: `http://localhost:7777/auth/callback`
- Ensure the Flask web server is running before clicking "Sign in with Atlassian"
- Check that port 7777 is not already in use by another application

### Screenshots Not Uploading

- Check Supabase credentials in `.env`
- Verify user exists in `users` table
- Check Supabase Storage bucket `screenshots` exists and has proper permissions
- Check console output for error messages

### System Tray Not Showing

- Ensure `pystray` is installed: `pip install pystray`
- On Windows, may need to run as administrator for first-time setup

## Project Structure

```
python-desktop-app/
├── desktop_app.py          # Main application file
├── requirements.txt        # Python dependencies
├── desktop_app.spec        # PyInstaller configuration
├── .env.example           # Environment variables template
├── .env                    # Your environment variables (not in git)
└── README.md              # This file
```

## License

See main project README for license information.

