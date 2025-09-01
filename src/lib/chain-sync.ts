// Simple chain sync - no heavy dependencies
import { createThirdwebClient, getContract } from 'thirdweb';

// Type declaration for process
declare const process: { env?: Record<string, string> } | undefined;
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
    if (typeof globalThis !== 'undefined' && 'importMeta' in globalThis && (globalThis as any).importMeta?.env?.VITE_THIRDWEB_CLIENT_ID) {
      return (globalThis as any).importMeta.env.VITE_THIRDWEB_CLIENT_ID;
    }
    // Fallback for Vite/browser environments
    if (typeof window !== 'undefined' && (window as any).__vite_env?.VITE_THIRDWEB_CLIENT_ID) {
      return (window as any).__vite_env.VITE_THIRDWEB_CLIENT_ID;
    }
  } catch {
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
    if (typeof globalThis !== 'undefined' && 'importMeta' in globalThis && (globalThis as any).importMeta?.env?.VITE_EVERMARK_NFT_ADDRESS) {
      return (globalThis as any).importMeta.env.VITE_EVERMARK_NFT_ADDRESS;
    }
    // Fallback for Vite/browser environments
    if (typeof window !== 'undefined' && (window as any).__vite_env?.VITE_EVERMARK_NFT_ADDRESS) {
      return (window as any).__vite_env.VITE_EVERMARK_NFT_ADDRESS;
    }
  } catch {
    // Not in browser environment
  }
  
  throw new Error('Evermark NFT address not found');
};

const getSupabaseClient = () => {
  let supabaseUrl: string = '';
  let supabaseKey: string = '';
  
  // Try Netlify Functions environment first
  if (typeof process !== 'undefined' && process.env) {
    supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  }
  
  // Try browser environment if server env didn't work
  if (!supabaseUrl || !supabaseKey) {
    try {
      if (typeof globalThis !== 'undefined' && 'importMeta' in globalThis && (globalThis as any).importMeta?.env) {
        supabaseUrl = supabaseUrl || (globalThis as any).importMeta.env.VITE_SUPABASE_URL || '';
        supabaseKey = supabaseKey || (globalThis as any).importMeta.env.VITE_SUPABASE_ANON_KEY || '';
      }
      // Fallback for Vite/browser environments
      if (typeof window !== 'undefined' && (window as any).__vite_env) {
        supabaseUrl = supabaseUrl || (window as any).__vite_env.VITE_SUPABASE_URL || '';
        supabaseKey = supabaseKey || (window as any).__vite_env.VITE_SUPABASE_ANON_KEY || '';
      }
    } catch {
      // Not in browser environment
    }
  }
  
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
      const nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
      if (!nft.metadata) continue;

      const metadata = nft.metadata;
      
      // Insert into database - using beta_evermarks schema
      const { error } = await supabase
        .from('beta_evermarks')
        .insert([{
          token_id: tokenId,
          title: metadata.name || `Evermark #${tokenId}`,
          description: metadata.description || '',
          author: extractFromAttributes(metadata.attributes as unknown[], 'author') || 'Unknown',
          owner: extractFromAttributes(metadata.attributes as unknown[], 'creator') || 'Unknown', // Use owner instead of creator
          content_type: extractFromAttributes(metadata.attributes as unknown[], 'content_type') || 'Custom',
          source_url: extractFromAttributes(metadata.attributes as unknown[], 'source_url'),
          token_uri: nft.tokenURI || '',
          verified: false,
          metadata_fetched: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata_json: metadata ? JSON.stringify(metadata) : undefined,
          // Note: removed fields that don't exist in beta_evermarks
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
function extractFromAttributes(attributes: unknown[], key: string): string | null {
  if (!Array.isArray(attributes)) return null;
  const attr = attributes.find((attr: unknown) => {
    const attribute = attr as { trait_type?: string; value?: string } | null;
    return attribute?.trait_type?.toLowerCase() === key.toLowerCase();
  });
  const attribute = attr as { value?: string } | null;
  return attribute?.value || null;
}

function _extractIpfsHash(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  const match = imageUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}