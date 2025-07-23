// src/features/evermarks/services/EvermarkService.ts
// Fixed orchestrator service for Evermark feature

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

// Import your existing service implementations
import { APIService } from './APIService';
import { EvermarkBlockchainService } from './BlockchainService';
import { MetadataService } from './MetadataService';
import { ValidationService } from './ValidationService';
import { FarcasterService } from './FarcasterService';
import { IPFSService } from './IPFSService';

/**
 * Main orchestrator service for Evermark feature
 * Coordinates between your existing specialized services
 */
export class EvermarkService {
  
  // ===== DEFAULT CONFIGURATIONS =====
  
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

  // ===== DATA FETCHING =====
  
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    try {
      return await APIService.fetchEvermarks(options);
    } catch (error) {
      console.error('EvermarkService.fetchEvermarks failed:', error);
      throw error;
    }
  }

  static async fetchEvermark(id: string): Promise<Evermark | null> {
    try {
      return await APIService.fetchEvermark(id);
    } catch (error) {
      console.error('EvermarkService.fetchEvermark failed:', error);
      throw error;
    }
  }

  // ===== CREATION WORKFLOW =====
  
  static async createEvermark(input: CreateEvermarkInput, account?: any): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 EvermarkService: Starting creation workflow');
      
      // Check if we have an account for blockchain operations
      if (!account) {
        return {
          success: false,
          error: 'No wallet account provided - blockchain minting requires an active account'
        };
      }
      
      // Step 1: Validate
      const validation = ValidationService.validateEvermarkMetadata(input.metadata);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Step 2: Process image if provided
      let imageUrl: string | undefined;
      if (input.image) {
        console.log('📸 Processing image...');
        const imageResult = await MetadataService.processImage(input.image);
        if (imageResult.success) {
          imageUrl = imageResult.imageUrl;
        } else {
          console.warn('Image processing failed, continuing without image');
        }
      }

      // Step 3: Handle Farcaster cast if needed
      let castData;
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        console.log('💬 Fetching Farcaster cast data...');
        castData = await FarcasterService.fetchCastMetadata(input.metadata.castUrl);
      }

      // Step 4: Create and upload metadata
      console.log('📄 Creating metadata...');
      const metadataResult = await MetadataService.uploadMetadata(input.metadata, imageUrl);
      if (!metadataResult.success) {
        return {
          success: false,
          error: metadataResult.error || 'Failed to create metadata'
        };
      }

      // Step 5: Mint to blockchain - FIXED: Pass all required parameters correctly
      console.log('⛓️ Minting to blockchain...');
      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,                          // account (required)
        metadataResult.metadataURI!,     // metadataURI (required)
        input.metadata.title,            // title (required)
        input.metadata.author,           // creator (required) - THIS WAS THE FIX!
        undefined                        // referrer (optional)
      );

      if (!mintResult.success) {
        return {
          success: false,
          error: mintResult.error || 'Blockchain minting failed'
        };
      }

      // Step 6: Save to database
      console.log('💾 Saving to database...');
      try {
        const dbResult = await APIService.createEvermarkRecord({
          tokenId: mintResult.tokenId!,
          title: input.metadata.title,
          author: input.metadata.author,
          description: input.metadata.description || '',
          sourceUrl: input.metadata.sourceUrl,
          metadataURI: metadataResult.metadataURI!,
          txHash: mintResult.txHash!,
          imageUrl,
          contentType: input.metadata.contentType || 'Custom',
          tags: input.metadata.tags || []
        });

        if (!dbResult.success) {
          console.warn('Database save failed:', dbResult.error);
          // Continue anyway since blockchain mint succeeded
        }
      } catch (error) {
        console.warn('Database save failed:', error);
        // Continue anyway since blockchain mint succeeded
      }

      console.log('✅ Evermark creation complete!');

      return {
        success: true,
        message: 'Evermark created successfully',
        tokenId: mintResult.tokenId,
        txHash: mintResult.txHash,
        metadataURI: metadataResult.metadataURI,
        imageUrl,
        castData: castData || undefined // Convert null to undefined
      };

    } catch (error) {
      console.error('❌ EvermarkService.createEvermark failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // ===== VALIDATION =====
  
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    return ValidationService.validateEvermarkMetadata(metadata);
  }

  // ===== CONVENIENCE METHODS =====
  
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

  static async getEvermarksByAuthor(
    author: string,
    options: Partial<EvermarkFeedOptions> = {}
  ): Promise<EvermarkFeedResult> {
    const authorOptions: EvermarkFeedOptions = {
      ...this.getDefaultPagination(),
      ...options,
      filters: {
        ...this.getDefaultFilters(),
        ...options.filters,
        author
      }
    };
    return this.fetchEvermarks(authorOptions);
  }

  static async getEvermarksByType(
    contentType: Evermark['contentType'],
    options: Partial<EvermarkFeedOptions> = {}
  ): Promise<EvermarkFeedResult> {
    const typeOptions: EvermarkFeedOptions = {
      ...this.getDefaultPagination(),
      ...options,
      filters: {
        ...this.getDefaultFilters(),
        ...options.filters,
        contentType
      }
    };
    return this.fetchEvermarks(typeOptions);
  }

  // ===== SERVICE STATUS =====
  
  static isConfigured(): boolean {
    // Check if core services are available
    try {
      return IPFSService.isConfigured() && 
             EvermarkBlockchainService.isConfigured();
    } catch (error) {
      return false;
    }
  }

  static getServiceStatus() {
    return {
      blockchain: EvermarkBlockchainService.isConfigured(),
      ipfs: IPFSService.isConfigured(),
      api: true // API service is always available
    };
  }
}