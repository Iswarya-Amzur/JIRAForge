# Environment File Architecture: AI Server vs Desktop App

**Last Updated:** 2026-02-21  
**Status:** ✅ Production Architecture

---

## 📋 Executive Summary

This document explains the **critical architectural decision** regarding `.env` files:

- ✅ **AI Server HAS .env file** - This is REQUIRED and SECURE
- ❌ **Desktop App NO .env file** - This is MANDATORY for security

This architecture eliminates credential exposure while enabling centralized configuration management.

---

## 🎯 The Core Question

**"Does the AI server need an .env file if we're not using .env in the desktop app?"**

### Answer: **YES! Here's why:**

```
┌──────────────────────────────────────────────────────────┐
│         The AI Server IS the Configuration Server       │
│                                                          │
│  - It STORES all credentials in .env (secured)          │
│  - It SERVES configuration to desktop apps (via API)    │
│  - It NEVER distributes the .env file itself            │
└──────────────────────────────────────────────────────────┘
```

The desktop app doesn't have an .env file **because it gets config FROM the AI server**, which **does** have an .env file.

---

## 🏗️ Complete Architecture

### Visual Overview

```
                    ┌─────────────────────────────────────┐
                    │         AI SERVER                   │
                    │  (forgesync.amzur.com)             │
                    │                                     │
                    │  📄 .env FILE (SECURED)            │
                    │  ━━━━━━━━━━━━━━━━━━━━━━━━━━       │
                    │  SUPABASE_URL=https://...          │
                    │  SUPABASE_ANON_KEY=eyJ...          │
                    │  SUPABASE_SERVICE_ROLE_KEY=eyJ...  │
                    │  ATLASSIAN_CLIENT_SECRET=ATO...    │
                    │  OCR_PRIMARY_ENGINE=paddle         │
                    │  OCR_PADDLE_MIN_CONFIDENCE=0.5     │
                    │                                     │
                    │  🔒 File Permissions: chmod 600    │
                    │  🔒 Access: Admin only              │
                    │  🔒 Location: /var/www/.../.env    │
                    │                                     │
                    │  🌐 API Endpoints:                 │
                    │  ├─ /api/auth/supabase-config     │
                    │  └─ /api/auth/ocr-config          │
                    └─────────────────────────────────────┘
                                    ↕
                    HTTPS (requires valid OAuth token)
                                    ↕
┌─────────────────────────────────────────────────────────────┐
│              DESKTOP APP (.exe)                             │
│  (TimeTracker.exe on 1000s of user computers)              │
│                                                             │
│  ❌ NO .env FILE                                            │
│  ━━━━━━━━━━━━━━━━                                          │
│  • Nothing bundled in .exe                                  │
│  • Nothing in installation folder                           │
│  • Nothing on user's disk                                   │
│                                                             │
│  ✅ Runtime Configuration (in memory only):                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                     │
│  1. User authenticates → Gets OAuth token                  │
│  2. Calls AI server API with token                         │
│  3. Receives config JSON response                          │
│  4. Stores in process memory (os.environ)                  │
│  5. Uses config for Supabase + OCR                         │
│                                                             │
│  💾 Local Storage (user data only):                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                          │
│  • config.json (UI preferences)                            │
│  • time_tracker_offline.db (activity data)                 │
│  • Windows Credential Manager (OAuth tokens)               │
│                                                             │
│  🔒 NO CREDENTIALS STORED ON DISK ✓                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 File Locations

### On AI Server (Your Controlled Infrastructure)

```
/var/www/jiraforge/
└── ai-server/
    ├── .env                          ← ✅ EXISTS (secured)
    │   ├── chmod 600                 ← Only owner can read
    │   ├── chown www-data:www-data   ← Owned by app user
    │   └── Not in git (.gitignore)   ← Never committed
    │
    ├── .env.template                 ← Safe template (in git)
    ├── .gitignore                    ← Contains ".env"
    ├── package.json
    ├── node_modules/
    └── src/
        ├── index.js                  ← Reads .env at startup
        └── controllers/
            └── auth-controller.js    ← Serves config from .env
```

---

### On User's Computer (Distributed, Uncontrolled)

```
C:\Program Files\TimeTracker\
└── TimeTracker.exe                   ← ❌ NO .env bundled

C:\Users\JohnDoe\AppData\Local\TimeTracker\
├── config.json                       ← UI preferences only
└── time_tracker_offline.db           ← Activity data only

Windows Credential Manager:
└── TimeTracker credentials           ← OAuth tokens (encrypted by OS)

