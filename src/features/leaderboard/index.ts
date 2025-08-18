// src/features/leaderboard/index.ts
// Public API for leaderboard feature

// Types - Export type definitions
export type {
  LeaderboardEntry,
  LeaderboardStats,
  LeaderboardFilters,
  LeaderboardPagination,
  LeaderboardFeedOptions,
  LeaderboardFeedResult,
  RankingPeriod,
  RankingChange,
  UseLeaderboardStateReturn,
  LeaderboardError,
  LeaderboardErrorCode
} from './types';

// Services - Export business logic
export { LeaderboardService } from './services/LeaderboardService';

// Hooks - Export state management
export { useLeaderboardState } from './hooks/useLeaderboardState';

// Components - Export UI components
export { LeaderboardTable } from './components/LeaderboardTable';

// Constants - Export from types
export { RANKING_PERIODS, LEADERBOARD_CONSTANTS, LEADERBOARD_ERRORS } from './types';

// Feature configuration
export const leaderboardConfig = {
  name: 'leaderboard',
  version: '1.0.0',
  description: 'Community-driven evermark rankings and leaderboards',
  
  // Feature capabilities
  features: {
    rankings: true,
    filtering: true,
    periods: true,
    stats: true,
    realtime: true
  },
  
  // Default configuration
  defaults: {
    pageSize: 20,
    sortBy: 'rank' as const,
    sortOrder: 'asc' as const,
    period: '7d' as const,
    refreshInterval: 30000, // 30 seconds
    cacheTimeout: 60000 // 1 minute
  },
  
  // UI configuration
  ui: {
    showRankingChanges: true,
    showVotePercentages: true,
    enableFilters: true,
    enablePeriodSelector: true,
    showStats: true,
    enableAutoRefresh: true
  }
};

// Utility functions
export const leaderboardUtils = {
  /**
   * Format rank with ordinal suffix
   */
  formatRank: (rank: number): string => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const value = rank % 100;
    const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
    return `${rank}${suffix}`;
  },
  
  /**
   * Format vote count for display
   */
  formatVoteCount: (votes: bigint): string => {
    const num = Number(votes);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  },
  
  /**
   * Get ranking change display info
   */
  getRankingChangeInfo: (change: { direction: 'up' | 'down' | 'same' | 'new'; positions: number }) => {
    const symbols = {
      up: '↗️',
      down: '↘️', 
      same: '→',
      new: '✨'
    };
    
    return {
      symbol: symbols[change.direction],
      text: change.direction === 'new' 
        ? 'New' 
        : `${change.positions} ${change.direction === 'up' ? 'up' : 'down'}`,
      className: `rank-change-${change.direction}`
    };
  },
  
  /**
   * Calculate participation rate
   */
  calculateParticipationRate: (activeVoters: number, totalUsers: number): number => {
    return totalUsers > 0 ? (activeVoters / totalUsers) * 100 : 0;
  }
};

// Default export for convenience
export default {
  config: leaderboardConfig,
  utils: leaderboardUtils
};