// Netlify function to fetch evermarks with voting data for leaderboard
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Create client for backend use
const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID || process.env.VITE_THIRDWEB_CLIENT_ID!
});

// Contract addresses from environment
const VOTING_CONTRACT_ADDRESS = process.env.VITE_EVERMARK_VOTING_ADDRESS!;

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
    // Default to current cycle (4) but allow override via query param
    const currentCycle = cycle ? parseInt(cycle) : 4; // Default to current season
    
    console.log(`Getting leaderboard data for cycle ${currentCycle}`);

    // Query the leaderboard table directly - this is the source of truth
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('leaderboard')
      .select('evermark_id, total_votes, rank')
      .eq('cycle_id', currentCycle)
      .order('rank', { ascending: true });

    if (leaderboardError) {
      console.error('Leaderboard query error:', leaderboardError);
      throw leaderboardError;
    }

    console.log(`Found ${leaderboardData?.length || 0} evermarks in leaderboard for cycle ${currentCycle}`);

    if (!leaderboardData || leaderboardData.length === 0) {
      // No leaderboard data found - return empty results
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          evermarks: [],
          cycle: currentCycle,
          total: 0,
          timestamp: new Date().toISOString(),
          message: `No leaderboard data found for cycle ${currentCycle}. Leaderboard table may need to be populated.`
        })
      };
    }

    // Get evermark metadata for the ranked evermarks
    const evermarkIds = leaderboardData.map(l => l.evermark_id);
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
      .in('token_id', evermarkIds);

    if (evermarksError) {
      console.error('Evermarks query error:', evermarksError);
      throw evermarksError;
    }

    // Combine leaderboard data with evermark metadata, maintaining rank order
    const transformedEvermarks = leaderboardData.map(leader => {
      const evermark = evermarksData?.find(e => e.token_id.toString() === leader.evermark_id);
      
      if (!evermark) {
        console.warn(`No evermark data found for ID ${leader.evermark_id}`);
        return null;
      }

      return {
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
        totalVotes: leader.total_votes,
        rank: leader.rank,
        voterCount: 0, // Not tracked in current schema
        tags: []
      };
    }).filter(Boolean); // Remove null entries

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        evermarks: transformedEvermarks,
        cycle: currentCycle,
        total: transformedEvermarks.length,
        timestamp: new Date().toISOString(),
        debug: {
          leaderboardEntries: leaderboardData?.length || 0,
          evermarkMatches: transformedEvermarks.length,
          dataSource: 'leaderboard_table'
        }
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