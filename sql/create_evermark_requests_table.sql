-- Create table for tracking evermark requests from bot
CREATE TABLE IF NOT EXISTS evermark_requests (
  id BIGSERIAL PRIMARY KEY,
  requester_fid INTEGER NOT NULL,
  requester_username TEXT NOT NULL,
  request_cast_hash TEXT NOT NULL,
  parent_cast_hash TEXT,
  parent_cast_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  token_id INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_evermark_requests_requester_fid ON evermark_requests(requester_fid);
CREATE INDEX IF NOT EXISTS idx_evermark_requests_created_at ON evermark_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_evermark_requests_status ON evermark_requests(status);
CREATE INDEX IF NOT EXISTS idx_evermark_requests_parent_cast_hash ON evermark_requests(parent_cast_hash);

-- Add RLS (Row Level Security) if needed
-- ALTER TABLE evermark_requests ENABLE ROW LEVEL SECURITY;