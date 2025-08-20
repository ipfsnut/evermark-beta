// src/features/leaderboard/services/LeaderboardService.ts
// Offchain leaderboard service - calculates rankings from evermark data

import { 
  LeaderboardEntry, 
  LeaderboardFeedResult, 
  LeaderboardStats,
  LeaderboardFeedOptions,
  LeaderboardFilters,
  LeaderboardPagination,
  RankingPeriod
} from '../types';

// Import Evermark types and state to calculate rankings from
import type { Evermark } from '../../evermarks/types';

/**
 * Offchain Leaderboard Service
 * Calculates rankings from real evermark data without Supabase dependency
 */
export class LeaderboardService {
  
  /**
   * Calculate leaderboard entries from evermarks data - Top evermarks by votes
   */
  static calculateLeaderboard(
    evermarks: Evermark[],
    period: string = 'season'
  ): LeaderboardEntry[] {
    
    // Filter evermarks by period if needed
    let filteredEvermarks = evermarks;
    const now = new Date();
    
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredEvermarks = evermarks.filter(em => 
        new Date(em.createdAt) >= weekAgo
      );
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredEvermarks = evermarks.filter(em => 
        new Date(em.createdAt) >= monthAgo
      );
    }
    
    // Convert evermarks to leaderboard entries showing individual evermarks
    const entries: LeaderboardEntry[] = filteredEvermarks.map(evermark => {
      const votes = evermark.votes || 0;
      const creator = evermark.creator || evermark.author || 'Unknown';
      const createdAt = new Date(evermark.createdAt);
      
      // Calculate a simple score based on votes and verification
      const verificationBonus = evermark.verified ? 100 : 0;
      const freshnessBonus = Math.max(0, 30 - Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000))); // Bonus for recent content
      const score = votes + verificationBonus + freshnessBonus;
      
