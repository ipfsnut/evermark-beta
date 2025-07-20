// src/features/leaderboard/services/LeaderboardService.ts
// Business logic for leaderboard operations following clean architecture

import { formatUnits } from 'viem';
import {
  type LeaderboardEntry,
  type RankingPeriod,
  type LeaderboardFeedOptions,
  type LeaderboardFeedResult,
  type LeaderboardStats,
  type LeaderboardFilters,
  type LeaderboardPagination,
  type LeaderboardError,
  type LeaderboardErrorCode,
  RANKING_PERIODS,
  LEADERBOARD_CONSTANTS,
  LEADERBOARD_ERRORS
} from '../types';

/**
 * LeaderboardService - Pure business logic for leaderboard operations
 * Handles data fetching, ranking calculations, filtering, and formatting
 */
export class LeaderboardService {
  
  /**
   * Fetch leaderboard data with filtering and pagination
   */
  static async fetchLeaderboard(options: LeaderboardFeedOptions): Promise<LeaderboardFeedResult> {
    try {
      const { page = 1, pageSize = LEADERBOARD_CONSTANTS.DEFAULT_PAGE_SIZE, filters } = options;
      
      // Validate pagination parameters
      if (page < 1 || pageSize < 1 || pageSize > LEADERBOARD_CONSTANTS.MAX_PAGE_SIZE) {
        throw this.createError(
          LEADERBOARD_ERRORS.INVALID_PARAMETERS,
          'Invalid pagination parameters'
        );
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        period: filters?.period || LEADERBOARD_CONSTANTS.DEFAULT_PERIOD,
        ...(filters?.contentType && { contentType: filters.contentType }),
        ...(filters?.minVotes && { minVotes: filters.minVotes }),
        ...(filters?.searchQuery && { search: filters.searchQuery }),
        ...(options.sortBy && { sortBy: options.sortBy }),
        ...(options.sortOrder && { sortOrder: options.sortOrder })
      });

      // Fetch from API endpoint
      const response = await fetch(`/api/leaderboard?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw this.createError(
          LEADERBOARD_ERRORS.API_ERROR,
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      
      // Transform API response to our format
      const entries: LeaderboardEntry[] = data.entries?.map((entry: any, index: number) => ({
        id: entry.id || `${entry.evermarkId}-${page}-${index}`,
        evermarkId: entry.evermarkId?.toString() || '0',
        rank: entry.rank || ((page - 1) * pageSize + index + 1),
        totalVotes: BigInt(entry.totalVotes || '0'),
        voteCount: entry.voteCount || 0,
        percentageOfTotal: entry.percentageOfTotal || 0,
        title: entry.title || `Evermark #${entry.evermarkId}`,
        description: entry.description || '',
        creator: entry.creator || 'Unknown',
        createdAt: entry.createdAt || new Date().toISOString(),
        sourceUrl: entry.sourceUrl,
        image: entry.image,
        contentType: entry.contentType || 'Custom',
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        verified: Boolean(entry.verified),
        change: this.calculateRankingChange(entry.currentRank, entry.previousRank)
      })) || [];

      const result: LeaderboardFeedResult = {
        entries,
        totalCount: data.totalCount || entries.length,
        totalPages: Math.ceil((data.totalCount || entries.length) / pageSize),
        currentPage: page,
        pageSize,
        hasNextPage: data.hasNextPage ?? (page * pageSize < (data.totalCount || entries.length)),
        hasPreviousPage: data.hasPreviousPage ?? (page > 1),
        lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
        filters: filters || this.getDefaultFilters()
      };

      return result;
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      
      if (error instanceof Error && error.name === 'LeaderboardError') {
        throw error;
      }
      
      throw this.createError(
        LEADERBOARD_ERRORS.FETCH_ERROR,
        error instanceof Error ? error.message : 'Failed to fetch leaderboard data'
      );
    }
  }

  /**
   * Fetch leaderboard statistics for a given period
   */
  static async fetchLeaderboardStats(period: string): Promise<LeaderboardStats> {
    try {
      const response = await fetch(`/api/leaderboard/stats?period=${period}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        totalEvermarks: data.totalEvermarks || 0,
        totalVotes: BigInt(data.totalVotes || '0'),
        activeVoters: data.activeVoters || 0,
        participationRate: data.participationRate || 0,
        averageVotesPerEvermark: BigInt(data.averageVotesPerEvermark || '0'),
        topEvermarkVotes: BigInt(data.topEvermarkVotes || '0'),
        period: period
      };
    } catch (error) {
      console.error('Failed to fetch leaderboard stats:', error);
      
      // Return default stats on error
      return {
        totalEvermarks: 0,
        totalVotes: BigInt(0),
        activeVoters: 0,
        participationRate: 0,
        averageVotesPerEvermark: BigInt(0),
        topEvermarkVotes: BigInt(0),
        period: period
      };
    }
  }

  /**
   * Get trending evermarks (rising in ranks)
   */
  static async getTrendingEvermarks(period: string, limit: number): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(`/api/leaderboard/trending?period=${period}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trending: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.entries?.map((entry: any) => ({
        id: entry.id,
        evermarkId: entry.evermarkId?.toString() || '0',
        rank: entry.rank,
        totalVotes: BigInt(entry.totalVotes || '0'),
        voteCount: entry.voteCount || 0,
        percentageOfTotal: entry.percentageOfTotal || 0,
        title: entry.title || `Evermark #${entry.evermarkId}`,
        description: entry.description || '',
        creator: entry.creator || 'Unknown',
        createdAt: entry.createdAt || new Date().toISOString(),
        sourceUrl: entry.sourceUrl,
        image: entry.image,
        contentType: entry.contentType || 'Custom',
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        verified: Boolean(entry.verified),
        change: this.calculateRankingChange(entry.currentRank, entry.previousRank)
      })) || [];
    } catch (error) {
      console.error('Failed to fetch trending evermarks:', error);
      return [];
    }
  }

  /**
   * Get top evermarks by content type
   */
  static async getTopByContentType(
    contentType: LeaderboardEntry['contentType'],
    period: string,
    limit: number
  ): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(
        `/api/leaderboard/by-type?contentType=${contentType}&period=${period}&limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch by content type: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.entries?.map((entry: any) => ({
        id: entry.id,
        evermarkId: entry.evermarkId?.toString() || '0',
        rank: entry.rank,
        totalVotes: BigInt(entry.totalVotes || '0'),
        voteCount: entry.voteCount || 0,
        percentageOfTotal: entry.percentageOfTotal || 0,
        title: entry.title || `Evermark #${entry.evermarkId}`,
        description: entry.description || '',
        creator: entry.creator || 'Unknown',
        createdAt: entry.createdAt || new Date().toISOString(),
        sourceUrl: entry.sourceUrl,
        image: entry.image,
        contentType: entry.contentType || 'Custom',
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        verified: Boolean(entry.verified),
        change: this.calculateRankingChange(entry.currentRank, entry.previousRank)
      })) || [];
    } catch (error) {
      console.error('Failed to fetch by content type:', error);
      return [];
    }
  }

  /**
   * Search leaderboard entries
   */
  static async searchLeaderboard(query: string): Promise<LeaderboardFeedResult> {
    const options: LeaderboardFeedOptions = {
      page: 1,
      pageSize: 50, // Higher limit for search results
      filters: {
        searchQuery: query,
        period: LEADERBOARD_CONSTANTS.DEFAULT_PERIOD
      }
    };

    return this.fetchLeaderboard(options);
  }

  /**
   * Calculate ranking change based on current and previous positions
   */
  static calculateRankingChange(
    currentRank?: number,
    previousRank?: number
  ): LeaderboardEntry['change'] {
    if (previousRank === undefined || currentRank === undefined) {
      return {
        direction: 'new',
        positions: 0
      };
    }

    if (currentRank < previousRank) {
      return {
        direction: 'up',
        positions: previousRank - currentRank
      };
    } else if (currentRank > previousRank) {
      return {
        direction: 'down',
        positions: currentRank - previousRank
      };
    } else {
      return {
        direction: 'same',
        positions: 0
      };
    }
  }

  /**
   * Format vote amount for display
   */
  static formatVoteAmount(amount: bigint, decimals = 2): string {
    if (amount === BigInt(0)) return '0';
    
    const formatted = formatUnits(amount, 18);
    const number = parseFloat(formatted);
    
    if (number < 0.0001) {
      return '< 0.0001';
    }
    
    // Handle large amounts with appropriate formatting
    if (number >= 1000000) {
      return `${(number / 1000000).toFixed(decimals)}M`;
    } else if (number >= 1000) {
      return `${(number / 1000).toFixed(decimals)}K`;
    }
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Get available ranking periods
   */
  static getAvailablePeriods(): RankingPeriod[] {
    return RANKING_PERIODS;
  }

  /**
   * Get period by ID
   */
  static getPeriodById(periodId: string): RankingPeriod {
    const period = RANKING_PERIODS.find(p => p.id === periodId);
    if (!period) {
      console.warn(`Unknown period ID: ${periodId}, falling back to default`);
      return RANKING_PERIODS.find(p => p.id === LEADERBOARD_CONSTANTS.DEFAULT_PERIOD) || RANKING_PERIODS[0];
    }
    return period;
  }

  /**
   * Validate period ID
   */
  static validatePeriod(periodId: string): boolean {
    return RANKING_PERIODS.some(p => p.id === periodId);
  }

  /**
   * Get default filters
   */
  static getDefaultFilters(): LeaderboardFilters {
    return {
      period: LEADERBOARD_CONSTANTS.DEFAULT_PERIOD,
      contentType: undefined,
      minVotes: undefined,
      searchQuery: undefined
    };
  }

  /**
   * Get default pagination
   */
  static getDefaultPagination(): LeaderboardPagination {
    return {
      page: 1,
      pageSize: LEADERBOARD_CONSTANTS.DEFAULT_PAGE_SIZE,
      sortBy: 'rank',
      sortOrder: 'asc'
    };
  }

  /**
   * Check if data is stale and needs refresh
   */
  static isDataStale(lastUpdated: Date | null): boolean {
    if (!lastUpdated) return true;
    
    const now = new Date();
    const staleThreshold = LEADERBOARD_CONSTANTS.CACHE_DURATION;
    
    return (now.getTime() - lastUpdated.getTime()) > staleThreshold;
  }

  /**
   * Create standardized leaderboard error
   */
  static createError(
    code: LeaderboardErrorCode,
    message: string,
    details?: Record<string, any>
  ): LeaderboardError {
    const error = new Error(message) as LeaderboardError;
    error.name = 'LeaderboardError';
    error.code = code;
    error.timestamp = Date.now();
    error.recoverable = this.isRecoverableError(code);
    error.details = details;
    return error;
  }

  /**
   * Check if an error is recoverable
   */
  private static isRecoverableError(code: LeaderboardErrorCode): boolean {
    const recoverableErrors = new Set<LeaderboardErrorCode>([
      LEADERBOARD_ERRORS.NETWORK_ERROR,
      LEADERBOARD_ERRORS.API_ERROR,
      LEADERBOARD_ERRORS.FETCH_ERROR
    ]);
    return recoverableErrors.has(code);
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyError(error: LeaderboardError): string {
    switch (error.code) {
      case LEADERBOARD_ERRORS.NETWORK_ERROR:
        return 'Network connection error. Please check your internet connection and try again.';
      case LEADERBOARD_ERRORS.API_ERROR:
        return 'Server error occurred. Please try again in a few moments.';
      case LEADERBOARD_ERRORS.FETCH_ERROR:
        return 'Failed to load leaderboard data. Please refresh the page.';
      case LEADERBOARD_ERRORS.INVALID_PARAMETERS:
        return 'Invalid search parameters. Please check your filters and try again.';
      case LEADERBOARD_ERRORS.NO_DATA:
        return 'No leaderboard data available for the selected period.';
      default:
        return error.message || 'An unexpected error occurred while loading the leaderboard.';
    }
  }

  /**
   * Calculate voting statistics from entries
   */
  static calculateVotingStats(
    entries: LeaderboardEntry[],
    totalVotingPower: bigint,
    period: string
  ): LeaderboardStats {
    if (entries.length === 0) {
      return {
        totalEvermarks: 0,
        totalVotes: BigInt(0),
        activeVoters: 0,
        participationRate: 0,
        averageVotesPerEvermark: BigInt(0),
        topEvermarkVotes: BigInt(0),
        period
      };
    }

    const totalVotes = entries.reduce((sum, entry) => sum + entry.totalVotes, BigInt(0));
    const totalVoters = entries.reduce((sum, entry) => sum + entry.voteCount, 0);
    const averageVotesPerEvermark = totalVotes / BigInt(entries.length);
    const topEvermarkVotes = entries[0]?.totalVotes || BigInt(0);
    
    // Estimate participation rate (simplified calculation)
    const participationRate = totalVotingPower > BigInt(0) 
      ? Math.min(1, Number(totalVotes * BigInt(100) / totalVotingPower) / 100)
      : 0;

    return {
      totalEvermarks: entries.length,
      totalVotes,
      activeVoters: totalVoters,
      participationRate,
      averageVotesPerEvermark,
      topEvermarkVotes,
      period
    };
  }

  /**
   * Sort entries by various criteria
   */
  static sortEntries(
    entries: LeaderboardEntry[],
    sortBy: LeaderboardPagination['sortBy'],
    sortOrder: LeaderboardPagination['sortOrder']
  ): LeaderboardEntry[] {
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

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Filter entries by criteria
   */
  static filterEntries(
    entries: LeaderboardEntry[],
    filters: LeaderboardFilters
  ): LeaderboardEntry[] {
    return entries.filter(entry => {
      // Content type filter
      if (filters.contentType && entry.contentType !== filters.contentType) {
        return false;
      }

      // Minimum votes filter
      if (filters.minVotes) {
        const minVotesAmount = BigInt(filters.minVotes);
        if (entry.totalVotes < minVotesAmount) {
          return false;
        }
      }

      // Search query filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        const titleMatch = entry.title.toLowerCase().includes(searchLower);
        const creatorMatch = entry.creator.toLowerCase().includes(searchLower);
        const tagMatch = entry.tags.some(tag => tag.toLowerCase().includes(searchLower));
        const descriptionMatch = entry.description.toLowerCase().includes(searchLower);

        if (!titleMatch && !creatorMatch && !tagMatch && !descriptionMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generate export data for leaderboard
   */
  static generateExportData(entries: LeaderboardEntry[]): {
    csv: string;
    json: string;
  } {
    // CSV export
    const csvHeaders = [
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
      'Verified',
      'Source URL'
    ];

    const csvRows = entries.map(entry => [
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
      entry.verified,
      entry.sourceUrl || ''
    ]);

    const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');

    // JSON export
    const json = JSON.stringify(entries, (key, value) => {
      // Handle BigInt serialization
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2);

    return { csv, json };
  }

  /**
   * Validate leaderboard entry data
   */
  static validateEntry(entry: Partial<LeaderboardEntry>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!entry.evermarkId || entry.evermarkId === '0') {
      errors.push('Valid Evermark ID is required');
    }

    if (!entry.title || entry.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!entry.creator || entry.creator.trim().length === 0) {
      errors.push('Creator is required');
    }

    if (entry.rank !== undefined && entry.rank < 1) {
      errors.push('Rank must be a positive number');
    }

    if (entry.totalVotes !== undefined && entry.totalVotes < BigInt(0)) {
      errors.push('Total votes cannot be negative');
    }

    if (entry.voteCount !== undefined && entry.voteCount < 0) {
      errors.push('Vote count cannot be negative');
    }

    if (entry.percentageOfTotal !== undefined && (entry.percentageOfTotal < 0 || entry.percentageOfTotal > 100)) {
      errors.push('Percentage must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}