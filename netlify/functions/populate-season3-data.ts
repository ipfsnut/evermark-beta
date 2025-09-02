// Netlify function to populate votes and leaderboard tables with season 3 blockchain data
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, createThirdwebClient, getContractEvents, prepareEvent } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';
import type { VoteRecord } from '../../shared/services/DatabaseTypes';

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
    const { cycle = 3, dry_run = false } = JSON.parse(event.body || '{}');
    
    console.log(`Starting season ${cycle} data population (dry_run: ${dry_run})`);

    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    // Get all voting events for the season
    console.log('Fetching voting events from blockchain...');
    
    // Get vote events - we'll need to determine the correct event signature
    const voteEvents = await getContractEvents({
      contract: votingContract,
      events: [
        prepareEvent({
          signature: "event VoteCast(address indexed voter, uint256 indexed evermarkId, uint256 amount)"
        })
      ],
      fromBlock: 0n, // Start from beginning or specific block for season 3
      toBlock: "latest"
    }) as any[];

    console.log(`Found ${voteEvents.length} vote events`);

    if (dry_run) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Dry run completed',
          stats: {
            total_events: voteEvents.length,
            cycle: cycle
          },
          sample_events: voteEvents.slice(0, 5).map(event => ({
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            args: event.args
          }))
        })
      };
    }

    // Clear existing data for this cycle
    console.log(`Clearing existing data for cycle ${cycle}`);
    await supabase.from('votes').delete().eq('cycle', cycle);
    await supabase.from('leaderboard').delete().eq('cycle_id', cycle);

    // Process vote events and insert into votes table
    const voteInserts: VoteRecord[] = [];
    const evermarkVoteTotals: Record<string, bigint> = {};

    for (const event of voteEvents) {
      // Parse event data - adjust field names based on actual contract events
      const { voter, evermarkId, amount } = event.args as any;
      
      const voteRecord = {
        user_id: voter.toLowerCase(),
        evermark_id: evermarkId.toString(),
        cycle: cycle,
        amount: amount.toString(),
        action: 'delegate',
        metadata: {
          transaction_hash: event.transactionHash,
          block_number: event.blockNumber.toString()
        }
      };

      voteInserts.push(voteRecord as VoteRecord);

      // Track totals for leaderboard
      const evermarkIdStr = evermarkId.toString();
      if (!evermarkVoteTotals[evermarkIdStr]) {
        evermarkVoteTotals[evermarkIdStr] = BigInt(0);
      }
      evermarkVoteTotals[evermarkIdStr] += BigInt(amount.toString());
    }

    // Batch insert votes
    if (voteInserts.length > 0) {
      console.log(`Inserting ${voteInserts.length} vote records`);
      const { error: votesError } = await supabase
        .from('votes')
        .insert(voteInserts);

      if (votesError) {
        console.error('Failed to insert votes:', votesError);
        throw votesError;
      }
    }

    // Create leaderboard entries
    const leaderboardInserts = Object.entries(evermarkVoteTotals)
      .sort(([, a], [, b]) => b > a ? 1 : b < a ? -1 : 0) // Sort by votes descending
      .map(([evermarkId, totalVotes], index) => ({
        evermark_id: evermarkId,
        cycle_id: cycle,
        total_votes: totalVotes.toString(),
        rank: index + 1,
        updated_at: new Date().toISOString()
      }));

    // Insert leaderboard data
    if (leaderboardInserts.length > 0) {
      console.log(`Inserting ${leaderboardInserts.length} leaderboard entries`);
      const { error: leaderboardError } = await supabase
        .from('leaderboard')
        .insert(leaderboardInserts);

      if (leaderboardError) {
        console.error('Failed to insert leaderboard:', leaderboardError);
        throw leaderboardError;
      }
    }

    // Verify data was inserted correctly
    const { data: finalVoteCount } = await supabase
      .from('votes')
      .select('count', { count: 'exact', head: true })
      .eq('cycle', cycle);

    const { data: finalLeaderboardCount } = await supabase
      .from('leaderboard')
      .select('count', { count: 'exact', head: true })
      .eq('cycle_id', cycle);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Successfully populated season ${cycle} data`,
        stats: {
          events_processed: voteEvents.length,
          votes_inserted: voteInserts.length,
          leaderboard_entries: leaderboardInserts.length,
          final_vote_count: finalVoteCount?.[0]?.count || 0,
          final_leaderboard_count: finalLeaderboardCount?.[0]?.count || 0
        },
        cycle: cycle
      })
    };

  } catch (error) {
    console.error('Population error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to populate season data',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}