
================================================================================
ENVIRONMENT VARIABLES UPDATE GUIDE
================================================================================

Update these environment variables in your applications:

DESKTOP APP (python-desktop-app/.env):
--------------------------------------
SUPABASE_URL=https://jbxabkazpuuphpsahlfh.supabase.co
SUPABASE_ANON_KEY=<production-anon-key>

FORGE APP (forge-app/.env or manifest.yml):
-------------------------------------------
SUPABASE_URL: https://jbxabkazpuuphpsahlfh.supabase.co
SUPABASE_SERVICE_ROLE_KEY: <production-service-role-key>

AI SERVER (ai-server/.env):
---------------------------
SUPABASE_URL=https://jbxabkazpuuphpsahlfh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>

IMPORTANT NOTES:
----------------
1. Never commit service_role_key to version control
2. Use different credentials for dev vs production
3. Update all deployment configurations
4. Test connectivity before going live

================================================================================
