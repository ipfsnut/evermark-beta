// src/features/leaderboard/index.ts
// Public API exports for the Leaderboard feature

// Types - Export all public interfaces
export type {
  LeaderboardEntry,
  RankingChange,
  RankingPeriod,
  LeaderboardFilters,
  LeaderboardPagination,
  LeaderboardFeedOptions,
  LeaderboardFeedResult,
  LeaderboardStats,
  LeaderboardError,
  LeaderboardErrorCode,
  UseLeaderboardStateReturn
} from './types';

// Constants
export { 
  RANKING_PERIODS, 
  LEADERBOARD_CONSTANTS, 
  LEADERBOARD_ERRORS 
} from './types';

// Services
export { LeaderboardService } from './services/LeaderboardService';

// Hooks
export { 
  useLeaderboardState,
  useTrendingEvermarks,
  useTopByContentType,
  useLeaderboardSearch
} from './hooks/useLeaderboardState';

// Components
export { LeaderboardTable } from './components/LeaderboardTable';

// Feature configuration and utilities
export const leaderboardConfig = {
  name: 'leaderboard',
  version: '1.0.0',
  description: 'Community-driven leaderboard for Evermark content ranking',
  
  // Feature capabilities
  features: {
    ranking: true,
    filtering: true,
    search: true,
    pagination: true,
    realTimeUpdates: true,
    periodFiltering: true,
    contentTypeFiltering: true,
    trending: true,
    statistics: true
  },
  
  // Default configuration
  defaults: {
    pageSize: 20,
    refreshInterval: 30000, // 30 seconds
    cacheTimeout: 60000,    // 1 minute
    enableAutoRefresh: true,
    defaultPeriod: '7d',
    minVotesThreshold: '1',
    maxEntriesPerPage: 100,
    enableTrending: true
  },
  
  // Ranking periods
  periods: {
    '24h': {
      name: '24 Hours',
      duration: 24 * 60 * 60,
      description: 'Rankings from the last 24 hours',
      refreshFrequency: 300 // 5 minutes
    },
    '7d': {
      name: '7 Days', 
      duration: 7 * 24 * 60 * 60,
      description: 'Rankings from the last 7 days',
      refreshFrequency: 1800 // 30 minutes
    },
    'all': {
      name: 'All Time',
      duration: 0,
      description: 'All-time rankings since launch',
      refreshFrequency: 3600 // 1 hour
    }
  },
  
  // Content type weights for ranking
  contentTypeWeights: {
    Cast: 1.0,
    DOI: 1.2,    // Academic content gets slight boost
    ISBN: 1.1,   // Books get slight boost
    URL: 1.0,
    Custom: 0.9  // Custom content gets slight penalty
  },
  
  // UI configuration
  ui: {
    showRankingChanges: true,
    showPercentages: true,
    showVoteCount: true,
    showCreationDate: true,
    showTags: true,
    enableCompactMode: true,
    enableSearch: true,
    enableFiltering: true,
    showStatistics: true,
    highlightTopThree: true
  },
  
  // Performance settings
  performance: {
    enableVirtualization: false, // For large lists
    preloadNextPage: true,
    cacheSize: 50, // Number of pages to cache
    debounceSearch: 300, // ms
    throttleScroll: 100  // ms
  }
};

