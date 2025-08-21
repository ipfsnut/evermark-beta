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
      // Check if already exists and if it needs image data
      const { data: existing } = await supabase
        .from('beta_evermarks')
        .select('token_id, ipfs_image_hash, supabase_image_url')
        .eq('token_id', tokenId)
        .single();

      // Skip if already exists AND has image data
      if (existing && (existing.ipfs_image_hash || existing.supabase_image_url)) {
        console.log(`⏭️ Token ${tokenId} already has image data, skipping`);
        continue;
      }
      
      const isUpdate = !!existing;

      // Get NFT from chain
      let nft: any;
      let metadata: any;
      let ipfsMetadata: any = null;
      let imageUrl: string | null = null;
      let ipfsImageHash: string | null = null;
      
      try {
        nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
        if (!nft.metadata) {
          console.log(`⚠️ No metadata for token ${tokenId}, skipping`);
          continue;
        }
        metadata = nft.metadata;
        
        // Try to fetch additional IPFS metadata if tokenURI is available
        if (nft.tokenURI && nft.tokenURI.startsWith('ipfs://')) {
          try {
            const ipfsHash = nft.tokenURI.replace('ipfs://', '');
            console.log(`🔍 Fetching IPFS metadata for token ${tokenId}: ${ipfsHash}`);
            
            // Try multiple IPFS gateways
            const gateways = [
              `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
              `https://ipfs.io/ipfs/${ipfsHash}`,
              `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
            ];
            
            for (const gateway of gateways) {
              try {
                const response = await fetch(gateway, { 
                  signal: AbortSignal.timeout(10000) // 10 second timeout
                });
                if (response.ok) {
                  ipfsMetadata = await response.json();
                  console.log(`✅ Retrieved IPFS metadata from ${gateway}`);
                  
                  // Extract image URL
                  if (ipfsMetadata?.image) {
                    imageUrl = ipfsMetadata.image;
                    if (imageUrl?.startsWith('ipfs://')) {
                      ipfsImageHash = imageUrl.replace('ipfs://', '');
                      imageUrl = `https://gateway.pinata.cloud/ipfs/${ipfsImageHash}`;
                    }
                    console.log(`🖼️ Found image URL: ${imageUrl}`);
                  }
                  break;
                }
              } catch (gatewayError) {
                console.warn(`Gateway ${gateway} failed:`, gatewayError instanceof Error ? gatewayError.message : gatewayError);
                continue;
              }
            }
          } catch (ipfsError) {
            console.warn(`Failed to fetch IPFS metadata for token ${tokenId}:`, ipfsError instanceof Error ? ipfsError.message : ipfsError);
          }
        }
        
      } catch (error) {
        console.error(`❌ Failed to fetch metadata for token ${tokenId}:`, error instanceof Error ? error.message : error);
        continue;
      }
      
      // Insert into database - using beta_evermarks schema
      const insertData = {
        token_id: tokenId,
        title: (ipfsMetadata?.name || (metadata as any)?.name) || `Evermark #${tokenId}`,
        description: (ipfsMetadata?.description || (metadata as any)?.description) || '',
        author: extractFromAttributes((ipfsMetadata?.attributes || (metadata as any)?.attributes) as any[], 'author') || 'Unknown',
        owner: extractFromAttributes((ipfsMetadata?.attributes || (metadata as any)?.attributes) as any[], 'creator') || 'Unknown',
        content_type: extractFromAttributes((ipfsMetadata?.attributes || (metadata as any)?.attributes) as any[], 'content_type') || 'Custom',
        source_url: extractFromAttributes((ipfsMetadata?.attributes || (metadata as any)?.attributes) as any[], 'source_url'),
        token_uri: nft.tokenURI || '',
        verified: false,
        metadata_fetched: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata_json: metadata ? JSON.stringify(metadata, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ) : undefined,
        ipfs_metadata: ipfsMetadata ? JSON.stringify(ipfsMetadata) : undefined,
        ipfs_image_hash: ipfsImageHash || undefined,
        supabase_image_url: imageUrl || undefined, // Store the resolved image URL directly for now
        // Note: removed fields that don't exist in beta_evermarks
      };
      
      console.log(`📝 ${isUpdate ? 'Updating' : 'Inserting'} token ${tokenId}:`, insertData);
      
      let error;
      if (isUpdate) {
        const { error: updateError } = await supabase
          .from('beta_evermarks')
          .update(insertData)
          .eq('token_id', tokenId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('beta_evermarks')
          .insert([insertData]);
        error = insertError;
      }

      if (error) {
        console.error(`❌ ${isUpdate ? 'Update' : 'Insert'} failed for token ${tokenId}:`, error);
      } else {
        console.log(`✅ Successfully ${isUpdate ? 'updated' : 'inserted'} token ${tokenId}`);
        synced++;
        if (imageUrl) needsCache++;
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