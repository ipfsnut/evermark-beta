// hooks/core/useTransactionUtils.ts - Utility hook for transaction management

import { useState, useCallback } from 'react';
import { prepareContractCall, sendTransaction } from 'thirdweb';
import { useActiveAccount } from 'thirdweb/react';
import type { ThirdwebContract } from 'thirdweb';

export interface TransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export interface TransactionOptions {
  successMessage?: string;
  errorContext?: Record<string, any>;
}

export function useTransactionUtils() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const account = useActiveAccount();

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const executeTransaction = useCallback(async (
    contract: ThirdwebContract,
    abi: any,
    functionName: string,
    params: any[] = [],
    options: TransactionOptions = {}
  ): Promise<TransactionResult> => {
    if (!account) {
      const errorMsg = 'No wallet connected';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Prepare the contract call
      const transaction = prepareContractCall({
        contract,
        method: functionName,
        params
      });

      // Send the transaction
      const result = await sendTransaction({
        transaction,
        account
      });

      const successMsg = options.successMessage || 'Transaction completed successfully';
      setSuccess(successMsg);
      
      return { 
        success: true, 
        hash: result.transactionHash 
      };

    } catch (err: any) {
      console.error('Transaction failed:', err, options.errorContext);
      const errorMsg = err.message || 'Transaction failed';
      setError(errorMsg);
      
      return { 
        success: false, 
        error: errorMsg 
      };
    } finally {
      setIsProcessing(false);
    }
  }, [account]);

  const executeBatchTransactions = useCallback(async (
    transactions: Array<{
      contractAddress: string;
      abi: any;
      functionName: string;
      params: any[];
      options?: TransactionOptions;
    }>
  ): Promise<TransactionResult[]> => {
    const results: TransactionResult[] = [];
    
    for (const tx of transactions) {
      // Note: This is a simplified batch - in production you'd want proper batch transaction support
      const contract = {
        address: tx.contractAddress,
        chain: { id: 8453 }, // Base chain
        client: {} // Would be the actual client
      } as ThirdwebContract;
      
      const result = await executeTransaction(
        contract,
        tx.abi,
        tx.functionName,
        tx.params,
        tx.options
      );
      
      results.push(result);
      
      // If any transaction fails, stop the batch
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }, [executeTransaction]);

  return {
    executeTransaction,
    executeBatchTransactions,
    isProcessing,
    error,
    success,
    clearMessages
  };
}