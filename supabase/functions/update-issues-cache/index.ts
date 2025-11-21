// Update Issues Cache Edge Function
// This function can be called periodically (via cron or manually) to refresh the cache
// It calls the Forge app's updateUserAssignedIssuesCache resolver for each user

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active users
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, atlassian_account_id')
      .eq('is_active', true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active users found',
          updated: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${users.length} active users to update cache for`);

    // Note: This function would need to call Forge app's updateUserAssignedIssuesCache resolver
    // Since Forge apps don't expose HTTP endpoints directly, you have a few options:
    // 
    // Option 1: Call Forge app via webhook/HTTP if you set up an external endpoint
    // Option 2: Have users manually trigger cache update from Forge UI
    // Option 3: Use Supabase pg_cron to call a stored procedure that updates cache
    // Option 4: Have the Forge app call this function periodically via scheduled job
    
    // For now, this is a placeholder that logs what would be done
    const results = {
      total: users.length,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };

    // TODO: Implement actual cache update mechanism
    // This would involve:
    // 1. For each user, call Forge app's updateUserAssignedIssuesCache resolver
    // 2. Or have Forge app call this function with user context
    // 3. Or use a different mechanism based on your architecture

    console.log('Cache update would be triggered for users:', users.map(u => u.atlassian_account_id));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cache update process initiated',
        results: {
          total: results.total,
          note: 'Actual cache update requires Forge app integration - see implementation notes'
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in update issues cache function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

