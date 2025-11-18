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
    timestamp: string;
    storage_url: string;
    storage_path: string;
    window_title?: string;
    application_name?: string;
    status: string;
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

      // Notify AI Analysis Server
      try {
        const aiResponse = await fetch(`${AI_SERVER_URL}/analyze-screenshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('AI_SERVER_API_KEY')}`,
          },
          body: JSON.stringify({
            screenshot_id: payload.record.id,
            user_id: payload.record.user_id,
            storage_url: payload.record.storage_url,
            storage_path: payload.record.storage_path,
            window_title: payload.record.window_title,
            application_name: payload.record.application_name,
            timestamp: payload.record.timestamp,
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

        // Update screenshot status to failed
        await supabaseClient
          .from('screenshots')
          .update({
            status: 'failed',
            metadata: { error: String(aiError) }
          })
          .eq('id', payload.record.id);

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
