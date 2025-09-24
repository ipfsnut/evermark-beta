// src/features/evermarks/types/index.ts
// Type definitions for the Evermarks feature - INTERFACES AND TYPES ONLY

// Import shared validation types from utils
import type { ValidationResult, ValidationFieldError, ValidationError } from '@/utils/errors';

// src/features/evermarks/types/index.ts
// FIXED: Added processed_image_url to Evermark interface

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
  contentType: 'DOI' | 'ISBN' | 'Cast' | 'Tweet' | 'URL' | 'README' | 'Custom';
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
  imageWidth?: number;         // NEW: Separate width field (from database)
  imageHeight?: number;        // NEW: Separate height field (from database)
  
  // Extended metadata
  extendedMetadata: {
    doi?: string;
    isbn?: string;
    castData?: FarcasterCastData;
    tweetData?: TwitterTweetData;
    readmeData?: ReadmeBookData;
    academic?: {
      authors?: Array<{
        given?: string;
        family?: string;
        name?: string;
        orcid?: string;
      }>;
      primaryAuthor?: string;
      journal?: string;
      publisher?: string;
      publishedDate?: string;
      volume?: string;
      issue?: string;
      pages?: string;
      abstract?: string;
    };
    webContent?: {
      author: string;
      authors: string[];
      publication?: string;
      publishedDate?: string;
      description?: string;
      siteName?: string;
      domain: string;
      confidence: 'high' | 'medium' | 'low';
    };
    tags?: string[];
    customFields?: Array<{ key: string; value: string }>;
    txHash?: string;
    blockNumber?: number;
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
    likers?: Array<{ fid: number; username: string }>;
    recasters?: Array<{ fid: number; username: string }>;
  };
  // Enhanced fields for better image generation
  author_pfp?: string;
  author_fid?: number;
  channel?: string;
  embeds?: Array<{
    url?: string;
    cast_id?: any;
    metadata?: EmbedMetadata;
    preserved_content?: PreservedMedia;
  }>;
  
  // Complete backup fields
  thread?: ThreadData;
  mentioned_profiles?: UserProfile[];
  frames?: FrameData[];
  parent_cast?: ParentCastData;
  verification?: CastVerification;
  edit_history?: CastEdit[];
  preserved_at?: string;
  backup_version?: string;
}

// Media preservation types
export interface PreservedMedia {
  original_url: string;
  ardrive_tx?: string;
  ipfs_hash?: string;
  content_type?: string;
  file_size?: number;
  dimensions?: { width: number; height: number };
  thumbnail?: {
    ardrive_tx?: string;
    ipfs_hash?: string;
  };
  preserved_at: string;
}

export interface EmbedMetadata {
  type: 'image' | 'video' | 'gif' | 'link' | 'cast' | 'frame';
  title?: string;
  description?: string;
  og_image?: string;
  domain?: string;
  favicon?: string;
}

// Thread and relationship types
export interface ThreadData {
  thread_hash: string;
  root_cast?: {
    hash: string;
    author_fid: number;
    author_username: string;
    text: string;
    timestamp: string;
  };
  reply_chain?: Array<{
    hash: string;
    author_fid: number;
    author_username: string;
    text: string;
    timestamp: string;
    depth: number;
  }>;
  total_replies: number;
  participants: Array<{
    fid: number;
    username: string;
    reply_count: number;
  }>;
}

export interface ParentCastData {
  hash: string;
  author_fid: number;
  author_username: string;
  text: string;
  timestamp: string;
  preserved?: boolean;
}

// User profile snapshot
export interface UserProfile {
  fid: number;
  username: string;
  display_name: string;
  pfp_url?: string;
  bio?: string;
  follower_count?: number;
  following_count?: number;
  verified_addresses?: string[];
  power_badge?: boolean;
  snapshot_at: string;
}

// Frame preservation
export interface FrameData {
  frame_url: string;
  title?: string;
  image?: string;
  preserved_image?: PreservedMedia;
  buttons?: Array<{
    index: number;
    title: string;
    action_type: 'post' | 'post_redirect' | 'link' | 'mint';
    target?: string;
  }>;
  input_text?: string;
  state?: string;
  post_url?: string;
  frames_version?: string;
  og_metadata?: Record<string, string>;
}

// Verification and integrity
export interface CastVerification {
  signature?: string;
  signer_address?: string;
  blockchain_timestamp?: string;
  content_hash?: string;
  merkle_root?: string;
  attestation?: {
    protocol: string;
    transaction_hash: string;
    timestamp: string;
  };
}

// Edit tracking
export interface CastEdit {
  version: number;
  timestamp: string;
  content: string;
  edited_fields: string[];
}

export interface ReadmeBookData {
  bookTitle: string;
  bookAuthor: string;
  isbn?: string;
  publicationDate?: string;
  chapterNumber?: number;
  totalChapters?: number;
  polygonContract: string;
  polygonTokenId: string;
  ipfsHash?: string;
  pageCount?: number;
  tokenGated?: boolean;
  bookDescription?: string;
  genre?: string;
  language?: string;
  publisher?: string;
  // Metadata from OpenSea/marketplace
  marketplaceUrl?: string;
  currentOwner?: string;
  mintDate?: string;
  royaltyPercentage?: number;
}

export interface TwitterTweetData {
  tweetId?: string;
  author?: string;
  username?: string;
  displayName?: string;
  content?: string;
  timestamp?: string;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
  // Tweet preservation data
  author_avatar?: string;
  verified?: boolean;
  media?: Array<{
    type: 'photo' | 'video' | 'gif';
    url: string;
    width?: number;
    height?: number;
  }>;
  quotedTweet?: {
    author: string;
    content: string;
    timestamp: string;
  };
  // Preserved for deleted tweets
  preservedAt: string;
  preservedImage?: string; // Screenshot/render of the tweet
}

export interface EvermarkMetadata {
  title: string;
  description: string;
  sourceUrl: string;
  author: string;
  imageFile?: File | null;
  customFields?: Array<{ key: string; value: string }>;
  tags?: string[];
  contentType?: 'Cast' | 'DOI' | 'ISBN' | 'Tweet' | 'URL' | 'README' | 'Custom';
  
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
  
  // README book fields
  readmeUrl?: string;
  bookTitle?: string;
  bookAuthor?: string;
  chapterNumber?: number;
  polygonTokenId?: string;
}

export interface CreateEvermarkInput {
  metadata: EvermarkMetadata;
  image?: File | string; // Support both File uploads and existing URLs
  referrer?: string;
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
    
    // README book-specific fields
    readmeUrl?: string;
    readmeData?: ReadmeBookData;
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
  
  // ENHANCED: Hybrid image storage (matching actual database schema)
  supabase_image_url?: string;           // Primary Supabase Storage URL
  thumbnail_url?: string;                // Thumbnail URL
  ipfs_image_hash?: string;             // IPFS backup hash
  file_size_bytes?: number;             // File size in bytes (actual column name)
  image_width?: number;                 // Image width (separate column)
  image_height?: number;                // Image height (separate column)
  image_processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  
  // JSON metadata storage
  metadata?: Record<string, any>;
  metadata_json?: Record<string, any>;
  ipfs_metadata?: Record<string, any>;
}