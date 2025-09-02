// Netlify function to get user's voting history from the votes table
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
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

export async function handler(event: HandlerEvent, context: HandlerContext) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { user_id, cycle } = JSON.parse(event.body || '{}');

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'user_id is required' })
      };
    }

    const currentCycle = cycle || 3; // Default to season 3

    console.log(`Getting user votes for ${user_id} in cycle ${currentCycle}`);

    // Query votes table for user's supported evermarks
    const { data: userVotes, error } = await supabase
      .from('votes')
      .select('evermark_id, amount, created_at')
      .eq('user_id', user_id.toLowerCase())
      .eq('cycle', currentCycle)
      .eq('action', 'delegate'); // Only delegation votes count as "support"

    if (error) {
      console.error('Votes query error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to query votes',
          details: error.message 
        })
      };
    }

    console.log(`Found ${userVotes?.length || 0} votes for user ${user_id}`);

    // Return distinct evermark IDs (user might have multiple votes per evermark)
    const supportedEvermarkIds = [...new Set(userVotes?.map(vote => vote.evermark_id) || [])];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: userVotes || [],
        supportedEvermarkIds,
        user_id,
        cycle: currentCycle,
        total: supportedEvermarkIds.length
      })
    };

  } catch (error) {
    console.error('Get user votes error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}