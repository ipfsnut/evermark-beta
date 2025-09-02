// Netlify function to update both votes and leaderboard tables after a vote
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
    const { 
      user_id, 
      evermark_id, 
      vote_amount, 
      transaction_hash, 
      cycle = 3 
    } = JSON.parse(event.body || '{}');

    if (!user_id || !evermark_id || !vote_amount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'user_id, evermark_id, and vote_amount are required' 
        })
      };
    }

    console.log(`Updating voting data for user ${user_id}, evermark ${evermark_id}, amount ${vote_amount}`);

    // 1. Insert/update votes table - use upsert to handle multiple votes
    const { error: voteError } = await supabase
      .from('votes')
      .upsert({
        user_id: user_id.toLowerCase(),
        evermark_id: evermark_id,
        cycle: cycle,
        amount: vote_amount.toString(),
        action: 'delegate',
        metadata: transaction_hash ? { transaction_hash } : {}
      }, {
        onConflict: 'user_id,evermark_id,cycle'
      });

    if (voteError) {
      console.error('Failed to insert vote:', voteError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to record vote',
          details: voteError.message 
        })
      };
    }

    // 2. Get updated total votes for this evermark from blockchain
    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    const totalVotes = await readContract({
      contract: votingContract,
      method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
      params: [BigInt(cycle), BigInt(evermark_id)]
    }) as bigint;

    // 3. Update leaderboard table
    // First, get current leaderboard to calculate new ranking
    const { data: currentLeaderboard } = await supabase
      .from('leaderboard')
      .select('evermark_id, total_votes, rank')
      .eq('cycle_id', cycle)
      .order('rank', { ascending: true });

    // Update or insert this evermark's entry
    const updatedLeaderboard = [...(currentLeaderboard || [])];
    const existingIndex = updatedLeaderboard.findIndex(l => l.evermark_id === evermark_id);

    if (existingIndex >= 0) {
      updatedLeaderboard[existingIndex].total_votes = totalVotes.toString();
    } else {
      updatedLeaderboard.push({
        evermark_id: evermark_id,
        total_votes: totalVotes.toString(),
        rank: 0 // Will be calculated
      });
    }

    // Re-sort by total_votes and assign new ranks
    updatedLeaderboard.sort((a, b) => {
      const aVotes = BigInt(a.total_votes);
      const bVotes = BigInt(b.total_votes);
      return bVotes > aVotes ? 1 : bVotes < aVotes ? -1 : 0;
    });

    // Assign new ranks
    updatedLeaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Update this evermark's leaderboard entry
    const newEntry = updatedLeaderboard.find(l => l.evermark_id === evermark_id);
    if (newEntry) {
      const { error: leaderboardError } = await supabase
        .from('leaderboard')
        .upsert({
          evermark_id: evermark_id,
          cycle_id: cycle,
          total_votes: totalVotes.toString(),
          rank: newEntry.rank,
          updated_at: new Date().toISOString()
        });

      if (leaderboardError) {
        console.error('Failed to update leaderboard:', leaderboardError);
        // Don't fail the entire request if leaderboard update fails
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Voting data updated successfully',
        data: {
          user_id,
          evermark_id,
          cycle,
          total_votes: totalVotes.toString(),
          rank: newEntry?.rank || 0
        }
      })
    };

  } catch (error) {
    console.error('Update voting data error:', error);
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