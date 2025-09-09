// src/hooks/core/useFarcasterTransactions.ts - Farcaster-specific transaction handling
import { useCallback } from 'react';
import { encodeFunctionData } from 'viem';
import { waitForReceipt } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { useWallet } from '@/providers/WalletProvider';

export interface ContextualTransaction {
  contract: any;
  method: string;
  params: any[];
  value?: bigint;
}

export interface TransactionResult {
  transactionHash: string;
  blockNumber?: number;
}

/**
 * Extract function name from method signature
 * e.g. "function mint(address to, uint256 amount)" -> "mint"
 */
function extractFunctionName(methodSignature: string): string {
  const functionMatch = methodSignature.match(/function\s+(\w+)\s*\((.*?)\)(?:\s+.*)?$/);
  if (!functionMatch) {
    throw new Error(`Invalid function signature: ${methodSignature}`);
  }
  return functionMatch[1];
}

/**
 * Farcaster-specific transaction service using SDK directly
 * Uses the existing SDK approach but cleaned up without hook violations
 */
async function sendFarcasterTransaction(transaction: ContextualTransaction, userAddress: string): Promise<TransactionResult> {
  try {
    // Import SDK dynamically (this is safe in a service function)
    const { sdk } = await import('@farcaster/miniapp-sdk');
    const ethProvider = await sdk.wallet.getEthereumProvider();
    
    if (!ethProvider) {
      throw new Error('Farcaster wallet provider not available');
    }

    // Extract function name from method signature
    const functionName = extractFunctionName(transaction.method);
    
    // Encode the function data using viem
    const data = encodeFunctionData({
      abi: transaction.contract.abi,
      functionName,
      args: transaction.params
    });

    console.log('🚀 Sending Farcaster transaction via SDK...', {
      to: transaction.contract.address,
      functionName,
      value: transaction.value?.toString()
    });

    // Send transaction through Farcaster's wallet provider
    const txHash = await ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        to: transaction.contract.address,
        data,
        value: transaction.value ? `0x${transaction.value.toString(16)}` : '0x0',
        from: userAddress as `0x${string}`
      }]
    }) as string;

    console.log('🚀 Farcaster transaction sent:', txHash);

    // Wait for confirmation using Thirdweb's utilities
    const receipt = await waitForReceipt({
      client,
      chain: base,
      transactionHash: txHash as `0x${string}`
    });

    console.log('✅ Farcaster transaction confirmed:', {
      hash: txHash,
      blockNumber: receipt.blockNumber
    });

    return {
      transactionHash: txHash,
      blockNumber: Number(receipt.blockNumber)
    };
  } catch (error) {
    console.error('❌ Farcaster transaction failed:', error);
    throw new Error(`Transaction failed in Farcaster context: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Hook that provides Farcaster transaction capabilities
 * Safe to call in any context - returns service functions
 */
export function useFarcasterTransactions() {
  const { context, address } = useWallet();

  const sendTransaction = useCallback(async (transaction: ContextualTransaction): Promise<TransactionResult> => {
    if (context !== 'farcaster') {
      throw new Error('useFarcasterTransactions can only send transactions in Farcaster context');
    }
    
    if (!address) {
      throw new Error('No wallet connected in Farcaster context');
    }

    return sendFarcasterTransaction(transaction, address);
  }, [context, address]);

  const isTransactionSupported = useCallback((): boolean => {
    return context === 'farcaster' && !!address;
  }, [context, address]);

  const getTransactionCapabilities = useCallback(() => {
    return {
      canSendTransaction: isTransactionSupported(),
      context: 'farcaster' as const,
      hasWagmiSupport: false, // We use SDK directly, not wagmi
      accountAddress: address ?? null
    };
  }, [context, address, isTransactionSupported]);

  return {
    sendTransaction,
    isTransactionSupported,
    getTransactionCapabilities,
    context: 'farcaster' as const
  };
}