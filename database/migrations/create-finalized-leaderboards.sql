-- Create finalized leaderboards table for historical season snapshots
-- Migration: Store finalized season rankings to avoid reconstructing from live data

-- Main finalized leaderboards table
CREATE TABLE IF NOT EXISTS finalized_leaderboards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_number INTEGER NOT NULL,
  evermark_id TEXT NOT NULL,
  final_rank INTEGER NOT NULL,
  total_votes BIGINT NOT NULL,
  percentage_of_total DECIMAL(8,4) NOT NULL DEFAULT 0,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL,
  snapshot_hash TEXT, -- SHA256 hash for integrity verification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint for season + evermark
  CONSTRAINT unique_season_evermark UNIQUE (season_number, evermark_id),
  
  -- Ensure valid evermark ID format (numeric string)
  CONSTRAINT check_finalized_evermark_id_format 
    CHECK (evermark_id ~ '^[0-9]+$'),
    
  -- Ensure positive values
  CONSTRAINT check_finalized_positive_votes 
    CHECK (total_votes >= 0),
    
  CONSTRAINT check_finalized_valid_rank 
    CHECK (final_rank > 0),
    
  CONSTRAINT check_finalized_valid_percentage 
    CHECK (percentage_of_total >= 0 AND percentage_of_total <= 100),
    
  -- Ensure season number is valid
  CONSTRAINT check_finalized_valid_season 
    CHECK (season_number > 0)
);

-- Season metadata table for finalized seasons
CREATE TABLE IF NOT EXISTS finalized_seasons (
  season_number INTEGER PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_votes BIGINT NOT NULL DEFAULT 0,
  total_evermarks_count INTEGER NOT NULL DEFAULT 0,
  top_evermark_id TEXT,
  top_evermark_votes BIGINT NOT NULL DEFAULT 0,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL,
  snapshot_hash TEXT, -- Hash of the entire leaderboard for integrity
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid season number
  CONSTRAINT check_finalized_season_number 
    CHECK (season_number > 0),
    
  -- Ensure positive values
  CONSTRAINT check_finalized_season_votes 
    CHECK (total_votes >= 0 AND top_evermark_votes >= 0),
    
  CONSTRAINT check_finalized_season_count 
    CHECK (total_evermarks_count >= 0),
    
  -- Ensure end time is after start time
  CONSTRAINT check_finalized_season_timeframe 
    CHECK (end_time > start_time)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_finalized_leaderboards_season 
ON finalized_leaderboards(season_number);

CREATE INDEX IF NOT EXISTS idx_finalized_leaderboards_rank 
ON finalized_leaderboards(season_number, final_rank);

CREATE INDEX IF NOT EXISTS idx_finalized_leaderboards_evermark 
ON finalized_leaderboards(evermark_id);

CREATE INDEX IF NOT EXISTS idx_finalized_leaderboards_votes 
ON finalized_leaderboards(season_number, total_votes DESC);

CREATE INDEX IF NOT EXISTS idx_finalized_seasons_finalized_at 
ON finalized_seasons(finalized_at DESC);

-- Function to calculate snapshot hash for integrity
CREATE OR REPLACE FUNCTION calculate_leaderboard_snapshot_hash(season_num INTEGER)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT encode(
    digest(
      string_agg(
        CONCAT(evermark_id, ':', final_rank, ':', total_votes), 
        '|' ORDER BY final_rank
      ), 
      'sha256'
    ), 
    'hex'
  )
  INTO result
  FROM finalized_leaderboards 
  WHERE season_number = season_num;
  
  RETURN COALESCE(result, '');
END;
$$ LANGUAGE plpgsql;

-- Function to get finalized leaderboard for a season
CREATE OR REPLACE FUNCTION get_finalized_leaderboard(season_num INTEGER)
RETURNS TABLE (
  evermark_id TEXT,
  final_rank INTEGER,
  total_votes BIGINT,
  percentage_of_total DECIMAL(8,4),
  finalized_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fl.evermark_id,
    fl.final_rank,
    fl.total_votes,
    fl.percentage_of_total,
    fl.finalized_at
  FROM finalized_leaderboards fl
  WHERE fl.season_number = season_num
  ORDER BY fl.final_rank ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a season is finalized
CREATE OR REPLACE FUNCTION is_season_finalized(season_num INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM finalized_seasons WHERE season_number = season_num
  );
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE finalized_leaderboards IS 'Permanent snapshots of leaderboard rankings at season end';
COMMENT ON TABLE finalized_seasons IS 'Metadata for finalized voting seasons with aggregate statistics';

COMMENT ON COLUMN finalized_leaderboards.season_number IS 'The voting season this ranking belongs to';
COMMENT ON COLUMN finalized_leaderboards.final_rank IS 'Final ranking position (1 = first place)';
COMMENT ON COLUMN finalized_leaderboards.total_votes IS 'Total wEMARK tokens (in wei) received during the season';
COMMENT ON COLUMN finalized_leaderboards.percentage_of_total IS 'Percentage of total season votes this evermark received';
COMMENT ON COLUMN finalized_leaderboards.snapshot_hash IS 'SHA256 hash for integrity verification';

COMMENT ON COLUMN finalized_seasons.total_votes IS 'Sum of all votes cast in this season';
COMMENT ON COLUMN finalized_seasons.total_evermarks_count IS 'Number of evermarks that received votes';
COMMENT ON COLUMN finalized_seasons.top_evermark_id IS 'ID of the winning evermark';
COMMENT ON COLUMN finalized_seasons.snapshot_hash IS 'Hash of entire leaderboard for integrity checking';