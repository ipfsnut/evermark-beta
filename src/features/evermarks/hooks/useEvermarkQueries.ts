import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type Evermark,
  type EvermarkFilters,
  type EvermarkPagination,
  type EvermarkFeedOptions,
  type EvermarkFeedResult
} from '../types';

// Query keys for React Query
const QUERY_KEYS = {
  evermarks: (options: EvermarkFeedOptions) => ['evermarks', options],
  evermark: (id: string) => ['evermark', id],
  all: () => ['evermarks'] as const
} as const;

/**
 * Hook for managing evermark queries and pagination
 * Extracted from useEvermarkState for better separation of concerns
 */
export function useEvermarkQueries() {
  const queryClient = useQueryClient();

  // Local state for pagination and filtering
  const [pagination, setPaginationState] = useState<EvermarkPagination>({
    page: 1,
    pageSize: 12,
    sortBy: 'created_at' as const,
    sortOrder: 'desc' as const
  });

  const [filters, setFiltersState] = useState<EvermarkFilters>({
    search: '',
    contentType: undefined,
    verified: false,
    author: '',
    tags: [],
    dateRange: undefined
  });

  const [selectedEvermark, setSelectedEvermark] = useState<Evermark | null>(null);

  // Build query options
  const queryOptions = useMemo<EvermarkFeedOptions>(() => ({
    ...pagination,
    filters
  }), [pagination, filters]);

  // Main evermarks query
  const {
    data: feedResult,
    isLoading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: QUERY_KEYS.evermarks(queryOptions),
    queryFn: () => fetchEvermarks(queryOptions),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    retry: 2,
    enabled: true,
    refetchOnWindowFocus: false
  });

  // Actions
  const loadEvermarks = useCallback(async (options?: Partial<EvermarkFeedOptions>) => {
    if (options) {
      if (options.filters) {
        setFiltersState(prev => ({ ...prev, ...options.filters }));
      }
      if (options.page !== undefined || options.pageSize !== undefined || 
          options.sortBy !== undefined || options.sortOrder !== undefined) {
        setPaginationState(prev => ({ 
          ...prev, 
          page: options.page ?? prev.page,
          pageSize: options.pageSize ?? prev.pageSize,
          sortBy: options.sortBy ?? prev.sortBy,
          sortOrder: options.sortOrder ?? prev.sortOrder
        }));
      }
    }
    await refetch();
  }, [refetch]);

  const loadMore = useCallback(async () => {
    if (feedResult?.hasNextPage) {
      setPaginationState(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [feedResult?.hasNextPage]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const loadEvermark = useCallback(async (id: string): Promise<Evermark | null> => {
    const result = await queryClient.fetchQuery({
      queryKey: QUERY_KEYS.evermark(id),
      queryFn: () => fetchEvermark(id),
      staleTime: 5 * 60 * 1000
    });
    return result;
  }, [queryClient]);

  const selectEvermark = useCallback((evermark: Evermark | null) => {
    setSelectedEvermark(evermark);
  }, []);

  const setFilters = useCallback((newFilters: Partial<EvermarkFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setPagination = useCallback((newPagination: Partial<EvermarkPagination>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({
      search: '',
      contentType: undefined,
      verified: false,
      author: '',
      tags: [],
      dateRange: undefined
    });
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const clearErrors = useCallback(() => {
    refetch();
  }, [refetch]);

  // Computed properties
  const error = useMemo(() => {
    if (queryError) {
      return queryError instanceof Error ? queryError.message : 'Failed to load evermarks';
    }
    return null;
  }, [queryError]);

  const evermarks = feedResult?.evermarks || [];
  const totalCount = feedResult?.totalCount || 0;
  const totalPages = feedResult?.totalPages || 0;
  const hasNextPage = feedResult?.hasNextPage || false;
  const hasPreviousPage = feedResult?.hasPreviousPage || false;

  const isEmpty = evermarks.length === 0 && !isLoading;
  
  const isFiltered = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.author !== '' ||
      filters.contentType !== undefined ||
      filters.verified !== false ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange !== undefined
    );
  }, [filters]);

  return {
    // State
    evermarks,
    selectedEvermark,
    pagination,
    filters,
    totalCount,
    totalPages,
    
    // Loading states
    isLoading,
    isLoadingMore: false,
    
    // Error states
    error,
    
    // Actions
    loadEvermarks,
    loadMore,
    refresh,
    loadEvermark,
    selectEvermark,
    setFilters,
    setPagination,
    clearFilters,
    clearErrors,
    
    // Computed properties
    hasNextPage,
    hasPreviousPage,
    isEmpty,
    isFiltered
  };
}

/**
 * Fetch evermarks from API
 * Extracted for reusability
 */
async function fetchEvermarks(options: EvermarkFeedOptions): Promise<EvermarkFeedResult> {
  try {
    const response = await fetch('/api/evermarks', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const totalCount = data.pagination?.total ?? data.total ?? 0;
    const pageSize = options.pageSize ?? 12;
    const currentPage = options.page ?? 1;
    
    const transformedEvermarks = (data.evermarks ?? []).map((item: any) => {
      let tags: string[] = [];
      let title = '';
      let author = '';
      let description = '';
      
      try {
        if (item.metadata_json) {
          const metadata = JSON.parse(item.metadata_json);
          tags = metadata.tags ?? [];
          title = metadata.title ?? '';
          author = metadata.author ?? '';
          description = metadata.description ?? '';
        }
      } catch {
        // Use defaults
      }
      
      return {
        ...item,
        id: String(item.token_id),
        tokenId: Number(item.token_id),
        title: title || String(item.title || '') || 'Untitled',
        author: author || String(item.author || '') || 'Unknown',
        creator: String(item.owner || item.author || '') || 'Unknown',
        description: description || String(item.description || '') || '',
        metadataURI: String(item.token_uri || ''),
        tags,
        verified: Boolean(item.verified),
        creationTime: Date.parse(String(item.created_at || new Date().toISOString())),
        ipfsHash: item.ipfs_metadata_hash as string,
        supabaseImageUrl: item.processed_image_url as string,
        image: item.processed_image_url ?? (item.ipfs_image_hash ? `ipfs://${item.ipfs_image_hash}` : undefined),
        createdAt: String(item.created_at || new Date().toISOString()),
        updatedAt: String(item.updated_at || item.created_at || new Date().toISOString()),
        contentType: (item.content_type as Evermark['contentType']) || 'Custom',
        sourceUrl: item.source_url as string,
        imageStatus: 'processed' as const,
        votes: 0, // Initialize votes to 0 (will be fetched from blockchain)
        extendedMetadata: { 
          tags,
          castData: item.cast_data as any
        }
      } as Evermark;
    });
    
    return {
      evermarks: transformedEvermarks,
      totalCount,
      page: currentPage,
      totalPages: Math.ceil(totalCount / pageSize),
      hasNextPage: currentPage * pageSize < totalCount,
      hasPreviousPage: currentPage > 1
    };
  } catch (error) {
    console.error('Failed to fetch evermarks:', error);
    return {
      evermarks: [],
      totalCount: 0,
      page: 1,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    };
  }
}

/**
 * Fetch single evermark by ID
 */
async function fetchEvermark(id: string): Promise<Evermark | null> {
  try {
    const response = await fetch(`/api/evermarks?id=${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const item = data.evermark;
    
    if (!item) {
      return null;
    }
    
    let tags: string[] = [];
    let title = '';
    let author = '';
    let description = '';
    
    try {
      if (item.metadata_json) {
        const metadata = JSON.parse(item.metadata_json);
        tags = metadata.tags ?? [];
        title = metadata.title ?? '';
        author = metadata.author ?? '';
        description = metadata.description ?? '';
      }
    } catch {
      // Use defaults
    }
    
    return {
      ...item,
      id: String(item.token_id),
      tokenId: Number(item.token_id),
      title: title || String(item.title || '') || 'Untitled',
      author: author || String(item.author || '') || 'Unknown',
      creator: String(item.owner || item.author || '') || 'Unknown',
      description: description || String(item.description || '') || '',
      metadataURI: String(item.token_uri || ''),
      tags,
      verified: Boolean(item.verified),
      creationTime: Date.parse(String(item.created_at || new Date().toISOString())),
      ipfsHash: item.ipfs_metadata_hash as string,
      supabaseImageUrl: item.processed_image_url as string,
      image: item.processed_image_url ?? (item.ipfs_image_hash ? `ipfs://${item.ipfs_image_hash}` : undefined),
      createdAt: String(item.created_at || new Date().toISOString()),
      updatedAt: String(item.updated_at || item.created_at || new Date().toISOString()),
      contentType: (item.content_type as Evermark['contentType']) || 'Custom',
      sourceUrl: item.source_url as string,
      imageStatus: 'processed' as const,
      extendedMetadata: { 
        tags,
        castData: item.cast_data as any
      }
    } as Evermark;
  } catch (error) {
    console.error('Failed to fetch evermark:', error);
    return null;
  }
}