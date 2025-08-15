// Image storage utilities for Supabase
import { supabase } from '../supabase';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload image to Supabase storage
 */
export async function uploadImage(
  tokenId: number,
  imageBuffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<ImageUploadResult> {
  try {
    const fileName = `evermarks/${tokenId}/image.${getFileExtension(contentType)}`;
    
    const { data, error } = await supabase.storage
      .from('evermark-images')
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: true // Overwrite if exists
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Image upload failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Upload thumbnail to Supabase storage
 */
export async function uploadThumbnail(
  tokenId: number,
  thumbnailBuffer: Buffer,
  contentType: string = 'image/jpeg'
): Promise<ImageUploadResult> {
  try {
    const fileName = `evermarks/${tokenId}/thumbnail.${getFileExtension(contentType)}`;
    
    const { data, error } = await supabase.storage
      .from('evermark-images')
      .upload(fileName, thumbnailBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error('Thumbnail upload error:', error);
      return { success: false, error: error.message };
    }

    const { data: urlData } = supabase.storage
      .from('evermark-images')
      .getPublicUrl(fileName);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Thumbnail upload failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check if image exists in Supabase storage
 */
export async function imageExists(tokenId: number): Promise<boolean> {
  try {
    const fileName = `evermarks/${tokenId}/image.jpg`; // Try common extension first
    
    const { data, error } = await supabase.storage
      .from('evermark-images')
      .list(`evermarks/${tokenId}/`, {
        limit: 10
      });

    if (error) return false;
    
    return data.some(file => file.name.startsWith('image.'));
  } catch (error) {
    return false;
  }
}

/**
 * Get public URL for stored image
 */
export function getStorageUrl(tokenId: number, type: 'image' | 'thumbnail' = 'image'): string {
  const fileName = `evermarks/${tokenId}/${type}.jpg`;
  const { data } = supabase.storage
    .from('evermark-images')
    .getPublicUrl(fileName);
  
  return data.publicUrl;
}

/**
 * Delete images for a tokenId
 */
export async function deleteImages(tokenId: number): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from('evermark-images')
      .remove([
        `evermarks/${tokenId}/image.jpg`,
        `evermarks/${tokenId}/image.png`,
        `evermarks/${tokenId}/image.webp`,
        `evermarks/${tokenId}/thumbnail.jpg`,
        `evermarks/${tokenId}/thumbnail.png`,
        `evermarks/${tokenId}/thumbnail.webp`
      ]);

    return !error;
  } catch (error) {
    console.error('Delete images failed:', error);
    return false;
  }
}

/**
 * Get file extension from content type
 */
function getFileExtension(contentType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  
  return extensions[contentType.toLowerCase()] || 'jpg';
}