// src/features/leaderboard/hooks/useLeaderboardState.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
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

/**
 * Hook for managing leaderboard state and data fetching
 */
export function useLeaderboardState(): UseLeaderboardStateReturn {
  // Core data state
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [filters, setFiltersState] = useState<LeaderboardFilters>(() => 
    LeaderboardService.getDefaultFilters()
  );
  const [pagination, setPaginationState] = useState<LeaderboardPagination>(() => 
    LeaderboardService.getDefaultPagination()
  );

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

  // Load leaderboard data
  const loadLeaderboard = useCallback(async (options?: Partial<LeaderboardFeedOptions>) => {
    try {
      const loadOptions: LeaderboardFeedOptions = {
        page: options?.page || pagination.page,
        pageSize: options?.pageSize || pagination.pageSize,
        sortBy: options?.sortBy || pagination.sortBy,
        sortOrder: options?.sortOrder || pagination.sortOrder,
        filters: { ...filters, ...options?.filters }
      };

      setIsLoading(true);
      setError(null);

      const [feedResult, statsResult] = await Promise.all([
        LeaderboardService.fetchLeaderboard(loadOptions),
        LeaderboardService.fetchLeaderboardStats(loadOptions.filters?.period || filters.period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD)
      ]);

      setEntries(feedResult.entries);
      setTotalCount(feedResult.totalCount);
      setTotalPages(feedResult.totalPages);
      setLastUpdated(feedResult.lastUpdated);
      setStats(statsResult);

    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard data');
    } finally {
      setIsLoading(false);
    }
  }, [pagination, filters]);

  // Refresh data
  const refresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      const loadOptions: LeaderboardFeedOptions = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        filters
      };

      const [feedResult, statsResult] = await Promise.all([
        LeaderboardService.fetchLeaderboard(loadOptions),
        LeaderboardService.fetchLeaderboardStats(filters.period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD)
      ]);

      setEntries(feedResult.entries);
      setTotalCount(feedResult.totalCount);
      setTotalPages(feedResult.totalPages);
      setLastUpdated(feedResult.lastUpdated);
      setStats(statsResult);

    } catch (err) {
      console.error('Failed to refresh leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh leaderboard data');
    } finally {
      setIsRefreshing(false);
    }
  }, [pagination, filters]);

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

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Auto-refresh interval (optional)
  useEffect(() => {
    if (!LEADERBOARD_CONSTANTS.AUTO_REFRESH) return;

    const interval = setInterval(() => {
      if (!isLoading && !isRefreshing) {
        refresh();
      }
    }, LEADERBOARD_CONSTANTS.REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refresh, isLoading, isRefreshing]);

  return {
    // Data
    entries,
    stats,
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