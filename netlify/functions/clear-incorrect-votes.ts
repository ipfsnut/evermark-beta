// Function to clear incorrect vote records where users voted for their own evermarks
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

  try {
    const { cycle = 3 } = JSON.parse(event.body || '{}');
    
    console.log(`Clearing incorrect self-votes for cycle ${cycle}`);

    // Get all evermarks with their owners
    const { data: evermarks } = await supabase
      .from('beta_evermarks')
      .select('token_id, owner');

    if (!evermarks) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No evermarks found' })
      };
    }

    // For each evermark, delete votes where the voter is the owner
    let deletedCount = 0;
    
    for (const evermark of evermarks) {
      if (!evermark.owner) continue;
      
      // Delete votes where user voted for their own evermark
      const { data, error } = await supabase
        .from('votes')
        .delete()
        .eq('cycle', cycle)
        .eq('evermark_id', evermark.token_id.toString())
        .eq('user_id', evermark.owner.toLowerCase())
        .select();
      
      if (data && data.length > 0) {
        deletedCount += data.length;
        console.log(`Deleted ${data.length} self-votes for evermark ${evermark.token_id} by ${evermark.owner}`);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Cleared ${deletedCount} incorrect self-vote records`,
        cycle: cycle
      })
    };

  } catch (error) {
    console.error('Clear votes error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to clear incorrect votes',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}