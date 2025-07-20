// features/voting/hooks/useVotingState.ts - Main state management hook for voting feature

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReadContract } from 'thirdweb/react';
import { useActiveAccount } from 'thirdweb/react';
import { prepareContractCall, sendTransaction } from 'thirdweb';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN, CONTRACTS } from '@/lib/contracts';
import { EvermarkVotingABI } from '@/lib/abis';
import { useStakingState } from '@/features/staking';
import { VotingService } from '../services/VotingService';
import {
  type Vote,
  type Delegation,
  type VotingCycle,
  type VotingPower,
  type VotingStats,
  type VotingValidation,
  type VotingError,
  type VotingTransaction,
  type UseVotingStateReturn,
  VOTING_CONSTANTS,
  VOTING_ERRORS
} from '../types';

// Query keys for React Query
const QUERY_KEYS = {
  votingPower: (address?: string) => ['voting', 'power', address],
  userVotes: (address?: string, evermarkId?: string, cycle?: number) => 
    ['voting', 'userVotes', address, evermarkId, cycle],
  evermarkVotes: (evermarkId?: string, cycle?: number) => 
    ['voting', 'evermarkVotes', evermarkId, cycle],
  currentCycle: () => ['voting', 'currentCycle'],
  cycleInfo: (cycle?: number) => ['voting', 'cycleInfo', cycle],
  delegationHistory: (address?: string) => ['voting', 'history', address],
  votingStats: (address?: string) => ['voting', 'stats', address],
} as const;

/**
 * Main state management hook for Voting feature
 * Integrates with staking for voting power and manages all voting operations
 */
