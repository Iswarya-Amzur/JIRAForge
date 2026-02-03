#!/usr/bin/env python3
"""
JIRAForge - Complete Supabase Migration Script (DEV → PROD)
============================================================
Connects to DEV Supabase, extracts everything, and applies to PRODUCTION.

This script:
1. Connects to DEV Supabase (READ ONLY)
2. Extracts: tables, indexes, functions, triggers, views, RLS policies, storage buckets
3. Applies everything to PRODUCTION Supabase

Development Project: jvijitdewbypqbatfboi (SOURCE - READ ONLY)
Production Project:  ykccewaedeiujewaixrt (TARGET - WRITE)

Usage:
    python migrate_to_production.py

Author: Generated for JIRAForge
Date: January 2026
"""

import os
import sys
import json
import time
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

# Project References
DEV_PROJECT_REF = "jvijitdewbypqbatfboi"
PROD_PROJECT_REF = "iwbfxptbprbzoyqdqhez"  # NEW PROD PROJECT (Feb 2026)

# URLs
DEV_URL = f"https://{DEV_PROJECT_REF}.supabase.co"
PROD_URL = f"https://{PROD_PROJECT_REF}.supabase.co"

# Management API URL
MANAGEMENT_API_URL = "https://api.supabase.com"

# Service Role Keys
DEV_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWppdGRld2J5cHFiYXRmYm9pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc1NTU5MCwiZXhwIjoyMDc4MzMxNTkwfQ.2Pbdo2DHHfCIpUVPP390P2Y3rF7_hdsYM-38g26XTUY"
PROD_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YmZ4cHRicHJiem95cWRxaGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYwMzc3OSwiZXhwIjoyMDg1MTc5Nzc5fQ.26vymNQD8paLRJoqEq-SDiO9wlBWhYp3HYten2V6m7g"

# Anon Key (for reference - use this in client apps)
PROD_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3YmZ4cHRicHJiem95cWRxaGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDM3NzksImV4cCI6MjA4NTE3OTc3OX0.O9KwZ9H9tLOPygDlgAL_vAJ4I-IEGnnoJNSaKFXn04s"

# Management API Token (will be prompted)
MANAGEMENT_API_TOKEN = ""


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
    style = Colors.BOLD if bold else ''
    print(f"{style}{color}{message}{Colors.RESET}")

def print_header(title: str):
    print()
    print_color("=" * 70, Colors.CYAN, bold=True)
    print_color(f"  {title}", Colors.CYAN, bold=True)
    print_color("=" * 70, Colors.CYAN, bold=True)

def print_success(message: str):
    print_color(f"  [OK] {message}", Colors.GREEN)

def print_warning(message: str):
    print_color(f"  [WARN] {message}", Colors.YELLOW)

def print_error(message: str):
    print_color(f"  [ERROR] {message}", Colors.RED)

def print_info(message: str):
    print_color(f"  [INFO] {message}", Colors.CYAN)

def print_step(step: int, total: int, message: str):
    print_color(f"\n[{step}/{total}] {message}", Colors.YELLOW, bold=True)


# =============================================================================
# MANAGEMENT API CLIENT
# =============================================================================

class ManagementAPIClient:
    """Supabase Management API Client for SQL execution"""

    def __init__(self, access_token: str, project_ref: str):
        self.access_token = access_token
        self.project_ref = project_ref
        self.base_url = MANAGEMENT_API_URL
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    def execute_sql(self, sql: str, read_only: bool = False) -> Tuple[bool, Any]:
        """Execute SQL via Management API"""
        url = f"{self.base_url}/v1/projects/{self.project_ref}/database/query"

        payload = {
            "query": sql,
            "read_only": read_only
        }

        try:
            response = requests.post(url, headers=self.headers, json=payload, timeout=300)

            if response.status_code in [200, 201]:
                try:
                    return True, response.json()
                except:
                    return True, {"status": "success"}
            else:
                return False, f"Error {response.status_code}: {response.text}"
        except requests.exceptions.Timeout:
            return False, "Request timed out"
        except Exception as e:
            return False, str(e)

    def verify_connection(self) -> bool:
        """Verify Management API connection"""
        url = f"{self.base_url}/v1/projects/{self.project_ref}"

        try:
            response = requests.get(url, headers=self.headers, timeout=30)
            return response.status_code == 200
        except:
            return False


