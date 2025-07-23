// src/features/staking/hooks/useStakingTransactions.ts
import { useState, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useContracts } from '@/hooks/core/useContracts';
import { useTransactionUtils } from '@/hooks/core/useTransactionUtils';

export interface StakingTransactions {
  // Transaction states
  isStaking: boolean;
  isUnstaking: boolean;
  isCompleting: boolean;
  isCancelling: boolean;
  isApproving: boolean;
  
  // Transaction actions
  stake: (amount: bigint) => Promise<void>;
  requestUnstake: (amount: bigint) => Promise<void>;
  completeUnstake: () => Promise<void>;
  cancelUnbonding: () => Promise<void>;
  approveStaking: (amount: bigint) => Promise<void>;
  
  // Utility
  refetch: () => Promise<void>;
}

export function useStakingTransactions(): StakingTransactions {
  const account = useActiveAccount();
  const { cardCatalog, emarkToken } = useContracts();
  const { executeTransaction } = useTransactionUtils();
  
  // Transaction states
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  // Approve EMARK spending for staking
  const approveStaking = useCallback(async (amount: bigint) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsApproving(true);
    try {
      console.log("🔓 Approving EMARK spending:", {
        amount: amount.toString(),
        spender: cardCatalog.address,
        user: account.address
      });
      
      const result = await executeTransaction(
        emarkToken,
        emarkToken.abi,
        'approve',
        [cardCatalog.address, amount],
        { 
          successMessage: 'EMARK spending approved for staking',
          errorMessage: 'Failed to approve EMARK spending'
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Approval failed');
      }
      
      console.log("✅ EMARK approval successful:", result.hash);
    } finally {
      setIsApproving(false);
    }
  }, [account, cardCatalog.address, emarkToken, executeTransaction]);
  
  // Stake EMARK tokens (wrap to wEMARK)
  const stake = useCallback(async (amount: bigint) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsStaking(true);
    try {
      console.log("🔒 Staking EMARK tokens:", {
        amount: amount.toString(),
        user: account.address
      });
      
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'wrap',
        [amount],
        { 
          successMessage: `Successfully staked ${amount.toString()} EMARK tokens!`,
          errorMessage: 'Failed to stake tokens'
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Staking failed');
      }
      
      console.log("✅ Staking successful:", result.hash);
    } finally {
      setIsStaking(false);
    }
  }, [account, cardCatalog, executeTransaction]);
  
  // Request unstake (start unbonding period)
  const requestUnstake = useCallback(async (amount: bigint) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsUnstaking(true);
    try {
      console.log("🔓 Requesting unstake:", {
        amount: amount.toString(),
        user: account.address
      });
      
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'requestUnwrap',
        [amount],
        { 
          successMessage: `Unstake request submitted for ${amount.toString()} wEMARK`,
          errorMessage: 'Failed to request unstake'
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Unstake request failed');
      }
      
      console.log("✅ Unstake request successful:", result.hash);
    } finally {
      setIsUnstaking(false);
    }
  }, [account, cardCatalog, executeTransaction]);
  
  // Complete unstake (claim after unbonding period)
  const completeUnstake = useCallback(async () => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsCompleting(true);
    try {
      console.log("💰 Completing unstake (claiming tokens):", {
        user: account.address
      });
      
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'completeUnwrap',
        [],
        { 
          successMessage: 'Successfully claimed unstaked EMARK tokens!',
          errorMessage: 'Failed to complete unstake'
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to complete unstake');
      }
      
      console.log("✅ Unstake completion successful:", result.hash);
    } finally {
      setIsCompleting(false);
    }
  }, [account, cardCatalog, executeTransaction]);
  
  // Cancel unbonding (cancel unstake request)
  const cancelUnbonding = useCallback(async () => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsCancelling(true);
    try {
      console.log("❌ Cancelling unbonding:", {
        user: account.address
      });
      
      const result = await executeTransaction(
        cardCatalog,
        cardCatalog.abi,
        'cancelUnbonding',
        [],
        { 
          successMessage: 'Unbonding request cancelled successfully',
          errorMessage: 'Failed to cancel unbonding'
        }
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel unbonding');
      }
      
      console.log("✅ Unbonding cancellation successful:", result.hash);
    } finally {
      setIsCancelling(false);
    }
  }, [account, cardCatalog, executeTransaction]);
  
  // Refetch data (placeholder - would trigger data hooks to refresh)
  const refetch = useCallback(async () => {
    console.log("🔄 Refetching staking data...");
    // The data hooks will automatically refetch when this component re-renders
    // or we could implement a more sophisticated cache invalidation system
  }, []);
  
  return {
    // Transaction states
    isStaking,
    isUnstaking,
    isCompleting,
    isCancelling,
    isApproving,
    
    // Transaction actions
    stake,
    requestUnstake,
    completeUnstake,
    cancelUnbonding,
    approveStaking,
    
    // Utility
    refetch
  };
}