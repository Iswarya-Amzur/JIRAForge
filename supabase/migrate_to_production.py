#!/usr/bin/env python3
"""
JIRAForge - Complete Supabase Migration Script
===============================================
Migrates EVERYTHING from Development to Production Supabase:
- Database schema (tables, indexes, functions, triggers, views)
- RLS Policies
- Storage Buckets and Policies
- Edge Functions (deployment instructions)
- Webhooks (setup instructions)

Development Project: jvijitdewbypqbatfboi
Production Project:  jbxabkazpuuphpsahlfh

IMPORTANT: This script does NOT migrate data - only structure!

Usage:
    1. Get your API keys from both Supabase projects:
       - Go to Supabase Dashboard > Settings > API
       - Copy the service_role key (secret)
    
    2. Run the script:
       python migrate_to_production.py
    
    3. Follow the prompts to enter your credentials

Author: Generated for JIRAForge
Date: January 2026
"""

import os
import sys
import json
import time
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from datetime import datetime

# Check for requests - install if needed
try:
    import requests
except ImportError:
    print("Installing requests library...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class SupabaseConfig:
    """Supabase project configuration"""
    project_ref: str
    url: str
    anon_key: str
    service_role_key: str
    db_password: str = ""  # Optional for direct DB access


# Project References
DEV_PROJECT_REF = "jvijitdewbypqbatfboi"
PROD_PROJECT_REF = "jbxabkazpuuphpsahlfh"

# URLs
DEV_URL = f"https://{DEV_PROJECT_REF}.supabase.co"
PROD_URL = f"https://{PROD_PROJECT_REF}.supabase.co"

# Pre-configured Service Role Keys (for automated migration)
DEV_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc1NTU5MCwiZXhwIjoyMDc4MzMxNTkwfQ.2Pbdo2DHHfCIpUVPP390P2Y3rF7_hdsYM-38g26XTUY"
PROD_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpieGFia2F6cHV1cGhwc2FobGZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTI4Mjk4NCwiZXhwIjoyMDg0ODU4OTg0fQ.jSRh71ENoG5dxVxFFQx7sSoGo1zxQFgxA5FtSahQ36Q"


# =============================================================================
# TERMINAL COLORS
# =============================================================================

class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    GRAY = '\033[90m'
    WHITE = '\033[97m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_color(message: str, color: str = Colors.WHITE, bold: bool = False):
    """Print colored message"""
    style = Colors.BOLD if bold else ''
    print(f"{style}{color}{message}{Colors.RESET}")

def print_header(title: str):
    """Print section header"""
    print()
    print_color("=" * 70, Colors.CYAN, bold=True)
    print_color(f"  {title}", Colors.CYAN, bold=True)
    print_color("=" * 70, Colors.CYAN, bold=True)

def print_success(message: str):
    print_color(f"✅ {message}", Colors.GREEN)

def print_warning(message: str):
    print_color(f"⚠️  {message}", Colors.YELLOW)

def print_error(message: str):
    print_color(f"❌ {message}", Colors.RED)

def print_info(message: str):
    print_color(f"ℹ️  {message}", Colors.CYAN)

def print_step(step: int, total: int, message: str):
    print_color(f"\n[{step}/{total}] {message}", Colors.YELLOW, bold=True)


# =============================================================================
# SUPABASE API CLIENT
# =============================================================================

class SupabaseClient:
    """Supabase REST API Client"""
    
    def __init__(self, config: SupabaseConfig):
        self.config = config
        self.headers = {
            "apikey": config.service_role_key,
            "Authorization": f"Bearer {config.service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    def execute_sql(self, sql: str) -> Tuple[bool, Any]:
        """Execute SQL via REST API using pg_query endpoint"""
        url = f"{self.config.url}/rest/v1/rpc/pg_query"
        
        # Try using raw SQL endpoint
        # Supabase doesn't have a direct SQL execution endpoint via REST
        # We'll need to use the Management API or direct PostgreSQL connection
        print_warning("Note: Direct SQL execution via REST API is limited")
        print_info("Using alternative approach...")
        
        return False, "SQL execution via REST API requires Management API"
    
    def list_tables(self) -> Tuple[bool, List[str]]:
        """List all tables in public schema"""
        # Query information_schema.tables via RPC or stored function
        url = f"{self.config.url}/rest/v1/"
        
        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return True, response.json()
            return False, f"Error: {response.status_code}"
        except Exception as e:
            return False, str(e)
    
    def get_storage_buckets(self) -> Tuple[bool, List[Dict]]:
        """List all storage buckets"""
        url = f"{self.config.url}/storage/v1/bucket"
        
        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return True, response.json()
            return False, f"Error: {response.status_code} - {response.text}"
        except Exception as e:
            return False, str(e)
    
    def create_storage_bucket(self, bucket_id: str, public: bool = False, 
                             file_size_limit: int = None, 
                             allowed_mime_types: List[str] = None) -> Tuple[bool, Any]:
        """Create a storage bucket"""
        url = f"{self.config.url}/storage/v1/bucket"
        
        payload = {
            "id": bucket_id,
            "name": bucket_id,
            "public": public
        }
        
        if file_size_limit:
            payload["file_size_limit"] = file_size_limit
        
        if allowed_mime_types:
            payload["allowed_mime_types"] = allowed_mime_types
        
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            if response.status_code in [200, 201]:
                return True, response.json()
            return False, f"Error: {response.status_code} - {response.text}"
        except Exception as e:
            return False, str(e)
    
    def health_check(self) -> bool:
        """Check if the Supabase instance is accessible"""
        url = f"{self.config.url}/rest/v1/"
        
        try:
            response = requests.get(url, headers=self.headers)
            return response.status_code == 200
        except:
            return False


# =============================================================================
# MIGRATION MANAGER
# =============================================================================

class MigrationManager:
    """Manages the migration process"""
    
    def __init__(self, script_dir: Path):
        self.script_dir = script_dir
        self.exports_dir = script_dir / "exports"
        self.functions_dir = script_dir / "functions"
        self.migration_sql_file = script_dir / "DEV_MIGRATION_COMPLETE.sql"
        self.production_sql_file = self.exports_dir / "PRODUCTION_SETUP.sql"
        
        # Ensure exports directory exists
        self.exports_dir.mkdir(exist_ok=True)
    
    def generate_production_sql(self, prod_config: SupabaseConfig) -> Path:
        """Generate the complete production SQL file with proper substitutions"""
        print_step(1, 6, "Generating Production SQL File")
        
        if not self.migration_sql_file.exists():
            print_error(f"Migration SQL file not found: {self.migration_sql_file}")
            return None
        
        # Read the existing migration SQL
        with open(self.migration_sql_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Add header for production
        production_header = f"""-- ============================================================================
-- JIRAForge PRODUCTION Database Setup
-- ============================================================================
-- Generated: {datetime.now().isoformat()}
-- Target Project: {prod_config.project_ref}
-- Target URL: {prod_config.url}
-- 
-- INSTRUCTIONS:
-- 1. Go to your Production Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Paste this entire script
-- 5. Click "Run" to execute
-- 
-- This script will create:
-- - All tables with proper constraints
-- - All indexes for performance
-- - All functions and triggers
-- - All views for analytics
-- - All RLS policies for security
-- - Storage buckets and policies
-- ============================================================================

"""
        
        production_sql = production_header + sql_content
        
        # Write to production SQL file
        with open(self.production_sql_file, 'w', encoding='utf-8') as f:
            f.write(production_sql)
        
        print_success(f"Production SQL generated: {self.production_sql_file}")
        return self.production_sql_file
    
    def generate_storage_setup_sql(self) -> str:
        """Generate SQL for storage bucket setup"""
        return """
-- ============================================================================
-- STORAGE BUCKETS SETUP
-- ============================================================================
-- Run this in SQL Editor AFTER the main migration script

-- Create screenshots bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'screenshots',
    'screenshots',
    false,
    10485760,  -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create documents bucket  
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    52428800,  -- 50MB
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

SELECT '✅ Storage buckets created!' as status;
SELECT * FROM storage.buckets;
"""
    
    def generate_webhook_setup_instructions(self, prod_config: SupabaseConfig) -> str:
        """Generate webhook setup instructions"""
        return f"""
================================================================================
DATABASE WEBHOOKS SETUP GUIDE
================================================================================

After running the SQL migration, you need to set up Database Webhooks manually
in the Supabase Dashboard.

Project URL: {prod_config.url}

STEP 1: Navigate to Database Webhooks
--------------------------------------
1. Go to: {prod_config.url.replace('.supabase.co', '.supabase.co/project/' + prod_config.project_ref + '/database/hooks')}
2. Or: Dashboard → Database → Webhooks

STEP 2: Create Screenshot Webhook
---------------------------------
Click "Create a new webhook" and configure:

   Name:           screenshot-insert-webhook
   Table:          screenshots
   Events:         ☑ INSERT
   Type:           Supabase Edge Function
   Edge Function:  screenshot-webhook
   
   HTTP Headers:   (leave default)
   Timeout:        5000ms

STEP 3: Create Document Webhook  
-------------------------------
Click "Create a new webhook" and configure:

   Name:           document-insert-webhook
   Table:          documents
   Events:         ☑ INSERT
   Type:           Supabase Edge Function
   Edge Function:  document-webhook
   
   HTTP Headers:   (leave default)
   Timeout:        10000ms (documents take longer)

================================================================================
"""
    
    def generate_edge_function_deployment_guide(self, prod_config: SupabaseConfig) -> str:
        """Generate edge function deployment instructions"""
        return f"""
================================================================================
EDGE FUNCTIONS DEPLOYMENT GUIDE
================================================================================

After setting up the database schema and webhooks, deploy the Edge Functions.

Project: {prod_config.project_ref}
Functions Directory: {self.functions_dir}

PREREQUISITES:
--------------
1. Install Supabase CLI (if not already):
   npm install -g supabase

2. Login to Supabase:
   supabase login

3. Link to production project:
   cd {self.script_dir}
   supabase link --project-ref {prod_config.project_ref}

DEPLOYMENT COMMANDS:
--------------------
# Deploy all edge functions at once:
supabase functions deploy screenshot-webhook --project-ref {prod_config.project_ref}
supabase functions deploy document-webhook --project-ref {prod_config.project_ref}
supabase functions deploy update-issues-cache --project-ref {prod_config.project_ref}

# Or deploy all functions in the directory:
supabase functions deploy --project-ref {prod_config.project_ref}

SET FUNCTION SECRETS:
---------------------
# Set required environment variables for edge functions:
supabase secrets set AI_SERVER_URL=<your-ai-server-url> --project-ref {prod_config.project_ref}
supabase secrets set AI_SERVER_API_KEY=<your-ai-api-key> --project-ref {prod_config.project_ref}

VERIFY DEPLOYMENT:
------------------
# List deployed functions:
supabase functions list --project-ref {prod_config.project_ref}

# Test a function:
curl -X POST '{prod_config.url}/functions/v1/screenshot-webhook' \\
  -H "Authorization: Bearer {prod_config.anon_key}" \\
  -H "Content-Type: application/json" \\
  -d '{{"type": "test"}}'

================================================================================
"""
    
    def generate_env_update_guide(self, prod_config: SupabaseConfig) -> str:
        """Generate guide for updating environment variables"""
        return f"""
================================================================================
ENVIRONMENT VARIABLES UPDATE GUIDE
================================================================================

Update these environment variables in your applications:

DESKTOP APP (python-desktop-app/.env):
--------------------------------------
SUPABASE_URL={prod_config.url}
SUPABASE_ANON_KEY=<production-anon-key>

FORGE APP (forge-app/.env or manifest.yml):
-------------------------------------------
SUPABASE_URL: {prod_config.url}
SUPABASE_SERVICE_ROLE_KEY: <production-service-role-key>

AI SERVER (ai-server/.env):
---------------------------
SUPABASE_URL={prod_config.url}
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>

IMPORTANT NOTES:
----------------
1. Never commit service_role_key to version control
2. Use different credentials for dev vs production
3. Update all deployment configurations
4. Test connectivity before going live

================================================================================
"""


# =============================================================================
# MAIN MIGRATION SCRIPT
# =============================================================================

def get_credentials() -> Tuple[SupabaseConfig, SupabaseConfig]:
    """Get credentials - using pre-configured keys"""
    print_header("SUPABASE CREDENTIALS SETUP")
    
    print_info(f"Development Project: {DEV_PROJECT_REF}")
    print_info(f"Production Project: {PROD_PROJECT_REF}")
    print()
    
    print_success("Using pre-configured credentials")
    print()
    
    # Production credentials (pre-configured)
    prod_config = SupabaseConfig(
        project_ref=PROD_PROJECT_REF,
        url=PROD_URL,
        anon_key="",  # Not needed for migration
        service_role_key=PROD_SERVICE_ROLE_KEY
    )
    
    # Development credentials (pre-configured)
    dev_config = SupabaseConfig(
        project_ref=DEV_PROJECT_REF,
        url=DEV_URL,
        anon_key="",
        service_role_key=DEV_SERVICE_ROLE_KEY
    )
    
    return dev_config, prod_config


def verify_connection(config: SupabaseConfig) -> bool:
    """Verify connection to Supabase"""
    print_info(f"Verifying connection to {config.project_ref}...")
    
    client = SupabaseClient(config)
    if client.health_check():
        print_success(f"Connected to {config.project_ref}")
        return True
    else:
        print_error(f"Cannot connect to {config.project_ref}")
        return False


def create_storage_buckets(client: SupabaseClient) -> bool:
    """Create storage buckets in production"""
    print_step(3, 6, "Creating Storage Buckets")
    
    buckets_config = [
        {
            "id": "screenshots",
            "public": False,
            "file_size_limit": 10485760,  # 10MB
            "allowed_mime_types": ["image/png", "image/jpeg", "image/jpg", "image/webp"]
        },
        {
            "id": "documents", 
            "public": False,
            "file_size_limit": 52428800,  # 50MB
            "allowed_mime_types": [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword"
            ]
        }
    ]
    
    for bucket in buckets_config:
        success, result = client.create_storage_bucket(
            bucket_id=bucket["id"],
            public=bucket["public"],
            file_size_limit=bucket["file_size_limit"],
            allowed_mime_types=bucket["allowed_mime_types"]
        )
        
        if success:
            print_success(f"Created bucket: {bucket['id']}")
        else:
            if "already exists" in str(result).lower() or "duplicate" in str(result).lower():
                print_warning(f"Bucket already exists: {bucket['id']}")
            else:
                print_error(f"Failed to create bucket {bucket['id']}: {result}")
    
    return True


def run_migration():
    """Main migration function"""
    print_header("JIRAFORGE SUPABASE MIGRATION")
    print_color("Development → Production", Colors.CYAN)
    print()
    
    # Get script directory
    script_dir = Path(__file__).parent.resolve()
    
    # Initialize migration manager
    manager = MigrationManager(script_dir)
    
    # Get credentials
    dev_config, prod_config = get_credentials()
    
    # Verify production connection
    print_step(2, 6, "Verifying Production Connection")
    if not verify_connection(prod_config):
        print_error("Cannot proceed without valid production credentials")
        return False
    
    prod_client = SupabaseClient(prod_config)
    
    # Generate production SQL
    sql_file = manager.generate_production_sql(prod_config)
    if not sql_file:
        return False
    
    # Create storage buckets via API
    create_storage_buckets(prod_client)
    
    # Generate all setup files
    print_step(4, 6, "Generating Setup Files")
    
    # Storage setup SQL
    storage_sql_file = manager.exports_dir / "STORAGE_SETUP.sql"
    with open(storage_sql_file, 'w', encoding='utf-8') as f:
        f.write(manager.generate_storage_setup_sql())
    print_success(f"Generated: {storage_sql_file}")
    
    # Webhook setup guide
    webhook_guide_file = manager.exports_dir / "WEBHOOK_SETUP_GUIDE.md"
    with open(webhook_guide_file, 'w', encoding='utf-8') as f:
        f.write(manager.generate_webhook_setup_instructions(prod_config))
    print_success(f"Generated: {webhook_guide_file}")
    
    # Edge function deployment guide
    edge_function_guide_file = manager.exports_dir / "EDGE_FUNCTION_DEPLOYMENT.md"
    with open(edge_function_guide_file, 'w', encoding='utf-8') as f:
        f.write(manager.generate_edge_function_deployment_guide(prod_config))
    print_success(f"Generated: {edge_function_guide_file}")
    
    # Environment variables guide
    env_guide_file = manager.exports_dir / "ENV_VARIABLES_GUIDE.md"
    with open(env_guide_file, 'w', encoding='utf-8') as f:
        f.write(manager.generate_env_update_guide(prod_config))
    print_success(f"Generated: {env_guide_file}")
    
    # Generate master checklist
    print_step(5, 6, "Generating Migration Checklist")
    checklist = generate_migration_checklist(prod_config, manager)
    checklist_file = manager.exports_dir / "MIGRATION_CHECKLIST.md"
    with open(checklist_file, 'w', encoding='utf-8') as f:
        f.write(checklist)
    print_success(f"Generated: {checklist_file}")
    
    # Final summary
    print_step(6, 6, "Migration Preparation Complete!")
    print_final_summary(prod_config, manager)
    
    return True


def generate_migration_checklist(config: SupabaseConfig, manager: MigrationManager) -> str:
    """Generate comprehensive migration checklist"""
    return f"""# JIRAForge Production Migration Checklist

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Target Project:** {config.project_ref}  
**Target URL:** {config.url}

---

## Pre-Migration Checklist

- [ ] Backup development database (optional, for reference)
- [ ] Verify production Supabase project is created
- [ ] Note down production API keys (anon, service_role)
- [ ] Ensure you have Supabase CLI installed (`npm install -g supabase`)
- [ ] Login to Supabase CLI (`supabase login`)

---

## Step 1: Database Schema Migration

1. Open Supabase Dashboard for production:
   {config.url.replace('.supabase.co', '.supabase.co/project/' + config.project_ref)}

2. Go to **SQL Editor** → **New Query**

3. Copy and paste the contents of:
   `{manager.production_sql_file}`

4. Click **Run** to execute the entire script

5. Verify the output shows:
   - ✅ Tables created
   - ✅ Functions created
   - ✅ Triggers created
   - ✅ Views created
   - ✅ RLS policies created
   - ✅ Storage buckets created

- [ ] Schema migration completed successfully

---

## Step 2: Storage Buckets Verification

The main script should have created the buckets. Verify in Dashboard:

1. Go to **Storage** section
2. Verify these buckets exist:
   - [ ] `screenshots` bucket (private, 10MB limit)
   - [ ] `documents` bucket (private, 50MB limit)

If missing, run the SQL in:
`{manager.exports_dir / "STORAGE_SETUP.sql"}`

---

## Step 3: Deploy Edge Functions

Using Supabase CLI:

```powershell
cd {manager.script_dir}

# Link to production project
supabase link --project-ref {config.project_ref}

# Deploy all functions
supabase functions deploy screenshot-webhook --project-ref {config.project_ref}
supabase functions deploy document-webhook --project-ref {config.project_ref}  
supabase functions deploy update-issues-cache --project-ref {config.project_ref}

# Set secrets
supabase secrets set AI_SERVER_URL=<your-ai-server-url> --project-ref {config.project_ref}
supabase secrets set AI_SERVER_API_KEY=<your-api-key> --project-ref {config.project_ref}
```

- [ ] screenshot-webhook deployed
- [ ] document-webhook deployed
- [ ] update-issues-cache deployed
- [ ] Secrets configured

---

## Step 4: Configure Database Webhooks

1. Go to **Database** → **Webhooks** in Dashboard

2. Create **screenshot-insert-webhook**:
   - Table: `screenshots`
   - Events: INSERT
   - Type: Supabase Edge Function
   - Function: `screenshot-webhook`
   
3. Create **document-insert-webhook**:
   - Table: `documents`
   - Events: INSERT
   - Type: Supabase Edge Function
   - Function: `document-webhook`

- [ ] screenshot-insert-webhook created
- [ ] document-insert-webhook created

---

## Step 5: Update Application Configurations

### Desktop App (python-desktop-app)
Update `.env` or configuration:
```
SUPABASE_URL={config.url}
SUPABASE_ANON_KEY=<production-anon-key>
```

### Forge App (forge-app)
Update `manifest.yml` or environment:
```yaml
SUPABASE_URL: {config.url}
SUPABASE_SERVICE_ROLE_KEY: <production-service-role-key>
```

### AI Server (ai-server)
Update `.env`:
```
SUPABASE_URL={config.url}
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
```

- [ ] Desktop app configured
- [ ] Forge app configured
- [ ] AI server configured

---

## Step 6: Verification Tests

### Test 1: Database Connection
```python
import requests
url = "{config.url}/rest/v1/"
headers = {{"apikey": "<anon-key>"}}
response = requests.get(url, headers=headers)
print(f"Status: {{response.status_code}}")  # Should be 200
```

### Test 2: Table Existence
In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
```

### Test 3: Storage Bucket Access
```python
url = "{config.url}/storage/v1/bucket"
headers = {{"apikey": "<service-role-key>", "Authorization": "Bearer <service-role-key>"}}
response = requests.get(url, headers=headers)
print(response.json())  # Should list buckets
```

- [ ] Database connection works
- [ ] All tables exist
- [ ] Storage buckets accessible

---

## Step 7: Go Live Checklist

- [ ] All tests passed
- [ ] Team notified of migration
- [ ] DNS/URLs updated if applicable
- [ ] Monitoring configured
- [ ] First user test successful

---

## Troubleshooting

### Issue: "relation already exists"
This is OK - it means the table already exists. The script uses `IF NOT EXISTS`.

### Issue: "permission denied"
Check that you're using the `service_role` key, not the `anon` key.

### Issue: Edge function deployment fails
1. Ensure you're logged in: `supabase login`
2. Ensure project is linked: `supabase link --project-ref {config.project_ref}`
3. Check function syntax for errors

### Issue: Webhooks not triggering
1. Verify webhook is enabled in Dashboard
2. Check Edge Function logs in Dashboard
3. Verify secrets are set correctly

---

## Support Files Generated

| File | Purpose |
|------|---------|
| `PRODUCTION_SETUP.sql` | Complete database schema |
| `STORAGE_SETUP.sql` | Storage bucket SQL |
| `WEBHOOK_SETUP_GUIDE.md` | Webhook configuration |
| `EDGE_FUNCTION_DEPLOYMENT.md` | Edge function deployment |
| `ENV_VARIABLES_GUIDE.md` | Environment variables |

---

**Migration prepared successfully! Follow the steps above to complete the migration.**
"""


def print_final_summary(config: SupabaseConfig, manager: MigrationManager):
    """Print final summary and next steps"""
    print()
    print_header("MIGRATION PREPARATION COMPLETE!")
    print()
    
    print_color("Generated Files:", Colors.CYAN, bold=True)
    print_color(f"  📄 {manager.exports_dir / 'PRODUCTION_SETUP.sql'}", Colors.WHITE)
    print_color(f"  📄 {manager.exports_dir / 'STORAGE_SETUP.sql'}", Colors.WHITE)
    print_color(f"  📄 {manager.exports_dir / 'WEBHOOK_SETUP_GUIDE.md'}", Colors.WHITE)
    print_color(f"  📄 {manager.exports_dir / 'EDGE_FUNCTION_DEPLOYMENT.md'}", Colors.WHITE)
    print_color(f"  📄 {manager.exports_dir / 'ENV_VARIABLES_GUIDE.md'}", Colors.WHITE)
    print_color(f"  📄 {manager.exports_dir / 'MIGRATION_CHECKLIST.md'}", Colors.WHITE)
    print()
    
    print_color("NEXT STEPS:", Colors.YELLOW, bold=True)
    print()
    print_color("1. APPLY DATABASE SCHEMA:", Colors.WHITE, bold=True)
    print_color(f"   • Open: {config.url.replace('.supabase.co', '.supabase.co/project/' + config.project_ref + '/sql/new')}", Colors.GRAY)
    print_color(f"   • Copy contents of: PRODUCTION_SETUP.sql", Colors.GRAY)
    print_color(f"   • Click 'Run' to execute", Colors.GRAY)
    print()
    
    print_color("2. DEPLOY EDGE FUNCTIONS:", Colors.WHITE, bold=True)
    print_color(f"   • supabase login", Colors.GRAY)
    print_color(f"   • supabase link --project-ref {config.project_ref}", Colors.GRAY)
    print_color(f"   • supabase functions deploy --project-ref {config.project_ref}", Colors.GRAY)
    print()
    
    print_color("3. CONFIGURE WEBHOOKS:", Colors.WHITE, bold=True)
    print_color(f"   • See: WEBHOOK_SETUP_GUIDE.md", Colors.GRAY)
    print()
    
    print_color("4. UPDATE APP CONFIGURATIONS:", Colors.WHITE, bold=True)
    print_color(f"   • See: ENV_VARIABLES_GUIDE.md", Colors.GRAY)
    print()
    
    print_color("5. FOLLOW THE COMPLETE CHECKLIST:", Colors.WHITE, bold=True)
    print_color(f"   • Open: {manager.exports_dir / 'MIGRATION_CHECKLIST.md'}", Colors.GRAY)
    print()
    
    print_success("All migration files have been generated!")
    print_info("Your development environment remains unchanged.")
    print()


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    try:
        success = run_migration()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print()
        print_warning("Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
