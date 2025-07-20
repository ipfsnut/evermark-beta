// ===============================================
// 11. src/features/evermarks/utils/ipfsHelpers.ts
// IPFS-specific utilities
// ===============================================

export class IPFSHelpers {
  private static readonly IPFS_HASH_REGEX = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58}|B[A-Z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]{48}|F[0-9A-F]{50})$/;
  private static readonly IPFS_URL_REGEX = /^(https?:\/\/)?([^\/]+\/)?(ipfs\/)?([^\/\?#]+)/;

  /**
   * Validate IPFS hash format
   */
  static isValidIPFSHash(hash: string): boolean {
    return this.IPFS_HASH_REGEX.test(hash);
  }

  /**
   * Extract IPFS hash from URL
   */
  static extractHashFromUrl(url: string): string | null {
    // Handle ipfs:// protocol
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', '');
    }

    // Handle HTTP/HTTPS IPFS gateway URLs
    const match = url.match(this.IPFS_URL_REGEX);
    if (match && match[4]) {
      const potentialHash = match[4];
      return this.isValidIPFSHash(potentialHash) ? potentialHash : null;
    }

    // Direct hash
    return this.isValidIPFSHash(url) ? url : null;
  }

  /**
   * Convert IPFS hash to gateway URL
   */
  static hashToGatewayUrl(hash: string, gateway = 'https://gateway.pinata.cloud/ipfs'): string {
    const cleanHash = this.extractHashFromUrl(hash) || hash;
    return `${gateway.replace(/\/$/, '')}/${cleanHash}`;
  }

  /**
   * Convert gateway URL to IPFS protocol URL
   */
  static gatewayUrlToIPFS(url: string): string {
    const hash = this.extractHashFromUrl(url);
    return hash ? `ipfs://${hash}` : url;
  }

  /**
   * Get multiple gateway URLs for redundancy
   */
  static getRedundantGatewayUrls(hash: string): string[] {
    const gateways = [
      'https://gateway.pinata.cloud/ipfs',
      'https://ipfs.io/ipfs',
      'https://cloudflare-ipfs.com/ipfs',
      'https://dweb.link/ipfs'
    ];

    const cleanHash = this.extractHashFromUrl(hash) || hash;
    return gateways.map(gateway => `${gateway}/${cleanHash}`);
  }

  /**
   * Preload IPFS content
   */
  static async preloadContent(hash: string): Promise<boolean> {
    const urls = this.getRedundantGatewayUrls(hash);
    
    const preloadPromises = urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    });

    const results = await Promise.allSettled(preloadPromises);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  /**
   * Generate IPFS metadata for NFT standard
   */
  static generateNFTMetadata(evermark: {
    title: string;
    description: string;
    imageHash?: string;
    attributes?: Array<{ trait_type: string; value: string | number }>;
  }): any {
    const metadata: any = {
      name: evermark.title,
      description: evermark.description,
      attributes: evermark.attributes || []
    };

    if (evermark.imageHash) {
      metadata.image = `ipfs://${evermark.imageHash}`;
    }

    return metadata;
  }

  /**
   * Calculate content size estimation
   */
  static estimateContentSize(content: any): number {
    const jsonString = JSON.stringify(content);
    return new Blob([jsonString]).size;
  }

  /**
   * Generate content identifier for caching
   */
  static generateContentId(content: any): string {
    const jsonString = JSON.stringify(content);
    // Simple hash function for content identification
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if content is already pinned
   */
  static async isContentPinned(hash: string): Promise<boolean> {
    try {
      // This would check with your pinning service
      // For now, return true for all valid hashes
      return this.isValidIPFSHash(hash);
    } catch {
      return false;
    }
  }

  /**
   * Format IPFS error messages
   */
  static formatIPFSError(error: any): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error?.message) return error.message;
    return 'Unknown IPFS error occurred';
  }
}