// =============================================================================
// File: src/features/evermarks/services/APIService.ts
// FIXED VERSION - Proper TypeScript types for Supabase data
// =============================================================================

import { supabase } from '@/lib/supabase';
import { SupabaseImageService } from './SupabaseImageService';
import type { 
  Evermark, 
  EvermarkFeedOptions, 
  EvermarkFeedResult,
  EvermarkDatabaseRow 
} from '../types';

// FIXED: Properly typed Supabase response
interface SupabaseEvermarkRow {
  token_id: number;
  title: string;
  author: string;
  owner?: string;
  description?: string;
  content_type?: string;
  source_url?: string;
  token_uri?: string;
  created_at: string;
  sync_timestamp?: string;
  updated_at?: string;
  last_synced_at?: string;
  image_processed_at?: string;
  metadata_fetched?: boolean;
  verified?: boolean;
  user_id?: string;
  tx_hash?: string;
  block_number?: number;
  processed_image_url?: string;
  supabase_image_url?: string;
  thumbnail_url?: string;
  ipfs_image_hash?: string;
  image_file_size?: number;
  image_dimensions?: string;
  image_processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  metadata_json?: Record<string, any>;
  ipfs_metadata?: Record<string, any>;
}

export class APIService {
  /**
   * Fetch evermarks with enhanced image URLs and comprehensive error handling
   */
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    try {
      console.log('🔍 Fetching evermarks with hybrid image support:', options);
      
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
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log('✅ Successfully fetched', data?.length || 0, 'evermarks');

      // FIXED: Transform data with proper typing
      const evermarks = (data as SupabaseEvermarkRow[] || []).map((item) => this.transformSupabaseToEvermark(item));
      
      const totalPages = Math.ceil((count || 0) / validatedPageSize);
      
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
   * Fetch single evermark with enhanced error handling
   */
  static async fetchEvermark(id: string): Promise<Evermark | null> {
    try {
      console.log('🔍 Fetching evermark with enhanced images:', id);
      
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
        throw new Error(`Database query failed: ${error.message}`);
      }

      if (!data) {
        console.log('No data returned for evermark:', id);
        return null;
      }

      // FIXED: Cast to proper type
      return this.transformSupabaseToEvermark(data as SupabaseEvermarkRow);
    } catch (error) {
      console.error('Error fetching evermark:', error);
      throw error;
    }
  }

  /**
   * Create evermark record with hybrid image support and comprehensive validation
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
      console.log('💾 Creating evermark with hybrid image support:', evermarkData.title);
      
      // Validate required fields
      const validation = this.validateEvermarkData(evermarkData);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const insertData = {
        token_id: parseInt(evermarkData.tokenId),
        title: evermarkData.title.trim(),
        author: evermarkData.author.trim(),
        description: evermarkData.description.trim(),
        source_url: evermarkData.sourceUrl?.trim(),
        token_uri: evermarkData.metadataURI,
        tx_hash: evermarkData.txHash,
        
        // Hybrid image fields
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
          createdWith: 'evermark-beta-v2'
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
        if (error.code === '23505') { // Unique constraint violation
          return { success: false, error: 'This evermark already exists' };
        } else if (error.code === '23502') { // Not null violation
          return { success: false, error: 'Missing required field' };
        } else if (error.code === '22001') { // String too long
          return { success: false, error: 'Content exceeds maximum length' };
        }
        
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log('✅ Successfully created evermark record');
      
      // FIXED: Properly access token_id from typed data
      const createdRow = data as SupabaseEvermarkRow;
      return {
        success: true,
        id: createdRow.token_id.toString()
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
   * FIXED: Enhanced transformation with proper typing
   */
  private static transformSupabaseToEvermark(supabaseData: SupabaseEvermarkRow): Evermark {
    try {
      // Get best available image URL using hybrid service
      const imageUrl = SupabaseImageService.getImageUrl({
        supabaseImageUrl: supabaseData.supabase_image_url,
        processed_image_url: supabaseData.processed_image_url,
        ipfsHash: supabaseData.ipfs_image_hash
      });

      return {
        id: supabaseData.token_id.toString(),
        tokenId: supabaseData.token_id,
        title: supabaseData.title || 'Untitled',
        author: supabaseData.author || 'Unknown Author',
        creator: supabaseData.owner || supabaseData.author || 'Unknown Creator',
        description: supabaseData.description || '',
        sourceUrl: supabaseData.source_url,
        image: imageUrl,
        metadataURI: supabaseData.token_uri || '',
        
        contentType: this.mapContentType(supabaseData.content_type),
        tags: this.extractTags(supabaseData),
        verified: Boolean(supabaseData.verified),
        
        creationTime: Math.floor(new Date(supabaseData.created_at).getTime() / 1000),
        createdAt: supabaseData.created_at,
        updatedAt: supabaseData.updated_at || supabaseData.created_at,
        lastSyncedAt: supabaseData.last_synced_at,
        
        // Enhanced image fields
        imageStatus: this.mapImageStatus(supabaseData.image_processing_status),
        supabaseImageUrl: supabaseData.supabase_image_url,
        thumbnailUrl: supabaseData.thumbnail_url,
        ipfsHash: supabaseData.ipfs_image_hash,
        imageFileSize: supabaseData.image_file_size,
        imageDimensions: supabaseData.image_dimensions,
        
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
      console.error('Error transforming Supabase data:', error);
      
      // Return minimal valid object on transformation error
      return {
        id: supabaseData.token_id?.toString() || 'unknown',
        tokenId: supabaseData.token_id || 0,
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
        extendedMetadata: {},
        votes: 0,
        viewCount: 0
      };
    }
  }

  // Keep all the existing private methods unchanged...
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
      
      if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
        const sanitizedTags = filters.tags
          .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
          .slice(0, 10);
        
        if (sanitizedTags.length > 0) {
          query = query.contains('metadata->tags', sanitizedTags);
        }
      }
      
