// Simple chain sync - no heavy dependencies
import { createThirdwebClient, getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getNFT, totalSupply } from 'thirdweb/extensions/erc721';
import { createClient } from '@supabase/supabase-js';

// Environment variables for server-side execution
const getClientId = () => {
  // Try Netlify Functions environment first
  if (typeof process !== 'undefined' && process.env?.VITE_THIRDWEB_CLIENT_ID) {
    return process.env.VITE_THIRDWEB_CLIENT_ID;
  }
  
  // Try browser environment
  try {
    // @ts-ignore - import.meta.env is available in browser
    if (import.meta?.env?.VITE_THIRDWEB_CLIENT_ID) {
      // @ts-ignore
      return import.meta.env.VITE_THIRDWEB_CLIENT_ID;
    }
  } catch (e) {
    // Not in browser environment
  }
  
  throw new Error('Thirdweb Client ID not found');
};

const getNFTAddress = () => {
  // Try Netlify Functions environment first
  if (typeof process !== 'undefined' && process.env?.VITE_EVERMARK_NFT_ADDRESS) {
    return process.env.VITE_EVERMARK_NFT_ADDRESS;
  }
  
  // Try browser environment
  try {
    // @ts-ignore - import.meta.env is available in browser
    if (import.meta?.env?.VITE_EVERMARK_NFT_ADDRESS) {
      // @ts-ignore
      return import.meta.env.VITE_EVERMARK_NFT_ADDRESS;
    }
  } catch (e) {
    // Not in browser environment
  }
  
  throw new Error('Evermark NFT address not found');
};

const getSupabaseClient = () => {
  let supabaseUrl: string = '';
  let supabaseKey: string = '';
  
  // Try Netlify Functions environment first (no VITE_ prefix)
  if (typeof process !== 'undefined' && process.env) {
    supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  }
  
  // Try browser environment if server env didn't work
  if (!supabaseUrl || !supabaseKey) {
    try {
      // @ts-ignore - import.meta.env is available in browser
      supabaseUrl = supabaseUrl || import.meta?.env?.VITE_SUPABASE_URL || '';
      // @ts-ignore
      supabaseKey = supabaseKey || import.meta?.env?.VITE_SUPABASE_ANON_KEY || '';
    } catch (e) {
      // Not in browser environment
    }
  }
  
  console.log('🔧 Supabase connection attempt:', { 
    hasUrl: !!supabaseUrl, 
    hasKey: !!supabaseKey,
    urlPrefix: supabaseUrl.substring(0, 30) + '...' 
  });
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase URL or key');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

const client = createThirdwebClient({
  clientId: getClientId()
});

const contract = getContract({
  client,
  chain: base,
  address: getNFTAddress()
});

/**
 * Sync recent evermarks from chain to database
 */
export async function syncRecentEvermarks(count: number = 10) {
  try {
    // Get dynamic clients
    const supabase = getSupabaseClient();
    
    const supply = await totalSupply({ contract });
    const totalSupplyNumber = Number(supply);
    
    if (totalSupplyNumber === 0) {
      return { synced: 0, needsCache: 0 };
    }

    const startId = Math.max(1, totalSupplyNumber - count + 1);
    const endId = totalSupplyNumber;
    
    let synced = 0;
    let needsCache = 0;

    for (let tokenId = startId; tokenId <= endId; tokenId++) {
      // Skip if already exists
      const { data: existing } = await supabase
        .from('beta_evermarks')
        .select('token_id')
        .eq('token_id', tokenId)
        .single();

      if (existing) continue;

      // Get NFT from chain
      let nft;
      let metadata;
      try {
        nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
        if (!nft.metadata) {
          console.log(`⚠️ No metadata for token ${tokenId}, skipping`);
          continue;
        }
        metadata = nft.metadata;
      } catch (error) {
        console.error(`❌ Failed to fetch metadata for token ${tokenId}:`, error instanceof Error ? error.message : error);
        continue;
      }
      
      // Insert into database - using beta_evermarks schema
      const insertData = {
        token_id: tokenId,
        title: metadata.name || `Evermark #${tokenId}`,
        description: metadata.description || '',
        author: extractFromAttributes(metadata.attributes as any[], 'author') || 'Unknown',
        owner: extractFromAttributes(metadata.attributes as any[], 'creator') || 'Unknown', // Use owner instead of creator
        content_type: extractFromAttributes(metadata.attributes as any[], 'content_type') || 'Custom',
        source_url: extractFromAttributes(metadata.attributes as any[], 'source_url'),
        token_uri: nft.tokenURI || '',
        verified: false,
        metadata_fetched: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata_json: metadata ? JSON.stringify(metadata, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ) : undefined,
        // Note: removed fields that don't exist in beta_evermarks
      };
      
      console.log(`📝 Inserting token ${tokenId}:`, insertData);
      
      const { error } = await supabase
        .from('beta_evermarks')
        .insert([insertData]);

      if (error) {
        console.error(`❌ Insert failed for token ${tokenId}:`, error);
      } else {
        console.log(`✅ Successfully inserted token ${tokenId}`);
        synced++;
        if (metadata.image) needsCache++;
      }
    }

    return { synced, needsCache };
  } catch (error) {
    console.error('Chain sync failed:', error);
    return { synced: 0, needsCache: 0 };
  }
}

/**
 * Get evermarks that need image caching
 */
export async function getEvermarksNeedingCache() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('beta_evermarks')
    .select('token_id, ipfs_image_hash')
    .eq('image_processing_status', 'pending')
    .not('ipfs_image_hash', 'is', null)
    .limit(20);

  if (error) return [];
  return data || [];
}

// Helper functions
function extractFromAttributes(attributes: any[], key: string): string | null {
  const attr = attributes?.find(attr => 
    attr.trait_type?.toLowerCase() === key.toLowerCase()
  );
  return attr?.value || null;
}

function extractIpfsHash(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}