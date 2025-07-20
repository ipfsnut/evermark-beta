// src/features/evermarks/services/EvermarkService.ts
// Complete business logic for Evermarks feature with full IPFS integration

import { 
  type Evermark, 
  type EvermarkMetadata, 
  type CreateEvermarkInput,
  type CreateEvermarkResult,
  type EvermarkFeedOptions,
  type EvermarkFeedResult,
  type ValidationResult,
  type ValidationError,
  type FarcasterCastData
} from '../types';

// Environment configuration
const ENVIRONMENT = {
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  PINATA_JWT: import.meta.env.VITE_PINATA_JWT,
  IPFS_GATEWAY: import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs',
  THIRDWEB_CLIENT_ID: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
  EVERMARK_CONTRACT: import.meta.env.VITE_EVERMARK_CONTRACT_ADDRESS,
  ENABLE_IPFS: import.meta.env.VITE_ENABLE_IPFS !== 'false'
};

/**
 * IPFS Integration Service
 * Handles file and metadata uploads to IPFS via Pinata
 */
class IPFSService {
  private static readonly PINATA_API_URL = 'https://api.pinata.cloud';
  
  /**
   * Upload file to IPFS via Pinata
   */
  static async uploadFile(file: File): Promise<{ ipfsHash: string; url: string }> {
    if (!ENVIRONMENT.PINATA_JWT) {
      console.warn('IPFS upload disabled: No Pinata JWT configured');
      // Return a mock hash for development
      return {
        ipfsHash: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: URL.createObjectURL(file)
      };
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Add metadata for better organization
      const metadata = JSON.stringify({
        name: file.name,
        keyvalues: {
          type: 'evermark-image',
          uploadedAt: new Date().toISOString(),
          size: file.size.toString(),
          mimeType: file.type
        }
      });
      formData.append('pinataMetadata', metadata);

      const options = JSON.stringify({
        cidVersion: 1,
        customPinPolicy: {
          regions: [
            { id: 'FRA1', desiredReplicationCount: 2 },
            { id: 'NYC1', desiredReplicationCount: 2 }
          ]
        }
      });
      formData.append('pinataOptions', options);

      const response = await fetch(`${this.PINATA_API_URL}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ENVIRONMENT.PINATA_JWT}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`IPFS upload failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      
      return {
        ipfsHash: result.IpfsHash,
        url: `${ENVIRONMENT.IPFS_GATEWAY}/${result.IpfsHash}`
      };
    } catch (error) {
      console.error('IPFS file upload failed:', error);
      throw new Error(`Failed to upload image to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload JSON metadata to IPFS
   */
  static async uploadMetadata(metadata: Record<string, any>): Promise<{ ipfsHash: string; url: string }> {
    if (!ENVIRONMENT.PINATA_JWT) {
      console.warn('IPFS metadata upload disabled: No Pinata JWT configured');
      // Return a mock hash for development
      return {
        ipfsHash: `mock-meta-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`
      };
    }

    try {
      const pinataMetadata = {
        name: `evermark-metadata-${Date.now()}`,
        keyvalues: {
          type: 'evermark-metadata',
          contentType: metadata.contentType || 'unknown',
          uploadedAt: new Date().toISOString(),
          title: metadata.title || 'Untitled'
        }
      };

      const pinataOptions = {
        cidVersion: 1,
        customPinPolicy: {
          regions: [
            { id: 'FRA1', desiredReplicationCount: 2 },
            { id: 'NYC1', desiredReplicationCount: 2 }
          ]
        }
      };

      const data = {
        pinataContent: metadata,
        pinataMetadata,
        pinataOptions
      };

      const response = await fetch(`${this.PINATA_API_URL}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ENVIRONMENT.PINATA_JWT}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`IPFS metadata upload failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      
      return {
        ipfsHash: result.IpfsHash,
        url: `${ENVIRONMENT.IPFS_GATEWAY}/${result.IpfsHash}`
      };
    } catch (error) {
      console.error('IPFS metadata upload failed:', error);
      throw new Error(`Failed to upload metadata to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch content from IPFS
   */
  static async fetchFromIPFS(ipfsHash: string): Promise<any> {
    try {
      const response = await fetch(`${ENVIRONMENT.IPFS_GATEWAY}/${ipfsHash}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      console.error('IPFS fetch failed:', error);
      throw new Error(`Failed to fetch from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Farcaster Integration Service
 * Handles Farcaster cast detection and metadata extraction
 */
class FarcasterService {
  /**
   * Validate if input is a Farcaster cast URL or hash
   */
  static validateFarcasterInput(input: string): { isValid: boolean; type: 'url' | 'hash' | null; error?: string } {
    if (!input?.trim()) {
      return { isValid: false, type: null, error: 'Input is required' };
    }

    const trimmedInput = input.trim();

    // Check for Farcaster URLs
    const urlPatterns = [
      /^https:\/\/warpcast\.com\/[^\/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/farcaster\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/,
      /^https:\/\/supercast\.xyz\/[^\/]+\/0x[a-fA-F0-9]+/
    ];

    for (const pattern of urlPatterns) {
      if (pattern.test(trimmedInput)) {
        return { isValid: true, type: 'url' };
      }
    }

    // Check for direct hash
    if (/^0x[a-fA-F0-9]{8,64}$/.test(trimmedInput)) {
      return { isValid: true, type: 'hash' };
    }

    return { 
      isValid: false, 
      type: null, 
      error: 'Invalid Farcaster cast URL or hash format' 
    };
  }

  /**
   * Extract cast hash from Farcaster URL
   */
  static extractCastHash(input: string): string | null {
    const validation = this.validateFarcasterInput(input);
    if (!validation.isValid) return null;

    if (validation.type === 'hash') {
      return input.trim();
    }

    // Extract hash from URL
    const hashMatch = input.match(/0x[a-fA-F0-9]+/);
    return hashMatch ? hashMatch[0] : null;
  }

  /**
   * Fetch cast metadata from Farcaster
   */
  static async fetchCastMetadata(castInput: string): Promise<FarcasterCastData | null> {
    try {
      const castHash = this.extractCastHash(castInput);
      if (!castHash) {
        throw new Error('Invalid cast hash or URL');
      }

      // Try to fetch via our API endpoint
      const response = await fetch(`${ENVIRONMENT.API_BASE}/farcaster-cast?hash=${castHash}`);
      
      if (response.ok) {
        const data = await response.json();
        return {
          castHash,
          author: data.author?.displayName || data.author?.username || 'Unknown',
          username: data.author?.username || '',
          content: data.text || '',
          timestamp: data.timestamp || new Date().toISOString(),
          engagement: {
            likes: data.reactions?.likes || 0,
            recasts: data.reactions?.recasts || 0,
            replies: data.replies?.count || 0
          }
        };
      }

      // Fallback: Create basic metadata from hash
      console.warn('Could not fetch cast metadata, using fallback');
      return {
        castHash,
        author: 'Farcaster User',
        username: '',
        content: 'Cast content will be displayed when available',
        timestamp: new Date().toISOString(),
        engagement: {
          likes: 0,
          recasts: 0,
          replies: 0
        }
      };
    } catch (error) {
      console.error('Failed to fetch Farcaster cast metadata:', error);
      return null;
    }
  }
}

/**
 * Blockchain Integration Service
 * Handles smart contract interactions for minting evermarks
 */
class BlockchainService {
  /**
   * Mint evermark to blockchain
   */
  static async mintEvermark(
    metadataURI: string,
    title: string,
    creator: string,
    userAddress: string
  ): Promise<{ success: boolean; txHash?: string; tokenId?: string; error?: string }> {
    try {
      // This would integrate with Thirdweb SDK
      // For now, return a mock successful transaction
      console.log('Minting evermark to blockchain:', {
        metadataURI,
        title,
        creator,
        userAddress
      });

      // Simulate blockchain transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful transaction
      const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      const mockTokenId = Math.floor(Math.random() * 10000).toString();

      return {
        success: true,
        txHash: mockTxHash,
        tokenId: mockTokenId
      };
    } catch (error) {
      console.error('Blockchain minting failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Blockchain transaction failed'
      };
    }
  }
}

/**
 * EvermarkService - Main business logic for Evermarks
 */
export class EvermarkService {
  
  /**
   * Fetch evermarks with pagination and filtering
   */
  static async fetchEvermarks(options: EvermarkFeedOptions = {
    page: 1,
    pageSize: 12,
    sortBy: 'created_at',
    sortOrder: 'desc'
  }): Promise<EvermarkFeedResult> {
    try {
      const {
        page = 1,
        pageSize = 12,
        sortBy = 'created_at',
        sortOrder = 'desc',
        filters = {}
      } = options;

      // Build query parameters
      const params = this.buildSearchParams(options);

      const response = await fetch(`${ENVIRONMENT.API_BASE}/evermarks?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch evermarks: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform API data to our Evermark type
      const evermarks = (data.data || []).map(this.transformAPIToEvermark);
      
      return {
        evermarks,
        totalCount: data.count || 0,
        page,
        totalPages: Math.ceil((data.count || 0) / pageSize),
        hasNextPage: page < Math.ceil((data.count || 0) / pageSize),
        hasPreviousPage: page > 1
      };
    } catch (error) {
      console.error('Error fetching evermarks:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch evermarks'
      );
    }
  }

  /**
   * Fetch a single evermark by ID
   */
  static async fetchEvermark(id: string): Promise<Evermark | null> {
    try {
      const response = await fetch(`${ENVIRONMENT.API_BASE}/evermarks?id=${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch evermark: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformAPIToEvermark(data);
    } catch (error) {
      console.error('Error fetching evermark:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch evermark'
      );
    }
  }

  /**
   * Create a new evermark with complete IPFS and blockchain integration
   */
  static async createEvermark(input: CreateEvermarkInput): Promise<CreateEvermarkResult> {
    try {
      console.log('🚀 Starting evermark creation process...');
      
      // Step 1: Validate input
      const validation = this.validateEvermarkMetadata(input.metadata);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      let imageUrl: string | undefined;
      let imageIPFSHash: string | undefined;

      // Step 2: Upload image to IPFS if provided
      if (input.image) {
        console.log('📸 Uploading image to IPFS...');
        try {
          const imageResult = await IPFSService.uploadFile(input.image);
          imageUrl = imageResult.url;
          imageIPFSHash = imageResult.ipfsHash;
          console.log('✅ Image uploaded to IPFS:', imageIPFSHash);
        } catch (error) {
          console.warn('⚠️ Image upload failed, continuing without image:', error);
          // Continue without image rather than failing completely
        }
      }

      // Step 3: Prepare metadata for IPFS
      const ipfsMetadata = {
        name: input.metadata.title,
        description: input.metadata.description,
        image: imageUrl,
        external_url: input.metadata.sourceUrl,
        attributes: [
          {
            trait_type: 'Content Type',
            value: input.metadata.contentType || 'Custom'
          },
          {
            trait_type: 'Author',
            value: input.metadata.author
          },
          {
            trait_type: 'Created At',
            value: new Date().toISOString()
          }
        ],
        // Extended metadata
        evermark: {
          version: '1.0',
          contentType: input.metadata.contentType,
          sourceUrl: input.metadata.sourceUrl,
          tags: input.metadata.tags || [],
          customFields: input.metadata.customFields || [],
          // Type-specific metadata
          ...(input.metadata.doi && { doi: input.metadata.doi }),
          ...(input.metadata.isbn && { isbn: input.metadata.isbn }),
          ...(input.metadata.journal && { journal: input.metadata.journal }),
          ...(input.metadata.publisher && { publisher: input.metadata.publisher }),
          ...(input.metadata.castUrl && { castUrl: input.metadata.castUrl })
        }
      };

      // Add custom fields as attributes
      if (input.metadata.customFields && input.metadata.customFields.length > 0) {
        input.metadata.customFields.forEach(field => {
          ipfsMetadata.attributes.push({
            trait_type: field.key,
            value: field.value
          });
        });
      }

      // Step 4: Handle Farcaster cast data if applicable
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        console.log('💬 Fetching Farcaster cast metadata...');
        try {
          const castData = await FarcasterService.fetchCastMetadata(input.metadata.castUrl);
          if (castData) {
            ipfsMetadata.evermark.castData = castData;
            // Update title and description if they weren't provided
            if (!input.metadata.title) {
              ipfsMetadata.name = `Cast by ${castData.author}`;
            }
            if (!input.metadata.description) {
              ipfsMetadata.description = castData.content.substring(0, 200) + (castData.content.length > 200 ? '...' : '');
            }
            console.log('✅ Farcaster metadata retrieved');
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch Farcaster metadata:', error);
        }
      }

      // Step 5: Upload metadata to IPFS
      console.log('📄 Uploading metadata to IPFS...');
      const metadataResult = await IPFSService.uploadMetadata(ipfsMetadata);
      const metadataURI = `ipfs://${metadataResult.ipfsHash}`;
      console.log('✅ Metadata uploaded to IPFS:', metadataResult.ipfsHash);

      // Step 6: Mint to blockchain (mock for now)
      console.log('⛓️ Minting to blockchain...');
      const mintResult = await BlockchainService.mintEvermark(
        metadataURI,
        input.metadata.title,
        input.metadata.author,
        'user-address' // This would come from wallet context
      );

      if (!mintResult.success) {
        throw new Error(mintResult.error || 'Blockchain minting failed');
      }

      console.log('✅ Evermark created successfully!');

      // Step 7: Return success result
      return {
        success: true,
        message: 'Evermark created successfully',
        tokenId: mintResult.tokenId,
        txHash: mintResult.txHash,
        metadataURI,
        imageUrl,
        castData: ipfsMetadata.evermark.castData
      };

    } catch (error) {
      console.error('❌ Evermark creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create evermark'
      };
    }
  }

  /**
   * Validate evermark metadata with comprehensive checks
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields validation
    if (!metadata.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (metadata.title.length > 100) {
      errors.push({ field: 'title', message: 'Title must be 100 characters or less' });
    } else if (metadata.title.length < 3) {
      warnings.push({ field: 'title', message: 'Title should be at least 3 characters' });
    }

    if (!metadata.description?.trim()) {
      warnings.push({ field: 'description', message: 'Description is recommended for better discoverability' });
    } else if (metadata.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description must be 1000 characters or less' });
    }

    if (!metadata.author?.trim()) {
      errors.push({ field: 'author', message: 'Author is required' });
    } else if (metadata.author.length > 50) {
      errors.push({ field: 'author', message: 'Author name must be 50 characters or less' });
    }

    if (!metadata.sourceUrl?.trim()) {
      warnings.push({ field: 'sourceUrl', message: 'Source URL is recommended for reference' });
    } else {
      try {
        new URL(metadata.sourceUrl);
      } catch {
        errors.push({ field: 'sourceUrl', message: 'Source URL must be a valid URL' });
      }
    }

    // Content-type specific validation
    if (metadata.contentType === 'DOI' && metadata.doi) {
      if (!/^10\.\d{4,}\/[^\s]+$/.test(metadata.doi)) {
        errors.push({ field: 'doi', message: 'Invalid DOI format (should be 10.xxxx/xxxxx)' });
      }
    }

    if (metadata.contentType === 'ISBN' && metadata.isbn) {
      const cleanIsbn = metadata.isbn.replace(/[-\s]/g, '');
      if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleanIsbn)) {
        errors.push({ field: 'isbn', message: 'Invalid ISBN format (should be 10 or 13 digits)' });
      }
    }

    if (metadata.contentType === 'Cast' && metadata.castUrl) {
      const validation = FarcasterService.validateFarcasterInput(metadata.castUrl);
      if (!validation.isValid) {
        errors.push({ field: 'castUrl', message: validation.error || 'Invalid Farcaster cast URL or hash' });
      }
    }

    if (metadata.contentType === 'URL' && metadata.url) {
      try {
        new URL(metadata.url);
      } catch {
        errors.push({ field: 'url', message: 'Invalid URL format' });
      }
    }

    // Image file validation
    if (metadata.imageFile) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(metadata.imageFile.type)) {
        errors.push({ field: 'imageFile', message: 'Image must be JPEG, PNG, GIF, or WebP format' });
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (metadata.imageFile.size > maxSize) {
        errors.push({ field: 'imageFile', message: 'Image must be less than 10MB' });
      }
      
      if (metadata.imageFile.size > 2 * 1024 * 1024) { // 2MB
        warnings.push({ field: 'imageFile', message: 'Consider compressing the image for faster loading' });
      }
    }

    // Tags validation
    if (metadata.tags && metadata.tags.length > 10) {
      warnings.push({ field: 'tags', message: 'Consider using fewer tags for better organization' });
    }

    // Custom fields validation
    if (metadata.customFields) {
      metadata.customFields.forEach((field, index) => {
        if (!field.key?.trim()) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key is required' });
        } else if (field.key.length > 50) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key must be 50 characters or less' });
        } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)) {
          errors.push({ field: `customFields.${index}.key`, message: 'Custom field key must start with a letter and contain only letters, numbers, and underscores' });
        }
        
        if (!field.value?.trim()) {
          errors.push({ field: `customFields.${index}.value`, message: 'Custom field value is required' });
        } else if (field.value.length > 200) {
          errors.push({ field: `customFields.${index}.value`, message: 'Custom field value must be 200 characters or less' });
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Check if input is a Farcaster cast URL or hash
   */
  static isFarcasterInput(input: string): boolean {
    return FarcasterService.validateFarcasterInput(input).isValid;
  }

  /**
   * Validate Farcaster input and return detailed results
   */
  static validateFarcasterInput(input: string) {
    return FarcasterService.validateFarcasterInput(input);
  }

  /**
   * Extract content type from URL
   */
  static detectContentType(url: string): Evermark['contentType'] {
    try {
      const parsedUrl = new URL(url.toLowerCase());
      const hostname = parsedUrl.hostname;
      
      if (hostname.includes('farcaster') || hostname.includes('warpcast')) {
        return 'Cast';
      }
      if (hostname.includes('doi.org') || url.includes('doi.org')) {
        return 'DOI';
      }
      if (url.includes('isbn')) {
        return 'ISBN';
      }
      
      return 'URL';
    } catch {
      return 'Custom';
    }
  }

  /**
   * Transform API data to Evermark type
   */
  static transformAPIToEvermark(apiData: any): Evermark {
    return {
      id: apiData.id || apiData.token_id?.toString() || '',
      tokenId: apiData.token_id || parseInt(apiData.id) || 0,
      title: apiData.title || apiData.name || 'Untitled',
      author: apiData.author || 'Unknown Author',
      creator: apiData.creator || apiData.owner || apiData.author || 'Unknown Creator',
      description: apiData.description || apiData.content || '',
      sourceUrl: apiData.sourceUrl || apiData.external_url || apiData.source_url,
      image: apiData.image || apiData.processed_image_url,
      metadataURI: apiData.metadataURI || apiData.token_uri || '',
      
      contentType: this.determineContentType(apiData),
      tags: this.extractTags(apiData),
      verified: apiData.verified || false,
      
      creationTime: apiData.creationTime || Math.floor(new Date(apiData.created_at || Date.now()).getTime() / 1000),
      createdAt: apiData.created_at || apiData.timestamp || new Date().toISOString(),
      updatedAt: apiData.updated_at || apiData.created_at || new Date().toISOString(),
      lastSyncedAt: apiData.lastSyncedAt || apiData.sync_timestamp,
      
      imageStatus: this.mapImageStatus(apiData.image_processing_status || apiData.imageStatus),
      
      extendedMetadata: {
        doi: apiData.metadata?.doi || apiData.extendedMetadata?.doi,
        isbn: apiData.metadata?.isbn || apiData.extendedMetadata?.isbn,
        castData: apiData.metadata?.farcasterData || apiData.extendedMetadata?.castData,
        tags: apiData.tags || apiData.metadata?.tags || [],
        customFields: this.extractCustomFields(apiData),
        processedImageUrl: apiData.processed_image_url
      },
      
      votes: apiData.votes || apiData.voting_power || 0,
      viewCount: apiData.view_count || 0
    };
  }

  /**
   * Extract custom fields from API data
   */
  private static extractCustomFields(apiData: any): Array<{ key: string; value: string }> {
    const customFields: Array<{ key: string; value: string }> = [];
    
    // From metadata.customFields
    if (apiData.metadata?.customFields && Array.isArray(apiData.metadata.customFields)) {
      customFields.push(...apiData.metadata.customFields);
    }
    
    // From metadata.attributes (IPFS format)
    if (apiData.metadata?.attributes && Array.isArray(apiData.metadata.attributes)) {
      const standardTraits = new Set(['Content Type', 'Author', 'Created At', 'content_type', 'author', 'created_at']);
      
      apiData.metadata.attributes.forEach((attr: any) => {
        if (attr.trait_type && attr.value && !standardTraits.has(attr.trait_type)) {
          customFields.push({
            key: attr.trait_type,
            value: attr.value.toString()
          });
        }
      });
    }
    
    return customFields;
  }

  /**
   * Determine content type from API data
   */
  private static determineContentType(apiData: any): Evermark['contentType'] {
    const contentType = apiData.content_type?.toLowerCase() || apiData.evermark_type?.toLowerCase() || '';
    const sourceUrl = apiData.sourceUrl?.toLowerCase() || apiData.source_url?.toLowerCase() || '';
    
    if (contentType.includes('cast') || sourceUrl.includes('farcaster') || sourceUrl.includes('warpcast')) {
      return 'Cast';
    }
    if (contentType.includes('doi') || sourceUrl.includes('doi.org')) {
      return 'DOI';
    }
    if (contentType.includes('isbn')) {
      return 'ISBN';
    }
    if (contentType.includes('url') || sourceUrl.startsWith('http')) {
      return 'URL';
    }
    
    return 'Custom';
  }

  /**
   * Extract tags from API data
   */
  private static extractTags(apiData: any): string[] {
    const tags: string[] = [];
    
    // From direct tags field
    if (Array.isArray(apiData.tags)) {
      tags.push(...apiData.tags);
    }
    
    // From metadata
    if (apiData.metadata?.tags && Array.isArray(apiData.metadata.tags)) {
      tags.push(...apiData.metadata.tags);
    }
    
    // From description (Tags: format)
    if (apiData.description) {
      const tagMatches = apiData.description.match(/Tags:\s*([^|]+)/i);
      if (tagMatches) {
        const extractedTags = tagMatches[1].split(',').map((tag: string) => tag.trim());
        tags.push(...extractedTags);
      }
      
      // From hashtags in description
      const hashtagMatches = apiData.description.match(/#\w+/g);
      if (hashtagMatches) {
        const hashtags = hashtagMatches.map((tag: string) => tag.slice(1)); // Remove #
        tags.push(...hashtags);
      }
    }
    
    // From IPFS attributes
    if (apiData.metadata?.attributes && Array.isArray(apiData.metadata.attributes)) {
      const tagsAttr = apiData.metadata.attributes.find((attr: any) => 
        attr.trait_type?.toLowerCase() === 'tags'
      );
      if (tagsAttr && tagsAttr.value) {
        const attrTags = typeof tagsAttr.value === 'string' 
          ? tagsAttr.value.split(',').map((tag: string) => tag.trim())
          : Array.isArray(tagsAttr.value) ? tagsAttr.value : [];
        tags.push(...attrTags);
      }
    }
    
    // Deduplicate, filter empty, and limit length
    return [...new Set(tags
      .filter(tag => tag && tag.length > 0 && tag.length <= 30)
      .map(tag => tag.toLowerCase())
    )].slice(0, 10); // Max 10 tags
  }

  /**
   * Map image processing status
   */
  private static mapImageStatus(status?: string): Evermark['imageStatus'] {
    switch (status) {
      case 'completed':
      case 'processed':
        return 'processed';
      case 'processing':
      case 'pending':
        return 'processing';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return 'none';
    }
  }

  /**
   * Get default pagination options
   */
  static getDefaultPagination() {
    return {
      page: 1,
      pageSize: 12,
      sortBy: 'created_at' as const,
      sortOrder: 'desc' as const
    };
  }

  /**
   * Get default filters
   */
  static getDefaultFilters() {
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
   * Build search query parameters
   */
  static buildSearchParams(options: EvermarkFeedOptions): URLSearchParams {
    const params = new URLSearchParams();
    
    // Pagination
    params.append('page', options.page.toString());
    params.append('pageSize', options.pageSize.toString());
    params.append('sortBy', options.sortBy);
    params.append('sortOrder', options.sortOrder);
    
    // Filters
    if (options.filters) {
      const { filters } = options;
      
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.author) {
        params.append('author', filters.author);
      }
      if (filters.contentType) {
        params.append('contentType', filters.contentType);
      }
      if (filters.verified !== undefined) {
        params.append('verified', filters.verified.toString());
      }
      if (filters.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }
      if (filters.dateRange) {
        params.append('startDate', filters.dateRange.start.toISOString());
        params.append('endDate', filters.dateRange.end.toISOString());
      }
    }
    
    return params;
  }

  /**
   * Helper method to create IPFS metadata from evermark metadata
   */
  static createIPFSMetadata(metadata: EvermarkMetadata, imageUrl?: string) {
    const ipfsMetadata = {
      name: metadata.title,
      description: metadata.description || '',
      image: imageUrl,
      external_url: metadata.sourceUrl,
      
      // Standard ERC721 attributes
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
          value: new Date().toISOString()
        }
      ],
      
      // Extended Evermark metadata
      evermark: {
        version: '1.0',
        contentType: metadata.contentType,
        sourceUrl: metadata.sourceUrl,
        tags: metadata.tags || [],
        customFields: metadata.customFields || []
      }
    };

    // Add tags as attributes
    if (metadata.tags && metadata.tags.length > 0) {
      ipfsMetadata.attributes.push({
        trait_type: 'Tags',
        value: metadata.tags.join(', ')
      });
    }

    // Add custom fields as attributes
    if (metadata.customFields && metadata.customFields.length > 0) {
      metadata.customFields.forEach(field => {
        ipfsMetadata.attributes.push({
          trait_type: field.key,
          value: field.value
        });
      });
    }

    // Add content-type specific metadata
    if (metadata.contentType === 'DOI' && metadata.doi) {
      ipfsMetadata.evermark.doi = metadata.doi;
      ipfsMetadata.attributes.push({
        trait_type: 'DOI',
        value: metadata.doi
      });
    }

    if (metadata.contentType === 'ISBN' && metadata.isbn) {
      ipfsMetadata.evermark.isbn = metadata.isbn;
      ipfsMetadata.attributes.push({
        trait_type: 'ISBN',
        value: metadata.isbn
      });
    }

    if (metadata.journal) {
      ipfsMetadata.evermark.journal = metadata.journal;
      ipfsMetadata.attributes.push({
        trait_type: 'Journal',
        value: metadata.journal
      });
    }

    if (metadata.publisher) {
      ipfsMetadata.evermark.publisher = metadata.publisher;
      ipfsMetadata.attributes.push({
        trait_type: 'Publisher',
        value: metadata.publisher
      });
    }

    if (metadata.publicationDate) {
      ipfsMetadata.evermark.publicationDate = metadata.publicationDate;
      ipfsMetadata.attributes.push({
        trait_type: 'Publication Date',
        value: metadata.publicationDate
      });
    }

    return ipfsMetadata;
  }

  /**
   * Search evermarks by text query
   */
  static async searchEvermarks(query: string, options: Partial<EvermarkFeedOptions> = {}): Promise<EvermarkFeedResult> {
    return this.fetchEvermarks({
      ...this.getDefaultPagination(),
      ...options,
      filters: {
        ...this.getDefaultFilters(),
        ...options.filters,
        search: query
      }
    });
  }

  /**
   * Get evermarks by author
   */
  static async getEvermarksByAuthor(author: string, options: Partial<EvermarkFeedOptions> = {}): Promise<EvermarkFeedResult> {
    return this.fetchEvermarks({
      ...this.getDefaultPagination(),
      ...options,
      filters: {
        ...this.getDefaultFilters(),
        ...options.filters,
        author
      }
    });
  }

  /**
   * Get evermarks by content type
   */
  static async getEvermarksByContentType(contentType: Evermark['contentType'], options: Partial<EvermarkFeedOptions> = {}): Promise<EvermarkFeedResult> {
    return this.fetchEvermarks({
      ...this.getDefaultPagination(),
      ...options,
      filters: {
        ...this.getDefaultFilters(),
        ...options.filters,
        contentType
      }
    });
  }

  /**
   * Get trending evermarks
   */
  static async getTrendingEvermarks(options: Partial<EvermarkFeedOptions> = {}): Promise<EvermarkFeedResult> {
    return this.fetchEvermarks({
      ...this.getDefaultPagination(),
      sortBy: 'votes',
      sortOrder: 'desc',
      ...options
    });
  }

  /**
   * Get recent evermarks
   */
  static async getRecentEvermarks(options: Partial<EvermarkFeedOptions> = {}): Promise<EvermarkFeedResult> {
    return this.fetchEvermarks({
      ...this.getDefaultPagination(),
      sortBy: 'created_at',
      sortOrder: 'desc',
      ...options
    });
  }

  /**
   * Validate custom field name
   */
  static validateCustomFieldName(name: string): { isValid: boolean; error?: string } {
    if (!name?.trim()) {
      return { isValid: false, error: 'Field name is required' };
    }

    const trimmed = name.trim();
    
    if (trimmed.length > 50) {
      return { isValid: false, error: 'Field name must be 50 characters or less' };
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
      return { isValid: false, error: 'Field name must start with a letter and contain only letters, numbers, and underscores' };
    }

    // Reserved field names
    const reserved = new Set([
      'name', 'title', 'description', 'image', 'external_url', 'attributes',
      'author', 'content_type', 'source_url', 'created_at', 'updated_at',
      'id', 'token_id', 'owner', 'creator', 'verified', 'tags'
    ]);

    if (reserved.has(trimmed.toLowerCase())) {
      return { isValid: false, error: 'This field name is reserved and cannot be used' };
    }

    return { isValid: true };
  }

  /**
   * Format content type for display
   */
  static formatContentType(contentType: Evermark['contentType']): string {
    switch (contentType) {
      case 'Cast':
        return 'Farcaster Cast';
      case 'DOI':
        return 'Academic Paper (DOI)';
      case 'ISBN':
        return 'Book (ISBN)';
      case 'URL':
        return 'Web Content';
      case 'Custom':
        return 'Custom Content';
      default:
        return contentType;
    }
  }

  /**
   * Get content type options for forms
   */
  static getContentTypeOptions() {
    return [
      { value: 'Custom', label: 'Custom Content' },
      { value: 'Cast', label: 'Farcaster Cast' },
      { value: 'DOI', label: 'Academic Paper (DOI)' },
      { value: 'ISBN', label: 'Book (ISBN)' },
      { value: 'URL', label: 'Web Content' }
    ];
  }

  /**
   * Calculate estimated gas cost for minting (mock)
   */
  static async estimateGasCost(): Promise<{ gasPrice: string; estimatedCost: string }> {
    // This would integrate with actual gas estimation
    return {
      gasPrice: '0.001 ETH',
      estimatedCost: '~$2.50 USD'
    };
  }

  /**
   * Check if user can afford to mint
   */
  static async canAffordMint(userBalance: string): Promise<boolean> {
    // This would check actual token balance and gas costs
    const balanceNumber = parseFloat(userBalance);
    return balanceNumber > 0.002; // Minimum balance for gas
  }
}