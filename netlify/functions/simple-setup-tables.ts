// netlify/functions/simple-setup-tables.ts - Simple table setup without exec_sql dependency
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔄 Checking database table status...');

    // Try to query the tables to see if they exist and are accessible
    const tableTests = [
      { name: 'voting_cache', test: () => supabase.from('voting_cache').select('*').limit(1) },
      { name: 'user_votes_cache', test: () => supabase.from('user_votes_cache').select('*').limit(1) },
      { name: 'voting_cycles_cache', test: () => supabase.from('voting_cycles_cache').select('*').limit(1) }
    ];

    const results: Array<{
      table: string;
      status: string;
      message?: string;
      exists: boolean;
    }> = [];
    
    for (const table of tableTests) {
      try {
        const { error } = await table.test();
        if (error) {
          results.push({
            table: table.name,
            status: 'error',
            message: error.message,
            exists: error.code !== 'PGRST116' // PGRST116 = relation does not exist
          });
        } else {
          results.push({
            table: table.name,
            status: 'accessible',
            exists: true
          });
        }
      } catch (testError) {
        results.push({
          table: table.name,
          status: 'failed',
          message: testError instanceof Error ? testError.message : 'Unknown error',
          exists: false
        });
      }
    }

    // Check if all tables are accessible
    const accessibleTables = results.filter(r => r.status === 'accessible');
    const errorTables = results.filter(r => r.status === 'error');

    console.log('Table accessibility results:', results);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Checked ${tableTests.length} tables`,
        accessible_tables: accessibleTables.length,
        error_tables: errorTables.length,
        details: results,
        summary: {
          all_accessible: accessibleTables.length === tableTests.length,
          requires_manual_setup: errorTables.length > 0
        }
      })
    };

  } catch (error) {
    console.error('Table check failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Table check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};