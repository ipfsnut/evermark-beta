import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const EVERMARKS_TABLE = 'beta_evermarks';

// Admin address for authorization (same as dev wallet)
const ADMIN_ADDRESS = '0x3427b4716B90C11F9971e43999a48A47Cf5B571E'.toLowerCase();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface CastMetadata {
  castHash: string;
  author: string;
  username: string;
  content: string;
  timestamp: string;
}

function extractCastHash(url: string): string | null {
  const hashMatch = url.match(/0x[a-fA-F0-9]+/);
  return hashMatch ? hashMatch[0] : null;
}

function extractUsernameFromUrl(url: string): string | null {
  // Extract username from farcaster.xyz URLs: https://farcaster.xyz/kompreni/0xa9f15161
  const match = url.match(/farcaster\.xyz\/([^/]+)\/0x[a-fA-F0-9]+/);
  return match ? match[1] : null;
}

async function fetchCastMetadata(sourceUrl: string): Promise<CastMetadata | null> {
  try {
    console.log(`Fetching cast metadata for: ${sourceUrl}`);
    
    const castHash = extractCastHash(sourceUrl);
    if (!castHash) {
      throw new Error('Could not extract cast hash from URL');
    }

    // For now, use URL extraction as the primary method since API might not be available
    const username = extractUsernameFromUrl(sourceUrl);
    if (username) {
      return {
        castHash,
        author: username,
        username: username,
        content: 'Cast content from farcaster.xyz',
        timestamp: new Date().toISOString(),
      };
    }
    
    throw new Error('Could not extract cast metadata');
  } catch (error) {
    console.error(`Failed to fetch cast metadata:`, error);
    return null;
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check admin authorization
    const walletAddress = event.headers['x-wallet-address'] || event.headers['X-Wallet-Address'];
    if (!walletAddress || walletAddress.toLowerCase() !== ADMIN_ADDRESS) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { action, dryRun = true } = body;

    if (action === 'migrate') {
      console.log('🔧 Starting cast author migration...');
      
      // Step 1: Fetch all cast evermarks
      const { data: castEvermarks, error: fetchError } = await supabase
        .from(EVERMARKS_TABLE)
        .select('*')
        .eq('content_type', 'Cast');

      if (fetchError) {
        throw new Error(`Failed to fetch cast evermarks: ${fetchError.message}`);
      }

      console.log(`Found ${castEvermarks?.length || 0} cast evermarks`);

      if (!castEvermarks || castEvermarks.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: 'No cast evermarks found to migrate',
            processed: 0,
            updated: 0,
            errors: []
          }),
        };
      }

      // Step 2: Process each evermark
      const results = {
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: [] as string[]
      };

      for (const evermark of castEvermarks) {
        try {
          console.log(`Processing token ${evermark.token_id}...`);
          
          // Check if author looks like a wallet address (needs fixing)
          const hasWalletAuthor = evermark.author && (
            evermark.author.match(/^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/) ||
            evermark.author.match(/^0x[a-fA-F0-9]{40}$/i)
          );

          if (!hasWalletAuthor) {
            console.log(`Token ${evermark.token_id} author "${evermark.author}" looks correct, skipping`);
            results.skipped++;
            continue;
          }

          // Fetch correct cast metadata
          const castData = await fetchCastMetadata(evermark.source_url);
          
          if (!castData || !castData.author) {
            const error = `Token ${evermark.token_id}: Could not determine correct author from ${evermark.source_url}`;
            console.error(error);
            results.errors.push(error);
            continue;
          }

          const newAuthor = castData.username || castData.author;
          console.log(`Token ${evermark.token_id}: "${evermark.author}" -> "${newAuthor}"`);

          if (newAuthor === evermark.author) {
            console.log(`Token ${evermark.token_id} author already correct`);
            results.skipped++;
            continue;
          }

          results.processed++;

          if (!dryRun) {
            // Update the database record
            const { error: updateError } = await supabase
              .from(EVERMARKS_TABLE)
              .update({ 
                author: newAuthor,
                updated_at: new Date().toISOString()
              })
              .eq('token_id', evermark.token_id);

            if (updateError) {
              const error = `Token ${evermark.token_id}: Database update failed - ${updateError.message}`;
              console.error(error);
              results.errors.push(error);
              continue;
            }

            console.log(`✅ Updated token ${evermark.token_id} author to "${newAuthor}"`);
            results.updated++;
          } else {
            console.log(`🔍 DRY RUN: Would update token ${evermark.token_id} author to "${newAuthor}"`);
          }

        } catch (error) {
          const errorMsg = `Token ${evermark.token_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          dryRun,
          message: dryRun ? 'Migration preview completed' : 'Migration completed',
          ...results
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action. Use action: "migrate"' }),
    };

  } catch (error) {
    console.error('Migration function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};