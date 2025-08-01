// =============================================================================
// File: src/features/evermarks/services/APIService.ts
// FULLY SDK-INTEGRATED VERSION - Eliminates custom image handling
// =============================================================================

import { supabase } from '@/lib/supabase';
import type { 
  Evermark, 
  EvermarkFeedOptions, 
  EvermarkFeedResult,
  EvermarkDatabaseRow 
} from '../types';

// SDK IMPORTS - Replace all custom utilities
import { 
  resolveImageSources,
  isValidIpfsHash,
  createIpfsUrl,
  isValidUrl,
  generateStoragePath,
  validateStorageConfig,
  type ImageSourceInput,
  type StorageConfig,
  ImageLoadingError,
  StorageError
} from '@ipfsnut/evermark-sdk-core';

import { 
  StorageOrchestrator,
  type TransferResult 
} from '@ipfsnut/evermark-sdk-storage';

import { 
  PerformanceMonitor,
  type LoadMetrics 
} from '@ipfsnut/evermark-sdk-browser';

// Import configuration
import { getEvermarkStorageConfig } from '../config/sdk-config';

// Import validation types
import type { ValidationResult, ValidationFieldError } from '@/utils/errors';

// SDK-POWERED PERFORMANCE MONITORING
const performanceMonitor = new PerformanceMonitor();

// SUPABASE ROW INTERFACE WITH INDEX SIGNATURE
interface SupabaseEvermarkRow {
  token_id: number;
  title: string | null;
  author: string | null;
  owner?: string | null;
  description?: string | null;
  content_type?: string | null;
  source_url?: string | null;
  token_uri?: string | null;
  created_at: string;
  sync_timestamp?: string | null;
  updated_at?: string | null;
  last_synced_at?: string | null;
  image_processed_at?: string | null;
  metadata_fetched?: boolean | null;
  verified?: boolean | null;
  user_id?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
  processed_image_url?: string | null;
  supabase_image_url?: string | null;
  thumbnail_url?: string | null;
  ipfs_image_hash?: string | null;
  image_file_size?: number | null;
  image_dimensions?: string | null;
  image_processing_status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  metadata?: Record<string, any> | null;
  metadata_json?: Record<string, any> | null;
  ipfs_metadata?: Record<string, any> | null;
  [key: string]: unknown;
}

// TYPE GUARD WITH SDK VALIDATION
function isValidSupabaseRow(data: { [x: string]: unknown }): data is SupabaseEvermarkRow {
  return data !== null &&
         typeof data === 'object' && 
         typeof data.token_id === 'number' &&
         typeof data.created_at === 'string' &&
         (typeof data.title === 'string' || data.title === null) &&
         (typeof data.author === 'string' || data.author === null);
}

export class APIService {
  private static storageOrchestrator: StorageOrchestrator | null = null;

  /**
   * Initialize SDK storage orchestrator
   */
  private static getStorageOrchestrator(): StorageOrchestrator {
    if (!this.storageOrchestrator) {
      const storageConfig = getEvermarkStorageConfig();
      const validation = validateStorageConfig(storageConfig);
      
      if (!validation.valid) {
        throw new StorageError(
          `Invalid storage configuration: ${validation.errors.join(', ')}`,
          'CONFIG_ERROR'
        );
      }
      
      this.storageOrchestrator = new StorageOrchestrator(storageConfig);
    }
    return this.storageOrchestrator;
  }

  /**
   * SDK-ENHANCED: Fetch evermarks with optimal image URLs
   */
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Fetching evermarks with SDK image optimization:', options);
      
      let query = supabase
        .from('evermarks')
        .select('*', { count: 'exact' });

      // Apply filters with validation
      if (options.filters) {
        query = this.applyFilters(query, options.filters);
      }

      // Apply sorting with validation
      query = this.applySorting(query, options.sortBy, options.sortOrder);

