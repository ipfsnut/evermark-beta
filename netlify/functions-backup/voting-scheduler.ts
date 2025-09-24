import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const { httpMethod } = event;

  try {
    if (httpMethod === 'POST') {
      // This function can be called by a cron job or webhook to periodically sync voting data
      console.log('🔄 Starting scheduled voting data sync...');

      // Get all evermarks that need cache refresh (older than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: staleEntries, error: staleError } = await supabase
        .from('voting_cache')
        .select('evermark_id, cycle_number')
        .lt('last_updated', fiveMinutesAgo)
        .limit(50); // Limit to avoid overwhelming the system

      if (staleError) {
        throw new Error(`Failed to get stale cache entries: ${staleError.message}`);
      }

      if (!staleEntries || staleEntries.length === 0) {
        console.log('✅ No stale cache entries found');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            message: 'No sync needed - cache is fresh',
            processed: 0
          }),
        };
      }

      // Sync each stale entry by calling the voting-sync function
      const baseUrl = process.env.URL || 'http://localhost:8888';
      let processed = 0;

      for (const entry of staleEntries) {
        try {
          const syncUrl = `${baseUrl}/.netlify/functions/voting-sync?action=sync-evermark&evermark_id=${entry.evermark_id}&cycle=${entry.cycle_number}`;
          
          const response = await fetch(syncUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            processed++;
            console.log(`✅ Synced evermark ${entry.evermark_id} for cycle ${entry.cycle_number}`);
          } else {
            console.warn(`⚠️ Failed to sync evermark ${entry.evermark_id}:`, await response.text());
          }
        } catch (error) {
          console.warn(`⚠️ Error syncing evermark ${entry.evermark_id}:`, error);
        }

        // Small delay to avoid overwhelming the RPC
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`🔄 Scheduled sync completed: ${processed}/${staleEntries.length} entries updated`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: `Scheduled sync completed`,
          processed,
          total: staleEntries.length
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };

  } catch (error) {
    console.error('Voting scheduler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};