// src/features/voting/services/VotingService.ts - Direct voting with seasons
import { formatUnits, parseUnits } from 'viem';
import { readContract, getContractEvents, estimateGas, getGasPrice, prepareEvent, prepareContractCall } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { getEvermarkVotingContract, getWEMARKContract } from '@/lib/contracts';
import { NotificationService } from '../../../services/NotificationService';

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

      // Trigger notification for the vote (simulate for now)
      // In a real implementation, this would be called after successful transaction
      setTimeout(() => {
        NotificationService.onVoteCast({
          evermarkId,
          voterAddress: userAddress,
          voteAmount: votes
        });
      }, 1000);

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
   * Parse vote amount from string to wei
   */
  static parseVoteAmount(amount: string): bigint {
    try {
      if (!amount || amount.trim() === '') {
        return BigInt(0);
      }
      
      // Clean the input
      const cleanAmount = amount.trim().replace(/,/g, '');
      
      // Validate format
      if (!/^\d*\.?\d*$/.test(cleanAmount)) {
        throw new Error('Invalid number format');
      }
      
      return parseUnits(cleanAmount, 18);
    } catch (error) {
      console.error('Error parsing vote amount:', error);
      throw new Error('Invalid amount format');
    }
  }

  /**
   * Format vote amount for display (whole numbers only)
   */
  static formatVoteAmount(amount: bigint, decimals?: number): string {
    const useShortFormat = decimals !== 18;
    try {
      if (amount === BigInt(0)) return '0';
      
      const formatted = formatUnits(amount, 18);
      const number = Math.floor(parseFloat(formatted)); // Always whole numbers
      
      if (useShortFormat) {
        // Use short format for large numbers to prevent overflow
        if (number >= 1000000000) {
          return `${(number / 1000000000).toFixed(1)}B`;
        } else if (number >= 1000000) {
          return `${(number / 1000000).toFixed(1)}M`;
        } else if (number >= 1000) {
          return `${(number / 1000).toFixed(1)}K`;
        }
      }
      
      // Return whole number with commas for readability
      return number.toLocaleString('en-US');
    } catch (error) {
      console.error('Error formatting vote amount:', error);
      return '0';
    }
  }

  /**
   * Validate undelegate amount
   */
  static validateUndelegateAmount(
    amount: string,
    currentDelegatedAmount: bigint
  ): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const undelegateAmount = this.parseVoteAmount(amount);

      // Check if amount is greater than 0
      if (undelegateAmount === BigInt(0)) {
        errors.push('Amount must be greater than 0');
      }

      // Check if amount is greater than currently delegated
      if (undelegateAmount > currentDelegatedAmount) {
        errors.push('Cannot undelegate more than currently delegated');
      }

    } catch (error) {
      errors.push('Invalid amount format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
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

  /**
   * Format time remaining for display
   */
  static formatTimeRemaining(milliseconds: number): string {
    if (milliseconds <= 0) return 'Ended';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get user-friendly error message from error object
   */
  static getUserFriendlyError(error: any): string {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('insufficient')) {
        return 'Insufficient voting power for this action';
      }
      if (message.includes('rejected')) {
        return 'Transaction was rejected by user';
      }
      if (message.includes('network')) {
        return 'Network error. Please try again.';
      }
      
      return error.message;
    }
    
    return 'An unexpected error occurred';
  }

  /**
   * Calculate voting power from staked amount
   */
  static calculateVotingPower(stakedAmount: bigint): bigint {
    return stakedAmount; // 1:1 ratio for now
  }

  /**
   * Get time remaining in cycle (alias for season)
   */
  static async getTimeRemainingInCycle(): Promise<number> {
    return this.getTimeRemainingInSeason();
  }

  /**
   * Check if user can vote in specific cycle
   */
  static canVoteInCycle(cycleNumber: number): boolean {
    // For now, assume user can vote in current cycle
    return true;
  }

  /**
   * Calculate voting efficiency for user
   */
  static calculateVotingEfficiency(userVotes: Vote[]): number {
    if (!userVotes.length) return 0;
    // Simple efficiency calculation - could be more complex
    return Math.min(userVotes.length / 10, 1) * 100;
  }

  /**
   * Generate voting recommendations
   */
  static generateVotingRecommendations(availablePower: bigint): Array<{evermarkId: string; suggestedAmount: bigint}> {
    // Placeholder implementation
    return [];
  }

  /**
   * Calculate optimal vote distribution
   */
  static calculateOptimalDistribution(evermarkIds: string[], totalAmount: bigint): Record<string, bigint> {
    const distribution: Record<string, bigint> = {};
    const amountPerEvermark = totalAmount / BigInt(evermarkIds.length);
    
    evermarkIds.forEach(id => {
      distribution[id] = amountPerEvermark;
    });
    
    return distribution;
  }

  /**
   * Validate batch voting request
   */
  static validateBatchVoting(votes: Array<{evermarkId: string; amount: bigint}>): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (votes.length === 0) {
      errors.push('No votes provided');
    }

    votes.forEach((vote, index) => {
      if (!vote.evermarkId) {
        errors.push(`Vote ${index + 1}: Evermark ID is required`);
      }
      if (vote.amount <= 0) {
        errors.push(`Vote ${index + 1}: Amount must be greater than 0`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate delegation impact
   */
  static calculateDelegationImpact(evermarkId: string, amount: bigint): {rankChange: number; powerIncrease: number} {
    // Placeholder implementation
    return {
      rankChange: 0,
      powerIncrease: Number(formatUnits(amount, 18))
    };
  }

  /**
   * Estimate delegation rewards
   */
  static estimateDelegationRewards(evermarkId: string, amount: bigint): bigint {
    // Placeholder implementation
    return BigInt(0);
  }

  /**
   * Parse contract error into VotingError
   */
  static parseContractError(error: any): VotingError {
    return {
      code: VOTING_ERRORS.CONTRACT_ERROR,
      message: this.getUserFriendlyError(error),
      timestamp: Date.now(),
      recoverable: true
    };
  }

  /**
   * Create VotingError with code and message
   */
  static createError(code: string, message: string): VotingError {
    return {
      code,
      message,
      timestamp: Date.now(),
      recoverable: true
    };
  }

  /**
   * Generate delegation summary
   */
  static generateDelegationSummary(delegations: any[]): {totalAmount: bigint; activeCount: number; topDelegate: string} {
    return {
      totalAmount: BigInt(0),
      activeCount: 0,
      topDelegate: ''
    };
  }

  /**
   * Calculate evermark ranking
   */
  static calculateEvermarkRanking(evermarkId: string): EvermarkRanking {
    return {
      evermarkId,
      rank: 0,
      totalVotes: BigInt(0),
      voteCount: 0,
      percentageOfTotal: 0,
      trending: 'stable'
    };
  }

  /**
   * Estimate voting gas cost
   */
  static async estimateVotingGas(evermarkId: string, amount: bigint): Promise<bigint> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      const transaction = prepareContractCall({
        contract: votingContract,
        method: "function voteForEvermark(uint256 evermarkId, uint256 votes) payable",
        params: [BigInt(evermarkId), amount]
      });

      const gasEstimate = await estimateGas({ transaction });

      return gasEstimate;
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      return BigInt(21000); // Default gas estimate
    }
  }

  /**
   * Create voting power summary
   */
  static createVotingPowerSummary(votingPower: VotingPower): {efficiency: number; utilization: number} {
    const total = Number(formatUnits(votingPower.total, 18));
    const used = Number(formatUnits(votingPower.used, 18));
    
    return {
      efficiency: total > 0 ? (used / total) * 100 : 0,
      utilization: total > 0 ? (used / total) * 100 : 0
    };
  }

  /**
   * Format voting transaction for display
   */
  static formatVotingTransaction(transaction: VotingTransaction): string {
    const amount = this.formatVoteAmount(transaction.amount);
    return `Voted ${amount} for Evermark #${transaction.evermarkId}`;
  }
}