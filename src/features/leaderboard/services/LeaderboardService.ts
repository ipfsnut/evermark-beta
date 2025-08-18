// src/features/leaderboard/services/LeaderboardService.ts
// Real blockchain integration using Thirdweb SDK

import { readContract } from 'thirdweb';
import { formatUnits } from 'viem';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { 
  LeaderboardEntry, 
  LeaderboardFeedResult, 
  LeaderboardStats,
  LeaderboardFeedOptions,
  LeaderboardFilters,
  RankingPeriod
} from '../types';

// Import the real ABI
import EvermarkLeaderboardABI from '../abis/EvermarkLeaderboard.json';
import { LeaderboardSyncService } from './LeaderboardSyncService';

// Your actual contract configuration
const LEADERBOARD_CONTRACT = {
  address: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
  abi: EvermarkLeaderboardABI
};

// Use Thirdweb client and Base chain
const CHAIN = base;

/**
 * LeaderboardService - Real blockchain integration
 */
export class LeaderboardService {
  
  /**
   * Fetch leaderboard data from the actual contract
   */
  static async fetchLeaderboard(options: LeaderboardFeedOptions): Promise<LeaderboardFeedResult> {
    const { 
      page = 1, 
      pageSize = 20, 
      filters 
    } = options;
    
    // Get current cycle from period filter or default to 1
    const cycle = filters?.period ? parseInt(filters.period) : 1;
    const startRank = (page - 1) * pageSize + 1;
    
    try {
      // Check if contract address is valid
      if (!LEADERBOARD_CONTRACT.address || LEADERBOARD_CONTRACT.address === '') {
        console.error('❌ No leaderboard contract address configured');
        throw new Error('Leaderboard contract address not configured');
      }

      console.log('🔍 Fetching leaderboard data:', {
        contractAddress: LEADERBOARD_CONTRACT.address,
        cycle,
        startRank,
        pageSize
      });

      // Let's also check if any cycles are initialized at all
      try {
        const cycleInitCheck = await readContract({
          contract: {
            client,
            chain: CHAIN,
            address: LEADERBOARD_CONTRACT.address,
            abi: LEADERBOARD_CONTRACT.abi
          },
          method: "cycleInitialized",
          params: [BigInt(0)]
        });
        console.log('🔍 Cycle 0 initialized status:', cycleInitCheck);
      } catch (error) {
        console.log('❌ Could not check cycle initialization:', error);
      }

      // Create contract instance first
      const leaderboardContract = {
        client,
        chain: CHAIN,
        address: LEADERBOARD_CONTRACT.address,
        abi: LEADERBOARD_CONTRACT.abi
      };

      // Call the actual contract using Thirdweb
      const [leaderboardData, cycleStats] = await Promise.all([
        readContract({
          contract: leaderboardContract,
          method: "getLeaderboard",
          params: [BigInt(cycle), BigInt(startRank), BigInt(pageSize)]
        }),
        readContract({
          contract: leaderboardContract,
          method: "getCycleStats", 
          params: [BigInt(cycle)]
        })
      ]);

      console.log('✅ Contract data received:', {
        leaderboardData: leaderboardData,
        cycleStats: cycleStats,
        leaderboardLength: Array.isArray(leaderboardData) ? leaderboardData.length : 'not array'
      });

      // Log detailed cycle stats to understand the state
      if (Array.isArray(cycleStats) && cycleStats.length === 4) {
        const [totalUpdates, leaderboardSize, lastUpdate, initialized] = cycleStats;
        console.log('📊 Cycle Stats for cycle', cycle, ':', {
          totalUpdates: totalUpdates.toString(),
          leaderboardSize: leaderboardSize.toString(),
          lastUpdate: lastUpdate.toString(),
          initialized: initialized,
          rawCycleStats: cycleStats
        });

        // If cycle is not initialized, try cycle 0 or suggest checking different cycles
        if (!initialized && cycle === 1) {
          console.log('⚠️ Cycle 1 is not initialized, trying cycle 0...');
          
          try {
            const cycle0Data = await readContract({
              contract: leaderboardContract,
              method: "getLeaderboard",
              params: [BigInt(0), BigInt(startRank), BigInt(pageSize)]
            });
            
            console.log('🔍 Cycle 0 leaderboard data:', cycle0Data);
            
            if (Array.isArray(cycle0Data) && cycle0Data.length > 0) {
              console.log('✅ Found data in cycle 0! Using that instead.');
              // Use cycle 0 data instead
              return this.processLeaderboardData(cycle0Data, cycleStats, 0, page, pageSize, startRank, filters);
            }
          } catch (error) {
            console.log('❌ Cycle 0 also failed:', error);
          }
        }
      }

      // If no data found, provide diagnostic information
      if (Array.isArray(leaderboardData) && leaderboardData.length === 0) {
        console.log('📊 No leaderboard data found - running diagnostics...');
        this.runDiagnostics();
      }

      // Process the data regardless of which cycle we end up using
      return this.processLeaderboardData(leaderboardData, cycleStats, cycle, page, pageSize, startRank, filters);

    } catch (error) {
      console.error('❌ Failed to fetch leaderboard from contract:', error);
      console.error('Contract address:', LEADERBOARD_CONTRACT.address);
      console.error('Cycle:', cycle, 'StartRank:', startRank, 'PageSize:', pageSize);
      
      // Return empty result on error - we need to fix the contract issue
      return {
        entries: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: false,
        lastUpdated: new Date(),
        filters: filters || {}
      };
    }
  }

