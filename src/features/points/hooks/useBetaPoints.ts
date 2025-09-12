import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { PointsService } from '../services/PointsService';
import type { UseBetaPointsReturn, BetaPointsRecord, PointTransaction, LeaderboardEntry } from '../types';

export function useBetaPoints(): UseBetaPointsReturn {
  const [error, setError] = useState<string | null>(null);
  const account = useWalletAccount();
  const userAddress = account?.address;
  const queryClient = useQueryClient();

  // Fetch user points and transactions
  const { data: userPointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ['beta-points', 'user', userAddress],
    queryFn: () => userAddress ? PointsService.getUserPoints(userAddress) : Promise.resolve(null),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!userAddress
  });

  // Fetch leaderboard
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ['beta-points', 'leaderboard'],
    queryFn: () => PointsService.getLeaderboard(),
    staleTime: 60 * 1000, // 1 minute
  });

  const awardPoints = useCallback(async (
    actionType: 'create_evermark' | 'vote' | 'stake' | 'marketplace_buy' | 'marketplace_sell',
    relatedId?: string,
    txHash?: string,
    stakeAmount?: string
  ): Promise<void> => {
    if (!userAddress) {
      throw new Error('Wallet not connected');
    }

    setError(null);

    try {
      await PointsService.awardPoints(userAddress, actionType, relatedId, txHash, stakeAmount);
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['beta-points'] });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to award points';
      setError(errorMessage);
      throw error;
    }
  }, [userAddress, queryClient]);

  const refresh = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['beta-points'] });
  }, [queryClient]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Data
    userPoints: userPointsData?.points || null,
    transactions: userPointsData?.transactions || [],
    leaderboard,
    
    // State
    isLoading: pointsLoading || leaderboardLoading,
    error,
    
    // Actions
    awardPoints,
    refresh,
    clearError
  };
}