// src/features/leaderboard/services/LeaderboardService.ts
// Offchain leaderboard service - calculates rankings from evermark data

import type { 
  LeaderboardEntry, 
  LeaderboardFeedResult, 
  LeaderboardStats,
  LeaderboardFeedOptions,
  LeaderboardFilters,
  LeaderboardPagination,
  RankingPeriod
} from '../types';

// Import Evermark types and voting services
import type { Evermark } from '../../evermarks/types';
import { VotingService } from '../../voting/services/VotingService';
import { VotingCacheService } from '../../voting/services/VotingCacheService';
import { LeaderboardSyncService } from './LeaderboardSyncService';
import { BlockchainLeaderboardService } from './BlockchainLeaderboardService';
import { FinalizationService } from './FinalizationService';

/**
 * Offchain Leaderboard Service
 * Calculates rankings from real evermark data with live voting data
 */
export class LeaderboardService {
  
  /**
   * Get votes and voter count for an evermark using Supabase cache
   */
  private static async getCachedVotingData(evermarkId: string, fallbackVotes: number = 0): Promise<{ votes: bigint; voterCount: number }> {
    try {
      // First try to get from Supabase cache
      const cachedData = await VotingCacheService.getCachedVotingData(evermarkId);
      
      // If we have cached data and it's not zeros, use it
      if (cachedData.votes > BigInt(0) || cachedData.voterCount > 0) {
        return cachedData;
      }
      
      // Check if cache is stale and needs refresh
      const isStale = await VotingCacheService.isCacheStale(evermarkId);
      
      if (isStale) {
        // Sync fresh data from blockchain to cache
        await VotingCacheService.syncEvermarkToCache(evermarkId);
        
        // Get the refreshed cached data
        const refreshedData = await VotingCacheService.getCachedVotingData(evermarkId);
        return refreshedData;
      }
      
      // Return cached data (even if zeros)
      return cachedData;
      
    } catch (error) {
      console.warn(`⚠️ Failed to get cached voting data for evermark ${evermarkId}:`, error);
      
      // Fallback to original values
      const fallbackBigInt = BigInt(fallbackVotes);
      return { 
        votes: fallbackBigInt, 
        voterCount: fallbackVotes > 0 ? 1 : 0 
      };
    }
  }
  
