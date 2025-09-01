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

      // Step 6: Get token ID from transaction receipt
      // Note: In a real implementation, you'd parse the logs to get the token ID
      // For now, we'll return the transaction hash
      const tokenId = Date.now().toString(); // Temporary - should parse from logs

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
  static getContractInfo = EvermarkBlockchainService.getContractInfo;
  static isConfigured = EvermarkBlockchainService.isConfigured;
}