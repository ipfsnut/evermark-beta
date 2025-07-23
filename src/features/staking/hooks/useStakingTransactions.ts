// src/features/staking/hooks/useStakingTransactions.ts - Fixed for Thirdweb v5
import { useState, useCallback } from 'react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall, waitForReceipt } from 'thirdweb';
import { useContracts } from '@/hooks/core/useContracts';
import { client } from '@/lib/thirdweb';
import { CHAIN } from '@/lib/contracts';

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
  const { mutateAsync: sendTransaction } = useSendTransaction();
  
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
      
      // Fixed: Use prepareContractCall with thirdweb v5 pattern
      const transaction = prepareContractCall({
        contract: emarkToken,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [cardCatalog.address, amount]
      });
      
      const result = await sendTransaction(transaction);
      
      // Wait for confirmation
      await waitForReceipt({
        client,
        chain: CHAIN,
        transactionHash: result.transactionHash
      });
      
      console.log("✅ EMARK approval successful:", result.transactionHash);
    } finally {
      setIsApproving(false);
    }
  }, [account, cardCatalog.address, emarkToken, sendTransaction]);
  
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
      
      // Fixed: Use prepareContractCall with thirdweb v5 pattern
      const transaction = prepareContractCall({
        contract: cardCatalog,
        method: "function wrap(uint256 amount)",
        params: [amount]
      });
      
      const result = await sendTransaction(transaction);
      
      // Wait for confirmation
      await waitForReceipt({
        client,
        chain: CHAIN,
        transactionHash: result.transactionHash
      });
      
      console.log("✅ Staking successful:", result.transactionHash);
    } finally {
      setIsStaking(false);
    }
  }, [account, cardCatalog, sendTransaction]);
  
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
      
      // Fixed: Use prepareContractCall with thirdweb v5 pattern
      const transaction = prepareContractCall({
        contract: cardCatalog,
        method: "function requestUnwrap(uint256 amount)",
        params: [amount]
      });
      
      const result = await sendTransaction(transaction);
      
      // Wait for confirmation
      await waitForReceipt({
        client,
        chain: CHAIN,
        transactionHash: result.transactionHash
      });
      
      console.log("✅ Unstake request successful:", result.transactionHash);
    } finally {
      setIsUnstaking(false);
    }
  }, [account, cardCatalog, sendTransaction]);
  
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
      
      // Fixed: Use prepareContractCall with thirdweb v5 pattern
      const transaction = prepareContractCall({
        contract: cardCatalog,
        method: "function completeUnwrap()",
        params: []
      });
      
      const result = await sendTransaction(transaction);
      
      // Wait for confirmation
      await waitForReceipt({
        client,
        chain: CHAIN,
        transactionHash: result.transactionHash
      });
      
      console.log("✅ Unstake completion successful:", result.transactionHash);
    } finally {
      setIsCompleting(false);
    }
  }, [account, cardCatalog, sendTransaction]);
  
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
      
      // Fixed: Use prepareContractCall with thirdweb v5 pattern
      const transaction = prepareContractCall({
        contract: cardCatalog,
        method: "function cancelUnbonding()",
        params: []
      });
      
      const result = await sendTransaction(transaction);
      
      // Wait for confirmation
      await waitForReceipt({
        client,
        chain: CHAIN,
        transactionHash: result.transactionHash
      });
      
      console.log("✅ Unbonding cancellation successful:", result.transactionHash);
    } finally {
      setIsCancelling(false);
    }
  }, [account, cardCatalog, sendTransaction]);
  
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