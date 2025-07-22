// src/features/voting/services/VotingService.ts - Complete fixed implementation
import { formatUnits, parseUnits } from 'viem';
import { readContract, getContractEvents, estimateGas, getGasPrice, prepareEvent, prepareContractCall } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN } from '@/lib/contracts';
import { 
  type Vote,
  type Delegation,
  type VotingCycle,
  type VotingPower,
  type VotingStats,
  type VotingValidation,
  type VotingError,
  type VotingErrorCode,
  type VotingTransaction,
  type EvermarkRanking,
  type BatchVotingRequest,
  type BatchVotingResult,
  VOTING_CONSTANTS,
  VOTING_ERRORS
} from '../types';

export class VotingService {
  
  /**
   * Fetch delegation history from contract events
   */
  static async fetchDelegationHistory(
    userAddress: string,
    votingContract: any,
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<Vote[]> {
    try {
      // Prepare event definitions for type safety
      const delegateEvent = prepareEvent({
        signature: "event VoteDelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
      });

      const undelegateEvent = prepareEvent({
        signature: "event VoteUndelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
      });

      const [delegateEvents, undelegateEvents] = await Promise.all([
        getContractEvents({
          contract: votingContract,
          events: [delegateEvent],
          fromBlock: fromBlock || 0n,
          toBlock: toBlock || 'latest'
        }),
        getContractEvents({
          contract: votingContract,
          events: [undelegateEvent],
          fromBlock: fromBlock || 0n,
          toBlock: toBlock || 'latest'
        })
      ]);

      const allEvents = [
        ...delegateEvents
          .filter(event => event.args.user.toLowerCase() === userAddress.toLowerCase())
          .map(event => ({
            id: `${event.transactionHash}-${event.logIndex}`,
            userAddress,
            evermarkId: event.args.evermarkId.toString(),
            amount: event.args.amount,
            cycle: Number(event.args.cycle),
            timestamp: new Date(Number(event.blockNumber || 0) * 15 * 1000), // Estimate timestamp from block
            transactionHash: event.transactionHash,
            status: 'confirmed' as const,
            type: 'delegate' as const
          })),
        ...undelegateEvents
          .filter(event => event.args.user.toLowerCase() === userAddress.toLowerCase())
          .map(event => ({
            id: `${event.transactionHash}-${event.logIndex}`,
            userAddress,
            evermarkId: event.args.evermarkId.toString(),
            amount: event.args.amount,
            cycle: Number(event.args.cycle),
            timestamp: new Date(Number(event.blockNumber || 0) * 15 * 1000), // Estimate timestamp from block
            transactionHash: event.transactionHash,
            status: 'confirmed' as const,
            type: 'undelegate' as const
          }))
      ];

      // Sort by timestamp descending
      return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to fetch delegation history:', error);
      return [];
    }
  }

  /**
   * Get evermark votes in current cycle from contract
   */
  static async getEvermarkVotes(
    evermarkId: string,
    cycle: number,
    votingContract: any
  ): Promise<bigint> {
    try {
      const votes = await readContract({
        contract: votingContract,
        method: "function getEvermarkVotesInCycle(uint256 cycle, uint256 evermarkId) view returns (uint256)",
        params: [BigInt(cycle), BigInt(evermarkId)]
      });
      return votes;
    } catch (error) {
      console.error(`Failed to get votes for evermark ${evermarkId}:`, error);
      return BigInt(0);
    }
  }

  /**
   * Get user votes for specific evermark in cycle
   */
  static async getUserVotes(
    userAddress: string,
    evermarkId: string,
    cycle: number,
    votingContract: any
  ): Promise<bigint> {
    try {
      const votes = await readContract({
        contract: votingContract,
        method: "function getUserVotesInCycle(uint256 cycle, address user, uint256 evermarkId) view returns (uint256)",
        params: [BigInt(cycle), userAddress, BigInt(evermarkId)]
      });
      return votes;
    } catch (error) {
      console.error(`Failed to get user votes for evermark ${evermarkId}:`, error);
      return BigInt(0);
    }
  }

  /**
   * Get user's remaining voting power
   */
  static async getRemainingVotingPower(
    userAddress: string,
    votingContract: any
  ): Promise<bigint> {
    try {
      const remainingPower = await readContract({
        contract: votingContract,
        method: "function getRemainingVotingPower(address user) view returns (uint256)",
        params: [userAddress]
      });
      return remainingPower;
    } catch (error) {
      console.error('Failed to get remaining voting power:', error);
      return BigInt(0);
    }
  }

  /**
   * Calculate real voting statistics from contract data
   */
  static calculateVotingStats(
    userDelegations: Delegation[],
    totalVotingPower: bigint,
    cycleData: VotingCycle | null,
    allUserVotes?: Vote[]
  ): VotingStats {
    const totalVotesCast = userDelegations.reduce((sum, delegation) => sum + delegation.amount, BigInt(0));
    const activeEvermarks = userDelegations.filter(d => d.isActive).length;
    const averageVotesPerEvermark = activeEvermarks > 0 ? totalVotesCast / BigInt(activeEvermarks) : BigInt(0);
    
    // Find top evermark votes
    const topEvermarkVotes = userDelegations.reduce((max, delegation) => 
      delegation.amount > max ? delegation.amount : max, BigInt(0)
    );

    // Calculate user ranking based on total votes cast
    let userRanking = 0;
    if (allUserVotes && totalVotesCast > BigInt(0)) {
      const usersByVotes = allUserVotes
        .reduce((acc, vote) => {
          const existing = acc.find(u => u.address === vote.userAddress);
          if (existing) {
            existing.totalVotes += vote.amount;
          } else {
            acc.push({ address: vote.userAddress, totalVotes: vote.amount });
          }
          return acc;
        }, [] as { address: string; totalVotes: bigint }[])
        .sort((a, b) => Number(b.totalVotes - a.totalVotes));
      
      userRanking = usersByVotes.findIndex(u => u.totalVotes <= totalVotesCast) + 1;
    }

    // Calculate participation rate
    const participationRate = cycleData && allUserVotes ? 
      allUserVotes.length / cycleData.totalDelegations : 0;

    return {
      totalVotesCast,
      activeEvermarks,
      averageVotesPerEvermark,
      topEvermarkVotes,
      userRanking,
      participationRate
    };
  }

  /**
   * Real gas estimation using current network conditions
   */
  static async estimateVotingGas(votingContract?: any): Promise<{
    delegate: { gasLimit: bigint; estimatedCost: string };
    undelegate: { gasLimit: bigint; estimatedCost: string };
    batchDelegate: { gasLimit: bigint; estimatedCost: string };
  }> {
    try {
      if (!votingContract) {
        throw new Error('Voting contract required for gas estimation');
      }

      const [gasPrice, delegateGas, undelegateGas] = await Promise.all([
        getGasPrice({ client, chain: CHAIN }),
        estimateGas({
          transaction: prepareContractCall({
            contract: votingContract,
            method: "function delegateVotes(uint256 evermarkId, uint256 amount)",
            params: [BigInt(1), parseUnits('1', 18)]
          })
        }),
        estimateGas({
          transaction: prepareContractCall({
            contract: votingContract,
            method: "function undelegateVotes(uint256 evermarkId, uint256 amount)",
            params: [BigInt(1), parseUnits('1', 18)]
          })
        })
      ]);

      const batchGas = delegateGas * BigInt(3); // Estimate for 3 delegations

      // Convert to USD (rough estimate - $2000/ETH)
      const ethPrice = 2000;
      const delegateCostUSD = Number(formatUnits(delegateGas * gasPrice, 18)) * ethPrice;
      const undelegateCostUSD = Number(formatUnits(undelegateGas * gasPrice, 18)) * ethPrice;
      const batchCostUSD = Number(formatUnits(batchGas * gasPrice, 18)) * ethPrice;

      return {
        delegate: {
          gasLimit: delegateGas,
          estimatedCost: `~$${delegateCostUSD.toFixed(2)} USD`
        },
        undelegate: {
          gasLimit: undelegateGas,
          estimatedCost: `~$${undelegateCostUSD.toFixed(2)} USD`
        },
        batchDelegate: {
          gasLimit: batchGas,
          estimatedCost: `~$${batchCostUSD.toFixed(2)} USD`
        }
      };
    } catch (error) {
      console.warn('Gas estimation failed, using fallback values:', error);
      return {
        delegate: {
          gasLimit: BigInt(80000),
          estimatedCost: '~$0.60 USD'
        },
        undelegate: {
          gasLimit: BigInt(65000),
          estimatedCost: '~$0.50 USD'
        },
        batchDelegate: {
          gasLimit: BigInt(200000),
          estimatedCost: '~$1.50 USD'
        }
      };
    }
  }

  /**
   * Validate vote amount with comprehensive checks
   */
  static validateVoteAmount(
    amount: string,
    availableVotingPower: bigint,
    evermarkId?: string,
    userAddress?: string,
    creatorAddress?: string
  ): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!amount || amount.trim() === '') {
      errors.push('Vote amount is required');
      return { isValid: false, errors, warnings };
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Vote amount must be a positive number');
      return { isValid: false, errors, warnings };
    }

