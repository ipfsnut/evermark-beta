// src/features/staking/hooks/useStakingData.ts
import { useMemo } from 'react';
import { useReadContract } from "thirdweb/react";
import { useContracts } from '@/hooks/core/useContracts';
import { devLog } from '@/utils/debug';

export interface StakingData {
  // Token balances
  emarkBalance: bigint;
  wEmarkBalance: bigint;
  totalStaked: bigint;
  stakingAllowance: bigint;
  
  // Voting power
  availableVotingPower: bigint;
  delegatedPower: bigint;
  
  // Unbonding state
  unbondingAmount: bigint;
  unbondingReleaseTime: bigint;
  canClaimUnbonding: boolean;
  isUnbonding: boolean;
  
  // Loading states
  isLoading: boolean;
  hasError: boolean;
  
  // Utility functions
  refetchAllowance: () => void;
}

export function useStakingData(userAddress?: string): StakingData {
  const { wemark, emarkToken } = useContracts();
  const effectiveAddress = userAddress || '0x0000000000000000000000000000000000000000';
  
  // EMARK token balance
  const { data: emarkBalance, isLoading: emarkLoading } = useReadContract({
    contract: emarkToken,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // wEMARK balance (staked tokens)
  const { data: wEmarkBalance, isLoading: wEmarkLoading } = useReadContract({
    contract: wemark,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // EMARK allowance for staking contract
  const { data: stakingAllowance, isLoading: allowanceLoading, refetch: refetchAllowance } = useReadContract({
    contract: emarkToken,
    method: "function allowance(address,address) view returns (uint256)",
    params: [effectiveAddress, wemark.address],
  });
  
  // Available voting power
  const { data: availableVotingPower, isLoading: votingLoading } = useReadContract({
    contract: wemark,
    method: "function getVotingPower(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // Delegated voting power (not applicable for WEMARK - non-transferable)
  const { data: delegatedPower, isLoading: delegatedLoading } = useReadContract({
    contract: wemark,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // User staking info (includes unbonding)
  const { data: userInfo, isLoading: unbondingLoading, error: unbondingError } = useReadContract({
    contract: wemark,
    method: "function getUserInfo(address) view returns (uint256,uint256,uint256,bool)",
    params: [effectiveAddress],
  });
  
  // Can withdraw check
  const { data: canWithdraw, isLoading: summaryLoading } = useReadContract({
    contract: wemark,
    method: "function canWithdraw(address) view returns (bool)",
    params: [effectiveAddress],
  });
  
  const stakingData = useMemo(() => {
    // Parse user info from WEMARK: (stakedBalance, unbonding, withdrawTime, canWithdrawNow)
    const stakedBalance = userInfo?.[0] || BigInt(0);
    const unbondingAmount = userInfo?.[1] || BigInt(0);
    const unbondingReleaseTime = userInfo?.[2] || BigInt(0);
    const canClaimUnbonding = userInfo?.[3] || canWithdraw || false;
    
    // Voting power is the wEMARK balance
    const availableVoting = availableVotingPower || BigInt(0);
    const delegated = BigInt(0); // WEMARK is non-transferable, no delegation
    
    const isLoading = emarkLoading || wEmarkLoading || allowanceLoading || votingLoading || 
                     delegatedLoading || unbondingLoading || summaryLoading;
    
    const hasError = !!unbondingError;
    
    const isUnbonding = unbondingAmount > BigInt(0);
    
    devLog("Staking data loaded:", {
      userAddress: effectiveAddress,
      emarkBalance: emarkBalance?.toString() || '0',
      wEmarkBalance: wEmarkBalance?.toString() || '0', 
      stakedBalance: stakedBalance?.toString() || '0',
      availableVotingPower: availableVoting?.toString() || '0',
      delegatedPower: delegated?.toString() || '0',
      unbondingAmount: unbondingAmount?.toString() || '0',
      unbondingReleaseTime: unbondingReleaseTime?.toString() || '0',
      canClaimUnbonding,
      isUnbonding,
      isLoading,
      hasError
    });
    
    return {
      // Token balances
      emarkBalance: emarkBalance || BigInt(0),
      wEmarkBalance: wEmarkBalance || BigInt(0),
      totalStaked: stakedBalance,
      stakingAllowance: stakingAllowance || BigInt(0),
      
      // Voting power
      availableVotingPower: availableVoting,
      delegatedPower: delegated,
      
      // Unbonding state
      unbondingAmount,
      unbondingReleaseTime,
      canClaimUnbonding,
      isUnbonding,
      
      // Loading states
      isLoading,
      hasError,
      
      // Utility functions
      refetchAllowance
    };
  }, [
    emarkBalance,
    wEmarkBalance, 
    stakingAllowance,
    availableVotingPower,
    delegatedPower,
    userInfo,
    canWithdraw,
    emarkLoading,
    wEmarkLoading,
    allowanceLoading,
    votingLoading,
    delegatedLoading,
    unbondingLoading,
    summaryLoading,
    unbondingError,
    effectiveAddress,
    refetchAllowance
  ]);
  
  return stakingData;
}