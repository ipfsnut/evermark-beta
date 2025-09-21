-- Migration: Add season tracking and management tables
-- Description: Adds season support and automated season management
-- Author: System Migration
-- Date: 2025-01-20

-- Add season tracking columns to beta_evermarks
ALTER TABLE beta_evermarks
ADD COLUMN IF NOT EXISTS season_number INTEGER,
ADD COLUMN IF NOT EXISTS season_year INTEGER,
ADD COLUMN IF NOT EXISTS season_week VARCHAR(4),
ADD COLUMN IF NOT EXISTS season_created_at TIMESTAMP WITH TIME ZONE;

-- Create seasons table for season management
CREATE TABLE IF NOT EXISTS seasons (
  number INTEGER PRIMARY KEY,
  year INTEGER NOT NULL,
  week VARCHAR(4) NOT NULL, -- W01 to W52/W53
  start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  end_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active',
  
  -- ArDrive references
  ardrive_folder_id TEXT,
  ardrive_manifest_tx TEXT,
  ardrive_finalized_tx TEXT,
  
  -- Smart contract references
  voting_period_id INTEGER,
  leaderboard_snapshot_block INTEGER,
  rewards_distribution_tx TEXT,
  
  -- Statistics
  total_evermarks INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  total_rewards_distributed DECIMAL(20, 6) DEFAULT 0,
  total_storage_cost_usd DECIMAL(10, 6) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  finalized_at TIMESTAMP WITH TIME ZONE,
  rewards_distributed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add constraints for seasons table
ALTER TABLE seasons 
ADD CONSTRAINT IF NOT EXISTS check_seasons_status 
CHECK (status IN ('preparing', 'active', 'finalizing', 'completed', 'archived'));

ALTER TABLE seasons 
ADD CONSTRAINT IF NOT EXISTS check_seasons_week_format 
CHECK (week ~ '^W[0-9]{2}$');

ALTER TABLE seasons 
ADD CONSTRAINT IF NOT EXISTS check_seasons_year_valid 
CHECK (year >= 2024 AND year <= 2050);

-- Create season transitions table for audit trail
CREATE TABLE IF NOT EXISTS season_transitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_season INTEGER,
  to_season INTEGER,
  transition_type TEXT NOT NULL, -- 'automatic', 'manual', 'forced'
  initiated_by TEXT, -- wallet address or 'system'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'in_progress',
  error_message TEXT,
  
  -- Phase tracking
  phases_completed JSONB DEFAULT '[]'::jsonb,
  current_phase TEXT,
  total_phases INTEGER DEFAULT 4,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  FOREIGN KEY (from_season) REFERENCES seasons(number),
  FOREIGN KEY (to_season) REFERENCES seasons(number)
);

-- Add constraints for season transitions
ALTER TABLE season_transitions 
ADD CONSTRAINT IF NOT EXISTS check_transition_type 
CHECK (transition_type IN ('automatic', 'manual', 'forced', 'rollback'));

ALTER TABLE season_transitions 
ADD CONSTRAINT IF NOT EXISTS check_transition_status 
CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled'));

-- Create season sync status table
CREATE TABLE IF NOT EXISTS season_sync_status (
  season_number INTEGER PRIMARY KEY,
  smart_contracts_synced BOOLEAN DEFAULT FALSE,
  ardrive_synced BOOLEAN DEFAULT FALSE,
  database_synced BOOLEAN DEFAULT FALSE,
  
  -- Detailed sync status
  voting_contract_synced BOOLEAN DEFAULT FALSE,
  leaderboard_contract_synced BOOLEAN DEFAULT FALSE,
  rewards_contract_synced BOOLEAN DEFAULT FALSE,
  
  -- Sync metadata
  last_sync_attempt TIMESTAMP WITH TIME ZONE,
  last_successful_sync TIMESTAMP WITH TIME ZONE,
  sync_errors JSONB DEFAULT '[]'::jsonb,
  next_sync_scheduled TIMESTAMP WITH TIME ZONE,
  
  -- ArDrive specific
  ardrive_folder_created BOOLEAN DEFAULT FALSE,
  ardrive_manifest_updated BOOLEAN DEFAULT FALSE,
  
  FOREIGN KEY (season_number) REFERENCES seasons(number)
);

-- Add indexes for season queries
CREATE INDEX IF NOT EXISTS idx_beta_evermarks_season_number 
ON beta_evermarks(season_number);

CREATE INDEX IF NOT EXISTS idx_beta_evermarks_season_year_week 
ON beta_evermarks(season_year, season_week);

CREATE INDEX IF NOT EXISTS idx_beta_evermarks_season_created 
ON beta_evermarks(season_created_at DESC);

-- Composite index for season queries
CREATE INDEX IF NOT EXISTS idx_beta_evermarks_season_composite 
ON beta_evermarks(season_number, created_at DESC) 
WHERE season_number IS NOT NULL;

