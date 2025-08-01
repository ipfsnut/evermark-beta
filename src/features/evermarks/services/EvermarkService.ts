import type { 
  Evermark,
  EvermarkMetadata,
  CreateEvermarkInput,
  CreateEvermarkResult,
  EvermarkFilters,
  EvermarkPagination,
  EvermarkFeedOptions,
  EvermarkFeedResult,
  ValidationResult
} from '../types';

// SDK Imports
import { 
  resolveImageSources, 
  ValidationService as CoreValidationService,
  createDefaultStorageConfig 
} from '@ipfsnut/evermark-sdk-core';

import { 
  HybridStorageService, 
  uploadToStorage, 
  transferBetweenStorages,
  getOptimalImageUrl 
} from '@ipfsnut/evermark-sdk-storage';

import { 
  ImageProcessor, 
  FileValidator, 
  ProgressTracker,
  BrowserUtils 
} from '@ipfsnut/evermark-sdk-browser';

// Keep existing non-image services
import { APIService } from './APIService';
import { EvermarkBlockchainService } from './BlockchainService';
import { MetadataService } from './MetadataService';
import { FarcasterService } from './FarcasterService';
import { getEvermarkHybridStorage, getEvermarkStorageConfig } from '../config/sdk-config';

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
    return APIService.fetchEvermarks(options);
  }

  static async fetchEvermark(id: string): Promise<Evermark | null> {
    return APIService.fetchEvermark(id);
  }

  /**
   * CLEAN SDK IMPLEMENTATION: Create evermark with full SDK integration
   */
  static async createEvermark(input: CreateEvermarkInput, account?: any): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 Creating evermark with clean SDK implementation');
      
      if (!account) {
        return { success: false, error: 'No wallet account provided' };
      }

      if (!this.isConfigured()) {
        return { success: false, error: 'SDK not properly configured' };
      }

      // Browser validation
      const browserCapabilities = BrowserUtils.getDeviceInfo();
      console.log('📱 Browser capabilities:', browserCapabilities);

      // File validation using SDK
      if (input.image) {
        const browserValidation = FileValidator.validateImageFile(input.image, {
          maxSize: 10 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        });

        if (!browserValidation.isValid) {
          return {
            success: false,
            error: `File validation failed: ${browserValidation.errors.join(', ')}`
          };
        }
      }
      
      // Metadata validation using SDK
      const validation = CoreValidationService.validateEvermarkMetadata(input.metadata);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      let hybridStorageResult: any = null;
      let imageUrls: {
        supabaseUrl?: string;
        thumbnailUrl?: string;
        ipfsHash?: string;
        fileSize?: number;
        dimensions?: string;
      } = {};

      // Complete hybrid storage processing
      if (input.image) {
        console.log('📸 Processing image with SDK hybrid storage...');
        
        // Process image using SDK
        const processedImage = await ImageProcessor.processImage(input.image, {
          maxWidth: 1200,
          maxHeight: 900,
          quality: 0.9,
          format: 'auto'
        });

        // Progress tracking
        const progressTracker = new ProgressTracker();
        progressTracker.start('Image upload');

        // Use hybrid storage service
        const hybridStorage = getEvermarkHybridStorage();
        
        // Upload to primary storage (Supabase) first
        hybridStorageResult = await hybridStorage.uploadToPrimary(processedImage, {
          generateThumbnail: true,
          thumbnailSize: 300,
          folder: `temp_${account.address.slice(-8)}_${Date.now()}`
        });

        if (hybridStorageResult.success) {
          imageUrls.supabaseUrl = hybridStorageResult.primaryUrl;
          imageUrls.thumbnailUrl = hybridStorageResult.thumbnailUrl;
          imageUrls.fileSize = hybridStorageResult.fileSize;
          imageUrls.dimensions = hybridStorageResult.dimensions;

          progressTracker.update(50, 'Primary storage complete');

          // Auto-transfer to backup (IPFS) in background
          if (hybridStorageResult.autoTransferEnabled) {
            console.log('🔄 Starting auto-transfer to IPFS backup...');
            
            // Non-blocking backup upload
            hybridStorage.transferToBackup(hybridStorageResult.primaryId, processedImage)
              .then(backupResult => {
                if (backupResult.success) {
                  imageUrls.ipfsHash = backupResult.ipfsHash;
                  console.log('✅ Auto-transfer to IPFS completed:', backupResult.ipfsHash);
                } else {
                  console.warn('⚠️ Auto-transfer to IPFS failed:', backupResult.error);
                }
              })
              .catch(error => {
                console.warn('⚠️ Auto-transfer error:', error);
              });
          }

          progressTracker.complete('Image processing complete');
        } else {
          progressTracker.fail('Image upload failed');
          return {
            success: false,
            error: hybridStorageResult.error || 'Image upload failed'
          };
        }
      }

      // Handle Farcaster cast data
      let castData;
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        console.log('💬 Fetching Farcaster cast data...');
        try {
          castData = await FarcasterService.fetchCastMetadata(input.metadata.castUrl);
        } catch (castError) {
          console.warn('Farcaster cast fetch failed:', castError);
        }
      }

      // Create and upload metadata to IPFS
      console.log('📄 Creating metadata with enhanced URLs...');
      const metadataResult = await MetadataService.uploadMetadata(
        input.metadata, 
        imageUrls.supabaseUrl
      );
      
      if (!metadataResult.success) {
        // Cleanup uploaded images if metadata fails
        if (hybridStorageResult?.primaryId) {
          await getEvermarkHybridStorage().cleanup(hybridStorageResult.primaryId);
        }
        return {
          success: false,
          error: metadataResult.error || 'Failed to create metadata'
        };
      }

      // Mint to blockchain
      console.log('⛓️ Minting to blockchain...');
      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,
        metadataResult.metadataURI!,
        input.metadata.title,
        input.metadata.author,
        undefined
      );

      if (!mintResult.success) {
        // Cleanup uploaded images if minting fails
        if (hybridStorageResult?.primaryId) {
          await getEvermarkHybridStorage().cleanup(hybridStorageResult.primaryId);
        }
        return {
          success: false,
          error: mintResult.error || 'Blockchain minting failed'
        };
      }

      const tokenId = mintResult.tokenId!;

      // Move images from temp to final location
      if (hybridStorageResult?.primaryId && tokenId) {
        try {
          console.log('📁 Moving images to final location...');
          const moveResult = await getEvermarkHybridStorage().moveToFinalLocation(
            hybridStorageResult.primaryId, 
            tokenId
          );
          
          if (moveResult.success) {
            imageUrls.supabaseUrl = moveResult.finalUrls.primary;
            imageUrls.thumbnailUrl = moveResult.finalUrls.thumbnail;
            console.log('✅ Images moved to final location');
          } else {
            console.warn('⚠️ Failed to move images:', moveResult.error);
          }
        } catch (moveError) {
          console.warn('⚠️ Image move failed:', moveError);
        }
      }

      // Save to database with complete hybrid storage data
      console.log('💾 Saving to database with complete hybrid storage data...');
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

      console.log('✅ SDK evermark creation successful!');

      return {
        success: true,
        message: 'Evermark created successfully with complete hybrid storage',
        tokenId,
        txHash: mintResult.txHash,
        metadataURI: metadataResult.metadataURI,
        imageUrl: imageUrls.supabaseUrl,
        castData: castData || undefined,
        storageDetails: {
          primary: imageUrls.supabaseUrl ? 'supabase' : null,
          backup: imageUrls.ipfsHash ? 'ipfs' : null,
          autoTransfer: !!hybridStorageResult?.autoTransferEnabled
        }
      };

    } catch (error) {
      console.error('❌ SDK creation failed:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('invalid address')) {
          errorMessage = 'Invalid contract address. Please check blockchain configuration.';
        } else if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for minting fee and gas costs.';
        } else if (message.includes('user rejected') || message.includes('denied')) {
          errorMessage = 'Transaction was rejected by user.';
        } else if (message.includes('network') || message.includes('connection')) {
          errorMessage = 'Network error. Please check connection and try again.';
        } else if (message.includes('storage')) {
          errorMessage = 'Storage service error. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * SDK validation
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    return CoreValidationService.validateEvermarkMetadata(metadata);
  }

  /**
   * Get optimal image URL using SDK
   */
  static getOptimalImageUrl(evermark: Evermark, preferThumbnail = false): string | undefined {
    return getOptimalImageUrl({
      supabaseUrl: evermark.supabaseImageUrl,
      ipfsHash: evermark.ipfsHash,
      thumbnailUrl: evermark.thumbnailUrl,
      processed_image_url: evermark.image
    }, preferThumbnail);
  }

  /**
   * Resolve all available image sources
   */
  static resolveImageSources(evermark: Evermark) {
    return resolveImageSources({
      supabaseUrl: evermark.supabaseImageUrl,
      ipfsHash: evermark.ipfsHash,
      thumbnailUrl: evermark.thumbnailUrl,
      processed_image_url: evermark.image,
      preferThumbnail: false
    });
  }

  /**
   * Enhanced search with storage optimization
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
    
    const results = await this.fetchEvermarks(searchOptions);
    
    // Enhance results with optimal image URLs
    if (results.evermarks) {
      results.evermarks = results.evermarks.map(evermark => ({
        ...evermark,
        image: this.getOptimalImageUrl(evermark) || evermark.image
      }));
    }
    
    return results;
  }

  /**
   * Configuration check using all SDK packages
   */
  static isConfigured(): boolean {
    try {
      const hasCore = !!createDefaultStorageConfig;
      const hasStorage = !!HybridStorageService;
      const hasBrowser = !!BrowserUtils && BrowserUtils.supportsFileAPI();
      const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL;
      const hasBlockchain = EvermarkBlockchainService.isConfigured();
      
      console.log('🔧 SDK configuration check:', {
        hasCore,
        hasStorage, 
        hasBrowser,
        hasSupabase,
        hasBlockchain,
        hasPinata: !!import.meta.env.VITE_PINATA_JWT
      });
      
      return hasCore && hasStorage && hasBrowser && hasSupabase && hasBlockchain;
    } catch (error) {
      console.error('Configuration check failed:', error);
      return false;
    }
  }

  /**
   * Get SDK package status for debugging
   */
  static getSDKStatus() {
    return {
      packages: {
        core: !!createDefaultStorageConfig,
        storage: !!HybridStorageService,
        browser: !!BrowserUtils,
        react: typeof window !== 'undefined'
      },
      environment: {
        supabase: !!import.meta.env.VITE_SUPABASE_URL,
        pinata: !!import.meta.env.VITE_PINATA_JWT,
        blockchain: EvermarkBlockchainService.isConfigured()
      },
      browser: BrowserUtils ? {
        fileApi: BrowserUtils.supportsFileAPI(),
        dragDrop: BrowserUtils.supportsDragAndDrop(),
        webp: BrowserUtils.supportsWebP(),
        compression: BrowserUtils.supportsCanvasCompression()
      } : null
    };
  }
}