// src/features/leaderboard/services/LeaderboardService.ts
// Real blockchain integration using viem and your contract

import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains'; // Assuming you're on Base - adjust as needed
import { 
  LeaderboardEntry, 
  LeaderboardFeedResult, 
  LeaderboardStats,
  LeaderboardFeedOptions,
  LeaderboardFilters,
  RankingPeriod
} from '../types';

// Your actual contract configuration
const LEADERBOARD_CONTRACT = {
  address: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
  abi: [
    {
      "inputs": [
        {"internalType": "uint256", "name": "cycle", "type": "uint256"},
        {"internalType": "uint256", "name": "startRank", "type": "uint256"},
        {"internalType": "uint256", "name": "count", "type": "uint256"}
      ],
      "name": "getLeaderboard",
      "outputs": [
        {
          "components": [
            {"internalType": "uint256", "name": "evermarkId", "type": "uint256"},
            {"internalType": "uint256", "name": "votes", "type": "uint256"},
            {"internalType": "address", "name": "creator", "type": "address"}
          ],
          "internalType": "struct LiveLeaderboard.LeaderboardEntry[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "cycle", "type": "uint256"}],
      "name": "getCycleStats",
      "outputs": [
        {"internalType": "uint256", "name": "totalUpdates", "type": "uint256"},
        {"internalType": "uint256", "name": "leaderboardSize", "type": "uint256"},
        {"internalType": "uint256", "name": "lastUpdate", "type": "uint256"},
        {"internalType": "bool", "name": "initialized", "type": "bool"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "cycle", "type": "uint256"}],
      "name": "getLeaderboardSize",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ] as const
};

// Public client for reading contract data
const publicClient = createPublicClient({
  chain: base, // Adjust to your chain
  transport: http()
});

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
      // Call the actual contract
      const [leaderboardData, cycleStats] = await Promise.all([
        publicClient.readContract({
          address: LEADERBOARD_CONTRACT.address,
          abi: LEADERBOARD_CONTRACT.abi,
          functionName: 'getLeaderboard',
          args: [BigInt(cycle), BigInt(startRank), BigInt(pageSize)]
        }),
        publicClient.readContract({
          address: LEADERBOARD_CONTRACT.address,
          abi: LEADERBOARD_CONTRACT.abi,
          functionName: 'getCycleStats',
          args: [BigInt(cycle)]
        })
      ]);

      // Transform contract data to our format
      const entries: LeaderboardEntry[] = (leaderboardData as any[]).map((entry, index) => ({
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
      }));

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

    } catch (error) {
      console.error('Failed to fetch leaderboard from contract:', error);
      
      // Return empty result on error
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
      const stats = await publicClient.readContract({
        address: LEADERBOARD_CONTRACT.address,
        abi: LEADERBOARD_CONTRACT.abi,
        functionName: 'getCycleStats',
        args: [BigInt(cycle)]
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
      // Try to read basic contract info
      await publicClient.readContract({
        address: LEADERBOARD_CONTRACT.address,
        abi: LEADERBOARD_CONTRACT.abi,
        functionName: 'getCycleStats',
        args: [BigInt(1)]
      });
      return true;
    } catch (error) {
      console.error('Contract health check failed:', error);
      return false;
    }
  }
}