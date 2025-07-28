// src/features/evermarks/types/index.ts
// Type definitions for the Evermarks feature - INTERFACES AND TYPES ONLY

// Import shared validation types from utils
import type { ValidationResult, ValidationFieldError, ValidationError } from '@/utils/errors';

export interface Evermark {
  id: string;
  tokenId: number;
  title: string;
  author: string;
  creator: string;
  description: string;
  sourceUrl?: string;
  image?: string; // Changed from string | null to string | undefined
  metadataURI: string;
  contentType: 'DOI' | 'ISBN' | 'Cast' | 'URL' | 'Custom';
  tags: string[];
  verified: boolean;
  
  // Timestamps
  creationTime: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  
  // ENHANCED: Image processing with hybrid storage
  imageStatus: 'processed' | 'processing' | 'failed' | 'none';
  supabaseImageUrl?: string;    // NEW: Primary image source
  thumbnailUrl?: string;        // NEW: Thumbnail for performance
  ipfsHash?: string;           // NEW: IPFS backup hash
  imageFileSize?: number;      // NEW: File size tracking
  imageDimensions?: string;    // NEW: Dimensions as "width,height"
  
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

// Re-export shared validation types (THIS IS THE FIX!)
export type { ValidationResult, ValidationFieldError, ValidationError };

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

/**
 * IPFS Metadata structure for NFT standards compliance
 */
export interface IPFSMetadata {
  // Standard ERC-721 metadata fields
  name: string;
  description: string;
  image?: string;
  external_url?: string;
  
  // ERC-721 attributes array
  attributes: Array<{
    trait_type: string;
    value: string | number | boolean;
    display_type?: string;
  }>;
  
  // Extended Evermark-specific metadata
  evermark: {
    version: string;
    contentType?: EvermarkMetadata['contentType'];
    sourceUrl?: string;
    tags: string[];
    customFields: Array<{ key: string; value: string }>;
    
    // Content-type specific fields (all optional)
    doi?: string;
    isbn?: string;
    journal?: string;
    publisher?: string;
    publicationDate?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    
    // Farcaster-specific fields
    castUrl?: string;
    castData?: FarcasterCastData;
    
    // URL-specific fields  
    url?: string;
  };
}

/**
 * Database row structure that matches your Supabase table
 */
export interface EvermarkDatabaseRow {
  // Primary key and required fields
  token_id: number;
  title: string;
  author: string;
  
  // Optional core fields
  owner?: string;
  description?: string;
  content_type?: string;
  source_url?: string;
  token_uri?: string;
  
  // Timestamps
  created_at: string;
  sync_timestamp?: string;
  updated_at?: string;
  last_synced_at?: string;
  image_processed_at?: string;
  
  // Status fields
  metadata_fetched?: boolean;
  verified?: boolean;
  
  // Optional fields
  user_id?: string;
  tx_hash?: string;
  block_number?: number;
  
  // ENHANCED: Hybrid image storage
  processed_image_url?: string;           // Legacy field
  supabase_image_url?: string;           // NEW: Primary Supabase Storage URL
  thumbnail_url?: string;                // NEW: Thumbnail URL
  ipfs_image_hash?: string;             // NEW: IPFS backup hash
  image_file_size?: number;             // NEW: File size in bytes
  image_dimensions?: string;            // NEW: "width,height" format
  image_processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // JSON metadata storage
  metadata?: Record<string, any>;
  metadata_json?: Record<string, any>;
  ipfs_metadata?: Record<string, any>;
}