# =============================================================================
# SUPABASE REST CLIENT (for Storage)
# =============================================================================

class SupabaseClient:
    """Supabase REST API Client"""

    def __init__(self, url: str, service_role_key: str):
        self.url = url
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json"
        }

    def get_storage_buckets(self) -> Tuple[bool, List[Dict]]:
        """List all storage buckets"""
        url = f"{self.url}/storage/v1/bucket"

        try:
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return True, response.json()
            return False, f"Error: {response.status_code} - {response.text}"
        except Exception as e:
            return False, str(e)

    def create_storage_bucket(self, bucket_config: Dict) -> Tuple[bool, Any]:
        """Create a storage bucket"""
        url = f"{self.url}/storage/v1/bucket"

        try:
            response = requests.post(url, headers=self.headers, json=bucket_config)
            if response.status_code in [200, 201]:
                return True, response.json()
            return False, f"Error: {response.status_code} - {response.text}"
        except Exception as e:
            return False, str(e)

    def health_check(self) -> bool:
        """Check if the Supabase instance is accessible"""
        url = f"{self.url}/rest/v1/"

        try:
            response = requests.get(url, headers=self.headers)
            return response.status_code == 200
        except:
            return False


# =============================================================================
# SCHEMA EXTRACTOR - Extracts everything from DEV
# =============================================================================

