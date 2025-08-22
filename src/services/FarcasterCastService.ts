// Farcaster Cast Service for fetching cast content and generating previews
import { neynarClient } from '@/lib/neynar/neynarClient';

interface CastData {
  text: string;
  author: {
    username: string;
    display_name: string;
    pfp_url: string;
    fid: number;
  };
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  timestamp: string;
  hash: string;
  embeds?: any[];
}

interface CastPreviewResult {
  success: boolean;
  castData?: CastData;
  previewImageUrl?: string;
  error?: string;
}

class FarcasterCastService {
  /**
   * Extract cast identifier from Farcaster URL
   * Supports formats like:
   * - https://farcaster.xyz/username/0xhash
   * - https://warpcast.com/username/0xhash
   */
  private extractCastIdentifier(url: string): { username?: string; hash?: string } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length >= 2) {
        const username = pathParts[0];
        const hash = pathParts[1];
        
        // Validate hash format (should start with 0x)
        if (hash && hash.startsWith('0x')) {
          return { username, hash };
        }
      }
    } catch (e) {
      console.error('Failed to parse Farcaster URL:', e);
    }
    
    return {};
  }

  /**
   * Fetch cast data from Farcaster using Neynar API
   */
  async fetchCastData(url: string): Promise<CastData | null> {
    try {
      if (!neynarClient.isConfigured()) {
        console.error('Neynar client not configured');
        return null;
      }

      console.log('🔍 Fetching cast data from:', url);
      
      // Use URL-based lookup which works with truncated hashes in URLs
      // This is the most reliable method for Farcaster URLs
      const response = await neynarClient.getCastByUrl(url);
      
      if (response?.cast) {
        const cast = response.cast;
        
        console.log('✅ Cast found via URL lookup:', {
          author: cast.author?.username,
          text: cast.text?.substring(0, 50),
          fullHash: cast.hash,
          likes: cast.reactions?.likes_count
        });
        
        return {
          text: cast.text || '',
          author: {
            username: cast.author?.username || 'unknown',
            display_name: cast.author?.display_name || cast.author?.username || 'Unknown',
            pfp_url: cast.author?.pfp_url || '',
            fid: cast.author?.fid || 0
          },
          reactions: {
            likes_count: cast.reactions?.likes_count || 0,
            recasts_count: cast.reactions?.recasts_count || 0
          },
          timestamp: cast.timestamp || new Date().toISOString(),
          hash: cast.hash || '',
          embeds: cast.embeds || []
        };
      }
      
      console.log('❌ No cast found via URL lookup');
      return null;
    } catch (error) {
      console.error('Failed to fetch cast data:', error);
      return null;
    }
  }

  /**
   * Generate a visual preview of a Farcaster cast
   * This can be enhanced to use a service like Puppeteer or a canvas library
   * For now, returns the first embedded image if available
   */
  async generateCastPreview(castData: CastData): Promise<string | null> {
    try {
      // Check if cast has embedded images
      if (castData.embeds && castData.embeds.length > 0) {
        for (const embed of castData.embeds) {
          // Check for image URL in embed
          if (embed.url && (
            embed.url.includes('.jpg') || 
            embed.url.includes('.jpeg') || 
            embed.url.includes('.png') || 
            embed.url.includes('.gif') ||
            embed.url.includes('.webp')
          )) {
            console.log('📸 Using embedded image from cast:', embed.url);
            return embed.url;
          }
          
          // Check for metadata with image
          if (embed.metadata?.image) {
            console.log('📸 Using metadata image from cast:', embed.metadata.image);
            return embed.metadata.image;
          }
        }
      }

      // TODO: In the future, we could generate a visual representation of the cast
      // using a service like:
      // 1. HTML to image conversion service
      // 2. Puppeteer for screenshot generation
      // 3. Canvas API for custom rendering
      // 4. Neynar's cast preview API if available
      
      console.log('⚠️ No embedded images found in cast, would need to generate preview');
      return null;
      
    } catch (error) {
      console.error('Failed to generate cast preview:', error);
      return null;
    }
  }

  /**
   * Fetch cast and generate preview for Evermark creation
   */
  async fetchCastWithPreview(url: string): Promise<CastPreviewResult> {
    try {
      // Fetch cast data
      const castData = await this.fetchCastData(url);
      
      if (!castData) {
        return {
          success: false,
          error: 'Failed to fetch cast data from Farcaster'
        };
      }

      // Generate preview image
      const previewImageUrl = await this.generateCastPreview(castData);
      
      return {
        success: true,
        castData,
        previewImageUrl: previewImageUrl || undefined
      };
      
    } catch (error) {
      console.error('Failed to fetch cast with preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a URL is a Farcaster cast URL
   */
  isFarcasterUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('farcaster.xyz') ||
        urlObj.hostname.includes('warpcast.com')
      );
    } catch {
      return false;
    }
  }
}

export const farcasterCastService = new FarcasterCastService();
export type { CastData, CastPreviewResult };