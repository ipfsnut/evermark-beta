// src/hooks/useWrapping.ts - Hook for token wrapping (staking) operations

import { useState, useCallback } from 'react';
import { useReadContract, useSendTransaction } from 'thirdweb/react';
import { useActiveAccount } from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';
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

// src/hooks/useWrappingStats.ts - Hook for protocol-wide staking statistics

import { useReadContract } from 'thirdweb/react';
import { useContracts } from './core/useContracts';

export interface UseWrappingStatsReturn {
  totalProtocolWrapped: bigint;
  unbondingPeriod: number;
  unbondingPeriodDays: number;
  totalUnbonding: bigint;
  isLoading: boolean;
}

export function useWrappingStats(): UseWrappingStatsReturn {
  const { cardCatalog } = useContracts();

  // Get total staked amount
  const { data: totalSupply, isLoading: isLoadingSupply } = useReadContract({
    contract: cardCatalog,
    method: "function totalSupply() view returns (uint256)",
  });

  // Get unbonding period
  const { data: unbondingPeriod, isLoading: isLoadingPeriod } = useReadContract({
    contract: cardCatalog,
    method: "function UNBONDING_PERIOD() view returns (uint256)",
  });

  // Get total unbonding amount
  const { data: totalUnbonding, isLoading: isLoadingUnbonding } = useReadContract({
    contract: cardCatalog,
    method: "function totalUnbondingAmount() view returns (uint256)",
  });

  const isLoading = isLoadingSupply || isLoadingPeriod || isLoadingUnbonding;
  const unbondingPeriodSeconds = Number(unbondingPeriod || 0);
  const unbondingPeriodDays = Math.floor(unbondingPeriodSeconds / (24 * 60 * 60));

  return {
    totalProtocolWrapped: totalSupply || BigInt(0),
    unbondingPeriod: unbondingPeriodSeconds,
    unbondingPeriodDays,
    totalUnbonding: totalUnbonding || BigInt(0),
    isLoading
  };
}

// src/providers/WalletProvider.tsx - Wallet connection utilities

import React, { createContext, useContext, useCallback } from 'react';
import { useActiveAccount, useConnect } from 'thirdweb/react';

interface WalletConnectionResult {
  success: boolean;
  error?: string;
}

interface WalletContextType {
  isConnected: boolean;
  address?: string;
  requireConnection: () => Promise<WalletConnectionResult>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const { connect } = useConnect();

  const requireConnection = useCallback(async (): Promise<WalletConnectionResult> => {
    if (account?.address) {
      return { success: true };
    }

    try {
      // In a real implementation, this would trigger the wallet connection flow
      // For now, we'll return a helpful message
      return {
        success: false,
        error: 'Please connect your wallet to continue'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet'
      };
    }
  }, [account]);

  const value: WalletContextType = {
    isConnected: !!account?.address,
    address: account?.address,
    requireConnection
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletConnection(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletConnection must be used within WalletProvider');
  }
  return context;
}