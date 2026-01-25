
================================================================================
EDGE FUNCTIONS DEPLOYMENT GUIDE
================================================================================

After setting up the database schema and webhooks, deploy the Edge Functions.

Project: jbxabkazpuuphpsahlfh
Functions Directory: C:\ATG\jira3\JIRAForge\supabase\functions

PREREQUISITES:
--------------
1. Install Supabase CLI (if not already):
   npm install -g supabase

2. Login to Supabase:
   supabase login

3. Link to production project:
   cd C:\ATG\jira3\JIRAForge\supabase
   supabase link --project-ref jbxabkazpuuphpsahlfh

DEPLOYMENT COMMANDS:
--------------------
# Deploy all edge functions at once:
supabase functions deploy screenshot-webhook --project-ref jbxabkazpuuphpsahlfh
supabase functions deploy document-webhook --project-ref jbxabkazpuuphpsahlfh
supabase functions deploy update-issues-cache --project-ref jbxabkazpuuphpsahlfh

# Or deploy all functions in the directory:
supabase functions deploy --project-ref jbxabkazpuuphpsahlfh

SET FUNCTION SECRETS:
---------------------
# Set required environment variables for edge functions:
supabase secrets set AI_SERVER_URL=<your-ai-server-url> --project-ref jbxabkazpuuphpsahlfh
supabase secrets set AI_SERVER_API_KEY=<your-ai-api-key> --project-ref jbxabkazpuuphpsahlfh

VERIFY DEPLOYMENT:
------------------
# List deployed functions:
supabase functions list --project-ref jbxabkazpuuphpsahlfh

# Test a function:
curl -X POST 'https://jbxabkazpuuphpsahlfh.supabase.co/functions/v1/screenshot-webhook' \
  -H "Authorization: Bearer " \
  -H "Content-Type: application/json" \
  -d '{"type": "test"}'

================================================================================
