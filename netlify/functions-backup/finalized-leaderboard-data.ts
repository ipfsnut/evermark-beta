// Netlify function to fetch finalized leaderboard data for completed seasons
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
    const { season } = event.queryStringParameters || {};
    
    if (!season) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Season parameter is required' })
      };
    }

    const seasonNumber = parseInt(season);
    if (isNaN(seasonNumber) || seasonNumber <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid season number' })
      };
    }

    console.log(`Getting finalized leaderboard data for season ${seasonNumber}`);

    // Check if the season is finalized
    const { data: seasonData, error: seasonError } = await supabase
      .from('finalized_seasons')
      .select('*')
      .eq('season_number', seasonNumber)
      .single();

    if (seasonError || !seasonData) {
      console.log(`Season ${seasonNumber} not found in finalized_seasons table`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Season not finalized or not found',
          message: `Season ${seasonNumber} has not been finalized yet`
        })
      };
    }

    // Get the finalized leaderboard data
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('finalized_leaderboards')
      .select('*')
      .eq('season_number', seasonNumber)
      .order('final_rank', { ascending: true });

    if (leaderboardError) {
      console.error('Finalized leaderboard query error:', leaderboardError);
      throw leaderboardError;
    }

    if (!leaderboardData || leaderboardData.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          evermarks: [],
          season: seasonNumber,
          seasonInfo: seasonData,
          total: 0,
          timestamp: new Date().toISOString(),
          message: `No leaderboard data found for finalized season ${seasonNumber}`
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

    // Combine finalized leaderboard data with evermark metadata
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
        rank: leader.final_rank,
        percentageOfTotal: leader.percentage_of_total,
        finalizedAt: leader.finalized_at,
        voterCount: 0, // Not tracked in current schema
        tags: []
      };
    }).filter(Boolean); // Remove null entries

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        evermarks: transformedEvermarks,
        season: seasonNumber,
        seasonInfo: {
          seasonNumber: seasonData.season_number,
          startTime: seasonData.start_time,
          endTime: seasonData.end_time,
          totalVotes: seasonData.total_votes,
          totalEvermarksCount: seasonData.total_evermarks_count,
          topEvermarkId: seasonData.top_evermark_id,
          topEvermarkVotes: seasonData.top_evermark_votes,
          finalizedAt: seasonData.finalized_at
        },
        total: transformedEvermarks.length,
        timestamp: new Date().toISOString(),
        debug: {
          finalizedLeaderboardEntries: leaderboardData?.length || 0,
          evermarkMatches: transformedEvermarks.length,
          dataSource: 'finalized_leaderboards_table'
        }
      })
    };

  } catch (error) {
    console.error('Finalized leaderboard data fetch error:', error);
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