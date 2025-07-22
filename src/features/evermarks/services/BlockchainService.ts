// src/features/evermarks/services/BlockchainService.ts
import { prepareContractCall, sendTransaction, readContract, waitForReceipt, getRpcClient } from 'thirdweb';
import type { Account } from 'thirdweb/wallets';
import { client } from '@/lib/thirdweb';
import { CONTRACTS } from '@/lib/contracts';

export interface MintResult {
  success: boolean;
  txHash?: string;
  tokenId?: string;
  error?: string;
}

export interface GasEstimate {
  gasPrice: string;
  estimatedCost: string;
  estimatedCostUSD?: string;
}

export interface TransactionDetails {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  timestamp?: number;
}

export class EvermarkBlockchainService {
  /**
   * Mint a new Evermark NFT
   */
  static async mintEvermark(
    account: Account,
    metadataURI: string,
    title: string,
    creator: string,
    referrer?: string
  ): Promise<MintResult> {
    try {
      console.log('🚀 Minting evermark to blockchain:', {
        metadataURI,
        title,
        creator,
        referrer,
        account: account.address,
        contract: CONTRACTS.EVERMARK_NFT.address
      });

      // Check if user can afford the mint
      const canAfford = await this.canAffordMint(account);
      if (!canAfford) {
        throw new Error('Insufficient funds for minting fee and gas');
      }

      // Prepare the contract call based on whether we have a referrer
      const transaction = referrer && referrer !== account.address
        ? prepareContractCall({
            contract: CONTRACTS.EVERMARK_NFT,
            method: "function mintEvermarkWithReferral(string metadataURI, string title, string creator, address referrer) payable returns (uint256)",
            params: [metadataURI, title, creator, referrer],
            value: BigInt('1000000000000000'), // 0.001 ETH minting fee
          })
        : prepareContractCall({
            contract: CONTRACTS.EVERMARK_NFT,
            method: "function mintEvermark(string metadataURI, string title, string creator) payable returns (uint256)",
            params: [metadataURI, title, creator],
            value: BigInt('1000000000000000'), // 0.001 ETH minting fee
          });

      console.log('📝 Prepared transaction, sending...');

      // Send the transaction
      const result = await sendTransaction({
        transaction,
        account
      });

      console.log('⏳ Transaction sent, waiting for confirmation...');

      // Wait for transaction confirmation
      const receipt = await waitForReceipt({
        client,
        chain: CONTRACTS.EVERMARK_NFT.chain,
        transactionHash: result.transactionHash as `0x${string}`,
      });

      // Extract token ID from transaction logs
      const tokenId = this.extractTokenIdFromReceipt(receipt);

      console.log('✅ Evermark minted successfully:', {
        txHash: result.transactionHash,
        tokenId,
        gasUsed: receipt.gasUsed?.toString()
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
        } else if (error.message.includes('user rejected') || error.message.includes('denied')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error - please check your connection and try again';
        } else if (error.message.includes('nonce')) {
          errorMessage = 'Transaction nonce error - please try again';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Batch mint multiple Evermarks (for power users)
   */
  static async batchMintEvermarks(
    account: Account,
    evermarks: Array<{
      metadataURI: string;
      title: string;
      creator: string;
    }>,
    referrer?: string
  ): Promise<MintResult> {
    try {
      if (evermarks.length === 0) {
        throw new Error('No evermarks to mint');
      }

      if (evermarks.length > 10) {
        throw new Error('Maximum 10 evermarks per batch');
      }

      console.log(`🚀 Batch minting ${evermarks.length} evermarks...`);

      // Prepare arrays for batch minting
      const metadataURIs = evermarks.map(e => e.metadataURI);
      const titles = evermarks.map(e => e.title);
      const creators = evermarks.map(e => e.creator);

      // Calculate total fee
      const totalFee = BigInt('1000000000000000') * BigInt(evermarks.length); // 0.001 ETH per NFT

      // Prepare batch mint transaction
      const transaction = prepareContractCall({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function mintEvermarkBatch(string[] metadataURIs, string[] titles, string[] creators, address referrer) payable returns (uint256[])",
        params: [metadataURIs, titles, creators, referrer || account.address],
        value: totalFee,
      });

      // Send transaction
      const result = await sendTransaction({
        transaction,
        account
      });

      // Wait for confirmation
      const receipt = await waitForReceipt({
        client,
        chain: CONTRACTS.EVERMARK_NFT.chain,
        transactionHash: result.transactionHash as `0x${string}`,
      });

      console.log(`✅ Batch minted ${evermarks.length} evermarks successfully`);

      return {
        success: true,
        txHash: result.transactionHash,
        tokenId: `batch-${evermarks.length}` // For batch mints, we'll handle token IDs differently
      };

    } catch (error) {
      console.error('❌ Batch minting failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch minting failed'
      };
    }
  }

  /**
   * Check if user has enough balance to mint
   */
  static async canAffordMint(account: Account): Promise<boolean> {
    try {
      const rpcRequest = getRpcClient({
        client,
        chain: CONTRACTS.EVERMARK_NFT.chain,
      });
      
      const balance = await rpcRequest({
        method: 'eth_getBalance',
        params: [account.address, 'latest'],
      });
      
      const balanceBigInt = BigInt(balance as string);
      const minRequired = BigInt('2000000000000000'); // 0.002 ETH (fee + gas buffer)
      
      return balanceBigInt >= minRequired;
    } catch (error) {
      console.warn('Balance check failed:', error);
      return false; // Assume can't afford if check fails
    }
  }

  /**
   * Estimate gas cost for minting
   */
  static async estimateGasCost(): Promise<GasEstimate> {
    try {
      // In a real implementation, you'd estimate gas here
      // For now, return reasonable estimates for Base network
      return {
        gasPrice: '0.001 ETH',
        estimatedCost: '~$2.50 USD',
        estimatedCostUSD: '2.50'
      };
    } catch (error) {
      console.warn('Gas estimation failed:', error);
      return {
        gasPrice: '0.001 ETH',
        estimatedCost: '~$2.50 USD'
      };
    }
  }

  /**
   * Get transaction details from hash
   */
  static async getTransactionDetails(txHash: string): Promise<TransactionDetails | null> {
    try {
      const receipt = await waitForReceipt({
        client,
        chain: CONTRACTS.EVERMARK_NFT.chain,
        transactionHash: txHash as `0x${string}`,
      });

      return {
        hash: txHash,
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed?.toString(),
        timestamp: Date.now() // In real implementation, get from block data
      };
    } catch (error) {
      console.error('Failed to get transaction details:', error);
      return null;
    }
  }

  /**
   * Get Evermark metadata from contract
   */
  static async getEvermarkMetadata(tokenId: string): Promise<{
    title: string;
    creator: string;
    metadataURI: string;
  } | null> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function getEvermarkMetadata(uint256 tokenId) view returns (string title, string creator, string metadataURI)",
        params: [BigInt(tokenId)]
      });

      return {
        title: result[0] as string,
        creator: result[1] as string,
        metadataURI: result[2] as string
      };
    } catch (error) {
      console.error('Failed to get evermark metadata:', error);
      return null;
    }
  }

