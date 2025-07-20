// src/features/evermarks/types/index.ts
// Type definitions for the Evermarks feature

export interface Evermark {
  id: string;
  tokenId: number;
  title: string;
  author: string;
  creator: string;
  description: string;
  sourceUrl?: string;
  image?: string;
  metadataURI: string;
  contentType: 'DOI' | 'ISBN' | 'Cast' | 'URL' | 'Custom';
  tags: string[];
  verified: boolean;
  
  // Timestamps
  creationTime: number; // Unix timestamp
  createdAt: string;    // ISO string
  updatedAt: string;    // ISO string
  lastSyncedAt?: string;
  
  // Image processing
  imageStatus: 'processed' | 'processing' | 'failed' | 'none';
  
  // Extended metadata
  extendedMetadata: {
    doi?: string;
    isbn?: string;
    castData?: FarcasterCastData;
    tags?: string[];
    customFields?: Array<{ key: string; value: string }>;
    processedImageUrl?: string;
  };
  
  // Optional analytics
  votes?: number;
  viewCount?: number;
}

export interface FarcasterCastData {
  castHash?: string;
  author?: string;
  username?: string;
  content?: string;
  timestamp?: string;
  engagement?: {
    likes: number;
    recasts: number;
    replies: number;
  };
}

export interface EvermarkMetadata {
  title: string;
  description: string;
  sourceUrl: string;
  author: string;
  imageFile?: File | null;
  customFields?: Array<{ key: string; value: string }>;
  tags?: string[];
  contentType?: 'Cast' | 'DOI' | 'ISBN' | 'URL' | 'Custom';
  
  // Type-specific fields
  doi?: string;
  isbn?: string;
  url?: string;
  castUrl?: string;
  publisher?: string;
  publicationDate?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
}

export interface CreateEvermarkInput {
  metadata: EvermarkMetadata;
  image?: File;
}

export interface CreateEvermarkResult {
  success: boolean;
  message?: string;
  error?: string;
  txHash?: string;
  metadataURI?: string;
  imageUrl?: string;
  castData?: FarcasterCastData;
  tokenId?: string;
}

export interface EvermarkFilters {
  search?: string;
  author?: string;
  contentType?: Evermark['contentType'];
  verified?: boolean;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface EvermarkPagination {
  page: number;
  pageSize: number;
  sortBy: 'created_at' | 'title' | 'author' | 'votes';
  sortOrder: 'asc' | 'desc';
}

export interface EvermarkFeedOptions extends EvermarkPagination {
  filters?: EvermarkFilters;
}

export interface EvermarkFeedResult {
  evermarks: Evermark[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

// State interfaces for the hook
export interface EvermarksState {
  // Data
  evermarks: Evermark[];
  selectedEvermark: Evermark | null;
  
  // Pagination & filtering
  pagination: EvermarkPagination;
  filters: EvermarkFilters;
  totalCount: number;
  totalPages: number;
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isLoadingMore: boolean;
  
  // Error states
  error: string | null;
  createError: string | null;
  
  // Creation progress
  createProgress: number;
  createStep: string;
}

export interface EvermarksActions {
  // Data fetching
  loadEvermarks: (options?: Partial<EvermarkFeedOptions>) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Single evermark
  loadEvermark: (id: string) => Promise<Evermark | null>;
  selectEvermark: (evermark: Evermark | null) => void;
  
  // Creation
  createEvermark: (input: CreateEvermarkInput) => Promise<CreateEvermarkResult>;
  
  // Filtering & pagination
  setFilters: (filters: Partial<EvermarkFilters>) => void;
  setPagination: (pagination: Partial<EvermarkPagination>) => void;
  clearFilters: () => void;
  
  // Error handling
  clearErrors: () => void;
  clearCreateError: () => void;
}

// Hook return type
export interface UseEvermarksResult extends EvermarksState, EvermarksActions {
  // Computed properties
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isEmpty: boolean;
  isFiltered: boolean;
}

// Add this to src/features/evermarks/types/index.ts

/**
 * IPFS Metadata structure for NFT standards compliance
 * This matches what gets uploaded to IPFS and stored in the token_uri
 */
export interface IPFSMetadata {
  // Standard ERC-721 metadata fields
  name: string;                    // Required: NFT name
  description: string;             // Required: NFT description  
  image?: string;                  // Optional: Image URL (IPFS or HTTP)
  external_url?: string;           // Optional: External URL for more info
  
  // ERC-721 attributes array
  attributes: Array<{
    trait_type: string;
    value: string | number | boolean;
    display_type?: string;         // Optional: "boost_number", "boost_percentage", "number", "date"
  }>;
  
  // Extended Evermark-specific metadata
  evermark: {
    version: string;               // Metadata schema version
    contentType?: EvermarkMetadata['contentType'];
    sourceUrl?: string;
    tags: string[];
    customFields: Array<{ key: string; value: string }>;
    
    // Content-type specific fields (all optional)
    doi?: string;                  // For academic papers
    isbn?: string;                 // For books
    journal?: string;              // For academic papers
    publisher?: string;            // For books/papers
    publicationDate?: string;      // For books/papers
    volume?: string;               // For academic papers
    issue?: string;                // For academic papers
    pages?: string;                // For academic papers
    
    // Farcaster-specific fields
    castUrl?: string;              // Original cast URL
    castData?: FarcasterCastData;  // Cast metadata
    
    // URL-specific fields  
    url?: string;                  // For URL content type
  };
}

/**
 * Database row structure that matches your Supabase table exactly
 */
export interface EvermarkDatabaseRow {
  // Primary key and required fields
  token_id: number;                    // INTEGER PRIMARY KEY
  title: string;                       // TEXT NOT NULL
  author: string;                      // TEXT NOT NULL
  
  // Optional core fields
  owner?: string;                      // TEXT (Ethereum address)
  description?: string;                // TEXT
  content_type?: string;               // TEXT (e.g., "Custom Content", "Farcaster Cast")
  source_url?: string;                 // TEXT
  token_uri?: string;                  // TEXT (IPFS URI)
  
  // Timestamps
  created_at: string;                  // TIMESTAMPTZ NOT NULL
  sync_timestamp?: string;             // TIMESTAMPTZ
  updated_at?: string;                 // TIMESTAMPTZ
  last_synced_at?: string;            // TIMESTAMPTZ
  image_processed_at?: string;         // TIMESTAMP WITHOUT TIME ZONE
  
  // Status fields
  metadata_fetched?: boolean;          // BOOLEAN
  verified?: boolean;                  // BOOLEAN
  
  // Optional fields
  user_id?: string;                    // UUID
  tx_hash?: string;                    // TEXT
  block_number?: number;               // BIGINT
  
  // Image processing
  processed_image_url?: string;        // TEXT
  image_processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // JSON metadata storage
  metadata?: Record<string, any>;      // JSONB
  metadata_json?: Record<string, any>; // JSONB
  ipfs_metadata?: Record<string, any>; // JSONB
}

// Update the existing EvermarkService createEvermark method with proper typing:

export class EvermarkService {
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
        }
      }

