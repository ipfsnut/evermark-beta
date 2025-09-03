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

-- Row Level Security policies (if needed)
-- ALTER TABLE finalized_seasons ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wizard_progress ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE distribution_progress ENABLE ROW LEVEL SECURITY;  
-- ALTER TABLE finalized_leaderboards ENABLE ROW LEVEL SECURITY;

-- Add foreign key relationship to beta_evermarks if needed
-- ALTER TABLE finalized_leaderboards 
-- ADD CONSTRAINT fk_finalized_leaderboards_evermark 
-- FOREIGN KEY (evermark_id) REFERENCES beta_evermarks(id);

-- Comments for documentation
COMMENT ON TABLE finalized_seasons IS 'Tracks completed voting seasons with finalization status';
COMMENT ON TABLE wizard_progress IS 'Tracks admin wizard progress through 5-step season finalization process';
COMMENT ON TABLE distribution_progress IS 'Tracks reward distribution execution status and progress';
COMMENT ON TABLE finalized_leaderboards IS 'Stores final leaderboard rankings for completed seasons';

-- Grant permissions to web application user (replace with actual role name)
-- GRANT SELECT, INSERT, UPDATE ON finalized_seasons TO web_app_role;
-- GRANT SELECT, INSERT, UPDATE ON wizard_progress TO web_app_role;  
-- GRANT SELECT, INSERT, UPDATE ON distribution_progress TO web_app_role;
-- GRANT SELECT, INSERT, UPDATE ON finalized_leaderboards TO web_app_role;
-- GRANT USAGE ON SEQUENCE finalized_seasons_id_seq TO web_app_role;
-- GRANT USAGE ON SEQUENCE wizard_progress_id_seq TO web_app_role;
-- GRANT USAGE ON SEQUENCE distribution_progress_id_seq TO web_app_role;
-- GRANT USAGE ON SEQUENCE finalized_leaderboards_id_seq TO web_app_role;