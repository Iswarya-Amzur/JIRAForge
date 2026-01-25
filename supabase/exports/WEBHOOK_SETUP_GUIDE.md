
================================================================================
DATABASE WEBHOOKS SETUP GUIDE
================================================================================

After running the SQL migration, you need to set up Database Webhooks manually
in the Supabase Dashboard.

Project URL: https://jbxabkazpuuphpsahlfh.supabase.co

STEP 1: Navigate to Database Webhooks
--------------------------------------
1. Go to: https://jbxabkazpuuphpsahlfh.supabase.co/project/jbxabkazpuuphpsahlfh/database/hooks
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