  /**
   * Fetch cycle statistics from contract
   */
  static async fetchLeaderboardStats(period: string): Promise<LeaderboardStats> {
    const cycle = parseInt(period) || 1;
    
    try {
      const leaderboardContract = {
        client,
        chain: CHAIN,
        address: LEADERBOARD_CONTRACT.address,
        abi: LEADERBOARD_CONTRACT.abi
      };

      const stats = await readContract({
        contract: leaderboardContract,
        method: "getCycleStats",
        params: [BigInt(cycle)]
      });

      return {
        totalEvermarks: Number(stats[1]), // leaderboardSize
        totalVotes: BigInt(0), // Would need to calculate from all entries
        activeVoters: Number(stats[0]), // totalUpdates as proxy
        participationRate: 0.5, // Would need to calculate
        averageVotesPerEvermark: BigInt(0), // Would need to calculate
        topEvermarkVotes: BigInt(0), // Would need to fetch top entry
        period: period
      };
    } catch (error) {
      console.error('Failed to fetch cycle stats:', error);
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
   * Format vote amounts for display
   */
  static formatVoteAmount(amount: bigint): string {
    if (amount === BigInt(0)) return '0';
    
    const formatted = formatUnits(amount, 18);
    const number = parseFloat(formatted);
    
    if (number < 0.0001) return '< 0.0001';
    if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  /**
   * Get available periods (cycles) - updated to match your types
   */
  static getAvailablePeriods(): RankingPeriod[] {
    return [
      { id: '1', label: 'Cycle 1', duration: 0, description: 'First voting cycle' },
      { id: '2', label: 'Cycle 2', duration: 0, description: 'Second voting cycle' },
      { id: '3', label: 'Cycle 3', duration: 0, description: 'Third voting cycle' },
    ];
  }

  /**
   * Get period by ID - always returns a valid period
   */
  static getPeriodById(periodId: string): RankingPeriod {
    const periods = this.getAvailablePeriods();
    const period = periods.find(p => p.id === periodId);
    
    if (!period) {
      console.warn(`Period ${periodId} not found, falling back to default`);
      return periods[0]; // Return first period as fallback
    }
    
    return period;
  }

  /**
   * Default filters - only include defined properties
   */
  static getDefaultFilters(): LeaderboardFilters {
    return {
      period: '1'
    };
  }

  /**
   * Default pagination - always provides required fields
   */
  static getDefaultPagination() {
    return {
      page: 1,
      pageSize: 20,
      sortBy: 'rank' as const,
      sortOrder: 'asc' as const
    };
  }

  /**
   * Check if contract is deployed and accessible
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const leaderboardContract = {
        client,
        chain: CHAIN,
        address: LEADERBOARD_CONTRACT.address,
        abi: LEADERBOARD_CONTRACT.abi
      };

      // Try to read basic contract info
      await readContract({
        contract: leaderboardContract,
        method: "getCycleStats",
        params: [BigInt(1)]
      });
      return true;
    } catch (error) {
      console.error('Contract health check failed:', error);
      return false;
    }
  }


  /**
   * Run diagnostics to understand why leaderboard is empty
   */
  static async runDiagnostics(): Promise<void> {
    try {
      console.log('🔍 Running leaderboard diagnostics...');
      
      const status = await LeaderboardSyncService.getLeaderboardStatus();
      
      console.log('📊 Leaderboard Status Report:');
      console.log(`   Current Cycle: ${status.currentCycle}`);
      console.log(`   Cycle Initialized: ${status.cycleInitialized}`);
      console.log(`   Has Voting Data: ${status.hasVotingData}`);
      
      if (status.suggestions.length > 0) {
        console.log('💡 Suggestions to populate leaderboard:');
        status.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
      
      console.log('🎯 Quick Start Guide:');
      console.log('   → Visit the Staking page to stake EMARK tokens');
      console.log('   → Use voting power to delegate votes to evermarks');
      console.log('   → Leaderboard will populate with voting results');
      
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
    }
  }

  /**
   * Process leaderboard data from contract into our format
   */
  static processLeaderboardData(
    leaderboardData: any,
    cycleStats: any,
    cycle: number,
    page: number,
    pageSize: number,
    startRank: number,
    filters?: any
  ): LeaderboardFeedResult {
    // Check if we have valid leaderboard data
    if (!Array.isArray(leaderboardData)) {
      console.warn('⚠️ Leaderboard data is not an array:', leaderboardData);
      return {
        entries: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page,
        pageSize,
        hasNextPage: false,
        hasPreviousPage: false,
        lastUpdated: new Date(),
        filters: filters || {}
      };
    }

    console.log('📊 Processing', leaderboardData.length, 'leaderboard entries from cycle', cycle);

    // Transform contract data to our format
    const entries: LeaderboardEntry[] = (leaderboardData as any[]).map((entry, index) => {
      console.log(`🔍 Processing entry ${index + 1}:`, entry);
      return {
        id: `${cycle}-${entry.evermarkId}`,
        evermarkId: entry.evermarkId.toString(),
        rank: startRank + index,
        totalVotes: entry.votes,
        voteCount: 1, // We don't have this from contract, would need separate call
        percentageOfTotal: 0, // Calculate if needed
        title: `Evermark #${entry.evermarkId}`, // Would need to fetch from metadata
        description: '', // Would need to fetch from metadata
        creator: entry.creator,
        createdAt: new Date().toISOString(), // Would need to fetch from contract events
        contentType: 'Custom' as const,
        tags: [],
        verified: false, // Would need verification logic
        change: { direction: 'same' as const, positions: 0 } // RankingChange type - would need previous data to calculate
      };
    });

    const totalCount = Number(cycleStats[1]); // leaderboardSize
    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      entries,
      totalCount,
      totalPages,
      currentPage: page,
      pageSize,
      hasNextPage: page * pageSize < totalCount,
      hasPreviousPage: page > 1,
      lastUpdated: new Date(),
      filters: filters || {}
    };
  }
}