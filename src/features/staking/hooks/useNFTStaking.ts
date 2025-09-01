import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { NFTStakingService, type NFTStakeInfo, type NFTStakingStats } from '../services/NFTStakingService';

export interface UseNFTStakingReturn {
  // Data
  stakedNFTs: number[];
  stakingStats: NFTStakingStats | undefined;
  isLoading: boolean;
  error: string | null;

  // Actions
  stakeNFT: (tokenId: number) => Promise<void>;
  unstakeNFT: (tokenId: number) => Promise<void>;
  getStakeInfo: (tokenId: number) => Promise<NFTStakeInfo | null>;
  isNFTStaked: (tokenId: number) => Promise<boolean>;
  emergencyUnstake: (tokenId: number) => Promise<void>;

  // Utils
  formatStakingTime: (seconds: bigint) => string;
  calculateRewards: (stakedTime: bigint) => Promise<number>;
  
  // State
  isStaking: boolean;
  isUnstaking: boolean;
  stakingError: string | null;
}

const QUERY_KEYS = {
  stakedNFTs: (address: string) => ['nft-staking', 'staked', address],
  stakingStats: (address: string) => ['nft-staking', 'stats', address],
  stakeInfo: (address: string, tokenId: number) => ['nft-staking', 'info', address, tokenId],
  isStaked: (tokenId: number) => ['nft-staking', 'is-staked', tokenId],
} as const;

export function useNFTStaking(): UseNFTStakingReturn {
  const account = useWalletAccount();
  const queryClient = useQueryClient();
  
  // Local state
  const [stakingError, setStakingError] = useState<string | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);

  // Query user's staked NFTs
  const { 
    data: stakedNFTs = [], 
    isLoading: stakedLoading, 
    error: stakedError 
  } = useQuery({
    queryKey: QUERY_KEYS.stakedNFTs(account?.address || ''),
    queryFn: () => NFTStakingService.getUserStakedNFTs(account!.address),
    enabled: !!account?.address,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Query staking statistics
  const { 
    data: stakingStats, 
    isLoading: statsLoading 
  } = useQuery({
    queryKey: QUERY_KEYS.stakingStats(account?.address || ''),
    queryFn: () => NFTStakingService.getStakingStats(account?.address),
    enabled: !!account?.address,
    refetchInterval: 60000, // Refetch every minute
  });

  // Stake NFT mutation
  const stakeMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      if (!account) throw new Error('Wallet not connected');
      const result = await NFTStakingService.stakeNFT(account, tokenId);
      if (!result.success) {
        throw new Error(result.error || 'Staking failed');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate and refetch staking queries
      queryClient.invalidateQueries({ 
        queryKey: ['nft-staking'] 
      });
      setStakingError(null);
    },
    onError: (error: Error) => {
      setStakingError(error.message);
    },
  });

  // Unstake NFT mutation
  const unstakeMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      if (!account) throw new Error('Wallet not connected');
      const result = await NFTStakingService.unstakeNFT(account, tokenId);
      if (!result.success) {
        throw new Error(result.error || 'Unstaking failed');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate and refetch staking queries
      queryClient.invalidateQueries({ 
        queryKey: ['nft-staking'] 
      });
      setStakingError(null);
    },
    onError: (error: Error) => {
      setStakingError(error.message);
    },
  });

  // Emergency unstake mutation
  const emergencyUnstakeMutation = useMutation({
    mutationFn: async (tokenId: number) => {
      if (!account) throw new Error('Wallet not connected');
      const result = await NFTStakingService.emergencyUnstake(account, tokenId);
      if (!result.success) {
        throw new Error(result.error || 'Emergency unstake failed');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['nft-staking'] 
      });
      setStakingError(null);
    },
    onError: (error: Error) => {
      setStakingError(error.message);
    },
  });

  // Actions
  const stakeNFT = useCallback(async (tokenId: number) => {
    setIsStaking(true);
    setStakingError(null);
    try {
      await stakeMutation.mutateAsync(tokenId);
    } finally {
      setIsStaking(false);
    }
  }, [stakeMutation]);

  const unstakeNFT = useCallback(async (tokenId: number) => {
    setIsUnstaking(true);
    setStakingError(null);
    try {
      await unstakeMutation.mutateAsync(tokenId);
    } finally {
      setIsUnstaking(false);
    }
  }, [unstakeMutation]);

  const emergencyUnstake = useCallback(async (tokenId: number) => {
    setIsUnstaking(true);
    setStakingError(null);
    try {
      await emergencyUnstakeMutation.mutateAsync(tokenId);
    } finally {
      setIsUnstaking(false);
    }
  }, [emergencyUnstakeMutation]);

  const getStakeInfo = useCallback(async (tokenId: number): Promise<NFTStakeInfo | null> => {
    if (!account?.address) return null;
    return NFTStakingService.getStakeInfo(account.address, tokenId);
  }, [account?.address]);

  const isNFTStaked = useCallback(async (tokenId: number): Promise<boolean> => {
    return NFTStakingService.isNFTStaked(tokenId);
  }, []);

  // Computed values
  const isLoading = stakedLoading || statsLoading;
  const error = stakedError?.message || stakingError;

  return useMemo(() => ({
    // Data
    stakedNFTs,
    stakingStats,
    isLoading,
    error,

    // Actions
    stakeNFT,
    unstakeNFT,
    getStakeInfo,
    isNFTStaked,
    emergencyUnstake,

    // Utils
    formatStakingTime: NFTStakingService.formatStakingTime,
    calculateRewards: NFTStakingService.calculateEstimatedRewards,

    // State
    isStaking: isStaking || stakeMutation.isPending,
    isUnstaking: isUnstaking || unstakeMutation.isPending || emergencyUnstakeMutation.isPending,
    stakingError,
  }), [
    stakedNFTs,
    stakingStats,
    isLoading,
    error,
    stakeNFT,
    unstakeNFT,
    getStakeInfo,
    isNFTStaked,
    emergencyUnstake,
    isStaking,
    isUnstaking,
    stakingError,
    stakeMutation.isPending,
    unstakeMutation.isPending,
    emergencyUnstakeMutation.isPending,
  ]);
}