// src/hooks/useWrapping.ts - Hook for token wrapping (staking) operations

import { useState, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useContracts } from './core/useContracts';
import { useTransactionUtils } from './core/useTransactionUtils';
import { useUserData } from './core/useUserData';

export interface UseWrappingReturn {
  // Balances and state
  emarkBalance: bigint;
  wEmarkBalance: bigint;
  totalWrapped: bigint;
  stakingAllowance: bigint;
  
  // Voting power
  availableVotingPower: bigint;
  delegatedPower: bigint;
  reservedPower: bigint;
  
  // Unbonding state
  unbondingAmount: bigint;
  unbondingReleaseTime: bigint;
  canClaimUnbonding: boolean;
  isUnbonding: boolean;
  
  // Loading states
  isWrapping: boolean;
  isUnwrapping: boolean;
  
  // Actions
  wrapTokens: (amount: bigint) => Promise<void>;
  requestUnwrap: (amount: bigint) => Promise<void>;
  completeUnwrap: () => Promise<void>;
  cancelUnbonding: () => Promise<void>;
  
  // Utilities
  refetch: () => Promise<void>;
  hasWalletAccess: boolean;
}

export function useWrapping(userAddress?: string): UseWrappingReturn {
  const account = useActiveAccount();
  const { emarkToken, cardCatalog } = useContracts();
  const { executeTransaction } = useTransactionUtils();
  const { balances, voting, unbonding, refetch } = useUserData(userAddress);
  
  const [isWrapping, setIsWrapping] = useState(false);
  const [isUnwrapping, setIsUnwrapping] = useState(false);

  const hasWalletAccess = !!account;
  const effectiveAddress = userAddress || account?.address;

  // Wrap tokens (stake)
  const wrapTokens = useCallback(async (amount: bigint) => {
    if (!account || !effectiveAddress) {
      throw new Error('Wallet not connected');
    }

    setIsWrapping(true);
    try {
      // First check allowance
      if (balances.stakingAllowance < amount) {
        // Need to approve first
        const approveResult = await executeTransaction(
          emarkToken,
          emarkToken.abi,
          'approve',
          [cardCatalog.address, amount],
          { successMessage: 'EMARK spending approved' }
        );
        
        if (!approveResult.success) {
          throw new Error(approveResult.error || 'Approval failed');
        }
        
        // Wait a moment for approval to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Now wrap the tokens
      const wrapResult = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'wrap',
        [amount],
        { successMessage: 'Tokens staked successfully!' }
      );

      if (!wrapResult.success) {
        throw new Error(wrapResult.error || 'Staking failed');
      }

      // Refresh data after successful transaction
      await refetch();
    } finally {
      setIsWrapping(false);
    }
  }, [account, effectiveAddress, balances.stakingAllowance, executeTransaction, emarkToken, cardCatalog, refetch]);

  // Request unwrap (unstake)
  const requestUnwrap = useCallback(async (amount: bigint) => {
    if (!account || !effectiveAddress) {
      throw new Error('Wallet not connected');
    }

    setIsUnwrapping(true);
    try {
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'requestUnwrap',
        [amount],
        { successMessage: 'Unstake request submitted' }
      );

      if (!result.success) {
        throw new Error(result.error || 'Unstake request failed');
      }

      await refetch();
    } finally {
      setIsUnwrapping(false);
    }
  }, [account, effectiveAddress, executeTransaction, cardCatalog, refetch]);

  // Complete unwrap (claim)
  const completeUnwrap = useCallback(async () => {
    if (!account || !effectiveAddress) {
      throw new Error('Wallet not connected');
    }

    setIsUnwrapping(true);
    try {
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'completeUnwrap',
        [],
        { successMessage: 'Tokens claimed successfully!' }
      );

      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }

      await refetch();
    } finally {
      setIsUnwrapping(false);
    }
  }, [account, effectiveAddress, executeTransaction, cardCatalog, refetch]);

  // Cancel unbonding
  const cancelUnbonding = useCallback(async () => {
    if (!account || !effectiveAddress) {
      throw new Error('Wallet not connected');
    }

    setIsUnwrapping(true);
    try {
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'cancelUnbonding',
        [],
        { successMessage: 'Unbonding cancelled' }
      );

      if (!result.success) {
        throw new Error(result.error || 'Cancel failed');
      }

      await refetch();
    } finally {
      setIsUnwrapping(false);
    }
  }, [account, effectiveAddress, executeTransaction, cardCatalog, refetch]);

  return {
    // Balances
    emarkBalance: balances.emarkBalance,
    wEmarkBalance: balances.wEmarkBalance,
    totalWrapped: balances.totalStaked,
    stakingAllowance: balances.stakingAllowance,
    
    // Voting power
    availableVotingPower: voting.availableVotingPower,
    delegatedPower: voting.delegatedPower,
    reservedPower: voting.reservedPower,
    
    // Unbonding
    unbondingAmount: unbonding.unbondingAmount,
    unbondingReleaseTime: unbonding.unbondingReleaseTime,
    canClaimUnbonding: unbonding.canClaimUnbonding,
    isUnbonding: unbonding.isUnbonding,
    
    // Loading states
    isWrapping,
    isUnwrapping,
    
    // Actions
    wrapTokens,
    requestUnwrap,
    completeUnwrap,
    cancelUnbonding,
    
    // Utilities
    refetch,
    hasWalletAccess
  };
}