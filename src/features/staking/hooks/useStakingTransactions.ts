// src/features/staking/hooks/useStakingTransactions.ts - Context-aware transactions
import { useState, useCallback } from 'react';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { useContextualTransactions } from '@/hooks/core/useContextualTransactions';
import { useContracts } from '@/hooks/core/useContracts';
import { devLog, prodLog } from '@/utils/debug';

// Remove unused imports

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
  approveStaking: (amount: bigint) => Promise<string>;
  
  // Utility
  refetch: () => Promise<void>;
}

export function useStakingTransactions(): StakingTransactions {
  const account = useWalletAccount();
  const { wemark, emarkToken } = useContracts();
  const { sendTransaction } = useContextualTransactions();
  
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
    
    // Validation checks before attempting approval
    if (amount <= BigInt(0)) {
      throw new Error('Approval amount must be greater than zero');
    }
    
    if (!wemark.address || wemark.address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Invalid WEMARK contract address');
    }
    
    if (!account.address || account.address === '0x0000000000000000000000000000000000000000') {
      throw new Error('Invalid user address');
    }
    
    setIsApproving(true);
    try {
      devLog("Approving EMARK spending:", {
        amount: amount.toString(),
        spender: wemark.address,
        user: account.address,
        emarkContract: emarkToken.address
      });
      
      const result = await sendTransaction({
        contract: emarkToken,
        method: "function approve(address spender, uint256 value) returns (bool)",
        params: [wemark.address, amount]
      });
      
      prodLog("EMARK approval successful:", result.transactionHash);
      
      // Return transaction hash for confirmation tracking
      return result.transactionHash;
    } finally {
      setIsApproving(false);
    }
  }, [account, wemark.address, emarkToken, sendTransaction]);
  
  // Stake EMARK tokens (wrap to wEMARK)
  const stake = useCallback(async (amount: bigint) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsStaking(true);
    try {
      devLog("Staking EMARK tokens:", {
        amount: amount.toString(),
        user: account.address,
        wemark: wemark.address,
        emarkToken: emarkToken.address
      });
      
      // Debug: Check current allowance before staking
      devLog("Checking allowance before stake...");
      
      const result = await sendTransaction({
        contract: wemark,
        method: "function stake(uint256 amount)",
        params: [amount]
      });
      
      prodLog("Staking successful:", result.transactionHash);
    } catch (error: unknown) {
      console.error("Staking transaction failed:", error);
      console.error("Contract addresses:", {
        wemark: wemark.address,
        emarkToken: emarkToken.address
      });
      console.error("Transaction details:", {
        amount: amount.toString(),
        user: account.address
      });
      throw error;
    } finally {
      setIsStaking(false);
    }
  }, [account, wemark, emarkToken, sendTransaction]);
  
  // Request unstake (start unbonding period)
  const requestUnstake = useCallback(async (amount: bigint) => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsUnstaking(true);
    try {
      devLog("Requesting unstake:", {
        amount: amount.toString(),
        user: account.address
      });
      
      const result = await sendTransaction({
        contract: wemark,
        method: "function startUnbonding(uint256 amount)",
        params: [amount]
      });
      
      prodLog("Unstake request successful:", result.transactionHash);
    } finally {
      setIsUnstaking(false);
    }
  }, [account, wemark, sendTransaction]);
  
  // Complete unstake (claim after unbonding period)
  const completeUnstake = useCallback(async () => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsCompleting(true);
    try {
      devLog("Completing unstake (claiming tokens):", {
        user: account.address
      });
      
      const result = await sendTransaction({
        contract: wemark,
        method: "function withdraw()",
        params: []
      });
      
      prodLog("Unstake completion successful:", result.transactionHash);
    } finally {
      setIsCompleting(false);
    }
  }, [account, wemark, sendTransaction]);
  
  // Cancel unbonding (cancel unstake request)
  const cancelUnbonding = useCallback(async () => {
    if (!account) {
      throw new Error('Wallet not connected');
    }
    
    setIsCancelling(true);
    try {
      devLog("Cancelling unbonding:", {
        user: account.address
      });
      
      const result = await sendTransaction({
        contract: wemark,
        method: "function cancelUnbonding()",
        params: []
      });
      
      prodLog("Unbonding cancellation successful:", result.transactionHash);
    } finally {
      setIsCancelling(false);
    }
  }, [account, wemark, sendTransaction]);
  
  // Refetch data (placeholder - would trigger data hooks to refresh)
  const refetch = useCallback(async () => {
    devLog("Refetching staking data...");
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