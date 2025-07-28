// =============================================================================
// File: src/features/evermarks/services/SupabaseImageService.ts
// NEW FILE - Handles Supabase Storage operations for images
// =============================================================================

import { supabase } from '@/lib/supabase';

interface ImageUploadResult {
  success: boolean;
  supabaseUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  fileSize?: number;
  dimensions?: string;
}

interface ImageProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailSize?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export class SupabaseImageService {
  private static readonly STORAGE_BUCKET = 'evermark-images';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  /**
   * Upload image to Supabase Storage with processing
   */
  static async uploadImage(
    file: File,
    tokenId: string,
    options: ImageProcessingOptions = {}
  ): Promise<ImageUploadResult> {
    try {
      console.log('📸 Starting Supabase image upload for token:', tokenId);

      // Validate file
      const validation = this.validateImageFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Process image if needed
      const processedFile = await this.processImage(file, options);
      const dimensions = await this.getImageDimensions(processedFile);

      // Upload main image
      const uploadResult = await this.uploadToStorage(processedFile, tokenId, 'image');
      if (!uploadResult.success) {
        return uploadResult;
      }

      let thumbnailUrl: string | undefined;

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        const thumbnailResult = await this.generateAndUploadThumbnail(
          processedFile, 
          tokenId, 
          options.thumbnailSize || 200
        );
        if (thumbnailResult.success) {
          thumbnailUrl = thumbnailResult.url;
        }
      }

      console.log('✅ Supabase image upload completed');
      return {
        success: true,
        supabaseUrl: uploadResult.url,
        thumbnailUrl,
        fileSize: processedFile.size,
        dimensions: `${dimensions.width},${dimensions.height}`
      };

    } catch (error) {
      console.error('❌ Supabase image upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private static async uploadToStorage(
    file: File,
    tokenId: string,
    type: 'image' | 'thumbnail'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileExt = file.type.split('/')[1] || 'jpg';
      const fileName = `evermarks/${tokenId}/${type}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(fileName);

      return { success: true, url: publicUrl };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Storage upload failed'
      };
    }
  }

  /**
   * Process image (resize, compress)
   */
  private static async processImage(
    file: File,
    options: ImageProcessingOptions
  ): Promise<File> {
    if (!options.maxWidth && !options.maxHeight && !options.quality) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          // Resize if needed
          if (options.maxWidth || options.maxHeight) {
            const maxW = options.maxWidth || width;
            const maxH = options.maxHeight || height;
            const ratio = Math.min(maxW / width, maxH / height);
            
            if (ratio < 1) {
              width *= ratio;
              height *= ratio;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const processedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now()
                });
                resolve(processedFile);
              } else {
                reject(new Error('Canvas processing failed'));
              }
            },
            file.type,
            options.quality || 0.9
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate and upload thumbnail
   */
  private static async generateAndUploadThumbnail(
    file: File,
    tokenId: string,
    size: number
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const thumbnailFile = await this.processImage(file, {
        maxWidth: size,
        maxHeight: size,
        quality: 0.8
      });

      return await this.uploadToStorage(thumbnailFile, tokenId, 'thumbnail');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Thumbnail generation failed'
      };
    }
  }

  /**
   * Get image dimensions
   */
  private static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to get dimensions'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Validate image file
   */
  private static validateImageFile(file: File): { isValid: boolean; error?: string } {
    if (!this.SUPPORTED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: 'Unsupported image format. Please use JPEG, PNG, GIF, or WebP.'
      };
    }

    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `Image too large. Maximum size is ${Math.round(this.MAX_FILE_SIZE / 1024 / 1024)}MB.`
      };
    }

    return { isValid: true };
  }

  /**
   * Get image URL with automatic fallback
   */
  static getImageUrl(evermark: {
    supabaseImageUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  }): string | null {
    return evermark.supabaseImageUrl || 
           evermark.processed_image_url || 
           (evermark.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}` : null);
  }

  /**
   * Get thumbnail URL
   */
  static getThumbnailUrl(tokenId: string): string {
    const { data } = supabase.storage
      .from(this.STORAGE_BUCKET)
      .getPublicUrl(`evermarks/${tokenId}/thumbnail.jpg`);
    
    return data.publicUrl;
  }

  /**
   * Delete image and thumbnail
   */
  static async deleteImage(tokenId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const filesToDelete = [
        `evermarks/${tokenId}/image.jpg`,
        `evermarks/${tokenId}/image.png`,
        `evermarks/${tokenId}/image.gif`,
        `evermarks/${tokenId}/image.webp`,
        `evermarks/${tokenId}/thumbnail.jpg`
      ];

      const { error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove(filesToDelete);

      return { success: !error, error: error?.message };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }
}
