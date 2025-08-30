-- Add referrer_address column to beta_evermarks table
-- Migration: Add referral tracking support

-- Add referrer_address column
ALTER TABLE beta_evermarks 
ADD COLUMN IF NOT EXISTS referrer_address TEXT;

-- Add index for referrer queries
CREATE INDEX IF NOT EXISTS idx_beta_evermarks_referrer 
ON beta_evermarks(referrer_address) 
WHERE referrer_address IS NOT NULL;

-- Add check constraint to ensure valid Ethereum address format
ALTER TABLE beta_evermarks 
ADD CONSTRAINT check_referrer_address_format 
CHECK (
  referrer_address IS NULL OR 
  (
    referrer_address ~ '^0x[a-fA-F0-9]{40}$' AND
    LENGTH(referrer_address) = 42
  )
);

-- Update existing rows to have NULL referrer_address (default)
-- No action needed as new column defaults to NULL

-- Add comment for documentation
COMMENT ON COLUMN beta_evermarks.referrer_address IS 'Ethereum address of the referrer who gets 10% of minting fee, must be valid 0x... format';