# Desktop App Security & Packaging Guide

## 🔒 Security Architecture

### Problem
When packaging the desktop app as an .exe file, **sensitive credentials cannot be included** in the package. This violates security policies and exposes secrets.

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESKTOP APP (.exe)                           │
│  ✓ Public keys hardcoded (SUPABASE_ANON_KEY)                  │
│  ✓ User credentials in AppData (not in .exe)                   │
│  ✓ OAuth tokens in Windows Credential Manager                  │
│  ✗ NO sensitive keys (service role, secrets, API keys)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    OAuth Authentication Flow
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AI SERVER (Backend)                        │
│  ✓ SUPABASE_SERVICE_ROLE_KEY (admin access)                    │
│  ✓ ATLASSIAN_CLIENT_SECRET                                      │
│  ✓ LITELLM_API_KEYS                                             │
│  ✓ All sensitive credentials                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 What Goes Where

### ✅ Safe to Hardcode in Desktop App .exe

```python
# These are PUBLIC and safe to include:
SUPABASE_URL = "https://jvijitdewbypqbatfboi.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGc...xxx"  # Anon key (Row Level Security protects data)
ATLASSIAN_CLIENT_ID = "Q8HT4J...xxx"  # Public OAuth client ID
AI_SERVER_URL = "http://localhost:3001"  # Or production URL
```

**Why it's safe:**
- `SUPABASE_ANON_KEY` - Row Level Security (RLS) policies prevent unauthorized access
- `ATLASSIAN_CLIENT_ID` - Public identifier, requires OAuth flow
- `SUPABASE_URL` - Public endpoint

### ❌ NEVER Include in Desktop App

```python
# These MUST stay on AI Server only:
SUPABASE_SERVICE_ROLE_KEY = "eyJ..."  # ❌ NEVER in desktop app
ATLASSIAN_CLIENT_SECRET = "ATOA..."   # ❌ NEVER in desktop app
LITELLM_API_KEYS = "sk-..."           # ❌ NEVER in desktop app
AI_SERVER_API_KEY = "21d97..."        # ❌ NEVER in desktop app
```

**Why it's dangerous:**
- These keys bypass all security and give full admin access
- Desktop apps can be decompiled and reverse-engineered
- Users could extract keys and access your entire system

## 🔧 Implementation Steps

### Step 1: Update `.gitignore`

```gitignore
# Environment files (NEVER commit)
.env
.env.local
.env.*

# User configuration (created at runtime)
python-desktop-app/config.json
```

### Step 2: Create PyInstaller Spec File

```python
# desktop_app.spec
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['desktop_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        # Include necessary data files
        ('eng.traineddata', '.'),  # Tesseract data
        ('assets', 'assets'),       # App assets
    ],
    hiddenimports=[
        'paddleocr',
        'pytesseract',
        'win32gui',
        'psutil',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude .env files
        '.env',
        '.env.local',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# EXPLICITLY exclude .env patterns
a.datas = [x for x in a.datas if not x[0].endswith('.env')]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='JIRAForge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/icon.ico'  # Your app icon
)
```

### Step 3: Update `desktop_app.py` to Use Config Manager

```python
from config_manager import ConfigManager

class DesktopApp:
    def __init__(self):
        # Use config manager instead of .env
        self.config = ConfigManager()
        
        # Get public values (hardcoded in ConfigManager)
        self.supabase_url = self.config.get('supabase_url')
        self.supabase_key = self.config.get('supabase_anon_key')
        
        # Check if user is logged in
        if not self.config.is_configured():
            self.show_login_screen()
        else:
            user_info = self.config.get_user_info()
            self.user_id = user_info['user_id']
            self.organization_id = user_info['organization_id']
    
    def show_login_screen(self):
        """Show OAuth login screen on first run"""
        # Implement OAuth flow
        # After successful login, store credentials:
        # self.config.store_user_info(user_id, org_id, email)
        # self.config.store_oauth_tokens(access_token, refresh_token)
        pass
```

### Step 4: Build Process

```bash
# Install dependencies
pip install pyinstaller keyring

# Build the executable
pyinstaller desktop_app.spec

# Verify .env is NOT included
# Check dist/JIRAForge/ folder - should have NO .env files

# Test the executable
dist/JIRAForge/JIRAForge.exe
```

### Step 5: First Run Experience