      if (filters.dateRange && filters.dateRange.start && filters.dateRange.end) {
        const start = new Date(filters.dateRange.start);
        const end = new Date(filters.dateRange.end);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
          query = query
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
        }
      }
    } catch (error) {
      console.warn('Error applying filters:', error);
    }
    
    return query;
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

  private static validateTokenId(id: string): number | null {
    const tokenId = parseInt(id);
    return !isNaN(tokenId) && tokenId > 0 ? tokenId : null;
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
    
    return { isValid: true };
  }

  private static mapContentType(contentType?: string): Evermark['contentType'] {
    if (!contentType) return 'Custom';
    const type = contentType.toLowerCase();
    
    if (type.includes('custom content') || type.includes('custom')) return 'Custom';
    if (type.includes('cast') || type.includes('farcaster')) return 'Cast';
    if (type.includes('doi') || type.includes('academic')) return 'DOI';
    if (type.includes('isbn') || type.includes('book')) return 'ISBN';
    if (type.includes('url') || type.includes('web')) return 'URL';
    
    return 'Custom';
  }

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

  private static extractTags(supabaseData: SupabaseEvermarkRow): string[] {
    try {
      const tags: string[] = [];
      
      const metadata = supabaseData.metadata;
      if (metadata?.tags && Array.isArray(metadata.tags)) {
        tags.push(...metadata.tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0));
      }
      
      if (supabaseData.description && typeof supabaseData.description === 'string') {
        const tagMatches = supabaseData.description.match(/Tags:\s*([^|]+)/i);
        if (tagMatches) {
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
      const customFields: Array<{ key: string; value: string }> = [];
      
      const metadata = supabaseData.metadata;
      if (metadata?.customFields && Array.isArray(metadata.customFields)) {
        customFields.push(...metadata.customFields.filter(field => 
          field && 
          typeof field.key === 'string' && 
          typeof field.value === 'string' &&
          field.key.trim().length > 0 &&
          field.value.trim().length > 0
        ));
      }
      
      return customFields;
    } catch (error) {
      console.warn('Error extracting custom fields:', error);
      return [];
    }
  }

  static async healthCheck(): Promise<{ isHealthy: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('evermarks')
        .select('token_id')
        .limit(1);
      
      if (error) {
        return { isHealthy: false, error: error.message };
      }
      
      return { isHealthy: true };
    } catch (error) {
      return { 
        isHealthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}