// src/hooks/core/useContextualTransactions.ts - Context-aware transaction handling
import { useCallback } from 'react';
import { useSendTransaction as useThirdwebSendTransaction } from 'thirdweb/react';
import { prepareContractCall, waitForReceipt } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { useWallet } from '@/providers/WalletProvider';
import { useWalletAccount, useThirdwebAccount } from './useWalletAccount';
import { useFarcasterTransactions } from './useFarcasterTransactions';

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
 * Now uses split architecture to avoid hook violations
 */
export function useContextualTransactions() {
  const { context } = useWallet();
  const account = useWalletAccount();
  const thirdwebAccount = useThirdwebAccount();
  const { mutateAsync: thirdwebSendTx } = useThirdwebSendTransaction();
  
  // Always call Farcaster hook but only use result in Farcaster context
  const farcasterTx = useFarcasterTransactions();

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

    // In Farcaster context, use the dedicated Farcaster hook
    if (context === 'farcaster') {
      if (!farcasterTx) {
        throw new Error('Farcaster transaction hook not available');
      }
      return farcasterTx.sendTransaction(transaction);
    }

    throw new Error(`Unsupported wallet context: ${context}`);
  }, [context, account, thirdwebAccount, thirdwebSendTx, farcasterTx]);

  const isTransactionSupported = useCallback((): boolean => {
    return !!account && (context === 'browser' || context === 'pwa' || context === 'farcaster');
  }, [account, context]);

  const getTransactionCapabilities = useCallback(() => {
    if (context === 'farcaster' && farcasterTx) {
      return farcasterTx.getTransactionCapabilities();
    }
    
    return {
      canSendTransaction: isTransactionSupported(),
      context,
      hasThirdwebSupport: context === 'browser' || context === 'pwa',
      hasFarcasterSupport: context === 'farcaster',
      accountAddress: account?.address || null
    };
  }, [context, account, isTransactionSupported, farcasterTx]);

  return {
    sendTransaction,
    isTransactionSupported,
    getTransactionCapabilities,
    context
  };
}