// Utility functions for external use
export const leaderboardUtils = {
  /**
   * Check if leaderboard feature is enabled
   */
  isEnabled: (): boolean => {
    return leaderboardConfig.features.ranking;
  },
  
  /**
   * Get period configuration by ID
   */
  getPeriodConfig: (periodId: string) => {
    return leaderboardConfig.periods[periodId as keyof typeof leaderboardConfig.periods];
  },
  
  /**
   * Format ranking for display
   */
  formatRanking: (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈'; 
    if (rank === 3) return '🥉';
    return `#${rank}`;
  },
  
  /**
   * Calculate ranking change direction
   */
  getRankingTrend: (currentRank: number, previousRank?: number): 'up' | 'down' | 'same' | 'new' => {
    if (previousRank === undefined) return 'new';
    if (currentRank < previousRank) return 'up';
    if (currentRank > previousRank) return 'down';
    return 'same';
  },
  
  /**
   * Get ranking change color class
   */
  getRankingChangeColor: (change: RankingChange): string => {
    switch (change.direction) {
      case 'up': return 'text-green-400';
      case 'down': return 'text-red-400';
      case 'new': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  },
  
  /**
   * Format vote percentage
   */
  formatPercentage: (percentage: number): string => {
    if (percentage < 0.01) return '< 0.01%';
    return `${percentage.toFixed(2)}%`;
  },
  
  /**
   * Get content type display info
   */
  getContentTypeInfo: (contentType: LeaderboardEntry['contentType']) => {
    const typeMap = {
      Cast: { label: 'Farcaster Cast', color: 'text-purple-400', icon: '💬' },
      DOI: { label: 'Academic Paper', color: 'text-blue-400', icon: '📄' },
      ISBN: { label: 'Book', color: 'text-green-400', icon: '📚' },
      URL: { label: 'Web Content', color: 'text-cyan-400', icon: '🌐' },
      Custom: { label: 'Custom Content', color: 'text-gray-400', icon: '✨' }
    };
    return typeMap[contentType] || typeMap.Custom;
  },
  
  /**
   * Generate shareable URL for leaderboard position
   */
  getShareableUrl: (entry: LeaderboardEntry, period?: string): string => {
    const baseUrl = window.location.origin;
    const periodParam = period ? `?period=${period}` : '';
    return `${baseUrl}/leaderboard${periodParam}#rank-${entry.rank}`;
  },
  
  /**
   * Calculate competitive index
   */
  calculateCompetitiveIndex: (entries: LeaderboardEntry[]): number => {
    if (entries.length < 2) return 0;
    
    const votes = entries.map(e => Number(e.totalVotes));
    const maxVotes = Math.max(...votes);
    const minVotes = Math.min(...votes.filter(v => v > 0));
    
    if (maxVotes === 0) return 0;
    
    // Higher index means more competitive (votes are more spread out)
    return 1 - (maxVotes - minVotes) / maxVotes;
  },
  
  /**
   * Get ranking insights
   */
  getRankingInsights: (entries: LeaderboardEntry[]): {
    totalVotes: bigint;
    averageVotes: bigint;
    medianVotes: bigint;
    competitiveness: number;
    diversity: number;
  } => {
    if (entries.length === 0) {
      return {
        totalVotes: BigInt(0),
        averageVotes: BigInt(0),
        medianVotes: BigInt(0),
        competitiveness: 0,
        diversity: 0
      };
    }
    
    const votes = entries.map(e => e.totalVotes);
    const totalVotes = votes.reduce((sum, v) => sum + v, BigInt(0));
    const averageVotes = totalVotes / BigInt(entries.length);
    
    // Calculate median
    const sortedVotes = [...votes].sort((a, b) => Number(a - b));
    const mid = Math.floor(sortedVotes.length / 2);
    const medianVotes = sortedVotes.length % 2 !== 0 
      ? sortedVotes[mid]
      : (sortedVotes[mid - 1] + sortedVotes[mid]) / BigInt(2);
    
    // Calculate competitiveness (variance in votes)
    const competitiveness = leaderboardUtils.calculateCompetitiveIndex(entries);
    
    // Calculate diversity (unique content types)
    const contentTypes = new Set(entries.map(e => e.contentType));
    const diversity = contentTypes.size / 5; // 5 possible content types
    
    return {
      totalVotes,
      averageVotes,
      medianVotes,
      competitiveness,
      diversity: Math.min(1, diversity)
    };
  },
  
  /**
   * Filter entries by criteria
   */
  filterEntries: (
    entries: LeaderboardEntry[],
    criteria: {
      minVotes?: bigint;
      contentTypes?: LeaderboardEntry['contentType'][];
      verified?: boolean;
      searchTerm?: string;
    }
  ): LeaderboardEntry[] => {
    return entries.filter(entry => {
      if (criteria.minVotes && entry.totalVotes < criteria.minVotes) {
        return false;
      }
      
      if (criteria.contentTypes && !criteria.contentTypes.includes(entry.contentType)) {
        return false;
      }
      
      if (criteria.verified !== undefined && entry.verified !== criteria.verified) {
        return false;
      }
      
      if (criteria.searchTerm) {
        const searchLower = criteria.searchTerm.toLowerCase();
        const titleMatch = entry.title.toLowerCase().includes(searchLower);
        const creatorMatch = entry.creator.toLowerCase().includes(searchLower);
        const tagMatch = entry.tags.some(tag => tag.toLowerCase().includes(searchLower));
        
        if (!titleMatch && !creatorMatch && !tagMatch) {
          return false;
        }
      }
      
      return true;
    });
  },
  
  /**
   * Sort entries by different criteria
   */
  sortEntries: (
    entries: LeaderboardEntry[],
    sortBy: 'rank' | 'votes' | 'title' | 'creator' | 'createdAt' | 'change',
    order: 'asc' | 'desc' = 'asc'
  ): LeaderboardEntry[] => {
    const sorted = [...entries].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'votes':
          comparison = Number(a.totalVotes - b.totalVotes);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'creator':
          comparison = a.creator.localeCompare(b.creator);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'change':
          comparison = a.change.positions - b.change.positions;
          break;
        default:
          comparison = a.rank - b.rank;
      }
      
      return order === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  },
  
  /**
   * Generate CSV export data
   */
  generateCSVData: (entries: LeaderboardEntry[]): string => {
    const headers = [
      'Rank',
      'Title', 
      'Creator',
      'Content Type',
      'Total Votes',
      'Vote Count',
      'Percentage',
      'Change Direction',
      'Change Positions',
      'Created At',
      'Verified'
    ];
    
    const rows = entries.map(entry => [
      entry.rank,
      `"${entry.title.replace(/"/g, '""')}"`,
      `"${entry.creator.replace(/"/g, '""')}"`,
      entry.contentType,
      entry.totalVotes.toString(),
      entry.voteCount,
      entry.percentageOfTotal.toFixed(2),
      entry.change.direction,
      entry.change.positions,
      entry.createdAt,
      entry.verified
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
};

// Integration helpers
export const leaderboardIntegration = {
  /**
   * Connect to voting feature for real-time updates
   */
  connectVoting: (votingService: any) => {
    return {
      onVoteUpdated: (evermarkId: string, newVotes: bigint) => {
        // Invalidate leaderboard cache when votes change
        console.log(`Vote updated for evermark ${evermarkId}: ${newVotes}`);
      },
      onRankingChanged: (rankings: Array<{ evermarkId: string; rank: number }>) => {
        // Update ranking positions
        console.log('Rankings updated:', rankings);
      }
    };
  },
  
  /**
   * Connect to evermarks feature for metadata
   */
  connectEvermarks: (evermarksService: any) => {
    return {
      getEvermarkMetadata: (id: string) => evermarksService.getEvermark(id),
      subscribeToCreation: (callback: (evermark: any) => void) => 
        evermarksService.onEvermarkCreated(callback)
    };
  },
  
  /**
   * Connect to analytics for tracking
   */
  connectAnalytics: (analyticsService: any) => {
    return {
      trackLeaderboardView: (period: string) => 
        analyticsService.track('leaderboard_viewed', { period }),
      trackEntryClick: (evermarkId: string, rank: number) =>
        analyticsService.track('leaderboard_entry_clicked', { evermarkId, rank }),
      trackPeriodChange: (from: string, to: string) =>
        analyticsService.track('leaderboard_period_changed', { from, to })
    };
  }
};

// Default export for convenience
export default {
  config: leaderboardConfig,
  utils: leaderboardUtils,
  integration: leaderboardIntegration,
  LeaderboardService,
  useLeaderboardState,
  LeaderboardTable
};