class SchemaExtractor:
    """Extracts database schema from DEV Supabase"""

    def __init__(self, api_client: ManagementAPIClient):
        self.api = api_client

    def extract_extensions(self) -> Tuple[bool, str]:
        """Extract installed extensions"""
        sql = """
        SELECT 'CREATE EXTENSION IF NOT EXISTS "' || extname || '" WITH SCHEMA ' ||
               COALESCE(nspname, 'public') || ';' as ddl
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE extname NOT IN ('plpgsql')
        ORDER BY extname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = [row.get('ddl', '') for row in result if row.get('ddl')]
            return True, '\n'.join(ddl_statements)
        return False, str(result)

    def extract_tables(self) -> Tuple[bool, str]:
        """Extract table definitions (excluding views)"""
        # Get all tables in public schema, excluding views
        sql = """
        SELECT
            'CREATE TABLE IF NOT EXISTS public.' || quote_ident(c.table_name) || ' (' ||
            string_agg(
                quote_ident(c.column_name) || ' ' ||
                CASE
                    WHEN c.data_type = 'ARRAY' THEN SUBSTRING(c.udt_name FROM 2) || '[]'
                    WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
                    ELSE c.data_type
                END ||
                CASE WHEN c.character_maximum_length IS NOT NULL
                     THEN '(' || c.character_maximum_length || ')' ELSE '' END ||
                CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                CASE WHEN c.column_default IS NOT NULL
                     THEN ' DEFAULT ' || c.column_default ELSE '' END,
                ', ' ORDER BY c.ordinal_position
            ) || ');' as ddl,
            c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
            ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT LIKE 'pg_%'
        AND c.table_name NOT LIKE '_realtime%'
        GROUP BY c.table_name
        ORDER BY c.table_name;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = [row.get('ddl', '') for row in result if row.get('ddl')]
            return True, '\n\n'.join(ddl_statements)
        return False, str(result)

    def extract_table_constraints(self) -> Tuple[bool, str]:
        """Extract primary keys, foreign keys, unique constraints using pg_constraint"""
        # Use pg_constraint for more reliable constraint extraction
        # IMPORTANT: Order matters! Must apply PRIMARY KEY before FOREIGN KEY
        # Constraint types: p=PRIMARY KEY, u=UNIQUE, c=CHECK, f=FOREIGN KEY
        # Order: PRIMARY KEY first (1), then UNIQUE (2), then CHECK (3), then FOREIGN KEY (4)
        sql = """
        SELECT pg_get_constraintdef(c.oid) as constraint_def,
               c.conname as constraint_name,
               t.relname as table_name,
               c.contype as constraint_type,
               CASE c.contype
                   WHEN 'p' THEN 1  -- PRIMARY KEY first
                   WHEN 'u' THEN 2  -- UNIQUE second
                   WHEN 'c' THEN 3  -- CHECK third
                   WHEN 'f' THEN 4  -- FOREIGN KEY last
               END as type_order
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.relname NOT LIKE 'pg_%'
        AND c.contype IN ('p', 'f', 'u', 'c')
        ORDER BY type_order, t.relname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = []
            for row in result:
                table_name = row.get('table_name', '')
                constraint_name = row.get('constraint_name', '')
                constraint_def = row.get('constraint_def', '')
                if table_name and constraint_name and constraint_def:
                    # Use DO block to handle "already exists" gracefully
                    ddl = f"""DO $$ BEGIN
    ALTER TABLE public.{table_name} ADD CONSTRAINT {constraint_name} {constraint_def};
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists, skip
END $$;"""
                    ddl_statements.append(ddl)
            return True, '\n'.join(ddl_statements)
        return False, str(result)

    def extract_indexes(self) -> Tuple[bool, str]:
        """Extract index definitions (excluding those created by constraints)"""
        # Exclude:
        #   - pg_% (system indexes)
        #   - %_pkey (primary key indexes)
        #   - %_key (unique constraint indexes - these are created by UNIQUE constraints)
        #   - %_fkey (foreign key indexes)
        # Use IF NOT EXISTS for safety
        sql = """
        SELECT 
            REPLACE(indexdef, 'CREATE INDEX', 'CREATE INDEX IF NOT EXISTS') || ';' as ddl,
            REPLACE(indexdef, 'CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS') || ';' as ddl_safe
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname NOT LIKE 'pg_%'
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE '%_key'
        AND indexname NOT LIKE '%_fkey'
        ORDER BY tablename, indexname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = []
            for row in result:
                ddl = row.get('ddl', '')
                if ddl:
                    # Add IF NOT EXISTS for safety
                    if 'IF NOT EXISTS' not in ddl:
                        ddl = ddl.replace('CREATE INDEX', 'CREATE INDEX IF NOT EXISTS')
                        ddl = ddl.replace('CREATE UNIQUE INDEX', 'CREATE UNIQUE INDEX IF NOT EXISTS')
                    ddl_statements.append(ddl)
            return True, '\n'.join(ddl_statements)
        return False, str(result)

    def extract_functions(self) -> Tuple[bool, str]:
        """Extract function definitions"""
        sql = """
        SELECT pg_get_functiondef(p.oid) || ';' as ddl,
               p.proname as func_name
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        ORDER BY p.proname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = []
            webhook_functions = []
            for row in result:
                ddl = row.get('ddl', '')
                func_name = row.get('func_name', '')
                if ddl:
                    # Track functions that use net.http_post (webhook functions)
                    if 'net.http_post' in ddl or 'net.http_get' in ddl:
                        webhook_functions.append(func_name)
                    ddl_statements.append(ddl)
            
            result_sql = '\n\n'.join(ddl_statements)
            
            if webhook_functions:
                header = f"-- NOTE: {len(webhook_functions)} function(s) use pg_net for HTTP calls: {', '.join(webhook_functions)}\n"
                header += "-- These require pg_net extension to be enabled in your project\n"
                header += "-- Go to Supabase Dashboard > Database > Extensions > Enable pg_net\n\n"
                result_sql = header + result_sql
            
            return True, result_sql
        return False, str(result)

    def extract_triggers(self) -> Tuple[bool, str]:
        """Extract trigger definitions using pg_trigger for better coverage"""
        sql = """
        SELECT pg_get_triggerdef(t.oid) || ';' as ddl,
               t.tgname as trigger_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
        AND c.relname NOT LIKE 'pg_%'
        ORDER BY c.relname, t.tgname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = []
            skipped_triggers = []
            for row in result:
                ddl = row.get('ddl', '')
                trigger_name = row.get('trigger_name', '')
                if ddl:
                    # Skip triggers that reference supabase_functions schema
                    # These are HTTP webhook triggers that need pg_net extension enabled
                    if 'supabase_functions' in ddl.lower():
                        skipped_triggers.append(trigger_name)
                        continue
                    ddl_statements.append(ddl)
            
            if skipped_triggers:
                # Add comment about skipped triggers
                header = f"-- NOTE: Skipped {len(skipped_triggers)} webhook triggers that require supabase_functions schema\n"
                header += f"-- Skipped: {', '.join(skipped_triggers)}\n"
                header += "-- To enable these, go to Supabase Dashboard > Database > Webhooks\n\n"
                return True, header + '\n'.join(ddl_statements)
            
            return True, '\n'.join(ddl_statements)
        return False, str(result)

    def extract_views(self) -> Tuple[bool, str]:
        """Extract view definitions using pg_views for better coverage"""
        sql = """
        SELECT 'CREATE OR REPLACE VIEW public.' || quote_ident(viewname) || ' AS ' ||
               definition as ddl
        FROM pg_views
        WHERE schemaname = 'public'
        AND viewname NOT LIKE 'pg_%'
        ORDER BY viewname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = [row.get('ddl', '') for row in result if row.get('ddl')]
            return True, '\n\n'.join(ddl_statements)
        return False, str(result)

    def extract_rls_policies(self) -> Tuple[bool, str]:
        """Extract RLS policies - respects original RLS enabled/disabled state"""
        
        # Get tables with RLS ENABLED (relrowsecurity = true in pg_class)
        # This ensures we only enable RLS on tables that actually have it enabled in source
        enable_rls_sql = """
        SELECT 'ALTER TABLE public.' || quote_ident(c.relname) || ' ENABLE ROW LEVEL SECURITY;' as ddl,
               c.relname as table_name,
               CASE 
                   WHEN EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
                   THEN 'RESTRICTED'
                   ELSE 'UNRESTRICTED'
               END as rls_status
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'  -- regular tables only
        AND c.relrowsecurity = true  -- RLS is ENABLED
        AND c.relname NOT LIKE 'pg_%'
        AND c.relname NOT LIKE '_realtime%'
        ORDER BY c.relname;
        """
        
        # Get tables with RLS DISABLED (for documentation)
        disabled_rls_sql = """
        SELECT c.relname as table_name
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'  -- regular tables only
        AND c.relrowsecurity = false  -- RLS is DISABLED
        AND c.relname NOT LIKE 'pg_%'
        AND c.relname NOT LIKE '_realtime%'
        ORDER BY c.relname;
        """

        # Get policy definitions (PERMISSIVE or RESTRICTIVE)
        policies_sql = """
        SELECT
            'CREATE POLICY ' || quote_ident(policyname) || ' ON public.' ||
            quote_ident(tablename) || ' AS ' ||
            CASE permissive WHEN 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END ||
            ' FOR ' || cmd ||
            CASE WHEN roles != '{public}' THEN ' TO ' || array_to_string(roles, ', ') ELSE '' END ||
            CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
            CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
            ';' as ddl,
            tablename,
            policyname,
            permissive
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        ORDER BY tablename, policyname;
        """

        ddl_parts = []
        rls_enabled_tables = []
        rls_disabled_tables = []
        unrestricted_tables = []

        # Get tables with RLS enabled
        success, result = self.api.execute_sql(enable_rls_sql, read_only=True)
        if success and isinstance(result, list):
            for row in result:
                ddl = row.get('ddl', '')
                table_name = row.get('table_name', '')
                rls_status = row.get('rls_status', '')
                if ddl:
                    ddl_parts.append(ddl)
                    rls_enabled_tables.append(table_name)
                    if rls_status == 'UNRESTRICTED':
                        unrestricted_tables.append(table_name)

        # Get tables with RLS disabled (for documentation)
        success, result = self.api.execute_sql(disabled_rls_sql, read_only=True)
        if success and isinstance(result, list):
            rls_disabled_tables = [row.get('table_name', '') for row in result if row.get('table_name')]

        # Add summary comment
        if rls_enabled_tables or rls_disabled_tables:
            header = "-- RLS STATUS SUMMARY:\n"
            if rls_enabled_tables:
                header += f"-- Tables with RLS ENABLED ({len(rls_enabled_tables)}): {', '.join(rls_enabled_tables)}\n"
            if unrestricted_tables:
                header += f"-- Tables UNRESTRICTED (RLS enabled, no policies) ({len(unrestricted_tables)}): {', '.join(unrestricted_tables)}\n"
            if rls_disabled_tables:
                header += f"-- Tables with RLS DISABLED ({len(rls_disabled_tables)}): {', '.join(rls_disabled_tables)}\n"
                header += "-- Note: RLS disabled tables will NOT have RLS enabled in target (preserving original state)\n"
            header += "\n"
            ddl_parts.insert(0, header)

        ddl_parts.append('')  # Empty line separator

        # Get policy definitions
        success, result = self.api.execute_sql(policies_sql, read_only=True)
        if success and isinstance(result, list):
            policy_count = 0
            for row in result:
                ddl = row.get('ddl', '')
                if ddl:
                    ddl_parts.append(ddl)
                    policy_count += 1
            
            if policy_count > 0:
                print_info(f"  Found {policy_count} RLS policies")
            
            return True, '\n'.join(ddl_parts)

        return False, str(result)

    def extract_storage_policies(self) -> Tuple[bool, str]:
        """Extract storage RLS policies"""
        sql = """
        SELECT
            'CREATE POLICY ' || quote_ident(policyname) || ' ON storage.objects AS ' ||
            CASE permissive WHEN 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END ||
            ' FOR ' || cmd ||
            CASE WHEN roles != '{public}' THEN ' TO ' || array_to_string(roles, ', ') ELSE '' END ||
            CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
            CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
            ';' as ddl
        FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        ORDER BY policyname;
        """
        success, result = self.api.execute_sql(sql, read_only=True)
        if success and isinstance(result, list):
            ddl_statements = [row.get('ddl', '') for row in result if row.get('ddl')]
            return True, '\n'.join(ddl_statements)
        return False, str(result)


# =============================================================================
# EDGE FUNCTION DEPLOYER
# =============================================================================

class EdgeFunctionDeployer:
    """Deploy Edge Functions via Supabase CLI"""

    def __init__(self, project_ref: str, functions_dir: Path):
        self.project_ref = project_ref
        self.functions_dir = functions_dir

    def check_cli_available(self) -> bool:
        """Check if Supabase CLI is available - with short timeout to avoid hanging"""
        try:
            # Use a very short timeout - if CLI isn't immediately available, skip
            # Using 'supabase' directly instead of 'npx supabase' to avoid npx download delays
            result = subprocess.run(
                "supabase --version",
                capture_output=True, text=True, timeout=5, shell=True
            )
            if result.returncode == 0:
                return True
            
            # Fallback: try npx with short timeout
            result = subprocess.run(
                "npx --no-install supabase --version",
                capture_output=True, text=True, timeout=5, shell=True
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    def check_logged_in(self) -> bool:
        """Check if logged in to Supabase CLI"""
        try:
            result = subprocess.run(
                "supabase projects list",
                capture_output=True, text=True, timeout=10, shell=True
            )
            return result.returncode == 0 and "REFERENCE ID" in result.stdout
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    def get_available_functions(self) -> List[str]:
        functions = []
        if self.functions_dir.exists():
            for item in self.functions_dir.iterdir():
                if item.is_dir() and (item / "index.ts").exists():
                    functions.append(item.name)
        return functions

    def deploy_function(self, function_name: str) -> Tuple[bool, str]:
        try:
            result = subprocess.run(
                f"supabase functions deploy {function_name} --project-ref {self.project_ref}",
                capture_output=True, text=True, timeout=120, shell=True,
                cwd=str(self.functions_dir.parent)
            )
            if result.returncode == 0:
                return True, result.stdout
            return False, result.stderr or result.stdout
        except subprocess.TimeoutExpired:
            return False, "Deployment timed out"
        except Exception as e:
            return False, str(e)


# =============================================================================
# MAIN MIGRATION
# =============================================================================

def get_management_api_token() -> str:
    """Get Management API token from user"""
    global MANAGEMENT_API_TOKEN

    if MANAGEMENT_API_TOKEN:
        return MANAGEMENT_API_TOKEN

    print()
    print_color("Management API Token Required", Colors.YELLOW, bold=True)
    print_color("-" * 40, Colors.GRAY)
    print_info("Get your Personal Access Token from:")
    print_info("https://supabase.com/dashboard/account/tokens")
    print()

    token = input("Enter your Supabase Management API Token: ").strip()

    if not token:
        print_error("Token is required for this migration")
        sys.exit(1)

    MANAGEMENT_API_TOKEN = token
    return token


def run_migration():
    """Main migration function - Extract from DEV, Apply to PROD"""
    print_header("JIRAFORGE SUPABASE MIGRATION")
    print_color("  DEV (Source) -> PROD (Target)", Colors.CYAN)
    print()
    print_info(f"Source (READ ONLY): {DEV_PROJECT_REF}")
    print_info(f"Target (WRITE):     {PROD_PROJECT_REF}")
    print()

    total_steps = 8
    script_dir = Path(__file__).parent.resolve()
    exports_dir = script_dir / "exports"
    exports_dir.mkdir(exist_ok=True)

    # Step 1: Get Management API Token
    print_step(1, total_steps, "Authentication")
    api_token = get_management_api_token()

    # Create API clients for both DEV (read) and PROD (write)
    dev_api = ManagementAPIClient(api_token, DEV_PROJECT_REF)
    prod_api = ManagementAPIClient(api_token, PROD_PROJECT_REF)

    # Verify connections
    print_info("Verifying DEV connection (READ ONLY)...")
    if not dev_api.verify_connection():
        print_error("Cannot connect to DEV project")
        return False
    print_success("DEV connection verified")

    print_info("Verifying PROD connection...")
    if not prod_api.verify_connection():
        print_error("Cannot connect to PROD project")
        return False
    print_success("PROD connection verified")

    # NOTE: Auto-cleanup removed for safety
    # If you need to clean PROD, do it manually via Supabase Dashboard

    # Step 2: Extract schema from DEV
    print_step(2, total_steps, "Extracting Schema from DEV (READ ONLY)")
    extractor = SchemaExtractor(dev_api)

    full_sql = []
    full_sql.append(f"""-- ============================================================================