-- Indexes for seasons table
CREATE INDEX IF NOT EXISTS idx_seasons_year_week 
ON seasons(year, week);

CREATE INDEX IF NOT EXISTS idx_seasons_status 
ON seasons(status);

CREATE INDEX IF NOT EXISTS idx_seasons_start_timestamp 
ON seasons(start_timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_year_week_unique 
ON seasons(year, week);

-- Indexes for season transitions
CREATE INDEX IF NOT EXISTS idx_season_transitions_from_to 
ON season_transitions(from_season, to_season);

CREATE INDEX IF NOT EXISTS idx_season_transitions_status 
ON season_transitions(status);

CREATE INDEX IF NOT EXISTS idx_season_transitions_started_at 
ON season_transitions(started_at DESC);

-- Function to update season statistics
CREATE OR REPLACE FUNCTION update_season_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update evermark count when new evermark is added with season
  IF TG_OP = 'INSERT' AND NEW.season_number IS NOT NULL THEN
    UPDATE seasons 
    SET total_evermarks = total_evermarks + 1,
        total_storage_cost_usd = COALESCE(total_storage_cost_usd, 0) + COALESCE(NEW.ardrive_cost_usd, 0)
    WHERE number = NEW.season_number;
  END IF;
  
  -- Update when evermark season is updated
  IF TG_OP = 'UPDATE' THEN
    -- Remove from old season
    IF OLD.season_number IS NOT NULL AND OLD.season_number != NEW.season_number THEN
      UPDATE seasons 
      SET total_evermarks = total_evermarks - 1,
          total_storage_cost_usd = COALESCE(total_storage_cost_usd, 0) - COALESCE(OLD.ardrive_cost_usd, 0)
      WHERE number = OLD.season_number;
    END IF;
    
    -- Add to new season
    IF NEW.season_number IS NOT NULL AND OLD.season_number != NEW.season_number THEN
      UPDATE seasons 
      SET total_evermarks = total_evermarks + 1,
          total_storage_cost_usd = COALESCE(total_storage_cost_usd, 0) + COALESCE(NEW.ardrive_cost_usd, 0)
      WHERE number = NEW.season_number;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic season stats updates
CREATE TRIGGER trigger_update_season_stats
  AFTER INSERT OR UPDATE ON beta_evermarks
  FOR EACH ROW
  EXECUTE FUNCTION update_season_stats();

-- Function to get current season (for queries)
CREATE OR REPLACE FUNCTION get_current_season()
RETURNS seasons AS $$
DECLARE
  current_season seasons;
BEGIN
  SELECT * INTO current_season 
  FROM seasons 
  WHERE status = 'active' 
  ORDER BY number DESC 
  LIMIT 1;
  
  RETURN current_season;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE seasons IS 'Master table for season management and tracking';
COMMENT ON TABLE season_transitions IS 'Audit trail of all season transitions';
COMMENT ON TABLE season_sync_status IS 'Synchronization status across different systems';

COMMENT ON COLUMN beta_evermarks.season_number IS 'Season number when this evermark was created';
COMMENT ON COLUMN beta_evermarks.season_year IS 'Year of the season (2024, 2025, etc.)';
COMMENT ON COLUMN beta_evermarks.season_week IS 'ISO week format (W01-W52)';
COMMENT ON COLUMN beta_evermarks.season_created_at IS 'Timestamp when season was assigned';

COMMENT ON COLUMN seasons.number IS 'Absolute season number (incremental from platform start)';
COMMENT ON COLUMN seasons.voting_period_id IS 'Smart contract voting period identifier';
COMMENT ON COLUMN seasons.ardrive_folder_id IS 'ArDrive folder ID for this season';
COMMENT ON COLUMN seasons.metadata IS 'Additional season metadata and configuration';

-- Create view for active season info
CREATE OR REPLACE VIEW current_season_info AS
SELECT 
  s.*,
  COUNT(e.token_id) as actual_evermarks,
  SUM(e.ardrive_cost_usd) as actual_storage_cost
FROM seasons s
LEFT JOIN beta_evermarks e ON e.season_number = s.number
WHERE s.status = 'active'
GROUP BY s.number, s.year, s.week, s.start_timestamp, s.end_timestamp, s.status,
         s.ardrive_folder_id, s.ardrive_manifest_tx, s.ardrive_finalized_tx,
         s.voting_period_id, s.leaderboard_snapshot_block, s.rewards_distribution_tx,
         s.total_evermarks, s.total_votes, s.unique_voters, s.total_rewards_distributed,
         s.total_storage_cost_usd, s.created_at, s.finalized_at, s.rewards_distributed_at,
         s.description, s.metadata
ORDER BY s.number DESC
LIMIT 1;

COMMENT ON VIEW current_season_info IS 'Current active season with real-time statistics';