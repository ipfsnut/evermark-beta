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

export interface ContractInfo {
  mintingFee: bigint;
  referralPercentage: number;
  maxBatchSize: number;
  totalSupply: number;
  isPaused: boolean;
}

export class EvermarkBlockchainService {
  
  /**
   * Get current contract information and parameters
   */
  static async getContractInfo(): Promise<ContractInfo> {
    try {
      console.log('📋 Fetching contract information...');
      
      // Fetch all contract parameters in parallel
      const [mintingFee, referralPercentage, maxBatchSize, totalSupply, isPaused] = await Promise.all([
        this.getMintingFee(),
        this.getReferralPercentage(),
        this.getMaxBatchSize(),
        this.getTotalSupply(),
        this.getIsPaused()
      ]);

      const contractInfo: ContractInfo = {
        mintingFee,
        referralPercentage,
        maxBatchSize,
        totalSupply,
        isPaused
      };

      console.log('📋 Contract info retrieved:', contractInfo);
      return contractInfo;
    } catch (error) {
      console.error('Failed to get contract info:', error);
      // Return fallback values if contract calls fail
      return {
        mintingFee: BigInt('1000000000000000'), // 0.001 ETH fallback
        referralPercentage: 10, // 10% fallback
        maxBatchSize: 10,
        totalSupply: 0,
        isPaused: false
      };
    }
  }

