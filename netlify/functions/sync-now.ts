// netlify/functions/sync-now.ts - Manual sync trigger
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('🔄 Manual sync triggered');
    
    // Trigger immediate sync of pending evermarks
    const { data: pendingEvermarks } = await supabase
      .from('evermarks')
      .select('token_id, title')
      .eq('verified', false)
      .limit(5);

    let processed = 0;
    
    for (const evermark of pendingEvermarks || []) {
      // Simulate verification process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await supabase
        .from('evermarks')
        .update({
          verified: true,
          last_synced_at: new Date().toISOString()
        })
        .eq('token_id', evermark.token_id);
      
      processed++;
    }

    // Log the manual sync
    await supabase
      .from('sync_logs')
      .insert([{
        sync_type: 'manual',
        synced_count: processed,
        completed_at: new Date().toISOString(),
        status: 'success',
      }]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Manual sync completed`,
        processed,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('Manual sync failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};