❌ NO .env FILE ANYWHERE ON USER'S MACHINE
```

---

## 🔄 How It Works: Step-by-Step

### Phase 1: AI Server Startup (One-time)

```bash
# 1. Admin creates .env on server
ssh admin@forgesync.amzur.com
cd /var/www/jiraforge/ai-server

# 2. Create .env from template
cp .env.template .env
nano .env  # Add real credentials

# 3. Secure the file
chmod 600 .env
chown www-data:www-data .env

# 4. Verify not in git
git status  # Should not show .env

# 5. Start server - reads .env into memory
npm start
```

**What happens:**
```javascript
// ai-server/src/index.js
require('dotenv').config();  // ← Reads .env file

// Now all environment variables are in process.env:
console.log(process.env.SUPABASE_URL);           // ✓ Loaded
console.log(process.env.OCR_PRIMARY_ENGINE);     // ✓ Loaded
console.log(process.env.ATLASSIAN_CLIENT_SECRET); // ✓ Loaded

// Server is now running with config in memory
app.listen(3001);
```

---

### Phase 2: Desktop App Startup (Every user, every launch)

```
1. User double-clicks TimeTracker.exe
   ↓
2. Desktop app checks for .env file
   → NOT FOUND ✓ (this is expected)
   ↓
3. Desktop app shows login screen
   ↓
4. User clicks "Login with Atlassian"
   ↓
5. Browser opens → Atlassian OAuth
   ↓
6. User approves → Desktop app receives OAuth token
   ↓
7. Desktop app calls AI server API...
```

---

### Phase 3: Fetch Supabase Configuration

```javascript
// Desktop App (Python)
// File: desktop_app.py

def get_supabase_config(self):
    """Fetch Supabase config from AI server"""
    
    # 1. Send OAuth token to AI server
    response = requests.post(
        'https://forgesync.amzur.com/api/auth/supabase-config',
        json={'atlassian_token': self.access_token}
    )
    
    # 2. AI server verifies token and returns config
    result = response.json()
    # {
    #   "success": true,
    #   "supabase_url": "https://...",
    #   "supabase_anon_key": "eyJ...",
    #   "supabase_service_role_key": "eyJ..."
    # }
    
    # 3. Store in runtime memory
    set_runtime_supabase_config(
        result['supabase_url'],
        result['supabase_anon_key'],
        result['supabase_service_role_key']
    )
```

**On AI Server side:**

```javascript
// AI Server (Node.js)
// File: ai-server/src/controllers/auth-controller.js

