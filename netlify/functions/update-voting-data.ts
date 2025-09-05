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

    // 1. Upsert user vote record - handles both new votes and vote updates
    let voteError: any = null;
    
    // First, try to use upsert with onConflict (works if constraint exists)
    const { error: upsertError } = await supabase
      .from('votes')
      .upsert({
        user_id: user_id.toLowerCase(),
        evermark_id: evermark_id.toString(),
        cycle: cycle,
        amount: vote_amount.toString(),
        action: 'delegate',
        metadata: transaction_hash ? { transaction_hash } : {}
      }, {
        onConflict: 'user_id,evermark_id,cycle'
      });
    
    // If upsert failed due to missing constraint, use manual upsert logic
    if (upsertError && upsertError.code === '42P10') {
      console.log('Constraint not found, using manual upsert logic');
      
      // Try to find existing record first
      const { data: existing, error: selectError } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', user_id.toLowerCase())
        .eq('evermark_id', evermark_id.toString())
        .eq('cycle', cycle)
        .maybeSingle();

      if (selectError) {
        voteError = selectError;
      } else if (existing) {
        // Update existing record
        console.log(`Updating existing vote record for user ${user_id}, evermark ${evermark_id}`);
        const { error: updateError } = await supabase
          .from('votes')
          .update({
            amount: vote_amount.toString(),
            action: 'delegate',
            metadata: transaction_hash ? { transaction_hash } : {}
          })
          .eq('id', existing.id);
        voteError = updateError;
      } else {
        // Insert new record
        console.log(`Inserting new vote record for user ${user_id}, evermark ${evermark_id}`);
        const { error: insertError } = await supabase
          .from('votes')
          .insert({
            user_id: user_id.toLowerCase(),
            evermark_id: evermark_id.toString(),
            cycle: cycle,
            amount: vote_amount.toString(),
            action: 'delegate',
            metadata: transaction_hash ? { transaction_hash } : {},
            created_at: new Date().toISOString()
          });
        voteError = insertError;
      }
    } else {
      // Upsert worked or failed for other reasons
      voteError = upsertError;
    }

    if (voteError) {
      console.error('Failed to insert vote:', JSON.stringify(voteError, null, 2));
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to record vote',
          details: voteError.message,
          code: voteError.code,
          hint: voteError.hint,
          full_error: voteError
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

    // 2.5. Update leaderboard table (the actual cache system)
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

    // Update ALL leaderboard entries with correct ranks (not just the current one)
    const leaderboardUpdates = updatedLeaderboard.map(entry => ({
      evermark_id: entry.evermark_id,
      cycle_id: cycle,
      total_votes: entry.total_votes,
      rank: entry.rank,
      updated_at: new Date().toISOString()
    }));

    const { error: leaderboardError } = await supabase
      .from('leaderboard')
      .upsert(leaderboardUpdates, {
        onConflict: 'evermark_id,cycle_id'
      });

    if (leaderboardError) {
      console.error('Failed to update leaderboard:', leaderboardError);
      // Don't fail the entire request if leaderboard update fails
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
          rank: updatedLeaderboard.find(l => l.evermark_id === evermark_id)?.rank || 0
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