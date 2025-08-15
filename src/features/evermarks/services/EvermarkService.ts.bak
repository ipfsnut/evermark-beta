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

import { 
  resolveImageSources, 
  isValidUrl,
  isValidIpfsHash,
  createIpfsUrl,
  validateStorageConfig,
  generateStoragePath,
  type ImageSourceInput,
  type StorageConfig,
  ImageLoadingError,
  StorageError
} from 'evermark-sdk/core';

import { 
  StorageOrchestrator,
  ensureImageInSupabase,
  SupabaseStorageClient,
  IPFSClient,
  type StorageFlowResult,
  type TransferResult
} from 'evermark-sdk/storage';

// Keep existing service imports
import { APIService } from './APIService';
import { EvermarkBlockchainService } from './BlockchainService';
import { FarcasterService } from './FarcasterService';

// SDK configuration
import { getEvermarkStorageConfig } from '../config/sdk-config';

export class EvermarkService {
  private static storageOrchestrator: StorageOrchestrator | null = null;

  /**
   * Get or create storage orchestrator
   */
  private static getStorageOrchestrator(): StorageOrchestrator {
    if (!this.storageOrchestrator) {
      const storageConfig = getEvermarkStorageConfig();
      const validation = validateStorageConfig(storageConfig);
      
      if (!validation.valid) {
        throw new StorageError(
          `Invalid storage configuration: ${validation.errors.join(', ')}`,
          'CONFIG_ERROR'
        );
      }
      
      this.storageOrchestrator = new StorageOrchestrator(storageConfig);
    }
    return this.storageOrchestrator;
  }

  // Keep existing static methods
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
   * SDK-POWERED: Optimal image URL resolution
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
      
      // Fallback to manual resolution
      if (preferThumbnail && evermark.thumbnailUrl) {
        return evermark.thumbnailUrl;
      }
      
