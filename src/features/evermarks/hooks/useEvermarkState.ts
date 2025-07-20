import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  type Evermark,
  type EvermarkFilters,
  type EvermarkPagination,
  type EvermarkFeedOptions,
  type CreateEvermarkInput,
  type UseEvermarksResult
} from '../types';
import { EvermarkService } from '../services/EvermarkService';

// Query keys for React Query
const QUERY_KEYS = {
  evermarks: (options: EvermarkFeedOptions) => ['evermarks', options],
  evermark: (id: string) => ['evermark', id],
  all: () => ['evermarks'] as const
} as const;

/**
 * Main state management hook for Evermarks feature
 * Handles data fetching, creation, pagination, and filtering
 */
export function useEvermarksState(): UseEvermarksResult {
  // Local state for pagination and filtering
  const [pagination, setPaginationState] = useState<EvermarkPagination>(
    EvermarkService.getDefaultPagination()
  );
  const [filters, setFiltersState] = useState<EvermarkFilters>(
    EvermarkService.getDefaultFilters()
  );
  const [selectedEvermark, setSelectedEvermark] = useState<Evermark | null>(null);
  
  // Creation state
  const [createProgress, setCreateProgress] = useState(0);
  const [createStep, setCreateStep] = useState('');

  const queryClient = useQueryClient();

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
    queryFn: () => EvermarkService.fetchEvermarks(queryOptions),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    retry: 2
  });

  // Create evermark mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateEvermarkInput) => {
      setCreateProgress(0);
      setCreateStep('Validating metadata...');
      
      // Simulate progress updates
      const result = await EvermarkService.createEvermark(input);
      
      if (result.success) {
        setCreateProgress(100);
        setCreateStep('Evermark created successfully!');
        
        // Invalidate queries to refetch data
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.all() });
      }
      
      return result;
    },
    onSuccess: () => {
      // Reset creation state after a delay
      setTimeout(() => {
        setCreateProgress(0);
        setCreateStep('');
      }, 2000);
    },
    onError: (error) => {
      console.error('Create evermark error:', error);
      setCreateStep('Creation failed');
    }
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
      queryFn: () => EvermarkService.fetchEvermark(id),
      staleTime: 5 * 60 * 1000
    });
    return result;
  }, [queryClient]);

  const selectEvermark = useCallback((evermark: Evermark | null) => {
    setSelectedEvermark(evermark);
  }, []);

  const createEvermark = useCallback(async (input: CreateEvermarkInput) => {
    return createMutation.mutateAsync(input);
  }, [createMutation]);

  const setFilters = useCallback((newFilters: Partial<EvermarkFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    // Reset to first page when filters change
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setPagination = useCallback((newPagination: Partial<EvermarkPagination>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(EvermarkService.getDefaultFilters());
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const clearErrors = useCallback(() => {
    // Clear query errors by refetching
    refetch();
  }, [refetch]);

  const clearCreateError = useCallback(() => {
    createMutation.reset();
  }, [createMutation]);

  // Computed properties
  const error = useMemo(() => {
    if (queryError) {
      return queryError instanceof Error ? queryError.message : 'Failed to load evermarks';
    }
    return null;
  }, [queryError]);

  const createError = useMemo(() => {
    if (createMutation.error) {
      return createMutation.error instanceof Error 
        ? createMutation.error.message 
        : 'Failed to create evermark';
    }
    return null;
  }, [createMutation.error]);

  const evermarks = feedResult?.evermarks || [];
  const totalCount = feedResult?.totalCount || 0;
  const totalPages = feedResult?.totalPages || 0;
  const hasNextPage = feedResult?.hasNextPage || false;
  const hasPreviousPage = feedResult?.hasPreviousPage || false;

  const isEmpty = evermarks.length === 0 && !isLoading;
  
  const isFiltered = useMemo(() => {
    const defaultFilters = EvermarkService.getDefaultFilters();
    return (
      filters.search !== defaultFilters.search ||
      filters.author !== defaultFilters.author ||
      filters.contentType !== defaultFilters.contentType ||
      filters.verified !== defaultFilters.verified ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange !== defaultFilters.dateRange
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
    isCreating: createMutation.isPending,
    isLoadingMore: false, // Could be enhanced with infinite query
    
    // Error states
    error,
    createError,
    
    // Creation progress
    createProgress,
    createStep,
    
    // Actions
    loadEvermarks,
    loadMore,
    refresh,
    loadEvermark,
    selectEvermark,
    createEvermark,
    setFilters,
    setPagination,
    clearFilters,
    clearErrors,
    clearCreateError,
    
    // Computed properties
    hasNextPage,
    hasPreviousPage,
    isEmpty,
    isFiltered
  };
}