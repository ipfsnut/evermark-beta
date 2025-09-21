-- Migration: Add ArDrive support to beta_evermarks table
-- Description: Adds columns to support ArDrive storage alongside existing IPFS storage
-- Author: System Migration
-- Date: 2025-01-20

-- Add ArDrive storage columns to beta_evermarks table
ALTER TABLE beta_evermarks 
ADD COLUMN IF NOT EXISTS storage_backend TEXT DEFAULT 'ipfs',
ADD COLUMN IF NOT EXISTS ardrive_tx_id TEXT,
ADD COLUMN IF NOT EXISTS ardrive_image_tx TEXT,
ADD COLUMN IF NOT EXISTS ardrive_metadata_tx TEXT,
ADD COLUMN IF NOT EXISTS ardrive_folder_path TEXT,
ADD COLUMN IF NOT EXISTS ardrive_manifest_url TEXT,
ADD COLUMN IF NOT EXISTS ardrive_tags JSONB,
ADD COLUMN IF NOT EXISTS ardrive_cost_usd DECIMAL(10, 6),
ADD COLUMN IF NOT EXISTS ardrive_uploaded_at TIMESTAMP WITH TIME ZONE;

-- Add storage backend constraint
ALTER TABLE beta_evermarks 
ADD CONSTRAINT IF NOT EXISTS check_storage_backend 
CHECK (storage_backend IN ('ipfs', 'ardrive', 'dual'));

-- Add indexes for ArDrive lookups
CREATE INDEX IF NOT EXISTS idx_beta_evermarks_ardrive_tx 
ON beta_evermarks(ardrive_tx_id);

CREATE INDEX IF NOT EXISTS idx_beta_evermarks_storage_backend 
ON beta_evermarks(storage_backend);

CREATE INDEX IF NOT EXISTS idx_beta_evermarks_ardrive_folder 
ON beta_evermarks(ardrive_folder_path);

-- Create composite index for ArDrive queries
CREATE INDEX IF NOT EXISTS idx_beta_evermarks_ardrive_composite 
ON beta_evermarks(storage_backend, ardrive_uploaded_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN beta_evermarks.storage_backend IS 'Storage system used: ipfs, ardrive, or dual';
COMMENT ON COLUMN beta_evermarks.ardrive_tx_id IS 'ArDrive/Arweave transaction ID for metadata';
COMMENT ON COLUMN beta_evermarks.ardrive_image_tx IS 'ArDrive/Arweave transaction ID for image';
COMMENT ON COLUMN beta_evermarks.ardrive_metadata_tx IS 'ArDrive/Arweave transaction ID for JSON metadata';
COMMENT ON COLUMN beta_evermarks.ardrive_folder_path IS 'Path within ArDrive folder structure';
COMMENT ON COLUMN beta_evermarks.ardrive_manifest_url IS 'URL to ArDrive season manifest';
COMMENT ON COLUMN beta_evermarks.ardrive_tags IS 'JSON object of ArDrive tags used for upload';
COMMENT ON COLUMN beta_evermarks.ardrive_cost_usd IS 'Cost in USD for permanent storage';
COMMENT ON COLUMN beta_evermarks.ardrive_uploaded_at IS 'Timestamp when uploaded to ArDrive';

-- Create storage metrics table for monitoring
CREATE TABLE IF NOT EXISTS storage_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backend TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'upload', 'retrieve', 'estimate'
  success BOOLEAN NOT NULL,
  duration_ms INTEGER,
  file_size_bytes BIGINT,
  cost_usd DECIMAL(10, 6),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for metrics
CREATE INDEX IF NOT EXISTS idx_storage_metrics_backend 
ON storage_metrics(backend);

CREATE INDEX IF NOT EXISTS idx_storage_metrics_created_at 
ON storage_metrics(created_at DESC);

-- Add constraint
ALTER TABLE storage_metrics 
ADD CONSTRAINT IF NOT EXISTS check_storage_metrics_backend 
CHECK (backend IN ('ipfs', 'ardrive'));

ALTER TABLE storage_metrics 
ADD CONSTRAINT IF NOT EXISTS check_storage_metrics_operation 
CHECK (operation IN ('upload', 'retrieve', 'estimate', 'folder_create'));

COMMENT ON TABLE storage_metrics IS 'Metrics and performance data for storage operations';