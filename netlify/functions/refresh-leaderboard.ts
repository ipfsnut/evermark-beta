// netlify/functions/refresh-leaderboard.ts - Fix leaderboard ranking inconsistencies
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
    const { cycle = 3 } = JSON.parse(event.body || '{}');
    
    console.log(`Refreshing leaderboard rankings for cycle ${cycle}`);

    // Get all current leaderboard entries for this cycle
    const { data: currentEntries, error: fetchError } = await supabase
      .from('leaderboard')
      .select('evermark_id, total_votes, rank')
      .eq('cycle_id', cycle);

    if (fetchError) {
      console.error('Failed to fetch current leaderboard:', fetchError);
      throw fetchError;
    }

    if (!currentEntries || currentEntries.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `No leaderboard entries found for cycle ${cycle}`,
          updated: 0
        })
      };
    }

    // Sort entries by total_votes (BigInt comparison)
    const sortedEntries = currentEntries.sort((a, b) => {
      const aVotes = BigInt(a.total_votes);
      const bVotes = BigInt(b.total_votes);
      return bVotes > aVotes ? 1 : bVotes < aVotes ? -1 : 0;
    });

    // Assign correct ranks (handle ties)
    let currentRank = 1;
    let previousVotes = '';
    
    const rankedEntries = sortedEntries.map((entry, index) => {
      // If votes are different from previous, update rank
      if (index > 0 && entry.total_votes !== previousVotes) {
        currentRank = index + 1;
      }
      
      previousVotes = entry.total_votes;
      
      return {
        ...entry,
        rank: currentRank
      };
    });

    // Batch update all entries with correct ranks
    const updates = rankedEntries.map(entry => ({
      evermark_id: entry.evermark_id,
      cycle_id: cycle,
      total_votes: entry.total_votes,
      rank: entry.rank,
      updated_at: new Date().toISOString()
    }));

    const { error: updateError } = await supabase
      .from('leaderboard')
      .upsert(updates);

    if (updateError) {
      console.error('Failed to update leaderboard rankings:', updateError);
      throw updateError;
    }

    // Log the corrected rankings
    console.log('Corrected leaderboard rankings:');
    rankedEntries.slice(0, 10).forEach(entry => {
      console.log(`Rank ${entry.rank}: Evermark ${entry.evermark_id} - ${entry.total_votes} votes`);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Leaderboard rankings refreshed for cycle ${cycle}`,
        updated: rankedEntries.length,
        top3: rankedEntries.slice(0, 3).map(e => ({
          rank: e.rank,
          evermark_id: e.evermark_id,
          total_votes: e.total_votes
        }))
      })
    };

  } catch (error) {
    console.error('Leaderboard refresh error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to refresh leaderboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}