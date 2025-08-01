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
  type ImageSourceInput,
  type SourceResolutionConfig
} from '@ipfsnut/evermark-sdk-core';

import { 
  StorageOrchestrator,
  SupabaseStorageClient,
  IPFSClient,
  type TransferResult,
  type StorageFlowResult
} from '@ipfsnut/evermark-sdk-storage';

import { 
  ImageLoader,
  CORSHandler,
  PerformanceMonitor,
  type LoadImageResult
} from '@ipfsnut/evermark-sdk-browser';

// Keep existing services
import { APIService } from './APIService';
import { EvermarkBlockchainService } from './BlockchainService';
import { MetadataService } from './MetadataService';
import { FarcasterService } from './FarcasterService';

// SDK configuration
import { getEvermarkStorageConfig, getEvermarkStorageOrchestrator } from '../config/sdk-config';

export class EvermarkService {
  
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

  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    const result = await APIService.fetchEvermarks(options);
    
    // Enhance evermarks with optimal image URLs using SDK
    if (result.evermarks) {
      result.evermarks = result.evermarks.map(evermark => ({
        ...evermark,
        image: this.getOptimalImageUrl(evermark) || evermark.image
      }));
    }
    
    return result;
  }

  static async fetchEvermark(id: string): Promise<Evermark | null> {
    const evermark = await APIService.fetchEvermark(id);
    
    if (evermark) {
      // Enhance with optimal image URL
      evermark.image = this.getOptimalImageUrl(evermark) || evermark.image;
    }
    
    return evermark;
  }

  /**
   * SDK-POWERED: Create evermark with complete hybrid storage
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

      let storageResult: StorageFlowResult | null = null;
      let imageUrls: {
        supabaseUrl?: string;
        thumbnailUrl?: string;
        ipfsHash?: string;
        fileSize?: number;
        dimensions?: string;
      } = {};

      // Process image with SDK if provided
      if (input.image) {
        console.log('📸 Processing image with SDK...');
        
        const orchestrator = getEvermarkStorageOrchestrator();
        
        // Create ImageSourceInput for the upload
        const uploadInput: ImageSourceInput = {
          supabaseUrl: undefined, // Will be set after upload
          preferThumbnail: false
        };

        try {
          // Use the SDK's storage flow
          storageResult = await orchestrator.ensureImageInSupabase(uploadInput, (progress) => {
            console.log(`Upload progress: ${progress.percentage}% - ${progress.message}`);
          });

          if (storageResult && storageResult.finalUrl) {
            imageUrls.supabaseUrl = storageResult.finalUrl;
            
            // Extract additional details from transfer result
            if (storageResult.transferResult) {
              imageUrls.fileSize = storageResult.transferResult.fileSize;
              imageUrls.ipfsHash = storageResult.transferResult.ipfsHash;
            }

            console.log('✅ Image processing completed:', imageUrls);
          }
        } catch (uploadError) {
          console.warn('Image upload failed, continuing without image:', uploadError);
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

      // Create and upload metadata
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

      // Mint to blockchain
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

      // Save to database with hybrid storage data
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
   * SDK-POWERED: Get optimal image URL with intelligent fallback
   */
  static getOptimalImageUrl(evermark: Evermark, preferThumbnail = false): string | undefined {
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
      return resolvedSources.length > 0 ? resolvedSources[0]!.url : undefined;
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
   * SDK-POWERED: Resolve all available image sources
   */
  static resolveImageSources(evermark: Evermark): any[] {
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
   * SDK-POWERED: Test image loading with fallbacks
   */
  static async testImageLoading(evermark: Evermark): Promise<LoadImageResult> {
    try {
      const sources = this.resolveImageSources(evermark);
      
      if (sources.length === 0) {
        return {
          success: false,
          error: 'No image sources available'
        };
      }

      const imageLoader = new ImageLoader({
        debug: process.env.NODE_ENV === 'development',
        timeout: 8000,
        maxRetries: 2
      });

      return await imageLoader.loadImage(sources);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image loading test failed'
      };
    }
  }

  /**
   * Validate image file
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
   * Enhanced search with image optimization
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
   * Validate evermark metadata
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
   * Check if SDK is properly configured
   */
  static isSDKConfigured(): boolean {
    try {
      // Test core functions
      const coreAvailable = !!(resolveImageSources && isValidUrl && isValidIpfsHash);
      
      // Test storage
      const storageAvailable = !!(StorageOrchestrator && SupabaseStorageClient);
      
      // Test browser
      const browserAvailable = !!(ImageLoader && CORSHandler);
      
      // Test configuration
      const configAvailable = !!getEvermarkStorageConfig();
      
      // Test blockchain
      const blockchainAvailable = EvermarkBlockchainService.isConfigured();
      
      console.log('🔧 SDK Configuration Status:', {
        core: coreAvailable,
        storage: storageAvailable,
        browser: browserAvailable,
        config: configAvailable,
        blockchain: blockchainAvailable
      });
      
      return coreAvailable && storageAvailable && browserAvailable && configAvailable && blockchainAvailable;
    } catch (error) {
      console.error('SDK configuration check failed:', error);
      return false;
    }
  }

  /**
   * Get detailed SDK status for debugging
   */
  static getSDKStatus() {
    return {
      packages: {
        core: {
          available: !!(resolveImageSources && isValidUrl),
          functions: ['resolveImageSources', 'isValidUrl', 'isValidIpfsHash', 'createIpfsUrl']
        },
        storage: {
          available: !!(StorageOrchestrator && SupabaseStorageClient),
          classes: ['StorageOrchestrator', 'SupabaseStorageClient', 'IPFSClient']
        },
        browser: {
          available: !!(ImageLoader && CORSHandler),
          classes: ['ImageLoader', 'CORSHandler', 'PerformanceMonitor']
        }
      },
      environment: {
        supabase: {
          url: !!import.meta.env.VITE_SUPABASE_URL,
          key: !!import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        pinata: !!import.meta.env.VITE_PINATA_JWT,
        blockchain: EvermarkBlockchainService.isConfigured()
      },
      configuration: {
        storageConfig: (() => {
          try {
            const config = getEvermarkStorageConfig();
            return {
              available: true,
              bucketName: config.supabase.bucketName,
              ipfsGateway: config.ipfs.gateway
            };
          } catch {
            return { available: false };
          }
        })()
      }
    };
  }
}