// src/features/evermarks/services/EvermarkService.ts
// Production-ready orchestrator service with proper error handling

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
import { EvermarkBlockchainService } from './BlockchainService';
import { MetadataService } from './MetadataService';
import { ValidationService } from './ValidationService';
import { FarcasterService } from './FarcasterService';
import { IPFSService } from './IPFSService';

/**
 * Main orchestrator service for Evermark feature
 * Coordinates between specialized services with comprehensive error handling
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
      console.log('🔍 Fetching evermarks with options:', options);
      return await APIService.fetchEvermarks(options);
    } catch (error) {
      console.error('EvermarkService.fetchEvermarks failed:', error);
      
      // Check if it's a specific API error we can handle
      if (error instanceof Error) {
        if (error.message.includes('HTML') || error.message.includes('<!doctype')) {
          throw new Error('API endpoint is returning HTML instead of JSON. Please check your API configuration.');
        }
        if (error.message.includes('401')) {
          throw new Error('Authentication failed. Please check your API credentials.');
        }
        if (error.message.includes('404')) {
          throw new Error('API endpoint not found. Please verify your API URL configuration.');
        }
        if (error.message.includes('CORS')) {
          throw new Error('CORS error. Please check your API CORS configuration.');
        }
      }
      
      throw error;
    }
  }

  static async fetchEvermark(id: string): Promise<Evermark | null> {
    try {
      console.log('🔍 Fetching evermark:', id);
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
      
      // Step 1: Validate prerequisites
      if (!account) {
        return {
          success: false,
          error: 'No wallet account provided - blockchain minting requires an active account'
        };
      }

      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Service not properly configured. Please check your environment variables.'
        };
      }
      
      // Step 2: Validate input
      const validation = ValidationService.validateEvermarkMetadata(input.metadata);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Step 3: Process image if provided
      let imageUrl: string | undefined;
      if (input.image) {
        console.log('📸 Processing image...');
        try {
          const imageResult = await MetadataService.processImage(input.image);
          if (imageResult.success) {
            imageUrl = imageResult.imageUrl;
          } else {
            console.warn('Image processing failed:', imageResult.error);
            // Continue without image rather than failing entirely
          }
        } catch (imageError) {
          console.warn('Image processing failed, continuing without image:', imageError);
        }
      }

      // Step 4: Handle Farcaster cast if needed
      let castData;
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        console.log('💬 Fetching Farcaster cast data...');
        try {
          castData = await FarcasterService.fetchCastMetadata(input.metadata.castUrl);
        } catch (castError) {
          console.warn('Farcaster cast fetch failed:', castError);
          // Continue without cast data
        }
      }

      // Step 5: Create and upload metadata
      console.log('📄 Creating metadata...');
      const metadataResult = await MetadataService.uploadMetadata(input.metadata, imageUrl);
      if (!metadataResult.success) {
        return {
          success: false,
          error: metadataResult.error || 'Failed to create metadata'
        };
      }

      // Step 6: Mint to blockchain
      console.log('⛓️ Minting to blockchain...');
      const mintResult = await EvermarkBlockchainService.mintEvermark(
        account,
        metadataResult.metadataURI!,
        input.metadata.title,
        input.metadata.author,
        undefined // referrer
      );

      if (!mintResult.success) {
        return {
          success: false,
          error: mintResult.error || 'Blockchain minting failed'
        };
      }

      // Step 7: Save to database (optional - don't fail if this fails)
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
          console.warn('Database save failed (non-critical):', dbResult.error);
        }
      } catch (dbError) {
        console.warn('Database save failed (non-critical):', dbError);
      }

      console.log('✅ Evermark creation complete!');

      return {
        success: true,
        message: 'Evermark created successfully',
        tokenId: mintResult.tokenId,
        txHash: mintResult.txHash,
        metadataURI: metadataResult.metadataURI,
        imageUrl,
        castData: castData || undefined
      };

    } catch (error) {
      console.error('❌ EvermarkService.createEvermark failed:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('invalid address')) {
          errorMessage = 'Invalid contract address. Please check your blockchain configuration.';
        } else if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for minting fee and gas costs.';
        } else if (message.includes('user rejected') || message.includes('denied')) {
          errorMessage = 'Transaction was rejected by user.';
        } else if (message.includes('network') || message.includes('connection')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (message.includes('ipfs') || message.includes('pinata')) {
          errorMessage = 'Failed to upload content to IPFS. Please try again.';
        } else if (message.includes('contract')) {
          errorMessage = 'Smart contract interaction failed. Please check your blockchain configuration.';
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
    try {
      const hasIPFS = IPFSService.isConfigured();
      const hasBlockchain = EvermarkBlockchainService.isConfigured();
      const hasAPI = !!import.meta.env.VITE_API_URL;
      
      console.log('🔧 Service configuration status:', {
        hasIPFS,
        hasBlockchain, 
        hasAPI,
        contractAddress: import.meta.env.VITE_EVERMARK_CONTRACT_ADDRESS,
        apiUrl: import.meta.env.VITE_API_URL,
        pinataJWT: !!import.meta.env.VITE_PINATA_JWT
      });
      
      // Require at least blockchain and IPFS for core functionality
      return hasIPFS && hasBlockchain;
    } catch (error) {
      console.error('Configuration check failed:', error);
      return false;
    }
  }

  static getServiceStatus() {
    try {
      const blockchain = EvermarkBlockchainService.isConfigured();
      const ipfs = IPFSService.isConfigured();
      const api = !!import.meta.env.VITE_API_URL;
      
      return {
        blockchain,
        ipfs,
        api,
        overall: blockchain && ipfs,
        errors: {
          blockchain: !blockchain ? 'Contract address or RPC URL not configured' : null,
          ipfs: !ipfs ? 'Pinata JWT not configured' : null,
          api: !api ? 'API URL not configured' : null
        }
      };
    } catch (error) {
      return {
        blockchain: false,
        ipfs: false,
        api: false,
        overall: false,
        errors: {
          general: 'Service status check failed'
        }
      };
    }
  }

  // ===== ERROR HANDLING HELPERS =====

  static diagnoseErrors(): string[] {
    const issues: string[] = [];
    
    try {
      // Check environment variables
      if (!import.meta.env.VITE_EVERMARK_CONTRACT_ADDRESS) {
        issues.push('Missing VITE_EVERMARK_CONTRACT_ADDRESS environment variable');
      } else if (import.meta.env.VITE_EVERMARK_CONTRACT_ADDRESS.length !== 42) {
        issues.push('Invalid VITE_EVERMARK_CONTRACT_ADDRESS format (should be 42 characters)');
      }
      
      if (!import.meta.env.VITE_RPC_URL) {
        issues.push('Missing VITE_RPC_URL environment variable');
      }
      
      if (!import.meta.env.VITE_PINATA_JWT) {
        issues.push('Missing VITE_PINATA_JWT environment variable (required for IPFS uploads)');
      }
      
      if (!import.meta.env.VITE_API_URL) {
        issues.push('Missing VITE_API_URL environment variable (required for database operations)');
      }
      
      // Check service availability
      if (!EvermarkBlockchainService.isConfigured()) {
        issues.push('Blockchain service not properly configured');
      }
      
      if (!IPFSService.isConfigured()) {
        issues.push('IPFS service not properly configured');
      }
      
    } catch (error) {
      issues.push(`Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return issues;
  }

  static getConfigurationHelp(): string {
    return `
To configure the Evermarks service, ensure these environment variables are set:

Required:
- VITE_EVERMARK_CONTRACT_ADDRESS: The deployed Evermark NFT contract address (42 characters, starts with 0x)
- VITE_RPC_URL: Base network RPC URL
- VITE_PINATA_JWT: Pinata API JWT token for IPFS uploads

Optional:
- VITE_API_URL: API endpoint for database operations
- VITE_IPFS_GATEWAY: Custom IPFS gateway URL

Example .env file:
VITE_EVERMARK_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
VITE_RPC_URL=https://mainnet.base.org
VITE_PINATA_JWT=your_pinata_jwt_token_here
VITE_API_URL=/.netlify/functions
    `.trim();
  }
}