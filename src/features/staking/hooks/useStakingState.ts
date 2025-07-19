// features/staking/hooks/useStakingState.ts - Main state management hook for staking feature

import { useCallback, useMemo } from 'react';
import { toWei } from 'thirdweb/utils';
import { useWrapping } from '@/hooks/useWrapping';
import { useWrappingStats } from '@/hooks/useWrappingStats';
import { StakingService } from '../services/StakingService';
import type { 
  UseStakingStateReturn,
  StakingInfo,
  StakingStats,
  StakingValidation,
  StakingError
} from '../types';
import { STAKING_CONSTANTS, STAKING_ERRORS } from '../types';

/**
 * Main staking state management hook
 * Provides unified interface for all staking operations
 */
export function useStakingState(userAddress?: string): UseStakingStateReturn {
  // Use existing wrapping hook as base (since wrapping = staking in this system)
  const wrapping = useWrapping(userAddress);
  const wrappingStats = useWrappingStats();

  // Memoized staking info combining wrapping data
  const stakingInfo: StakingInfo | null = useMemo(() => {
    if (!userAddress || !wrapping.hasWalletAccess) return null;

    return {
      // Token balances
      emarkBalance: wrapping.emarkBalance || BigInt(0),
      wEmarkBalance: wrapping.wEmarkBalance || BigInt(0),
      totalStaked: wrapping.totalWrapped || BigInt(0),
      
      // Voting power
      availableVotingPower: wrapping.availableVotingPower || BigInt(0),
      delegatedPower: wrapping.delegatedPower || BigInt(0),
      reservedPower: wrapping.reservedPower || BigInt(0),
      
      // Unbonding state
      unbondingAmount: wrapping.unbondingAmount || BigInt(0),
      unbondingReleaseTime: wrapping.unbondingReleaseTime || BigInt(0),
      canClaimUnbonding: wrapping.canClaimUnbonding || false,
      timeUntilRelease: StakingService.getTimeUntilRelease(wrapping.unbondingReleaseTime || BigInt(0)),
      isUnbonding: wrapping.isUnbonding || false,
      
      // Protocol stats
      totalProtocolStaked: wrappingStats.totalProtocolWrapped || BigInt(0),
      unbondingPeriod: wrappingStats.unbondingPeriod || STAKING_CONSTANTS.UNBONDING_PERIOD_SECONDS,
      unbondingPeriodDays: wrappingStats.unbondingPeriodDays || 7
    };
  }, [
    userAddress,
    wrapping.hasWalletAccess,
    wrapping.emarkBalance,
    wrapping.wEmarkBalance,
    wrapping.totalWrapped,
    wrapping.availableVotingPower,
    wrapping.delegatedPower,
    wrapping.reservedPower,
    wrapping.unbondingAmount,
    wrapping.unbondingReleaseTime,
    wrapping.canClaimUnbonding,
    wrapping.isUnbonding,
    wrappingStats.totalProtocolWrapped,
    wrappingStats.unbondingPeriod,
    wrappingStats.unbondingPeriodDays
  ]);

  // Memoized staking stats
  const stakingStats: StakingStats | null = useMemo(() => {
    if (!stakingInfo) return null;
    
    return StakingService.calculateStakingStats(
      stakingInfo,
      0, // Would track actual staking duration in production
      BigInt(1000000) // Mock total supply - would come from token contract
    );
  }, [stakingInfo]);

  // Validation functions
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
      STAKING_CONSTANTS.MIN_STAKE_AMOUNT,
      STAKING_CONSTANTS.MAX_STAKE_AMOUNT
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

  // Token formatting utility
  const formatTokenAmount = useCallback((amount: bigint, decimals = 2): string => {
    return StakingService.formatTokenAmount(amount, decimals);
  }, []);

  // Time formatting utility
  const formatTimeRemaining = useCallback((seconds: number): string => {
    return StakingService.formatTimeRemaining(seconds);
  }, []);

  // Calculate staking yield
  const calculateStakingYield = useCallback((): number => {
    return stakingStats?.stakingYield || 0;
  }, [stakingStats]);

  // Stake tokens action
  const stake = useCallback(async (amount: bigint): Promise<void> => {
    if (!stakingInfo) {
      throw StakingService.createError(
        STAKING_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
    }

    try {
      await wrapping.wrapTokens(amount);
    } catch (error: any) {
      console.error('Stake failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, wrapping.wrapTokens]);

  // Request unstake action
  const requestUnstake = useCallback(async (amount: bigint): Promise<void> => {
    if (!stakingInfo) {
      throw StakingService.createError(
        STAKING_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
    }

    try {
      await wrapping.requestUnwrap(amount);
    } catch (error: any) {
      console.error('Request unstake failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, wrapping.requestUnwrap]);

  // Complete unstake action
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
      await wrapping.completeUnwrap();
    } catch (error: any) {
      console.error('Complete unstake failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, wrapping.completeUnwrap]);

  // Cancel unbonding action
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
      await wrapping.cancelUnbonding();
    } catch (error: any) {
      console.error('Cancel unbonding failed:', error);
      throw StakingService.parseContractError(error);
    }
  }, [stakingInfo, wrapping.cancelUnbonding]);

  // Clear error state (placeholder - would be implemented if wrapping hook supports it)
  const clearError = useCallback(() => {
    // In a real implementation, this would clear error state
    // The wrapping hook doesn't expose error clearing, so this is a no-op
    console.log('Clear error called');
  }, []);

  // Clear success state (placeholder)
  const clearSuccess = useCallback(() => {
    // In a real implementation, this would clear success state
    console.log('Clear success called');
  }, []);

  // Refresh data
  const refetch = useCallback(async (): Promise<void> => {
    await wrapping.refetch();
  }, [wrapping.refetch]);

  // Return complete staking state interface
  return {
    // Data
    stakingInfo,
    stakingStats,
    
    // UI State
    isLoading: false, // Would be derived from wrapping state
    isStaking: wrapping.isWrapping,
    isUnstaking: wrapping.isUnwrapping,
    isProcessing: wrapping.isWrapping || wrapping.isUnwrapping,
    error: null, // Would map wrapping errors to StakingError format
    success: null, // Would track success messages
    
    // Actions
    stake,
    requestUnstake,
    completeUnstake,
    cancelUnbonding,
    
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
    isConnected: wrapping.hasWalletAccess,
    hasWalletAccess: wrapping.hasWalletAccess
  };
}