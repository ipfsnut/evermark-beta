// Netlify function to fetch list of finalized seasons for dropdown selection
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
    console.log('Getting list of finalized seasons');

    // Get all finalized seasons, ordered by season number descending (newest first)
    const { data: seasonsData, error: seasonsError } = await supabase
      .from('finalized_seasons')
      .select('*')
      .order('season_number', { ascending: false });

    if (seasonsError) {
      console.error('Finalized seasons query error:', seasonsError);
      throw seasonsError;
    }

    if (!seasonsData || seasonsData.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          seasons: [],
          total: 0,
          timestamp: new Date().toISOString(),
          message: 'No finalized seasons found'
        })
      };
    }

    // Transform the data for frontend consumption
    const transformedSeasons = seasonsData.map(season => ({
      seasonNumber: season.season_number,
      startTime: season.start_time,
      endTime: season.end_time,
      totalVotes: season.total_votes,
      totalEvermarksCount: season.total_evermarks_count,
      topEvermarkId: season.top_evermark_id,
      topEvermarkVotes: season.top_evermark_votes,
      finalizedAt: season.finalized_at,
      duration: new Date(season.end_time).getTime() - new Date(season.start_time).getTime(),
      label: `Season ${season.season_number}`,
      description: `${season.total_evermarks_count} evermarks, ${parseInt(season.total_votes)} total votes`
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        seasons: transformedSeasons,
        total: transformedSeasons.length,
        timestamp: new Date().toISOString(),
        debug: {
          rawSeasonCount: seasonsData.length,
          dataSource: 'finalized_seasons_table'
        }
      })
    };

  } catch (error) {
    console.error('Finalized seasons fetch error:', error);
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