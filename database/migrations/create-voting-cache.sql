-- Create voting cache tables for performance optimization
-- Migration: Voting data caching to reduce blockchain RPC calls

-- Main voting cache table - stores vote totals per evermark per cycle
CREATE TABLE IF NOT EXISTS voting_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evermark_id TEXT NOT NULL,
  cycle_number INTEGER NOT NULL,
  total_votes BIGINT NOT NULL DEFAULT 0,
  voter_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint for evermark + cycle
  CONSTRAINT unique_evermark_cycle UNIQUE (evermark_id, cycle_number),
  
  -- Ensure valid evermark ID format (numeric string)
  CONSTRAINT check_evermark_id_format 
    CHECK (evermark_id ~ '^[0-9]+$'),
    
  -- Ensure positive values
  CONSTRAINT check_positive_votes 
    CHECK (total_votes >= 0),
    
  CONSTRAINT check_positive_voters 
    CHECK (voter_count >= 0),
    
  -- Ensure cycle number is valid
  CONSTRAINT check_valid_cycle 
    CHECK (cycle_number >= 0)
);

-- Individual vote records cache - stores each user's vote per evermark per cycle
CREATE TABLE IF NOT EXISTS user_votes_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_address TEXT NOT NULL,
  evermark_id TEXT NOT NULL,
  cycle_number INTEGER NOT NULL,
  vote_amount BIGINT NOT NULL DEFAULT 0,
  transaction_hash TEXT,
  block_number BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint for user + evermark + cycle
  CONSTRAINT unique_user_evermark_cycle UNIQUE (user_address, evermark_id, cycle_number),
  
  -- Ensure valid wallet address format
  CONSTRAINT check_user_address_format 
    CHECK (user_address ~ '^0x[a-fA-F0-9]{40}$' AND LENGTH(user_address) = 42),
    
  -- Ensure valid evermark ID format
  CONSTRAINT check_user_votes_evermark_id_format 
    CHECK (evermark_id ~ '^[0-9]+$'),
    
  -- Ensure positive vote amount
  CONSTRAINT check_positive_vote_amount 
    CHECK (vote_amount >= 0),
    
  -- Ensure valid transaction hash format (if provided)
  CONSTRAINT check_transaction_hash_format 
    CHECK (transaction_hash IS NULL OR (transaction_hash ~ '^0x[a-fA-F0-9]{64}$' AND LENGTH(transaction_hash) = 66))
);

-- Voting cycle metadata cache - stores cycle information
CREATE TABLE IF NOT EXISTS voting_cycles_cache (
  cycle_number INTEGER PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_votes BIGINT NOT NULL DEFAULT 0,
  total_voters INTEGER NOT NULL DEFAULT 0,
  active_evermarks_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  finalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_voting_cache_evermark 
ON voting_cache(evermark_id);

CREATE INDEX IF NOT EXISTS idx_voting_cache_cycle 
ON voting_cache(cycle_number);

CREATE INDEX IF NOT EXISTS idx_voting_cache_updated 
ON voting_cache(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_user_votes_user 
ON user_votes_cache(user_address);

CREATE INDEX IF NOT EXISTS idx_user_votes_evermark 
ON user_votes_cache(evermark_id);

CREATE INDEX IF NOT EXISTS idx_user_votes_cycle 
ON user_votes_cache(cycle_number);

CREATE INDEX IF NOT EXISTS idx_user_votes_created 
ON user_votes_cache(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_voting_cycles_active 
ON voting_cycles_cache(is_active, cycle_number DESC) 
WHERE is_active = true;

-- Updated_at trigger for user_votes_cache
CREATE OR REPLACE FUNCTION update_user_votes_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_votes_cache_updated_at
  BEFORE UPDATE ON user_votes_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_user_votes_cache_updated_at();

-- Updated_at trigger for voting_cycles_cache
CREATE OR REPLACE FUNCTION update_voting_cycles_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER voting_cycles_cache_updated_at
  BEFORE UPDATE ON voting_cycles_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_voting_cycles_cache_updated_at();

-- Function to update voting totals when individual votes change
CREATE OR REPLACE FUNCTION update_voting_cache_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate totals for the affected evermark + cycle
  INSERT INTO voting_cache (evermark_id, cycle_number, total_votes, voter_count)
  SELECT 
    COALESCE(NEW.evermark_id, OLD.evermark_id) as evermark_id,
    COALESCE(NEW.cycle_number, OLD.cycle_number) as cycle_number,
    COALESCE(SUM(vote_amount), 0) as total_votes,
    COUNT(DISTINCT user_address) as voter_count
  FROM user_votes_cache 
  WHERE evermark_id = COALESCE(NEW.evermark_id, OLD.evermark_id)
    AND cycle_number = COALESCE(NEW.cycle_number, OLD.cycle_number)
  GROUP BY evermark_id, cycle_number
  ON CONFLICT (evermark_id, cycle_number) 
  DO UPDATE SET 
    total_votes = EXCLUDED.total_votes,
    voter_count = EXCLUDED.voter_count,
    last_updated = NOW();
    
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update totals when individual votes change
CREATE TRIGGER user_votes_cache_update_totals
  AFTER INSERT OR UPDATE OR DELETE ON user_votes_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_voting_cache_totals();

-- Comments for documentation
COMMENT ON TABLE voting_cache IS 'Cached voting totals per evermark per cycle for performance';
COMMENT ON TABLE user_votes_cache IS 'Individual user vote records per evermark per cycle';
COMMENT ON TABLE voting_cycles_cache IS 'Cached voting cycle metadata from blockchain';

COMMENT ON COLUMN voting_cache.total_votes IS 'Total wEMARK tokens (in wei) delegated to this evermark';
COMMENT ON COLUMN voting_cache.voter_count IS 'Number of unique users who voted for this evermark';
COMMENT ON COLUMN user_votes_cache.vote_amount IS 'Amount of wEMARK tokens (in wei) this user delegated';