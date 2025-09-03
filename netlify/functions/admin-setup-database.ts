import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// SQL schema for admin wizard tables
const WIZARD_TABLES_SQL = `
-- Season Finalization Wizard Database Schema
-- Tables required for the admin wizard functionality

-- Table for storing finalized seasons
CREATE TABLE IF NOT EXISTS finalized_seasons (
    id SERIAL PRIMARY KEY,
    season_number INTEGER UNIQUE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_votes BIGINT NOT NULL DEFAULT 0,
    total_voters INTEGER NOT NULL DEFAULT 0,
    blockchain_finalized BOOLEAN DEFAULT FALSE,
    database_stored BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking wizard progress through the 5-step process
CREATE TABLE IF NOT EXISTS wizard_progress (
    id SERIAL PRIMARY KEY,
    season_number INTEGER UNIQUE NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1,
    step_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'error')),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for tracking distribution execution progress  
CREATE TABLE IF NOT EXISTS distribution_progress (
    id SERIAL PRIMARY KEY,
    season_number INTEGER NOT NULL,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    processed INTEGER NOT NULL DEFAULT 0,
    successful INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    current_batch INTEGER DEFAULT 0,
    total_batches INTEGER DEFAULT 0,
    transaction_hashes TEXT[] DEFAULT ARRAY[]::TEXT[],
    error_details JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing final leaderboard data for completed seasons
CREATE TABLE IF NOT EXISTS finalized_leaderboards (
    id SERIAL PRIMARY KEY,
    season_number INTEGER NOT NULL,
    evermark_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    total_votes BIGINT NOT NULL DEFAULT 0,
    creator_reward BIGINT DEFAULT 0,
    supporter_pool BIGINT DEFAULT 0,
    supporter_count INTEGER DEFAULT 0,
    finalized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(season_number, evermark_id),
    UNIQUE(season_number, rank)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_finalized_seasons_season_number ON finalized_seasons(season_number);
CREATE INDEX IF NOT EXISTS idx_wizard_progress_season_number ON wizard_progress(season_number);
CREATE INDEX IF NOT EXISTS idx_wizard_progress_status ON wizard_progress(status);
CREATE INDEX IF NOT EXISTS idx_distribution_progress_season_number ON distribution_progress(season_number);
CREATE INDEX IF NOT EXISTS idx_distribution_progress_status ON distribution_progress(status);
CREATE INDEX IF NOT EXISTS idx_finalized_leaderboards_season_number ON finalized_leaderboards(season_number);
CREATE INDEX IF NOT EXISTS idx_finalized_leaderboards_rank ON finalized_leaderboards(season_number, rank);
`;

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  try {
    console.log('Setting up admin wizard database tables...');

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    const action = event.queryStringParameters?.action || 'setup';

    switch (action) {
      case 'setup':
        // Execute the SQL schema
        const { error } = await supabase.rpc('exec_sql', { sql: WIZARD_TABLES_SQL });
        
        if (error) {
          console.error('Database setup error:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: 'Database setup failed',
              message: error.message
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Admin wizard database tables created successfully',
            tables: ['finalized_seasons', 'wizard_progress', 'distribution_progress', 'finalized_leaderboards']
          })
        };

      case 'check':
        // Check if tables exist
        const checkTables = async () => {
          const results = await Promise.allSettled([
            supabase.from('finalized_seasons').select('id', { count: 'exact', head: true }),
            supabase.from('wizard_progress').select('id', { count: 'exact', head: true }),
            supabase.from('distribution_progress').select('id', { count: 'exact', head: true }),
            supabase.from('finalized_leaderboards').select('id', { count: 'exact', head: true })
          ]);

          return {
            finalized_seasons: results[0].status === 'fulfilled',
            wizard_progress: results[1].status === 'fulfilled',
            distribution_progress: results[2].status === 'fulfilled',
            finalized_leaderboards: results[3].status === 'fulfilled'
          };
        };

        const tableStatus = await checkTables();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            tables: tableStatus,
            allTablesExist: Object.values(tableStatus).every(exists => exists)
          })
        };

      case 'reset':
        // Drop and recreate tables (use with caution)
        const resetSQL = `
          DROP TABLE IF EXISTS finalized_leaderboards CASCADE;
          DROP TABLE IF EXISTS distribution_progress CASCADE;  
          DROP TABLE IF EXISTS wizard_progress CASCADE;
          DROP TABLE IF EXISTS finalized_seasons CASCADE;
        `;

        const { error: dropError } = await supabase.rpc('exec_sql', { sql: resetSQL });
        if (dropError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to drop tables', message: dropError.message })
          };
        }

        const { error: createError } = await supabase.rpc('exec_sql', { sql: WIZARD_TABLES_SQL });
        if (createError) {
          return {
            statusCode: 500, 
            headers,
            body: JSON.stringify({ error: 'Failed to recreate tables', message: createError.message })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'Admin wizard database tables reset successfully'
          })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid action',
            validActions: ['setup', 'check', 'reset']
          })
        };
    }

  } catch (err) {
    console.error('Database setup error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      })
    };
  }
};

export { handler };