    try {
      const amountWei = parseUnits(amount, 18);

      if (amountWei < VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
        errors.push(`Minimum vote amount is ${this.formatVoteAmount(VOTING_CONSTANTS.MIN_VOTE_AMOUNT)} wEMARK`);
      }

      if (amountWei > VOTING_CONSTANTS.MAX_VOTE_AMOUNT) {
        errors.push(`Maximum vote amount is ${this.formatVoteAmount(VOTING_CONSTANTS.MAX_VOTE_AMOUNT)} wEMARK`);
      }

      if (amountWei > availableVotingPower) {
        errors.push(`Insufficient voting power. Available: ${this.formatVoteAmount(availableVotingPower)} wEMARK`);
      }

      if (userAddress && creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase()) {
        errors.push('You cannot vote on your own Evermark');
      }

      // Warnings
      if (amountWei > availableVotingPower / BigInt(2)) {
        warnings.push('You are using more than 50% of your available voting power');
      }

      if (amountWei < parseUnits('1', 18)) {
        warnings.push('Small vote amounts may have minimal impact on rankings');
      }

      if (availableVotingPower > BigInt(0) && amountWei < availableVotingPower / BigInt(100)) {
        warnings.push('Consider using a larger portion of your voting power for greater impact');
      }

    } catch (parseError) {
      errors.push('Invalid number format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate undelegation amount
   */
  static validateUndelegateAmount(amount: string, currentDelegation: bigint): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!amount || amount.trim() === '') {
      errors.push('Amount is required');
      return { isValid: false, errors, warnings };
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Amount must be a positive number');
      return { isValid: false, errors, warnings };
    }

    try {
      const amountWei = parseUnits(amount, 18);

      if (currentDelegation === BigInt(0)) {
        errors.push('No votes delegated to this Evermark');
      }

      if (amountWei > currentDelegation) {
        errors.push(`Cannot undelegate more than current delegation of ${this.formatVoteAmount(currentDelegation)} wEMARK`);
      }

      // Warning for undelegating everything
      if (amountWei === currentDelegation && currentDelegation > BigInt(0)) {
        warnings.push('This will remove all your votes from this Evermark');
      }

    } catch (parseError) {
      errors.push('Invalid number format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate batch voting request
   */
  static validateBatchVoting(request: BatchVotingRequest, availablePower: bigint): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.delegations || request.delegations.length === 0) {
      errors.push('At least one delegation is required');
      return { isValid: false, errors, warnings };
    }

    if (request.delegations.length > 20) {
      errors.push('Maximum 20 delegations per batch');
    }

    // Check total amount
    const calculatedTotal = request.delegations.reduce((sum, d) => sum + d.amount, BigInt(0));
    if (calculatedTotal !== request.totalAmount) {
      errors.push('Total amount does not match sum of individual delegations');
    }

    if (request.totalAmount > availablePower) {
      errors.push(`Insufficient voting power. Available: ${this.formatVoteAmount(availablePower)} wEMARK`);
    }

    // Check individual delegations
    const evermarkIds = new Set<string>();
    for (const delegation of request.delegations) {
      if (evermarkIds.has(delegation.evermarkId)) {
        errors.push(`Duplicate evermark ID: ${delegation.evermarkId}`);
      }
      evermarkIds.add(delegation.evermarkId);

      if (delegation.amount < VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
        errors.push(`Delegation to ${delegation.evermarkId} below minimum amount`);
      }

      if (delegation.amount > VOTING_CONSTANTS.MAX_VOTE_AMOUNT) {
        errors.push(`Delegation to ${delegation.evermarkId} exceeds maximum amount`);
      }
    }

    // Warnings
    if (request.delegations.length > 10) {
      warnings.push('Large batch operations may use significant gas');
    }

    if (request.totalAmount > availablePower / BigInt(2)) {
      warnings.push('Using more than 50% of available voting power');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate voting power from staked amount
   */
  static calculateVotingPower(stakedAmount: bigint): bigint {
    // 1:1 ratio for now, could implement different formulas later
    return stakedAmount;
  }

  /**
   * Format vote amount for display
   */
  static formatVoteAmount(amount: bigint, decimals = 2): string {
    if (amount === BigInt(0)) return '0';
    
    const formatted = formatUnits(amount, 18);
    const number = parseFloat(formatted);
    
    if (number < 0.0001) return '< 0.0001';
    if (number >= 1000000) return `${(number / 1000000).toFixed(decimals)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(decimals)}K`;
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Parse vote amount from user input
   */
  static parseVoteAmount(amount: string): bigint {
    try {
      if (!amount || amount.trim() === '') return BigInt(0);
      const cleanAmount = amount.trim().replace(/,/g, '');
      if (!/^\d*\.?\d*$/.test(cleanAmount)) throw new Error('Invalid number format');
      return parseUnits(cleanAmount, 18);
    } catch (error) {
      console.error('Error parsing vote amount:', error);
      throw new Error('Invalid amount format');
    }
  }

  /**
   * Calculate time remaining in cycle
   */
  static getTimeRemainingInCycle(cycleEndTime: Date): number {
    const now = new Date();
    const endTime = new Date(cycleEndTime);
    return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  }

  /**
   * Format time remaining for display
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Cycle ended';
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  /**
   * Check if user can vote in current cycle
   */
  static canVoteInCycle(cycleEndTime: Date, userVotingPower: bigint, isConnected: boolean): boolean {
    if (!isConnected) return false;
    if (userVotingPower <= BigInt(0)) return false;
    
    const timeRemaining = this.getTimeRemainingInCycle(cycleEndTime);
    return timeRemaining > 0;
  }

  /**
   * Calculate voting efficiency (percentage of total power being used)
   */
  static calculateVotingEfficiency(delegatedPower: bigint, totalVotingPower: bigint): number {
    if (totalVotingPower === BigInt(0)) return 0;
    return Number((delegatedPower * BigInt(100)) / totalVotingPower);
  }

  /**
   * Generate voting recommendations based on user goals
   */
  static generateVotingRecommendations(
    availablePower: bigint,
    userGoal: 'maximize_rewards' | 'support_quality' | 'diversify' = 'support_quality'
  ): {
    strategy: string;
    description: string;
    suggestedDistribution: 'equal' | 'weighted' | 'concentrated';
    powerUsageRecommendation: number; // percentage
  } {
    switch (userGoal) {
      case 'maximize_rewards':
        return {
          strategy: 'Concentrated High-Performer',
          description: 'Focus on top-performing Evermarks with proven track records',
          suggestedDistribution: 'concentrated',
          powerUsageRecommendation: 80
        };
      case 'diversify':
        return {
          strategy: 'Diversified Portfolio',
          description: 'Spread votes across multiple Evermarks to reduce risk',
          suggestedDistribution: 'equal',
          powerUsageRecommendation: 60
        };
      default: // support_quality
        return {
          strategy: 'Quality-Focused',
          description: 'Support high-quality content regardless of current rankings',
          suggestedDistribution: 'weighted',
          powerUsageRecommendation: 70
        };
    }
  }

  /**
   * Calculate optimal vote distribution
   */
  static calculateOptimalDistribution(
    availablePower: bigint,
    targetEvermarks: string[],
    strategy: 'equal' | 'weighted' | 'concentrated' = 'equal'
  ): Record<string, bigint> {
    const distribution: Record<string, bigint> = {};
    
    if (targetEvermarks.length === 0) return distribution;

    switch (strategy) {
      case 'equal': {
        const amountPerEvermark = availablePower / BigInt(targetEvermarks.length);
        targetEvermarks.forEach(id => {
          distribution[id] = amountPerEvermark;
        });
        break;
      }
      case 'weighted': {
        // Weight by reverse order (first gets most, tapering down)
        const weights = targetEvermarks.map((_, index) => targetEvermarks.length - index);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        targetEvermarks.forEach((id, index) => {
          if (index < weights.length) {
            const weight = weights[index];
            if (weight !== undefined) {
              distribution[id] = (availablePower * BigInt(weight)) / BigInt(totalWeight);
            }
          }
        });
        break;
      }
      case 'concentrated': {
        // Give 50% to first, 30% to second, 20% to rest
        if (targetEvermarks.length >= 1 && targetEvermarks[0] !== undefined) {
          distribution[targetEvermarks[0]] = (availablePower * BigInt(50)) / BigInt(100);
        }
        if (targetEvermarks.length >= 2 && targetEvermarks[1] !== undefined) {
          distribution[targetEvermarks[1]] = (availablePower * BigInt(30)) / BigInt(100);
        }
        if (targetEvermarks.length >= 3) {
          const remaining = (availablePower * BigInt(20)) / BigInt(100);
          const perRest = remaining / BigInt(targetEvermarks.length - 2);
          for (let i = 2; i < targetEvermarks.length; i++) {
            const evermarkId = targetEvermarks[i];
            if (evermarkId !== undefined) {
              distribution[evermarkId] = perRest;
            }
          }
        }
        break;
      }
    }

    return distribution;
  }

  /**
   * Calculate delegation impact on evermark ranking
   */
  static calculateDelegationImpact(
    currentVotes: bigint,
    newVotes: bigint,
    totalVotes: bigint
  ): {
    percentageIncrease: number;
    rankingImpact: 'minimal' | 'moderate' | 'significant';
    estimatedNewShare: number;
  } {
    const afterVotes = currentVotes + newVotes;
    const afterTotal = totalVotes + newVotes;
    
    const percentageIncrease = currentVotes > BigInt(0) 
      ? Number((newVotes * BigInt(100)) / currentVotes)
      : 100;
    
    const newShare = afterTotal > BigInt(0) 
      ? Number((afterVotes * BigInt(100)) / afterTotal)
      : 0;

    let rankingImpact: 'minimal' | 'moderate' | 'significant' = 'minimal';
    if (percentageIncrease > 50) rankingImpact = 'significant';
    else if (percentageIncrease > 20) rankingImpact = 'moderate';

    return {
      percentageIncrease,
      rankingImpact,
      estimatedNewShare: newShare
    };
  }

  /**
   * Estimate delegation rewards
   */
  static async estimateDelegationRewards(
    delegatedAmount: bigint,
    evermarkPerformance: number,
    cycleDuration: number = VOTING_CONSTANTS.CYCLE_DURATION
  ): Promise<{
    estimatedRewards: bigint;
    rewardRate: number;
    confidenceLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      // Base reward rate varies by performance (2-10% annual)
      const baseRewardRate = 0.02 + (evermarkPerformance / 100) * 0.08;
      const timeMultiplier = cycleDuration / (365 * 24 * 60 * 60); // Convert to yearly fraction
      
      const rewardRate = baseRewardRate * timeMultiplier;
      const estimatedRewards = BigInt(Math.floor(Number(delegatedAmount) * rewardRate));
      
      // Confidence based on performance score
      let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
      if (evermarkPerformance > 70) confidenceLevel = 'high';
      if (evermarkPerformance < 30) confidenceLevel = 'low';

      return {
        estimatedRewards,
        rewardRate: rewardRate * 100, // Convert to percentage
        confidenceLevel
      };
    } catch (error) {
      console.error('Failed to estimate rewards:', error);
      return {
        estimatedRewards: BigInt(0),
        rewardRate: 5.0, // Fallback 5%
        confidenceLevel: 'low'
      };
    }
  }

  /**
   * Calculate Evermark rankings from vote data
   */
  static calculateEvermarkRanking(
    evermarkVotes: Array<{ evermarkId: string; votes: bigint }>,
    totalVotes: bigint
  ): EvermarkRanking[] {
    const sorted = [...evermarkVotes].sort((a, b) => Number(b.votes - a.votes));
    
    return sorted.map((item, index) => ({
      evermarkId: item.evermarkId,
      rank: index + 1,
      totalVotes: item.votes,
      voteCount: Number(item.votes),
      percentageOfTotal: totalVotes > BigInt(0) ? Number((item.votes * BigInt(100)) / totalVotes) : 0,
      trending: 'stable' as const // Would need historical data to determine trend
    }));
  }

  /**
   * Create standardized voting error
   */
  static createError(code: VotingErrorCode, message: string, details?: Record<string, any>): VotingError {
    const error: VotingError = {
      code,
      message,
      timestamp: Date.now(),
      recoverable: this.isRecoverableError(code)
    };

    if (details) {
      error.details = details;
    }

    return error;
  }

  /**
   * Check if error is recoverable
   */
  private static isRecoverableError(code: VotingErrorCode): boolean {
    const recoverableErrors = new Set<VotingErrorCode>([
      VOTING_ERRORS.NETWORK_ERROR,
      VOTING_ERRORS.TRANSACTION_FAILED,
      VOTING_ERRORS.CONTRACT_ERROR
    ]);
    return recoverableErrors.has(code);
  }

  /**
   * Parse contract error into structured format
   */
  static parseContractError(error: any): VotingError {
    const timestamp = Date.now();
    let code: VotingErrorCode = VOTING_ERRORS.CONTRACT_ERROR;
    let message = 'Transaction failed';
    let recoverable = true;

    if (error?.message) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('insufficient voting power')) {
        code = VOTING_ERRORS.INSUFFICIENT_VOTING_POWER;
        message = 'Insufficient voting power for this delegation';
      } else if (errorMessage.includes('cycle is finalized') || errorMessage.includes('cycle ended')) {
        code = VOTING_ERRORS.CYCLE_ENDED;
        message = 'Current voting cycle has ended';
      } else if (errorMessage.includes('cannot vote on own')) {
        code = VOTING_ERRORS.SELF_VOTE_ATTEMPTED;
        message = 'You cannot vote on your own Evermark';
        recoverable = false;
      } else if (errorMessage.includes('evermark does not exist')) {
        code = VOTING_ERRORS.INVALID_EVERMARK;
        message = 'This Evermark does not exist';
        recoverable = false;
      } else if (errorMessage.includes('user rejected')) {
        code = VOTING_ERRORS.TRANSACTION_FAILED;
        message = 'Transaction was rejected';
        recoverable = false;
      } else if (errorMessage.includes('network')) {
        code = VOTING_ERRORS.NETWORK_ERROR;
        message = 'Network error. Please try again';
      } else if (errorMessage.includes('no votes to undelegate')) {
        code = VOTING_ERRORS.NO_VOTES_TO_UNDELEGATE;
        message = 'No votes delegated to this Evermark';
      }
    }

    return { 
      code, 
      message, 
      timestamp, 
      recoverable, 
      details: { 
        originalError: error?.message || 'Unknown error', 
        stack: error?.stack 
      } 
    };
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyError(error: VotingError | string): string {
    const errorCode = typeof error === 'string' ? error : error.code;
    const errorMessage = typeof error === 'string' ? error : error.message;

    switch (errorCode) {
      case VOTING_ERRORS.WALLET_NOT_CONNECTED:
        return 'Please connect your wallet to vote';
      case VOTING_ERRORS.INSUFFICIENT_VOTING_POWER:
        return 'You don\'t have enough voting power for this delegation';
      case VOTING_ERRORS.INVALID_EVERMARK:
        return 'This Evermark does not exist or is invalid';
      case VOTING_ERRORS.CYCLE_ENDED:
        return 'The current voting cycle has ended';
      case VOTING_ERRORS.SELF_VOTE_ATTEMPTED:
        return 'You cannot vote on your own Evermark';
      case VOTING_ERRORS.NO_VOTES_TO_UNDELEGATE:
        return 'You have no votes delegated to this Evermark';
      case VOTING_ERRORS.AMOUNT_TOO_LOW:
        return 'Vote amount is below the minimum required';
      case VOTING_ERRORS.AMOUNT_TOO_HIGH:
        return 'Vote amount exceeds the maximum allowed';
      case VOTING_ERRORS.TRANSACTION_FAILED:
        return 'Transaction failed. Please try again';
      case VOTING_ERRORS.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again';
      default:
        return errorMessage || 'An unexpected error occurred';
    }
  }

  /**
   * Generate delegation summary for UI display
   */
  static generateDelegationSummary(
    type: 'delegate' | 'undelegate',
    evermarkId: string,
    amount: bigint,
    currentDelegation?: bigint
  ): {
    action: string;
    amount: string;
    evermarkId: string;
    newTotal?: string;
    impact: 'low' | 'medium' | 'high';
  } {
    const formattedAmount = this.formatVoteAmount(amount);
    const action = type === 'delegate' ? 'Delegate' : 'Undelegate';
    
    let impact: 'low' | 'medium' | 'high' = 'medium';
    
    const result: {
      action: string;
      amount: string;
      evermarkId: string;
      newTotal?: string;
      impact: 'low' | 'medium' | 'high';
    } = {
      action,
      amount: formattedAmount,
      evermarkId,
      impact
    };
    
    if (currentDelegation !== undefined) {
      const newTotalAmount = type === 'delegate' 
        ? currentDelegation + amount 
        : currentDelegation - amount;
      result.newTotal = this.formatVoteAmount(newTotalAmount);
      
      // Calculate impact based on change percentage
      if (currentDelegation > BigInt(0)) {
        const changePercent = Number((amount * BigInt(100)) / currentDelegation);
        if (changePercent > 50) impact = 'high';
        else if (changePercent < 10) impact = 'low';
      }
    }

    return result;
  }

  /**
   * Create voting power summary for UI
   */
  static createVotingPowerSummary(votingPower: VotingPower): {
    totalFormatted: string;
    availableFormatted: string;
    delegatedFormatted: string;
    utilizationPercentage: number;
    status: 'low' | 'medium' | 'high' | 'maxed';
  } {
    const totalFormatted = this.formatVoteAmount(votingPower.total);
    const availableFormatted = this.formatVoteAmount(votingPower.available);
    const delegatedFormatted = this.formatVoteAmount(votingPower.delegated);
    
    const utilizationPercentage = votingPower.total > BigInt(0) 
      ? Number((votingPower.delegated * BigInt(100)) / votingPower.total)
      : 0;

    let status: 'low' | 'medium' | 'high' | 'maxed' = 'low';
    if (utilizationPercentage >= 90) status = 'maxed';
    else if (utilizationPercentage >= 60) status = 'high';
    else if (utilizationPercentage >= 30) status = 'medium';

    return {
      totalFormatted,
      availableFormatted,
      delegatedFormatted,
      utilizationPercentage,
      status
    };
  }

  /**
   * Format voting transaction for display
   */
  static formatVotingTransaction(transaction: VotingTransaction): {
    typeLabel: string;
    amountFormatted: string;
    statusLabel: string;
    timeAgo: string;
    gasCostFormatted?: string;
  } {
    const typeLabel = transaction.type === 'delegate' ? 'Delegated' : 'Undelegated';
    const amountFormatted = this.formatVoteAmount(transaction.amount);
    
    let statusLabel = 'Unknown';
    switch (transaction.status) {
      case 'pending':
        statusLabel = 'Pending';
        break;
      case 'confirmed':
        statusLabel = 'Confirmed';
        break;
      case 'failed':
        statusLabel = 'Failed';
        break;
    }

    const timeAgo = this.formatTimeAgo(transaction.timestamp);
    
    const result: {
      typeLabel: string;
      amountFormatted: string;
      statusLabel: string;
      timeAgo: string;
      gasCostFormatted?: string;
    } = {
      typeLabel,
      amountFormatted,
      statusLabel,
      timeAgo
    };

    if (transaction.gasUsed) {
      result.gasCostFormatted = `${this.formatVoteAmount(transaction.gasUsed, 6)} ETH`;
    }

    return result;
  }

  /**
   * Format time ago helper
   */
  private static formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  }
}