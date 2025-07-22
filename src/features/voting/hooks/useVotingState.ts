// src/features/voting/hooks/useVotingState.ts - Fixed error handling
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReadContract, useSendTransaction } from 'thirdweb/react';
import { useActiveAccount } from 'thirdweb/react';
import { prepareContractCall, waitForReceipt } from 'thirdweb';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN, CONTRACTS } from '@/lib/contracts';
import { EvermarkVotingABI } from '@/lib/abis';
import { useStakingState } from '@/features/staking';
import { VotingService } from '../services/VotingService';
import type { 
  VotingPower, 
  VotingCycle, 
  Delegation, 
  VotingStats, 
  VotingValidation, 
  VotingError, 
  VotingTransaction, 
  Vote, 
  UseVotingStateReturn,
  VotingErrorCode
} from '../types';
import { VOTING_ERRORS } from '../types';

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

export function useVotingState(): UseVotingStateReturn {
  const [error, setError] = useState<VotingError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  
  const votingContract = useMemo(() => getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EVERMARK_VOTING,
    abi: EvermarkVotingABI
  }), []);
  
  const userAddress = account?.address;
  const isConnected = !!account && !!userAddress;
  
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

  // User's remaining voting power
  const { 
    data: remainingVotingPowerRaw,
    refetch: refetchVotingPower
  } = useReadContract({
    contract: votingContract,
    method: "function getRemainingVotingPower(address) view returns (uint256)",
    params: userAddress ? [userAddress] : undefined,
  });

  // User's delegation history from contract events
  const { 
    data: delegationHistoryData,
    isLoading: isLoadingDelegations,
    refetch: refetchDelegations
  } = useQuery({
    queryKey: QUERY_KEYS.delegationHistory(userAddress),
    queryFn: async () => {
      if (!userAddress || !currentCycleNumber) return [];
      
      // Fetch from last 10 cycles or 30 days, whichever is more
      const fromBlock = BigInt(Math.max(0, Number(currentCycleNumber) - 10));
      
      return VotingService.fetchDelegationHistory(
        userAddress, 
        votingContract,
        fromBlock
      );
    },
    enabled: !!userAddress && !!currentCycleNumber,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Voting power calculation from staking + contract data
  const votingPower: VotingPower | null = useMemo(() => {
    if (!stakingInfo || remainingVotingPowerRaw === undefined) return null;
    
    const available = remainingVotingPowerRaw || BigInt(0);
    const total = stakingInfo.totalStaked;
    const delegated = total - available;
    
    return {
      total,
      available,
      delegated,
      reserved: BigInt(0) // Could be calculated from pending transactions
    };
  }, [stakingInfo, remainingVotingPowerRaw]);

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
      currentCycle,
      delegationHistoryData
    );
  }, [votingPower, currentDelegations, currentCycle, delegationHistoryData]);

  // Get votes for specific evermark
  const getEvermarkVotes = useCallback(async (evermarkId: string): Promise<bigint> => {
    if (!currentCycleNumber) return BigInt(0);
    
    try {
      return await VotingService.getEvermarkVotes(
        evermarkId, 
        Number(currentCycleNumber), 
        votingContract
      );
    } catch (error) {
      console.error(`Failed to get evermark votes for ${evermarkId}:`, error);
      return BigInt(0);
    }
  }, [currentCycleNumber, votingContract]);

  // Get user's votes for specific evermark
  const getUserVotes = useCallback(async (evermarkId: string): Promise<bigint> => {
    if (!userAddress || !currentCycleNumber) return BigInt(0);
    
    try {
      return await VotingService.getUserVotes(
        userAddress,
        evermarkId,
        Number(currentCycleNumber),
        votingContract
      );
    } catch (error) {
      console.error(`Failed to get user votes for ${evermarkId}:`, error);
      return BigInt(0);
    }
  }, [userAddress, currentCycleNumber, votingContract]);

  // Helper function to create and handle voting errors properly
  const createVotingError = useCallback((code: VotingErrorCode, message: string, details?: Record<string, any>): VotingError => {
    return VotingService.createError(code, message, details);
  }, []);

  // Delegate votes mutation
  const delegateVotesMutation = useMutation({
    mutationFn: async ({ evermarkId, amount }: { evermarkId: string; amount: bigint }) => {
      if (!account) {
        throw createVotingError(
          VOTING_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setError(null);

      try {
        const transaction = prepareContractCall({
          contract: votingContract,
          method: "function delegateVotes(uint256 evermarkId, uint256 amount)",
          params: [BigInt(evermarkId), amount]
        });

        const result = await sendTransaction(transaction);

        // Wait for confirmation
        const receipt = await waitForReceipt({
          client,
          chain: CHAIN,
          transactionHash: result.transactionHash
        });

        const votingTransaction: VotingTransaction = {
          hash: result.transactionHash,
          type: 'delegate',
          evermarkId,
          amount,
          timestamp: new Date(),
          status: 'confirmed',
          gasUsed: receipt.gasUsed
        };

        return votingTransaction;
      } catch (error: any) {
        console.error('Delegation failed:', error);
        throw VotingService.parseContractError(error);
      }
    },
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegationHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.votingPower(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evermarkVotes(transaction.evermarkId) });
      refetchVotingPower();
      
      setSuccess(`Successfully delegated ${formatTokenAmount(transaction.amount)} wEMARK to Evermark #${transaction.evermarkId}`);
    },
    onError: (error: VotingError) => {
      setError(error);
    }
  });

  // Undelegate votes mutation
  const undelegateVotesMutation = useMutation({
    mutationFn: async ({ evermarkId, amount }: { evermarkId: string; amount: bigint }) => {
      if (!account) {
        throw createVotingError(
          VOTING_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setError(null);

      try {
        const transaction = prepareContractCall({
          contract: votingContract,
          method: "function undelegateVotes(uint256 evermarkId, uint256 amount)",
          params: [BigInt(evermarkId), amount]
        });

        const result = await sendTransaction(transaction);

        const receipt = await waitForReceipt({
          client,
          chain: CHAIN,
          transactionHash: result.transactionHash
        });

        const votingTransaction: VotingTransaction = {
          hash: result.transactionHash,
          type: 'undelegate',
          evermarkId,
          amount,
          timestamp: new Date(),
          status: 'confirmed',
          gasUsed: receipt.gasUsed
        };

        return votingTransaction;
      } catch (error: any) {
        console.error('Undelegation failed:', error);
        throw VotingService.parseContractError(error);
      }
    },
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegationHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.votingPower(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.evermarkVotes(transaction.evermarkId) });
      refetchVotingPower();
      
      setSuccess(`Successfully undelegated ${formatTokenAmount(transaction.amount)} wEMARK from Evermark #${transaction.evermarkId}`);
    },
    onError: (error: VotingError) => {
      setError(error);
    }
  });

  // Batch delegate votes mutation
  const batchDelegateVotesMutation = useMutation({
    mutationFn: async (delegations: { evermarkId: string; amount: bigint }[]) => {
      if (!account) {
        throw createVotingError(
          VOTING_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setError(null);

      try {
        const evermarkIds = delegations.map(d => BigInt(d.evermarkId));
        const amounts = delegations.map(d => d.amount);

        const transaction = prepareContractCall({
          contract: votingContract,
          method: "function delegateVotesBatch(uint256[] evermarkIds, uint256[] amounts)",
          params: [evermarkIds, amounts]
        });

        const result = await sendTransaction(transaction);

        const receipt = await waitForReceipt({
          client,
          chain: CHAIN,
          transactionHash: result.transactionHash
        });

        const votingTransaction: VotingTransaction = {
          hash: result.transactionHash,
          type: 'delegate',
          evermarkId: 'batch',
          amount: amounts.reduce((sum, amount) => sum + amount, BigInt(0)),
          timestamp: new Date(),
          status: 'confirmed',
          gasUsed: receipt.gasUsed
        };

        return votingTransaction;
      } catch (error: any) {
        console.error('Batch delegation failed:', error);
        throw VotingService.parseContractError(error);
      }
    },
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.delegationHistory(userAddress) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.votingPower(userAddress) });
      refetchVotingPower();
      
      setSuccess(`Successfully delegated to multiple Evermarks`);
    },
    onError: (error: VotingError) => {
      setError(error);
    }
  });

  // Action creators
  const delegateVotes = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    return await delegateVotesMutation.mutateAsync({ evermarkId, amount });
  }, [delegateVotesMutation]);

  const undelegateVotes = useCallback(async (evermarkId: string, amount: bigint): Promise<VotingTransaction> => {
    return await undelegateVotesMutation.mutateAsync({ evermarkId, amount });
  }, [undelegateVotesMutation]);

  const delegateVotesBatch = useCallback(async (delegations: { evermarkId: string; amount: bigint }[]): Promise<VotingTransaction> => {
    return await batchDelegateVotesMutation.mutateAsync(delegations);
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
      refetchDelegations(),
      refetchVotingPower()
    ]);
  }, [refetchCycle, refetchCycleInfo, refetchTimeRemaining, refetchDelegations, refetchVotingPower]);

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
    isDelegating: delegateVotesMutation.isPending || batchDelegateVotesMutation.isPending,
    isUndelegating: undelegateVotesMutation.isPending,
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