// src/features/leaderboard/hooks/useLeaderboardState.ts
// Main state management hook for the Leaderboard feature

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type LeaderboardEntry,
  type RankingPeriod,
  type LeaderboardFeedOptions,
  type LeaderboardStats,
  type LeaderboardFilters,
  type LeaderboardPagination,
  type UseLeaderboardStateReturn,
  LEADERBOARD_CONSTANTS,
  RANKING_PERIODS
} from '../types';
import { LeaderboardService } from '../services/LeaderboardService';

// Query keys for React Query
const QUERY_KEYS = {
  leaderboard: (options: LeaderboardFeedOptions) => ['leaderboard', options],
  stats: (period: string) => ['leaderboard', 'stats', period],
  trending: (period: string, limit: number) => ['leaderboard', 'trending', period, limit],
  contentType: (contentType: string, period: string, limit: number) => 
    ['leaderboard', 'contentType', contentType, period, limit],
} as const;

/**
 * Main state management hook for Leaderboard feature
 * Handles data fetching, pagination, filtering, and real-time updates
 */
export function useLeaderboardState(): UseLeaderboardStateReturn {
  // Local state for pagination and filtering
  const [pagination, setPaginationState] = useState<LeaderboardPagination>(
    LeaderboardService.getDefaultPagination()
  );
  const [filters, setFiltersState] = useState<LeaderboardFilters>(
    LeaderboardService.getDefaultFilters()
  );
  
  const queryClient = useQueryClient();

  // Current period derived from filters
  const currentPeriod = useMemo(() => 
    LeaderboardService.getPeriodById(filters.period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD),
    [filters.period]
  );

  // Available periods
  const availablePeriods = useMemo(() => 
    LeaderboardService.getAvailablePeriods(),
    []
  );

  // Build query options
  const queryOptions = useMemo<LeaderboardFeedOptions>(() => ({
    ...pagination,
    filters
  }), [pagination, filters]);

  // Main leaderboard query
  const {
    data: leaderboardResult,
    isLoading,
    isRefetching,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: QUERY_KEYS.leaderboard(queryOptions),
    queryFn: () => LeaderboardService.fetchLeaderboard(queryOptions),
    staleTime: LEADERBOARD_CONSTANTS.CACHE_DURATION,
    gcTime: LEADERBOARD_CONSTANTS.CACHE_DURATION * 2,
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: true
  });

  // Stats query
  const {
    data: stats,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: QUERY_KEYS.stats(currentPeriod.id),
    queryFn: () => LeaderboardService.fetchLeaderboardStats(currentPeriod.id),
    staleTime: LEADERBOARD_CONSTANTS.CACHE_DURATION,
    gcTime: LEADERBOARD_CONSTANTS.CACHE_DURATION * 2,
    retry: 1
  });

  // Auto-refresh when enabled
  useEffect(() => {
    if (!LEADERBOARD_CONSTANTS.AUTO_REFRESH) return;

    const interval = setInterval(() => {
      // Only refetch if data is stale
      if (LeaderboardService.isDataStale(leaderboardResult?.lastUpdated || null)) {
        refetch();
      }
    }, LEADERBOARD_CONSTANTS.REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [leaderboardResult?.lastUpdated, refetch]);

  // Action creators
  const loadLeaderboard = useCallback(async (options?: Partial<LeaderboardFeedOptions>) => {
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

  const refresh = useCallback(async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats(currentPeriod.id) })
    ]);
  }, [refetch, queryClient, currentPeriod.id]);

  const setPeriod = useCallback((periodId: string) => {
    if (!LeaderboardService.validatePeriod(periodId)) {
      console.warn(`Invalid period: ${periodId}`);
      return;
    }
    
    setFiltersState(prev => ({ ...prev, period: periodId }));
    setPaginationState(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  const setFilters = useCallback((newFilters: Partial<LeaderboardFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    // Reset to first page when filters change
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  const setPagination = useCallback((newPagination: Partial<LeaderboardPagination>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(LeaderboardService.getDefaultFilters());
    setPaginationState(prev => ({ ...prev, page: 1 }));
  }, []);

  // Entry lookup functions
  const getEntryByEvermarkId = useCallback((evermarkId: string): LeaderboardEntry | null => {
    return leaderboardResult?.entries.find(entry => entry.evermarkId === evermarkId) || null;
  }, [leaderboardResult?.entries]);

  const getEntryRank = useCallback((evermarkId: string): number | null => {
    const entry = getEntryByEvermarkId(evermarkId);
    return entry?.rank || null;
  }, [getEntryByEvermarkId]);

  // Computed properties
  const error = useMemo(() => {
    if (queryError) {
      return queryError instanceof Error ? queryError.message : 'Failed to load leaderboard';
    }
    return null;
  }, [queryError]);

  const entries = leaderboardResult?.entries || [];
  const totalCount = leaderboardResult?.totalCount || 0;
  const totalPages = leaderboardResult?.totalPages || 0;
  const lastUpdated = leaderboardResult?.lastUpdated || null;

  const hasNextPage = leaderboardResult?.hasNextPage || false;
  const hasPreviousPage = leaderboardResult?.hasPreviousPage || false;
  const isEmpty = entries.length === 0 && !isLoading;
  
  const isFiltered = useMemo(() => {
    const defaultFilters = LeaderboardService.getDefaultFilters();
    return (
      filters.period !== defaultFilters.period ||
      filters.contentType !== defaultFilters.contentType ||
      filters.minVotes !== defaultFilters.minVotes ||
      filters.searchQuery !== defaultFilters.searchQuery
    );
  }, [filters]);

  return {
    // Data
    entries,
    stats: stats || null,
    currentPeriod,
    availablePeriods,
    
    // Pagination & filtering
    pagination,
    filters,
    totalCount,
    totalPages,
    
    // UI state
    isLoading: isLoading || isLoadingStats,
    isRefreshing: isRefetching,
    error,
    lastUpdated,
    
    // Actions
    loadLeaderboard,
    refresh,
    
    // Filtering & pagination
    setPeriod,
    setFilters,
    setPagination,
    clearFilters,
    
    // Entry actions
    getEntryByEvermarkId,
    getEntryRank,
    
    // Computed properties
    hasNextPage,
    hasPreviousPage,
    isEmpty,
    isFiltered
  };
}

/**
 * Hook for trending evermarks (rising in ranks)
 */
export function useTrendingEvermarks(period = '24h', limit = 5) {
  return useQuery({
    queryKey: QUERY_KEYS.trending(period, limit),
    queryFn: () => LeaderboardService.getTrendingEvermarks(period, limit),
    staleTime: LEADERBOARD_CONSTANTS.CACHE_DURATION,
    gcTime: LEADERBOARD_CONSTANTS.CACHE_DURATION * 2,
    retry: 1
  });
}

/**
 * Hook for top evermarks by content type
 */
export function useTopByContentType(
  contentType: LeaderboardEntry['contentType'],
  period = LEADERBOARD_CONSTANTS.DEFAULT_PERIOD,
  limit = 5
) {
  return useQuery({
    queryKey: QUERY_KEYS.contentType(contentType, period, limit),
    queryFn: () => LeaderboardService.getTopByContentType(contentType, period, limit),
    staleTime: LEADERBOARD_CONSTANTS.CACHE_DURATION,
    gcTime: LEADERBOARD_CONSTANTS.CACHE_DURATION * 2,
    retry: 1,
    enabled: !!contentType
  });
}

/**
 * Hook for leaderboard search
 */
export function useLeaderboardSearch(query: string, enabled = true) {
  const [searchResults, setSearchResults] = useState<LeaderboardEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await LeaderboardService.searchLeaderboard(searchQuery);
      setSearchResults(result.entries);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (!enabled || !query.trim()) {
      clearSearch();
      return;
    }

    const timeoutId = setTimeout(() => {
      search(query);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, enabled, search, clearSearch]);

  return {
    searchResults,
    isSearching,
    searchError,
    search,
    clearSearch
  };
}