      return evermark.supabaseImageUrl || 
             evermark.processed_image_url || 
             (evermark.ipfsHash ? createIpfsUrl(evermark.ipfsHash) : undefined);
    }
  }

  /**
   * SDK-POWERED: Image source resolution for debugging
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
   * ENHANCED: Create evermark with direct SDK metadata handling (NO MetadataService)
   */
  static async createEvermark(input: CreateEvermarkInput, account?: any): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 Creating evermark with direct SDK metadata handling');
      
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

      // IPFS-FIRST: Image processing
      if (input.image) {
        console.log('📸 Processing image with IPFS-first approach...');
        
        try {
          // Get storage config for IPFS
          const storageConfig = getEvermarkStorageConfig();
          
          // Create IPFS client directly
          const ipfsClient = new IPFSClient(storageConfig.ipfs);
          
          // Upload directly to IPFS first
          console.log('🌐 Uploading to IPFS...');
          
          const ipfsResult = await ipfsClient.uploadFile(input.image, {
            onProgress: (progress) => {
              console.log(`IPFS upload progress: ${progress.percentage}%`);
            }
          });

          if (ipfsResult.success && ipfsResult.ipfsHash) {
            imageUrls.ipfsHash = ipfsResult.ipfsHash;
            imageUrls.fileSize = input.image.size;
            console.log('✅ IPFS upload completed:', imageUrls.ipfsHash);
            
            // Skip Supabase upload for now - let it be cached later via background process
            console.log('⏭️ Skipping Supabase upload - will be cached later');
          }
        } catch (uploadError) {
          console.warn('IPFS image upload failed, continuing without image:', uploadError);
        }
      }

      // Handle Farcaster cast data
      let castData;
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        try {
          castData = await FarcasterService.fetchCastMetadata(input.metadata.castUrl);
        } catch (castError) {
          console.warn('Farcaster cast fetch failed:', castError);
        }
      }

      // DIRECT METADATA CREATION with IPFS image
      const imageForMetadata = imageUrls.ipfsHash ? `ipfs://${imageUrls.ipfsHash}` : imageUrls.supabaseUrl;
      const metadata = await this.createMetadataDirectly(input.metadata, imageForMetadata);
      
      if (!metadata.success) {
        return {
          success: false,
          error: metadata.error || 'Failed to create metadata'
        };
      }

      // Mint to blockchain
      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,
        metadata.metadataURI!,
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
          metadataURI: metadata.metadataURI!,
          txHash: mintResult.txHash!,
          owner: account.address, // NEW: Set initial owner to minter
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

      console.log('✅ Evermark creation successful with direct SDK metadata handling!');

      return {
        success: true,
        message: 'Evermark created successfully',
        tokenId,
        txHash: mintResult.txHash,
        metadataURI: metadata.metadataURI,
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
   * DIRECT METADATA CREATION (Replaces MetadataService.uploadMetadata)
   */
  private static async createMetadataDirectly(
    metadata: EvermarkMetadata, 
    imageUrl?: string
  ): Promise<{ success: boolean; metadataURI?: string; error?: string }> {
    try {
      console.log('📝 Creating metadata directly with SDK');

      // Build ERC-721 compliant metadata
      const nftMetadata = {
        name: metadata.title,
        description: metadata.description,
        image: imageUrl,
        external_url: metadata.sourceUrl,
        
        // ERC-721 attributes
        attributes: [
          {
            trait_type: 'Content Type',
            value: metadata.contentType || 'Custom'
          },
          {
            trait_type: 'Author',
            value: metadata.author
          },
          {
            trait_type: 'Created At',
            value: new Date().toISOString(),
            display_type: 'date'
          }
        ],

        // Extended Evermark metadata
        evermark: {
          version: '2.0',
          contentType: metadata.contentType,
          sourceUrl: metadata.sourceUrl,
          tags: metadata.tags || [],
          customFields: metadata.customFields || [],
          
          // Content-type specific fields
          ...(metadata.doi && { doi: metadata.doi }),
          ...(metadata.isbn && { isbn: metadata.isbn }),
          ...(metadata.castUrl && { castUrl: metadata.castUrl }),
          ...(metadata.url && { url: metadata.url }),
          ...(metadata.publisher && { publisher: metadata.publisher }),
          ...(metadata.publicationDate && { publicationDate: metadata.publicationDate }),
          ...(metadata.journal && { journal: metadata.journal }),
          ...(metadata.volume && { volume: metadata.volume }),
          ...(metadata.issue && { issue: metadata.issue }),
          ...(metadata.pages && { pages: metadata.pages })
        }
      };

      // Add tags as attributes
      if (metadata.tags && metadata.tags.length > 0) {
        metadata.tags.forEach((tag, index) => {
          nftMetadata.attributes.push({
            trait_type: `Tag ${index + 1}`,
            value: tag
          });
        });
      }

      // Upload metadata to IPFS first
      const storageConfig = getEvermarkStorageConfig();
      const ipfsClient = new IPFSClient(storageConfig.ipfs);
      
      // Convert to blob
      const metadataBlob = new Blob([JSON.stringify(nftMetadata, null, 2)], {
        type: 'application/json'
      });

      const metadataFile = new File([metadataBlob], 'metadata.json', {
        type: 'application/json'
      });

      const uploadResult = await ipfsClient.uploadFile(metadataFile);

      if (!uploadResult.success || !uploadResult.ipfsHash) {
        throw new Error(uploadResult.error || 'Failed to upload metadata to IPFS');
      }

      const metadataURI = `ipfs://${uploadResult.ipfsHash}`;
      console.log('✅ Metadata uploaded to IPFS:', metadataURI);

      return {
        success: true,
        metadataURI
      };

    } catch (error) {
      console.error('❌ Direct metadata creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Metadata creation failed'
      };
    }
  }

  /**
   * SDK-POWERED: Background image transfer
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
   * KEEP: Image file validation
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
   * ENHANCED: Metadata validation with SDK utilities
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

    // SDK URL VALIDATION
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
   * Check if SDK is properly configured
   */
  static isSDKConfigured(): boolean {
    try {
      // Test core functions by calling them
      const testInput = { supabaseUrl: 'https://test.com/image.jpg' };
      const coreAvailable = !!(
        typeof resolveImageSources === 'function' && 
        typeof isValidUrl === 'function' && 
        typeof isValidIpfsHash === 'function' &&
        resolveImageSources(testInput).length >= 0 // Actually call the function
      );
      
      // Test storage
      const storageAvailable = !!(
        typeof StorageOrchestrator === 'function' && 
        typeof ensureImageInSupabase === 'function'
      );
      
      // Test configuration
      let configAvailable = false;
      try {
        const config = getEvermarkStorageConfig();
        configAvailable = !!(config && config.supabase && config.ipfs);
      } catch {
        configAvailable = false;
      }
      
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
   * Get SDK status for debugging
   */
  static getSDKStatus() {
    return {
      packages: {
        core: !!(typeof resolveImageSources === 'function' && typeof isValidUrl === 'function'),
        storage: !!(typeof StorageOrchestrator === 'function' && typeof ensureImageInSupabase === 'function'),
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