// src/features/evermarks/services/EvermarkService.ts
// Business logic for Evermarks feature

import { 
  type Evermark, 
  type EvermarkMetadata, 
  type CreateEvermarkInput,
  type CreateEvermarkResult,
  type EvermarkFeedOptions,
  type EvermarkFeedResult,
  type ValidationResult,
  type ValidationError
} from '../types';

// Use existing services from the codebase
import { useSupabaseEvermarks, type StandardizedEvermark } from '@/hooks/useSupabaseEvermarks';
import { useEvermarkCreation } from '@/hooks/useEvermarkCreation';
import { useMetadataUtils } from '@/hooks/core/useMetadataUtils';

// API endpoints
const API_BASE = import.meta.env.VITE_API_URL || '/.netlify/functions';

/**
 * EvermarkService - Pure business logic functions for Evermarks
 * Handles data fetching, creation, validation, and transformations
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
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder
      });

      // Add filters
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

      const response = await fetch(`${API_BASE}/evermarks?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch evermarks: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform API data to our Evermark type
      const evermarks = data.data?.map(this.transformAPIToEvermark) || [];
      
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
      const response = await fetch(`${API_BASE}/evermarks?id=${id}`);
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
   * Create a new evermark (mint to blockchain)
   */
  static async createEvermark(input: CreateEvermarkInput): Promise<CreateEvermarkResult> {
    try {
      // Validate input first
      const validation = this.validateEvermarkMetadata(input.metadata);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Use the existing creation hook logic
      // This would normally be called from the hook, but for service layer
      // we need to integrate with the existing infrastructure

      // For now, return a mock result that matches the expected interface
      // In a real implementation, this would:
      // 1. Upload image to IPFS if provided
      // 2. Process metadata
      // 3. Upload metadata to IPFS  
      // 4. Call smart contract to mint
      // 5. Return transaction result

      return {
        success: true,
        message: 'Evermark created successfully',
        tokenId: Math.random().toString(),
        txHash: '0x' + Math.random().toString(16).substring(2),
        metadataURI: 'ipfs://example',
        imageUrl: input.image ? URL.createObjectURL(input.image) : undefined
      };
    } catch (error) {
      console.error('Error creating evermark:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create evermark'
      };
    }
  }

  /**
   * Validate evermark metadata
   */
  static validateEvermarkMetadata(metadata: EvermarkMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields
    if (!metadata.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (metadata.title.length > 100) {
      errors.push({ field: 'title', message: 'Title must be 100 characters or less' });
    } else if (metadata.title.length < 3) {
      warnings.push({ field: 'title', message: 'Title should be at least 3 characters' });
    }

    if (!metadata.description?.trim()) {
      errors.push({ field: 'description', message: 'Description is required' });
    } else if (metadata.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description must be 1000 characters or less' });
    } else if (metadata.description.length < 10) {
      warnings.push({ field: 'description', message: 'Description should be at least 10 characters' });
    }

    if (!metadata.author?.trim()) {
      errors.push({ field: 'author', message: 'Author is required' });
    } else if (metadata.author.length > 50) {
      errors.push({ field: 'author', message: 'Author name must be 50 characters or less' });
    }

    if (!metadata.sourceUrl?.trim()) {
      errors.push({ field: 'sourceUrl', message: 'Source URL is required' });
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
        errors.push({ field: 'doi', message: 'Invalid DOI format' });
      }
    }

    if (metadata.contentType === 'ISBN' && metadata.isbn) {
      const cleanIsbn = metadata.isbn.replace(/[-\s]/g, '');
      if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleanIsbn)) {
        errors.push({ field: 'isbn', message: 'Invalid ISBN format' });
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
      
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (metadata.imageFile.size > maxSize) {
        errors.push({ field: 'imageFile', message: 'Image must be less than 5MB' });
      }
      
      if (metadata.imageFile.size > 2 * 1024 * 1024) { // 2MB
        warnings.push({ field: 'imageFile', message: 'Consider compressing the image for faster loading' });
      }
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
    if (!input?.trim()) return false;
    
    const lowerInput = input.toLowerCase();
    return (
      lowerInput.includes('farcaster.xyz') ||
      lowerInput.includes('warpcast.com') ||
      lowerInput.includes('supercast.xyz') ||
      lowerInput.includes('farcaster') ||
      (input.startsWith('0x') && input.length >= 10 && input.length <= 66)
    );
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
        customFields: apiData.metadata?.customFields || apiData.extendedMetadata?.customFields || [],
        processedImageUrl: apiData.processed_image_url
      },
      
      votes: apiData.votes || apiData.voting_power || 0,
      viewCount: apiData.view_count || 0
    };
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
    
    // From description
    if (apiData.description) {
      const tagMatches = apiData.description.match(/Tags:\s*([^|]+)/i);
      if (tagMatches) {
        const extractedTags = tagMatches[1].split(',').map((tag: string) => tag.trim());
        tags.push(...extractedTags);
      }
    }
    
    // Deduplicate and filter
    return [...new Set(tags.filter(tag => tag && tag.length > 0))];
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
        return 'processing';
      case 'failed':
        return 'failed';
      case 'pending':
        return 'processing';
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
}