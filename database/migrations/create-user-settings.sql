-- Create user_settings table for per-account referrer tracking
-- Migration: User-level settings including referrer setup

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  referrer_address TEXT,
  referrer_set_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure valid Ethereum address format
  CONSTRAINT check_wallet_address_format 
    CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$' AND LENGTH(wallet_address) = 42),
  
  CONSTRAINT check_referrer_address_format 
    CHECK (
      referrer_address IS NULL OR 
      (referrer_address ~ '^0x[a-fA-F0-9]{40}$' AND LENGTH(referrer_address) = 42)
    ),
    
  -- Prevent self-referral
  CONSTRAINT check_no_self_referral 
    CHECK (referrer_address IS NULL OR wallet_address != referrer_address)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_wallet 
ON user_settings(wallet_address);

CREATE INDEX IF NOT EXISTS idx_user_settings_referrer 
ON user_settings(referrer_address) 
WHERE referrer_address IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE user_settings IS 'Per-account user settings including referrer relationships';
COMMENT ON COLUMN user_settings.wallet_address IS 'User wallet address (unique identifier)';
COMMENT ON COLUMN user_settings.referrer_address IS 'Address that receives 10% of this users minting fees';
COMMENT ON COLUMN user_settings.referrer_set_at IS 'When the referrer was first set (for analytics)';

-- Remove the old per-evermark referrer column (optional cleanup)
-- ALTER TABLE beta_evermarks DROP COLUMN IF EXISTS referrer_address;