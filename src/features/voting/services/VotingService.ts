// features/voting/services/VotingService.ts - Business logic for voting operations

import { formatUnits, parseUnits } from 'viem';
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

/**
 * VotingService - Pure business logic for voting and delegation operations
 * Handles validation, calculations, error handling, and formatting
 */
export class VotingService {
  
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

    // Basic validation
    if (!amount || amount.trim() === '') {
      errors.push('Vote amount is required');
      return { isValid: false, errors, warnings };
    }

    // Numeric validation
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Vote amount must be a positive number');
      return { isValid: false, errors, warnings };
    }

    // Convert to wei for comparison
    const amountWei = parseUnits(amount, 18);

    // Minimum amount check
    if (amountWei < VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
      errors.push(`Minimum vote amount is ${this.formatVoteAmount(VOTING_CONSTANTS.MIN_VOTE_AMOUNT)} wEMARK`);
    }

    // Maximum amount check
    if (amountWei > VOTING_CONSTANTS.MAX_VOTE_AMOUNT) {
      errors.push(`Maximum vote amount is ${this.formatVoteAmount(VOTING_CONSTANTS.MAX_VOTE_AMOUNT)} wEMARK`);
    }

    // Available voting power check
    if (amountWei > availableVotingPower) {
      errors.push(`Insufficient voting power. Available: ${this.formatVoteAmount(availableVotingPower)} wEMARK`);
    }

    // Self-voting check
    if (userAddress && creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase()) {
      errors.push('You cannot vote on your own Evermark');
    }

    // Warnings for large amounts
    if (amountWei > availableVotingPower / BigInt(2)) {
      warnings.push('You are using more than 50% of your available voting power');
    }

    // Warning for very small amounts
    if (amountWei < parseUnits('1', 18)) {
      warnings.push('Small vote amounts may have minimal impact on rankings');
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
  static validateUndelegateAmount(
    amount: string,
    currentDelegation: bigint
  ): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!amount || amount.trim() === '') {
      errors.push('Amount is required');
      return { isValid: false, errors, warnings };
    }

    // Numeric validation
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Amount must be a positive number');
      return { isValid: false, errors, warnings };
    }

    // Convert to wei for comparison
    const amountWei = parseUnits(amount, 18);

    // Check if user has any delegation
    if (currentDelegation === BigInt(0)) {
      errors.push('No votes delegated to this Evermark');
    }

    // Check if amount exceeds current delegation
    if (amountWei > currentDelegation) {
      errors.push(`Cannot undelegate more than current delegation of ${this.formatVoteAmount(currentDelegation)} wEMARK`);
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
    // In this system, 1 wEMARK = 1 voting power
    // Future: Could implement time-based multipliers or other bonuses
    return stakedAmount;
  }

  /**
   * Format vote amount for display
   */
  static formatVoteAmount(amount: bigint, decimals = 2): string {
    if (amount === BigInt(0)) return '0';
    
    const formatted = formatUnits(amount, 18);
    const number = parseFloat(formatted);
    
    if (number < 0.0001) {
      return '< 0.0001';
    }
    
    // Handle large amounts with appropriate formatting
    if (number >= 1000000) {
      return `${(number / 1000000).toFixed(decimals)}M`;
    } else if (number >= 1000) {
      return `${(number / 1000).toFixed(decimals)}K`;
    }
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Parse vote amount from string input
   */
  static parseVoteAmount(amount: string): bigint {
    try {
      if (!amount || amount.trim() === '') {
        return BigInt(0);
      }
      
      const cleanAmount = amount.trim().replace(/,/g, '');
      
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
   * Calculate voting statistics
   */
  static calculateVotingStats(
    userDelegations: Delegation[],
    totalVotingPower: bigint,
    cycleData: VotingCycle | null
  ): VotingStats {
    const totalVotesCast = userDelegations.reduce((sum, delegation) => sum + delegation.amount, BigInt(0));
    const activeEvermarks = userDelegations.filter(d => d.isActive).length;
    const averageVotesPerEvermark = activeEvermarks > 0 ? totalVotesCast / BigInt(activeEvermarks) : BigInt(0);
    
    // Find top evermark votes
    const topEvermarkVotes = userDelegations.reduce((max, delegation) => 
      delegation.amount > max ? delegation.amount : max, BigInt(0)
    );

    // Mock calculations - in production these would come from actual protocol data
    const userRanking = 0; // Would calculate from leaderboard data
    const participationRate = cycleData ? 0.75 : 0; // Mock 75% participation

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
   * Calculate time remaining in current cycle
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
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }

  /**
   * Create standardized voting error
   */
  static createError(
    code: VotingErrorCode,
    message: string,
    details?: Record<string, any>
  ): VotingError {
    return {
      code,
      message,
      timestamp: Date.now(),
      recoverable: this.isRecoverableError(code),
      details
    };
  }

  /**
   * Check if an error is recoverable
   */
  private static isRecoverableError(code: VotingErrorCode): boolean {
    const recoverableErrors = new Set([
      VOTING_ERRORS.NETWORK_ERROR,
      VOTING_ERRORS.TRANSACTION_FAILED,
      VOTING_ERRORS.CONTRACT_ERROR
    ]);
    return recoverableErrors.has(code);
  }

  /**
   * Parse contract errors into user-friendly messages
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
   * Generate delegation transaction summary
   */
  static generateDelegationSummary(
    type: 'delegate' | 'undelegate',
    evermarkId: string,
    amount: bigint,
    currentDelegation?: bigint
  ): {
    title: string;
    description: string;
    estimatedGas: string;
    impact: string;
  } {
    const formattedAmount = this.formatVoteAmount(amount);
    
    switch (type) {
      case 'delegate':
        return {
          title: 'Delegate Voting Power',
          description: `Delegate ${formattedAmount} wEMARK to Evermark #${evermarkId}`,
          estimatedGas: '~0.001 ETH',
          impact: `This will increase the Evermark's ranking and your curation rewards`
        };
      
      case 'undelegate':
        return {
          title: 'Undelegate Voting Power',
          description: `Remove ${formattedAmount} wEMARK delegation from Evermark #${evermarkId}`,
          estimatedGas: '~0.0008 ETH',
          impact: `Voting power will return to your available balance`
        };
      
      default:
        return {
          title: 'Voting Transaction',
          description: 'Process voting transaction',
          estimatedGas: '~0.001 ETH',
          impact: 'This will affect Evermark rankings'
        };
    }
  }

  /**
   * Calculate optimal vote distribution strategy
   */
  static calculateOptimalDistribution(
    availablePower: bigint,
    targetEvermarks: string[],
    strategy: 'equal' | 'weighted' | 'concentrated' = 'equal'
  ): Record<string, bigint> {
    const distribution: Record<string, bigint> = {};
    
    if (targetEvermarks.length === 0 || availablePower === BigInt(0)) {
      return distribution;
    }

    switch (strategy) {
      case 'equal':
        const equalAmount = availablePower / BigInt(targetEvermarks.length);
        targetEvermarks.forEach(id => {
          distribution[id] = equalAmount;
        });
        break;
      
      case 'weighted':
        // Simple weighted distribution (could be enhanced with actual scoring)
        const weights = targetEvermarks.map((_, index) => targetEvermarks.length - index);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        targetEvermarks.forEach((id, index) => {
          const weight = weights[index];
          distribution[id] = availablePower * BigInt(weight) / BigInt(totalWeight);
        });
        break;
      
      case 'concentrated':
        // Put most power in top choices
        if (targetEvermarks.length === 1) {
          distribution[targetEvermarks[0]] = availablePower;
        } else {
          distribution[targetEvermarks[0]] = availablePower * BigInt(70) / BigInt(100); // 70% to top
          const remaining = availablePower - distribution[targetEvermarks[0]];
          const perOther = remaining / BigInt(targetEvermarks.length - 1);
          
          for (let i = 1; i < targetEvermarks.length; i++) {
            distribution[targetEvermarks[i]] = perOther;
          }
        }
        break;
    }

    return distribution;
  }

  /**
   * Validate batch voting request
   */
  static validateBatchVoting(
    request: BatchVotingRequest,
    availableVotingPower: bigint
  ): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if batch is empty
    if (request.delegations.length === 0) {
      errors.push('No delegations specified');
      return { isValid: false, errors, warnings };
    }

    // Check maximum delegations per cycle
    if (request.delegations.length > VOTING_CONSTANTS.MAX_DELEGATIONS_PER_CYCLE) {
      errors.push(`Maximum ${VOTING_CONSTANTS.MAX_DELEGATIONS_PER_CYCLE} delegations per cycle allowed`);
    }

    // Validate total amount
    const calculatedTotal = request.delegations.reduce((sum, d) => sum + d.amount, BigInt(0));
    if (calculatedTotal !== request.totalAmount) {
      errors.push('Total amount does not match sum of individual delegations');
    }

    // Check available voting power
    if (request.totalAmount > availableVotingPower) {
      errors.push(`Insufficient voting power. Available: ${this.formatVoteAmount(availableVotingPower)} wEMARK`);
    }

    // Validate individual delegations
    request.delegations.forEach((delegation, index) => {
      if (delegation.amount < VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
        errors.push(`Delegation ${index + 1}: Amount below minimum (${this.formatVoteAmount(VOTING_CONSTANTS.MIN_VOTE_AMOUNT)} wEMARK)`);
      }
      
      if (delegation.amount > VOTING_CONSTANTS.MAX_VOTE_AMOUNT) {
        errors.push(`Delegation ${index + 1}: Amount above maximum (${this.formatVoteAmount(VOTING_CONSTANTS.MAX_VOTE_AMOUNT)} wEMARK)`);
      }
      
      if (!delegation.evermarkId || delegation.evermarkId === '0') {
        errors.push(`Delegation ${index + 1}: Invalid Evermark ID`);
      }
    });

    // Check for duplicate evermarks
    const evermarkIds = request.delegations.map(d => d.evermarkId);
    const uniqueIds = new Set(evermarkIds);
    if (uniqueIds.size !== evermarkIds.length) {
      errors.push('Duplicate Evermark IDs found in batch');
    }

    // Warnings
    if (request.delegations.length > 10) {
      warnings.push('Large batch may require higher gas fees');
    }

    if (request.totalAmount > availableVotingPower * BigInt(80) / BigInt(100)) {
      warnings.push('Using more than 80% of available voting power');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate Evermark ranking based on votes
   */
  static calculateEvermarkRanking(
    evermarkVotes: Array<{ evermarkId: string; votes: bigint }>,
    totalVotes: bigint
  ): EvermarkRanking[] {
    const sortedEvermarks = evermarkVotes
      .sort((a, b) => Number(b.votes - a.votes))
      .map((evermark, index) => ({
        evermarkId: evermark.evermarkId,
        rank: index + 1,
        totalVotes: evermark.votes,
        voteCount: 1, // Would be actual vote count from contracts
        percentageOfTotal: totalVotes > BigInt(0) ? Number(evermark.votes * BigInt(10000) / totalVotes) / 100 : 0,
        trending: 'stable' as const // Would calculate from historical data
      }));

    return sortedEvermarks;
  }

  /**
   * Get gas estimation for voting operations
   */
  static estimateVotingGas(): {
    delegate: { gasLimit: bigint; estimatedCost: string };
    undelegate: { gasLimit: bigint; estimatedCost: string };
    batchDelegate: { gasLimit: bigint; estimatedCost: string };
  } {
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
        gasLimit: BigInt(150000), // Base + per delegation
        estimatedCost: '~$1.20 USD'
      }
    };
  }

  /**
   * Check if user can vote in current cycle
   */
  static canVoteInCycle(
    cycleEndTime: Date,
    userVotingPower: bigint,
    isConnected: boolean
  ): boolean {
    const now = new Date();
    const cycleEnded = now >= cycleEndTime;
    const hasPower = userVotingPower > BigInt(0);
    
    return isConnected && !cycleEnded && hasPower;
  }

  /**
   * Calculate voting power efficiency
   */
  static calculateVotingEfficiency(
    delegatedPower: bigint,
    totalVotingPower: bigint
  ): number {
    if (totalVotingPower === BigInt(0)) return 0;
    return Number(delegatedPower * BigInt(10000) / totalVotingPower) / 100;
  }

  /**
   * Generate voting recommendations
   */
  static generateVotingRecommendations(
    availablePower: bigint,
    userGoal: 'maximize_rewards' | 'support_quality' | 'diversify' = 'support_quality'
  ): {
    strategy: string;
    description: string;
    recommendedAmount: bigint;
    reasoning: string;
  } {
    switch (userGoal) {
      case 'maximize_rewards':
        return {
          strategy: 'Concentrated Voting',
          description: 'Focus voting power on top-performing Evermarks',
          recommendedAmount: availablePower * BigInt(80) / BigInt(100),
          reasoning: 'Top Evermarks typically provide better curation rewards'
        };
      
      case 'support_quality':
        return {
          strategy: 'Quality-Based Voting',
          description: 'Vote on high-quality content regardless of current ranking',
          recommendedAmount: availablePower * BigInt(60) / BigInt(100),
          reasoning: 'Supporting quality content helps improve the ecosystem'
        };
      
      case 'diversify':
        return {
          strategy: 'Diversified Voting',
          description: 'Spread votes across multiple Evermarks',
          recommendedAmount: availablePower * BigInt(40) / BigInt(100),
          reasoning: 'Diversification reduces risk and supports variety'
        };
      
      default:
        return {
          strategy: 'Balanced Voting',
          description: 'Moderate approach balancing rewards and quality',
          recommendedAmount: availablePower * BigInt(50) / BigInt(100),
          reasoning: 'Balanced approach for steady participation'
        };
    }
  }

  /**
   * Format voting transaction for display
   */
  static formatVotingTransaction(transaction: VotingTransaction): {
    status: 'success' | 'pending' | 'failed';
    title: string;
    description: string;
    details: string[];
  } {
    const formattedAmount = this.formatVoteAmount(transaction.amount);
    
    const baseTitle = transaction.type === 'delegate' ? 'Vote Delegation' : 'Vote Undelegation';
    const baseDescription = transaction.type === 'delegate' 
      ? `Delegated ${formattedAmount} wEMARK to Evermark #${transaction.evermarkId}`
      : `Undelegated ${formattedAmount} wEMARK from Evermark #${transaction.evermarkId}`;

    const details = [
      `Amount: ${formattedAmount} wEMARK`,
      `Evermark: #${transaction.evermarkId}`,
      `Time: ${transaction.timestamp.toLocaleString()}`
    ];

    if (transaction.hash) {
      details.push(`Transaction: ${transaction.hash.slice(0, 10)}...`);
    }

    if (transaction.gasUsed) {
      details.push(`Gas Used: ${transaction.gasUsed.toString()}`);
    }

    return {
      status: transaction.status,
      title: baseTitle,
      description: baseDescription,
      details
    };
  }

  /**
   * Calculate delegation impact on ranking
   */
  static calculateDelegationImpact(
    currentVotes: bigint,
    newVotes: bigint,
    totalVotesInCycle: bigint
  ): {
    rankingChange: 'increase' | 'decrease' | 'neutral';
    impactScore: number; // 0-100
    description: string;
  } {
    const voteDifference = newVotes - currentVotes;
    const impactPercentage = totalVotesInCycle > BigInt(0) 
      ? Number(voteDifference * BigInt(10000) / totalVotesInCycle) / 100 
      : 0;

    let rankingChange: 'increase' | 'decrease' | 'neutral' = 'neutral';
    let description = 'Minimal impact on ranking';

    if (voteDifference > BigInt(0)) {
      rankingChange = 'increase';
      if (Math.abs(impactPercentage) > 1) {
        description = 'Significant positive impact on ranking';
      } else {
        description = 'Positive impact on ranking';
      }
    } else if (voteDifference < BigInt(0)) {
      rankingChange = 'decrease';
      if (Math.abs(impactPercentage) > 1) {
        description = 'Significant negative impact on ranking';
      } else {
        description = 'Negative impact on ranking';
      }
    }

    return {
      rankingChange,
      impactScore: Math.min(100, Math.abs(impactPercentage) * 10),
      description
    };
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyError(error: VotingError): string {
    switch (error.code) {
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
        return error.message || 'An unexpected error occurred';
    }
  }

  /**
   * Create voting power summary
   */
  static createVotingPowerSummary(votingPower: VotingPower): {
    utilizationRate: number;
    efficiency: number;
    recommendations: string[];
  } {
    const utilizationRate = votingPower.total > BigInt(0) 
      ? Number(votingPower.delegated * BigInt(10000) / votingPower.total) / 100 
      : 0;
    
    const efficiency = utilizationRate; // Simplified - could be more complex
    
    const recommendations: string[] = [];
    
    if (utilizationRate < 30) {
      recommendations.push('Consider delegating more voting power to earn rewards');
    } else if (utilizationRate > 90) {
      recommendations.push('You\'re using most of your voting power - great participation!');
    }
    
    if (votingPower.available > parseUnits('100', 18)) {
      recommendations.push('You have significant unused voting power available');
    }
    
    if (votingPower.reserved > BigInt(0)) {
      recommendations.push('Some voting power is reserved for active delegations');
    }

    return {
      utilizationRate,
      efficiency,
      recommendations
    };
  }

  /**
   * Calculate delegation rewards estimate
   */
  static estimateDelegationRewards(
    delegatedAmount: bigint,
    evermarkPerformance: number, // 0-100 score
    cycleDuration: number = VOTING_CONSTANTS.CYCLE_DURATION
  ): {
    estimatedRewards: bigint;
    rewardRate: number;
    confidenceLevel: 'low' | 'medium' | 'high';
  } {
    // Simplified reward calculation - in production this would be more sophisticated
    const baseRewardRate = 0.05; // 5% base annual rate
    const performanceMultiplier = evermarkPerformance / 100;
    const timeMultiplier = cycleDuration / (365 * 24 * 60 * 60); // Convert to yearly fraction
    
    const rewardRate = baseRewardRate * performanceMultiplier * timeMultiplier;
    const estimatedRewards = BigInt(Math.floor(Number(delegatedAmount) * rewardRate));
    
    // Confidence based on performance score
    let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
    if (evermarkPerformance > 80) confidenceLevel = 'high';
    if (evermarkPerformance < 40) confidenceLevel = 'low';

    return {
      estimatedRewards,
      rewardRate: rewardRate * 100, // Convert to percentage
      confidenceLevel
    };
  }
}