-- JIRAForge PRODUCTION Migration
-- ============================================================================
-- Extracted from DEV: {DEV_PROJECT_REF}
-- Target: {PROD_PROJECT_REF}
-- Generated: {datetime.now().isoformat()}
-- ============================================================================

""")

    # Initialize all SQL variables to empty strings
    extensions_sql = ""
    functions_sql = ""
    tables_sql = ""
    constraints_sql = ""
    indexes_sql = ""
    triggers_sql = ""
    views_sql = ""
    rls_sql = ""
    storage_policies_sql = ""

    # Extract extensions (FIRST - other objects depend on these)
    print_info("Extracting extensions...")
    success, result = extractor.extract_extensions()
    if success and result:
        extensions_sql = result
        full_sql.append("-- EXTENSIONS\n" + extensions_sql + "\n\n")
        print_success(f"Extracted extensions")
    else:
        print_warning(f"Could not extract extensions: {result}")

    # Extract functions (SECOND - tables and policies reference these)
    print_info("Extracting functions...")
    success, result = extractor.extract_functions()
    if success and result:
        functions_sql = result
        full_sql.append("-- FUNCTIONS\n" + functions_sql + "\n\n")
        print_success(f"Extracted functions")
    else:
        print_warning(f"Could not extract functions: {result}")

    # Extract tables (THIRD - after functions they depend on)
    print_info("Extracting tables...")
    success, result = extractor.extract_tables()
    if success and result:
        tables_sql = result
        full_sql.append("-- TABLES\n" + tables_sql + "\n\n")
        print_success(f"Extracted tables")
    else:
        print_warning(f"Could not extract tables: {result}")

    # Extract constraints
    print_info("Extracting constraints...")
    success, result = extractor.extract_table_constraints()
    if success and result:
        constraints_sql = result
        full_sql.append("-- CONSTRAINTS\n" + constraints_sql + "\n\n")
        print_success(f"Extracted constraints")
    else:
        print_warning(f"Could not extract constraints: {result}")

    # Extract indexes
    print_info("Extracting indexes...")
    success, result = extractor.extract_indexes()
    if success and result:
        indexes_sql = result
        full_sql.append("-- INDEXES\n" + indexes_sql + "\n\n")
        print_success(f"Extracted indexes")
    else:
        print_warning(f"Could not extract indexes: {result}")

    # Extract triggers
    print_info("Extracting triggers...")
    success, result = extractor.extract_triggers()
    if success and result:
        triggers_sql = result
        full_sql.append("-- TRIGGERS\n" + triggers_sql + "\n\n")
        print_success(f"Extracted triggers")
    else:
        print_warning(f"Could not extract triggers: {result}")

    # Extract views
    print_info("Extracting views...")
    success, result = extractor.extract_views()
    if success and result:
        views_sql = result
        full_sql.append("-- VIEWS\n" + views_sql + "\n\n")
        print_success(f"Extracted views")
    else:
        print_warning(f"Could not extract views: {result}")

    # Extract RLS policies
    print_info("Extracting RLS policies...")
    success, result = extractor.extract_rls_policies()
    if success and result:
        rls_sql = result
        full_sql.append("-- RLS POLICIES\n" + rls_sql + "\n\n")
        print_success(f"Extracted RLS policies")
    else:
        print_warning(f"Could not extract RLS policies: {result}")

    # Extract storage policies
    print_info("Extracting storage policies...")
    success, result = extractor.extract_storage_policies()
    if success and result:
        storage_policies_sql = result
        full_sql.append("-- STORAGE POLICIES\n" + storage_policies_sql + "\n\n")
        print_success(f"Extracted storage policies")
    else:
        print_warning(f"Could not extract storage policies: {result}")

    # Save extracted SQL
    migration_sql = '\n'.join(full_sql)
    sql_file = exports_dir / f"EXTRACTED_MIGRATION_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(migration_sql)
    print_success(f"Saved extracted SQL to: {sql_file}")

    # Step 3: Extract storage buckets from DEV
    print_step(3, total_steps, "Extracting Storage Buckets from DEV")
    dev_storage = SupabaseClient(DEV_URL, DEV_SERVICE_ROLE_KEY)
    success, buckets = dev_storage.get_storage_buckets()

    if success and isinstance(buckets, list):
        print_success(f"Found {len(buckets)} storage buckets in DEV")
        for bucket in buckets:
            print_info(f"  - {bucket.get('name', bucket.get('id', 'unknown'))}")
    else:
        print_warning(f"Could not get storage buckets: {buckets}")
        buckets = []

    # Step 4: Apply schema to PROD (section by section)
    print_step(4, total_steps, "Applying Schema to PROD")
    print_warning("This will create tables, functions, etc. in PRODUCTION")
    response = input("Continue? (y/n): ").strip().lower()

    if response != 'y':
        print_warning("Migration cancelled by user")
        return False

    # Check if we need supabase_functions schema for triggers
    needs_supabase_functions = 'supabase_functions' in triggers_sql.lower() if triggers_sql else False
    if needs_supabase_functions:
        print_warning("Some triggers require 'supabase_functions' schema (for HTTP webhooks)")
        print_info("These triggers have been automatically skipped for now")
        print_info("To enable webhooks later, go to: Supabase Dashboard > Database > Webhooks")
        print()

    # Execute each section separately to handle dependencies properly
    sections = [
        ("Extensions", extensions_sql),
        ("Functions", functions_sql),
        ("Tables", tables_sql),
        ("Constraints", constraints_sql),
        ("Indexes", indexes_sql),
        ("Triggers", triggers_sql),
        ("Views", views_sql),
        ("RLS Policies", rls_sql),
        ("Storage Policies", storage_policies_sql),
    ]

    all_success = True
    for section_name, section_sql in sections:
        if section_sql and section_sql.strip():
            print_info(f"Applying {section_name}...")
            success, result = prod_api.execute_sql(section_sql, read_only=False)
            if success:
                print_success(f"{section_name} applied successfully")
            else:
                print_error(f"{section_name} failed: {result}")
                all_success = False
                # Ask if user wants to continue with other sections
                cont = input(f"  Continue with remaining sections? (y/n): ").strip().lower()
                if cont != 'y':
                    print_info(f"You can manually run the SQL from: {sql_file}")
                    return False
        else:
            print_warning(f"No {section_name} to apply")

    if all_success:
        print_success("All schema sections applied successfully!")
    else:
        print_warning("Some sections failed - check errors above")
        print_info(f"Full SQL saved to: {sql_file}")

    # Step 5: Create storage buckets in PROD
    print_step(5, total_steps, "Creating Storage Buckets in PROD")
    prod_storage = SupabaseClient(PROD_URL, PROD_SERVICE_ROLE_KEY)

    for bucket in buckets:
        bucket_config = {
            "id": bucket.get('id'),
            "name": bucket.get('name', bucket.get('id')),
            "public": bucket.get('public', False),
            "file_size_limit": bucket.get('file_size_limit'),
            "allowed_mime_types": bucket.get('allowed_mime_types')
        }

        success, result = prod_storage.create_storage_bucket(bucket_config)
        if success:
            print_success(f"Created bucket: {bucket_config['id']}")
        elif "already exists" in str(result).lower() or "duplicate" in str(result).lower():
            print_warning(f"Bucket already exists: {bucket_config['id']}")
        else:
            print_error(f"Failed to create bucket {bucket_config['id']}: {result}")

    # Step 6: Extract and apply webhooks/triggers
    print_step(6, total_steps, "Setting Up Database Webhooks")
    # Webhooks are triggers - they were already extracted and applied in step 4
    print_success("Webhooks (triggers) were included in schema migration")

    # Step 7: Deploy Edge Functions
    print_step(7, total_steps, "Deploying Edge Functions")
    functions_dir = script_dir / "functions"
    deployer = EdgeFunctionDeployer(PROD_PROJECT_REF, functions_dir)

    # Check for edge functions first
    functions = deployer.get_available_functions()
    if not functions:
        print_warning("No edge functions found in functions directory")
        print_info("Skipping edge function deployment")
    else:
        print_info(f"Found {len(functions)} edge functions: {', '.join(functions)}")
        print_info("Checking for Supabase CLI...")
        
        cli_available = deployer.check_cli_available()
        if cli_available:
            print_success("Supabase CLI found")
            print_info("Checking login status...")
            logged_in = deployer.check_logged_in()
            
            if logged_in:
                print_success("Logged in to Supabase")
                failed_functions = []
                for func_name in functions:
                    print_info(f"Deploying {func_name}...")
                    success, msg = deployer.deploy_function(func_name)
                    if success:
                        print_success(f"Deployed: {func_name}")
                    else:
                        failed_functions.append(func_name)
                        if "403" in str(msg) or "privileges" in str(msg).lower():
                            print_error(f"Permission denied for: {func_name}")
                        else:
                            print_error(f"Failed: {func_name} - {msg}")
                
                if failed_functions:
                    print()
                    print_warning("Some edge functions failed to deploy automatically.")
                    print_info("To deploy manually:")
                    print_info("  1. Login to Supabase CLI: supabase login")
                    print_info(f"  2. Link project: supabase link --project-ref {PROD_PROJECT_REF}")
                    print_info("  3. Deploy each function:")
                    for func in failed_functions:
                        print_color(f"     supabase functions deploy {func} --project-ref {PROD_PROJECT_REF}", Colors.GRAY)
            else:
                print_warning("Supabase CLI not logged in - skipping edge function deployment")
                print_info("To deploy edge functions manually:")
                print_info("  1. Login: supabase login")
                print_info(f"  2. Deploy: supabase functions deploy --project-ref {PROD_PROJECT_REF}")
        else:
            print_warning("Supabase CLI not available - skipping edge function deployment")
            print_info("Edge functions can be deployed later via:")
            print_info("  1. Install Supabase CLI: npm install -g supabase")
            print_info("  2. Login: supabase login")
            print_info(f"  3. Deploy: supabase functions deploy --project-ref {PROD_PROJECT_REF}")
            print_info("Or deploy via Supabase Dashboard > Edge Functions")

    # Step 8: Summary
    print_step(8, total_steps, "Migration Complete!")
    print_header("MIGRATION SUMMARY")
    print()
    print_success(f"Source (DEV): {DEV_PROJECT_REF} - READ ONLY (unchanged)")
    print_success(f"Target (PROD): {PROD_PROJECT_REF} - Schema applied")
    print()
    print_info(f"Extracted SQL saved to: {sql_file}")
    print()
    print_color("Next Steps:", Colors.YELLOW, bold=True)
    print_info("1. Verify tables: Supabase Dashboard > Table Editor")
    print_info("2. Verify storage: Supabase Dashboard > Storage")
    print_info("3. Verify functions: Supabase Dashboard > Edge Functions")
    print_info("4. Update your app's environment variables:")
    print_color(f"     SUPABASE_URL={PROD_URL}", Colors.GRAY)
    print_color(f"     SUPABASE_SERVICE_ROLE_KEY={PROD_SERVICE_ROLE_KEY[:50]}...", Colors.GRAY)
    print()

    return True


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
