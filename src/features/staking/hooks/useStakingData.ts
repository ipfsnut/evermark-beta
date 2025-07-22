// src/features/staking/hooks/useStakingData.ts
import { useMemo } from 'react';
import { useReadContract } from "thirdweb/react";
import { useContracts } from '@/hooks/core/useContracts';

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
}

export function useStakingData(userAddress?: string): StakingData {
  const { cardCatalog, emarkToken } = useContracts();
  const effectiveAddress = userAddress || '0x0000000000000000000000000000000000000000';
  
  // EMARK token balance
  const { data: emarkBalance, isLoading: emarkLoading } = useReadContract({
    contract: emarkToken,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // wEMARK balance (staked tokens)
  const { data: wEmarkBalance, isLoading: wEmarkLoading } = useReadContract({
    contract: cardCatalog,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // EMARK allowance for staking contract
  const { data: stakingAllowance, isLoading: allowanceLoading } = useReadContract({
    contract: emarkToken,
    method: "function allowance(address,address) view returns (uint256)",
    params: [effectiveAddress, cardCatalog.address],
  });
  
  // Available voting power
  const { data: availableVotingPower, isLoading: votingLoading } = useReadContract({
    contract: cardCatalog,
    method: "function getAvailableVotingPower(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // Delegated voting power
  const { data: delegatedPower, isLoading: delegatedLoading } = useReadContract({
    contract: cardCatalog,
    method: "function getDelegatedVotingPower(address) view returns (uint256)",
    params: [effectiveAddress],
  });
  
  // Unbonding information
  const { data: unbondingInfo, isLoading: unbondingLoading, error: unbondingError } = useReadContract({
    contract: cardCatalog,
    method: "function getUnbondingInfo(address) view returns (uint256,uint256,bool)",
    params: [effectiveAddress],
  });
  
  // User staking summary (includes additional data)
  const { data: userSummary, isLoading: summaryLoading } = useReadContract({
    contract: cardCatalog,
    method: "function getUserSummary(address) view returns (uint256,uint256,uint256,uint256,uint256,bool)",
    params: [effectiveAddress],
  });
  
  const stakingData = useMemo(() => {
    // Parse unbonding info
    const unbondingAmount = unbondingInfo?.[0] || BigInt(0);
    const unbondingReleaseTime = unbondingInfo?.[1] || BigInt(0);
    const canClaimUnbonding = unbondingInfo?.[2] || false;
    
    // Parse user summary (if available)
    const stakedBalance = userSummary?.[0] || wEmarkBalance || BigInt(0);
    const availableVoting = userSummary?.[1] || availableVotingPower || BigInt(0);
    const delegated = userSummary?.[2] || delegatedPower || BigInt(0);
    
    const isLoading = emarkLoading || wEmarkLoading || allowanceLoading || votingLoading || 
                     delegatedLoading || unbondingLoading || summaryLoading;
    
    const hasError = !!unbondingError;
    
    const isUnbonding = unbondingAmount > BigInt(0);
    
    console.log("📊 Staking data loaded:", {
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
      hasError
    };
  }, [
    emarkBalance,
    wEmarkBalance, 
    stakingAllowance,
    availableVotingPower,
    delegatedPower,
    unbondingInfo,
    userSummary,
    emarkLoading,
    wEmarkLoading,
    allowanceLoading,
    votingLoading,
    delegatedLoading,
    unbondingLoading,
    summaryLoading,
    unbondingError,
    effectiveAddress
  ]);
  
  return stakingData;
}