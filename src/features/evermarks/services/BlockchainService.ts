// src/features/evermarks/services/BlockchainService.ts
// Enhanced blockchain service with proper address validation and error handling

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
   * Validate Ethereum address format
   */
  private static isValidAddress(address: string): boolean {
    if (!address) return false;
    
    // Check if it's a valid hex string of correct length
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    return addressRegex.test(address);
  }

  /**
   * Validate contract configuration before any operations
   */
  private static validateConfiguration(): { isValid: boolean; error?: string } {
    try {
      if (!CONTRACTS?.EVERMARK_NFT) {
        return { isValid: false, error: 'EVERMARK_NFT contract not found in configuration' };
      }

      const contractAddress = CONTRACTS.EVERMARK_NFT.address;
      if (!contractAddress) {
        return { isValid: false, error: 'Contract address is not defined' };
      }

      if (!this.isValidAddress(contractAddress)) {
        return { 
          isValid: false, 
          error: `Invalid contract address format: "${contractAddress}". Expected 42-character hex string starting with 0x.` 
        };
      }

      if (!CONTRACTS.EVERMARK_NFT.chain) {
        return { isValid: false, error: 'Contract chain configuration is missing' };
      }

      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get current contract information and parameters
   */
  static async getContractInfo(): Promise<ContractInfo> {
    // Validate configuration first
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      console.error('❌ Contract configuration invalid:', configValidation.error);
      throw new Error(configValidation.error);
    }

    try {
      console.log('📋 Fetching contract information...');
      console.log('📋 Contract address:', CONTRACTS.EVERMARK_NFT.address);
      console.log('📋 Chain:', CONTRACTS.EVERMARK_NFT.chain.name);
      
      // Fetch all contract parameters in parallel with error handling
      const [mintingFee, referralPercentage, maxBatchSize, totalSupply, isPaused] = await Promise.allSettled([
        this.getMintingFee(),
        this.getReferralPercentage(),
        this.getMaxBatchSize(),
        this.getTotalSupply(),
        this.getIsPaused()
      ]);

      const contractInfo: ContractInfo = {
        mintingFee: mintingFee.status === 'fulfilled' ? mintingFee.value : BigInt('1000000000000000'), // 0.001 ETH fallback
        referralPercentage: referralPercentage.status === 'fulfilled' ? referralPercentage.value : 10,
        maxBatchSize: maxBatchSize.status === 'fulfilled' ? maxBatchSize.value : 10,
        totalSupply: totalSupply.status === 'fulfilled' ? totalSupply.value : 0,
        isPaused: isPaused.status === 'fulfilled' ? isPaused.value : false
      };

      console.log('📋 Contract info retrieved:', contractInfo);
      return contractInfo;
    } catch (error) {
      console.error('❌ Failed to get contract info:', error);
      throw new Error(`Failed to fetch contract information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current minting fee from contract
   */
  static async getMintingFee(): Promise<bigint> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function MINTING_FEE() view returns (uint256)",
        params: []
      });
      return result as bigint;
    } catch (error) {
      console.warn('Failed to get minting fee from contract:', error);
      throw new Error(`Failed to read minting fee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get referral percentage from contract
   */
  static async getReferralPercentage(): Promise<number> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function REFERRAL_PERCENTAGE() view returns (uint256)",
        params: []
      });
      return Number(result);
    } catch (error) {
      console.warn('Failed to get referral percentage from contract:', error);
      throw new Error(`Failed to read referral percentage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get max batch size from contract
   */
  static async getMaxBatchSize(): Promise<number> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function MAX_BATCH_SIZE() view returns (uint256)",
        params: []
      });
      return Number(result);
    } catch (error) {
      console.warn('Failed to get max batch size from contract:', error);
      throw new Error(`Failed to read max batch size: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if contract is paused
   */
  static async getIsPaused(): Promise<boolean> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function paused() view returns (bool)",
        params: []
      });
      return result as boolean;
    } catch (error) {
      console.warn('Failed to check if contract is paused:', error);
      throw new Error(`Failed to read pause status: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      // Step 1: Validate configuration
      const configValidation = this.validateConfiguration();
      if (!configValidation.isValid) {
        return {
          success: false,
          error: configValidation.error
        };
      }

      // Step 2: Validate account
      if (!account?.address || !this.isValidAddress(account.address)) {
        return {
          success: false,
          error: 'Invalid account address provided'
        };
      }

      // Step 3: Validate input parameters
      if (!metadataURI?.trim()) {
        return {
          success: false,
          error: 'Metadata URI is required'
        };
      }

      if (!title?.trim()) {
        return {
          success: false,
          error: 'Title is required'
        };
      }

      if (!creator?.trim()) {
        return {
          success: false,
          error: 'Creator is required'
        };
      }

      // Step 4: Validate referrer address if provided
      if (referrer && !this.isValidAddress(referrer)) {
        return {
          success: false,
          error: 'Invalid referrer address format'
        };
      }

      // Step 5: Get current contract information
      const contractInfo = await this.getContractInfo();
      
      if (contractInfo.isPaused) {
        return {
          success: false,
          error: 'Contract is currently paused. Minting is temporarily disabled.'
        };
      }

      console.log('💰 Current minting fee:', contractInfo.mintingFee.toString(), 'wei');

      // Step 6: Check if user can afford the mint
      const canAfford = await this.canAffordMint(account, contractInfo.mintingFee);
      if (!canAfford) {
        return {
          success: false,
          error: 'Insufficient funds for minting fee and gas'
        };
      }

      // Step 7: Prepare the contract call
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

      // Step 8: Send the transaction
      const result = await sendTransaction({
        transaction,
        account
      });

      console.log('⏳ Transaction sent, waiting for confirmation...', result.transactionHash);

      // Step 9: Wait for transaction confirmation
      const txReceipt = await waitForReceipt({
        client,
        chain: CONTRACTS.EVERMARK_NFT.chain,
        transactionHash: result.transactionHash as `0x${string}`,
      });

      // Step 10: Extract token ID from transaction logs
      const tokenIdBigInt = this.extractTokenIdFromReceipt(txReceipt);

      console.log('✅ Evermark minted successfully:', {
        txHash: result.transactionHash,
        tokenId: tokenIdBigInt?.toString(),
        gasUsed: txReceipt.gasUsed?.toString(),
        mintingFee: contractInfo.mintingFee.toString()
      });

      const mintResult: MintResult = {
        success: true,
        txHash: result.transactionHash
      };

      if (tokenIdBigInt) {
        mintResult.tokenId = tokenIdBigInt.toString();
      }

      return mintResult;

    } catch (error) {
      console.error('❌ Blockchain minting failed:', error);
      
      let errorMessage = 'Blockchain transaction failed';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('invalid address') || message.includes('checksum')) {
          errorMessage = 'Invalid contract address configuration. Please check your environment variables.';
        } else if (message.includes('insufficient funds')) {
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
        } else if (message.includes('contract not found')) {
          errorMessage = 'Contract not found at specified address. Please verify the contract address.';
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
   * Check if user has enough balance to mint
   */
  static async canAffordMint(account: Account, mintingFee?: bigint): Promise<boolean> {
    try {
      if (!account?.address || !this.isValidAddress(account.address)) {
        console.warn('Invalid account address for balance check');
        return false;
      }

      const configValidation = this.validateConfiguration();
      if (!configValidation.isValid) {
        console.warn('Configuration invalid for balance check:', configValidation.error);
        return false;
      }

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
      return false;
    }
  }

  /**
   * Get total supply of Evermarks
   */
  static async getTotalSupply(): Promise<number> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new Error(configValidation.error);
    }

    try {
      const result = await readContract({
        contract: CONTRACTS.EVERMARK_NFT,
        method: "function totalSupply() view returns (uint256)",
        params: []
      });

      return Number(result);
    } catch (error) {
      console.error('Failed to get total supply:', error);
      throw new Error(`Failed to read total supply: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if blockchain service is properly configured
   */
  static isConfigured(): boolean {
    try {
      const configValidation = this.validateConfiguration();
      return configValidation.isValid;
    } catch {
      return false;
    }
  }

  /**
   * Get contract debugging info
   */
  static getDebugInfo() {
    try {
      const validation = this.validateConfiguration();
      
      return {
        isValid: validation.isValid,
        error: validation.error,
        address: CONTRACTS?.EVERMARK_NFT?.address,
        addressLength: CONTRACTS?.EVERMARK_NFT?.address?.length,
        chain: CONTRACTS?.EVERMARK_NFT?.chain?.id,
        chainName: CONTRACTS?.EVERMARK_NFT?.chain?.name,
        environment: {
          contractAddress: import.meta.env.VITE_EVERMARK_CONTRACT_ADDRESS,
          rpcUrl: import.meta.env.VITE_RPC_URL,
          hasClient: !!client
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: {
          contractAddress: import.meta.env.VITE_EVERMARK_CONTRACT_ADDRESS,
          rpcUrl: import.meta.env.VITE_RPC_URL
        }
      };
    }
  }

  /**
   * Extract token ID from transaction receipt
   */
  private static extractTokenIdFromReceipt(receipt: any): bigint | null {
    try {
      const logs = receipt.logs || [];
      
      // ERC721 Transfer event signature: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
      const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      
      for (const log of logs) {
        if (log.topics && log.topics[0] === transferSignature) {
          const fromAddress = log.topics[1];
          const zeroAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
          
          if (fromAddress === zeroAddress) {
            // This is a mint event
            const tokenId = log.topics[3];
            if (tokenId) {
              return BigInt(tokenId);
            }
          }
        }
      }
      
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