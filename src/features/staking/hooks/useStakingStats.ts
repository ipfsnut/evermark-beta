// src/features/staking/hooks/useStakingStats.ts
import { useMemo } from 'react';
import { useReadContract } from "thirdweb/react";
import { useContracts } from '@/hooks/core/useContracts';

export interface StakingStatsData {
  // Protocol stats
  unbondingPeriod: number; // in seconds
  unbondingPeriodDays: number; // converted to days
  totalProtocolStaked: bigint;
  totalSupply: bigint;
  totalUnbonding: bigint;
  activeStakers: number;
  
  // Calculated metrics
  stakingRatio: number; // percentage of total supply staked
  formatUnbondingPeriod: () => string;
  
  // Loading state
  isLoading: boolean;
}

export function useStakingStats(): StakingStatsData {
  const { cardCatalog, emarkToken } = useContracts();
  
  // Unbonding period constant
  const { data: unbondingPeriod, isLoading: periodLoading } = useReadContract({
    contract: cardCatalog,
    method: "function UNBONDING_PERIOD() view returns (uint256)",
    params: [],
  });
  
  // Total staked EMARK in protocol
  const { data: totalStaked, isLoading: stakedLoading } = useReadContract({
    contract: cardCatalog,
    method: "function getTotalStakedEmark() view returns (uint256)",
    params: [],
  });
  
  // Total wEMARK supply (should match total staked)
  const { data: wEmarkSupply, isLoading: supplyLoading } = useReadContract({
    contract: cardCatalog,
    method: "function totalSupply() view returns (uint256)",
    params: [],
  });
  
  // Total unbonding amount across all users
  const { data: totalUnbonding, isLoading: unbondingLoading } = useReadContract({
    contract: cardCatalog,
    method: "function totalUnbondingAmount() view returns (uint256)",
    params: [],
  });
  
  // EMARK token total supply for ratio calculations
  const { data: emarkTotalSupply, isLoading: emarkSupplyLoading } = useReadContract({
    contract: emarkToken,
    method: "function totalSupply() view returns (uint256)",
    params: [],
  });
  
  // Get comprehensive staking stats (includes active stakers count)
  const { data: stakingStats, isLoading: statsLoading } = useReadContract({
    contract: cardCatalog,
    method: "function getStakingStats() view returns (uint256,uint256,uint256,uint256)",
    params: [],
  });
  
  const stakingStatsData = useMemo(() => {
    const periodInSeconds = unbondingPeriod ? Number(unbondingPeriod) : 604800; // Default 7 days
    const periodInDays = Math.floor(periodInSeconds / (24 * 60 * 60));
    
    const totalProtocolStaked = totalStaked || BigInt(0);
    const totalEmarkSupply = emarkTotalSupply || BigInt(1); // Prevent division by zero
    const totalUnbondingAmount = totalUnbonding || BigInt(0);
    
    // Parse staking stats if available
    // Returns: (totalWEmark, totalLiquidEmark, totalUnbonding, activeStakers)
    const activeStakers = stakingStats ? Number(stakingStats[3]) : 0;
    const totalWEmark = stakingStats?.[0] || wEmarkSupply || BigInt(0);
    const liquidEmark = stakingStats?.[1] || BigInt(0);
    
    // Calculate staking ratio (percentage of total EMARK supply that's staked)
    const stakingRatio = totalEmarkSupply > BigInt(0) 
      ? (Number(totalProtocolStaked) / Number(totalEmarkSupply)) * 100
      : 0;
    
    const isLoading = periodLoading || stakedLoading || supplyLoading || 
                     unbondingLoading || emarkSupplyLoading || statsLoading;
    
    const formatUnbondingPeriod = () => {
      if (periodInDays === 1) return '1 day';
      if (periodInDays === 7) return '1 week';
      if (periodInDays === 14) return '2 weeks';
      if (periodInDays === 30) return '1 month';
      return `${periodInDays} days`;
    };
    
    console.log("📈 Staking stats loaded:", {
      unbondingPeriod: periodInSeconds,
      unbondingPeriodDays: periodInDays,
      totalProtocolStaked: totalProtocolStaked.toString(),
      totalEmarkSupply: totalEmarkSupply.toString(),
      totalUnbonding: totalUnbondingAmount.toString(),
      activeStakers,
      stakingRatio: stakingRatio.toFixed(2) + '%',
      wEmarkSupply: totalWEmark.toString(),
      liquidEmark: liquidEmark.toString(),
      isLoading
    });
    
    return {
      // Protocol stats
      unbondingPeriod: periodInSeconds,
      unbondingPeriodDays: periodInDays,
      totalProtocolStaked,
      totalSupply: totalEmarkSupply,
      totalUnbonding: totalUnbondingAmount,
      activeStakers,
      
      // Calculated metrics
      stakingRatio,
      formatUnbondingPeriod,
      
      // Loading state
      isLoading
    };
  }, [
    unbondingPeriod,
    totalStaked,
    wEmarkSupply,
    totalUnbonding,
    emarkTotalSupply,
    stakingStats,
    periodLoading,
    stakedLoading,
    supplyLoading,
    unbondingLoading,
    emarkSupplyLoading,
    statsLoading
  ]);
  
  return stakingStatsData;
}