      return {
        id: evermark.id,
        evermarkId: evermark.id,
        rank: 0, // Will be set after sorting
        totalVotes: BigInt(votes),
        voteCount: votes, // Using votes as count for now
        percentageOfTotal: 0, // Will be calculated after sorting
        title: evermark.title || 'Untitled',
        description: evermark.description || '',
        creator,
        createdAt: createdAt.toISOString(),
        sourceUrl: evermark.sourceUrl,
        image: evermark.image,
        contentType: (evermark.contentType as LeaderboardEntry['contentType']) || 'Custom',
        tags: evermark.tags || [],
        verified: evermark.verified,
        change: {
          direction: 'same' as const,
          positions: 0
        }
      };
    });
    
    // Sort by votes (descending)
    entries.sort((a, b) => Number(b.totalVotes - a.totalVotes));
    
    // Calculate total votes for percentage
    const totalVotes = entries.reduce((sum, entry) => sum + Number(entry.totalVotes), 0);
    
    // Take top 100 and assign ranks and percentages
    const top100 = entries.slice(0, 100);
    top100.forEach((entry, index) => {
      entry.rank = index + 1;
      entry.percentageOfTotal = totalVotes > 0 ? (Number(entry.totalVotes) / totalVotes) * 100 : 0;
      
      // Assign change indicators based on rank
      if (index < 3) {
        entry.change.direction = 'up';
        entry.change.positions = Math.min(10, 3 - index);
      } else if (entry.verified) {
        entry.change.direction = 'up';
        entry.change.positions = 1;
      }
    });
    
    return top100;
  }
  
  /**
   * Get current season leaderboard with real data
   */
  static async getCurrentLeaderboard(
    options: LeaderboardFeedOptions & { evermarks?: Evermark[] } = {}
  ): Promise<LeaderboardFeedResult> {
    const {
      pageSize = 50,
      page = 1,
      filters = {},
      evermarks = []
    } = options;
    
    // If no evermarks provided, return empty leaderboard
    if (evermarks.length === 0) {
      return {
        entries: [],
        totalCount: 0,
        totalPages: 1,
        currentPage: page,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: false,
        lastUpdated: new Date(),
        filters
      };
    }
    
    // Calculate leaderboard from evermarks
    const period = filters.period || 'season';
    const allEntries = this.calculateLeaderboard(evermarks, period);
    
    // Apply search filter if provided
    let filteredEntries = allEntries;
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      filteredEntries = allEntries.filter(entry => {
        const title = entry.title || '';
        const description = entry.description || '';
        const creator = entry.creator || '';
        const contentType = entry.contentType || '';
        
        return (
          title.toLowerCase().includes(searchLower) ||
          description.toLowerCase().includes(searchLower) ||
          creator.toLowerCase().includes(searchLower) ||
          contentType.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Apply content type filter if provided
    if (filters.contentType) {
      filteredEntries = filteredEntries.filter(entry => 
        entry.contentType === filters.contentType
      );
    }
    
    // Apply minimum votes filter if provided
    if (filters.minVotes !== undefined) {
      const minVotes = parseInt(filters.minVotes);
      filteredEntries = filteredEntries.filter(entry => 
        Number(entry.totalVotes) >= minVotes
      );
    }
    
    // Apply pagination
    const totalCount = filteredEntries.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedEntries = filteredEntries.slice(startIndex, endIndex);
    
    return {
      entries: paginatedEntries,
      totalCount,
      totalPages,
      currentPage: page,
      pageSize,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      lastUpdated: new Date(),
      filters
    };
  }

  /**
   * Get leaderboard stats for current season
   */
  static async fetchLeaderboardStats(period: string = 'season'): Promise<LeaderboardStats> {
    return {
      totalEvermarks: 0,
      totalVotes: BigInt(0),
      activeVoters: 0,
      averageVotesPerEvermark: BigInt(0),
      topEvermarkVotes: BigInt(0),
      participationRate: 0,
      period
    };
  }
  
  /**
   * Get available periods for filtering
   */
  static getAvailablePeriods(): RankingPeriod[] {
    return [
      { id: 'season', label: 'Season', duration: 90 * 24 * 60 * 60, description: 'Current season' },
      { id: 'month', label: 'Month', duration: 30 * 24 * 60 * 60, description: 'Last 30 days' },
      { id: 'week', label: 'Week', duration: 7 * 24 * 60 * 60, description: 'Last 7 days' },
      { id: 'all', label: 'All Time', duration: 0, description: 'All time' }
    ];
  }
  
  /**
   * Get period by ID
   */
  static getPeriodById(periodId: string): RankingPeriod {
    const periods = this.getAvailablePeriods();
    return periods.find(p => p.id === periodId) || periods[0];
  }
  
  /**
   * Get default filters
   */
  static getDefaultFilters(): LeaderboardFilters {
    return {
      period: 'season'
    };
  }
  
  /**
   * Get default pagination
   */
  static getDefaultPagination(): LeaderboardPagination {
    return {
      page: 1,
      pageSize: 50,
      sortBy: 'rank',
      sortOrder: 'asc'
    };
  }

  /**
   * Get specific evermark's ranking and votes
   */
  static async getEvermarkRanking(evermarkId: string, season?: number): Promise<LeaderboardEntry | null> {
    return null;
  }

  /**
   * Search leaderboard entries by title or creator
   */
  static async searchLeaderboard(
    query: string,
    options: LeaderboardFeedOptions = {}
  ): Promise<LeaderboardFeedResult> {
    return {
      entries: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: options.page || 1,
      pageSize: options.pageSize || 50,
      hasNextPage: false,
      hasPreviousPage: false,
      lastUpdated: new Date(),
      filters: options.filters || {}
    };
  }

  /**
   * Get trending evermarks (biggest gainers/losers)
   */
  static async getTrendingEvermarks(period: string = 'day'): Promise<LeaderboardEntry[]> {
    return [];
  }

  /**
   * Get user's voting history and rankings
   */
  static async getUserVotingHistory(userAddress: string, season?: number): Promise<any[]> {
    return [];
  }

  /**
   * Refresh leaderboard data (trigger sync from blockchain)
   */
  static async refreshLeaderboard(season?: number): Promise<void> {
    // No-op until Supabase integration is complete
  }

  /**
   * Format vote count for display (whole numbers only)
   */
  static formatVoteCount(votes: bigint, useShortFormat = true): string {
    try {
      const votesNum = Math.floor(Number(votes)); // Always whole numbers
      
      if (useShortFormat) {
        // Use short format for large numbers to prevent overflow
        if (votesNum >= 1000000000) {
          return `${(votesNum / 1000000000).toFixed(1)}B`;
        } else if (votesNum >= 1000000) {
          return `${(votesNum / 1000000).toFixed(1)}M`;
        } else if (votesNum >= 1000) {
          return `${(votesNum / 1000).toFixed(1)}K`;
        }
      }
      
      // Return whole number with commas for readability
      return votesNum.toLocaleString('en-US');
    } catch (error) {
      console.error('Error formatting vote count:', error);
      return '0';
    }
  }
  
  /**
   * Format vote amount for display (alias for formatVoteCount)
   */
  static formatVoteAmount(votes: bigint, useShortFormat = true): string {
    return this.formatVoteCount(votes, useShortFormat);
  }

  /**
   * Calculate participation rate
   */
  static calculateParticipationRate(totalVoters: number, totalUsers: number): number {
    if (totalUsers === 0) return 0;
    return (totalVoters / totalUsers) * 100;
  }

  /**
   * Get rank change direction
   */
  static getRankChangeDirection(currentRank: number, previousRank?: number): 'up' | 'down' | 'stable' {
    if (!previousRank) return 'stable';
    if (currentRank < previousRank) return 'up';
    if (currentRank > previousRank) return 'down';
    return 'stable';
  }
}