      // Step 3: Prepare metadata for IPFS with proper typing
      const ipfsMetadata: IPFSMetadata = {
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
        // Extended metadata with all optional fields properly typed
        evermark: {
          version: '1.0',
          contentType: input.metadata.contentType,
          sourceUrl: input.metadata.sourceUrl,
          tags: input.metadata.tags || [],
          customFields: input.metadata.customFields || []
        }
      };

      // Step 4: Add content-type specific metadata safely
      if (input.metadata.contentType === 'DOI' && input.metadata.doi) {
        ipfsMetadata.evermark.doi = input.metadata.doi;
        ipfsMetadata.attributes.push({
          trait_type: 'DOI',
          value: input.metadata.doi
        });
      }

      if (input.metadata.contentType === 'ISBN' && input.metadata.isbn) {
        ipfsMetadata.evermark.isbn = input.metadata.isbn;
        ipfsMetadata.attributes.push({
          trait_type: 'ISBN',
          value: input.metadata.isbn
        });
      }

      // Add other optional metadata fields
      if (input.metadata.journal) {
        ipfsMetadata.evermark.journal = input.metadata.journal;
        ipfsMetadata.attributes.push({
          trait_type: 'Journal',
          value: input.metadata.journal
        });
      }

      if (input.metadata.publisher) {
        ipfsMetadata.evermark.publisher = input.metadata.publisher;
        ipfsMetadata.attributes.push({
          trait_type: 'Publisher',
          value: input.metadata.publisher
        });
      }

      if (input.metadata.publicationDate) {
        ipfsMetadata.evermark.publicationDate = input.metadata.publicationDate;
        ipfsMetadata.attributes.push({
          trait_type: 'Publication Date',
          value: input.metadata.publicationDate
        });
      }

      if (input.metadata.contentType === 'URL' && input.metadata.url) {
        ipfsMetadata.evermark.url = input.metadata.url;
      }

