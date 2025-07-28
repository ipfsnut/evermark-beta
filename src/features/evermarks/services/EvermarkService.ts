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
   * FIXED: Single upload workflow - no more double upload!
   * Generates predictable temporary ID that gets moved to final location
   */
  static async createEvermark(input: CreateEvermarkInput, account?: any): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 Starting FIXED evermark creation with single upload');
      
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
      let tempImageId: string | undefined;

      // FIXED: Generate predictable temporary ID that we can update later
      if (input.image) {
        console.log('📸 Processing image with SINGLE upload strategy...');
        
        // Generate predictable temp ID based on user + timestamp
        tempImageId = `temp_${account.address.slice(-8)}_${Date.now()}`;
        
        // Single upload to Supabase with predictable temp ID
        const supabaseResult = await SupabaseImageService.uploadImage(
          input.image,
          tempImageId,
          {
            generateThumbnail: true,
            maxWidth: 1200,
            maxHeight: 900,
            quality: 0.9
          }
        );

        if (supabaseResult.success) {
          // Store temp URLs - these will be updated after we get tokenId
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
        // Cleanup uploaded image if metadata fails
        if (tempImageId) {
          await SupabaseImageService.deleteImage(tempImageId);
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
        // Cleanup uploaded image if minting fails
        if (tempImageId) {
          await SupabaseImageService.deleteImage(tempImageId);
        }
        return {
          success: false,
          error: mintResult.error || 'Blockchain minting failed'
        };
      }

      const tokenId = mintResult.tokenId!;

      // FIXED: Move image from temp location to final location instead of re-uploading
      if (supabaseImageUrl && tempImageId && tokenId) {
        try {
          console.log('📁 Moving image from temp to final location...');
          const moveResult = await SupabaseImageService.moveImageToTokenId(tempImageId, tokenId);
          
          if (moveResult.success) {
            // Update URLs to point to final location
            supabaseImageUrl = moveResult.finalImageUrl;
            thumbnailUrl = moveResult.finalThumbnailUrl;
            console.log('✅ Image successfully moved to final location');
          } else {
            console.warn('⚠️ Failed to move image, keeping temp location:', moveResult.error);
            // Keep using temp URLs - better than losing the image entirely
          }
        } catch (moveError) {
          console.warn('⚠️ Image move failed, keeping temp location:', moveError);
          // Continue with temp URLs rather than failing entire operation
        }
      }

      // Save to database with final image data
      console.log('💾 Saving to database with FINAL image data...');
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

      console.log('✅ FIXED evermark creation complete with single upload!');

      return {
        success: true,
        message: 'Evermark created successfully with optimized single upload',
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