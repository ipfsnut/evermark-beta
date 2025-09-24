// One-time function to add unique constraint to votes table
import type { HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Need service key for DDL operations
);

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
    console.log('Adding unique constraint to votes table...');

    // Add the unique constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE votes 
        ADD CONSTRAINT votes_user_evermark_cycle_unique 
        UNIQUE (user_id, evermark_id, cycle);
      `
    });

    if (error) {
      // Check if constraint already exists
      if (error.message.includes('already exists')) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Constraint already exists',
            constraint: 'votes_user_evermark_cycle_unique'
          })
        };
      }
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully added unique constraint to votes table',
        constraint: 'votes_user_evermark_cycle_unique'
      })
    };

  } catch (error) {
    console.error('Failed to add constraint:', error);
    
    // Try alternative approach using direct SQL
    try {
      const { error: altError } = await supabase
        .from('votes')
        .select('user_id, evermark_id, cycle')
        .limit(1); // Just test if we can query

      if (!altError) {
        // Table exists, try to add constraint via raw query
        const constraintSQL = `
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE constraint_name = 'votes_user_evermark_cycle_unique'
              AND table_name = 'votes'
            ) THEN
              ALTER TABLE votes 
              ADD CONSTRAINT votes_user_evermark_cycle_unique 
              UNIQUE (user_id, evermark_id, cycle);
            END IF;
          END $$;
        `;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            message: 'Cannot add constraint via function - run this SQL manually in Supabase dashboard',
            sql: constraintSQL.trim(),
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        };
      }
    } catch (altError) {
      // Fall through to error response
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to add constraint',
        message: error instanceof Error ? error.message : 'Unknown error',
        instructions: 'You may need to run this SQL manually in the Supabase dashboard: ALTER TABLE votes ADD CONSTRAINT votes_user_evermark_cycle_unique UNIQUE (user_id, evermark_id, cycle);'
      })
    };
  }
}