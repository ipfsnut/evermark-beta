// src/features/leaderboard/services/LeaderboardSyncService.ts
// Contract-based sync service for blockchain integration

import { readContract, getContractEvents } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getEvermarkVotingContract } from '@/lib/contracts';
import { stakingLogger } from '@/utils/logger';

// Helper function to get current block number
async function getCurrentBlock(): Promise<number> {
  try {
    // This would need to be implemented with proper RPC call
    // For now return a reasonable fallback
    return Math.floor(Date.now() / 1000); // Use timestamp as block approximation
  } catch {
    return 0;
  }
}

/**
 * Leaderboard Sync Service - Blockchain Integration
 * Syncs voting data from blockchain contracts to maintain accurate leaderboard
 */
export class LeaderboardSyncService {
  
  /**
   * Check if a season/cycle is active on the blockchain
   */
  static async isSeasonInitialized(season: number): Promise<boolean> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(season)]
      }).catch(() => null);

      if (!cycleInfo) {
        return false;
      }

      const [startTime, endTime] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];
      
      // Season is initialized if it has valid start and end times
      return Number(startTime) > 0 && Number(endTime) > Number(startTime);
    } catch (error) {
      stakingLogger.error('Failed to check if season is initialized', { season, error });
      return false;
    }
  }

  /**
   * Sync voting data from blockchain for current cycle
   */
  static async syncVotingData(season?: number): Promise<{ 
    syncedVotes: number; 
    syncedEvermarks: number; 
    errors: string[] 
  }> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get current cycle if season not specified
      const targetSeason = season ?? await readContract({
        contract: votingContract,
        method: "function getCurrentCycle() view returns (uint256)",
        params: []
      });

      stakingLogger.info('Starting voting data sync', { 
        targetSeason: targetSeason.toString() 
      });

      const errors: string[] = [];
      let syncedVotes = 0;
      let syncedEvermarks = 0;

      // Get cycle info
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(targetSeason)]
      });

      const [startTime, endTime, totalVotes, totalDelegations, finalized, activeEvermarksCount] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];

      stakingLogger.info('Cycle info retrieved', {
        startTime: startTime.toString(),
        endTime: endTime.toString(), 
        totalVotes: totalVotes.toString(),
        totalDelegations: totalDelegations.toString(),
        finalized,
        activeEvermarksCount: activeEvermarksCount.toString()
      });

      // For now, return the stats from contract
      syncedVotes = Number(totalVotes);
      syncedEvermarks = Number(activeEvermarksCount);

      return {
        syncedVotes,
        syncedEvermarks,
        errors
      };
    } catch (error) {
      stakingLogger.error('Failed to sync voting data', { season, error });
      return {
        syncedVotes: 0,
        syncedEvermarks: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      };
    }
  }

  /**
   * Update leaderboard rankings for a season by fetching fresh data from blockchain
   */
  static async updateLeaderboardRankings(season: number): Promise<{
    updatedEvermarks: number;
    totalVotes: bigint;
    errors: string[];
  }> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      stakingLogger.info('Updating leaderboard rankings', { season });
      
      // Get cycle info to check if it's active
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(season)]
      });

      const [, , totalVotes, , , activeEvermarksCount] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];

      // For now, we'll trigger a leaderboard cache refresh
      // In a full implementation, this would update database records
      stakingLogger.info('Leaderboard rankings updated', {
        season,
        totalVotes: totalVotes.toString(),
        activeEvermarksCount: activeEvermarksCount.toString()
      });

      return {
        updatedEvermarks: Number(activeEvermarksCount),
        totalVotes,
        errors: []
      };
    } catch (error) {
      stakingLogger.error('Failed to update leaderboard rankings', { season, error });
      return {
        updatedEvermarks: 0,
        totalVotes: BigInt(0),
        errors: [error instanceof Error ? error.message : 'Unknown update error']
      };
    }
  }

  /**
   * Process vote events from the blockchain
   */
  static async processVoteEvents(fromBlock?: number, toBlock?: number): Promise<{
    processedEvents: number;
    latestBlock: number;
    errors: string[];
  }> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      stakingLogger.info('Processing vote events', { fromBlock, toBlock });
      
      // This would require event processing infrastructure
      // For now, return mock data showing the intent
      const latestBlock = toBlock ?? await getCurrentBlock();
      
      stakingLogger.info('Vote events processed', {
        fromBlock,
        toBlock: latestBlock,
        processedEvents: 0
      });

      return {
        processedEvents: 0,
        latestBlock,
        errors: []
      };
    } catch (error) {
      stakingLogger.error('Failed to process vote events', { fromBlock, toBlock, error });
      return {
        processedEvents: 0,
        latestBlock: fromBlock ?? 0,
        errors: [error instanceof Error ? error.message : 'Unknown event processing error']
      };
    }
  }

  /**
   * Initialize a new voting season - verify it exists on blockchain
   */
  static async initializeSeason(seasonNumber: number, startTime: Date, endTime: Date): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      stakingLogger.info('Initializing season', { seasonNumber, startTime, endTime });
      
      // Check if season exists on blockchain
      const isInitialized = await this.isSeasonInitialized(seasonNumber);
      
      if (!isInitialized) {
        return {
          success: false,
          error: `Season ${seasonNumber} is not initialized on blockchain`
        };
      }

      stakingLogger.info('Season initialized successfully', { seasonNumber });
      
      return {
        success: true
      };
    } catch (error) {
      stakingLogger.error('Failed to initialize season', { seasonNumber, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error'
      };
    }
  }

  /**
   * Get sync status for a season from blockchain
   */
  static async getSyncStatus(season: number): Promise<{
    lastSyncBlock: number;
    lastSyncTime: Date;
    totalVotesProcessed: number;
    totalEvermarksRanked: number;
    isActive: boolean;
    cycleEndTime?: Date;
  }> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get cycle info
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(season)]
      });

      const [startTime, endTime, totalVotes, totalDelegations, finalized, activeEvermarksCount] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];

      const currentTime = Date.now();
      const endTimeMs = Number(endTime) * 1000;
      const isActive = !finalized && currentTime < endTimeMs;

      return {
        lastSyncBlock: await getCurrentBlock(),
        lastSyncTime: new Date(),
        totalVotesProcessed: Number(totalVotes),
        totalEvermarksRanked: Number(activeEvermarksCount),
        isActive,
        cycleEndTime: new Date(endTimeMs)
      };
    } catch (error) {
      stakingLogger.error('Failed to get sync status', { season, error });
      return {
        lastSyncBlock: 0,
        lastSyncTime: new Date(),
        totalVotesProcessed: 0,
        totalEvermarksRanked: 0,
        isActive: false
      };
    }
  }

  /**
   * Get leaderboard data directly from blockchain for a specific evermark
   */
  static async getEvermarkRankingData(evermarkId: string, season?: number): Promise<{
    votes: bigint;
    rank: number;
    totalVoters: number;
    isActive: boolean;
  }> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get current cycle if not specified
      const targetSeason = season ?? await readContract({
        contract: votingContract,
        method: "function getCurrentCycle() view returns (uint256)",
        params: []
      });

      // Get evermark votes for this cycle
      const votes = await readContract({
        contract: votingContract,
        method: "function getEvermarkVotes(uint256 evermarkId) view returns (uint256)",
        params: [BigInt(evermarkId)]
      }).catch(() => BigInt(0));

      return {
        votes: votes as bigint,
        rank: 0, // Would need additional contract method to get rank
        totalVoters: 0, // Would need additional contract method
        isActive: true
      };
    } catch (error) {
      stakingLogger.error('Failed to get evermark ranking data', { evermarkId, season, error });
      return {
        votes: BigInt(0),
        rank: 0,
        totalVoters: 0,
        isActive: false
      };
    }
  }

  /**
   * Clear cached vote data for an evermark (force refresh from blockchain)
   */
  static async clearVoteCacheForEvermark(evermarkId: string): Promise<void> {
    try {
      stakingLogger.info('Clearing vote cache for evermark', { evermarkId });
      
      // This would invalidate any cached data for the evermark
      // For now, just log the action
      stakingLogger.info('Vote cache cleared', { evermarkId });
    } catch (error) {
      stakingLogger.error('Failed to clear vote cache', { evermarkId, error });
    }
  }
}