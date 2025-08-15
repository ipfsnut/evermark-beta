// Chain synchronization utilities
import { createThirdwebClient, getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getNFT, totalSupply } from 'thirdweb/extensions/erc721';
import { supabase } from '../supabase';

// Initialize Thirdweb client
const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID!
});

// Get contract instance
const contract = getContract({
  client,
  chain: base,
  address: import.meta.env.VITE_EVERMARK_NFT_ADDRESS!
});

export interface ChainEvermark {
  tokenId: number;
  metadataUri: string;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{ trait_type: string; value: any }>;
  };
}

/**
 * Sync recent evermarks from chain to database
 */
export async function syncRecentEvermarks(count: number = 10): Promise<{
  synced: number;
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let synced = 0;
  let processed = 0;

  try {
    // Get total supply from contract
    const supply = await totalSupply({ contract });
    const totalSupplyNumber = Number(supply);
    
    console.log(`📊 Total supply: ${totalSupplyNumber}, syncing last ${count}`);

    if (totalSupplyNumber === 0) {
      return { synced: 0, processed: 0, errors: ['No tokens exist yet'] };
    }

    // Get the most recent tokenIds
    const startId = Math.max(1, totalSupplyNumber - count + 1);
    const endId = totalSupplyNumber;

    console.log(`🔄 Syncing tokenIds ${startId} to ${endId}`);

    for (let tokenId = startId; tokenId <= endId; tokenId++) {
      try {
        // Check if we already have this evermark in DB
        const { data: existing } = await supabase
          .from('evermarks')
          .select('token_id, image_processing_status')
          .eq('token_id', tokenId)
          .single();

        if (existing) {
          console.log(`✅ TokenId ${tokenId} already exists`);
          continue;
        }

        // Fetch NFT metadata from chain
        const nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
        
        if (!nft.metadata) {
          errors.push(`TokenId ${tokenId}: No metadata found`);
          continue;
        }

        // Parse metadata
        const metadata = nft.metadata;
        const evermarkData = {
          token_id: tokenId,
          title: metadata.name || `Evermark #${tokenId}`,
          description: metadata.description || '',
          author: extractAuthor(metadata.attributes),
          creator: extractCreator(metadata.attributes),
          content_type: extractContentType(metadata.attributes),
          source_url: extractSourceUrl(metadata.attributes),
          processed_image_url: metadata.image,
          ipfs_image_hash: extractIpfsHash(metadata.image),
          image_processing_status: 'pending' as const,
          verified: false,
          tags: extractTags(metadata.attributes),
          metadata_uri: nft.tokenURI || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Insert into database
        const { error: insertError } = await supabase
          .from('evermarks')
          .insert([evermarkData]);

        if (insertError) {
          errors.push(`TokenId ${tokenId}: Insert failed - ${insertError.message}`);
          continue;
        }

        synced++;
        console.log(`✅ Synced tokenId ${tokenId}: ${metadata.name}`);

        // Mark for processing if has image
        if (metadata.image) {
          processed++;
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`TokenId ${tokenId}: ${errorMsg}`);
        console.error(`❌ Failed to sync tokenId ${tokenId}:`, error);
      }
    }

    console.log(`🎉 Sync complete: ${synced} synced, ${processed} ready for processing`);
    
    return { synced, processed, errors };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(`Sync failed: ${errorMsg}`);
    console.error('❌ Chain sync failed:', error);
    
    return { synced, processed, errors };
  }
}

/**
 * Get single evermark from chain
 */
export async function getEvermarkFromChain(tokenId: number): Promise<ChainEvermark | null> {
  try {
    const nft = await getNFT({ contract, tokenId: BigInt(tokenId) });
    
    if (!nft.metadata) {
      return null;
    }

    return {
      tokenId,
      metadataUri: nft.tokenURI || '',
      metadata: nft.metadata
    };
  } catch (error) {
    console.error(`Failed to get tokenId ${tokenId} from chain:`, error);
    return null;
  }
}

/**
 * Check which evermarks need processing
 */
export async function getPendingEvermarks(): Promise<Array<{
  token_id: number;
  processed_image_url: string;
  ipfs_image_hash?: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('evermarks')
      .select('token_id, processed_image_url, ipfs_image_hash')
      .eq('image_processing_status', 'pending')
      .not('processed_image_url', 'is', null)
      .order('token_id', { ascending: false })
      .limit(50); // Process in batches

    if (error) {
      console.error('Failed to get pending evermarks:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting pending evermarks:', error);
    return [];
  }
}

// Helper functions to extract data from NFT attributes
function extractAuthor(attributes?: Array<{ trait_type: string; value: any }>): string {
  const authorAttr = attributes?.find(attr => 
    attr.trait_type.toLowerCase() === 'author' || 
    attr.trait_type.toLowerCase() === 'creator'
  );
  return authorAttr?.value || 'Unknown';
}

function extractCreator(attributes?: Array<{ trait_type: string; value: any }>): string {
  const creatorAttr = attributes?.find(attr => 
    attr.trait_type.toLowerCase() === 'creator' ||
    attr.trait_type.toLowerCase() === 'minted_by'
  );
  return creatorAttr?.value || 'Unknown';
}

function extractContentType(attributes?: Array<{ trait_type: string; value: any }>): string {
  const typeAttr = attributes?.find(attr => 
    attr.trait_type.toLowerCase() === 'content_type' ||
    attr.trait_type.toLowerCase() === 'type'
  );
  return typeAttr?.value || 'Custom';
}

function extractSourceUrl(attributes?: Array<{ trait_type: string; value: any }>): string | null {
  const urlAttr = attributes?.find(attr => 
    attr.trait_type.toLowerCase() === 'source_url' ||
    attr.trait_type.toLowerCase() === 'url'
  );
  return urlAttr?.value || null;
}

function extractTags(attributes?: Array<{ trait_type: string; value: any }>): string[] {
  const tagsAttr = attributes?.find(attr => 
    attr.trait_type.toLowerCase() === 'tags'
  );
  
  if (typeof tagsAttr?.value === 'string') {
    return tagsAttr.value.split(',').map(tag => tag.trim());
  }
  
  if (Array.isArray(tagsAttr?.value)) {
    return tagsAttr.value.map(tag => String(tag).trim());
  }
  
  return [];
}

function extractIpfsHash(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  
  // Extract IPFS hash from various URL formats
  const ipfsMatch = imageUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (ipfsMatch) {
    return ipfsMatch[1];
  }
  
  // Direct hash
  const hashMatch = imageUrl.match(/^(Qm[a-zA-Z0-9]{44}|[a-zA-Z0-9]{46,})$/);
  if (hashMatch) {
    return hashMatch[1];
  }
  
  return null;
}