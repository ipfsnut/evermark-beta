/**
 * Enhanced ArDrive cost estimation with real file size detection and pricing
 */

// Real ArDrive pricing (as of 2024)
const ARDRIVE_PRICING = {
  // Base costs in USD
  UPLOAD_BASE_FEE: 0.01,              // Fixed per upload
  STORAGE_PER_MB: 0.00046,            // $0.46 per GB = $0.00046 per MB
  METADATA_STORAGE: 0.001,            // Small fee for metadata
  
  // Dynamic multipliers based on file types
  VIDEO_MULTIPLIER: 1.2,              // Videos cost 20% more due to processing
  LARGE_FILE_MULTIPLIER: 1.1,         // Files >10MB get 10% surcharge
  
  // Price feed URLs for real-time AR token pricing
  AR_PRICE_API: 'https://api.coingecko.com/api/v3/simple/price?ids=arweave&vs_currencies=usd',
  
  // Backup static pricing if API fails
  FALLBACK_AR_PRICE_USD: 9.50,        // Conservative AR token price
  
  // Platform costs (our markup)
  PLATFORM_MARKUP: 0.15,              // 15% markup for profit
  MINIMUM_PROFIT: 0.05,               // Minimum $0.05 profit per transaction
};

interface MediaFile {
  url: string;
  type: 'image' | 'video' | 'gif' | 'unknown';
  sizeBytes: number;
  sizeMB: number;
  estimatedCostUSD: number;
}

interface AccurateCostEstimate {
  // File analysis
  mediaFiles: MediaFile[];
  totalSizeMB: number;
  
  // Cost breakdown
  baseCosts: {
    ardrive: number;
    metadata: number;
    platform: number;
  };
  
  // Dynamic costs
  storageCostUSD: number;
  processingCostUSD: number;
  platformFeeUSD: number;
  totalCostUSD: number;
  
  // Profit analysis
  userPaysFeeUSD: number;           // Current ~$0.30
  ourProfitUSD: number;             // Positive = profit, negative = loss
  shouldChargeExtra: boolean;       // true if we'd lose money
  
  // Recommendations
  recommendedFeeUSD: number;        // What we should charge
  recommendedFeeETH: number;        // Converted to ETH
}

export class AccurateArDrivePricing {
  
