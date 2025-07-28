// =============================================================================
// File: src/features/evermarks/services/SupabaseImageService.ts
// COMPLETE VERSION - Handles Supabase Storage operations for images
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
          
          if (ctx) {
            // High quality drawing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

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
          } else {
            reject(new Error('Canvas context not available'));
          }
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
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to get dimensions'));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Validate image file
   */
  private static validateImageFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

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

    if (file.size === 0) {
      return { isValid: false, error: 'File appears to be empty' };
    }

    return { isValid: true };
  }

  /**
   * Get image URL with automatic fallback (returns undefined instead of null)
   */
  static getImageUrl(evermark: {
    supabaseImageUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  }): string | undefined {
    if (evermark.supabaseImageUrl) return evermark.supabaseImageUrl;
    if (evermark.processed_image_url) return evermark.processed_image_url;
    if (evermark.ipfsHash) return `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`;
    return undefined;
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
        `evermarks/${tokenId}/thumbnail.jpg`,
        `evermarks/${tokenId}/thumbnail.png`,
        `evermarks/${tokenId}/thumbnail.gif`,
        `evermarks/${tokenId}/thumbnail.webp`
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

  /**
   * List all images for a token
   */
  static async listImages(tokenId: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .list(`evermarks/${tokenId}`);

      if (error) throw error;

      const files = data?.map(file => file.name) || [];
      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'List failed'
      };
    }
  }

  /**
   * Get storage info for a token
   */
  static async getStorageInfo(tokenId: string): Promise<{
    success: boolean;
    info?: {
      hasImage: boolean;
      hasThumbnail: boolean;
      imageSize?: number;
      thumbnailSize?: number;
      totalSize: number;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .list(`evermarks/${tokenId}`);

      if (error) throw error;

      const files = data || [];
      const imageFile = files.find(f => f.name.startsWith('image.'));
      const thumbnailFile = files.find(f => f.name.startsWith('thumbnail.'));

      const imageSize = imageFile?.metadata?.size || 0;
      const thumbnailSize = thumbnailFile?.metadata?.size || 0;

      return {
        success: true,
        info: {
          hasImage: !!imageFile,
          hasThumbnail: !!thumbnailFile,
          imageSize,
          thumbnailSize,
          totalSize: imageSize + thumbnailSize
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Info retrieval failed'
      };
    }
  }

  /**
   * Copy image to new token ID (useful for updating paths)
   */
  static async copyImage(
    fromTokenId: string,
    toTokenId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: files } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .list(`evermarks/${fromTokenId}`);

      if (!files || files.length === 0) {
        return { success: true }; // No files to copy
      }

      for (const file of files) {
        const fromPath = `evermarks/${fromTokenId}/${file.name}`;
        const toPath = `evermarks/${toTokenId}/${file.name}`;

        const { error } = await supabase.storage
          .from(this.STORAGE_BUCKET)
          .copy(fromPath, toPath);

        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Copy failed'
      };
    }
  }

  /**
   * Health check for Supabase storage
   */
  static async healthCheck(): Promise<{ isHealthy: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      
      if (error) throw error;

      const bucket = data?.find(b => b.id === this.STORAGE_BUCKET);
      if (!bucket) {
        return { 
          isHealthy: false, 
          error: `Storage bucket "${this.STORAGE_BUCKET}" not found` 
        };
      }

      return { isHealthy: true };
    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Storage health check failed'
      };
    }
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    success: boolean;
    stats?: {
      totalFiles: number;
      totalSize: number;
      imageCount: number;
      thumbnailCount: number;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .list('evermarks', { limit: 1000 });

      if (error) throw error;

      let totalFiles = 0;
      let totalSize = 0;
      let imageCount = 0;
      let thumbnailCount = 0;

      // This is a simplified version - for full stats you'd need to recurse through folders
      if (data) {
        for (const item of data) {
          if (item.metadata?.size) {
            totalFiles++;
            totalSize += item.metadata.size;
            
            if (item.name.includes('image.')) imageCount++;
            if (item.name.includes('thumbnail.')) thumbnailCount++;
          }
        }
      }

      return {
        success: true,
        stats: {
          totalFiles,
          totalSize,
          imageCount,
          thumbnailCount
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Stats retrieval failed'
      };
    }
  }

  /**
   * Create signed URL for temporary access
   */
  static async createSignedUrl(
    tokenId: string,
    type: 'image' | 'thumbnail' = 'image',
    expiresIn = 3600
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const fileName = `evermarks/${tokenId}/${type}.jpg`; // Assume jpg for simplicity

      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .createSignedUrl(fileName, expiresIn);

      if (error) throw error;

      return { success: true, url: data.signedUrl };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Signed URL creation failed'
      };
    }
  }

  /**
   * Utility: Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Utility: Check if image processing is supported in browser
   */
  static isProcessingSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch {
      return false;
    }
  }

  /**
   * Get configuration info
   */
  static getConfig() {
    return {
      bucket: this.STORAGE_BUCKET,
      maxFileSize: this.MAX_FILE_SIZE,
      supportedTypes: this.SUPPORTED_TYPES,
      maxFileSizeFormatted: this.formatFileSize(this.MAX_FILE_SIZE),
      isProcessingSupported: this.isProcessingSupported()
    };
  }
}