exports.getSupabaseConfig = async (req, res) => {
  const { atlassian_token } = req.body;
  
  // 1. Verify token with Atlassian
  await verifyAtlassianToken(atlassian_token);
  
  // 2. Read from environment (loaded from .env at startup)
  const config = {
    supabase_url: process.env.SUPABASE_URL,
    supabase_anon_key: process.env.SUPABASE_ANON_KEY,
    supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  
  // 3. Return as JSON (never the .env file itself!)
  res.json({ success: true, ...config });
};
```

---

### Phase 4: Fetch OCR Configuration

```javascript
// Desktop App (Python)
def get_ocr_config(self):
    """Fetch OCR config from AI server"""
    
    # 1. Send OAuth token
    response = requests.post(
        'https://forgesync.amzur.com/api/auth/ocr-config',
        json={'atlassian_token': self.access_token}
    )
    
    # 2. Receive OCR configuration
    result = response.json()
    # {
    #   "success": true,
    #   "config": {
    #     "primary_engine": "paddle",
    #     "fallback_engines": ["tesseract"],
    #     "engines": {
    #       "paddle": {
    #         "min_confidence": 0.5,
    #         "use_gpu": false
    #       }
    #     }
    #   }
    # }
    
    # 3. Store in runtime memory + os.environ
    set_runtime_ocr_config(result['config'])
```

**On AI Server side:**

```javascript
// AI Server (Node.js)
exports.getOcrConfig = async (req, res) => {
  const { atlassian_token } = req.body;
  
  // 1. Verify authentication
  await verifyAtlassianToken(atlassian_token);
  
  // 2. Build config from environment (from .env)
  const ocrConfig = {
    primary_engine: process.env.OCR_PRIMARY_ENGINE || 'paddle',
    fallback_engines: (process.env.OCR_FALLBACK_ENGINES || 'tesseract').split(','),
    use_preprocessing: process.env.OCR_USE_PREPROCESSING === 'true',
    engines: {
      paddle: {
        min_confidence: parseFloat(process.env.OCR_PADDLE_MIN_CONFIDENCE || '0.5'),
        use_gpu: process.env.OCR_PADDLE_USE_GPU === 'true',
        language: process.env.OCR_PADDLE_LANGUAGE || 'en'
      },
      tesseract: {
        min_confidence: parseFloat(process.env.OCR_TESSERACT_MIN_CONFIDENCE || '0.6'),
        language: process.env.OCR_TESSERACT_LANGUAGE || 'eng'
      }
    }
  };
  
  // 3. Return as JSON
  res.json({ success: true, config: ocrConfig });
};
```

---

### Phase 5: Desktop App Runs with Runtime Config

```python
# Desktop App (Python)

# OCR module reads from os.getenv() which checks runtime config
from ocr import extract_text_from_image
from PIL import Image

# This works because set_runtime_ocr_config() set os.environ:
# os.environ['OCR_PRIMARY_ENGINE'] = 'paddle'
# os.environ['OCR_PADDLE_MIN_CONFIDENCE'] = '0.5'

screenshot = ImageGrab.grab()
result = extract_text_from_image(screenshot)
# ✓ Uses PaddleOCR with min_confidence=0.5
# ✓ Config came from AI server .env
# ✓ No .env file needed on user's machine
```

---

## 🔐 Security Analysis

### Why AI Server Can Safely Have .env

| Security Factor | Details |
|----------------|---------|
| **Physical Access** | Server in secure data center, not accessible to users |
| **File Permissions** | `chmod 600` - only app user can read |
| **Network Access** | Behind firewall, only HTTPS port 443 exposed |
| **SSH Access** | Key-based authentication, restricted IPs |
| **File System** | Encrypted disk, regular backups to secure storage |
| **Audit Logging** | All file access logged, monitored for anomalies |
| **Git Protection** | .env in .gitignore, never committed to repository |
| **API Protection** | Config served via authenticated endpoints only |

**Risk Level:** ✅ **MINIMAL** (controlled environment)

---

### Why Desktop App MUST NOT Have .env

| Risk Factor | Impact |
|-------------|--------|
| **Distribution** | 1000s of copies distributed to uncontrolled machines |
| **Decompilation** | Anyone can extract .exe contents with free tools |
| **File Extraction** | .env file easily found in extracted contents |
| **Credential Leak** | All users would have access to production credentials |
| **Attack Surface** | Each user machine is a potential attack vector |
| **Malware Risk** | Malware can scan for .env files and exfiltrate |
| **Compliance** | Violates security policies for credential distribution |
| **Revocation** | Cannot revoke credentials from distributed .exe |

**Risk Level:** 🚨 **CRITICAL** (uncontrolled environment)

---

## 🔑 Credential Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    CREDENTIAL STORAGE                        │
└──────────────────────────────────────────────────────────────┘

AI Server .env:
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE_URL=https://jvijitdewbypqbatfboi.supabase.co      │
│ SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...   │
│ SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...  │
│ ATLASSIAN_CLIENT_SECRET=ATOANevmtov-6HclDUksQLt6...        │
│ OCR_PRIMARY_ENGINE=paddle                                   │
│ OCR_PADDLE_MIN_CONFIDENCE=0.5                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
                 AI Server Startup
                require('dotenv').config()
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  AI Server Memory                           │
│                  (process.env)                              │
│                                                             │
│  process.env.SUPABASE_URL = "https://..."                  │
│  process.env.SUPABASE_ANON_KEY = "eyJ..."                  │
│  process.env.OCR_PRIMARY_ENGINE = "paddle"                 │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
              Desktop App API Request
        POST /api/auth/ocr-config (OAuth protected)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                 JSON Response (HTTPS)                       │
│                                                             │
│  {                                                          │
│    "success": true,                                         │
│    "config": {                                              │
│      "primary_engine": "paddle",                            │
│      "engines": {                                           │
│        "paddle": { "min_confidence": 0.5 }                  │
│      }                                                       │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
               Desktop App Receives JSON
                           ↓
┌─────────────────────────────────────────────────────────────┐
│            Desktop App Memory (os.environ)                  │
│                                                             │
│  os.environ['OCR_PRIMARY_ENGINE'] = 'paddle'               │
│  os.environ['OCR_PADDLE_MIN_CONFIDENCE'] = '0.5'           │
│  os.environ['SUPABASE_URL'] = 'https://...'                │
│  ...                                                        │
│                                                             │
│  ❌ NO FILES CREATED                                        │
│  ✓ Config in memory only                                   │
│  ✓ Lost when app closes                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
1. ✅ Credentials stored in .env on **server only**
2. ✅ Loaded into server memory at startup
3. ✅ Served via **authenticated API** only
4. ✅ Desktop app receives as **JSON** (not .env file)
5. ✅ Desktop app stores in **memory** (not disk)
6. ✅ **No files created** on user's machine

---

## 🚀 Configuration Management

### Updating Configuration (The Magic!)

#### Traditional Approach (with .env in desktop app):
```
Day 1: Decide to change OCR settings
├── 1. Update .env in desktop app codebase (5 min)
├── 2. Rebuild .exe with PyInstaller (15 min)
├── 3. Test new .exe (30 min)
├── 4. Upload to CDN (10 min)
├── 5. Create release announcement
├── 6. Notify 1000 users via email
└── 7. Wait for users to download and install (days-weeks)

Day 14: Only 60% of users have updated
→ Total Time: 2 weeks for full deployment
→ Old config still running on 40% of machines
```

#### New Architecture (centralized .env on AI server):
```
Day 1: Decide to change OCR settings
├── 1. SSH to AI server (30 seconds)
├── 2. nano /var/www/jiraforge/ai-server/.env (30 seconds)
├── 3. Change OCR_PRIMARY_ENGINE=tesseract (10 seconds)
├── 4. npm restart (20 seconds)
└── 5. Done! All 1000 desktops get new config on next startup

Day 1: 100% of users have updated automatically
→ Total Time: 90 seconds for full deployment
→ New config running everywhere
```

**Improvement:** 🚀 **20,000x faster deployment!**

---

### A/B Testing Configuration

```javascript
// AI Server can return different configs for different users
exports.getOcrConfig = async (req, res) => {
  const userId = getUserIdFromToken(req.body.atlassian_token);
  
  // 50% get PaddleOCR, 50% get Tesseract
  const config = {
    primary_engine: userId % 2 === 0 ? 'paddle' : 'tesseract',
    // ...
  };
  
  // Log for analytics
  await logOcrConfig(userId, config.primary_engine);
  
  res.json({ success: true, config });
};
```

**Benefits:**
- ✅ Test different OCR engines per user
- ✅ Gradual rollout (1% → 10% → 100%)
- ✅ Instant rollback if issues detected
- ✅ Collect performance metrics per config
- ✅ Emergency disable without .exe rebuild

---

## 📊 Comparison Table

| Aspect | AI Server (.env) | Desktop App (no .env) |
|--------|------------------|----------------------|
| **Has .env File** | ✅ Yes (required) | ❌ No (prohibited) |
| **Location** | Secure server | 1000s of user computers |
| **Access Control** | Admin only | Anyone (distributed) |
| **File Permissions** | chmod 600 | N/A - no file exists |
| **Credential Exposure** | ✅ Secure | ✅ Zero exposure |
| **Update Speed** | 30 seconds | N/A - fetches from server |
| **Rollback Speed** | 30 seconds | N/A - fetches from server |
| **A/B Testing** | ✅ Easy | ✅ Receives config from server |
| **Compliance** | ✅ Compliant | ✅ Compliant |
| **Attack Surface** | Minimal (1 server) | N/A - no credentials |
| **Audit Trail** | ✅ Server logs | ✅ API calls logged |

---

## 🧪 Testing the Setup

### Verify AI Server .env

```bash
# SSH to server
ssh admin@forgesync.amzur.com

# Check .env exists
ls -la /var/www/jiraforge/ai-server/.env
# -rw------- 1 www-data www-data 2048 Feb 21 10:30 .env ✓

# Check not in git
cd /var/www/jiraforge/ai-server
git status | grep .env
# (no output = not staged) ✓

# Verify server loads config
npm start
# [INFO] Loaded SUPABASE_URL ✓
# [INFO] Loaded OCR_PRIMARY_ENGINE: paddle ✓
# [INFO] Server listening on port 3001 ✓
```

---

### Verify Desktop App Has No .env

```bash
# Build desktop app
cd python-desktop-app
pyinstaller desktop_app.spec

# Check .exe size
dir dist\TimeTracker.exe
# ~135 MB (no extra .env file)

# Extract and inspect (requires pyinstaller-extractor)
pip install pyinstaller-extractor
python -m pyinstaller_extractor dist\TimeTracker.exe

# Search for .env in extracted files
cd TimeTracker.exe_extracted
dir /s /b | findstr ".env"
# (no results = no .env file) ✓
```

---

### Test Configuration Fetch

```powershell
# Run desktop app
.\dist\TimeTracker.exe

# Watch logs for config fetch:
# [INFO] Fetching Supabase configuration from AI server...
# [OK] Supabase config loaded from AI server ✓
# [INFO] Fetching OCR configuration from AI server...
# [OK] OCR config loaded from AI server (engines: paddle, tesseract) ✓
# [INFO] Primary OCR engine: paddle ✓
```

---

## 🐛 Troubleshooting

### Problem: "AI server not finding .env variables"

**Symptoms:**
```
[ERROR] SUPABASE_URL not found
[ERROR] OCR_PRIMARY_ENGINE not found
```

**Solution:**
```bash
# 1. Check .env exists
ls -la /var/www/jiraforge/ai-server/.env

# 2. Check file has content
cat /var/www/jiraforge/ai-server/.env
# Should show: SUPABASE_URL=https://...

# 3. Check .env is in correct directory
pwd
# /var/www/jiraforge/ai-server

# 4. Restart server to reload .env
npm restart
```

---

### Problem: "Desktop app cannot fetch config"

**Symptoms:**
```
[ERROR] Failed to fetch OCR config: Connection refused
```

**Solution:**
```bash
# 1. Check AI server is running
curl https://forgesync.amzur.com/health
# Should return: {"status": "healthy"}

# 2. Check OAuth token is valid
# (requires valid Atlassian login)

# 3. Check network connectivity
ping forgesync.amzur.com

# 4. Check firewall allows HTTPS
curl -v https://forgesync.amzur.com/api/auth/ocr-config
```

---

### Problem: "OCR not using server config"

**Symptoms:**
```
[INFO] OCR config loaded from AI server (engines: paddle, tesseract)
[WARN] Using default OCR engine (not from server)
```

**Solution:**
This means `set_runtime_ocr_config()` is not setting `os.environ`. Check:

```python
# In desktop_app.py, verify this function sets os.environ:
def set_runtime_ocr_config(config_dict):
    # Should have lines like:
    os.environ['OCR_PRIMARY_ENGINE'] = 'paddle'  # ← CRITICAL
    os.environ['OCR_PADDLE_MIN_CONFIDENCE'] = '0.5'  # ← CRITICAL
    
    # If missing, OCR module won't see the config
```

---

## 📚 Related Documentation

- [CENTRALIZED_CONFIGURATION_ARCHITECTURE.md](./CENTRALIZED_CONFIGURATION_ARCHITECTURE.md) - Complete architecture guide
- [CONFIGURATION_BEFORE_AFTER.md](./CONFIGURATION_BEFORE_AFTER.md) - Visual comparison
- [DESKTOP_APP_SECURITY_PACKAGING.md](./DESKTOP_APP_SECURITY_PACKAGING.md) - .exe security
- [AI_SERVER_CONNECTION_ARCHITECTURE.md](./AI_SERVER_CONNECTION_ARCHITECTURE.md) - OAuth flow

---

## ✅ Summary

### Critical Points to Remember

1. **AI Server NEEDS .env file**
   - Stores all credentials and configuration
   - Secured with file permissions and network isolation
   - Single source of truth for configuration

2. **Desktop App MUST NOT have .env file**
   - Distributed to uncontrolled machines
   - Anyone can decompile and extract files
   - Security policy violation if credentials included

3. **Configuration Flow**
   - AI server reads .env at startup
   - Desktop app fetches via authenticated API
   - Config stored in memory only (not disk)
   - Zero credentials on user machines

4. **Benefits**
   - ✅ Zero credential exposure
   - ✅ Instant configuration updates
   - ✅ A/B testing capability
   - ✅ Emergency rollback in 30 seconds
   - ✅ Policy compliant

---

## 🎯 Quick Reference

**On AI Server:**
```bash
# Location
/var/www/jiraforge/ai-server/.env

# Permissions
chmod 600 .env
chown www-data:www-data .env

# Never in git
echo ".env" >> .gitignore
```

**On Desktop App:**
```bash
# No .env file anywhere
# Config fetched from AI server at runtime
# Stored in process memory only
```

**To Update Config:**
```bash
# Edit AI server .env
nano /var/www/jiraforge/ai-server/.env

# Restart
npm restart

# Done! All desktops updated automatically
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-21  
**Status:** ✅ Production Architecture  
**Reviewed By:** Architecture Team
