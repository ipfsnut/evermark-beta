// =============================================================================
// File: src/features/evermarks/utils/imageHelpers.ts
// Image utility functions for hybrid storage system
// =============================================================================

export class ImageHelpers {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  /**
   * Get the best available image URL with fallback priority
   */
  static getOptimalImageUrl(evermark: {
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  }, preferThumbnail = false): string | undefined {
    
    // Use thumbnail first if preferred and available
    if (preferThumbnail && evermark.thumbnailUrl) {
      return evermark.thumbnailUrl;
    }
    
    // Primary: Supabase image URL (fastest, most reliable)
    if (evermark.supabaseImageUrl) {
      return evermark.supabaseImageUrl;
    }
    
    // Secondary: Legacy processed image URL
    if (evermark.processed_image_url) {
      return evermark.processed_image_url;
    }
    
    // Fallback: IPFS gateway (slowest but most permanent)
    if (evermark.ipfsHash) {
      return `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`;
    }
    
    return undefined;
  }

  /**
   * Get all available image URLs for redundancy
   */
  static getAllImageUrls(evermark: {
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  }): Array<{ url: string; source: 'supabase' | 'ipfs' | 'processed'; priority: number }> {
    const urls: Array<{ url: string; source: 'supabase' | 'ipfs' | 'processed'; priority: number }> = [];
    
    if (evermark.supabaseImageUrl) {
      urls.push({ url: evermark.supabaseImageUrl, source: 'supabase', priority: 1 });
    }
    
    if (evermark.processed_image_url) {
      urls.push({ url: evermark.processed_image_url, source: 'processed', priority: 2 });
    }
    
    if (evermark.ipfsHash) {
      urls.push({ 
        url: `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`, 
        source: 'ipfs', 
        priority: 3 
      });
    }
    
    return urls.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate image file for upload
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
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
        error: `Image too large. Maximum size is ${this.formatFileSize(this.MAX_FILE_SIZE)}.`
      };
    }

    if (file.size === 0) {
      return { isValid: false, error: 'File appears to be empty' };
    }

    return { isValid: true };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Parse image dimensions string
   */
  static parseDimensions(dimensions?: string): { width: number; height: number } | null {
    if (!dimensions) return null;
    const [width, height] = dimensions.split(',').map(d => parseInt(d.trim()));
    return width && height ? { width, height } : null;
  }

  /**
   * Get aspect ratio for responsive display
   */
  static getAspectRatio(dimensions?: string): number {
    const parsed = this.parseDimensions(dimensions);
    return parsed ? parsed.width / parsed.height : 16 / 9; // Default aspect ratio
  }

  /**
   * Generate srcset for responsive images
   */
  static generateSrcSet(baseUrl: string, sizes: number[] = [400, 800, 1200]): string {
    return sizes
      .map(size => `${baseUrl}?width=${size} ${size}w`)
      .join(', ');
  }

  /**
   * Compress image on client side before upload
   */
  static async compressImage(
    file: File, 
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      outputFormat?: string;
    } = {}
  ): Promise<File> {
    const {
      maxWidth = 1200,
      maxHeight = 900,
      quality = 0.9,
      outputFormat = file.type
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate new dimensions while maintaining aspect ratio
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          if (ratio < 1) {
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;
          
          if (ctx) {
            // Draw image with high quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const compressedFile = new File([blob], file.name, {
                    type: outputFormat,
                    lastModified: Date.now()
                  });
                  resolve(compressedFile);
                } else {
                  reject(new Error('Canvas compression failed'));
                }
              },
              outputFormat,
              quality
            );
          } else {
            reject(new Error('Canvas context not available'));
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Image load failed during compression'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate thumbnail from image file
   */
  static async generateThumbnail(
    file: File, 
    size: number = 200
  ): Promise<File> {
    return this.compressImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.8,
      outputFormat: 'image/jpeg'
    });
  }

  /**
   * Get image dimensions without loading the full image
   */
  static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to get image dimensions'));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Check if image needs compression
   */
  static shouldCompress(file: File, maxSize: number = 2 * 1024 * 1024): boolean {
    return file.size > maxSize;
  }

  /**
   * Preload images for better UX
   */
  static preloadImages(urls: string[]): void {
    urls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }

  /**
   * Create a data URL from image file for preview
   */
  static createPreviewUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Failed to create preview URL'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Estimate upload time based on file size and connection
   */
  static estimateUploadTime(fileSizeBytes: number): string {
    // Assume average upload speed of 1 Mbps
    const avgSpeedBytesPerSecond = 125000; // 1 Mbps = 125 KB/s
    const estimatedSeconds = fileSizeBytes / avgSpeedBytesPerSecond;
    
    if (estimatedSeconds < 5) return 'few seconds';
    if (estimatedSeconds < 30) return `~${Math.round(estimatedSeconds)} seconds`;
    if (estimatedSeconds < 120) return `~${Math.round(estimatedSeconds / 60)} minute`;
    return `~${Math.round(estimatedSeconds / 60)} minutes`;
  }

  /**
   * Generate image placeholder based on content type
   */
  static generatePlaceholder(contentType: string, tokenId?: number): string {
    const emojis = {
      'Cast': '💬',
      'DOI': '📄', 
      'ISBN': '📚',
      'URL': '🌐',
      'Custom': '✨'
    };
    
    const emoji = emojis[contentType as keyof typeof emojis] || '📄';
    const id = tokenId ? `#${tokenId}` : '';
    
    // Create a simple SVG placeholder
    const svg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#374151"/>
        <text x="50%" y="45%" text-anchor="middle" font-size="48" fill="#9CA3AF">${emoji}</text>
        <text x="50%" y="65%" text-anchor="middle" font-size="16" fill="#6B7280">${id}</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  /**
   * Extract dominant color from image
   */
  static async getDominantColor(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = img.width;
          canvas.height = img.height;
          
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            let r = 0, g = 0, b = 0;
            let pixelCount = 0;
            
            // Sample pixels for average color
            for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              pixelCount++;
            }
            
            r = Math.round(r / pixelCount);
            g = Math.round(g / pixelCount);
            b = Math.round(b / pixelCount);
            
            resolve(`rgb(${r}, ${g}, ${b})`);
          } else {
            reject(new Error('Canvas context not available'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image for color extraction'));
      img.src = imageUrl;
    });
  }

  /**
   * Check if image URL is accessible
   */
  static async checkImageAccessibility(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create responsive image configuration
   */
  static createResponsiveConfig(dimensions?: string) {
    const parsed = this.parseDimensions(dimensions);
    
    if (!parsed) {
      return {
        sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
        aspectRatio: '16/9'
      };
    }
    
    const aspectRatio = parsed.width / parsed.height;
    
    return {
      sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
      aspectRatio: `${parsed.width}/${parsed.height}`,
      isLandscape: aspectRatio > 1,
      isPortrait: aspectRatio < 1,
      isSquare: Math.abs(aspectRatio - 1) < 0.1
    };
  }
}