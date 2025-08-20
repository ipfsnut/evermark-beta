// src/features/staking/hooks/useStakingStats.ts
import { useMemo } from 'react';
import { useReadContract } from "thirdweb/react";
import { useContracts } from '@/hooks/core/useContracts';
import { devLog } from '@/utils/debug';

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
  
  // Real-time APR data
  realTimeAPR: number; // calculated from contract reward data
  weeklyRewards: bigint; // weekly reward pool allocation
  dailyRewards: bigint; // daily reward allocation
  
  // Loading state
  isLoading: boolean;
}

export function useStakingStats(): StakingStatsData {
  const { wemark, emarkToken, evermarkRewards } = useContracts();
  
  // Unbonding period is fixed at 7 days for WEMARK
  const unbondingPeriod = BigInt(7 * 24 * 60 * 60); // 7 days in seconds
  const periodLoading = false;
  
  // Total staked EMARK in protocol
  const { data: totalStaked, isLoading: stakedLoading } = useReadContract({
    contract: wemark,
    method: "function getTotalStaked() view returns (uint256)",
    params: [],
  });
  
  // Total wEMARK supply (should match total staked)
  const { data: wEmarkSupply, isLoading: supplyLoading } = useReadContract({
    contract: wemark,
    method: "function totalSupply() view returns (uint256)",
    params: [],
  });
  
  // Total unbonding amount across all users (approximated)
  const totalUnbonding = BigInt(0); // WEMARK doesn't track global unbonding
  const unbondingLoading = false;
  
  // EMARK token total supply for ratio calculations
  const { data: emarkTotalSupply, isLoading: emarkSupplyLoading } = useReadContract({
    contract: emarkToken,
    method: "function totalSupply() view returns (uint256)",
    params: [],
  });
  
  // Reward distribution rate from EvermarkRewards contract
  const { data: emarkDistributionRate, isLoading: distributionRateLoading } = useReadContract({
    contract: evermarkRewards,
    method: "function emarkDistributionRate() view returns (uint256)",
    params: [],
  });
  
  // Rebalance period (weekly cycle)
  const { data: rebalancePeriod, isLoading: rebalancePeriodLoading } = useReadContract({
    contract: evermarkRewards,
    method: "function rebalancePeriod() view returns (uint256)",
    params: [],
  });
  
  // Current reward pool snapshots
  const { data: currentEmarkPool, isLoading: emarkPoolLoading } = useReadContract({
    contract: evermarkRewards,
    method: "function lastEmarkPoolSnapshot() view returns (uint256)",
    params: [],
  });
  
  // Staking stats (simplified for WEMARK)
  const stakingStats = [totalStaked || BigInt(0), BigInt(0), BigInt(0), BigInt(0)];
  const statsLoading = false;
  
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
    
    // Real-time APR calculation based on weekly reward allocation
    // Formula: (weekly_token_rewards / total_staked) * 52 weeks * 100% for APR
    const calculateRealTimeAPR = (): number => {
      if (!emarkDistributionRate || !currentEmarkPool || totalProtocolStaked <= BigInt(0)) {
        return 0; // No rewards or no stakers
      }

      // The distribution rate is the percentage of pool allocated per period (in basis points)
      // If it's 10% weekly (1000 basis points), then distributionRate = 1000
      const distributionRateDecimal = Number(emarkDistributionRate) / 10000; // Convert basis points to decimal
      
      // Convert pool from wei to token amount (divide by 10^18), then multiply by distribution rate
      const poolTokens = Number(currentEmarkPool) / (10 ** 18);
      const weeklyRewardTokens = poolTokens * distributionRateDecimal;
      
      // Convert total staked from wei to token amount (divide by 10^18)
      const totalStakedTokens = Number(totalProtocolStaked) / (10 ** 18);
      
      // APR = (weekly_reward_tokens / total_staked_tokens) * 52 weeks * 100
      const apr = (weeklyRewardTokens / totalStakedTokens) * 52 * 100;
      
      // Cap APR at reasonable maximum (500%) and minimum (0%)
      return Math.max(0, Math.min(500, apr));
    };

    const realTimeAPR = calculateRealTimeAPR();
    
    // Calculate weekly and daily reward token amounts for transparency
    const weeklyRewards = currentEmarkPool && emarkDistributionRate 
      ? (currentEmarkPool * emarkDistributionRate) / BigInt(10000) // Pool tokens * percentage = weekly token rewards
      : BigInt(0);
    
    const dailyRewards = weeklyRewards / BigInt(7); // Daily token rewards
    
    const isLoading = periodLoading || stakedLoading || supplyLoading || 
                     unbondingLoading || emarkSupplyLoading || statsLoading ||
                     distributionRateLoading || rebalancePeriodLoading || emarkPoolLoading;
    
    const formatUnbondingPeriod = () => {
      if (periodInDays === 1) return '1 day';
      if (periodInDays === 7) return '1 week';
      if (periodInDays === 14) return '2 weeks';
      if (periodInDays === 30) return '1 month';
      return `${periodInDays} days`;
    };
    
    devLog("Staking stats loaded:", {
      unbondingPeriod: periodInSeconds,
      unbondingPeriodDays: periodInDays,
      totalProtocolStaked: totalProtocolStaked.toString(),
      totalEmarkSupply: totalEmarkSupply.toString(),
      totalUnbonding: totalUnbondingAmount.toString(),
      activeStakers,
      stakingRatio: stakingRatio.toFixed(2) + '%',
      wEmarkSupply: totalWEmark.toString(),
      liquidEmark: liquidEmark.toString(),
      // New reward calculation data
      emarkDistributionRate: emarkDistributionRate?.toString(),
      rebalancePeriod: rebalancePeriod?.toString(),
      currentEmarkPool: currentEmarkPool?.toString(),
      weeklyRewards: weeklyRewards.toString(),
      dailyRewards: dailyRewards.toString(),
      realTimeAPR: realTimeAPR.toFixed(2) + '%',
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
      
      // Real-time APR data
      realTimeAPR,
      weeklyRewards,
      dailyRewards,
      
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
    emarkDistributionRate,
    rebalancePeriod,
    currentEmarkPool,
    periodLoading,
    stakedLoading,
    supplyLoading,
    unbondingLoading,
    emarkSupplyLoading,
    statsLoading,
    distributionRateLoading,
    rebalancePeriodLoading,
    emarkPoolLoading
  ]);
  
  return stakingStatsData;
}