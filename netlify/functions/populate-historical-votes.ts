// Simple function to create representative vote records from current leaderboard totals
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import type { VoteRecord } from '../../shared/services/DatabaseTypes';

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
    
    console.log(`Creating representative vote records for cycle ${cycle}`);

    // Get leaderboard data (vote totals per evermark)
    const { data: leaderboard } = await supabase
      .from('leaderboard')
      .select('evermark_id, total_votes')
      .eq('cycle_id', cycle);

    if (!leaderboard || leaderboard.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No leaderboard data found. Run sync-season3-totals first.' })
      };
    }

    // Clear existing vote records for this cycle
    await supabase.from('votes').delete().eq('cycle', cycle);

    const voteRecords: any[] = [];
    
    for (const entry of leaderboard) {
      // Get the evermark owner to create a representative vote record
      const { data: evermark } = await supabase
        .from('beta_evermarks')
        .select('owner')
        .eq('token_id', parseInt(entry.evermark_id))
        .single();

      if (evermark?.owner) {
        // Create a representative vote record showing the owner "voted" for their own evermark
        // This is a simplification - in reality there were multiple voters
        voteRecords.push({
          user_id: evermark.owner.toLowerCase(),
          evermark_id: entry.evermark_id,
          cycle: cycle,
          amount: entry.total_votes,
          action: 'delegate',
          metadata: {
            note: 'Representative record from historical totals',
            original_total: entry.total_votes
          }
        });
      }
    }

    // Insert representative vote records
    if (voteRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('votes')
        .insert(voteRecords as any);

      if (insertError) {
        console.error('Failed to insert vote records:', insertError);
        throw insertError;
      }
    }

    // Verify insertion
    const { data: finalCount } = await supabase
      .from('votes')
      .select('count', { count: 'exact', head: true })
      .eq('cycle', cycle);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Created ${voteRecords.length} representative vote records for cycle ${cycle}`,
        stats: {
          leaderboard_entries: leaderboard.length,
          vote_records_created: voteRecords.length,
          final_vote_count: finalCount?.[0]?.count || 0,
          cycle: cycle
        }
      })
    };

  } catch (error) {
    console.error('Historical vote population error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to populate historical votes',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}