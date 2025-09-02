// Netlify function to get top supporters (voters) for a specific evermark
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export async function handler(event: HandlerEvent, context: HandlerContext) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const evermarkId = event.queryStringParameters?.evermark_id;
    const cycle = parseInt(event.queryStringParameters?.cycle || '3');
    const limit = parseInt(event.queryStringParameters?.limit || '10');

    if (!evermarkId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'evermark_id is required' })
      };
    }

    console.log(`Getting top ${limit} supporters for evermark ${evermarkId} in cycle ${cycle}`);

    // Get all votes for this evermark, grouped by user, ordered by total amount
    const { data: supporterVotes, error } = await supabase
      .from('votes')
      .select('user_id, amount, created_at')
      .eq('evermark_id', evermarkId)
      .eq('cycle', cycle)
      .eq('action', 'delegate')
      .order('amount', { ascending: false });

    if (error) {
      console.error('Supporters query error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to query supporters',
          details: error.message 
        })
      };
    }

    // Group by user and sum their total votes
    const supporterMap = new Map<string, { total_amount: bigint; latest_vote: string; vote_count: number }>();
    
    for (const vote of supporterVotes || []) {
      const userId = vote.user_id;
      const amount = BigInt(vote.amount);
      
      if (supporterMap.has(userId)) {
        const existing = supporterMap.get(userId)!;
        supporterMap.set(userId, {
          total_amount: existing.total_amount + amount,
          latest_vote: vote.created_at > existing.latest_vote ? vote.created_at : existing.latest_vote,
          vote_count: existing.vote_count + 1
        });
      } else {
        supporterMap.set(userId, {
          total_amount: amount,
          latest_vote: vote.created_at,
          vote_count: 1
        });
      }
    }

    // Convert to array and sort by total amount
    const supporters = Array.from(supporterMap.entries())
      .map(([userId, data]) => ({
        user_id: userId,
        total_emark: Number(data.total_amount) / (10 ** 18),
        total_wei: data.total_amount.toString(),
        vote_count: data.vote_count,
        latest_vote: data.latest_vote,
        // Truncate address for display
        display_address: `${userId.slice(0, 6)}...${userId.slice(-4)}`
      }))
      .sort((a, b) => Number(BigInt(b.total_wei) - BigInt(a.total_wei)))
      .slice(0, limit);

    console.log(`Found ${supporters.length} supporters for evermark ${evermarkId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: supporters,
        evermark_id: evermarkId,
        cycle: cycle,
        total_supporters: supporters.length,
        total_votes_received: supporters.reduce((sum, s) => sum + s.total_emark, 0)
      })
    };

  } catch (error) {
    console.error('Get evermark supporters error:', error);
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