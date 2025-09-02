// src/features/leaderboard/services/BlockchainLeaderboardService.ts
// Direct blockchain leaderboard service - bypasses cache entirely

import { readContract } from 'thirdweb';
import { getEvermarkVotingContract } from '@/lib/contracts';
import { stakingLogger } from '@/utils/logger';
import type { LeaderboardEntry, LeaderboardFeedResult } from '../types';
import type { Evermark } from '../../evermarks/types';
import { VotingService } from '../../voting/services/VotingService';

/**
 * Blockchain Leaderboard Service
 * Fetches leaderboard data directly from blockchain contracts
 * Use this when cache is empty or unreliable
 */
export class BlockchainLeaderboardService {
  
  /**
   * Get voting data for multiple evermarks directly from blockchain
   */
  static async getBulkVotingDataFromBlockchain(evermarkIds: string[], targetSeason?: number): Promise<Map<string, {votes: bigint; voterCount: number}>> {
    try {
      const votingContract = getEvermarkVotingContract();
      const result = new Map<string, {votes: bigint; voterCount: number}>();
      
      stakingLogger.info('Fetching bulk voting data from blockchain', { 
        evermarkCount: evermarkIds.length,
        targetSeason
      });
      
      // Use provided season or get current season
      let seasonData: bigint;
      if (targetSeason) {
        seasonData = BigInt(targetSeason);
      } else {
        seasonData = await readContract({
          contract: votingContract,
          method: "function getCurrentSeason() view returns (uint256)",
          params: []
        }).catch(() => BigInt(1));
      }
      
      // Batch contract calls for better performance
      const votingPromises = evermarkIds.map(async (evermarkId) => {
        try {
          const votes = await readContract({
            contract: votingContract,
            method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
            params: [seasonData, BigInt(evermarkId)]
          }).catch(() => BigInt(0));
          
          // Voter count not available from contract - would require expensive event scanning
          const voterCount = 0; // Disabled - no efficient way to get this from contract
          
          return {
            evermarkId,
            votes: votes as bigint,
            voterCount
          };
        } catch (error) {
          stakingLogger.warn('Failed to get votes for evermark', { evermarkId, error });
          return {
            evermarkId,
            votes: BigInt(0),
            voterCount: 0
          };
        }
      });
      
      const votingResults = await Promise.all(votingPromises);
      
      // Build result map
      votingResults.forEach(({ evermarkId, votes, voterCount }) => {
        result.set(evermarkId, { votes, voterCount });
      });
      
      stakingLogger.info('Blockchain voting data fetched', {
        evermarksWithVotes: votingResults.filter(r => r.votes > BigInt(0)).length,
        totalEvermarks: evermarkIds.length
      });
      
      return result;
    } catch (error) {
      stakingLogger.error('Failed to get bulk voting data from blockchain', { error });
      return new Map();
    }
  }
  
  /**
   * Calculate leaderboard directly from blockchain data for a specific season
   */
  static async calculateBlockchainLeaderboard(
    evermarks: Evermark[], 
    targetSeason?: number
  ): Promise<LeaderboardEntry[]> {
    try {
      // Use all evermarks - season filtering happens at vote level
      const filteredEvermarks = evermarks;
      
      stakingLogger.info('Calculating blockchain leaderboard', {
        targetSeason,
        totalEvermarks: filteredEvermarks.length
      });
      
      // Get voting data directly from blockchain
      const evermarkIds = filteredEvermarks.map(em => em.id);
      const blockchainVotingData = await this.getBulkVotingDataFromBlockchain(evermarkIds, targetSeason);
      
      // Convert to leaderboard entries
      const entries: LeaderboardEntry[] = filteredEvermarks.map((evermark) => {
        const votingData = blockchainVotingData.get(evermark.id) || { 
          votes: BigInt(0), 
          voterCount: 0 
        };
        
        const creator = evermark.creator || evermark.author || 'Unknown';
        const createdAt = new Date(evermark.createdAt);
        
        // Calculate score based on votes and other factors
        const votesNumber = Number(votingData.votes / BigInt(10 ** 18));
        const verificationBonus = evermark.verified ? 100 : 0;
        const freshnessBonus = Math.max(0, 30 - Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));
        
        return {
          id: evermark.id,
          evermarkId: evermark.id,
          rank: 0, // Will be set after sorting
          totalVotes: votingData.votes,
          voteCount: votingData.voterCount,
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
      
      stakingLogger.info('Blockchain leaderboard calculated', {
        topEntries: top100.length,
        totalVotes,
        topVotes: top100[0]?.totalVotes.toString() || '0'
      });
      
      return top100;
    } catch (error) {
      stakingLogger.error('Failed to calculate blockchain leaderboard', { error });
      return [];
    }
  }
  
  /**
   * Get leaderboard with metadata for display
   */
  static async getBlockchainLeaderboard(
    evermarks: Evermark[],
    options: {
      period?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<LeaderboardFeedResult> {
    const { period = 'current', page = 1, pageSize = 50 } = options;
    
    try {
      // Convert period to season number
      let targetSeason: number | undefined;
      if (period.startsWith('season-')) {
        targetSeason = parseInt(period.replace('season-', ''));
      } else if (period === 'current') {
        // Will use current season in calculateBlockchainLeaderboard
        targetSeason = undefined;
      }
      
      const allEntries = await this.calculateBlockchainLeaderboard(evermarks, targetSeason);
      
      const totalCount = allEntries.length;
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const entries = allEntries.slice(startIndex, endIndex);
      
      return {
        entries,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
        pageSize,
        hasNextPage: page * pageSize < totalCount,
        hasPreviousPage: page > 1,
        lastUpdated: new Date(),
        filters: { period }
      };
    } catch (error) {
      stakingLogger.error('Failed to get blockchain leaderboard', { error });
      return {
        entries: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: false,
        lastUpdated: new Date(),
        filters: { period }
      };
    }
  }
}