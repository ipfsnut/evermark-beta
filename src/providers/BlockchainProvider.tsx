import React, { createContext, useContext, useCallback, useState } from 'react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall } from 'thirdweb';
import { CONTRACTS } from '@/lib/contracts';

export interface MintResult {
  success: boolean;
  txHash?: string;
  tokenId?: string;
  error?: string;
}

interface BlockchainContextType {
  // Minting functions
  mintEvermark: (metadataURI: string, title: string, creator: string) => Promise<MintResult>;
  
  // State queries
  canAffordMint: () => Promise<boolean>;
  estimateGasCost: () => Promise<{ gasPrice: string; estimatedCost: string }>;
  
  // Transaction helpers
  getTransactionDetails: (txHash: string) => Promise<any>;
  isConfigured: () => boolean;
}

const BlockchainContext = createContext<BlockchainContextType | null>(null);

interface BlockchainProviderProps {
  children: React.ReactNode;
}

export function BlockchainProvider({ children }: BlockchainProviderProps) {
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();

  const mintEvermark = useCallback(async (
    metadataURI: string,
    title: string,
    creator: string
  ): Promise<MintResult> => {
    try {
      if (!account) {
        throw new Error('No wallet connected');
      }

      console.log('🚀 Minting evermark to blockchain:', {
        metadataURI,
        title,
        creator,
        account: account.address
      });

      // Prepare the contract call for minting
      const transaction = prepareContractCall({
        contract: CONTRACTS.EVERMARK_NFT,
        method: 'mintEvermark',
        params: [metadataURI, title, creator],
        value: BigInt('1000000000000000'), // 0.001 ETH minting fee
      });

      // Send the transaction
      const result = await sendTransaction(transaction);

      // Wait for confirmation and get token ID
      const receipt = await result.wait();
      
      // Extract token ID from logs
      const tokenId = extractTokenIdFromReceipt(receipt);

      console.log('✅ Evermark minted successfully:', {
        txHash: result.transactionHash,
        tokenId
      });

      return {
        success: true,
        txHash: result.transactionHash,
        tokenId: tokenId?.toString()
      };

    } catch (error) {
      console.error('❌ Blockchain minting failed:', error);
      
      let errorMessage = 'Blockchain transaction failed';
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for minting fee and gas';
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [account, sendTransaction]);

  const canAffordMint = useCallback(async (): Promise<boolean> => {
    try {
      if (!account) return false;
      
      // Check user's ETH balance
      const balance = await account.getBalance();
      const minRequired = BigInt('2000000000000000'); // 0.002 ETH for fee + gas
      
      return balance >= minRequired;
    } catch (error) {
      console.error('Balance check failed:', error);
      return false;
    }
  }, [account]);

  const estimateGasCost = useCallback(async (): Promise<{ gasPrice: string; estimatedCost: string }> => {
    try {
      // This would integrate with actual gas estimation
      return {
        gasPrice: '0.001 ETH',
        estimatedCost: '~$2.50 USD'
      };
    } catch (error) {
      console.warn('Gas estimation failed:', error);
      return {
        gasPrice: '0.001 ETH',
        estimatedCost: '~$2.50 USD'
      };
    }
  }, []);

  const getTransactionDetails = useCallback(async (txHash: string): Promise<any> => {
    try {
      // This would fetch actual transaction details from the blockchain
      const response = await fetch(`https://api.basescan.org/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
      return null;
    }
  }, []);

  const isConfigured = useCallback((): boolean => {
    return !!(
      CONTRACTS.EVERMARK_NFT &&
      CONTRACTS.CARD_CATALOG
    );
  }, []);

  const value: BlockchainContextType = {
    mintEvermark,
    canAffordMint,
    estimateGasCost,
    getTransactionDetails,
    isConfigured,
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
}

// Hook for using blockchain services
export function useBlockchain(): BlockchainContextType {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within BlockchainProvider');
  }
  return context;
}

// Helper function to extract token ID from transaction receipt
function extractTokenIdFromReceipt(receipt: any): bigint | null {
  try {
    // Look for EvermarkMinted event in logs
    const logs = receipt.logs || [];
    
    for (const log of logs) {
      // Look for the EvermarkMinted event signature
      if (log.topics?.[0] === '0x...') { // Replace with actual event signature
        // Parse the token ID from the log data
        return BigInt(log.topics[1]); // Assuming tokenId is the first indexed parameter
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to extract token ID:', error);
    return null;
  }
}