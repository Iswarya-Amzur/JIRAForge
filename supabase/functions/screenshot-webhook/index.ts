// Screenshot Webhook Edge Function
// This function is triggered when a new screenshot is uploaded
// It notifies the AI Analysis Server to process the screenshot

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScreenshotPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    id: string;
    user_id: string;
    organization_id: string;  // Multi-tenancy support
    timestamp: string;
    storage_url: string;
    storage_path: string;
    window_title?: string;
    application_name?: string;
    status: string;
    // Event-based tracking fields
    duration_seconds?: number;
    start_time?: string;
    end_time?: string;
  };
  old_record?: any;
}

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

    const payload: ScreenshotPayload = await req.json();

    console.log('Screenshot webhook triggered:', {
      type: payload.type,
      screenshotId: payload.record.id,
      userId: payload.record.user_id
    });

    // Only process new screenshots
    if (payload.type === 'INSERT' && payload.record.status === 'pending') {
      const AI_SERVER_URL = Deno.env.get('AI_SERVER_URL');

      if (!AI_SERVER_URL) {
        throw new Error('AI_SERVER_URL environment variable not set');
      }

      // Update screenshot status to processing
      const { error: updateError } = await supabaseClient
        .from('screenshots')
        .update({ status: 'processing' })
        .eq('id', payload.record.id);

      if (updateError) {
        console.error('Error updating screenshot status:', updateError);
      }

      // Fetch user's assigned Jira issues from cache
      // Cache is updated periodically by Forge app's updateUserAssignedIssuesCache resolver
      const { data: cachedIssues, error: cacheError } = await supabaseClient
        .from('user_jira_issues_cache')
        .select('issue_key, summary, status, project_key, issue_type')
        .eq('user_id', payload.record.user_id)
        .order('updated_at', { ascending: false })
        .limit(50);

      let userAssignedIssues: any[] = [];
      
      if (cachedIssues && cachedIssues.length > 0) {
        // Format cached issues for AI server
        userAssignedIssues = cachedIssues.map(issue => ({
          key: issue.issue_key,
          summary: issue.summary,
          status: issue.status,
          project: issue.project_key,
          issueType: issue.issue_type
        }));
        
        console.log(`Fetched ${userAssignedIssues.length} cached issues for user ${payload.record.user_id}`);
      } else {
        if (cacheError) {
          console.warn('Error fetching cached issues:', cacheError);
        } else {
          console.log('No cached issues found for user - cache may need to be updated');
        }
        // Continue with empty array - AI server will work without it but with lower accuracy
      }

      // Determine which Jira issues to use
      // Priority: Screenshot data (fresh at capture time) > Cache (may be stale)
      const screenshotIssues = payload.record.user_assigned_issues || [];
      const issuesForAnalysis = screenshotIssues.length > 0 
        ? screenshotIssues      // Prefer screenshot data (fetched fresh by desktop app)
        : userAssignedIssues;   // Fallback to cache if screenshot has no issues

      console.log(`Using ${screenshotIssues.length > 0 ? 'screenshot' : 'cache'} issues for analysis (${issuesForAnalysis.length} issues)`);

      // Notify AI Analysis Server
      try {
        const aiResponse = await fetch(`${AI_SERVER_URL}/api/analyze-screenshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('AI_SERVER_API_KEY')}`,
          },
          body: JSON.stringify({
            // Send the entire record (all fields from screenshots table)
            ...payload.record,
            // Use screenshot issues (fresh) with cache as fallback
            user_assigned_issues: issuesForAnalysis,
          }),
        });

        if (!aiResponse.ok) {
          throw new Error(`AI Server responded with status: ${aiResponse.status}`);
        }

        const aiResult = await aiResponse.json();
        console.log('AI Server notified successfully:', aiResult);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Screenshot queued for analysis',
            screenshot_id: payload.record.id
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      } catch (aiError) {
        console.error('Error notifying AI server:', aiError);

        // Check if it's a transient error (network, timeout) vs permanent error
        const errorMessage = String(aiError);
        const isTransientError = 
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('network') ||
          errorMessage.includes('timeout');

        if (isTransientError) {
          // Reset to pending for polling service to retry
          await supabaseClient
            .from('screenshots')
            .update({
              status: 'pending',
              metadata: { webhook_error: errorMessage, will_retry: true }
            })
            .eq('id', payload.record.id);
          
          console.log('Transient error - reset to pending for retry');
        } else {
          // Permanent error - mark as failed
          await supabaseClient
            .from('screenshots')
            .update({
              status: 'failed',
              metadata: { error: errorMessage }
            })
            .eq('id', payload.record.id);
        }

        throw aiError;
      }
    }

    // For non-INSERT events or already processed screenshots
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Event acknowledged but not processed',
        type: payload.type,
        status: payload.record.status
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in screenshot webhook:', error);

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