  /**
   * Calculate leaderboard entries from evermarks data - Top evermarks by votes
   * Uses cache first, then falls back to direct blockchain queries
   */
  static async calculateLeaderboard(
    evermarks: Evermark[],
    period: string = 'current'
  ): Promise<LeaderboardEntry[]> {
    
    // For season-based periods, check if it's a finalized season first
    if (period.startsWith('season-')) {
      const seasonNumber = parseInt(period.replace('season-', ''));
      
      // Check if this season is finalized and we have stored data
      const hasFinalized = await FinalizationService.hasStoredFinalization(seasonNumber);
      if (hasFinalized) {
        console.log(`📊 Using finalized leaderboard data for season ${seasonNumber}`);
        const finalizedEntries = await FinalizationService.getFinalizedLeaderboard(seasonNumber);
        
        // Enhance with evermark metadata
        return this.enhanceFinalizedEntries(finalizedEntries, evermarks);
      }
    }
    
    // For season-based periods, we'll use all evermarks but filter votes by season
    let filteredEvermarks = evermarks;
    let targetSeason: number | undefined;
    
    // Extract season number from period ID
    if (period.startsWith('season-')) {
      targetSeason = parseInt(period.replace('season-', ''));
    } else if (period === 'current') {
      // Use current season for live leaderboard
      const currentSeason = await VotingService.getCurrentSeason();
      targetSeason = currentSeason?.seasonNumber;
    }
    
    // Check if we should use blockchain directly (if cache is mostly empty)
    const evermarkIds = filteredEvermarks.map(em => em.id);
    const bulkVotingData = await VotingCacheService.getBulkVotingData(evermarkIds);
    
    // If cache has very little data or no significant votes, use blockchain service directly
    const cacheHitRate = bulkVotingData.size / Math.max(evermarkIds.length, 1);
    const hasSignificantVotes = Array.from(bulkVotingData.values()).some(data => data.votes > BigInt(0));
    
    // Use blockchain service if cache is empty OR has no real voting data
    if (cacheHitRate < 0.8 || !hasSignificantVotes) {
      console.log(`🔗 Using blockchain leaderboard service (cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%, has votes: ${hasSignificantVotes})`);
      return await BlockchainLeaderboardService.calculateBlockchainLeaderboard(filteredEvermarks, targetSeason);
    }
    
    // Convert evermarks to leaderboard entries with blockchain fallback for individual items
    const entries: LeaderboardEntry[] = await Promise.all(
      filteredEvermarks.map(async (evermark) => {
      // Get voting data from bulk fetch result
      let votingData = bulkVotingData.get(evermark.id) || { votes: BigInt(evermark.votes ?? 0), voterCount: 0 };
      
      // If cache data is zero, try to get real blockchain data
      if (votingData.votes === BigInt(0) && votingData.voterCount === 0) {
        try {
          const blockchainData = await LeaderboardSyncService.getEvermarkRankingData(evermark.id);
          if (blockchainData.votes > BigInt(0)) {
            votingData = {
              votes: blockchainData.votes,
              voterCount: blockchainData.totalVoters || 1 // At least 1 if there are votes
            };
          }
        } catch (error) {
          console.warn(`Failed to get blockchain data for evermark ${evermark.id}:`, error);
        }
      }
      
      const { votes: realVotes, voterCount } = votingData;

      const creator = evermark.creator || evermark.author || 'Unknown';
      const createdAt = new Date(evermark.createdAt);
      
      // Calculate a simple score based on real vote amounts and verification
      const votesNumber = Number(realVotes / BigInt(10 ** 18)); // Convert wei to whole tokens for scoring
      const verificationBonus = evermark.verified ? 100 : 0;
      const freshnessBonus = Math.max(0, 30 - Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))); // Bonus for recent content
      const _score = votesNumber + verificationBonus + freshnessBonus;
      
      return {
        id: evermark.id,
        evermarkId: evermark.id,
        rank: 0, // Will be set after sorting
        totalVotes: realVotes, // wEMARK token amount in wei
        voteCount: voterCount, // Number of unique voters
        percentageOfTotal: 0, // Will be calculated after sorting
        title: evermark.title ?? 'Untitled',
        description: evermark.description ?? '',
        creator,
        createdAt: createdAt.toISOString(),
        sourceUrl: evermark.sourceUrl,
        image: evermark.image,
        contentType: (evermark.contentType as LeaderboardEntry['contentType']) ?? 'Custom',
        tags: evermark.tags ?? [],
        verified: evermark.verified,
        change: {
          direction: 'same' as const,
          positions: 0
        }
      };
    })
    );
    
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
   * Enhance finalized leaderboard entries with evermark metadata
   */
  private static enhanceFinalizedEntries(
    finalizedEntries: LeaderboardEntry[],
    evermarks: Evermark[]
  ): LeaderboardEntry[] {
    // Create lookup map for evermarks by ID
    const evermarkMap = new Map<string, Evermark>();
    evermarks.forEach(evermark => {
      evermarkMap.set(evermark.id, evermark);
    });
    
    // Enhance finalized entries with evermark data
    return finalizedEntries.map(entry => {
      const evermark = evermarkMap.get(entry.evermarkId);
      
      if (!evermark) {
        // If evermark not found, return as-is (may have been deleted)
        return entry;
      }
      
      return {
        ...entry,
        title: evermark.title ?? 'Untitled',
        description: evermark.description ?? '',
        creator: evermark.creator || evermark.author || 'Unknown',
        createdAt: new Date(evermark.createdAt).toISOString(),
        sourceUrl: evermark.sourceUrl,
        image: evermark.image,
        contentType: (evermark.contentType as LeaderboardEntry['contentType']) ?? 'Custom',
        tags: evermark.tags ?? [],
        verified: evermark.verified,
        change: {
          direction: 'same' as const, // Historical data shows no change
          positions: 0
        }
      };
    });
  }

  /**
   * Clear the vote cache (useful when votes have been cast)
   */
  static async clearVoteCache(): Promise<void> {
    await VotingCacheService.clearCache();
    console.log('🧹 Cleared leaderboard vote cache');
  }
  
  /**
   * Clear cache for a specific evermark (useful when a vote is cast for that evermark)
   */
  static async clearVoteCacheForEvermark(evermarkId: string): Promise<void> {
    await VotingCacheService.clearCache(evermarkId);
    console.log(`🧹 Cleared vote cache for evermark ${evermarkId}`);
  }

  
  /**
   * Get current cycle leaderboard with real data
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
    
    // Calculate leaderboard from evermarks with real voting data
    const period = filters.period ?? 'current';
    const allEntries = await this.calculateLeaderboard(evermarks, period);
    
    // Apply search filter if provided
    let filteredEntries = allEntries;
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      filteredEntries = allEntries.filter(entry => {
        const title = entry.title ?? '';
        const description = entry.description ?? '';
        const creator = entry.creator ?? '';
        const contentType = entry.contentType ?? '';
        
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
   * Get leaderboard stats for current cycle
   */
  static async fetchLeaderboardStats(period: string = 'current', evermarks?: Evermark[]): Promise<LeaderboardStats> {
    try {
      // For finalized seasons, use stored statistics for better performance
      if (period.startsWith('season-')) {
        const seasonNumber = parseInt(period.replace('season-', ''));
        const hasFinalized = await FinalizationService.hasStoredFinalization(seasonNumber);
        
        if (hasFinalized) {
          const finalizedStats = await FinalizationService.getFinalizedSeasonStats(seasonNumber);
          if (finalizedStats) {
            return {
              totalEvermarks: finalizedStats.totalEvermarks,
              totalVotes: finalizedStats.totalVotes,
              activeVoters: 0, // We don't track individual voters
              averageVotesPerEvermark: finalizedStats.averageVotes,
              topEvermarkVotes: finalizedStats.topEvermarkVotes,
              participationRate: 0, // Participation rate disabled
              period
            };
          }
        }
      }
      
      // If no evermarks provided, return empty stats
      if (!evermarks || evermarks.length === 0) {
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

      // Calculate leaderboard to get real voting data
      const leaderboardEntries = await this.calculateLeaderboard(evermarks, period);
      
      if (leaderboardEntries.length === 0) {
        return {
          totalEvermarks: evermarks.length,
          totalVotes: BigInt(0),
          activeVoters: 0,
          averageVotesPerEvermark: BigInt(0),
          topEvermarkVotes: BigInt(0),
          participationRate: 0,
          period
        };
      }

      // Calculate total votes from all entries
      const totalVotes = leaderboardEntries.reduce((sum, entry) => sum + entry.totalVotes, BigInt(0));
      
      // Get top evermark votes (highest single evermark)
      const topEvermarkVotes = leaderboardEntries[0]?.totalVotes || BigInt(0);
      
      // Calculate average votes per evermark
      const averageVotes = leaderboardEntries.length > 0 
        ? totalVotes / BigInt(leaderboardEntries.length)
        : BigInt(0);

      return {
        totalEvermarks: evermarks.length,
        totalVotes,
        activeVoters: 0, // We don't track individual voters efficiently
        averageVotesPerEvermark: averageVotes,
        topEvermarkVotes,
        participationRate: 0, // Participation rate removed as discussed
        period
      };
    } catch (error) {
      console.error('Failed to calculate leaderboard stats:', error);
      return {
        totalEvermarks: evermarks?.length || 0,
        totalVotes: BigInt(0),
        activeVoters: 0,
        averageVotesPerEvermark: BigInt(0),
        topEvermarkVotes: BigInt(0),
        participationRate: 0,
        period
      };
    }
  }
  
  /**
   * Get available periods for filtering
   */
  static async getAvailablePeriods(): Promise<RankingPeriod[]> {
    try {
      const currentSeason = await VotingService.getCurrentSeason();
      const periods: RankingPeriod[] = [];
      
      // Current active season
      if (currentSeason) {
        periods.push({
          id: 'current', 
          label: `Season ${currentSeason.seasonNumber}`,
          duration: Math.floor((currentSeason.endTime.getTime() - currentSeason.startTime.getTime()) / 1000), 
          description: currentSeason.isActive ? 'Active voting season' : 'Current season'
        });
      } else {
        periods.push({
          id: 'current', 
          label: 'Current Season',
          duration: 0, 
          description: 'Current voting season'
        });
      }
      
      // Get actually finalized seasons from database
      const finalizedSeasons = await FinalizationService.getAllFinalizedSeasons();
      finalizedSeasons.forEach(season => {
        periods.push({
          id: `season-${season.season_number}`,
          label: `Season ${season.season_number}`,
          duration: Math.floor((new Date(season.end_time).getTime() - new Date(season.start_time).getTime()) / 1000),
          description: `Finalized ${new Date(season.finalized_at).toLocaleDateString()}`
        });
      });
      
      return periods;
    } catch (error) {
      console.error('Failed to get available periods:', error);
      return [
        { id: 'current', label: 'Current Season', duration: 0, description: 'Current voting season' }
      ];
    }
  }
  
  /**
   * Get period by ID
   */
  static async getPeriodById(periodId: string): Promise<RankingPeriod> {
    const periods = await this.getAvailablePeriods();
    return periods.find(p => p.id === periodId) ?? periods[0];
  }
  
  /**
   * Get default filters
   */
  static getDefaultFilters(): LeaderboardFilters {
    return {
      period: 'current'
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
  static async getEvermarkRanking(_evermarkId: string, _cycle?: number): Promise<LeaderboardEntry | null> {
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
      currentPage: options.page ?? 1,
      pageSize: options.pageSize ?? 50,
      hasNextPage: false,
      hasPreviousPage: false,
      lastUpdated: new Date(),
      filters: options.filters ?? {}
    };
  }

  /**
   * Get trending evermarks (biggest gainers/losers)
   */
  static async getTrendingEvermarks(_period: string = 'day'): Promise<LeaderboardEntry[]> {
    return [];
  }

  /**
   * Get user's voting history and rankings
   */
  static async getUserVotingHistory(_userAddress: string, _cycle?: number): Promise<any[]> {
    return [];
  }

  /**
   * Refresh leaderboard data (trigger sync from blockchain)
   */
  static async refreshLeaderboard(_cycle?: number): Promise<void> {
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
   * Format vote amount for display - converts wei to readable wEMARK amounts
   */
  static formatVoteAmount(votes: bigint, useShortFormat = true): string {
    return VotingService.formatVoteAmount(votes, useShortFormat ? 6 : 18);
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