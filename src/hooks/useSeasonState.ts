// src/hooks/useSeasonState.ts
// React hook for accessing season state and management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type SeasonState, type SeasonInfo } from '@/services/SeasonOracle';

interface SeasonStateResponse {
  success: boolean;
  state: SeasonState;
  timestamp: string;
}

interface SeasonActionRequest {
  action: string;
  [key: string]: any;
}

interface SeasonActionResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

/**
 * Hook for accessing current season state
 */
export function useSeasonState() {
  return useQuery<SeasonStateResponse>({
    queryKey: ['season', 'current'],
    queryFn: async (): Promise<SeasonStateResponse> => {
      const response = await fetch('/.netlify/functions/season-oracle');
      
      if (!response.ok) {
        throw new Error(`Season API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch season state');
      }
      
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,       // Consider stale after 15 seconds
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook for accessing specific season information
 */
export function useSeasonInfo(seasonNumber?: number) {
  return useQuery<{ success: boolean; season: SeasonInfo }>({
    queryKey: ['season', 'info', seasonNumber],
    queryFn: async () => {
      if (!seasonNumber) {
        throw new Error('Season number is required');
      }
      
      const response = await fetch(
        `/.netlify/functions/season-oracle?season=${seasonNumber}`
      );
      
      if (!response.ok) {
        throw new Error(`Season API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch season info');
      }
      
      return data;
    },
    enabled: !!seasonNumber,
    staleTime: 5 * 60 * 1000, // Specific season info is stable for 5 minutes
  });
}

/**
 * Hook for accessing transition status
 */
export function useSeasonTransition() {
  return useQuery<{
    success: boolean;
    transition: {
      shouldTransition: boolean;
      isTransitionWindow: boolean;
      nextTransition: string;
      timeRemaining: number;
    };
  }>({
    queryKey: ['season', 'transition'],
    queryFn: async () => {
      const response = await fetch('/.netlify/functions/season-oracle?transition=true');
      
      if (!response.ok) {
        throw new Error(`Transition API error: ${response.status}`);
      }
      
      return response.json();
    },
    refetchInterval: 60000, // Check every minute
    staleTime: 30000,
  });
}

/**
 * Hook for season actions (admin operations)
 */
export function useSeasonActions() {
  const queryClient = useQueryClient();
  
  const mutation = useMutation<SeasonActionResponse, Error, SeasonActionRequest>({
    mutationFn: async (request: SeasonActionRequest): Promise<SeasonActionResponse> => {
      const response = await fetch('/.netlify/functions/season-oracle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || `Season action failed: ${response.status}`
        );
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Season action failed');
      }
      
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries after successful actions
      if (variables.action === 'clear_cache' || variables.action === 'force_transition') {
        queryClient.invalidateQueries({ queryKey: ['season'] });
      }
      
      console.log('✅ Season action completed:', variables.action, data);
    },
    onError: (error, variables) => {
      console.error('❌ Season action failed:', variables.action, error);
    },
  });
  
  return {
    executeAction: mutation.mutate,
    executeActionAsync: mutation.mutateAsync,
    isExecuting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    
    // Convenience methods for common actions
    clearCache: () => mutation.mutate({ action: 'clear_cache' }),
    validateSeason: (season: SeasonInfo) => 
      mutation.mutate({ action: 'validate_season', season }),
    calculateSeason: (date?: Date) => 
      mutation.mutate({ action: 'calculate_season', date: date?.toISOString() }),
    getBoundaries: (seasonNumber: number) => 
      mutation.mutate({ action: 'get_boundaries', seasonNumber }),
    forceTransition: (targetSeason?: number) => 
      mutation.mutate({ action: 'force_transition', targetSeason }),
  };
}

/**
 * Hook for getting season for a specific date
 */
