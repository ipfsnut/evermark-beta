// Simple chain sync - no heavy dependencies
import { createThirdwebClient, getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getNFT, totalSupply } from 'thirdweb/extensions/erc721';
import { supabase } from './supabase';

const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID!
});

const contract = getContract({
  client,
  chain: base,
  address: import.meta.env.VITE_EVERMARK_NFT_ADDRESS!
});

/**
 * Sync recent evermarks from chain to database
 */
export async function syncRecentEvermarks(count: number = 10) {
  try {
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
        .from('evermarks')
        .select('token_id')
        .eq('token_id', tokenId)
        .single();

      if (existing) continue;

      // Get NFT from chain
      const nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
      if (!nft.metadata) continue;

      const metadata = nft.metadata;
      
      // Insert into database
      const { error } = await supabase
        .from('evermarks')
        .insert([{
          token_id: tokenId,
          title: metadata.name || `Evermark #${tokenId}`,
          description: metadata.description || '',
          author: extractFromAttributes(metadata.attributes, 'author') || 'Unknown',
          creator: extractFromAttributes(metadata.attributes, 'creator') || 'Unknown',
          content_type: extractFromAttributes(metadata.attributes, 'content_type') || 'Custom',
          source_url: extractFromAttributes(metadata.attributes, 'source_url'),
          processed_image_url: metadata.image,
          ipfs_image_hash: extractIpfsHash(metadata.image),
          image_processing_status: metadata.image ? 'pending' : 'none',
          verified: false,
          metadata_uri: nft.tokenURI || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (!error) {
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
  const { data, error } = await supabase
    .from('evermarks')
    .select('token_id, processed_image_url, ipfs_image_hash')
    .eq('image_processing_status', 'pending')
    .not('processed_image_url', 'is', null)
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