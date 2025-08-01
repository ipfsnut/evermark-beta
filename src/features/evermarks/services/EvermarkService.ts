import type { 
  Evermark,
  EvermarkMetadata,
  CreateEvermarkInput,
  CreateEvermarkResult,
  EvermarkFilters,
  EvermarkPagination,
  EvermarkFeedOptions,
  EvermarkFeedResult
} from '../types';

// SDK imports for enhanced functionality
import { 
  resolveImageSources, 
  isValidUrl,
  isValidIpfsHash,
  createIpfsUrl,
  type ImageSourceInput
} from '@ipfsnut/evermark-sdk-core';

import { 
  StorageOrchestrator,
  ensureImageInSupabase,
  type StorageFlowResult
} from '@ipfsnut/evermark-sdk-storage';

// Keep your existing service imports
import { APIService } from './APIService';
import { EvermarkBlockchainService } from './BlockchainService';
import { MetadataService } from './MetadataService';
import { FarcasterService } from './FarcasterService';

// SDK configuration
import { getEvermarkStorageConfig } from '../config/sdk-config';

export class EvermarkService {
  
  // Keep your existing static methods
  static getDefaultPagination(): EvermarkPagination {
    return {
      page: 1,
      pageSize: 12,
      sortBy: 'created_at',
      sortOrder: 'desc'
    };
  }

  static getDefaultFilters(): EvermarkFilters {
    return {
      search: '',
      author: '',
      contentType: undefined,
      verified: undefined,
      tags: [],
      dateRange: undefined
    };
  }

  /**
   * ENHANCED: Fetch evermarks with SDK-powered image optimization
   */
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    const result = await APIService.fetchEvermarks(options);
    
    // Enhance evermarks with optimal image URLs using SDK
    if (result.evermarks) {
      result.evermarks = await Promise.all(
        result.evermarks.map(async (evermark) => ({
          ...evermark,
          image: await this.getOptimalImageUrl(evermark) || evermark.image
        }))
      );
    }
    
