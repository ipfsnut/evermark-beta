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

import { APIService } from './APIService';
import { SupabaseImageService } from './SupabaseImageService';
import { EvermarkBlockchainService } from './BlockchainService';
import { MetadataService } from './MetadataService';
import { ValidationService } from './ValidationService';
import { FarcasterService } from './FarcasterService';
import { IPFSService } from './IPFSService';

export class EvermarkService {
  
  // Keep existing default methods unchanged
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

  // Keep existing fetch methods unchanged - they now use enhanced APIService
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    return APIService.fetchEvermarks(options);
  }

  static async fetchEvermark(id: string): Promise<Evermark | null> {
    return APIService.fetchEvermark(id);
  }

  /**
   * ENHANCED creation workflow with hybrid image storage
   */
  static async createEvermark(input: CreateEvermarkInput, account?: any): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 Starting enhanced evermark creation with hybrid storage');
      
      if (!account) {
        return {
          success: false,
          error: 'No wallet account provided'
        };
      }

      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Service not properly configured'
        };
      }
      
      // Validate input
      const validation = ValidationService.validateEvermarkMetadata(input.metadata);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      let supabaseImageUrl: string | undefined;
      let thumbnailUrl: string | undefined;
      let ipfsHash: string | undefined;
      let fileSize: number | undefined;
      let dimensions: string | undefined;

      // ENHANCED: Process image with hybrid storage
      if (input.image) {
        console.log('📸 Processing image with hybrid storage...');
        
        // Upload to Supabase (primary) + IPFS (backup)
        const supabaseResult = await SupabaseImageService.uploadImage(
          input.image,
          `temp-${Date.now()}`, // Temporary ID, will update with real tokenId
          {
            generateThumbnail: true,
            maxWidth: 1200,
            maxHeight: 900,
            quality: 0.9
          }
        );

        if (supabaseResult.success) {
          supabaseImageUrl = supabaseResult.supabaseUrl;
          thumbnailUrl = supabaseResult.thumbnailUrl;
          fileSize = supabaseResult.fileSize;
          dimensions = supabaseResult.dimensions;
        } else {
          console.warn('Supabase image upload failed:', supabaseResult.error);
        }

        // Upload to IPFS as backup (non-blocking)
        try {
          const ipfsResult = await IPFSService.uploadFile(input.image);
          ipfsHash = ipfsResult.ipfsHash;
          console.log('✅ IPFS backup successful:', ipfsHash);
        } catch (ipfsError) {
          console.warn('⚠️ IPFS backup failed (non-critical):', ipfsError);
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
      console.log('📄 Creating metadata...');
      const metadataResult = await MetadataService.uploadMetadata(input.metadata, supabaseImageUrl);
      if (!metadataResult.success) {
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
        return {
          success: false,
          error: mintResult.error || 'Blockchain minting failed'
        };
      }

      const tokenId = mintResult.tokenId!;

      // Update Supabase image paths with real tokenId if we uploaded images
      if (supabaseImageUrl && tokenId) {
        try {
          // Copy images to correct tokenId path
          const finalImageResult = await SupabaseImageService.uploadImage(
            input.image!,
            tokenId,
            {
              generateThumbnail: true,
              maxWidth: 1200,
              maxHeight: 900,
              quality: 0.9
            }
          );

          if (finalImageResult.success) {
            supabaseImageUrl = finalImageResult.supabaseUrl;
            thumbnailUrl = finalImageResult.thumbnailUrl;
          }
        } catch (updateError) {
          console.warn('Failed to update image paths with tokenId:', updateError);
        }
      }

      // Save to database with enhanced image data
      console.log('💾 Saving to database with hybrid image data...');
      try {
        const dbResult = await APIService.createEvermarkRecord({
          tokenId,
          title: input.metadata.title,
          author: input.metadata.author,
          description: input.metadata.description || '',
          sourceUrl: input.metadata.sourceUrl,
          metadataURI: metadataResult.metadataURI!,
          txHash: mintResult.txHash!,
          supabaseImageUrl,
          thumbnailUrl,
          ipfsHash,
          contentType: input.metadata.contentType || 'Custom',
          tags: input.metadata.tags || [],
          fileSize,
          dimensions
        });

        if (!dbResult.success) {
          console.warn('Database save failed (non-critical):', dbResult.error);
        }
      } catch (dbError) {
        console.warn('Database save failed (non-critical):', dbError);
      }

      console.log('✅ Enhanced evermark creation complete!');

      return {
        success: true,
        message: 'Evermark created successfully with hybrid image storage',
        tokenId,
        txHash: mintResult.txHash,
        metadataURI: metadataResult.metadataURI,
        imageUrl: supabaseImageUrl,
        castData: castData || undefined
      };

    } catch (error) {
      console.error('❌ Enhanced creation failed:', error);
      
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
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Keep existing convenience methods unchanged
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    return ValidationService.validateEvermarkMetadata(metadata);
  }

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

  static isConfigured(): boolean {
    try {
      const hasIPFS = IPFSService.isConfigured();
      const hasBlockchain = EvermarkBlockchainService.isConfigured();
      const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL;
      
      console.log('🔧 Enhanced service configuration:', {
        hasIPFS,
        hasBlockchain, 
        hasSupabase,
        hasPinata: !!import.meta.env.VITE_PINATA_JWT
      });
      
      return hasBlockchain && hasSupabase; // IPFS now optional
    } catch (error) {
      console.error('Configuration check failed:', error);
      return false;
    }
  }
}
