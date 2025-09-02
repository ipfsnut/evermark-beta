// Netlify function to sync season 3 vote totals from blockchain to database
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID || process.env.VITE_THIRDWEB_CLIENT_ID!
});

const VOTING_CONTRACT_ADDRESS = process.env.VITE_EVERMARK_VOTING_ADDRESS!;

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
    const { cycle = 3, max_evermarks = 100 } = JSON.parse(event.body || '{}');
    
    console.log(`Syncing season ${cycle} vote totals for up to ${max_evermarks} evermarks`);

    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    // Get all evermarks from database to check their vote totals
    const { data: evermarks, error: evermarksError } = await supabase
      .from('beta_evermarks')
      .select('token_id')
      .order('token_id', { ascending: true })
      .limit(max_evermarks);

    if (evermarksError) {
      console.error('Failed to fetch evermarks:', evermarksError);
      throw evermarksError;
    }

    console.log(`Found ${evermarks?.length || 0} evermarks to check`);

    // Clear existing leaderboard data for this cycle
    await supabase.from('leaderboard').delete().eq('cycle_id', cycle);

    const leaderboardData = [];
    let processedCount = 0;

    for (const evermark of evermarks || []) {
      try {
        // Get vote total for this evermark in this season
        const totalVotes = await readContract({
          contract: votingContract,
          method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
          params: [BigInt(cycle), BigInt(evermark.token_id)]
        }) as bigint;

        if (totalVotes > 0) {
          leaderboardData.push({
            evermark_id: evermark.token_id.toString(),
            cycle_id: cycle,
            total_votes: totalVotes.toString(),
            rank: 0, // Will be set after sorting
            updated_at: new Date().toISOString()
          });
        }

        processedCount++;
        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount}/${evermarks.length} evermarks`);
        }

      } catch (error) {
        console.warn(`Failed to get votes for evermark ${evermark.token_id}:`, error);
        // Continue processing other evermarks
      }
    }

    // Sort by total votes and assign ranks
    leaderboardData.sort((a, b) => {
      const aVotes = BigInt(a.total_votes);
      const bVotes = BigInt(b.total_votes);
      return bVotes > aVotes ? 1 : bVotes < aVotes ? -1 : 0;
    });

    // Assign ranks
    leaderboardData.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    console.log(`Found ${leaderboardData.length} evermarks with votes > 0`);

    // Insert leaderboard data in batches
    if (leaderboardData.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < leaderboardData.length; i += batchSize) {
        const batch = leaderboardData.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('leaderboard')
          .insert(batch);

        if (insertError) {
          console.error(`Failed to insert leaderboard batch ${i}-${i + batchSize}:`, insertError);
          throw insertError;
        }
      }
    }

    // Final verification
    const { data: finalCount } = await supabase
      .from('leaderboard')
      .select('count', { count: 'exact', head: true })
      .eq('cycle_id', cycle);

    const topEntries = leaderboardData.slice(0, 5).map(entry => ({
      evermark_id: entry.evermark_id,
      total_votes: entry.total_votes,
      rank: entry.rank
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully synced season ${cycle} vote totals`,
        stats: {
          evermarks_checked: processedCount,
          evermarks_with_votes: leaderboardData.length,
          total_entries_inserted: finalCount?.[0]?.count || 0,
          top_5_evermarks: topEntries
        },
        cycle: cycle
      })
    };

  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to sync season data',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}