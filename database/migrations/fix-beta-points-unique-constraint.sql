-- Fix beta_points table to prevent duplicate wallet addresses
-- This will consolidate existing duplicates and add unique constraint

BEGIN;

-- First, consolidate duplicate records by wallet address
-- Create temporary table with correct totals
CREATE TEMP TABLE correct_totals AS 
SELECT 
  wallet_address,
  SUM(total_points) as correct_total,
  MIN(created_at) as earliest_created,
  MAX(updated_at) as latest_updated
FROM beta_points 
GROUP BY wallet_address;

-- Delete all records from beta_points
DELETE FROM beta_points;

-- Insert consolidated records
INSERT INTO beta_points (wallet_address, total_points, created_at, updated_at)
SELECT 
  wallet_address,
  correct_total,
  earliest_created,
  latest_updated
FROM correct_totals;

-- Add unique constraint on wallet_address
ALTER TABLE beta_points 
ADD CONSTRAINT unique_wallet_address UNIQUE (wallet_address);

COMMIT;

-- Verify the fix
SELECT 
  wallet_address, 
  total_points,
  COUNT(*) as record_count
FROM beta_points 
GROUP BY wallet_address, total_points
HAVING COUNT(*) > 1;  -- Should return no rows