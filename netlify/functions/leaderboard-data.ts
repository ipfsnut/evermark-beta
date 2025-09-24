import { Handler } from '@netlify/functions';
import { VotingDataService } from '../../shared/services/VotingDataService';
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

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '10');
    
    // Get current season evermarks from database
    const { data: evermarks, error } = await supabase
      .from('beta_evermarks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50); // Get more than we need for voting calculations

    if (error) {
      throw error;
    }

    if (!evermarks || evermarks.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          evermarks: [],
          season: { number: 7, status: 'active' }
        }),
      };
    }

    // Get voting data for all evermarks
    const leaderboardData: Array<{
      token_id: any;
      id: string;
      title: any;
      author: any;
      description: any;
      supabase_image_url: any;
      processed_image_url: any;
      content_type: any;
      source_url: any;
      created_at: any;
      votes: number;
      total_votes: number;
      voter_count: number;
      rank: number;
    }> = [];
    
    for (const evermark of evermarks.slice(0, limit)) {
      try {
        // Get voting data from blockchain
        const votingData = await VotingDataService.getEvermarkVotingData(evermark.token_id.toString());
        
        leaderboardData.push({
          token_id: evermark.token_id,
          id: evermark.token_id.toString(),
          title: evermark.title,
          author: evermark.author,
          description: evermark.description,
          supabase_image_url: evermark.supabase_image_url,
          processed_image_url: evermark.supabase_image_url,
          content_type: evermark.content_type,
          source_url: evermark.source_url,
          created_at: evermark.created_at,
          votes: Math.round(votingData.total_votes), // Convert from wei
          total_votes: votingData.total_votes,
          voter_count: votingData.voter_count,
          rank: 0 // Will be set after sorting
        });
      } catch (votingError) {
        console.warn(`Failed to get voting data for evermark ${evermark.token_id}:`, votingError);
        // Include with 0 votes if voting data fails
        leaderboardData.push({
          token_id: evermark.token_id,
          id: evermark.token_id.toString(),
          title: evermark.title,
          author: evermark.author,
          description: evermark.description,
          supabase_image_url: evermark.supabase_image_url,
          processed_image_url: evermark.supabase_image_url,
          content_type: evermark.content_type,
          source_url: evermark.source_url,
          created_at: evermark.created_at,
          votes: 0,
          total_votes: 0,
          voter_count: 0,
          rank: 0
        });
      }
    }

    // Sort by total votes (descending) then by creation date (newest first)
    leaderboardData.sort((a, b) => {
      if (a.total_votes !== b.total_votes) {
        return b.total_votes - a.total_votes;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Assign ranks
    leaderboardData.forEach((item, index) => {
      item.rank = index + 1;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        evermarks: leaderboardData,
        season: {
          number: 7,
          status: 'active',
          phase: 'voting'
        },
        total: leaderboardData.length,
        fetched_at: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('Leaderboard data error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch leaderboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};