// src/providers/BlockchainProvider.tsx - Fixed imports
import React, { createContext, useContext, useCallback } from 'react';
import { useActiveAccount, useSendTransaction } from 'thirdweb/react';
import { prepareContractCall, waitForReceipt } from 'thirdweb';
import { getEvermarkNFTContract } from '@/lib/contracts';
import { client, CHAIN } from '@/lib/thirdweb'; // Fixed import

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

// Helper function to extract token ID from receipt
function extractTokenIdFromReceipt(receipt: any): bigint | null {
  try {
    // Look for Transfer event in logs to get token ID
    for (const log of receipt.logs || []) {
      // ERC721 Transfer event signature
      if (log.topics?.[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
        // Token ID is in the 4th topic (index 3) for ERC721 Transfer events
        if (log.topics?.[3]) {
          return BigInt(log.topics[3]);
        }
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to extract token ID from receipt:', error);
    return null;
  }
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

      const contract = getEvermarkNFTContract();

      // Prepare the contract call for minting with proper v5 syntax
      const transaction = prepareContractCall({
        contract,
        method: 'function mintEvermark(string metadataURI, string title, string creator) payable returns (uint256)',
        params: [metadataURI, title, creator],
        value: BigInt('1000000000000000'), // 0.001 ETH minting fee
      });

      // Send the transaction
      const result = await sendTransaction(transaction);

      // Wait for confirmation and get receipt
      const receipt = await waitForReceipt({
        client,
        chain: CHAIN,
        transactionHash: result.transactionHash
      });
      
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
        } else if (error.message.includes('user rejected') || error.message.includes('User denied')) {
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
      
      // Check user's ETH balance using v5 syntax
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
      // This would integrate with actual gas estimation in v5
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
      // This would use Thirdweb v5 methods to fetch transaction details
      const response = await fetch(`https://api.basescan.org/api?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
      return null;
    }
  }, []);

  const isConfigured = useCallback((): boolean => {
    try {
      getEvermarkNFTContract();
      return true;
    } catch {
      return false;
    }
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

export function useBlockchain(): BlockchainContextType {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error('useBlockchain must be used within BlockchainProvider');
  }
  return context;
}