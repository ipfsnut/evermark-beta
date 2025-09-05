// src/features/voting/hooks/useVotingState.ts - Integrated with contract cycle system
import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { useStakingData } from '@/features/staking/hooks/useStakingData';
import { useContextualTransactions } from '@/hooks/core/useContextualTransactions';
import { getEvermarkVotingContract } from '@/lib/contracts';
import { VotingService } from '../services/VotingService';
import { VotingCacheService } from '../services/VotingCacheService';
import { LeaderboardService } from '../../leaderboard/services/LeaderboardService';
import { PointsService } from '@/features/points/services/PointsService';
import type { 
  VotingPower, 
  VotingSeason, 
  VotingCycle,
  VotingStats, 
  VotingValidation, 
  VotingError, 
  VotingTransaction, 
  UseVotingStateReturn,
  Vote
} from '../types';
import { VOTING_CONSTANTS } from '../types';

export function useVotingState(): UseVotingStateReturn {
  const [error, setError] = useState<VotingError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isUndelegating, setIsUndelegating] = useState(false);
  
  const queryClient = useQueryClient();
  const account = useWalletAccount();
  const userAddress = account?.address;
  const isConnected = !!account && !!userAddress;

  // Context-aware transaction hook for both browser and Farcaster
  const { sendTransaction } = useContextualTransactions();

  // Get real staking data for voting power
  const stakingData = useStakingData(userAddress);

  // Use real voting power from staking data
  const votingPower: VotingPower | null = stakingData ? {
    total: stakingData.wEmarkBalance,
    available: stakingData.availableVotingPower,
    used: stakingData.delegatedPower,
    remaining: stakingData.availableVotingPower
  } : null;

  // Fetch current cycle data from contract
  const { data: currentCycle, isLoading: cycleLoading, error: cycleError } = useQuery({
    queryKey: ['voting', 'currentCycle'],
    queryFn: () => VotingService.getCurrentCycle(),
    staleTime: VOTING_CONSTANTS.CACHE_DURATION,
    refetchInterval: VOTING_CONSTANTS.REFRESH_INTERVAL,
    enabled: isConnected
  });

  // Fetch voting stats
  const { data: votingStats } = useQuery({
    queryKey: ['voting', 'stats', userAddress],
    queryFn: () => VotingService.getVotingStats(userAddress),
    staleTime: VOTING_CONSTANTS.CACHE_DURATION,
    enabled: isConnected && !!userAddress
  });

  // Fetch user voting history
  const { data: votingHistory = [] } = useQuery({
    queryKey: ['voting', 'history', userAddress],
    queryFn: () => userAddress ? VotingService.fetchVotingHistory(userAddress) : Promise.resolve([]),
    staleTime: VOTING_CONSTANTS.CACHE_DURATION,
    enabled: isConnected && !!userAddress
  });

  // For backward compatibility
  const currentSeason: VotingSeason | null = currentCycle ? {
    seasonNumber: currentCycle.cycleNumber,
    startTime: currentCycle.startTime,
    endTime: currentCycle.endTime,
    totalVotes: currentCycle.totalVotes,
    totalVoters: currentCycle.totalVoters,
    isActive: currentCycle.isActive,
    activeEvermarksCount: currentCycle.activeEvermarksCount
  } : null;
  
  const userVotes: Vote[] = votingHistory;

  // Real contract-based getters
  const getEvermarkVotes = useCallback(async (evermarkId: string): Promise<bigint> => {
    try {
      return await VotingService.getEvermarkVotes(evermarkId);
    } catch (error) {
      console.error('Failed to get evermark votes:', error);
      return BigInt(0);
    }
  }, []);

  const getUserVotesForEvermark = useCallback(async (evermarkId: string): Promise<bigint> => {
    if (!userAddress) return BigInt(0);
    try {
      return await VotingService.getUserVotesForEvermark(userAddress, evermarkId);
    } catch (error) {
      console.error('Failed to get user votes for evermark:', error);
      return BigInt(0);
    }
  }, [userAddress]);

  const getUserVotes = useCallback((targetUserAddress: string): Vote[] => {
    return votingHistory.filter(vote => vote.userAddress === targetUserAddress);
  }, [votingHistory]);

  // Utility functions
  const validateVoteAmount = useCallback((amount: string, evermarkId?: string): VotingValidation => {
    const baseValidation = VotingService.validateVoteAmount(amount, evermarkId);
    
    // Add user balance validation if we have voting power data
    if (baseValidation.isValid && votingPower && amount) {
      try {
        const voteAmount = VotingService.parseVoteAmount(amount);
        
        // Check if user has sufficient voting power
        if (voteAmount > votingPower.available) {
          baseValidation.errors.push(`Insufficient voting power. Available: ${VotingService.formatVoteAmount(votingPower.available)} wEMARK`);
          baseValidation.isValid = false;
        }
        
        // Add helpful warnings
        if (voteAmount > votingPower.available / BigInt(2)) {
          baseValidation.warnings.push('You are voting with more than 50% of your available power');
        }
      } catch (error) {
        // Amount parsing error is already handled by base validation
      }
    }
    
    return baseValidation;
  }, [votingPower]);

  const calculateVotingPower = useCallback((stakedAmount: bigint): bigint => {
    return stakedAmount; // 1:1 ratio for now
  }, []);

  const formatVoteAmount = useCallback((amount: bigint, decimals?: number): string => {
    return VotingService.formatVoteAmount(amount, decimals);
  }, []);

  const getTimeRemainingInSeason = useCallback(async (): Promise<number> => {
    try {
      return await VotingService.getTimeRemainingInCycle();
    } catch (error) {
      console.error('Failed to get time remaining:', error);
      return 0;
    }
  }, []);

  const getTimeRemainingInCycle = useCallback(async (): Promise<number> => {
    try {
      return await VotingService.getTimeRemainingInCycle();
    } catch (error) {
      console.error('Failed to get time remaining in cycle:', error);
      return 0;
    }
  }, []);

  const delegateVotes = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    // Validate evermarkId before processing
    if (!evermarkId || evermarkId === 'undefined' || typeof evermarkId !== 'string') {
      throw new Error(`Invalid evermarkId provided: ${evermarkId}`);
    }

    setIsDelegating(true);
    setError(null);

    try {
      console.log('Delegating votes:', { evermarkId, amount: amount.toString(), userAddress });

      // Get the voting contract
      const votingContract = getEvermarkVotingContract();
      
      // Send transaction using contextual transaction hook
      const result = await sendTransaction({
        contract: votingContract,
        method: "function voteForEvermark(uint256 evermarkId, uint256 votes) payable",
        params: [BigInt(evermarkId), amount]
      });

      console.log('Delegation successful:', result.transactionHash);
      setSuccess(`Successfully delegated ${VotingService.formatVoteAmount(amount)} wEMARK!`);

      // Update both votes and leaderboard tables after successful vote
      if (currentCycle) {
        try {
          const updateResponse = await fetch('/.netlify/functions/update-voting-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userAddress,
              evermark_id: evermarkId,
              vote_amount: amount.toString(),
              transaction_hash: result.transactionHash,
              cycle: currentCycle.cycleNumber
            })
          });
          
          if (updateResponse.ok) {
            const updateResult = await updateResponse.json();
            console.log(`✅ Updated voting data for evermark ${evermarkId}:`, updateResult.data);
          } else {
            const errorText = await updateResponse.text();
            console.error(`❌ Failed to update voting data for evermark ${evermarkId}:`, errorText);
          }
        } catch (updateError) {
          console.error('Voting data update failed:', updateError);
        }
      }

      // Invalidate relevant React Query caches to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['voting', 'history', userAddress] });
      queryClient.invalidateQueries({ queryKey: ['evermarks'] });
      
      console.log('🔄 Invalidated caches to trigger data refresh');

      // Award points for voting
      try {
        await PointsService.awardPoints(
          userAddress,
          'vote',
          evermarkId,
          result.transactionHash
        );
        console.log('✅ Awarded 1 point for voting');
      } catch (pointsError) {
        console.warn('⚠️ Failed to award points for voting:', pointsError);
      }

      return {
        hash: result.transactionHash,
        type: 'vote',
        evermarkId,
        amount,
        timestamp: new Date(),
        status: 'confirmed'
      };

    } catch (error: unknown) {
      console.error('Delegation failed:', error);
      const votingError = VotingService.parseContractError(error);
      setError(votingError);
      throw error;
    } finally {
      setIsDelegating(false);
    }
  }, [userAddress, sendTransaction]);

  const undelegateVotes = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    // Validate evermarkId before processing
    if (!evermarkId || evermarkId === 'undefined' || typeof evermarkId !== 'string') {
      throw new Error(`Invalid evermarkId provided: ${evermarkId}`);
    }

    setIsUndelegating(true);
    setError(null);

    try {
      console.log('Undelegating votes:', { evermarkId, amount: amount.toString(), userAddress });

      // Get the voting contract
      const votingContract = getEvermarkVotingContract();
      
      // Send undelegation transaction using contextual transaction hook
      const result = await sendTransaction({
        contract: votingContract,
        method: "function withdrawVotes(uint256 evermarkId, uint256 votes) payable",
        params: [BigInt(evermarkId), amount]
      });

      console.log('Undelegation successful:', result.transactionHash);
      setSuccess(`Successfully withdrew ${VotingService.formatVoteAmount(amount)} wEMARK!`);

      // Update cache with reduced vote data
      if (currentCycle) {
        // Get current user votes after withdrawal to cache the correct amount
        const currentUserVotes = await VotingService.getUserVotesForEvermark(userAddress, evermarkId);
        
        // Cache individual user vote with updated amount
        await VotingCacheService.cacheUserVote(
          userAddress,
          evermarkId,
          currentCycle.cycleNumber,
          currentUserVotes,
          result.transactionHash
        );
        
        // Update aggregate vote totals for this evermark
        // Get current total votes from blockchain to ensure accuracy
        const currentTotalVotes = await VotingService.getEvermarkVotes(evermarkId, currentCycle.cycleNumber);
        
        // Update the voting cache with new totals (voter count set to 0 since we don't track it)
        await VotingCacheService.updateVotingCache(
          evermarkId,
          currentCycle.cycleNumber,
          currentTotalVotes,
          0 // Voter count disabled - we established this isn't efficiently available
        );
        
        console.log(`🔄 Updated vote cache for evermark ${evermarkId} after withdrawal: ${VotingService.formatVoteAmount(currentTotalVotes)} total votes`);
      }

      // Award points for voting (undelegating is still a voting action)
      try {
        await PointsService.awardPoints(
          userAddress,
          'vote',
          evermarkId,
          result.transactionHash
        );
        console.log('✅ Awarded 1 point for vote undelegation');
      } catch (pointsError) {
        console.warn('⚠️ Failed to award points for vote undelegation:', pointsError);
      }

      return {
        hash: result.transactionHash,
        type: 'vote',
        evermarkId,
        amount,
        timestamp: new Date(),
        status: 'confirmed'
      };

    } catch (error: unknown) {
      console.error('Undelegation failed:', error);
      const votingError = VotingService.parseContractError(error);
      setError(votingError);
      throw error;
    } finally {
      setIsUndelegating(false);
    }
  }, [userAddress, sendTransaction]);

  // Vote for evermark (same as delegate for now)
  const voteForEvermark = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    return delegateVotes(evermarkId, amount);
  }, [delegateVotes]);

  // Placeholder utility functions
  const canVoteInCycle = useCallback((_cycleNumber: number): boolean => {
    return true;
  }, []);

  const calculateVotingEfficiency = useCallback((_userVotes: Vote[]): number => {
    return 0;
  }, []);

  const generateVotingRecommendations = useCallback((_availablePower: bigint) => {
    return [];
  }, []);

  const calculateOptimalDistribution = useCallback((_evermarkIds: string[], _totalAmount: bigint) => {
    return {};
  }, []);

  const validateBatchVoting = useCallback((_votes: Array<{evermarkId: string; amount: bigint}>) => {
    return { isValid: false, errors: ['Not implemented'], warnings: [] };
  }, []);

  const calculateDelegationImpact = useCallback((_evermarkId: string, _amount: bigint) => {
    return { rankChange: 0, powerIncrease: 0 };
  }, []);

  const estimateDelegationRewards = useCallback((_evermarkId: string, _amount: bigint): bigint => {
    return BigInt(0);
  }, []);

  const parseContractError = useCallback((_error: unknown) => {
    return { code: 'ERROR', message: 'Error', timestamp: Date.now(), recoverable: true };
  }, []);

  const createError = useCallback((code: string, message: string) => {
    return { code, message, timestamp: Date.now(), recoverable: true };
  }, []);

  const generateDelegationSummary = useCallback((_delegations: unknown[]) => {
    return { totalAmount: BigInt(0), activeCount: 0, topDelegate: '' };
  }, []);

  const calculateEvermarkRanking = useCallback((_evermarkId: string) => {
    return { evermarkId: _evermarkId, rank: 0, totalVotes: BigInt(0), voteCount: 0, percentageOfTotal: 0, trending: 'stable' as const };
  }, []);

  const estimateVotingGas = useCallback(async (_evermarkId: string, _amount: bigint): Promise<bigint> => {
    return BigInt(21000);
  }, []);

  const createVotingPowerSummary = useCallback((_votingPower: unknown) => {
    return { efficiency: 0, utilization: 0 };
  }, []);

  const formatVotingTransaction = useCallback((_transaction: unknown): string => {
    return 'Transaction';
  }, []);

  // State management functions
  const clearErrors = useCallback(() => {
    setError(null);
  }, []);

  const clearSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  // Auto-clear success messages after 5 seconds
  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return
  }, [success]);

  const refetch = useCallback(async (): Promise<void> => {
    // Refetch all relevant data
    // React Query will handle this automatically with queryClient.invalidateQueries
  }, []);

  return {
    // Data
    votingPower,
    userVotes,
    votingHistory,
    currentSeason,
    currentCycle: currentCycle ?? null,
    votingStats: votingStats ?? null,
    
    // Evermark-specific data
    getEvermarkVotes,
    getUserVotesForEvermark,
    getUserVotes,
    
    // UI State
    isLoading: stakingData.isLoading || cycleLoading,
    isVoting: isDelegating || isUndelegating,
    isDelegating,
    isUndelegating,
    error: error || (cycleError as VotingError | null),
    success,
    
    // Actions
    voteForEvermark,
    delegateVotes,
    undelegateVotes,
    
    // Utilities
    validateVoteAmount,
    calculateVotingPower,
    formatVoteAmount,
    getTimeRemainingInSeason,
    getTimeRemainingInCycle,
    canVoteInCycle,
    calculateVotingEfficiency,
    generateVotingRecommendations,
    calculateOptimalDistribution,
    validateBatchVoting,
    calculateDelegationImpact,
    estimateDelegationRewards,
    parseContractError,
    createError,
    generateDelegationSummary,
    calculateEvermarkRanking,
    estimateVotingGas,
    createVotingPowerSummary,
    formatVotingTransaction,
    
    // State management
    clearErrors,
    clearSuccess,
    refetch,
    
    // Connection status
    isConnected,
    userAddress
  };
}