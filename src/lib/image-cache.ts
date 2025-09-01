// Simple image caching - just download and store
import { supabase } from './supabase';
import { replaceIPFSGateway } from '../utils/ipfs-gateway';

/**
 * Cache image from IPFS/Pinata to Supabase storage
 */
export async function cacheImage(tokenId: number, originalUrl: string) {
  try {
    // Try multiple gateways for download
    const downloadUrls = [
      originalUrl,
      originalUrl.replace('gateway.pinata.cloud', 'ipfs.io'),
      originalUrl.replace('gateway.pinata.cloud', 'cloudflare-ipfs.com')
    ];

    let imageBuffer: ArrayBuffer | null = null;
    
    // Try each gateway
    for (const url of downloadUrls) {
      try {
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(10000) // 10s timeout
        });
        
        if (response.ok) {
          imageBuffer = await response.arrayBuffer();
          break;
        }
      } catch (error) {
        console.warn(`Failed to download from ${url}:`, error);
        continue;
      }
    }

    if (!imageBuffer) {
      throw new Error('Failed to download from all gateways');
    }

    // Store in Supabase (keep original filename/format)
    const fileName = `evermarks/${tokenId}.jpg`; // Simple naming
    const { data: _data, error } = await supabase!.storage
      .from('evermark-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase!.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    // Update database
    await supabase!
      .from('evermarks')
      .update({
        supabase_image_url: urlData.publicUrl,
        image_processing_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    return { success: true, url: urlData.publicUrl };

  } catch (error) {
    // Mark as failed
    await supabase!
      .from('evermarks')
      .update({
        image_processing_status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get best image URL with fallback
 */
export function getImageUrl(evermark: {
  token_id: number;
  supabase_image_url?: string;
  ipfs_image_hash?: string;
}): string {
  // 1. Try Supabase first
  if (evermark.supabase_image_url) {
    return evermark.supabase_image_url;
  }

  // 2. Fall back to IPFS via CORS-friendly gateway (not Pinata)
  if (evermark.ipfs_image_hash) {
    const pinataUrl = `https://gateway.pinata.cloud/ipfs/${evermark.ipfs_image_hash}`;
    return replaceIPFSGateway(pinataUrl) || `https://ipfs.io/ipfs/${evermark.ipfs_image_hash}`;
  }

  // 3. Last resort: placeholder
  return '/placeholder-image.jpg';
}

/**
 * Check if we have cached version
 */
export function isCached(evermark: { supabase_image_url?: string }): boolean {
  return !!evermark.supabase_image_url;
}