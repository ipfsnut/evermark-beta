// netlify/functions/fix-leaderboard-rankings.ts - Fix specific ranking corruption
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handler(event: HandlerEvent, context: HandlerContext) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const cycle = 3; // Current cycle
    
    console.log(`Fixing leaderboard ranking corruption for cycle ${cycle}`);

    // 1. Get ALL current leaderboard entries
    const { data: allEntries, error: fetchError } = await supabase
      .from('leaderboard')
      .select('evermark_id, total_votes, rank')
      .eq('cycle_id', cycle);

    if (fetchError) {
      console.error('Failed to fetch leaderboard:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${allEntries?.length || 0} entries in leaderboard`);

    if (!allEntries || allEntries.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: `No leaderboard entries found for cycle ${cycle}`
        })
      };
    }

    // 2. Sort all entries by total votes (biggest first) 
    const sortedEntries = [...allEntries].sort((a, b) => {
      const aVotes = BigInt(a.total_votes);
      const bVotes = BigInt(b.total_votes);
      // Return negative if a > b (descending order)
      return bVotes > aVotes ? 1 : bVotes < aVotes ? -1 : 0;
    });

    // 3. Log the CURRENT state vs CORRECT state
    console.log('\n=== CURRENT (BROKEN) RANKINGS ===');
    allEntries
      .sort((a, b) => a.rank - b.rank)
      .forEach(entry => {
        console.log(`Current Rank ${entry.rank}: Evermark ${entry.evermark_id} - ${entry.total_votes} votes`);
      });

    console.log('\n=== CORRECT RANKINGS (SHOULD BE) ===');
    sortedEntries.forEach((entry, index) => {
      console.log(`Should be Rank ${index + 1}: Evermark ${entry.evermark_id} - ${entry.total_votes} votes`);
    });

    // 4. Assign correct ranks (simple - no ties handling for now)
    const correctedEntries = sortedEntries.map((entry, index) => ({
      evermark_id: entry.evermark_id,
      cycle_id: cycle,
      total_votes: entry.total_votes,
      rank: index + 1, // 1-based ranking
      updated_at: new Date().toISOString()
    }));

    // 5. Update the database with correct ranks
    console.log('\n=== UPDATING DATABASE ===');
    const { error: updateError } = await supabase
      .from('leaderboard')
      .upsert(correctedEntries, {
        onConflict: 'evermark_id,cycle_id'
      });

    if (updateError) {
      console.error('Failed to update rankings:', updateError);
      throw updateError;
    }

    // 6. Verify the fix worked
    const { data: verifyEntries } = await supabase
      .from('leaderboard')
      .select('evermark_id, total_votes, rank')
      .eq('cycle_id', cycle)
      .order('rank', { ascending: true });

    console.log('\n=== FIXED RANKINGS (VERIFICATION) ===');
    verifyEntries?.forEach(entry => {
      console.log(`Fixed Rank ${entry.rank}: Evermark ${entry.evermark_id} - ${entry.total_votes} votes`);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Fixed ${correctedEntries.length} leaderboard rankings for cycle ${cycle}`,
        before: allEntries.sort((a, b) => a.rank - b.rank).map(e => ({
          rank: e.rank,
          evermark_id: e.evermark_id,
          total_votes: e.total_votes
        })),
        after: correctedEntries.map(e => ({
          rank: e.rank,
          evermark_id: e.evermark_id,
          total_votes: e.total_votes
        }))
      })
    };

  } catch (error) {
    console.error('Fix rankings error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fix leaderboard rankings',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}