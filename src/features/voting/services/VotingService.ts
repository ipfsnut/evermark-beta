// src/features/voting/services/VotingService.ts - Direct voting with seasons
import { formatUnits, parseUnits } from 'viem';
import { readContract, getContractEvents, estimateGas, getGasPrice, prepareEvent, prepareContractCall } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { getEvermarkVotingContract, getWEMARKContract } from '@/lib/contracts';

// Local constants to avoid @/lib/contracts dependency
const CHAIN = base;
import { 
  type Vote,
  type VotingSeason,
  type VotingPower,
  type VotingStats,
  type VotingValidation,
  type VotingError,
  type VotingErrorCode,
  type VotingTransaction,
  type EvermarkRanking,
  VOTING_CONSTANTS,
  VOTING_ERRORS
} from '../types';

export class VotingService {
  
  /**
   * Get current voting season information
   */
  static async getCurrentSeason(): Promise<VotingSeason | null> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      const currentSeason = await readContract({
        contract: votingContract,
        method: "function getCurrentSeason() view returns (uint256)",
        params: []
      });
      
      const seasonInfo = await readContract({
        contract: votingContract,
        method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
        params: [currentSeason]
      }).catch(() => null);

      if (!seasonInfo) {
        return null;
      }

      const [startTime, endTime, active, totalVotes] = seasonInfo as [bigint, bigint, boolean, bigint];