export function useSeasonForDate(date?: Date) {
  return useQuery<{ success: boolean; season: SeasonInfo; requestedDate: string }>({
    queryKey: ['season', 'date', date?.toISOString()],
    queryFn: async () => {
      if (!date) {
        throw new Error('Date is required');
      }
      
      const response = await fetch(
        `/.netlify/functions/season-oracle?date=${encodeURIComponent(date.toISOString())}`
      );
      
      if (!response.ok) {
        throw new Error(`Season API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to get season for date');
      }
      
      return data;
    },
    enabled: !!date,
    staleTime: 5 * 60 * 1000, // Historical season data is stable
  });
}

/**
 * Derived hook for current season info only
 */
export function useCurrentSeason() {
  const { data, isLoading, error } = useSeasonState();
  
  return {
    season: data?.state?.current,
    isLoading,
    error,
    
    // Convenience getters
    seasonNumber: data?.state?.current?.number,
    seasonYear: data?.state?.current?.year,
    seasonWeek: data?.state?.current?.week,
    seasonStatus: data?.state?.current?.status,
    seasonPhase: data?.state?.current?.phase,
    
    // Time calculations
    timeRemaining: data?.state?.current 
      ? data.state.current.endTimestamp - Date.now()
      : 0,
    
    isActive: data?.state?.current?.status === 'active',
    isFinalizing: data?.state?.current?.status === 'finalizing',
  };
}

/**
 * Hook for season sync status
 */
export function useSeasonSync() {
  const { data } = useSeasonState();
  
  // Calculate sync statuses
  const smartContractsInSync = data?.state?.sync?.smartContracts?.voting && 
                              data?.state?.sync?.smartContracts?.leaderboard &&
                              data?.state?.sync?.smartContracts?.rewards;
  
  const arDriveInSync = data?.state?.sync?.arDrive?.currentFolderReady &&
                       data?.state?.sync?.arDrive?.previousFolderFinalized;
  
  const databaseInSync = data?.state?.sync?.database?.inSync;
  
  return {
    sync: data?.state?.sync,
    
    // Individual sync statuses
    smartContractsInSync,
    arDriveInSync,
    databaseInSync,
    
    // Overall sync status
    allInSync: function() {
      if (!data?.state?.sync) return false;
      return smartContractsInSync && arDriveInSync && databaseInSync;
    },
    
    // Get sync issues
    getSyncIssues: function() {
      const issues: string[] = [];
      
      // Only check if data is available
      if (data?.state?.sync) {
        if (!smartContractsInSync) {
          issues.push('Smart contracts not synchronized');
        }
        if (!arDriveInSync) {
          issues.push('ArDrive storage not synchronized');
        }
        if (!databaseInSync) {
          issues.push('Database not synchronized');
        }
      }
      
      return issues;
    }
  };
}

/**
 * Hook for countdown timer
 */
export function useSeasonCountdown() {
  const { timeRemaining, isActive } = useCurrentSeason();
  
  // Convert milliseconds to readable format
  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds };
  };
  
  const formatted = formatTimeRemaining(timeRemaining);
  
  return {
    timeRemaining,
    formatted,
    isActive,
    
    // Helper methods
    isEndingSoon: timeRemaining < 24 * 60 * 60 * 1000, // Less than 24 hours
    isEndingVeryShoon: timeRemaining < 60 * 60 * 1000,  // Less than 1 hour
    
    // Formatted strings
    displayString: isActive 
      ? `${formatted.days}d ${formatted.hours}h ${formatted.minutes}m ${formatted.seconds}s`
      : 'Season ended',
    
    shortString: isActive
      ? `${formatted.days}d ${formatted.hours}h ${formatted.minutes}m`
      : 'Ended'
  };
}

/**
 * Hook for season statistics
 */
export function useSeasonStats(seasonNumber?: number) {
  const currentSeason = useCurrentSeason();
  const targetSeason = seasonNumber || currentSeason.seasonNumber;
  
  return useQuery({
    queryKey: ['season', 'stats', targetSeason],
    queryFn: async () => {
      // This would fetch season statistics from the database
      // For now, return placeholder data
      return {
        totalEvermarks: 0,
        totalVotes: 0,
        uniqueCreators: 0,
        totalStorageCost: 0
      };
    },
    enabled: !!targetSeason,
    staleTime: 60000, // Cache for 1 minute
  });
}