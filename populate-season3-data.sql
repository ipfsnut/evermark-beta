-- SQL to populate votes and leaderboard tables with season 3 data
-- Run this in Supabase SQL editor to populate database with blockchain data

-- First, let's see what we have in our votes table currently
SELECT COUNT(*) as current_vote_count FROM votes WHERE cycle = 3;

-- Check current leaderboard entries
SELECT COUNT(*) as current_leaderboard_count FROM leaderboard WHERE cycle_id = 3;

-- We need to populate this data from blockchain events
-- Since we can't directly query blockchain from SQL, we'll need to use a Netlify function
-- to read blockchain data and insert it into our database

-- For now, let's create a structure to validate our tables are ready:

-- Check votes table structure
SELECT column_name, data_type, is_nullable 

FROM information_schema.columns 
WHERE table_name = 'votes' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check leaderboard table structure  
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'leaderboard' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Sample insert for votes table (replace with actual blockchain data):
-- INSERT INTO votes (user_id, evermark_id, cycle, amount, action, metadata) VALUES
-- ('0x1234...', '1', 3, '1000000000000000000', 'delegate', '{"transaction_hash": "0xabc..."}');

-- Sample insert for leaderboard table (replace with calculated totals):
-- INSERT INTO leaderboard (evermark_id, cycle_id, total_votes, rank) VALUES
-- ('1', 3, '5000000000000000000', 1);

-- After populating data, we can query to verify:
-- SELECT COUNT(*) as total_votes FROM votes WHERE cycle = 3;
-- SELECT COUNT(*) as total_leaderboard_entries FROM leaderboard WHERE cycle_id = 3;
-- SELECT evermark_id, total_votes, rank FROM leaderboard WHERE cycle_id = 3 ORDER BY rank LIMIT 10;