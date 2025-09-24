import type { PreservedMedia, EmbedMetadata } from '../types';

const MEDIA_CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB max per file
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  SUPPORTED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg'],
  THUMBNAIL_SIZE: { width: 400, height: 400 },
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
};

export class MediaPreservationService {
  private static downloadQueue: Map<string, Promise<PreservedMedia | null>> = new Map();

  /**
   * Preserve media content from URL
   */
  static async preserveMedia(url: string): Promise<PreservedMedia | null> {
    if (!url) return null;

    // Check if already in download queue
    if (this.downloadQueue.has(url)) {
      return this.downloadQueue.get(url)!;
    }

    // Create download promise
    const downloadPromise = this.downloadAndStore(url);
    this.downloadQueue.set(url, downloadPromise);

    try {
      const result = await downloadPromise;
      return result;
    } finally {
      // Clean up queue
      this.downloadQueue.delete(url);
    }
  }

  /**
   * Download and store media content
   */
  private static async downloadAndStore(url: string): Promise<PreservedMedia | null> {
    try {
      console.log('📥 Preserving media:', url);

      // Call backend API to handle media preservation
      const response = await fetch(`${MEDIA_CONFIG.API_BASE}/preserve-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        console.error('Failed to preserve media:', response.statusText);
        return null;
      }

      const result = await response.json();
      
      return {
        original_url: url,
        ardrive_tx: result.ardrive_tx,
        ipfs_hash: result.ipfs_hash,
        content_type: result.content_type,
        file_size: result.file_size,
        dimensions: result.dimensions,
        thumbnail: result.thumbnail,
        preserved_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error preserving media:', error);
      return null;
    }
  }

  /**
   * Extract metadata from embed URL
   */
  static async extractEmbedMetadata(url: string): Promise<EmbedMetadata | null> {
    try {
      // Determine embed type
      const embedType = this.getEmbedType(url);
      
      // Fetch OpenGraph metadata
      const response = await fetch(`${MEDIA_CONFIG.API_BASE}/extract-metadata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        return {
          type: embedType,
          domain: new URL(url).hostname,
        };
      }

      const metadata = await response.json();
      
      return {
        type: embedType,
        title: metadata.og_title,
        description: metadata.og_description,
        og_image: metadata.og_image,
        domain: new URL(url).hostname,
        favicon: metadata.favicon,
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return null;
    }
  }

  /**
   * Determine embed type from URL
   */
  private static getEmbedType(url: string): EmbedMetadata['type'] {
    const urlLower = url.toLowerCase();
    
    // Check for image extensions
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(urlLower)) {
      return 'image';
    }
    
    // Check for video extensions
    if (/\.(mp4|webm|ogg|mov)$/i.test(urlLower)) {
      return 'video';
    }
    
    // Check for known domains
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return 'video';
    }
    
    if (urlLower.includes('.gif')) {
      return 'gif';
    }
    
    // Check for Farcaster Frame
    if (urlLower.includes('/frames/') || urlLower.includes('frame.')) {
      return 'frame';
    }
    
    // Default to link
    return 'link';
  }

  /**
   * Batch preserve multiple media items
   */
  static async preserveMultipleMedia(urls: string[]): Promise<Map<string, PreservedMedia | null>> {
    const results = new Map<string, PreservedMedia | null>();
    
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 3;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(url => this.preserveMedia(url))
      );
      
      batch.forEach((url, index) => {
        results.set(url, batchResults[index]);
      });
    }
    
    return results;
  }

  /**
   * Check if media is already preserved
   */
  static async checkPreservationStatus(url: string): Promise<{
    preserved: boolean;
    ardrive_tx?: string;
    ipfs_hash?: string;
  }> {
    try {
      const response = await fetch(
        `${MEDIA_CONFIG.API_BASE}/check-preservation?url=${encodeURIComponent(url)}`
      );
      
      if (!response.ok) {
        return { preserved: false };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error checking preservation status:', error);
      return { preserved: false };
    }
  }
}