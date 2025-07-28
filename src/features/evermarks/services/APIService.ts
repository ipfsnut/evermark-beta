// =============================================================================
// File: src/features/evermarks/services/APIService.ts
// ENHANCED VERSION - Updated to use hybrid storage
// =============================================================================

import { supabase } from '@/lib/supabase';
import { SupabaseImageService } from './SupabaseImageService';
import type { 
  Evermark, 
  EvermarkFeedOptions, 
  EvermarkFeedResult,
  EvermarkDatabaseRow 
} from '../types';

export class APIService {
  /**
   * Fetch evermarks with enhanced image URLs
   */
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    try {
      console.log('🔍 Fetching evermarks with hybrid image support:', options);
      
      let query = supabase
        .from('evermarks')
        .select('*', { count: 'exact' });

      // Apply filters (keeping existing logic)
      if (options.filters) {
        const { filters } = options;
        
        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,author.ilike.%${filters.search}%`);
        }
        
        if (filters.author) {
          query = query.ilike('author', `%${filters.author}%`);
        }
        
        if (filters.contentType) {
          query = query.eq('content_type', filters.contentType);
        }
        
        if (filters.verified !== undefined) {
          query = query.eq('verified', filters.verified);
        }
        
        if (filters.tags && filters.tags.length > 0) {
          query = query.contains('metadata->tags', filters.tags);
        }
        
        if (filters.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.start.toISOString())
            .lte('created_at', filters.dateRange.end.toISOString());
        }
      }

      // Apply sorting
      const sortField = options.sortBy === 'created_at' ? 'created_at' : options.sortBy;
      query = query.order(sortField, { ascending: options.sortOrder === 'asc' });

      // Apply pagination
      const offset = (options.page - 1) * options.pageSize;
      query = query.range(offset, offset + options.pageSize - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log('✅ Successfully fetched', data?.length || 0, 'evermarks');

      // Transform data with enhanced image handling
      const evermarks = (data || []).map((item) => this.transformSupabaseToEvermark(item));
      
      const totalPages = Math.ceil((count || 0) / options.pageSize);
      
      return {
        evermarks,
        totalCount: count || 0,
        page: options.page,
        totalPages,
        hasNextPage: options.page < totalPages,
        hasPreviousPage: options.page > 1
      };
    } catch (error) {
      console.error('Error fetching evermarks:', error);
      throw error;
    }
  }

  /**
   * Fetch single evermark with enhanced image handling
   */
  static async fetchEvermark(id: string): Promise<Evermark | null> {
    try {
      console.log('🔍 Fetching evermark with enhanced images:', id);
      
      const { data, error } = await supabase
        .from('evermarks')
        .select('*')
        .eq('token_id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Database query failed: ${error.message}`);
      }

      return this.transformSupabaseToEvermark(data);
    } catch (error) {
      console.error('Error fetching evermark:', error);
      throw error;
    }
  }

  /**
   * Enhanced transformation with hybrid image support
   */
  private static transformSupabaseToEvermark(supabaseData: any): Evermark {
    // Get best available image URL using hybrid service
    const imageUrl = SupabaseImageService.getImageUrl({
      supabaseImageUrl: supabaseData.supabase_image_url,
      processed_image_url: supabaseData.processed_image_url,
      ipfsHash: supabaseData.metadata?.ipfsHash
    });

    return {
      id: supabaseData.token_id?.toString() || '',
      tokenId: supabaseData.token_id || 0,
      title: supabaseData.title || 'Untitled',
      author: supabaseData.author || 'Unknown Author',
      creator: supabaseData.owner || supabaseData.author || 'Unknown Creator',
      description: supabaseData.description || '',
      sourceUrl: supabaseData.source_url,
      image: imageUrl,
      metadataURI: supabaseData.token_uri || '',
      
      contentType: this.mapContentType(supabaseData.content_type),
      tags: this.extractTags(supabaseData),
      verified: supabaseData.verified || false,
      
      creationTime: Math.floor(new Date(supabaseData.created_at).getTime() / 1000),
      createdAt: supabaseData.created_at,
      updatedAt: supabaseData.updated_at || supabaseData.created_at,
      lastSyncedAt: supabaseData.last_synced_at,
      
      imageStatus: this.mapImageStatus(supabaseData.image_processing_status),
      
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
  }

  /**
   * Create evermark record with hybrid image support
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
      
      const { data, error } = await supabase
        .from('evermarks')
        .insert([{
          token_id: parseInt(evermarkData.tokenId),
          title: evermarkData.title,
          author: evermarkData.author,
          description: evermarkData.description,
          source_url: evermarkData.sourceUrl,
          token_uri: evermarkData.metadataURI,
          tx_hash: evermarkData.txHash,
          
          // Hybrid image fields
          supabase_image_url: evermarkData.supabaseImageUrl,
          thumbnail_url: evermarkData.thumbnailUrl,
          processed_image_url: evermarkData.supabaseImageUrl, // Primary is Supabase now
          image_file_size: evermarkData.fileSize,
          image_dimensions: evermarkData.dimensions,
          
          content_type: evermarkData.contentType,
          metadata: {
            tags: evermarkData.tags || [],
            contentType: evermarkData.contentType,
            ipfsHash: evermarkData.ipfsHash
          },
          verified: false,
          metadata_fetched: true,
          image_processing_status: evermarkData.supabaseImageUrl ? 'completed' : 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log('✅ Successfully created evermark record');
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

  // Keep existing helper methods unchanged
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

  private static extractTags(supabaseData: any): string[] {
    const tags: string[] = [];
    
    const metadata = supabaseData.metadata;
    if (metadata?.tags && Array.isArray(metadata.tags)) {
      tags.push(...metadata.tags);
    }
    
    if (supabaseData.description) {
      const tagMatches = supabaseData.description.match(/Tags:\s*([^|]+)/i);
      if (tagMatches) {
        const extractedTags = tagMatches[1].split(',').map((tag: string) => tag.trim());
        tags.push(...extractedTags);
      }
    }
    
    return [...new Set(tags.filter(tag => tag && tag.length > 0))];
  }

  private static extractCustomFields(supabaseData: any): Array<{ key: string; value: string }> {
    const customFields: Array<{ key: string; value: string }> = [];
    
    const metadata = supabaseData.metadata;
    if (metadata?.customFields && Array.isArray(metadata.customFields)) {
      customFields.push(...metadata.customFields);
    }
    
    return customFields;
  }
}