      // Apply pagination with bounds checking
      const { validatedPage, validatedPageSize } = this.validatePagination(options.page, options.pageSize);
      const offset = (validatedPage - 1) * validatedPageSize;
      query = query.range(offset, offset + validatedPageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw new StorageError(`Database query failed: ${error.message}`, 'SUPABASE_ERROR');
      }

      console.log('✅ Successfully fetched', data?.length || 0, 'evermarks');

      // VALIDATE AND TRANSFORM WITH SDK
      const validatedData = Array.isArray(data) ? data : [];
      const evermarks = await Promise.all(
        validatedData
          .filter(isValidSupabaseRow)
          .map(async (item) => await this.transformSupabaseToEvermarkWithSDK(item))
      );
      
      const totalPages = Math.ceil((count || 0) / validatedPageSize);
      
      // RECORD PERFORMANCE METRICS
      performanceMonitor.recordLoad({
        url: 'database_query',
        source: 'supabase',
        startTime,
        endTime: Date.now(),
        loadTime: Date.now() - startTime,
        fromCache: false,
        success: true,
        retryCount: 0
      });
      
      return {
        evermarks,
        totalCount: count || 0,
        page: validatedPage,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1
      };
    } catch (error) {
      console.error('Error fetching evermarks:', error);
      
      // RECORD FAILED OPERATION
      performanceMonitor.recordLoad({
        url: 'database_query',
        source: 'supabase',
        startTime,
        endTime: Date.now(),
        loadTime: Date.now() - startTime,
        fromCache: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      });
      
      // Return partial result on error rather than complete failure
      return {
        evermarks: [],
        totalCount: 0,
        page: options.page,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      };
    }
  }

  /**
   * SDK-ENHANCED: Fetch single evermark with optimal image URLs
   */
  static async fetchEvermark(id: string): Promise<Evermark | null> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Fetching evermark with SDK image optimization:', id);
      
      // Validate ID format
      const tokenId = this.validateTokenId(id);
      if (!tokenId) {
        console.warn('Invalid token ID format:', id);
        return null;
      }
      
      const { data, error } = await supabase
        .from('evermarks')
        .select('*')
        .eq('token_id', tokenId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Evermark not found:', id);
          return null;
        }
        console.error('Database error:', error);
        throw new StorageError(`Database query failed: ${error.message}`, 'SUPABASE_ERROR');
      }

      if (!data) {
        console.log('No data returned for evermark:', id);
        return null;
      }

      if (!isValidSupabaseRow(data)) {
        console.error('Invalid data structure returned from database');
        return null;
      }

      // TRANSFORM WITH SDK
      const evermark = await this.transformSupabaseToEvermarkWithSDK(data);
      
      // RECORD PERFORMANCE
      performanceMonitor.recordLoad({
        url: `evermark_${id}`,
        source: 'supabase',
        startTime,
        endTime: Date.now(),
        loadTime: Date.now() - startTime,
        fromCache: false,
        success: true,
        retryCount: 0
      });

      return evermark;
    } catch (error) {
      console.error('Error fetching evermark:', error);
      
      // RECORD FAILED OPERATION
      performanceMonitor.recordLoad({
        url: `evermark_${id}`,
        source: 'supabase',
        startTime,
        endTime: Date.now(),
        loadTime: Date.now() - startTime,
        fromCache: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: 0
      });
      
      throw error;
    }
  }

  /**
   * SDK-POWERED: Transform Supabase data with optimal image resolution
   */
  private static async transformSupabaseToEvermarkWithSDK(supabaseData: SupabaseEvermarkRow): Promise<Evermark> {
    try {
      // SAFE PROPERTY ACCESS WITH DEFAULTS
      const safeTokenId = supabaseData.token_id || 0;
      const safeTitle = supabaseData.title || 'Untitled';
      const safeAuthor = supabaseData.author || 'Unknown Author';
      const safeCreatedAt = supabaseData.created_at || new Date().toISOString();

      // SDK-POWERED: Extract and validate IPFS hash
      let ipfsHash: string | undefined;
      
      // Priority 1: Direct ipfs_image_hash field
      if (supabaseData.ipfs_image_hash && isValidIpfsHash(supabaseData.ipfs_image_hash)) {
        ipfsHash = supabaseData.ipfs_image_hash;
      }
      // Priority 2: Extract from stored metadata
      else if (supabaseData.metadata?.image && typeof supabaseData.metadata.image === 'string') {
        const hashFromMetadata = supabaseData.metadata.image.replace('ipfs://', '');
        if (isValidIpfsHash(hashFromMetadata)) {
          ipfsHash = hashFromMetadata;
        }
      }
      // Priority 3: Extract from processed_image_url (old gateway URLs)
      else if (supabaseData.processed_image_url) {
        const extractedHash = this.extractHashFromUrl(supabaseData.processed_image_url);
        if (extractedHash && isValidIpfsHash(extractedHash)) {
          ipfsHash = extractedHash;
        }
      }

      // SDK-POWERED: Resolve optimal image URL using SDK
      const imageSourceInput: ImageSourceInput = {
        supabaseUrl: supabaseData.supabase_image_url || undefined,
        thumbnailUrl: supabaseData.thumbnail_url || undefined,
        processedUrl: supabaseData.processed_image_url || undefined,
        ipfsHash: ipfsHash || undefined
      };

      // Get optimal image URL using SDK
      const resolvedSources = resolveImageSources(imageSourceInput, {
        maxSources: 1, // We just want the best one
        includeIpfs: !!ipfsHash,
        mobileOptimization: false
      });

      const imageUrl = resolvedSources.length > 0 ? resolvedSources[0]!.url : undefined;

      return {
        id: safeTokenId.toString(),
        tokenId: safeTokenId,
        title: safeTitle,
        author: safeAuthor,
        creator: supabaseData.owner || safeAuthor,
        description: supabaseData.description || '',
        sourceUrl: supabaseData.source_url || undefined,
        image: imageUrl,
        metadataURI: supabaseData.token_uri || '',
        
        contentType: this.mapContentType(supabaseData.content_type || undefined),
        tags: this.extractTags(supabaseData),
        verified: Boolean(supabaseData.verified),
        
        creationTime: Math.floor(new Date(safeCreatedAt).getTime() / 1000),
        createdAt: safeCreatedAt,
        updatedAt: supabaseData.updated_at || safeCreatedAt,
        lastSyncedAt: supabaseData.last_synced_at || undefined,
        
        // Enhanced image fields with SDK-resolved URLs
        imageStatus: this.mapImageStatus(supabaseData.image_processing_status),
        supabaseImageUrl: supabaseData.supabase_image_url || undefined,
        thumbnailUrl: supabaseData.thumbnail_url || undefined,
        processed_image_url: supabaseData.processed_image_url || undefined,
        ipfsHash: ipfsHash || undefined,
        imageFileSize: supabaseData.image_file_size || undefined,
        imageDimensions: supabaseData.image_dimensions || undefined,
        
        extendedMetadata: {
          doi: supabaseData.metadata?.doi,
          isbn: supabaseData.metadata?.isbn,
          castData: supabaseData.metadata?.castData,
          tags: this.extractTags(supabaseData),
          customFields: this.extractCustomFields(supabaseData),
          processedImageUrl: imageUrl
        },
        
        votes: 0,
        viewCount: 0
      };
    } catch (error) {
      console.error('Error transforming Supabase data with SDK:', error);
      
      // FALLBACK: Return minimal valid object with safe defaults
      const fallbackTokenId = supabaseData.token_id || 0;
      return {
        id: fallbackTokenId.toString(),
        tokenId: fallbackTokenId,
        title: supabaseData.title || 'Error Loading Title',
        author: supabaseData.author || 'Unknown Author',
        creator: supabaseData.owner || 'Unknown Creator',
        description: 'Error loading description',
        image: undefined,
        metadataURI: '',
        contentType: 'Custom',
        tags: [],
        verified: false,
        creationTime: Math.floor(Date.now() / 1000),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        imageStatus: 'failed',
        processed_image_url: supabaseData.processed_image_url || undefined,
        extendedMetadata: {},
        votes: 0,
        viewCount: 0
      };
    }
  }

  /**
   * SDK-POWERED: Extract IPFS hash from URL
   */
  private static extractHashFromUrl(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    
    // Handle ipfs:// protocol
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '');
      return isValidIpfsHash(hash) ? hash : null;
    }
    
    // Handle gateway URLs
    const gatewayMatch = url.match(/\/ipfs\/([^\/\?#]+)/);
    if (gatewayMatch && gatewayMatch[1]) {
      const hash = gatewayMatch[1];
      return isValidIpfsHash(hash) ? hash : null;
    }
    
    // Direct hash validation
    if (isValidIpfsHash(url)) {
      return url;
    }
    
    return null;
  }

  /**
   * SDK-ENHANCED: Create evermark record with optimal storage paths
   */
  static async createEvermarkRecord(evermarkData: {
    tokenId: string;
    title: string;
    author: string;
    description: string;
    sourceUrl?: string;
    metadataURI: string;
    txHash: string;
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    ipfsHash?: string;
    contentType: string;
    tags: string[];
    fileSize?: number;
    dimensions?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // SDK VALIDATION
      const validation = this.validateEvermarkData(evermarkData);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // SDK-GENERATED STORAGE PATH (if we have IPFS hash)
      let optimizedStoragePath: string | undefined;
      if (evermarkData.ipfsHash && isValidIpfsHash(evermarkData.ipfsHash)) {
        try {
          optimizedStoragePath = generateStoragePath(evermarkData.ipfsHash, {
            prefix: 'evermarks',
            includeHash: true,
            extension: 'jpg'
          });
        } catch (error) {
          console.warn('Failed to generate storage path:', error);
        }
      }

      const insertData = {
        token_id: parseInt(evermarkData.tokenId),
        title: evermarkData.title.trim(),
        author: evermarkData.author.trim(),
        description: evermarkData.description.trim(),
        source_url: evermarkData.sourceUrl?.trim(),
        token_uri: evermarkData.metadataURI,
        tx_hash: evermarkData.txHash,
        
        // SDK-ENHANCED: Optimized image fields
        supabase_image_url: evermarkData.supabaseImageUrl,
        thumbnail_url: evermarkData.thumbnailUrl,
        processed_image_url: evermarkData.supabaseImageUrl, // Primary is Supabase now
        ipfs_image_hash: evermarkData.ipfsHash,
        image_file_size: evermarkData.fileSize,
        image_dimensions: evermarkData.dimensions,
        
        content_type: evermarkData.contentType,
        metadata: {
          tags: evermarkData.tags || [],
          contentType: evermarkData.contentType,
          ipfsHash: evermarkData.ipfsHash,
          sdkVersion: '1.1.0',
          storagePath: optimizedStoragePath,
          createdWith: 'evermark-beta-sdk'
        },
        verified: false,
        metadata_fetched: true,
        image_processing_status: evermarkData.supabaseImageUrl ? 'completed' : 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('evermarks')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        
        // Handle specific database errors
        if (error.code === '23505') {
          return { success: false, error: 'This evermark already exists' };
        } else if (error.code === '23502') {
          return { success: false, error: 'Missing required field' };
        } else if (error.code === '22001') {
          return { success: false, error: 'Content exceeds maximum length' };
        }
        
        throw new StorageError(`Database insert failed: ${error.message}`, 'SUPABASE_ERROR');
      }

      if (!data || !isValidSupabaseRow(data)) {
        return { success: false, error: 'Failed to process created record' };
      }

      console.log('✅ Successfully created evermark record with SDK optimization');
      
      return {
        success: true,
        id: data.token_id.toString()
      };
    } catch (error) {
      console.error('Error creating evermark record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create record'
      };
    }
  }

  /**
   * SDK-ENHANCED: Transfer IPFS image to Supabase using StorageOrchestrator
   */
  static async transferImageToSupabase(
    ipfsHash: string,
    onProgress?: (progress: any) => void
  ): Promise<TransferResult> {
    try {
      if (!isValidIpfsHash(ipfsHash)) {
        throw new ImageLoadingError('Invalid IPFS hash provided', 'INVALID_URL');
      }

      const orchestrator = this.getStorageOrchestrator();
      
      console.log('🔄 Starting SDK-powered IPFS → Supabase transfer:', ipfsHash);
      
      const result = await orchestrator.transferIPFSToSupabase(ipfsHash, onProgress);
      
      if (result.success) {
        console.log('✅ SDK transfer completed successfully');
      } else {
        console.error('❌ SDK transfer failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Transfer operation failed:', error);
      return {
        success: false,
        ipfsHash,
        transferTime: 0,
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }

  /**
   * SDK-ENHANCED: Health check with storage validation
   */
  static async healthCheck(): Promise<{ isHealthy: boolean; error?: string; sdkStatus?: any }> {
    try {
      // Test database connection
      const { data, error } = await supabase
        .from('evermarks')
        .select('token_id')
        .limit(1);
      
      if (error) {
        return { isHealthy: false, error: error.message };
      }

      // Test SDK storage configuration
      try {
        const storageConfig = getEvermarkStorageConfig();
        const validation = validateStorageConfig(storageConfig);
        
        return { 
          isHealthy: true,
          sdkStatus: {
            storageConfigValid: validation.valid,
            storageErrors: validation.errors,
            performanceStats: performanceMonitor.getStats()
          }
        };
      } catch (sdkError) {
        return {
          isHealthy: true, // Database is healthy
          error: 'SDK configuration issue',
          sdkStatus: {
            storageConfigValid: false,
            error: sdkError instanceof Error ? sdkError.message : 'Unknown SDK error'
          }
        };
      }
      
    } catch (error) {
      return { 
        isHealthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // KEEP ALL THE EXISTING HELPER METHODS (unchanged)
  private static validateTokenId(id: string): number | null {
    if (!id || typeof id !== 'string') return null;
    const tokenId = parseInt(id.trim());
    return !isNaN(tokenId) && tokenId > 0 ? tokenId : null;
  }

  private static mapContentType(contentType?: string): Evermark['contentType'] {
    if (!contentType || typeof contentType !== 'string') return 'Custom';
    
    const type = contentType.toLowerCase().trim();
    if (type.includes('cast') || type.includes('farcaster')) return 'Cast';
    if (type.includes('doi') || type.includes('academic')) return 'DOI';
    if (type.includes('isbn') || type.includes('book')) return 'ISBN';
    if (type.includes('url') || type.includes('web')) return 'URL';
    return 'Custom';
  }

  private static mapImageStatus(status?: string | null): Evermark['imageStatus'] {
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

  private static extractTags(supabaseData: SupabaseEvermarkRow): string[] {
    try {
      const tags: string[] = [];
      
      if (supabaseData.metadata?.tags && Array.isArray(supabaseData.metadata.tags)) {
        tags.push(...supabaseData.metadata.tags.filter(tag => 
          typeof tag === 'string' && tag.trim().length > 0
        ));
      }
      
      if (supabaseData.description && typeof supabaseData.description === 'string') {
        const tagMatches = supabaseData.description.match(/Tags:\s*([^|]+)/i);
        if (tagMatches && tagMatches[1]) {
          const extractedTags = tagMatches[1].split(',')
            .map((tag: string) => tag.trim())
            .filter((tag: string) => tag.length > 0);
          tags.push(...extractedTags);
        }
      }
      
      return [...new Set(tags)].slice(0, 10);
    } catch (error) {
      console.warn('Error extracting tags:', error);
      return [];
    }
  }

  private static extractCustomFields(supabaseData: SupabaseEvermarkRow): Array<{ key: string; value: string }> {
    try {
      if (!supabaseData.metadata?.customFields || !Array.isArray(supabaseData.metadata.customFields)) {
        return [];
      }
      
      return supabaseData.metadata.customFields.filter(field => 
        field && 
        typeof field === 'object' &&
        typeof field.key === 'string' && 
        typeof field.value === 'string' &&
        field.key.trim().length > 0 &&
        field.value.trim().length > 0
      );
    } catch (error) {
      console.warn('Error extracting custom fields:', error);
      return [];
    }
  }

  private static applyFilters(query: any, filters: any) {
    try {
      if (filters.search && typeof filters.search === 'string') {
        const sanitizedSearch = filters.search.trim();
        if (sanitizedSearch.length > 0 && sanitizedSearch.length <= 100) {
          query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%,author.ilike.%${sanitizedSearch}%`);
        }
      }
      
      if (filters.author && typeof filters.author === 'string') {
        const sanitizedAuthor = filters.author.trim();
        if (sanitizedAuthor.length > 0 && sanitizedAuthor.length <= 50) {
          query = query.ilike('author', `%${sanitizedAuthor}%`);
        }
      }
      
      if (filters.contentType && typeof filters.contentType === 'string') {
        const validTypes = ['Cast', 'DOI', 'ISBN', 'URL', 'Custom'];
        if (validTypes.includes(filters.contentType)) {
          query = query.eq('content_type', filters.contentType);
        }
      }
      
      if (typeof filters.verified === 'boolean') {
        query = query.eq('verified', filters.verified);
      }
      
      return query;
    } catch (error) {
      console.warn('Error applying filters:', error);
      return query;
    }
  }

  private static applySorting(query: any, sortBy: string, sortOrder: string) {
    try {
      const validSortFields = ['created_at', 'title', 'author', 'votes'];
      const validSortOrders = ['asc', 'desc'];
      
      const field = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';
      
      return query.order(field, { ascending: order === 'asc' });
    } catch (error) {
      console.warn('Error applying sorting:', error);
      return query.order('created_at', { ascending: false });
    }
  }

  private static validatePagination(page: number, pageSize: number) {
    const validatedPage = Math.max(1, Math.min(page || 1, 1000));
    const validatedPageSize = Math.max(1, Math.min(pageSize || 12, 100));
    
    return { validatedPage, validatedPageSize };
  }

  private static validateEvermarkData(data: any): { isValid: boolean; error?: string } {
    if (!data.tokenId || isNaN(parseInt(data.tokenId))) {
      return { isValid: false, error: 'Invalid token ID' };
    }
    
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      return { isValid: false, error: 'Title is required' };
    }
    
    if (data.title.length > 100) {
      return { isValid: false, error: 'Title too long (max 100 characters)' };
    }
    
    if (!data.author || typeof data.author !== 'string' || data.author.trim().length === 0) {
      return { isValid: false, error: 'Author is required' };
    }
    
    if (!data.metadataURI || typeof data.metadataURI !== 'string') {
      return { isValid: false, error: 'Metadata URI is required' };
    }
    
    if (!data.txHash || typeof data.txHash !== 'string') {
      return { isValid: false, error: 'Transaction hash is required' };
    }
    
    // SDK VALIDATION for URLs and IPFS hashes
    if (data.sourceUrl && !isValidUrl(data.sourceUrl)) {
      return { isValid: false, error: 'Invalid source URL format' };
    }
    
    if (data.supabaseImageUrl && !isValidUrl(data.supabaseImageUrl)) {
      return { isValid: false, error: 'Invalid Supabase image URL format' };
    }
    
    if (data.ipfsHash && !isValidIpfsHash(data.ipfsHash)) {
      return { isValid: false, error: 'Invalid IPFS hash format' };
    }
    
    return { isValid: true };
  }
}