export function useVotingState(): UseVotingStateReturn {
  // State
  const [error, setError] = useState<VotingError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);
  const [isUndelegating, setIsUndelegating] = useState(false);
  
  // Wallet and contracts
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  
  // Contract instance
  const votingContract = useMemo(() => getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EvermarkVOTING,
    abi: EvermarkVotingABI
  }), []);
  
  const userAddress = account?.address;
  const isConnected = !!account && !!userAddress;
  
  // Get voting power from staking feature
  const { stakingInfo, formatTokenAmount } = useStakingState();
  
  // Current cycle query
  const { 
    data: currentCycleNumber, 
    isLoading: isLoadingCycle,
    refetch: refetchCycle
  } = useReadContract({
    contract: votingContract,
    method: "function getCurrentCycle() view returns (uint256)",
    params: [],
  });

  // Cycle info query
  const { 
    data: cycleInfoData,
    isLoading: isLoadingCycleInfo,
    refetch: refetchCycleInfo
  } = useReadContract({
    contract: votingContract,
    method: "function getCycleInfo(uint256) view returns (uint256,uint256,uint256,uint256,bool,uint256)",
    params: currentCycleNumber ? [currentCycleNumber] : undefined,
  });

  // Time remaining in cycle
  const { 
    data: timeRemainingRaw,
    refetch: refetchTimeRemaining
  } = useReadContract({
    contract: votingContract,
    method: "function getTimeRemainingInCurrentCycle() view returns (uint256)",
    params: [],
  });

  // User's current delegations query
  const { 
    data: delegationHistoryData,
    isLoading: isLoadingDelegations,
    refetch: refetchDelegations
  } = useQuery({
    queryKey: QUERY_KEYS.delegationHistory(userAddress),
    queryFn: async () => {
      if (!userAddress || !currentCycleNumber) return [];
      
      // This would typically fetch from contract events or backend
      // For now, return empty array - would be implemented with actual contract calls
      return [] as Vote[];
    },
    enabled: !!userAddress && !!currentCycleNumber,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Voting power calculation
  const votingPower: VotingPower | null = useMemo(() => {
    if (!stakingInfo) return null;
    
    return {
      total: stakingInfo.totalStaked,
      available: stakingInfo.availableVotingPower,
      delegated: stakingInfo.delegatedPower,
      reserved: stakingInfo.reservedPower
    };
  }, [stakingInfo]);

  // Current cycle information
  const currentCycle: VotingCycle | null = useMemo(() => {
    if (!currentCycleNumber || !cycleInfoData) return null;
    
    const [startTime, endTime, totalVotes, totalDelegations, finalized, activeCount] = cycleInfoData;
    
    return {
      cycleNumber: Number(currentCycleNumber),
      startTime: new Date(Number(startTime) * 1000),
      endTime: new Date(Number(endTime) * 1000),
      totalVotes,
      totalDelegations: Number(totalDelegations),
      isFinalized: finalized,
      activeEvermarksCount: Number(activeCount)
    };
  }, [currentCycleNumber, cycleInfoData]);

  // Current delegations from history
  const currentDelegations: Delegation[] = useMemo(() => {
    if (!delegationHistoryData || !currentCycleNumber) return [];
    
    // Group by evermarkId and calculate net delegations
    const delegationMap = new Map<string, bigint>();
    
    delegationHistoryData
      .filter(vote => vote.cycle === Number(currentCycleNumber))
      .forEach(vote => {
        const current = delegationMap.get(vote.evermarkId) || BigInt(0);
        if (vote.type === 'delegate') {
          delegationMap.set(vote.evermarkId, current + vote.amount);
        } else {
          delegationMap.set(vote.evermarkId, current - vote.amount);
        }
      });
    
    // Convert to delegation objects
    return Array.from(delegationMap.entries())
      .filter(([_, amount]) => amount > BigInt(0))
      .map(([evermarkId, amount]) => ({
        evermarkId,
        amount,
        cycle: Number(currentCycleNumber),
        timestamp: new Date(),
        isActive: true
      }));
  }, [delegationHistoryData, currentCycleNumber]);

  // Voting statistics
  const votingStats: VotingStats | null = useMemo(() => {
    if (!votingPower || !currentDelegations) return null;
    
    return VotingService.calculateVotingStats(
      currentDelegations,
      votingPower.total,
      currentCycle
    );
  }, [votingPower, currentDelegations, currentCycle]);

  // Get votes for specific evermark
  const getEvermarkVotes = useCallback((evermarkId: string): bigint => {
    // This would be implemented with a contract call
    // For now, return BigInt(0) as placeholder
    return BigInt(0);
  }, []);

  // Get user's votes for specific evermark
  const getUserVotes = useCallback((evermarkId: string): bigint => {
    const delegation = currentDelegations.find(d => d.evermarkId === evermarkId);
    return delegation?.amount || BigInt(0);
  }, [currentDelegations]);

  // Delegate votes mutation
  const delegateVotesMutation = useMutation({
    mutationFn: async ({ evermarkId, amount }: { evermarkId: string; amount: bigint }) => {
      if (!account) {
        throw VotingService.createError(
          VOTING_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setError(null);
      setIsDelegating(true);

      try {
        // Prepare delegation transaction
        const transaction = prepareContractCall({
          contract: votingContract,
          method: "function delegateVotes(uint256 evermarkId, uint256 amount)",
          params: [BigInt(evermarkId), amount]
        });

        // Send transaction
        const result = await sendTransaction({
          transaction,
          account
        });

        const votingTransaction: VotingTransaction = {
          hash: result.transactionHash,
          type: 'delegate',
          evermarkId,
          amount,
          timestamp: new Date(),
          status: 'confirmed'
        };

        return votingTransaction;
      } catch (error: any) {
        console.error('Delegation failed:', error);
        throw VotingService.parseContractError(error);
      }
    },
    onSuccess: (transaction) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegationHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.votingPower(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evermarkVotes(transaction.evermarkId) });
      
      setSuccess(`Successfully delegated ${formatTokenAmount(transaction.amount)} wEMARK to Evermark #${transaction.evermarkId}`);
    },
    onError: (error: VotingError) => {
      setError(error);
    },
    onSettled: () => {
      setIsDelegating(false);
    }
  });

  // Undelegate votes mutation
  const undelegateVotesMutation = useMutation({
    mutationFn: async ({ evermarkId, amount }: { evermarkId: string; amount: bigint }) => {
      if (!account) {
        throw VotingService.createError(
          VOTING_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setError(null);
      setIsUndelegating(true);

      try {
        // Prepare undelegation transaction
        const transaction = prepareContractCall({
          contract: votingContract,
          method: "function undelegateVotes(uint256 evermarkId, uint256 amount)",
          params: [BigInt(evermarkId), amount]
        });

        // Send transaction
        const result = await sendTransaction({
          transaction,
          account
        });

        const votingTransaction: VotingTransaction = {
          hash: result.transactionHash,
          type: 'undelegate',
          evermarkId,
          amount,
          timestamp: new Date(),
          status: 'confirmed'
        };

        return votingTransaction;
      } catch (error: any) {
        console.error('Undelegation failed:', error);
        throw VotingService.parseContractError(error);
      }
    },
    onSuccess: (transaction) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegationHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.votingPower(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evermarkVotes(transaction.evermarkId) });
      
      setSuccess(`Successfully undelegated ${formatTokenAmount(transaction.amount)} wEMARK from Evermark #${transaction.evermarkId}`);
    },
    onError: (error: VotingError) => {
      setError(error);
    },
    onSettled: () => {
      setIsUndelegating(false);
    }
  });

  // Batch delegate votes mutation
  const batchDelegateVotesMutation = useMutation({
    mutationFn: async (delegations: { evermarkId: string; amount: bigint }[]) => {
      if (!account) {
        throw VotingService.createError(
          VOTING_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setError(null);
      setIsDelegating(true);

      try {
        const evermarkIds = delegations.map(d => BigInt(d.evermarkId));
        const amounts = delegations.map(d => d.amount);

        // Prepare batch delegation transaction
        const transaction = prepareContractCall({
          contract: votingContract,
          method: "function delegateVotesBatch(uint256[] evermarkIds, uint256[] amounts)",
          params: [evermarkIds, amounts]
        });

        // Send transaction
        const result = await sendTransaction({
          transaction,
          account
        });

        const votingTransaction: VotingTransaction = {
          hash: result.transactionHash,
          type: 'delegate',
          evermarkId: 'batch',
          amount: amounts.reduce((sum, amount) => sum + amount, BigInt(0)),
          timestamp: new Date(),
          status: 'confirmed'
        };

        return votingTransaction;
      } catch (error: any) {
        console.error('Batch delegation failed:', error);
        throw VotingService.parseContractError(error);
      }
    },
    onSuccess: (transaction) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegationHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.votingPower(userAddress) });
      
      setSuccess(`Successfully delegated to ${transaction.evermarkId === 'batch' ? 'multiple Evermarks' : `Evermark #${transaction.evermarkId}`}`);
    },
    onError: (error: VotingError) => {
      setError(error);
    },
    onSettled: () => {
      setIsDelegating(false);
    }
  });

  // Action creators
  const delegateVotes = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    const result = await delegateVotesMutation.mutateAsync({ evermarkId, amount });
    return result;
  }, [delegateVotesMutation]);

  const undelegateVotes = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    const result = await undelegateVotesMutation.mutateAsync({ evermarkId, amount });
    return result;
  }, [undelegateVotesMutation]);

  const delegateVotesBatch = useCallback(async (delegations: { evermarkId: string; amount: bigint }[]): Promise<VotingTransaction> => {
    const result = await batchDelegateVotesMutation.mutateAsync(delegations);
    return result;
  }, [batchDelegateVotesMutation]);

  // Utility functions
  const validateVoteAmount = useCallback((amount: string, evermarkId?: string): VotingValidation => {
    if (!votingPower) {
      return {
        isValid: false,
        errors: ['Voting power not loaded'],
        warnings: []
      };
    }
    
    return VotingService.validateVoteAmount(
      amount,
      votingPower.available,
      evermarkId,
      userAddress
    );
  }, [votingPower, userAddress]);

  const calculateVotingPower = useCallback((stakedAmount: bigint): bigint => {
    return VotingService.calculateVotingPower(stakedAmount);
  }, []);

  const formatVoteAmount = useCallback((amount: bigint, decimals = 2): string => {
    return VotingService.formatVoteAmount(amount, decimals);
  }, []);

  const getTimeRemainingInCycle = useCallback((): number => {
    if (!timeRemainingRaw) return 0;
    return Number(timeRemainingRaw);
  }, [timeRemainingRaw]);

  // State management functions
  const clearErrors = useCallback(() => {
    setError(null);
  }, []);

  const clearSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  const refetch = useCallback(async (): Promise<void> => {
    await Promise.all([
      refetchCycle(),
      refetchCycleInfo(),
      refetchTimeRemaining(),
      refetchDelegations()
    ]);
  }, [refetchCycle, refetchCycleInfo, refetchTimeRemaining, refetchDelegations]);

  const isLoading = isLoadingCycle || isLoadingCycleInfo || isLoadingDelegations;

  return {
    // Data
    votingPower,
    currentDelegations,
    votingHistory: delegationHistoryData || [],
    currentCycle,
    votingStats,
    
    // Evermark-specific data
    getEvermarkVotes,
    getUserVotes,
    
    // UI State
    isLoading,
    isDelegating: isDelegating || delegateVotesMutation.isPending || batchDelegateVotesMutation.isPending,
    isUndelegating: isUndelegating || undelegateVotesMutation.isPending,
    error,
    success,
    
    // Actions
    delegateVotes,
    undelegateVotes,
    delegateVotesBatch,
    
    // Utilities
    validateVoteAmount,
    calculateVotingPower,
    formatVoteAmount,
    getTimeRemainingInCycle,
    
    // State management
    clearErrors,
    clearSuccess,
    refetch,
    
    // Connection status
    isConnected,
    userAddress
  };
}