-- Author Fix Migration for All Content Types
-- Fix the author field for evermarks that currently show wallet addresses
-- instead of the actual content authors

-- Before running, verify current state:
-- SELECT token_id, title, author, owner, content_type, source_url 
-- FROM beta_evermarks 
-- WHERE content_type IN ('Cast', 'DOI', 'ISBN')
-- ORDER BY content_type, token_id;

BEGIN;

-- Fix Cast Evermarks
-- Token 5: kompreni cast
UPDATE beta_evermarks 
SET 
    author = 'kompreni',
    updated_at = NOW()
WHERE 
    token_id = 5 
    AND content_type = 'Cast'
    AND source_url = 'https://farcaster.xyz/kompreni/0xa9f15161'
    AND author = '0x2B27...3fe3';

-- Token 4: horsefacts.eth cast  
UPDATE beta_evermarks
SET
    author = 'horsefacts.eth', 
    updated_at = NOW()
WHERE
    token_id = 4
    AND content_type = 'Cast'
    AND source_url = 'https://farcaster.xyz/horsefacts.eth/0x941d16c5'
    AND author = '0x2B27...3fe3';

-- Fix Twitter/X URLs that should be Tweets
-- Token 7: Twitter post misclassified as URL
UPDATE beta_evermarks
SET
    content_type = 'Tweet',
    author = 'popfi',
    updated_at = NOW()
WHERE
    token_id = 7
    AND content_type = 'URL'
    AND source_url = 'https://x.com/popfinance_/status/1949250578435195141?s=46'
    AND author = '0x58e5...5afa';

-- Fix DOI Evermarks
-- Token 6: Academic paper with multiple authors
UPDATE beta_evermarks
SET
    author = 'Ceyda Sayalı et al.',
    metadata_json = COALESCE(metadata_json::jsonb, '{}'::jsonb) || jsonb_build_object(
        'academic', jsonb_build_object(
            'authors', jsonb_build_array(
                jsonb_build_object('given', 'Ceyda', 'family', 'Sayalı', 'name', 'Ceyda Sayalı'),
                jsonb_build_object('given', 'Jordan', 'family', 'Rubin-McGregor', 'name', 'Jordan Rubin-McGregor'),
                jsonb_build_object('given', 'David', 'family', 'Badre', 'name', 'David Badre')
            ),
            'primaryAuthor', 'Ceyda Sayalı et al.',
            'journal', 'Journal of Experimental Psychology: General',
            'publishedDate', '2023-12'
        ),
        'customFields', (
            COALESCE((metadata_json::jsonb->'customFields')::jsonb, '[]'::jsonb) || 
            jsonb_build_array(
                jsonb_build_object('key', 'primary_author', 'value', 'Ceyda Sayalı et al.'),
                jsonb_build_object('key', 'total_authors', 'value', '3'),
                jsonb_build_object('key', 'all_authors', 'value', 'Ceyda Sayalı; Jordan Rubin-McGregor; David Badre'),
                jsonb_build_object('key', 'journal', 'value', 'Journal of Experimental Psychology: General'),
                jsonb_build_object('key', 'published_date', 'value', '2023-12')
            )
        )
    ),
    updated_at = NOW()
WHERE 
    token_id = 6
    AND content_type = 'DOI'
    AND source_url = 'https://doi.org/10.1037/xge0001449'
    AND author = '0x18a8...2a3c';

-- Verify the changes
SELECT 
    token_id,
    title, 
    author,
    owner,
    content_type,
    source_url,
    updated_at,
    CASE 
        WHEN content_type = 'DOI' THEN metadata_json::jsonb->'academic'->'authors'
        WHEN content_type = 'Tweet' THEN jsonb_build_object('tweet_author', author)
        ELSE NULL 
    END as extracted_metadata
FROM beta_evermarks 
WHERE content_type IN ('Cast', 'DOI', 'ISBN', 'Tweet')
ORDER BY content_type, token_id;

COMMIT;