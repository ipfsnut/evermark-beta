// src/features/leaderboard/hooks/useLeaderboardState.ts - Offchain leaderboard from evermarks
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LeaderboardService } from '../services/LeaderboardService';
import { 
  LEADERBOARD_CONSTANTS,
  type LeaderboardEntry, 
  type LeaderboardFeedOptions,
  type LeaderboardFilters,
  type LeaderboardPagination,
  type UseLeaderboardStateReturn,
} from '../types';

// Import evermarks types for leaderboard calculation

// React Query keys
const QUERY_KEYS = {
  leaderboard: (options: LeaderboardFeedOptions) => 
    ['leaderboard', 'entries', options],
  stats: (period?: string, evermarksHash?: string) => 
    ['leaderboard', 'stats', period ?? LEADERBOARD_CONSTANTS.DEFAULT_PERIOD, evermarksHash],
} as const;

/**
 * Hook for managing leaderboard state and data fetching - Uses real evermarks data
 */
export function useLeaderboardState(): UseLeaderboardStateReturn {
  const _queryClient = useQueryClient();

  // Get leaderboard data directly from Supabase with voting totals
  const { data: allEvermarksData, isLoading: isLoadingEvermarks } = useQuery({
    queryKey: ['leaderboard', 'evermarks-with-votes'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/leaderboard-data');
      if (!response.ok) throw new Error('Failed to fetch leaderboard data');
      const data = await response.json();
      return data.evermarks;
    },
    staleTime: 30 * 1000,
    retry: 2
  });
  
  const evermarks = allEvermarksData || [];
  
  // Create a simple hash of evermarks for cache invalidation
  const evermarksHash = useMemo(() => {
    return evermarks?.length ? `${evermarks.length}-${evermarks[0]?.id}` : '0';
  }, [evermarks]);

  // Local state for filters and pagination
  const [filters, setFiltersState] = useState<LeaderboardFilters>(() => 
    LeaderboardService.getDefaultFilters()
  );
  const [pagination, setPaginationState] = useState<LeaderboardPagination>(() => 
    LeaderboardService.getDefaultPagination()
  );

  // Create options for queries with evermarks data
  const leaderboardOptions: LeaderboardFeedOptions & { evermarks?: any[] } = useMemo(() => ({
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
    filters,
    evermarks // Pass evermarks data to calculate leaderboard
  }), [pagination, filters, evermarks]);

  // Leaderboard data query
  const { 
    data: leaderboardData,
    isLoading: isLoadingEntries,
    isRefetching: isRefreshingEntries,
    error: entriesError,
    refetch: refetchEntries
  } = useQuery({
    queryKey: QUERY_KEYS.leaderboard(leaderboardOptions),
    queryFn: () => LeaderboardService.getCurrentLeaderboard(leaderboardOptions),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
    enabled: !isLoadingEvermarks // Only run when evermarks data is available
  });

  // Leaderboard stats query
  const { 
    data: stats,
    isLoading: isLoadingStats,
    isRefetching: isRefreshingStats,
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: QUERY_KEYS.stats(filters.period, evermarksHash),
    queryFn: () => LeaderboardService.fetchLeaderboardStats(
      filters.period ?? LEADERBOARD_CONSTANTS.DEFAULT_PERIOD,
      evermarks // Pass evermarks data for stats calculation
    ),
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    retryDelay: 1000,
    enabled: !isLoadingEvermarks // Only run when evermarks data is available
  });

  // Extract data from queries
  const entries = leaderboardData?.entries ?? [];
  const totalCount = leaderboardData?.totalCount ?? 0;
  const totalPages = leaderboardData?.totalPages ?? 0;
  const lastUpdated = leaderboardData?.lastUpdated ?? null;

  // Combined loading and error states
  const isLoading = isLoadingEntries || isLoadingStats;
  const isRefreshing = isRefreshingEntries || isRefreshingStats;
  const error = entriesError?.message ?? statsError?.message ?? null;

  // Available periods query
  const { data: availablePeriods = [] } = useQuery({
    queryKey: ['leaderboard', 'periods'],
    queryFn: () => LeaderboardService.getAvailablePeriods(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Current period query
  const { data: currentPeriod } = useQuery({
    queryKey: ['leaderboard', 'currentPeriod', filters.period],
    queryFn: () => LeaderboardService.getPeriodById(filters.period ?? LEADERBOARD_CONSTANTS.DEFAULT_PERIOD),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !!filters.period
  });

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
    return entries.find(entry => entry.evermarkId === evermarkId) ?? null;
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
    stats: stats ?? null,
    currentPeriod: currentPeriod ?? { id: 'current', label: 'Current', duration: 0, description: 'Current cycle' },
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