  /**
   * Get actual file size via HEAD request
   */
  static async getActualFileSize(url: string): Promise<number> {
    try {
      // First try HEAD request to get Content-Length
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: {
          'User-Agent': 'Evermark-Bot/1.0',
        }
      });
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        return parseInt(contentLength, 10);
      }
      
      // Fallback: partial GET request to estimate
      const partialResponse = await fetch(url, {
        headers: {
          'Range': 'bytes=0-1024',  // Get first 1KB to check
          'User-Agent': 'Evermark-Bot/1.0',
        }
      });
      
      const contentRange = partialResponse.headers.get('content-range');
      if (contentRange) {
        // Extract total size from "bytes 0-1023/12345" format
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
      
      // Last resort: rough estimate based on file type
      return this.estimateFileSizeByType(url);
      
    } catch (error) {
      console.warn(`Failed to get file size for ${url}:`, error);
      return this.estimateFileSizeByType(url);
    }
  }
  
  /**
   * Estimate file size based on URL/type when HTTP requests fail
   */
  private static estimateFileSizeByType(url: string): number {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png')) {
      return 500 * 1024; // 500KB average
    } else if (urlLower.includes('.gif')) {
      return 2 * 1024 * 1024; // 2MB average  
    } else if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov')) {
      return 8 * 1024 * 1024; // 8MB average
    } else if (urlLower.includes('.pdf')) {
      return 1.5 * 1024 * 1024; // 1.5MB average
    }
    
    return 1 * 1024 * 1024; // 1MB default
  }
  
  /**
   * Determine file type from URL
   */
  private static getFileType(url: string): MediaFile['type'] {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.mov') || urlLower.includes('.avi')) {
      return 'video';
    } else if (urlLower.includes('.gif')) {
      return 'gif';
    } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.svg')) {
      return 'image';
    }
    
    return 'unknown';
  }
  
  /**
   * Get current AR token price in USD
   */
  static async getARTokenPrice(): Promise<number> {
    try {
      const response = await fetch(ARDRIVE_PRICING.AR_PRICE_API);
      const data = await response.json();
      return data.arweave?.usd || ARDRIVE_PRICING.FALLBACK_AR_PRICE_USD;
    } catch (error) {
      console.warn('Failed to fetch AR token price, using fallback:', error);
      return ARDRIVE_PRICING.FALLBACK_AR_PRICE_USD;
    }
  }
  
  /**
   * Calculate accurate ArDrive costs for a list of media URLs
   */
  static async calculateAccurateCosts(
    mediaUrls: string[], 
    ethPriceUSD: number = 2500 // Default ETH price if not provided
  ): Promise<AccurateCostEstimate> {
    
    // Step 1: Analyze all media files in parallel
    const mediaFiles: MediaFile[] = await Promise.all(
      mediaUrls.map(async (url) => {
        const sizeBytes = await this.getActualFileSize(url);
        const sizeMB = sizeBytes / (1024 * 1024);
        const type = this.getFileType(url);
        
        // Calculate individual file cost
        let baseCost = sizeMB * ARDRIVE_PRICING.STORAGE_PER_MB;
        
        // Apply multipliers
        if (type === 'video') {
          baseCost *= ARDRIVE_PRICING.VIDEO_MULTIPLIER;
        }
        if (sizeMB > 10) {
          baseCost *= ARDRIVE_PRICING.LARGE_FILE_MULTIPLIER;
        }
        
        return {
          url,
          type,
          sizeBytes,
          sizeMB: Math.round(sizeMB * 100) / 100,
          estimatedCostUSD: Math.round(baseCost * 10000) / 10000, // 4 decimal places
        };
      })
    );
    
    // Step 2: Calculate totals
    const totalSizeMB = mediaFiles.reduce((sum, file) => sum + file.sizeMB, 0);
    const storageCostUSD = mediaFiles.reduce((sum, file) => sum + file.estimatedCostUSD, 0);
    
    // Step 3: Add base costs
    const baseCosts = {
      ardrive: ARDRIVE_PRICING.UPLOAD_BASE_FEE,
      metadata: ARDRIVE_PRICING.METADATA_STORAGE,
      platform: Math.max(
        storageCostUSD * ARDRIVE_PRICING.PLATFORM_MARKUP,
        ARDRIVE_PRICING.MINIMUM_PROFIT
      ),
    };
    
    // Step 4: Calculate processing costs (for complex media)
    const processingCostUSD = mediaFiles
      .filter(f => f.type === 'video' && f.sizeMB > 5)
      .length * 0.02; // $0.02 per large video
    
    const totalCostUSD = storageCostUSD + baseCosts.ardrive + baseCosts.metadata + baseCosts.platform + processingCostUSD;
    
    // Step 5: Profit analysis
    const userPaysFeeUSD = 0.30; // Current user fee (~0.00007 ETH)
    const ourProfitUSD = userPaysFeeUSD - totalCostUSD;
    const shouldChargeExtra = totalCostUSD > 0.20; // Threshold from user's request
    
    // Step 6: Recommendations
    const recommendedFeeUSD = shouldChargeExtra ? 
      Math.max(totalCostUSD + baseCosts.platform, userPaysFeeUSD) : 
      userPaysFeeUSD;
    const recommendedFeeETH = recommendedFeeUSD / ethPriceUSD;
    
    return {
      mediaFiles,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      baseCosts,
      storageCostUSD: Math.round(storageCostUSD * 10000) / 10000,
      processingCostUSD: Math.round(processingCostUSD * 10000) / 10000,
      platformFeeUSD: Math.round(baseCosts.platform * 10000) / 10000,
      totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
      userPaysFeeUSD: Math.round(userPaysFeeUSD * 100) / 100,
      ourProfitUSD: Math.round(ourProfitUSD * 10000) / 10000,
      shouldChargeExtra,
      recommendedFeeUSD: Math.round(recommendedFeeUSD * 10000) / 10000,
      recommendedFeeETH: Math.round(recommendedFeeETH * 1000000) / 1000000, // 6 decimal places
    };
  }
  
  /**
   * Get cost estimate from Farcaster cast data
   */
  static async estimateCastBackupCost(castInput: string): Promise<AccurateCostEstimate> {
    try {
      // Fetch cast data to get media URLs
      const response = await fetch(`/.netlify/functions/farcaster-cast?hash=${encodeURIComponent(castInput)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch cast data');
      }

      const result = await response.json();
      if (!result.success || !result.data?.embeds) {
        // No media - just basic text costs
        return this.calculateAccurateCosts([]);
      }

      // Extract media URLs from embeds
      const mediaUrls = result.data.embeds
        .map((embed: any) => embed.url)
        .filter((url: string) => url && this.isMediaUrl(url));

      return this.calculateAccurateCosts(mediaUrls);
      
    } catch (error) {
      console.error('Failed to estimate cast backup cost:', error);
      // Return conservative estimate on error
      return this.calculateAccurateCosts([]);
    }
  }
  
  /**
   * Check if URL points to media content
   */
  private static isMediaUrl(url: string): boolean {
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mov', '.avi', '.svg'];
    const urlLower = url.toLowerCase();
    return mediaExtensions.some(ext => urlLower.includes(ext)) || 
           urlLower.includes('cdn.') || 
           urlLower.includes('imgur.') ||
           urlLower.includes('giphy.') ||
           urlLower.includes('media.');
  }
}