      // Step 5: Handle Farcaster cast data if applicable  
      if (input.metadata.contentType === 'Cast' && input.metadata.castUrl) {
        console.log('💬 Fetching Farcaster cast metadata...');
        try {
          ipfsMetadata.evermark.castUrl = input.metadata.castUrl;
          
          // ✅ FIXED: Consistent variable naming
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

      // Step 6: Add custom fields as attributes
      if (input.metadata.customFields && input.metadata.customFields.length > 0) {
        input.metadata.customFields.forEach(field => {
          ipfsMetadata.attributes.push({
            trait_type: field.key,
            value: field.value
          });
        });
      }

      // Step 7: Upload metadata to IPFS
      console.log('📄 Uploading metadata to IPFS...');
      const metadataResult = await IPFSService.uploadMetadata(ipfsMetadata);
      const metadataURI = `ipfs://${metadataResult.ipfsHash}`;
      console.log('✅ Metadata uploaded to IPFS:', metadataResult.ipfsHash);

      // Step 8: Mint to blockchain
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

      // Step 9: Return success result
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
   * Helper method to create IPFS metadata with proper typing
   */
  static createIPFSMetadata(metadata: EvermarkMetadata, imageUrl?: string): IPFSMetadata {
    const ipfsMetadata: IPFSMetadata = {
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

    // Add optional fields safely with proper typing
    if (metadata.contentType === 'DOI' && metadata.doi) {
      ipfsMetadata.evermark.doi = metadata.doi;
    }

    if (metadata.contentType === 'ISBN' && metadata.isbn) {
      ipfsMetadata.evermark.isbn = metadata.isbn;
    }

    if (metadata.journal) {
      ipfsMetadata.evermark.journal = metadata.journal;
    }

    if (metadata.publisher) {
      ipfsMetadata.evermark.publisher = metadata.publisher;
    }

    if (metadata.publicationDate) {
      ipfsMetadata.evermark.publicationDate = metadata.publicationDate;
    }

    if (metadata.contentType === 'URL' && metadata.url) {
      ipfsMetadata.evermark.url = metadata.url;
    }

    if (metadata.contentType === 'Cast' && metadata.castUrl) {
      ipfsMetadata.evermark.castUrl = metadata.castUrl;
    }

    return ipfsMetadata;
  }

  /**
   * Transform database row to standardized Evermark for components
   */
  static transformFromDatabase(row: EvermarkDatabaseRow): Evermark {
    return {
      // IDs
      id: row.token_id.toString(),
      tokenId: row.token_id,
      
      // Content
      title: row.title,
      author: row.author,
      creator: row.owner || row.author,
      description: row.description || '',
      sourceUrl: row.source_url,
      image: row.processed_image_url || this.extractImageFromMetadata(row.metadata),
      metadataURI: row.token_uri || '',
      
      // Type and verification
      contentType: this.mapContentType(row.content_type),
      verified: row.verified || false,
      
      // Timestamps
      creationTime: Math.floor(new Date(row.created_at).getTime() / 1000),
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
      lastSyncedAt: row.last_synced_at,
      
      // Image processing
      imageStatus: this.mapImageProcessingStatus(row.image_processing_status),
      
      // Extended metadata
      tags: this.extractTags(row),
      extendedMetadata: this.extractExtendedMetadata(row),
      
      // Optional fields
      votes: undefined,
      viewCount: undefined
    };
  }

  private static mapContentType(contentType?: string): Evermark['contentType'] {
    if (!contentType) return 'Custom';
    const type = contentType.toLowerCase();
    if (type.includes('cast') || type.includes('farcaster')) return 'Cast';
    if (type.includes('doi') || type.includes('academic')) return 'DOI';
    if (type.includes('isbn') || type.includes('book')) return 'ISBN';
    if (type.includes('url') || type.includes('web')) return 'URL';
    return 'Custom';
  }

  private static mapImageProcessingStatus(status?: string): Evermark['imageStatus'] {
    switch (status) {
      case 'completed': return 'processed';
      case 'processing': return 'processing';
      case 'failed': return 'failed';
      case 'pending': return 'processing';
      default: return 'none';
    }
  }

  private static extractImageFromMetadata(metadata?: Record<string, any>): string | undefined {
    if (!metadata) return undefined;
    return metadata.image || 
           metadata.originalMetadata?.image || 
           metadata.evermark?.image;
  }

  private static extractTags(row: EvermarkDatabaseRow): string[] {
    const tags: string[] = [];
    
    // Extract from metadata
    const metadata = row.metadata || row.metadata_json || row.ipfs_metadata;
    if (metadata?.tags && Array.isArray(metadata.tags)) {
      tags.push(...metadata.tags);
    }
    
    // Extract from description
    if (row.description) {
      const tagMatches = row.description.match(/Tags:\s*([^|]+)/i);
      if (tagMatches) {
        const extractedTags = tagMatches[1].split(',').map(tag => tag.trim());
        tags.push(...extractedTags);
      }
    }
    
    return [...new Set(tags.filter(tag => tag && tag.length > 0))];
  }

  private static extractExtendedMetadata(row: EvermarkDatabaseRow): Evermark['extendedMetadata'] {
    const metadata = row.metadata || row.metadata_json || row.ipfs_metadata || {};
    
    return {
      doi: metadata.doi || metadata.evermark?.doi,
      isbn: metadata.isbn || metadata.evermark?.isbn,
      castData: metadata.castData || metadata.evermark?.castData,
      tags: this.extractTags(row),
      customFields: metadata.customFields || metadata.evermark?.customFields || [],
      processedImageUrl: row.processed_image_url
    };
  }
}