    return result;
  }

  /**
   * ENHANCED: Fetch single evermark with SDK optimization
   */
  static async fetchEvermark(id: string): Promise<Evermark | null> {
    const evermark = await APIService.fetchEvermark(id);
    
    if (evermark) {
      // Enhance with optimal image URL using SDK
      evermark.image = await this.getOptimalImageUrl(evermark) || evermark.image;
    }
    
    return evermark;
  }

  /**
   * NEW: SDK-powered optimal image URL resolution
   */
  static async getOptimalImageUrl(evermark: Evermark, preferThumbnail = false): Promise<string | undefined> {
    try {
      const sources: ImageSourceInput = {
        supabaseUrl: evermark.supabaseImageUrl,
        thumbnailUrl: evermark.thumbnailUrl,
        processedUrl: evermark.processed_image_url,
        ipfsHash: evermark.ipfsHash,
        preferThumbnail
      };

      const resolvedSources = resolveImageSources(sources);
      
      // Return the highest priority available source
      if (resolvedSources.length > 0) {
        return resolvedSources[0]!.url;
      }
      
      return undefined;
    } catch (error) {
      console.warn('Failed to resolve optimal image URL:', error);
      
      // Fallback to manual resolution (your existing logic)
      if (preferThumbnail && evermark.thumbnailUrl) {
        return evermark.thumbnailUrl;
      }
      
      return evermark.supabaseImageUrl || 
             evermark.processed_image_url || 
             (evermark.ipfsHash ? createIpfsUrl(evermark.ipfsHash) : undefined);
    }
  }

  /**
   * NEW: SDK-powered image source resolution for debugging
   */
  static resolveAllImageSources(evermark: Evermark): any[] {
    try {
      const sources: ImageSourceInput = {
        supabaseUrl: evermark.supabaseImageUrl,
        thumbnailUrl: evermark.thumbnailUrl,
        processedUrl: evermark.processed_image_url,
        ipfsHash: evermark.ipfsHash,
        preferThumbnail: false
      };

      return resolveImageSources(sources);
    } catch (error) {
      console.warn('Failed to resolve image sources:', error);
      return [];
    }
  }

  /**
   * ENHANCED: Create evermark with SDK-powered image processing
   */
  static async createEvermark(input: CreateEvermarkInput, account?: any): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 Creating evermark with SDK integration');
      
      if (!account) {
        return { success: false, error: 'No wallet account provided' };
      }

      // Validate configuration
      if (!this.isSDKConfigured()) {
        return { success: false, error: 'SDK not properly configured' };
      }

      // Validate image file if provided
      if (input.image) {
        const validation = this.validateImageFile(input.image);
        if (!validation.isValid) {
          return { success: false, error: validation.error };
        }
      }
      
      // Validate metadata
      const metadataValidation = this.validateEvermarkMetadata(input.metadata);
      if (!metadataValidation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${metadataValidation.errors.map(e => e.message).join(', ')}`
        };
      }

      let imageUrls: {
        supabaseUrl?: string;
        thumbnailUrl?: string;
        ipfsHash?: string;
        fileSize?: number;
        dimensions?: string;
      } = {};

      // NEW: SDK-powered image processing
      if (input.image) {
        console.log('📸 Processing image with SDK...');
        
        try {
          const orchestrator = new StorageOrchestrator(getEvermarkStorageConfig());
          
          // Use SDK to upload directly to Supabase
          const uploadResult = await orchestrator.supabaseClient.uploadFile(
            input.image,
            `uploads/${Date.now()}.${input.image.name.split('.').pop()}`,
            {
              onProgress: (progress) => {
                console.log(`Upload progress: ${progress.percentage}%`);
              }
            }
          );

          if (uploadResult.success && uploadResult.supabaseUrl) {
            imageUrls.supabaseUrl = uploadResult.supabaseUrl;
            imageUrls.fileSize = input.image.size;
            console.log('✅ SDK image upload completed:', imageUrls);
          }
        } catch (uploadError) {
          console.warn('SDK image upload failed, continuing without image:', uploadError);
        }
      }

      // Handle Farcaster cast data (keep your existing logic)
      let castData;
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        try {
          castData = await FarcasterService.fetchCastMetadata(input.metadata.castUrl);
        } catch (castError) {
          console.warn('Farcaster cast fetch failed:', castError);
        }
      }

      // Create and upload metadata (keep your existing logic)
      const metadataResult = await MetadataService.uploadMetadata(
        input.metadata, 
        imageUrls.supabaseUrl
      );
      
      if (!metadataResult.success) {
        return {
          success: false,
          error: metadataResult.error || 'Failed to create metadata'
        };
      }

      // Mint to blockchain (keep your existing logic)
      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,
        metadataResult.metadataURI!,
        input.metadata.title,
        input.metadata.author,
        undefined
      );

      if (!mintResult.success) {
        return {
          success: false,
          error: mintResult.error || 'Blockchain minting failed'
        };
      }

      const tokenId = mintResult.tokenId!;

      // Save to database with SDK image data
      try {
        const dbResult = await APIService.createEvermarkRecord({
          tokenId,
          title: input.metadata.title,
          author: input.metadata.author,
          description: input.metadata.description || '',
          sourceUrl: input.metadata.sourceUrl,
          metadataURI: metadataResult.metadataURI!,
          txHash: mintResult.txHash!,
          supabaseImageUrl: imageUrls.supabaseUrl,
          thumbnailUrl: imageUrls.thumbnailUrl,
          ipfsHash: imageUrls.ipfsHash,
          contentType: input.metadata.contentType || 'Custom',
          tags: input.metadata.tags || [],
          fileSize: imageUrls.fileSize,
          dimensions: imageUrls.dimensions
        });

        if (!dbResult.success) {
          console.warn('Database save failed (non-critical):', dbResult.error);
        }
      } catch (dbError) {
        console.warn('Database save failed (non-critical):', dbError);
      }

      console.log('✅ Evermark creation successful with SDK!');

      return {
        success: true,
        message: 'Evermark created successfully',
        tokenId,
        txHash: mintResult.txHash,
        metadataURI: metadataResult.metadataURI,
        imageUrl: imageUrls.supabaseUrl,
        castData: castData || undefined
      };

    } catch (error) {
      console.error('❌ SDK creation failed:', error);
      
      let errorMessage = 'Creation failed';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for minting fee and gas costs';
        } else if (message.includes('user rejected') || message.includes('denied')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (message.includes('network')) {
          errorMessage = 'Network error - please check connection and try again';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * NEW: SDK-powered background image transfer
   * This can be called to transfer existing IPFS images to Supabase
   */
  static async transferImageToSupabase(
    evermark: Evermark,
    onProgress?: (progress: any) => void
  ): Promise<{ success: boolean; supabaseUrl?: string; error?: string }> {
    try {
      if (!evermark.ipfsHash) {
        return { success: false, error: 'No IPFS hash available for transfer' };
      }

      console.log(`🔄 Starting SDK transfer for evermark #${evermark.tokenId}`);

      const storageConfig = getEvermarkStorageConfig();
      
      const result: StorageFlowResult = await ensureImageInSupabase(
        { ipfsHash: evermark.ipfsHash },
        storageConfig,
        onProgress
      );

      if (result.transferPerformed && result.transferResult?.supabaseUrl) {
        console.log(`✅ Transfer completed for evermark #${evermark.tokenId}`);
        return {
          success: true,
          supabaseUrl: result.transferResult.supabaseUrl
        };
      } else {
        return {
          success: true,
          supabaseUrl: result.finalUrl
        };
      }

    } catch (error) {
      console.error(`❌ Transfer failed for evermark #${evermark.tokenId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }

  /**
   * Enhanced search with SDK optimization
   */
  static async searchEvermarks(
    query: string, 
    options: Partial<EvermarkFeedOptions> = {}
  ): Promise<EvermarkFeedResult> {
    const searchOptions: EvermarkFeedOptions = {
      ...this.getDefaultPagination(),
      ...options,
      filters: {
        ...this.getDefaultFilters(),
        ...options.filters,
        search: query
      }
    };
    
    return this.fetchEvermarks(searchOptions);
  }

  /**
   * Keep your existing validation methods
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Unsupported image format. Please use JPEG, PNG, GIF, or WebP.'
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `Image too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`
      };
    }

    return { isValid: true };
  }

  /**
   * Keep your existing metadata validation
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): { 
    isValid: boolean; 
    errors: Array<{ field: string; message: string }> 
  } {
    const errors: Array<{ field: string; message: string }> = [];

    if (!metadata.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (metadata.title.length > 100) {
      errors.push({ field: 'title', message: 'Title must be 100 characters or less' });
    }

    if (!metadata.description?.trim()) {
      errors.push({ field: 'description', message: 'Description is required' });
    } else if (metadata.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description must be 1000 characters or less' });
    }

    if (!metadata.author?.trim()) {
      errors.push({ field: 'author', message: 'Author is required' });
    }

    if (metadata.sourceUrl && !isValidUrl(metadata.sourceUrl)) {
      errors.push({ field: 'sourceUrl', message: 'Invalid URL format' });
    }

    // Content type specific validation
    if (metadata.contentType === 'Cast' && metadata.castUrl) {
      const farcasterValidation = FarcasterService.validateFarcasterInput(metadata.castUrl);
      if (!farcasterValidation.isValid) {
        errors.push({ field: 'castUrl', message: farcasterValidation.error || 'Invalid cast URL' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * NEW: Check if SDK is properly configured
   */
  static isSDKConfigured(): boolean {
    try {
      // Test core functions
      const coreAvailable = !!(resolveImageSources && isValidUrl && isValidIpfsHash);
      
      // Test storage
      const storageAvailable = !!(StorageOrchestrator && ensureImageInSupabase);
      
      // Test configuration
      const configAvailable = !!getEvermarkStorageConfig();
      
      // Test blockchain
      const blockchainAvailable = EvermarkBlockchainService.isConfigured();
      
      console.log('🔧 SDK Configuration Status:', {
        core: coreAvailable,
        storage: storageAvailable,
        config: configAvailable,
        blockchain: blockchainAvailable
      });
      
      return coreAvailable && storageAvailable && configAvailable && blockchainAvailable;
    } catch (error) {
      console.error('SDK configuration check failed:', error);
      return false;
    }
  }

  /**
   * NEW: Get SDK status for debugging
   */
  static getSDKStatus() {
    return {
      packages: {
        core: !!(resolveImageSources && isValidUrl),
        storage: !!(StorageOrchestrator && ensureImageInSupabase),
        configured: this.isSDKConfigured()
      },
      environment: {
        supabase: {
          url: !!import.meta.env.VITE_SUPABASE_URL,
          key: !!import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        blockchain: EvermarkBlockchainService.isConfigured()
      }
    };
  }
}