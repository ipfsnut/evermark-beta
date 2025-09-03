// List all tables in the database
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Tables we know about or expect
    const tablesToCheck = [
      'beta_evermarks',
      'leaderboard',
      'votes',
      'voting_cache',
      'user_votes_cache',
      'voting_cycles_cache',
      'evermark_votes',
      'user_voting_history',
      'shares',
      'referrals',
      'finalized_leaderboards',
      'finalized_seasons'
    ];

    const tableStatus: any = {};

    for (const tableName of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          if (error.code === 'PGRST116') {
            tableStatus[tableName] = 'does_not_exist';
          } else {
            tableStatus[tableName] = `error: ${error.message}`;
          }
        } else {
          // Try to get count
          const { count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          tableStatus[tableName] = `exists (${count || 0} rows)`;
        }
      } catch (err) {
        tableStatus[tableName] = 'check_failed';
      }
    }

    // Check for any voting-related tables
    const votingTables = Object.entries(tableStatus)
      .filter(([name, status]) => name.includes('vot') || name.includes('vote'))
      .reduce((acc, [name, status]) => ({ ...acc, [name]: status }), {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        all_tables: tableStatus,
        voting_tables: votingTables,
        summary: {
          total_checked: tablesToCheck.length,
          existing: Object.values(tableStatus).filter(s => typeof s === 'string' && s.includes('exists')).length,
          missing: Object.values(tableStatus).filter(s => s === 'does_not_exist').length
        }
      }, null, 2)
    };

  } catch (error) {
    console.error('List tables error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to list tables',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};