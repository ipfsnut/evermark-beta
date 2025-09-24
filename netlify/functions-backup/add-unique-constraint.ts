// One-time function to add unique constraint to beta_points table
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
    console.log('🔧 Adding unique constraint to beta_points table...');

    // Add the unique constraint
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE beta_points 
        ADD CONSTRAINT unique_wallet_address 
        UNIQUE (wallet_address);
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
            constraint: 'unique_wallet_address'
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
        message: 'Successfully added unique constraint to beta_points table',
        constraint: 'unique_wallet_address'
      })
    };

  } catch (error) {
    console.error('Failed to add constraint:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to add unique constraint',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}