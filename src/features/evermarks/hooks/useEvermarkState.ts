import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveAccount } from 'thirdweb/react';

import {
  type Evermark,
  type EvermarkFilters,
  type EvermarkPagination,
  type EvermarkFeedOptions,
  type CreateEvermarkInput,
  type UseEvermarksResult,
  type EvermarkFeedResult,
  type CreateEvermarkResult
} from '../types';
// TODO: Fix TempEvermarkService SDK imports
// import { TempEvermarkService } from '../services/TempEvermarkService';

// Temporary service replacement until SDK issues are fixed
const TempEvermarkService = {
  getDefaultPagination: (): EvermarkPagination => ({
    page: 1,
    pageSize: 12,
    sortBy: 'created_at' as const,
    sortOrder: 'desc' as const
  }),
  getDefaultFilters: (): EvermarkFilters => ({
    search: '',
    contentType: undefined,
    verified: false,
    author: '',
    tags: [],
    dateRange: undefined
  }),
  fetchEvermarks: async (options: EvermarkFeedOptions): Promise<EvermarkFeedResult> => {
    try {
      // Simple API call to our evermarks endpoint
      const response = await fetch('/.netlify/functions/evermarks', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the response to match our expected format
      return {
        evermarks: data.evermarks || [],
        totalCount: data.total || 0,
        page: options.page || 1,
        totalPages: Math.ceil((data.total || 0) / (options.pageSize || 12)),
        hasNextPage: (options.page || 1) * (options.pageSize || 12) < (data.total || 0),
        hasPreviousPage: (options.page || 1) > 1
      };
    } catch (error) {
      console.error('Failed to fetch evermarks:', error);
      // Return empty result on error
      return {
        evermarks: [],
        totalCount: 0,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      };
    }
  },
  fetchEvermark: async (id: string): Promise<Evermark | null> => {
    try {
      // Simple API call to get individual evermark
      const response = await fetch(`/.netlify/functions/evermarks?id=${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.evermark || null;
    } catch (error) {
      console.error('Failed to fetch evermark:', error);
      return null;
    }
  },
  createEvermark: async (input: CreateEvermarkInput, account: any): Promise<CreateEvermarkResult> => {
    // TODO: Replace with actual API call
    return {
      success: false,
      message: 'TempEvermarkService temporarily disabled'
    };
  }
};

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
  // Get the active account for blockchain operations
  const account = useActiveAccount();
  
  // Local state for pagination and filtering
  const [pagination, setPaginationState] = useState<EvermarkPagination>(
    TempEvermarkService.getDefaultPagination()
  );
  const [filters, setFiltersState] = useState<EvermarkFilters>(
    TempEvermarkService.getDefaultFilters()
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
    queryFn: () => TempEvermarkService.fetchEvermarks(queryOptions),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    retry: 2
  });

  // Create evermark mutation with reentrancy protection
  const createMutation = useMutation({
    mutationFn: async (input: CreateEvermarkInput) => {
      // Check if we have an account before starting creation
      if (!account) {
        throw new Error('No wallet connected. Please connect your wallet to create an Evermark.');
      }

      setCreateProgress(0);
      setCreateStep('Validating metadata...');
      
      // Pass the account to the service
      const result = await TempEvermarkService.createEvermark(input, account);
      
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
      queryFn: () => TempEvermarkService.fetchEvermark(id),
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
    setFiltersState(TempEvermarkService.getDefaultFilters());
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
    const defaultFilters = TempEvermarkService.getDefaultFilters();
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