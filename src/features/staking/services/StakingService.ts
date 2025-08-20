// features/staking/services/StakingService.ts - Business logic for staking operations

import { toWei } from 'thirdweb/utils';
import type { 
  StakingInfo,
  StakingStats,
  StakingValidation,
  StakingError,
  StakingTransaction,
  StakingErrorCode
} from '../types';
import { STAKING_CONSTANTS, STAKING_ERRORS } from '../types';

/**
 * StakingService - Pure business logic for staking operations
 * Handles validation, calculations, error handling, and formatting
 */
export class StakingService {
  
  /**
   * Validate stake amount with comprehensive checks
   */
  static validateStakeAmount(
    amount: string,
    balance: bigint,
    minAmount: bigint = STAKING_CONSTANTS.MIN_STAKE_AMOUNT
  ): StakingValidation {
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

    // Convert to wei for comparison (EMARK has 18 decimals)
    const amountWei = toWei(amount);

    // Minimum amount check
    if (amountWei < minAmount) {
      errors.push(`Minimum stake amount is ${this.formatTokenAmount(minAmount)} EMARK`);
    }

    // Balance check
    if (amountWei > balance) {
      errors.push('Insufficient EMARK balance');
    }

    // Warnings for large amounts
    if (amountWei > balance / BigInt(2)) {
      warnings.push('You are staking more than 50% of your balance');
    }

    // Dust amount warning
    if (amountWei < toWei('10')) {
      warnings.push('Small stake amounts may have minimal voting power impact');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate unstake amount
   */
  static validateUnstakeAmount(
    amount: string,
    stakedBalance: bigint,
    minAmount: bigint = STAKING_CONSTANTS.MIN_STAKE_AMOUNT
  ): StakingValidation {
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
    const amountWei = toWei(amount);

    // Staked balance check
    if (amountWei > stakedBalance) {
      errors.push('Cannot unstake more than your staked amount');
    }

    // Check if remaining stake would be below minimum
    const remainingStake = stakedBalance - amountWei;
    if (remainingStake > BigInt(0) && remainingStake < minAmount) {
      warnings.push(`Remaining stake would be below minimum. Consider unstaking all ${this.formatTokenAmount(stakedBalance)} EMARK`);
    }

    // Unbonding period warning
    warnings.push(`Unstaking requires a ${this.formatUnbondingPeriod(STAKING_CONSTANTS.UNBONDING_PERIOD_SECONDS)} waiting period`);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Format token amount for display (whole numbers only)
   */
  static formatTokenAmount(amount: bigint, decimals?: number): string {
    const useShortFormat = decimals !== 18;
    try {
      if (amount === BigInt(0)) return '0';
      
      // Manual conversion from wei to ether (18 decimals)
      const divisor = BigInt(10) ** BigInt(18);
      const etherAmount = Number(amount) / Number(divisor);
      const wholeNumber = Math.floor(etherAmount); // Always whole numbers
      
      if (useShortFormat) {
        // Use short format for large numbers to prevent overflow
        if (wholeNumber >= 1000000000) {
          return `${(wholeNumber / 1000000000).toFixed(1)}B`;
        } else if (wholeNumber >= 1000000) {
          return `${(wholeNumber / 1000000).toFixed(1)}M`;
        } else if (wholeNumber >= 1000) {
          return `${(wholeNumber / 1000).toFixed(1)}K`;
        }
      }
      
      // Return whole number with commas for readability
      return wholeNumber.toLocaleString('en-US');
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  }

  /**
   * Format unbonding period for display
   */
  static formatUnbondingPeriod(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    
    if (days > 0) {
      return hours > 0 ? `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }

  /**
   * Format time remaining for unbonding
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Ready to claim';
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Calculate time until release from Unix timestamp
   */
  static getTimeUntilRelease(releaseTime: bigint): number {
    const releaseTimeMs = Number(releaseTime) * 1000;
    const currentTimeMs = Date.now();
    return Math.max(0, Math.floor((releaseTimeMs - currentTimeMs) / 1000));
  }

  /**
   * Calculate staking statistics
   */
  static calculateStakingStats(
    stakingInfo: StakingInfo,
    stakingDuration: number,
    totalSupply: bigint,
    realTimeAPR?: number
  ): StakingStats {
    // User statistics
    const userStakePercentage = stakingInfo.totalProtocolStaked > BigInt(0) 
      ? Number(stakingInfo.totalStaked) / Number(stakingInfo.totalProtocolStaked) * 100
      : 0;

    // Protocol statistics
    const stakingRatio = totalSupply > BigInt(0)
      ? Number(stakingInfo.totalProtocolStaked) / Number(totalSupply)
      : 0;

    // Use real-time APR if provided, otherwise fallback to calculated estimate
    const aprEstimate = realTimeAPR ?? (() => {
      // Fallback calculation based on staking ratio
      const baseApr = 15; // 15% base APR
      const minimumApr = 5; // 5% minimum APR
      const stakingRatioDecimal = stakingRatio;
      
      // APR decreases as more people stake (supply/demand economics)
      return Math.max(
        minimumApr,
        baseApr * (1 - (stakingRatioDecimal * 0.6)) // 60% max reduction from base
      );
    })();
    
    const stakingYield = stakingDuration > 0 
      ? (aprEstimate / 365) * (stakingDuration / (24 * 60 * 60)) // Daily yield * days staked
      : 0;

    return {
      userStakePercentage,
      stakingRewards: BigInt(0), // Would calculate actual rewards
      stakingDuration,
      totalStakers: 0, // Would come from contract
      averageStakeAmount: BigInt(0), // Would calculate from total/count
      stakingRatio,
      aprEstimate,
      realTimeAPR: realTimeAPR ?? aprEstimate, // Use real-time APR if available
      stakingYield
    };
  }

  /**
   * Parse contract errors into user-friendly messages
   */
  static parseContractError(error: any): StakingError {
    const timestamp = Date.now();
    let code: StakingErrorCode = STAKING_ERRORS.CONTRACT_ERROR;
    let message = 'Transaction failed';
    let recoverable = true;

    if (error?.message) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('insufficient balance')) {
        code = STAKING_ERRORS.INSUFFICIENT_BALANCE;
        message = 'Insufficient EMARK balance for this transaction';
      } else if (errorMessage.includes('allowance') || errorMessage.includes('approve')) {
        code = STAKING_ERRORS.INSUFFICIENT_ALLOWANCE;
        message = 'Please approve EMARK spending first';
      } else if (errorMessage.includes('user rejected')) {
        code = STAKING_ERRORS.TRANSACTION_FAILED;
        message = 'Transaction was rejected';
        recoverable = false;
      } else if (errorMessage.includes('network')) {
        code = STAKING_ERRORS.NETWORK_ERROR;
        message = 'Network error. Please try again';
      } else if (errorMessage.includes('unbonding')) {
        code = STAKING_ERRORS.UNBONDING_NOT_READY;
        message = 'Unbonding period is not complete yet';
      }
    }

    // ✅ FIX: Only include details if there's actual error information
    const result: StakingError = {
      code,
      message,
      timestamp,
      recoverable
    };

    // Only add details if there's meaningful error info
    if (error?.message || error?.stack) {
      result.details = {
        originalError: error.message || 'Unknown error',
        ...(error.stack && { stack: error.stack })
      };
    }

    return result;
  }

  /**
   * Create a standardized staking error
   */
  static createError(
    code: StakingErrorCode, 
    message: string, 
    details?: Record<string, any>
  ): StakingError {
    // ✅ FIX: Only include details if provided and not empty
    const result: StakingError = {
      code,
      message,
      timestamp: Date.now(),
      recoverable: code !== STAKING_ERRORS.WALLET_NOT_CONNECTED
    };

    // Only add details if provided
    if (details && Object.keys(details).length > 0) {
      result.details = details;
    }

    return result;
  }

  /**
   * Generate transaction summary for UI display
   */
  static generateTransactionSummary(
    type: StakingTransaction['type'],
    amount?: bigint,
  ): {
    title: string;
    description: string;
    estimatedGas: string;
    timeToComplete: string;
  } {
    switch (type) {
      case 'stake':
        return {
          title: 'Stake EMARK Tokens',
          description: `Stake ${amount ? this.formatTokenAmount(amount) : '—'} EMARK to receive wEMARK voting tokens`,
          estimatedGas: '~0.001 ETH',
          timeToComplete: '1-2 minutes'
        };
      
      case 'unstake':
        return {
          title: 'Request Unstake',
          description: `Begin unstaking ${amount ? this.formatTokenAmount(amount) : '—'} wEMARK tokens`,
          estimatedGas: '~0.0008 ETH',
          timeToComplete: `${this.formatUnbondingPeriod(STAKING_CONSTANTS.UNBONDING_PERIOD_SECONDS)} + 1-2 minutes`
        };
      
      case 'complete_unstake':
        return {
          title: 'Claim Unstaked Tokens',
          description: 'Complete the unstaking process and receive your EMARK tokens',
          estimatedGas: '~0.0006 ETH',
          timeToComplete: '1-2 minutes'
        };
      
      case 'cancel_unbonding':
        return {
          title: 'Cancel Unstaking',
          description: 'Cancel the unstaking request and keep your tokens staked',
          estimatedGas: '~0.0005 ETH',
          timeToComplete: '1-2 minutes'
        };
      
      default:
        return {
          title: 'Staking Transaction',
          description: 'Process staking transaction',
          estimatedGas: '~0.001 ETH',
          timeToComplete: '1-2 minutes'
        };
    }
  }

  /**
   * Calculate voting power from staked amount
   */
  static calculateVotingPower(stakedAmount: bigint, multiplier: number = 1): bigint {
    // In this system, 1 wEMARK = 1 voting power
    // Multiplier could be used for time-based bonuses in the future
    return stakedAmount * BigInt(Math.floor(multiplier * 100)) / BigInt(100);
  }

  /**
   * Calculate staking APY based on protocol metrics
   */
  static calculateAPY(
    totalStaked: bigint,
    totalRewards: bigint,
    timeperiod: number = 365 * 24 * 60 * 60 // 1 year in seconds
  ): number {
    if (totalStaked === BigInt(0)) return 0;
    
    const rewardRate = Number(totalRewards) / Number(totalStaked);
    const annualizedRate = rewardRate * (365 * 24 * 60 * 60) / timeperiod;
    
    return annualizedRate * 100; // Convert to percentage
  }

  /**
   * Get default pagination for staking-related queries
   */
  static getDefaultPagination() {
    return {
      page: 1,
      pageSize: 20,
      sortBy: 'timestamp' as const,
      sortOrder: 'desc' as const
    };
  }

  /**
   * Estimate gas costs for staking operations
   */
  static estimateGasCosts(): {
    approve: string;
    stake: string;
    unstake: string;
    completeUnstake: string;
    cancelUnbonding: string;
  } {
    return {
      approve: '~45,000 gas',
      stake: '~65,000 gas',
      unstake: '~55,000 gas',
      completeUnstake: '~40,000 gas',
      cancelUnbonding: '~35,000 gas'
    };
  }

  /**
   * Calculate minimum amount to keep for gas fees
   */
  static getGasReserve(): bigint {
    // Reserve ~0.01 ETH worth for gas fees
    return toWei('0.01');
  }

  /**
   * Check if amount is economically viable (worth the gas cost)
   */
  static isEconomicallyViable(amount: bigint, gasPrice: bigint = toWei('0.001')): boolean {
    // Amount should be at least 10x the gas cost to be economically viable
    return amount >= gasPrice * BigInt(10);
  }

  /**
   * Format percentage for display
   */
  static formatPercentage(value: number, decimals: number = 2): string {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * Calculate compound interest for staking rewards
   */
  static calculateCompoundInterest(
    principal: bigint,
    rate: number,
    time: number,
    compoundFrequency: number = 365
  ): bigint {
    // Manual conversion from wei to ether
    const divisor = BigInt(10) ** BigInt(18);
    const principalNumber = Number(principal) / Number(divisor);
    const amount = principalNumber * Math.pow(1 + rate / compoundFrequency, compoundFrequency * time);
    return toWei(amount.toString());
  }

  /**
   * Get staking recommendations based on user's situation
   */
  static getStakingRecommendations(
    balance: bigint,
    currentStake: bigint,
    userGoal: 'maximize_rewards' | 'moderate_risk' | 'maximum_voting_power'
  ): {
    recommended: bigint;
    reasoning: string;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const totalBalance = balance + currentStake;
    
    switch (userGoal) {
      case 'maximize_rewards':
        return {
          recommended: totalBalance * BigInt(80) / BigInt(100), // 80% of total
          reasoning: 'Stake 80% of tokens for maximum rewards while keeping some liquid',
          riskLevel: 'medium'
        };
      
      case 'moderate_risk':
        return {
          recommended: totalBalance * BigInt(50) / BigInt(100), // 50% of total
          reasoning: 'Stake 50% for balanced exposure to rewards and liquidity',
          riskLevel: 'low'
        };
      
      case 'maximum_voting_power':
        return {
          recommended: totalBalance * BigInt(95) / BigInt(100), // 95% of total
          reasoning: 'Stake 95% for maximum voting power in content curation',
          riskLevel: 'high'
        };
      
      default:
        return {
          recommended: totalBalance * BigInt(30) / BigInt(100), // 30% default
          reasoning: 'Conservative 30% stake to start earning rewards',
          riskLevel: 'low'
        };
    }
  }
}