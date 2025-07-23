import { supabase } from '@/lib/supabase';
import type { 
  Evermark, 
  EvermarkFeedOptions, 
  EvermarkFeedResult,
  EvermarkDatabaseRow 
} from '../types';

export class APIService {
  /**
   * Fetch evermarks with pagination and filtering directly from Supabase
   */
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    try {
      console.log('🔍 Fetching evermarks from Supabase with options:', options);
      
      // Start building the query
      let query = supabase
        .from('evermarks')
        .select('*', { count: 'exact' });

      // Apply filters
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
          // Using JSON contains for tags in metadata
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

      // Execute query
      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log('✅ Successfully fetched', data?.length || 0, 'evermarks from Supabase');

      // Transform data
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
      console.error('Error fetching evermarks from Supabase:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch evermarks'
      );
    }
  }

  /**
   * Fetch a single evermark by ID from Supabase
   */
  static async fetchEvermark(id: string): Promise<Evermark | null> {
    try {
      console.log('🔍 Fetching single evermark from Supabase:', id);
      
      const { data, error } = await supabase
        .from('evermarks')
        .select('*')
        .eq('token_id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('Supabase query error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }

      console.log('✅ Successfully fetched evermark from Supabase');
      return this.transformSupabaseToEvermark(data);
    } catch (error) {
      console.error('Error fetching evermark from Supabase:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to fetch evermark'
      );
    }
  }

  /**
   * Create a new evermark record in Supabase
   */
  static async createEvermarkRecord(evermarkData: {
    tokenId: string;
    title: string;
    author: string;
    description: string;
    sourceUrl?: string;
    metadataURI: string;
    txHash: string;
    imageUrl?: string;
    contentType: string;
    tags: string[];
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      console.log('💾 Creating evermark record in Supabase:', evermarkData.title);
      
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
          processed_image_url: evermarkData.imageUrl,
          content_type: evermarkData.contentType,
          metadata: {
            tags: evermarkData.tags || [],
            contentType: evermarkData.contentType
          },
          verified: false,
          metadata_fetched: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Database insert failed: ${error.message}`);
      }

      console.log('✅ Successfully created evermark record in Supabase');
      return {
        success: true,
        id: data.token_id.toString()
      };
    } catch (error) {
      console.error('Error creating evermark record in Supabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create evermark record'
      };
    }
  }

  /**
   * Transform Supabase data to Evermark type
   */
  private static transformSupabaseToEvermark(supabaseData: any): Evermark {
    return {
      id: supabaseData.token_id?.toString() || '',
      tokenId: supabaseData.token_id || 0,
      title: supabaseData.title || 'Untitled',
      author: supabaseData.author || 'Unknown Author',
      creator: supabaseData.owner || supabaseData.author || 'Unknown Creator',
      description: supabaseData.description || '',
      sourceUrl: supabaseData.source_url,
      image: supabaseData.processed_image_url || this.extractImageFromMetadata(supabaseData.metadata),
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
        processedImageUrl: supabaseData.processed_image_url
      },
      
      votes: 0, // Would come from voting service
      viewCount: 0 // Would come from analytics
    };
  }

  /**
   * Helper methods for data transformation
   */
  private static mapContentType(contentType?: string): Evermark['contentType'] {
    if (!contentType) return 'Custom';
    const type = contentType.toLowerCase();
    
    // Handle your specific database values
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

  private static extractImageFromMetadata(metadata?: Record<string, any>): string | undefined {
    if (!metadata) return undefined;
    return metadata.image || 
           metadata.originalMetadata?.image || 
           metadata.evermark?.image;
  }

  private static extractTags(supabaseData: any): string[] {
    const tags: string[] = [];
    
    // Extract from metadata
    const metadata = supabaseData.metadata;
    if (metadata?.tags && Array.isArray(metadata.tags)) {
      tags.push(...metadata.tags);
    }
    
    // Extract from description (your data shows "Tags: important" pattern)
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

  /**
   * Test the Supabase connection
   */
  static async testConnection(): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const { data, error, count } = await supabase
        .from('evermarks')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        throw error;
      }
      
      return {
        success: true,
        count: count || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}