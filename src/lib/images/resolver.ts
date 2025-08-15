// Smart image URL resolution with fallback strategy
import { supabase } from '../supabase';

export interface ImageResolution {
  url: string;
  source: 'supabase' | 'pinata' | 'ipfs' | 'fallback';
  cached: boolean;
}

/**
 * Resolve best image URL with fallback strategy
 */
export async function resolveImageUrl(
  tokenId: number,
  ipfsHash?: string,
  originalUrl?: string
): Promise<ImageResolution> {
  // 1. Try Supabase storage first
  const supabaseUrl = await getSupabaseImageUrl(tokenId);
  if (supabaseUrl && await isUrlAccessible(supabaseUrl)) {
    return {
      url: supabaseUrl,
      source: 'supabase',
      cached: true
    };
  }

  // 2. Try permissioned Pinata gateway
  if (ipfsHash) {
    const pinataUrl = getPinataUrl(ipfsHash);
    if (await isUrlAccessible(pinataUrl)) {
      return {
        url: pinataUrl,
        source: 'pinata',
        cached: false
      };
    }
  }

  // 3. Try IPFS.io gateway
  if (ipfsHash) {
    const ipfsUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
    if (await isUrlAccessible(ipfsUrl)) {
      return {
        url: ipfsUrl,
        source: 'ipfs',
        cached: false
      };
    }
  }

  // 4. Last resort: original URL
  if (originalUrl) {
    return {
      url: originalUrl,
      source: 'fallback',
      cached: false
    };
  }

  // 5. Give up - return placeholder
  return {
    url: '/placeholder-image.jpg',
    source: 'fallback',
    cached: false
  };
}

/**
 * Get Supabase storage URL for tokenId
 */
async function getSupabaseImageUrl(tokenId: number): Promise<string | null> {
  try {
    // Check database first
    const { data, error } = await supabase
      .from('evermarks')
      .select('supabase_image_url')
      .eq('token_id', tokenId)
      .single();

    if (!error && data?.supabase_image_url) {
      return data.supabase_image_url;
    }

    // Fallback: construct URL and check if file exists
    const fileName = `evermarks/${tokenId}/image.jpg`;
    const { data: fileData } = supabase.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    // Quick check if file exists (this might be expensive, consider caching)
    const exists = await checkStorageFileExists(fileName);
    return exists ? fileData.publicUrl : null;
  } catch (error) {
    console.warn('Failed to get Supabase image URL:', error);
    return null;
  }
}

/**
 * Get permissioned Pinata URL
 */
function getPinataUrl(ipfsHash: string): string {
  const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  return `${gateway}/ipfs/${ipfsHash}`;
}

/**
 * Check if URL is accessible (with timeout)
 */
async function isUrlAccessible(url: string, timeout: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check if file exists in Supabase storage
 */
async function checkStorageFileExists(fileName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from('evermark-images')
      .list('', {
        limit: 1,
        search: fileName
      });

    return !error && data.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get thumbnail URL with same fallback strategy
 */
export async function resolveThumbnailUrl(
  tokenId: number,
  ipfsHash?: string,
  originalUrl?: string
): Promise<ImageResolution> {
  // Try Supabase thumbnail first
  const thumbnailUrl = await getSupabaseThumbnailUrl(tokenId);
  if (thumbnailUrl && await isUrlAccessible(thumbnailUrl)) {
    return {
      url: thumbnailUrl,
      source: 'supabase',
      cached: true
    };
  }

  // Fall back to main image resolution
  return resolveImageUrl(tokenId, ipfsHash, originalUrl);
}

/**
 * Get Supabase thumbnail URL
 */
async function getSupabaseThumbnailUrl(tokenId: number): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('evermarks')
      .select('thumbnail_url')
      .eq('token_id', tokenId)
      .single();

    if (data?.thumbnail_url) {
      return data.thumbnail_url;
    }

    // Check if thumbnail file exists
    const fileName = `evermarks/${tokenId}/thumbnail.jpg`;
    const { data: fileData } = supabase.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    const exists = await checkStorageFileExists(fileName);
    return exists ? fileData.publicUrl : null;
  } catch (error) {
    return null;
  }
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