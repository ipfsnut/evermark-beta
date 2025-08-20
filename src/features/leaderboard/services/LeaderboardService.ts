// src/features/leaderboard/services/LeaderboardService.ts
// Offchain leaderboard service - calculates rankings from evermark data

import { 
  LeaderboardEntry, 
  LeaderboardFeedResult, 
  LeaderboardStats,
  LeaderboardFeedOptions,
  LeaderboardFilters,
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
   * Calculate leaderboard entries from evermarks data
   */
  static calculateLeaderboard(
    evermarks: Evermark[],
    period: RankingPeriod = 'season'
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
    
    // Group evermarks by creator (owner)
    const creatorStats = new Map<string, {
      address: string;
      evermarksCount: number;
      verifiedCount: number;
      totalViews: number;
      totalVotes: number;
      firstEvermark: Date;
      lastEvermark: Date;
      contentTypes: Set<string>;
    }>();
    
    filteredEvermarks.forEach(evermark => {
      const creator = evermark.owner || evermark.creator || 'Unknown';
      const existing = creatorStats.get(creator);
      const createdAt = new Date(evermark.createdAt);
      
      if (existing) {
        existing.evermarksCount++;
        if (evermark.verificationStatus === 'verified') existing.verifiedCount++;
        existing.totalViews += evermark.views || 0;
        existing.totalVotes += evermark.votes || 0;
        existing.contentTypes.add(evermark.contentType || 'Unknown');
        if (createdAt > existing.lastEvermark) existing.lastEvermark = createdAt;
        if (createdAt < existing.firstEvermark) existing.firstEvermark = createdAt;
      } else {
        creatorStats.set(creator, {
          address: creator,
          evermarksCount: 1,
          verifiedCount: evermark.verificationStatus === 'verified' ? 1 : 0,
          totalViews: evermark.views || 0,
          totalVotes: evermark.votes || 0,
          firstEvermark: createdAt,
          lastEvermark: createdAt,
          contentTypes: new Set([evermark.contentType || 'Unknown'])
        });
      }
    });
    
    // Convert to leaderboard entries and calculate scores
    const entries: LeaderboardEntry[] = Array.from(creatorStats.entries()).map(([address, stats]) => {
      // Calculate score: evermarks * 10 + verified * 50 + votes * 2 + activity bonus
      const activityBonus = Math.min(stats.contentTypes.size * 5, 25); // Max 25 bonus for diversity
      const consistencyBonus = stats.evermarksCount >= 5 ? 20 : 0; // Bonus for consistent creators
      
      const score = (
        stats.evermarksCount * 10 +
        stats.verifiedCount * 50 +
        stats.totalVotes * 2 +
        activityBonus +
        consistencyBonus
      );
      
      return {
        id: address,
        rank: 0, // Will be set after sorting
        address,
        displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
        score,
        evermarksCount: stats.evermarksCount,
        votes: stats.totalVotes,
        verifiedCount: stats.verifiedCount,
        season: 1, // Beta season
        lastActivity: stats.lastEvermark.toISOString(),
        // Additional fields
        totalViews: stats.totalViews,
        firstEvermarkDate: stats.firstEvermark.toISOString(),
        contentTypesCount: stats.contentTypes.size,
        isActive: (now.getTime() - stats.lastEvermark.getTime()) < (7 * 24 * 60 * 60 * 1000) // Active if created something in last week
      };
    });
    
    // Sort by score and assign ranks
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });
    
    return entries;
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
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredEntries = allEntries.filter(entry => 
        entry.displayName.toLowerCase().includes(searchLower) ||
        entry.address.toLowerCase().includes(searchLower)
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
  static async getLeaderboardStats(season?: number): Promise<LeaderboardStats> {
    return {
      totalEvermarks: 0,
      totalVotes: BigInt(0),
      activeVoters: 0,
      averageVotesPerEvermark: BigInt(0),
      topEvermarkVotes: BigInt(0),
      participationRate: 0,
      period: season?.toString() || '1'
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
   * Format vote count for display
   */
  static formatVoteCount(votes: bigint, decimals: number = 2): string {
    const votesNum = Number(votes);
    if (votesNum >= 1000000) {
      return `${(votesNum / 1000000).toFixed(decimals)}M`;
    } else if (votesNum >= 1000) {
      return `${(votesNum / 1000).toFixed(decimals)}K`;
    }
    return votesNum.toString();
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