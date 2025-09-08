-- Add view_count column to beta_evermarks table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'beta_evermarks' 
        AND column_name = 'view_count'
    ) THEN
        ALTER TABLE beta_evermarks ADD COLUMN view_count INTEGER DEFAULT 0;
        
        -- Create index for better performance on view_count queries
        CREATE INDEX IF NOT EXISTS idx_beta_evermarks_view_count ON beta_evermarks(view_count);
        
        -- Update existing records to have view_count = 0
        UPDATE beta_evermarks SET view_count = 0 WHERE view_count IS NULL;
        
        RAISE NOTICE 'Added view_count column to beta_evermarks table';
    ELSE
        RAISE NOTICE 'view_count column already exists in beta_evermarks table';
    END IF;
END $$;

-- Create or replace function to atomically increment view count
CREATE OR REPLACE FUNCTION increment_view_count(p_token_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE beta_evermarks 
    SET 
        view_count = COALESCE(view_count, 0) + 1,
        updated_at = NOW()
    WHERE token_id = p_token_id;
    
    -- If no rows were updated, the token_id doesn't exist
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Evermark with token_id % not found', p_token_id;
    END IF;
END;
$$ LANGUAGE plpgsql;