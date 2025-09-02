// src/hooks/core/useContextualTransactions.ts - Context-aware transaction handling
import { useCallback } from 'react';
import { useSendTransaction as useThirdwebSendTransaction } from 'thirdweb/react';
import { prepareContractCall, waitForReceipt } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { useWallet } from '@/providers/WalletProvider';
import { useWalletAccount, useThirdwebAccount } from './useWalletAccount';

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
 * Context-aware transaction hook that works in both Farcaster and browser environments
 */
export function useContextualTransactions() {
  const { context } = useWallet();
  const account = useWalletAccount();
  const thirdwebAccount = useThirdwebAccount();
  const { mutateAsync: thirdwebSendTx } = useThirdwebSendTransaction();

  const sendTransaction = useCallback(async (transaction: ContextualTransaction): Promise<TransactionResult> => {
    if (!account) {
      throw new Error('No wallet connected');
    }

    // In browser/PWA context, use Thirdweb's transaction system
    if (context === 'browser' || context === 'pwa') {
      if (!thirdwebAccount) {
        throw new Error('Thirdweb account not available in browser context');
      }

      const preparedTx = prepareContractCall({
        contract: transaction.contract,
        method: transaction.method,
        params: transaction.params,
        value: transaction.value
      });

      const result = await thirdwebSendTx(preparedTx);
      
      // Wait for confirmation
      await waitForReceipt({
        client,
        chain: base,
        transactionHash: result.transactionHash
      });

      return {
        transactionHash: result.transactionHash
      };
    }

    // In Farcaster context, use Wagmi with miniapp-wagmi-connector
    if (context === 'farcaster') {
      try {
        // Dynamically import wagmi to avoid hook call in browser context
        const { useSendTransaction } = await import('wagmi');
        const { encodeFunctionData } = await import('viem');
        
        // This is a hack - we need to get the wagmi hook result somehow
        // For now, fallback to the manual SDK approach until we can restructure
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const ethProvider = await sdk.wallet.getEthereumProvider();
        
        if (!ethProvider) {
          throw new Error('Farcaster wallet provider not available');
        }

        // Parse the function signature to extract function name
        const functionMatch = transaction.method.match(/function\s+(\w+)\s*\((.*?)\)(?:\s+.*)?$/);
        if (!functionMatch) {
          throw new Error(`Invalid function signature: ${transaction.method}`);
        }

        const functionName = functionMatch[1];
        
        // Encode the function data using viem
        const data = encodeFunctionData({
          abi: transaction.contract.abi,
          functionName,
          args: transaction.params
        });

        // Send transaction through Farcaster's wallet provider
        const txHash = await ethProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            to: transaction.contract.address,
            data,
            value: transaction.value ? `0x${transaction.value.toString(16)}` : '0x0',
            from: account.address
          }]
        }) as string;

        // Wait for confirmation using Thirdweb's utilities
        const receipt = await waitForReceipt({
          client,
          chain: base,
          transactionHash: txHash as `0x${string}`
        });

        return {
          transactionHash: txHash,
          blockNumber: Number(receipt.blockNumber)
        };
      } catch (error) {
        console.error('Farcaster transaction failed:', error);
        throw new Error(`Transaction failed in Farcaster context: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error(`Unsupported wallet context: ${context}`);
  }, [context, account, thirdwebAccount, thirdwebSendTx]);

  const isTransactionSupported = useCallback((): boolean => {
    return !!account && (context === 'browser' || context === 'pwa' || context === 'farcaster');
  }, [account, context]);

  const getTransactionCapabilities = useCallback(() => {
    return {
      canSendTransaction: isTransactionSupported(),
      context,
      hasThirdwebSupport: context === 'browser' || context === 'pwa',
      hasFarcasterSupport: context === 'farcaster',
      accountAddress: account?.address || null
    };
  }, [context, account, isTransactionSupported]);

  return {
    sendTransaction,
    isTransactionSupported,
    getTransactionCapabilities,
    context
  };
}