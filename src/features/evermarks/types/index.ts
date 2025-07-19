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