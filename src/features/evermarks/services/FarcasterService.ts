import type { FarcasterCastData } from '../types';

const FARCASTER_CONFIG = {
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
};

export class FarcasterService {
  /**
   * Validate if input is a Farcaster cast URL or hash
   */
  static validateFarcasterInput(input: string): { 
    isValid: boolean; 
    type: 'url' | 'hash' | null; 
    error?: string 
  } {
    if (!input?.trim()) {
      return { isValid: false, type: null, error: 'Input is required' };
    }

    const trimmedInput = input.trim();

    // Check for Farcaster URLs
    const urlPatterns = [
      /^https:\/\/warpcast\.com\/[^/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/farcaster\.xyz\/[^/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/supercast\.xyz\/[^/]+\/0x[a-fA-F0-9]+/
    ];

    for (const pattern of urlPatterns) {
      if (pattern.test(trimmedInput)) {
        return { isValid: true, type: 'url' };
      }
    }

    // Check for direct hash
    if (/^0x[a-fA-F0-9]{8,64}$/.test(trimmedInput)) {
      return { isValid: true, type: 'hash' };
    }

    return { 
      isValid: false, 
      type: null, 
      error: 'Invalid Farcaster cast URL or hash format' 
    };
  }

  /**
   * Extract cast hash from Farcaster URL
   */
  static extractCastHash(input: string): string | null {
    const validation = this.validateFarcasterInput(input);
    if (!validation.isValid) return null;

    if (validation.type === 'hash') {
      return input.trim();
    }

    // Extract hash from URL
    const hashMatch = input.match(/0x[a-fA-F0-9]+/);
    return hashMatch ? hashMatch[0] : null;
  }

  /**
   * Fetch cast metadata from Farcaster
   */
  static async fetchCastMetadata(castInput: string): Promise<FarcasterCastData | null> {
    try {
      const castHash = this.extractCastHash(castInput);
      if (!castHash) {
        throw new Error('Invalid cast hash or URL');
      }

      // Try to fetch via our API endpoint
      const response = await fetch(`${FARCASTER_CONFIG.API_BASE}/farcaster-cast?hash=${castHash}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          return {
            castHash: data.castHash || castHash,
            author: data.author || 'Unknown',
            username: data.username || '',
            content: data.content || '',
            timestamp: data.timestamp || new Date().toISOString(),
            engagement: {
              likes: data.engagement?.likes || 0,
              recasts: data.engagement?.recasts || 0,
              replies: data.engagement?.replies || 0
            }
          };
        }
      }

      // Fallback: Create basic metadata from hash
      console.warn('Could not fetch cast metadata, using fallback');
      return {
        castHash,
        author: 'Farcaster User',
        username: '',
        content: 'Cast content will be displayed when available',
        timestamp: new Date().toISOString(),
        engagement: {
          likes: 0,
          recasts: 0,
          replies: 0
        }
      };
    } catch (error) {
      console.error('Failed to fetch Farcaster cast metadata:', error);
      return null;
    }
  }

  /**
   * Check if we're running in a Farcaster frame
   */
  static isInFarcasterFrame(): boolean {
    if (typeof window === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    return (
      ua.includes('farcaster-') ||
      ua.includes('warpcast-app') ||
      url.includes('farcaster.xyz') ||
      url.includes('warpcast.com') ||
      window.location.search.includes('inFeed=true') ||
      window.location.search.includes('action_type=share')
    );
  }

  /**
   * Check if cast author matches evermark creator for verification
   * The core principle: author (content creator) must equal creator (evermark creator)
   */
  static canAutoVerify(castData: FarcasterCastData, creatorAddress: string): boolean {
    if (!castData.username || !creatorAddress) return false;
    
    const username = castData.username.toLowerCase();
    const address = creatorAddress.toLowerCase();
    
    // Known author-to-address mappings for verification
    const knownMappings: Record<string, string> = {
      'horsefacts.eth': '0x2b27ea7daa8bf1de98407447b269dfe280753fe3',
      'kompreni': '0x2b27ea7daa8bf1de98407447b269dfe280753fe3',
      'vitalik.eth': '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    };
    
    // Only verify if we have a confirmed mapping
    return knownMappings[username] === address;
  }

  /**
   * Check if an evermark should be verified based on author = creator principle
   */
  static shouldBeVerified(author: string, creator: string, castData?: FarcasterCastData): boolean {
    // Simple case: author name matches creator address (for ENS)
    if (author.endsWith('.eth') && creator.toLowerCase().includes(author.toLowerCase())) {
      return true;
    }
    
    // Use cast data for more precise matching
    if (castData) {
      return this.canAutoVerify(castData, creator);
    }
    
    return false;
  }

  /**
   * Generate Farcaster frame metadata for sharing
   */
  static generateFrameMetadata(evermarkId: string, title: string, imageUrl?: string) {
    const shareUrl = `${window.location.origin}/evermark/${evermarkId}`;
    
    return {
      'fc:frame': 'vNext',
      'fc:frame:image': imageUrl || `${window.location.origin}/og-image.png`,
      'fc:frame:button:1': '📖 View Evermark',
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': shareUrl,
      'og:title': title,
      'og:description': 'Preserved forever on the blockchain',
      'og:image': imageUrl || `${window.location.origin}/og-image.png`,
      'og:url': shareUrl
    };
  }
}