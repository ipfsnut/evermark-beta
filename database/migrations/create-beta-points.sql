-- Create beta_points table for tracking user points
-- Follows existing architecture patterns with user_settings and beta_evermarks

-- Create beta_points table
CREATE TABLE IF NOT EXISTS beta_points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  total_points INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid Ethereum address format
  CONSTRAINT check_wallet_address_format 
    CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$' AND LENGTH(wallet_address) = 42),
    
  -- Ensure non-negative points
  CONSTRAINT check_points_non_negative 
    CHECK (total_points >= 0)
);

-- Create beta_point_transactions table for audit trail
CREATE TABLE IF NOT EXISTS beta_point_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create_evermark', 'vote', 'stake'
  points_earned INTEGER NOT NULL,
  related_id TEXT, -- evermark_id, vote_tx_hash, stake_tx_hash for reference
  tx_hash TEXT, -- blockchain transaction hash if applicable
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid Ethereum address format
  CONSTRAINT check_wallet_address_format 
    CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$' AND LENGTH(wallet_address) = 42),
    
  -- Ensure valid action types
  CONSTRAINT check_action_type 
    CHECK (action_type IN ('create_evermark', 'vote', 'stake'))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_beta_points_wallet 
ON beta_points(wallet_address);

CREATE INDEX IF NOT EXISTS idx_beta_points_total_desc 
ON beta_points(total_points DESC);

CREATE INDEX IF NOT EXISTS idx_beta_point_transactions_wallet 
ON beta_point_transactions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_beta_point_transactions_action 
ON beta_point_transactions(action_type);

CREATE INDEX IF NOT EXISTS idx_beta_point_transactions_created 
ON beta_point_transactions(created_at DESC);

-- Add updated_at trigger for beta_points
CREATE OR REPLACE FUNCTION update_beta_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beta_points_updated_at
  BEFORE UPDATE ON beta_points
  FOR EACH ROW
  EXECUTE FUNCTION update_beta_points_updated_at();

-- Add comments for documentation
COMMENT ON TABLE beta_points IS 'User point totals for beta rewards system';
COMMENT ON TABLE beta_point_transactions IS 'Audit trail of all point-earning actions';
COMMENT ON COLUMN beta_points.wallet_address IS 'User wallet address (matches user_settings)';
COMMENT ON COLUMN beta_points.total_points IS 'Current total points for this user';
COMMENT ON COLUMN beta_point_transactions.action_type IS 'Type of action that earned points';
COMMENT ON COLUMN beta_point_transactions.points_earned IS 'Points awarded for this action';
COMMENT ON COLUMN beta_point_transactions.related_id IS 'Reference to related entity (evermark ID, etc)';