      return {
        seasonNumber: Number(currentSeason),
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        totalVotes,
        totalVoters: 0, // Will be calculated from events if needed
        isActive: active,
        activeEvermarksCount: 0 // Will be calculated if needed
      };
    } catch (error) {
      console.error('Failed to get current season:', error);
      return null;
    }
  }

  /**
   * Get user's voting power (wEMARK balance)
   */
  static async getVotingPower(userAddress: string): Promise<VotingPower | null> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      const [totalPower, remainingPower] = await Promise.all([
        readContract({
          contract: votingContract,
          method: "function getVotingPower(address user) view returns (uint256)",
          params: [userAddress]
        }),
        readContract({
          contract: votingContract,
          method: "function getRemainingVotingPower(address user) view returns (uint256)",
          params: [userAddress]
        })
      ]);

      const total = totalPower as bigint;
      const remaining = remainingPower as bigint;
      const used = total - remaining;

      return {
        total,
        available: remaining,
        used,
        remaining
      };
    } catch (error) {
      console.error('Failed to get voting power:', error);
      return null;
    }
  }

  /**
   * Vote for an evermark with specified amount
   */
  static async voteForEvermark(
    userAddress: string,
    evermarkId: string,
    votes: bigint
  ): Promise<VotingTransaction> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Validate inputs
      const validation = this.validateVoteAmount(votes.toString(), evermarkId, userAddress);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Prepare the contract call
      const transaction = prepareContractCall({
        contract: votingContract,
        method: "function voteForEvermark(uint256 evermarkId, uint256 votes) payable",
        params: [BigInt(evermarkId), votes]
      });

      // Return transaction info
      return {
        hash: '', // Will be set after transaction is sent
        type: 'vote',
        evermarkId,
        amount: votes,
        timestamp: new Date(),
        status: 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to prepare vote transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get votes for a specific evermark in current season
   */
  static async getEvermarkVotes(evermarkId: string, season?: number): Promise<bigint> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get current season if not specified
      let targetSeason = season;
      if (!targetSeason) {
        const currentSeasonData = await this.getCurrentSeason();
        if (!currentSeasonData) return BigInt(0);
        targetSeason = currentSeasonData.seasonNumber;
      }

      const votes = await readContract({
        contract: votingContract,
        method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
        params: [BigInt(targetSeason), BigInt(evermarkId)]
      });

      return votes as bigint;
    } catch (error) {
      console.error('Failed to get evermark votes:', error);
      return BigInt(0);
    }
  }

  /**
   * Get user's votes for a specific evermark in current season
   */
  static async getUserVotesForEvermark(userAddress: string, evermarkId: string, season?: number): Promise<bigint> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get current season if not specified
      let targetSeason = season;
      if (!targetSeason) {
        const currentSeasonData = await this.getCurrentSeason();
        if (!currentSeasonData) return BigInt(0);
        targetSeason = currentSeasonData.seasonNumber;
      }

      const votes = await readContract({
        contract: votingContract,
        method: "function getUserVotesForEvermark(address user, uint256 season, uint256 evermarkId) view returns (uint256)",
        params: [userAddress, BigInt(targetSeason), BigInt(evermarkId)]
      });

      return votes as bigint;
    } catch (error) {
      console.error('Failed to get user votes for evermark:', error);
      return BigInt(0);
    }
  }

  /**
   * Fetch voting history from contract events
   */
  static async fetchVotingHistory(
    userAddress: string,
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<Vote[]> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Prepare event definition for VoteCast
      const voteCastEvent = prepareEvent({
        signature: "event VoteCast(address indexed user, uint256 indexed evermarkId, uint256 indexed season, uint256 votes)"
      });

      const events = await getContractEvents({
        contract: votingContract,
        events: [voteCastEvent],
        fromBlock: fromBlock || 0n,
        toBlock: toBlock || 'latest'
      });

      return events
        .filter(event => event.args.user === userAddress)
        .map((event, index) => ({
          id: `${event.transactionHash}-${index}`,
          userAddress,
          evermarkId: event.args.evermarkId?.toString() || '',
          amount: event.args.votes || BigInt(0),
          season: Number(event.args.season) || 0,
          timestamp: new Date(), // Use current time for now
          transactionHash: event.transactionHash,
          status: 'confirmed' as const,
          type: 'vote' as const
        }));
    } catch (error) {
      console.error('Failed to fetch voting history:', error);
      return [];
    }
  }

  /**
   * Validate vote amount and eligibility
   */
  static validateVoteAmount(
    amount: string,
    evermarkId?: string,
    userAddress?: string
  ): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const voteAmount = parseUnits(amount, 18);

      // Check minimum amount
      if (voteAmount < VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
        errors.push(`Minimum vote amount is ${formatUnits(VOTING_CONSTANTS.MIN_VOTE_AMOUNT, 18)} wEMARK`);
      }

      // Check maximum amount
      if (voteAmount > VOTING_CONSTANTS.MAX_VOTE_AMOUNT) {
        errors.push(`Maximum vote amount is ${formatUnits(VOTING_CONSTANTS.MAX_VOTE_AMOUNT, 18)} wEMARK`);
      }

      // Check if amount is zero
      if (voteAmount === BigInt(0)) {
        errors.push('Vote amount must be greater than 0');
      }

    } catch (error) {
      errors.push('Invalid vote amount format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate time remaining in current season
   */
  static async getTimeRemainingInSeason(): Promise<number> {
    try {
      const currentSeason = await this.getCurrentSeason();
      if (!currentSeason || !currentSeason.isActive) {
        return 0;
      }

      const now = Date.now();
      const endTime = currentSeason.endTime.getTime();
      
      return Math.max(0, endTime - now);
    } catch (error) {
      console.error('Failed to get time remaining in season:', error);
      return 0;
    }
  }

  /**
   * Format vote amount for display
   */
  static formatVoteAmount(amount: bigint, decimals: number = 2): string {
    return parseFloat(formatUnits(amount, 18)).toFixed(decimals);
  }

  /**
   * Get voting statistics for current season
   */
  static async getVotingStats(userAddress?: string): Promise<VotingStats | null> {
    try {
      const currentSeason = await this.getCurrentSeason();
      if (!currentSeason) {
        return null;
      }

      // This would typically aggregate data from events or database
      // For now, return basic structure
      return {
        totalVotesCast: currentSeason.totalVotes,
        activeEvermarks: currentSeason.activeEvermarksCount,
        averageVotesPerEvermark: currentSeason.activeEvermarksCount > 0 
          ? currentSeason.totalVotes / BigInt(currentSeason.activeEvermarksCount)
          : BigInt(0),
        topEvermarkVotes: BigInt(0), // Would need to query top evermark
        userRanking: 0, // Would need to calculate user's ranking
        participationRate: 0 // Would need to calculate from total users
      };
    } catch (error) {
      console.error('Failed to get voting stats:', error);
      return null;
    }
  }

  /**
   * Admin function to start new season
   */
  static async startNewSeason(adminAddress: string): Promise<VotingTransaction> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      const transaction = prepareContractCall({
        contract: votingContract,
        method: "function startNewSeason() payable",
        params: []
      });

      return {
        hash: '',
        type: 'vote', // Using vote type for simplicity
        evermarkId: '0',
        amount: BigInt(0),
        timestamp: new Date(),
        status: 'pending'
      };
    } catch (error) {
      throw new Error(`Failed to prepare start season transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}