  /**
   * Get total supply of Evermarks
   */
  static async getTotalSupply(): Promise<number> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function totalSupply() view returns (uint256)",
        params: []
      });

      return Number(result);
    } catch (error) {
      console.error('Failed to get total supply:', error);
      return 0;
    }
  }

  /**
   * Check if Evermark exists
   */
  static async exists(tokenId: string): Promise<boolean> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function exists(uint256 tokenId) view returns (bool)",
        params: [BigInt(tokenId)]
      });

      return result as boolean;
    } catch (error) {
      console.error('Failed to check if evermark exists:', error);
      return false;
    }
  }

  /**
   * Get user's Evermark balance
   */
  static async getBalanceOf(userAddress: string): Promise<number> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function balanceOf(address owner) view returns (uint256)",
        params: [userAddress]
      });

      return Number(result);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0;
    }
  }

  /**
   * Check if blockchain service is properly configured
   */
  static isConfigured(): boolean {
    try {
      return !!(
        CONTRACTS.EVERMARK_NFT &&
        CONTRACTS.EVERMARK_NFT.address &&
        CONTRACTS.EVERMARK_NFT.address.length === 42 &&
        CONTRACTS.EVERMARK_NFT.address.startsWith('0x')
      );
    } catch {
      return false;
    }
  }

  /**
   * Get contract info for debugging
   */
  static getContractInfo() {
    return {
      address: CONTRACTS.EVERMARK_NFT.address,
      chain: CONTRACTS.EVERMARK_NFT.chain.id,
      isConfigured: this.isConfigured()
    };
  }

  /**
   * Extract token ID from transaction receipt
   * This looks for the EvermarkMinted event in the logs
   */
  private static extractTokenIdFromReceipt(receipt: any): bigint | null {
    try {
      const logs = receipt.logs || [];
      
      // Look for Transfer event (ERC721) for minting
      const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      for (const log of logs) {
        if (log.topics && log.topics[0] === transferSignature) {
          // For minting, from address is 0x0, tokenId is topics[3]
          if (log.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            return BigInt(log.topics[3]);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to extract token ID:', error);
      return null;
    }
  }
}

export default EvermarkBlockchainService;