// src/features/leaderboard/hooks/useLeaderboardState.ts - Migrated to React Query
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LeaderboardService } from '../services/LeaderboardService';
import type { 
  LeaderboardEntry, 
  LeaderboardStats,
  LeaderboardFeedOptions,
  LeaderboardFilters,
  LeaderboardPagination,
  UseLeaderboardStateReturn,
} from '../types';
import { LEADERBOARD_CONSTANTS } from '../types';

// React Query keys
const QUERY_KEYS = {
  leaderboard: (options: LeaderboardFeedOptions) => 
    ['leaderboard', 'entries', options],
  stats: (period?: string) => 
    ['leaderboard', 'stats', period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD],
} as const;

/**
 * Hook for managing leaderboard state and data fetching - React Query version
 */
export function useLeaderboardState(): UseLeaderboardStateReturn {
  const queryClient = useQueryClient();

  // Local state for filters and pagination
  const [filters, setFiltersState] = useState<LeaderboardFilters>(() => 
    LeaderboardService.getDefaultFilters()
  );
  const [pagination, setPaginationState] = useState<LeaderboardPagination>(() => 
    LeaderboardService.getDefaultPagination()
  );

  // Create options for queries
  const leaderboardOptions: LeaderboardFeedOptions = useMemo(() => ({
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    filters
  }), [pagination, filters]);

  // Leaderboard data query
  const { 
    data: leaderboardData,
    isLoading: isLoadingEntries,
    isRefetching: isRefreshingEntries,
    error: entriesError,
    refetch: refetchEntries
  } = useQuery({
    queryKey: QUERY_KEYS.leaderboard(leaderboardOptions),
    queryFn: () => LeaderboardService.fetchLeaderboard(leaderboardOptions),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
  });

  // Leaderboard stats query
  const { 
    data: stats,
    isLoading: isLoadingStats,
    isRefetching: isRefreshingStats,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: QUERY_KEYS.stats(filters.period),
    queryFn: () => LeaderboardService.fetchLeaderboardStats(
      filters.period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD
    ),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
  });

  // Extract data from queries
  const entries = leaderboardData?.entries || [];
  const totalCount = leaderboardData?.totalCount || 0;
  const totalPages = leaderboardData?.totalPages || 0;
  const lastUpdated = leaderboardData?.lastUpdated || null;

  // Combined loading and error states
  const isLoading = isLoadingEntries || isLoadingStats;
  const isRefreshing = isRefreshingEntries || isRefreshingStats;
  const error = entriesError?.message || statsError?.message || null;

  // Available periods
  const availablePeriods = useMemo(() => 
    LeaderboardService.getAvailablePeriods(), []
  );

  // Current period
  const currentPeriod = useMemo(() => 
    LeaderboardService.getPeriodById(filters.period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD), 
    [filters.period]
  );

  // Computed properties
  const hasNextPage = useMemo(() => 
    pagination.page < totalPages, 
    [pagination.page, totalPages]
  );

  const hasPreviousPage = useMemo(() => 
    pagination.page > 1, 
    [pagination.page]
  );

  const isEmpty = useMemo(() => 
    entries.length === 0, 
    [entries.length]
  );

  const isFiltered = useMemo(() => {
    const defaultFilters = LeaderboardService.getDefaultFilters();
    return (
      filters.searchQuery !== undefined ||
      filters.contentType !== undefined ||
      filters.minVotes !== undefined ||
      filters.period !== defaultFilters.period
    );
  }, [filters]);

  // Load leaderboard data with updated options
  const loadLeaderboard = useCallback(async (options?: Partial<LeaderboardFeedOptions>) => {
    if (options?.filters) {
      setFiltersState(prev => ({ ...prev, ...options.filters }));
    }
    if (options?.page !== undefined || options?.pageSize !== undefined || 
        options?.sortBy !== undefined || options?.sortOrder !== undefined) {
      setPaginationState(prev => ({
        ...prev,
        ...(options.page !== undefined && { page: options.page }),
        ...(options.pageSize !== undefined && { pageSize: options.pageSize }),
        ...(options.sortBy !== undefined && { sortBy: options.sortBy }),
        ...(options.sortOrder !== undefined && { sortOrder: options.sortOrder }),
      }));
    }
    // React Query will automatically refetch when dependencies change
  }, []);

  // Refresh data using React Query
  const refresh = useCallback(async () => {
    await Promise.all([
      refetchEntries(),
      refetchStats()
    ]);
  }, [refetchEntries, refetchStats]);

  // Set period (resets pagination)
  const setPeriod = useCallback((periodId: string) => {
    setFiltersState(prev => ({ ...prev, period: periodId }));
    setPaginationState(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  // Set filters (resets pagination)
  const setFilters = useCallback((newFilters: Partial<LeaderboardFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
    setPaginationState(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  // Set pagination
  const setPagination = useCallback((newPagination: Partial<LeaderboardPagination>) => {
    setPaginationState(prev => ({ ...prev, ...newPagination }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFiltersState(LeaderboardService.getDefaultFilters());
    setPaginationState(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  // Entry lookup functions
  const getEntryByEvermarkId = useCallback((evermarkId: string): LeaderboardEntry | null => {
    return entries.find(entry => entry.evermarkId === evermarkId) || null;
  }, [entries]);

  const getEntryRank = useCallback((evermarkId: string): number | null => {
    const entry = getEntryByEvermarkId(evermarkId);
    return entry ? entry.rank : null;
  }, [getEntryByEvermarkId]);

  // Note: Auto-refresh is now handled by React Query's refetch options
  // React Query automatically manages data fetching, caching, and refetching

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
    
    // UI State
    isLoading,
    isRefreshing,
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

export default useLeaderboardState;