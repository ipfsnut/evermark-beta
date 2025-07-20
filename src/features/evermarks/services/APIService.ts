import type { 
  Evermark, 
  EvermarkFeedOptions, 
  EvermarkFeedResult,
  EvermarkDatabaseRow 
} from '../types';

// API configuration
const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || '/.netlify/functions',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
};

export class APIService {
  /**
   * Fetch evermarks with pagination and filtering
   */
  static async fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
    try {
      const params = this.buildSearchParams(options);
      const url = `${API_CONFIG.BASE_URL}/evermarks?${params}`;
      
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform API data to our Evermark type
      const evermarks = (data.data || []).map(this.transformAPIToEvermark);
      
      return {
        evermarks,
        totalCount: data.count || 0,
        page: options.page,
        totalPages: Math.ceil((data.count || 0) / options.pageSize),
        hasNextPage: options.page < Math.ceil((data.count || 0) / options.pageSize),
        hasPreviousPage: options.page > 1
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
      const url = `${API_CONFIG.BASE_URL}/evermarks?id=${encodeURIComponent(id)}`;
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
   * Create a new evermark record
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
      const response = await this.fetchWithRetry(
        `${API_CONFIG.BASE_URL}/evermarks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(evermarkData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        id: result.id
      };
    } catch (error) {
      console.error('Error creating evermark record:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create evermark record'
      };
    }
  }

  /**
   * Fetch with retry logic
   */
  private static async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    attempt = 1
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt < API_CONFIG.RETRY_ATTEMPTS) {
        console.warn(`API request attempt ${attempt} failed, retrying...`, error);
        await this.delay(API_CONFIG.RETRY_DELAY * attempt);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Delay utility for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build search parameters for API requests
   */
  private static buildSearchParams(options: EvermarkFeedOptions): URLSearchParams {
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
   * Transform API data to Evermark type
   */
  private static transformAPIToEvermark(apiData: EvermarkDatabaseRow): Evermark {
    return {
      id: apiData.token_id?.toString() || apiData.token_id?.toString() || '',
      tokenId: apiData.token_id || parseInt(apiData.token_id?.toString() || '0') || 0,
      title: apiData.title || 'Untitled',
      author: apiData.author || 'Unknown Author',
      creator: apiData.owner || apiData.author || 'Unknown Creator',
      description: apiData.description || '',
      sourceUrl: apiData.source_url,
      image: apiData.processed_image_url || this.extractImageFromMetadata(apiData.metadata),
      metadataURI: apiData.token_uri || '',
      
      contentType: this.mapContentType(apiData.content_type),
      tags: this.extractTags(apiData),
      verified: apiData.verified || false,
      
      creationTime: Math.floor(new Date(apiData.created_at).getTime() / 1000),
      createdAt: apiData.created_at,
      updatedAt: apiData.updated_at || apiData.created_at,
      lastSyncedAt: apiData.last_synced_at,
      
      imageStatus: this.mapImageStatus(apiData.image_processing_status),
      
      extendedMetadata: {
        doi: apiData.metadata?.doi || apiData.metadata?.evermark?.doi,
        isbn: apiData.metadata?.isbn || apiData.metadata?.evermark?.isbn,
        castData: apiData.metadata?.castData || apiData.metadata?.evermark?.castData,
        tags: this.extractTags(apiData),
        customFields: this.extractCustomFields(apiData),
        processedImageUrl: apiData.processed_image_url
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

  private static extractTags(apiData: EvermarkDatabaseRow): string[] {
    const tags: string[] = [];
    
    // Extract from metadata
    const metadata = apiData.metadata || apiData.metadata_json || apiData.ipfs_metadata;
    if (metadata?.tags && Array.isArray(metadata.tags)) {
      tags.push(...metadata.tags);
    }
    
    if (metadata?.evermark?.tags && Array.isArray(metadata.evermark.tags)) {
      tags.push(...metadata.evermark.tags);
    }
    
    // Extract from description
    if (apiData.description) {
      const tagMatches = apiData.description.match(/Tags:\s*([^|]+)/i);
      if (tagMatches) {
        const extractedTags = tagMatches[1].split(',').map(tag => tag.trim());
        tags.push(...extractedTags);
      }
    }
    
    return [...new Set(tags.filter(tag => tag && tag.length > 0))];
  }

  private static extractCustomFields(apiData: EvermarkDatabaseRow): Array<{ key: string; value: string }> {
    const customFields: Array<{ key: string; value: string }> = [];
    
    // From metadata.customFields
    const metadata = apiData.metadata || apiData.metadata_json || apiData.ipfs_metadata;
    if (metadata?.customFields && Array.isArray(metadata.customFields)) {
      customFields.push(...metadata.customFields);
    }
    
    if (metadata?.evermark?.customFields && Array.isArray(metadata.evermark.customFields)) {
      customFields.push(...metadata.evermark.customFields);
    }
    
    // From metadata.attributes (IPFS format)
    if (metadata?.attributes && Array.isArray(metadata.attributes)) {
      const standardTraits = new Set(['Content Type', 'Author', 'Created At', 'content_type', 'author', 'created_at']);
      
      metadata.attributes.forEach((attr: any) => {
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
}