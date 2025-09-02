// src/features/evermarks/services/ContextualBlockchainService.ts
// Context-aware blockchain service for Evermark creation that works in both browser and Farcaster contexts

import { prepareContractCall } from 'thirdweb';
import type { Account } from 'thirdweb/wallets';
import { getEvermarkNFTContract } from '@/lib/contracts';
import { EvermarkBlockchainService, type MintResult } from './BlockchainService';

export class ContextualBlockchainService {
  
  /**
   * Context-aware mint method that uses a provided sendTransaction function
   * This allows us to use different transaction methods based on the context
   */
  static async mintEvermark(
    account: Account | { address: string; [key: string]: any },
    metadataURI: string,
    title: string,
    creator: string,
    referrer: string | undefined,
    sendTransaction: (tx: {
      contract: any;
      method: string;
      params: any[];
      value?: bigint;
    }) => Promise<{ transactionHash: string }>
  ): Promise<MintResult> {
    try {
      console.log('🚀 Starting contextual evermark minting...');
      
      // Step 1: Validate configuration
      if (!EvermarkBlockchainService.isConfigured()) {
        return {
          success: false,
          error: 'Blockchain service not configured'
        };
      }

      // Step 2: Validate account
      if (!account?.address) {
        return {
          success: false,
          error: 'Invalid account address provided'
        };
      }

      // Step 3: Get contract and minting fee
      const contract = getEvermarkNFTContract();
      const contractInfo = await EvermarkBlockchainService.getContractInfo();
      const mintingFee = contractInfo.mintingFee;

      console.log('💰 Minting fee:', mintingFee.toString());

      // Step 4: Clean and validate inputs
      const cleanMetadataURI = metadataURI.trim();
      const cleanTitle = title.trim().slice(0, 100); // Limit title length
      const cleanCreator = creator.trim();

      if (!cleanMetadataURI || !cleanTitle || !cleanCreator) {
        return {
          success: false,
          error: 'Invalid minting parameters'
        };
      }

      // Step 5: Prepare transaction based on whether referrer is provided
      let transactionResult: { transactionHash: string };

      if (referrer && referrer !== '0x0000000000000000000000000000000000000000') {
        console.log('🔗 Minting with referrer:', referrer);
        
        transactionResult = await sendTransaction({
          contract,
          method: "function mintEvermarkWithReferral(string metadataURI, string title, string creator, address referrer) payable returns (uint256)",
          params: [cleanMetadataURI, cleanTitle, cleanCreator, referrer],
          value: mintingFee
        });
      } else {
        console.log('🔗 Minting without referrer');
        
        transactionResult = await sendTransaction({
          contract,
          method: "function mintEvermark(string metadataURI, string title, string creator) payable returns (uint256)",
          params: [cleanMetadataURI, cleanTitle, cleanCreator],
          value: mintingFee
        });
      }

      console.log('✅ Transaction sent:', transactionResult.transactionHash);

      // Step 6: Extract actual token ID from transaction receipt
      console.log('📋 Extracting token ID from transaction receipt...');
      
      let tokenId: string;
      try {
        // For now, use the total supply from the contract as the token ID
        // The transaction has already completed, so the total supply should be updated
        const { totalSupply } = await EvermarkBlockchainService.getContractInfo();
        tokenId = totalSupply.toString();
        console.log('✅ Token ID from updated total supply:', tokenId);
        
        // TODO: Implement proper receipt parsing once we have access to receipt data
        /*
        // Get the transaction receipt to parse logs
        const receipt = await getTransactionReceipt(transactionResult.transactionHash);
        
        if (!receipt) {
          throw new Error('No transaction receipt available');
        }
        
        // Parse Transfer event logs to extract token ID
        // Transfer event signature: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
        const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        
        const transferLog = receipt.logs?.find(log => 
          log.topics?.[0] === transferTopic && 
          log.address?.toLowerCase() === contract.address?.toLowerCase()
        );
        
        if (transferLog && transferLog.topics?.[3]) {
          // Token ID is the 3rd indexed parameter (topics[3])
          const tokenIdHex = transferLog.topics[3];
          tokenId = BigInt(tokenIdHex).toString();
          console.log('✅ Token ID extracted from Transfer event:', tokenId);
        } else {
          // Fallback: read total supply from contract
          const { totalSupply } = await BlockchainService.getContractInfo();
          tokenId = totalSupply.toString();
          console.log('⚠️ Using total supply as token ID fallback:', tokenId);
        }
        */
        
      } catch (error) {
        console.error('❌ Failed to extract token ID:', error);
        throw new Error(`Token ID extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        success: true,
        txHash: transactionResult.transactionHash,
        tokenId
      };

    } catch (error) {
      console.error('❌ Contextual minting failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown minting error'
      };
    }
  }

  /**
   * Re-export static methods from the original service for compatibility
   */
  static getContractInfo() {
    return EvermarkBlockchainService.getContractInfo();
  }
  
  static isConfigured() {
    return EvermarkBlockchainService.isConfigured();
  }
}