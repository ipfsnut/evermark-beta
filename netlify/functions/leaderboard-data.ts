// Netlify function to fetch evermarks with voting data for leaderboard
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
    const { cycle } = event.queryStringParameters || {};
    const currentCycle = cycle ? parseInt(cycle) : 0; // Default to cycle 0 for current/beta

    // Query evermarks with voting data for specific cycle, ordered by votes DESC
    const { data: leaderboardData, error } = await supabase
      .from('beta_evermarks')
      .select(`
        token_id,
        title,
        author,
        owner,
        description,
        content_type,
        source_url,
        created_at,
        verified,
        supabase_image_url,
        ipfs_image_hash,
        voting_cache!left(total_votes, voter_count)
      `)
      .eq('voting_cache.cycle_number', currentCycle)
      .order('voting_cache.total_votes', { ascending: false, nullsFirst: false })
      .limit(100); // Top 100 for leaderboard

    if (error) {
      console.error('Database error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch leaderboard data' })
      };
    }

    // Transform data to include vote totals and ensure proper structure
    const transformedEvermarks = leaderboardData?.map(evermark => ({
      id: evermark.token_id.toString(),
      tokenId: evermark.token_id,
      title: evermark.title,
      author: evermark.author,
      owner: evermark.owner,
      description: evermark.description,
      contentType: evermark.content_type,
      sourceUrl: evermark.source_url,
      createdAt: evermark.created_at,
      verified: evermark.verified || false,
      supabaseImageUrl: evermark.supabase_image_url,
      ipfsHash: evermark.ipfs_image_hash,
      totalVotes: evermark.voting_cache?.[0]?.total_votes || 0,
      voterCount: evermark.voting_cache?.[0]?.voter_count || 0,
      tags: []
    })) || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        evermarks: transformedEvermarks,
        cycle: currentCycle,
        total: transformedEvermarks.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Leaderboard data fetch error:', error);
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