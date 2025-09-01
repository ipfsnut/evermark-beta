import { useCallback, useMemo } from 'react';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';

import { useStakingData } from './useStakingData';
import { useStakingStats } from './useStakingStats';
import { useStakingTransactions } from './useStakingTransactions';

import { StakingService } from '../services/StakingService';
import { 
  STAKING_CONSTANTS, 
  STAKING_ERRORS,
  type UseStakingStateReturn,
  type StakingInfo,
  type StakingStats,
  type StakingValidation,
} from '../types';

/**
 * ✅ UPDATED: Main staking state management hook using internal feature hooks
 * No longer depends on external shared hooks - completely self-contained
 */
export function useStakingState(userAddress?: string): UseStakingStateReturn {
  const account = useWalletAccount();
  const effectiveAddress = userAddress || account?.address;
  
  // ✅ Use internal feature hooks instead of external shared hooks
  const stakingData = useStakingData(effectiveAddress);
  const stakingStatsData = useStakingStats();
  const transactions = useStakingTransactions();

  // ✅ Transform internal data to StakingInfo interface
  const stakingInfo: StakingInfo | null = useMemo(() => {
    if (!effectiveAddress) return null;

    return {
      // Token balances
      emarkBalance: stakingData.emarkBalance,
      wEmarkBalance: stakingData.wEmarkBalance,
      totalStaked: stakingData.totalStaked,
      
      // Voting power
      availableVotingPower: stakingData.availableVotingPower,
      delegatedPower: stakingData.delegatedPower,
      reservedPower: BigInt(0), // Would be calculated from delegated power
      
      // Unbonding state
      unbondingAmount: stakingData.unbondingAmount,
      unbondingReleaseTime: stakingData.unbondingReleaseTime,
      canClaimUnbonding: stakingData.canClaimUnbonding,
      timeUntilRelease: StakingService.getTimeUntilRelease(stakingData.unbondingReleaseTime),
      isUnbonding: stakingData.isUnbonding,
      
      // Protocol stats
      totalProtocolStaked: stakingStatsData.totalProtocolStaked,
      unbondingPeriod: stakingStatsData.unbondingPeriod,
      unbondingPeriodDays: stakingStatsData.unbondingPeriodDays
    };
  }, [
    effectiveAddress,
    stakingData,
    stakingStatsData
  ]);

  // ✅ Calculate staking statistics
  const stakingStats: StakingStats | null = useMemo(() => {
    if (!stakingInfo) return null;
    
    return StakingService.calculateStakingStats(
      stakingInfo,
      0, // Would track actual staking duration in production
      stakingStatsData.totalSupply,
      stakingStatsData.realTimeAPR // Pass real-time APR from stats
    );
  }, [stakingInfo, stakingStatsData.totalSupply, stakingStatsData.realTimeAPR]);

  // ✅ Validation functions using StakingService
  const validateStakeAmount = useCallback((amount: string): StakingValidation => {
    if (!stakingInfo) {
      return {
        isValid: false,
        errors: ['Wallet not connected'],
        warnings: []
      };
    }
    
    return StakingService.validateStakeAmount(
      amount,
      stakingInfo.emarkBalance,
      STAKING_CONSTANTS.MIN_STAKE_AMOUNT
    );
  }, [stakingInfo]);

  const validateUnstakeAmount = useCallback((amount: string): StakingValidation => {
    if (!stakingInfo) {
      return {
        isValid: false,
        errors: ['Wallet not connected'],
        warnings: []
      };
    }
    
    return StakingService.validateUnstakeAmount(
      amount,
      stakingInfo.wEmarkBalance,
      STAKING_CONSTANTS.MIN_STAKE_AMOUNT
    );
  }, [stakingInfo]);

  // ✅ Utility functions
  const formatTokenAmount = useCallback((amount: bigint, decimals?: number): string => {
    return StakingService.formatTokenAmount(amount, decimals);
  }, []);

  const formatTimeRemaining = useCallback((seconds: number): string => {
    return StakingService.formatTimeRemaining(seconds);
  }, []);

  const calculateStakingYield = useCallback((): number => {
    return stakingStats?.stakingYield ?? 0;
  }, [stakingStats]);

  // ✅ Stake action (assumes approval already done via UI)
  const stake = useCallback(async (amount: bigint): Promise<void> => {
    if (!stakingInfo) {
      throw StakingService.createError(
        STAKING_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
    }

    // Check if approval is sufficient
    if (stakingData.stakingAllowance < amount) {
      throw StakingService.createError(
        STAKING_ERRORS.INSUFFICIENT_ALLOWANCE,
        'Please approve EMARK spending first'
      );
    }

    try {
      // Stake the tokens
      await transactions.stake(amount);
    } catch (error: unknown) {
      console.error('Stake failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, stakingData.stakingAllowance, transactions]);

  // ✅ Pass through transaction actions with error handling
  const requestUnstake = useCallback(async (amount: bigint): Promise<void> => {
    if (!stakingInfo) {
      throw StakingService.createError(
        STAKING_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
    }

    try {
      await transactions.requestUnstake(amount);
    } catch (error: unknown) {
      console.error('Request unstake failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, transactions]);

  const completeUnstake = useCallback(async (): Promise<void> => {
    if (!stakingInfo) {
      throw StakingService.createError(
        STAKING_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
    }

    if (!stakingInfo.canClaimUnbonding) {
      throw StakingService.createError(
        STAKING_ERRORS.UNBONDING_NOT_READY,
        `Unbonding period not complete. ${StakingService.formatTimeRemaining(stakingInfo.timeUntilRelease)} remaining.`
      );
    }

    try {
      await transactions.completeUnstake();
    } catch (error: unknown) {
      console.error('Complete unstake failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, transactions]);

  const cancelUnbonding = useCallback(async (): Promise<void> => {
    if (!stakingInfo) {
      throw StakingService.createError(
        STAKING_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
    }

    if (stakingInfo.unbondingAmount === BigInt(0)) {
      throw StakingService.createError(
        STAKING_ERRORS.NO_UNBONDING_REQUEST,
        'No pending unbonding request found'
      );
    }

    try {
      await transactions.cancelUnbonding();
    } catch (error: unknown) {
      console.error('Cancel unbonding failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, transactions]);

  // ✅ State management actions (placeholders)
  const clearError = useCallback(() => {
    console.log('Clear error called');
  }, []);

  const clearSuccess = useCallback(() => {
    console.log('Clear success called');
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    await transactions.refetch();
  }, [transactions]);

  // ✅ Return complete staking state interface
  const result: UseStakingStateReturn = {
    // Data
    stakingInfo,
    stakingStats,
    
    // UI State
    isLoading: stakingData.isLoading || stakingStatsData.isLoading,
    isStaking: transactions.isStaking || transactions.isApproving,
    isUnstaking: transactions.isUnstaking,
    isProcessing: transactions.isStaking || transactions.isUnstaking || 
                  transactions.isCompleting || transactions.isCancelling || 
                  transactions.isApproving,
    error: stakingData.hasError ? StakingService.createError(
      STAKING_ERRORS.CONTRACT_ERROR, 
      'Failed to load staking data'
    ) : null,
    success: null, // Would track success messages
    
    // Actions
    stake,
    requestUnstake,
    completeUnstake,
    cancelUnbonding,
    approveStaking: transactions.approveStaking,
    
    // Utilities
    validateStakeAmount,
    validateUnstakeAmount,
    formatTokenAmount,
    formatTimeRemaining,
    calculateStakingYield,
    
    // State management
    clearError,
    clearSuccess,
    refetch,
    
    // Connection status
    isConnected: !!account,
    hasWalletAccess: !!account,
    
    // Approval info
    currentAllowance: stakingData.stakingAllowance,
    isApproving: transactions.isApproving,
    
    // Data refresh utilities
    refreshAllowance: stakingData.refetchAllowance
  };
  
  return result;
}