import { useMemo } from 'react';
import { useReadContract, useActiveAccount } from 'thirdweb/react';
import { useContracts } from './useContracts';

export interface UserBalances {
  emarkBalance: bigint;
  wEmarkBalance: bigint;
  totalStaked: bigint;
  stakingAllowance: bigint;
}

export interface UserVoting {
  availableVotingPower: bigint;
  delegatedPower: bigint;
  reservedPower: bigint;
}

export interface UserUnbonding {
  unbondingAmount: bigint;
  unbondingReleaseTime: bigint;
  canClaimUnbonding: boolean;
  timeUntilRelease: number;
  isUnbonding: boolean;
}

export function useUserData(userAddress?: string) {
  const account = useActiveAccount();
  const contracts = useContracts();
  
  const effectiveAddress = userAddress || account?.address;
  const hasWallet = !!account;

  // EMARK token balance - only query if contract exists
  const { data: emarkBalance, refetch: refetchEmarkBalance } = useReadContract({
    contract: contracts.emarkToken,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress ?? '0x0000000000000000000000000000000000000000'],
    queryOptions: {
      enabled: !!contracts.emarkToken && !!effectiveAddress
    }
  });

  // EMARK allowance for staking contract
  const { data: stakingAllowance, refetch: refetchAllowance } = useReadContract({
    contract: contracts.emarkToken,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: [effectiveAddress ?? '0x0000000000000000000000000000000000000000', contracts.wemark?.address ?? '0x0000000000000000000000000000000000000000'],
    queryOptions: {
      enabled: !!contracts.emarkToken && !!contracts.wemark && !!effectiveAddress
    }
  });

  // wEMARK balance (from CardCatalog)
  const { data: wEmarkBalance, refetch: refetchWEmarkBalance } = useReadContract({
    contract: contracts.wemark,
    method: "function balanceOf(address) view returns (uint256)",
    params: [effectiveAddress ?? '0x0000000000000000000000000000000000000000'],
    queryOptions: {
      enabled: !!contracts.wemark && !!effectiveAddress
    }
  });

  // User staking summary
  const { data: userSummary, refetch: refetchSummary } = useReadContract({
    contract: contracts.wemark,
    method: "function getUserSummary(address) view returns (uint256 stakedBalance, uint256 availableVotingPower, uint256 delegatedPower, uint256 unbondingAmount_, uint256 unbondingReleaseTime_, bool canClaimUnbonding)",
    params: [effectiveAddress ?? '0x0000000000000000000000000000000000000000'],
    queryOptions: {
      enabled: !!contracts.wemark && !!effectiveAddress
    }
  });

  // Memoized data structures
  const balances: UserBalances = useMemo(() => ({
    emarkBalance: emarkBalance ?? BigInt(0),
    wEmarkBalance: wEmarkBalance ?? BigInt(0),
    totalStaked: userSummary?.[0] ?? BigInt(0),
    stakingAllowance: stakingAllowance ?? BigInt(0)
  }), [emarkBalance, wEmarkBalance, userSummary, stakingAllowance]);

  const voting: UserVoting = useMemo(() => ({
    availableVotingPower: userSummary?.[1] ?? BigInt(0),
    delegatedPower: userSummary?.[2] ?? BigInt(0),
    reservedPower: BigInt(0) // Would be calculated from available - delegated
  }), [userSummary]);

  const unbonding: UserUnbonding = useMemo(() => {
    const unbondingAmount = userSummary?.[3] ?? BigInt(0);
    const unbondingReleaseTime = userSummary?.[4] ?? BigInt(0);
    const canClaimUnbonding = userSummary?.[5] ?? false;
    
    const releaseTimeMs = Number(unbondingReleaseTime) * 1000;
    const currentTimeMs = Date.now();
    const timeUntilRelease = Math.max(0, Math.floor((releaseTimeMs - currentTimeMs) / 1000));
    const isUnbonding = unbondingAmount > BigInt(0);

    return {
      unbondingAmount,
      unbondingReleaseTime,
      canClaimUnbonding,
      timeUntilRelease,
      isUnbonding
    };
  }, [userSummary]);

  // Refetch all data
  const refetch = async () => {
    // Fixed: Properly type the refetch promises array
    const refetchPromises: Promise<any>[] = [];
    
    if (refetchEmarkBalance) refetchPromises.push(refetchEmarkBalance());
    if (refetchAllowance) refetchPromises.push(refetchAllowance());
    if (refetchWEmarkBalance) refetchPromises.push(refetchWEmarkBalance());
    if (refetchSummary) refetchPromises.push(refetchSummary());
    
    await Promise.all(refetchPromises);
  };

  return {
    balances,
    voting,
    unbonding,
    refetch,
    hasWallet,
    userAddress: effectiveAddress
  };
}