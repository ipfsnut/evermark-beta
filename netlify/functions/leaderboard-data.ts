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

    // First, let's get evermarks and then manually join with voting data
    const { data: evermarksData, error: evermarksError } = await supabase
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
        ipfs_image_hash
      `)
      .order('token_id', { ascending: false })
      .limit(100);

    if (evermarksError) {
      console.error('Evermarks query error:', evermarksError);
      throw evermarksError;
    }

    // Get voting data for these evermarks
    const tokenIds = evermarksData?.map(e => e.token_id.toString()) || [];
    const { data: votingData, error: votingError } = await supabase
      .from('voting_cache')
      .select('evermark_id, total_votes, voter_count')
      .eq('cycle_number', currentCycle)
      .in('evermark_id', tokenIds);

    if (votingError) {
      console.error('Voting cache query error:', votingError);
      // Don't throw - continue with zero votes
    }

    // Create voting lookup map
    const votingMap = new Map();
    votingData?.forEach(vote => {
      votingMap.set(vote.evermark_id, {
        totalVotes: vote.total_votes || 0,
        voterCount: vote.voter_count || 0
      });
    });

    // Combine data and sort by votes
    const leaderboardData = evermarksData?.map(evermark => ({
      ...evermark,
      ...votingMap.get(evermark.token_id.toString()) || { totalVotes: 0, voterCount: 0 }
    })).sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0)) || [];

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