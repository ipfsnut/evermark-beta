// Smart image URL resolution with fallback strategy
import { supabase } from '../supabase';
import { getImageUrl, isCached } from '../image-cache';

export interface ImageResolution {
  url: string;
  source: 'supabase' | 'pinata' | 'ipfs' | 'fallback';
  cached: boolean;
}

/**
 * Resolve best image URL with fallback strategy (simplified)
 */
export async function resolveImageUrl(
  tokenId: number,
  ipfsHash?: string,
  originalUrl?: string
): Promise<ImageResolution> {
  try {
    // Get evermark data from database
    const { data: evermark } = await supabase!
      .from('evermarks')
      .select('token_id, supabase_image_url, processed_image_url, ipfs_image_hash')
      .eq('token_id', tokenId)
      .single();

    if (evermark) {
      // Use our smart URL resolver from image-cache
      const url = getImageUrl({
        token_id: evermark.token_id,
        supabase_image_url: evermark.supabase_image_url,
        processed_image_url: evermark.processed_image_url,
        ipfs_image_hash: evermark.ipfs_image_hash
      });

      // Determine source and cache status
      let source: ImageResolution['source'] = 'fallback';
      let cached = false;

      if (evermark.supabase_image_url && url === evermark.supabase_image_url) {
        source = 'supabase';
        cached = true;
      } else if (evermark.processed_image_url && url === evermark.processed_image_url) {
        if (evermark.processed_image_url.includes('gateway.pinata.cloud')) {
          source = 'pinata';
        } else {
          source = 'ipfs';
        }
        cached = false;
      }

      return { url, source, cached };
    }

    // Fallback: construct URL from provided data
    if (originalUrl) {
      return {
        url: originalUrl,
        source: originalUrl.includes('gateway.pinata.cloud') ? 'pinata' : 'ipfs',
        cached: false
      };
    }

    if (ipfsHash) {
      return {
        url: `https://ipfs.io/ipfs/${ipfsHash}`,
        source: 'ipfs',
        cached: false
      };
    }

    // Last resort placeholder
    return {
      url: '/placeholder-image.jpg',
      source: 'fallback',
      cached: false
    };

  } catch (error) {
    console.error('Failed to resolve image URL:', error);
    
    // Emergency fallback
    if (originalUrl) {
      return {
        url: originalUrl,
        source: originalUrl.includes('gateway.pinata.cloud') ? 'pinata' : 'ipfs',
        cached: false
      };
    }

    return {
      url: '/placeholder-image.jpg',
      source: 'fallback',
      cached: false
    };
  }
}

/**
 * Check if an evermark has a cached image
 */
export async function checkImageCacheStatus(tokenId: number): Promise<boolean> {
  try {
    const { data: evermark } = await supabase!
      .from('evermarks')
      .select('supabase_image_url')
      .eq('token_id', tokenId)
      .single();

    return evermark ? isCached(evermark) : false;
  } catch (error) {
    console.error('Failed to check cache status:', error);
    return false;
  }
}

/**
 * Get thumbnail URL (same as main image for now since we're not processing)
 */
export async function resolveThumbnailUrl(
  tokenId: number,
  ipfsHash?: string,
  originalUrl?: string
): Promise<ImageResolution> {
  // For now, thumbnail is same as main image since we're not processing
  // In the future, we could add thumbnail generation
  return resolveImageUrl(tokenId, ipfsHash, originalUrl);
}

/**
 * Preload image URL for better UX
 */
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Trigger caching for a specific evermark
 */
export async function triggerImageCache(tokenId: number): Promise<void> {
  try {
    // Call our caching function via API
    const response = await fetch('/.netlify/functions/cache-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        trigger: 'manual', 
        tokenIds: [tokenId] 
      })
    });

    if (!response.ok) {
      throw new Error(`Cache trigger failed: ${response.status}`);
    }

    console.log(`Cache triggered for tokenId ${tokenId}`);
  } catch (error) {
    console.error('Failed to trigger cache:', error);
    // Don't throw - this is a background optimization
  }
}