  /**
   * Get current minting fee from contract
   */
  static async getMintingFee(): Promise<bigint> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function MINTING_FEE() view returns (uint256)",
        params: []
      });
      return result as bigint;
    } catch (error) {
      console.warn('Failed to get minting fee from contract, using fallback');
      return BigInt('1000000000000000'); // 0.001 ETH fallback
    }
  }

  /**
   * Get referral percentage from contract
   */
  static async getReferralPercentage(): Promise<number> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function REFERRAL_PERCENTAGE() view returns (uint256)",
        params: []
      });
      return Number(result);
    } catch (error) {
      console.warn('Failed to get referral percentage from contract');
      return 10; // 10% fallback
    }
  }

  /**
   * Get max batch size from contract
   */
  static async getMaxBatchSize(): Promise<number> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function MAX_BATCH_SIZE() view returns (uint256)",
        params: []
      });
      return Number(result);
    } catch (error) {
      console.warn('Failed to get max batch size from contract');
      return 10; // fallback
    }
  }

  /**
   * Check if contract is paused
   */
  static async getIsPaused(): Promise<boolean> {
    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function paused() view returns (bool)",
        params: []
      });
      return result as boolean;
    } catch (error) {
      console.warn('Failed to check if contract is paused');
      return false; // assume not paused if we can't check
    }
  }

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
      console.log('🚀 Starting evermark minting process...');
      
      // Step 1: Get current contract information
      const contractInfo = await this.getContractInfo();
      
      if (contractInfo.isPaused) {
        throw new Error('Contract is currently paused. Minting is temporarily disabled.');
      }

      console.log('💰 Current minting fee:', contractInfo.mintingFee.toString(), 'wei');

      // Step 2: Check if user can afford the mint
      const canAfford = await this.canAffordMint(account, contractInfo.mintingFee);
      if (!canAfford) {
        throw new Error('Insufficient funds for minting fee and gas');
      }

      // Step 3: Prepare the contract call
      const transaction = referrer && referrer !== account.address
        ? prepareContractCall({
            contract: CONTRACTS.EVERMARK_NFT,
            method: "function mintEvermarkWithReferral(string metadataURI, string title, string creator, address referrer) payable returns (uint256)",
            params: [metadataURI, title, creator, referrer],
            value: contractInfo.mintingFee,
          })
        : prepareContractCall({
            contract: CONTRACTS.EVERMARK_NFT,
            method: "function mintEvermark(string metadataURI, string title, string creator) payable returns (uint256)",
            params: [metadataURI, title, creator],
            value: contractInfo.mintingFee,
          });

      console.log('📝 Transaction prepared, sending to blockchain...');

      // Step 4: Send the transaction
      const result = await sendTransaction({
        transaction,
        account
      });

      console.log('⏳ Transaction sent, waiting for confirmation...', result.transactionHash);

      // Step 5: Wait for transaction confirmation
      const receipt = await waitForReceipt({
        client,
        chain: CONTRACTS.EVERMARK_NFT.chain,
        transactionHash: result.transactionHash as `0x${string}`,
      });

      // Step 6: Extract token ID from transaction logs
      const tokenIdBigInt = this.extractTokenIdFromReceipt(receipt);

      console.log('✅ Evermark minted successfully:', {
        txHash: result.transactionHash,
        tokenId: tokenIdBigInt?.toString(),
        gasUsed: receipt.gasUsed?.toString(),
        mintingFee: contractInfo.mintingFee.toString()
      });

      // Properly construct the result object based on whether we have a token ID
      const mintResult: MintResult = {
        success: true,
        txHash: result.transactionHash
      };

      // Only add tokenId if we successfully extracted it
      if (tokenIdBigInt) {
        mintResult.tokenId = tokenIdBigInt.toString();
      }

      return mintResult;

    } catch (error) {
      console.error('❌ Blockchain minting failed:', error);
      
      let errorMessage = 'Blockchain transaction failed';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for minting fee and gas';
        } else if (message.includes('user rejected') || message.includes('denied') || message.includes('user denied')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (message.includes('network') || message.includes('connection')) {
          errorMessage = 'Network error - please check your connection and try again';
        } else if (message.includes('nonce')) {
          errorMessage = 'Transaction nonce error - please try again';
        } else if (message.includes('paused')) {
          errorMessage = 'Contract is currently paused - minting is temporarily disabled';
        } else if (message.includes('gas')) {
          errorMessage = 'Transaction failed due to gas estimation error';
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
   * Batch mint multiple Evermarks
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

      // Get contract info to check max batch size
      const contractInfo = await this.getContractInfo();
      
      if (contractInfo.isPaused) {
        throw new Error('Contract is currently paused. Minting is temporarily disabled.');
      }

      if (evermarks.length > contractInfo.maxBatchSize) {
        throw new Error(`Maximum ${contractInfo.maxBatchSize} evermarks per batch`);
      }

      console.log(`🚀 Batch minting ${evermarks.length} evermarks...`);

      // Prepare arrays for batch minting
      const metadataURIs = evermarks.map(e => e.metadataURI);
      const titles = evermarks.map(e => e.title);
      const creators = evermarks.map(e => e.creator);

      // Calculate total fee using current contract fee
      const totalFee = contractInfo.mintingFee * BigInt(evermarks.length);

      console.log('💰 Total batch minting fee:', totalFee.toString(), 'wei');

      // Check if user can afford batch mint
      const canAfford = await this.canAffordMint(account, totalFee);
      if (!canAfford) {
        throw new Error('Insufficient funds for batch minting fee and gas');
      }

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

      // Construct result without explicitly setting undefined values
      const batchResult: MintResult = {
        success: true,
        txHash: result.transactionHash,
        tokenId: `batch-${evermarks.length}-${Date.now()}` // Unique identifier for batch
      };

      return batchResult;

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
  static async canAffordMint(account: Account, mintingFee?: bigint): Promise<boolean> {
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
      
      // Use provided minting fee or fetch from contract
      const fee = mintingFee || await this.getMintingFee();
      
      // Add gas buffer (estimated 0.001 ETH for gas)
      const gasBuffer = BigInt('1000000000000000'); // 0.001 ETH
      const minRequired = fee + gasBuffer;
      
      console.log('💰 Balance check:', {
        userBalance: balanceBigInt.toString(),
        mintingFee: fee.toString(),
        gasBuffer: gasBuffer.toString(),
        required: minRequired.toString(),
        canAfford: balanceBigInt >= minRequired
      });
      
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
      const mintingFee = await this.getMintingFee();
      const mintingFeeEth = Number(mintingFee) / 1e18;
      const estimatedGas = 0.001; // ETH
      const totalCost = mintingFeeEth + estimatedGas;
      
      return {
        gasPrice: `${estimatedGas} ETH`,
        estimatedCost: `~$${(totalCost * 2500).toFixed(2)} USD`, // Rough ETH price estimate
        estimatedCostUSD: (totalCost * 2500).toFixed(2)
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
   * Get contract debugging info
   */
  static getDebugInfo() {
    return {
      address: CONTRACTS.EVERMARK_NFT.address,
      chain: CONTRACTS.EVERMARK_NFT.chain.id,
      chainName: CONTRACTS.EVERMARK_NFT.chain.name,
      isConfigured: this.isConfigured()
    };
  }

  /**
   * Extract token ID from transaction receipt
   * This looks for the Transfer event (ERC721 minting signature)
   */
  private static extractTokenIdFromReceipt(receipt: any): bigint | null {
    try {
      const logs = receipt.logs || [];
      
      // ERC721 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
      const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      for (const log of logs) {
        if (log.topics && log.topics[0] === transferSignature) {
          // For minting, from address is 0x0 (topics[1]), to address is minter (topics[2]), tokenId is topics[3]
          const fromAddress = log.topics[1];
          const zeroAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
          
          if (fromAddress === zeroAddress) {
            // This is a mint event
            const tokenId = log.topics[3];
            return BigInt(tokenId);
          }
        }
      }
      
      // If we can't find the Transfer event, look for EvermarkMinted event
      // You would need to implement this based on your specific contract events
      console.warn('Could not find Transfer event in transaction logs');
      return null;
      
    } catch (error) {
      console.error('Failed to extract token ID from receipt:', error);
      return null;
    }
  }

  /**
   * Helper method to format wei to ETH
   */
  static weiToEth(wei: bigint): string {
    return (Number(wei) / 1e18).toFixed(6);
  }

  /**
   * Helper method to format ETH to wei
   */
  static ethToWei(eth: number): bigint {
    return BigInt(Math.floor(eth * 1e18));
  }
}

export default EvermarkBlockchainService;