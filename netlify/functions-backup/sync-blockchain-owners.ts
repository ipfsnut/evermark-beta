import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createThirdwebClient, defineChain, getContract } from 'thirdweb';
import { ownerOf } from 'thirdweb/extensions/erc721';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const client = createThirdwebClient({ 
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID! 
});

const chain = defineChain(8453); // Base
const contract = getContract({
  client,
  chain,
  address: process.env.VITE_EVERMARK_NFT_ADDRESS!
});

const EVERMARKS_TABLE = 'beta_evermarks';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Resolve user profile information via API endpoint
 */
async function resolveProfile(address: string): Promise<{ displayName: string; source: string }> {
  try {
    const response = await fetch(`http://localhost:8888/.netlify/functions/resolve-profile?address=${address}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.profile) {
        return {
          displayName: data.profile.displayName,
          source: data.profile.source
        };
      }
    }
  } catch (error) {
    console.warn('⚠️ Profile resolution API failed:', error);
  }
  
  // Fallback to truncated address
  return {
    displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
    source: 'address'
  };
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { tokenIds } = body;
    
    if (!tokenIds || !Array.isArray(tokenIds)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'tokenIds array required' }),
      };
    }

    console.log(`🔄 Syncing blockchain owners for tokens: ${tokenIds.join(', ')}`);

    const results: Array<{
      tokenId: number;
      success: boolean;
      error?: string;
      blockchainOwner?: string;
      displayName?: string;
    }> = [];
    
    for (const tokenId of tokenIds) {
      try {
        console.log(`\n🔍 Processing token #${tokenId}`);
        
        // 1. Get real owner from blockchain
        const blockchainOwner = await ownerOf({
          contract,
          tokenId: BigInt(tokenId)
        });
        
        console.log(`📍 Blockchain owner: ${blockchainOwner}`);
        
        // 2. Resolve profile info
        const profile = await resolveProfile(blockchainOwner);
        
        // 3. Update database
        const { data, error } = await supabase
          .from(EVERMARKS_TABLE)
          .update({
            owner: blockchainOwner.toLowerCase(),
            author: profile.displayName,
            updated_at: new Date().toISOString(),
            metadata_json: JSON.stringify({
              tags: ['synced'],
              customFields: [
                { key: 'blockchain_owner', value: blockchainOwner },
                { key: 'sync_source', value: 'blockchain' }
              ]
            })
          })
          .eq('token_id', tokenId)
          .select()
          .single();
          
        if (error) {
          console.error(`❌ Failed to update token #${tokenId}:`, error);
          results.push({
            tokenId,
            success: false,
            error: error.message
          });
        } else {
          console.log(`✅ Updated token #${tokenId} owner: ${profile.displayName}`);
          results.push({
            tokenId,
            success: true,
            blockchainOwner,
            displayName: profile.displayName
          });
        }
        
      } catch (error) {
        console.error(`❌ Error processing token #${tokenId}:`, error);
        results.push({
          tokenId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n📈 Sync Summary: ${successful.length} successful, ${failed.length} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Synced ${successful.length} of ${results.length} tokens`,
        results: {
          successful,
          failed
        },
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length
        }
      }),
    };

  } catch (error) {
    console.error('❌ Blockchain sync failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};