```python
def first_run_setup():
    """What happens when user runs .exe for first time"""
    
    config = ConfigManager()
    
    if not config.is_configured():
        # 1. Show welcome screen
        show_welcome_dialog()
        
        # 2. OAuth login (redirects to Atlassian)
        oauth_result = perform_oauth_login()
        
        # 3. Exchange code for tokens (via AI server)
        # Desktop app sends auth code to AI server
        # AI server uses CLIENT_SECRET (which desktop doesn't have)
        # AI server returns user info
        response = requests.post(
            'http://localhost:3001/auth/exchange-token',
            json={'code': oauth_result.code}
        )
        
        user_info = response.json()
        
        # 4. Store user info locally
        config.store_user_info(
            user_id=user_info['user_id'],
            organization_id=user_info['organization_id'],
            email=user_info['email']
        )
        
        # 5. Store OAuth tokens securely
        config.store_oauth_tokens(
            access_token=user_info['access_token'],
            refresh_token=user_info['refresh_token']
        )
        
        # 6. App is now configured!
        return True
    
    return False
```

## 📦 Build Checklist

Before distributing the .exe:

- [ ] `.env` file is in `.gitignore`
- [ ] PyInstaller spec explicitly excludes `.env`
- [ ] Public keys are hardcoded in `config_manager.py`
- [ ] Sensitive keys are ONLY on AI server
- [ ] User config stored in AppData (not in .exe)
- [ ] OAuth tokens use Windows Credential Manager
- [ ] Test: Extract .exe → verify NO .env files inside
- [ ] Test: First run prompts for OAuth login
- [ ] Test: Subsequent runs use stored credentials

## 🔐 Security Benefits

1. **Desktop app is stateless** - No sensitive data in the binary
2. **User-specific storage** - Each user's data is isolated
3. **OS-level encryption** - Windows Credential Manager encrypts tokens
4. **Revocable access** - OAuth tokens can be revoked server-side
5. **AI server controls secrets** - Only backend has admin keys

## 🚀 Distribution

### For Users

1. Download `JIRAForge.exe`
2. Run → First-time setup (OAuth login)
3. Credentials stored in `%LOCALAPPDATA%\JIRAForge\`
4. App ready to use!

### For Developers

```bash
# Development with .env
python desktop_app.py  # Uses .env if present

# Production build
pyinstaller desktop_app.spec  # Excludes .env
```

## 📊 Data Flow

```
User Runs .exe
    ↓
Check if configured (AppData/config.json exists?)
    ↓
NO → Show OAuth login → AI Server validates → Store user info
    ↓
YES → Load user_id/org_id from AppData
    ↓
Track activities locally (SQLite)
    ↓
Every 5 mins: Upload to Supabase (using anon key + user_id)
    ↓
Supabase RLS policies validate: user_id matches authenticated user
```

## 🛡️ Additional Security Measures

### 1. Code Obfuscation (Optional)

```bash
pip install pyarmor
pyarmor obfuscate desktop_app.py
pyinstaller desktop_app_obfuscated.spec
```

### 2. Code Signing

```bash
# Sign the .exe with your certificate
signtool sign /f certificate.pfx /p password /t http://timestamp.server dist/JIRAForge.exe
```

### 3. Supabase RLS Policies

Ensure Row Level Security is enforced:

```sql
-- Users can only access their own records
CREATE POLICY "Users can view own records"
ON activity_records
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own records"
ON activity_records
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

## ❓ FAQ

**Q: What if user's computer is compromised?**
A: OAuth tokens can be revoked. User must re-authenticate.

**Q: Can SUPABASE_ANON_KEY be extracted from .exe?**
A: Yes, but it's protected by RLS policies. Without valid auth, it's useless.

**Q: How do we update configuration remotely?**
A: Desktop app can fetch config from AI server on startup.

**Q: What about offline usage?**
A: Desktop app caches data in SQLite. Syncs when online.

## ✅ Summary

| Component | Location | Security Level |
|-----------|----------|----------------|
| Desktop App (.exe) | User's machine | Public keys only |
| User Config | %LOCALAPPDATA%\JIRAForge\ | User-specific |
| OAuth Tokens | Windows Credential Manager | OS-encrypted |
| AI Server | Production server | All sensitive keys |
| Database | Supabase | RLS policies enforced |

**Result:** Zero sensitive credentials in distributed .exe!
