// =============================================================================
// File: src/features/evermarks/services/BlockchainService.ts
// NO METADATASERVICE DEPENDENCIES - Enhanced with SDK error types
// =============================================================================

import { prepareContractCall, readContract, getRpcClient, sendTransaction, waitForReceipt } from 'thirdweb';
import type { Account } from 'thirdweb/wallets';
import { client } from '@/lib/thirdweb';
import { CONTRACTS, getEvermarkNFTContract } from '@/lib/contracts';

// Simple error class for blockchain operations
class StorageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Simple URL validation
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

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
   * SDK-ENHANCED: Validate contract configuration (simplified to avoid reentrancy)
   */
  private static validateConfiguration(): { isValid: boolean; error?: string } {
    try {
      // Check if contract address is configured
      if (!CONTRACTS?.EVERMARK_NFT) {
        return { isValid: false, error: 'EVERMARK_NFT contract address not found in environment variables' };
      }

      const contractAddress = CONTRACTS.EVERMARK_NFT;
      if (!contractAddress) {
        return { isValid: false, error: 'Contract address is not defined' };
      }

      console.log('🔍 Validating contract address:', {
        contractAddress,
        type: typeof contractAddress,
        length: contractAddress?.length
      });

      if (!this.isValidAddress(contractAddress)) {
        return { 
          isValid: false, 
          error: `Invalid contract address format: "${contractAddress}". Expected 42-character hex string starting with 0x.` 
        };
      }

      console.log('✅ Contract address configured:', contractAddress);
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
      throw new StorageError(configValidation.error!, 'CONFIG_ERROR');
    }

    try {
      console.log('📋 Fetching contract information...');
      const contract = getEvermarkNFTContract();
      console.log('📋 Contract address:', contract.address);
      console.log('📋 Chain:', contract.chain.name);
      
      // Fetch all contract parameters in parallel with error handling
      console.log('📋 Attempting to read contract functions...');
      const [mintingFee, referralPercentage, totalSupply, isPaused] = await Promise.allSettled([
        this.getMintingFee(),
        this.getReferralPercentage(),
        this.getTotalSupply(),
        this.getIsPaused()
      ]);

      // Log results of each call
      console.log('📋 Contract call results:', {
        mintingFee: mintingFee.status === 'fulfilled' ? 'SUCCESS' : `FAILED: ${mintingFee.reason}`,
        referralPercentage: referralPercentage.status === 'fulfilled' ? 'SUCCESS' : `FAILED: ${referralPercentage.reason}`,
        totalSupply: totalSupply.status === 'fulfilled' ? 'SUCCESS' : `FAILED: ${totalSupply.reason}`,
        isPaused: isPaused.status === 'fulfilled' ? 'SUCCESS' : `FAILED: ${isPaused.reason}`
      });

      const contractInfo: ContractInfo = {
        mintingFee: mintingFee.status === 'fulfilled' ? mintingFee.value : BigInt('70000000000000'), // 0.00007 ETH fallback
        referralPercentage: referralPercentage.status === 'fulfilled' ? referralPercentage.value : 10,
        totalSupply: totalSupply.status === 'fulfilled' ? totalSupply.value : 0,
        isPaused: isPaused.status === 'fulfilled' ? isPaused.value : false
      };

      console.log('📋 Contract info retrieved:', contractInfo);
      return contractInfo;
    } catch (error) {
      console.error('❌ Failed to get contract info:', error);
      throw new StorageError(
        `Failed to fetch contract information: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTRACT_ERROR'
      );
    }
  }

  /**
   * Get current minting fee from contract
   */
  static async getMintingFee(): Promise<bigint> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new StorageError(configValidation.error!, 'CONFIG_ERROR');
    }

    try {
      const contract = getEvermarkNFTContract();
      const result = await readContract({
        contract,
        method: "function MINTING_FEE() view returns (uint256)",
        params: []
      });
      return result as bigint;
    } catch (error) {
      console.warn('Failed to get minting fee from contract:', error);
      throw new StorageError(
        `Failed to read minting fee: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTRACT_ERROR'
      );
    }
  }

  /**
   * Get referral percentage from contract
   */
  static async getReferralPercentage(): Promise<number> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new StorageError(configValidation.error!, 'CONFIG_ERROR');
    }

    try {
      const result = await readContract({
        contract: getEvermarkNFTContract(),
        method: "function REFERRAL_PERCENTAGE() view returns (uint256)",
        params: []
      });
      return Number(result);
    } catch (error) {
      console.warn('Failed to get referral percentage from contract:', error);
      throw new StorageError(
        `Failed to read referral percentage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTRACT_ERROR'
      );
    }
  }

  // MAX_BATCH_SIZE method removed - not available in current contract

  /**
   * Check if contract is paused
   */
  static async getIsPaused(): Promise<boolean> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new StorageError(configValidation.error!, 'CONFIG_ERROR');
    }

    try {
      const result = await readContract({
        contract: getEvermarkNFTContract(),
        method: "function paused() view returns (bool)",
        params: []
      });
      return result as boolean;
    } catch (error) {
      console.warn('Failed to check if contract is paused:', error);
      throw new StorageError(
        `Failed to read pause status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTRACT_ERROR'
      );
    }
  }

  /**
   * ENHANCED: Mint a new Evermark NFT (No MetadataService dependency)
   * @param metadataURI - Pre-created metadata URI from EvermarkService
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
      console.log('🔍 Step 1: Validating configuration...');
      const configValidation = this.validateConfiguration();
      console.log('🔍 Configuration validation result:', configValidation);
      if (!configValidation.isValid) {
        console.log('❌ Configuration validation failed:', configValidation.error);
        return {
          success: false,
          error: configValidation.error
        };
      }
      console.log('✅ Step 1 completed: Configuration valid');

      // Step 2: Validate account
      console.log('🔍 Step 2: Validating account...', account);
      if (!account?.address || !this.isValidAddress(account.address)) {
        console.log('❌ Account validation failed:', account);
        return {
          success: false,
          error: 'Invalid account address provided'
        };
      }
      console.log('✅ Step 2 completed: Account valid, address:', account.address);

      // Step 3: Validate input parameters
      console.log('🔍 Step 3: Validating input parameters...', { metadataURI, title, creator, referrer });
      if (!metadataURI?.trim()) {
        console.log('❌ Metadata URI validation failed');
        return {
          success: false,
          error: 'Metadata URI is required'
        };
      }

      // SDK VALIDATION: Validate metadata URI format (accept both HTTP and IPFS URIs)
      const isValidIPFS = metadataURI.startsWith('ipfs://') && metadataURI.length > 7;
      const isValidHTTP = isValidUrl(metadataURI);
      
      if (!isValidIPFS && !isValidHTTP) {
        console.log('❌ Metadata URI format validation failed:', metadataURI);
        return {
          success: false,
          error: 'Invalid metadata URI format - must be HTTP(S) or IPFS URI'
        };
      }
      console.log('✅ Metadata URI format valid:', metadataURI.startsWith('ipfs://') ? 'IPFS' : 'HTTP');

      if (!title?.trim()) {
        console.log('❌ Title validation failed');
        return {
          success: false,
          error: 'Title is required'
        };
      }

      if (!creator?.trim()) {
        console.log('❌ Creator validation failed');
        return {
          success: false,
          error: 'Creator is required'
        };
      }
      console.log('✅ Step 3 completed: Input parameters valid');

      // Step 4: Validate referrer address if provided
      console.log('🔍 Step 4: Validating referrer...', referrer);
      if (referrer && !this.isValidAddress(referrer)) {
        console.log('❌ Referrer validation failed:', referrer);
        return {
          success: false,
          error: 'Invalid referrer address format'
        };
      }
      console.log('✅ Step 4 completed: Referrer valid (or not provided)');

      // Step 5: Use fixed minting fee to avoid any contract reads before minting
      console.log('📋 Step 5: Using fixed minting fee to avoid reentrancy...');
      const mintingFee = BigInt('70000000000000'); // 0.00007 ETH - correct fee from contracts
      console.log('💰 Using fixed minting fee:', mintingFee.toString(), 'wei');

      // Step 6: Skip balance check to avoid any RPC calls before minting
      console.log('💰 Step 6: Skipping balance check to avoid reentrancy issues...');
      console.log('💰 Proceeding with mint - MetaMask will handle insufficient funds');

      // Step 7: Use proper Thirdweb v5 approach
      console.log('📝 Step 7: Using standard Thirdweb contract interaction...');
      
      const contract = getEvermarkNFTContract();
      
      // Log all parameters before preparing transaction
      console.log('📝 Transaction parameters:', {
        metadataURI,
        metadataURIType: typeof metadataURI,
        title,
        titleType: typeof title,
        creator,
        creatorType: typeof creator,
        mintingFee: mintingFee.toString(),
        mintingFeeType: typeof mintingFee
      });

      // Ensure all string parameters are properly cleaned and validated
      const cleanMetadataURI = String(metadataURI).trim();
      const cleanTitle = String(title).trim().replace(/[^\x20-\x7E]/g, ''); // Remove non-ASCII chars
      const cleanCreator = String(creator).trim();

      // Additional validation for ethers.js compatibility
      if (cleanMetadataURI.length === 0) {
        throw new Error('Metadata URI cannot be empty after cleaning');
      }
      if (cleanTitle.length === 0) {
        throw new Error('Title cannot be empty after cleaning');
      }
      if (cleanCreator.length === 0) {
        throw new Error('Creator cannot be empty after cleaning');
      }

      // Validate that creator is a valid address format
      if (!this.isValidAddress(cleanCreator)) {
        throw new Error(`Creator address is not valid: ${cleanCreator}`);
      }

      console.log('📝 Cleaned and validated parameters:', {
        cleanMetadataURI,
        cleanTitle,
        cleanCreator,
        contractAddress: contract.address,
        creatorIsValidAddress: this.isValidAddress(cleanCreator)
      });

      const transaction = prepareContractCall({
        contract,
        method: "function mintEvermarkWithReferral(string metadataURI, string title, string creator, address referrer) payable returns (uint256)",
        params: [cleanMetadataURI, cleanTitle, cleanCreator, "0x2B27EA7DaA8Bf1dE98407447b269Dfe280753fe3"],
        value: mintingFee,
      });

      console.log('📝 Transaction prepared with Thirdweb');
      console.log('🚀 Sending transaction through Thirdweb...');

      // FIXED: Use static import to avoid any dynamic import issues
      console.log('🚀 Sending transaction with Thirdweb...');
      console.log('📋 Transaction details:', {
        method: 'mintEvermarkWithReferral',
        value: mintingFee.toString(),
        address: account.address,
        contractAddress: contract.address,
        referrer: "0x2B27EA7DaA8Bf1dE98407447b269Dfe280753fe3"
      });
      
      // Send transaction using Thirdweb
      const txHash = await sendTransaction({
        transaction,
        account,
      });
      
      console.log('✅ Thirdweb transaction sent:', txHash);
      
      const transactionHash = typeof txHash === 'object' && 'transactionHash' in txHash 
        ? txHash.transactionHash 
        : String(txHash);
      
      console.log('⏳ Waiting for confirmation with Thirdweb...', transactionHash);

      // Step 9: Wait for transaction confirmation using Thirdweb
      const txReceipt = await waitForReceipt({
        client,
        chain: getEvermarkNFTContract().chain,
        transactionHash: transactionHash as `0x${string}`,
      });

      // Step 10: Extract token ID from transaction logs
      const tokenIdBigInt = this.extractTokenIdFromReceipt(txReceipt);

      console.log('✅ Evermark minted successfully:', {
        txHash: transactionHash,
        tokenId: tokenIdBigInt?.toString(),
        gasUsed: txReceipt.gasUsed?.toString(),
        mintingFee: mintingFee.toString()
      });

      const mintResult: MintResult = {
        success: true,
        txHash: transactionHash
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
        chain: getEvermarkNFTContract().chain,
      });
      
      const balance = await rpcRequest({
        method: 'eth_getBalance',
        params: [account.address, 'latest'],
      });
      
      const balanceBigInt = BigInt(balance as string);
      
      // Use provided minting fee or use a reasonable default
      const fee = mintingFee ?? BigInt('1000000000000000'); // 0.001 ETH default
      
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
      throw new StorageError(configValidation.error!, 'CONFIG_ERROR');
    }

    try {
      const result = await readContract({
        contract: getEvermarkNFTContract(),
        method: "function totalSupply() view returns (uint256)",
        params: []
      });

      return Number(result);
    } catch (error) {
      console.error('Failed to get total supply:', error);
      throw new StorageError(
        `Failed to read total supply: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTRACT_ERROR'
      );
    }
  }

  /**
   * Check if blockchain service is properly configured
   */
  static isConfigured(): boolean {
    try {
      // Simple validation: just check if we have a contract address
      const hasAddress = !!CONTRACTS.EVERMARK_NFT;
      const isValidAddress = hasAddress && this.isValidAddress(CONTRACTS.EVERMARK_NFT);
      
      console.log('🔧 Blockchain configuration check:', {
        hasAddress,
        address: CONTRACTS.EVERMARK_NFT,
        isValidAddress
      });
      
      return hasAddress && isValidAddress;
    } catch (error) {
      console.error('❌ Blockchain configuration check failed:', error);
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
  private static extractTokenIdFromReceipt(receipt: { logs?: Array<{ topics?: string[]; [key: string]: unknown }> }): bigint | null {
    try {
      const logs = receipt.logs ?? [];
      
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

  /**
   * Get pending referral payment for an address
   */
  static async getPendingReferralPayment(address: string): Promise<bigint> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      throw new StorageError(configValidation.error!, 'CONFIG_ERROR');
    }

    try {
      const contract = getEvermarkNFTContract();
      const result = await readContract({
        contract,
        method: "function pendingReferralPayments(address) view returns (uint256)",
        params: [address]
      });
      return result as bigint;
    } catch (error) {
      console.warn('Failed to get pending referral payment:', error);
      throw new StorageError(
        `Failed to read pending referral payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONTRACT_ERROR'
      );
    }
  }

  /**
   * Claim pending referral payment
   */
  static async claimReferralPayment(account: Account): Promise<MintResult> {
    const configValidation = this.validateConfiguration();
    if (!configValidation.isValid) {
      return {
        success: false,
        error: configValidation.error
      };
    }

    try {
      const contract = getEvermarkNFTContract();
      
      const transaction = prepareContractCall({
        contract,
        method: "function claimPendingReferralPayment()",
        params: []
      });

      const txHash = await sendTransaction({
        transaction,
        account,
      });

      const transactionHash = typeof txHash === 'object' && 'transactionHash' in txHash 
        ? txHash.transactionHash 
        : String(txHash);

      const txReceipt = await waitForReceipt({
        client,
        chain: getEvermarkNFTContract().chain,
        transactionHash: transactionHash as `0x${string}`,
      });

      console.log('✅ Referral payment claimed successfully:', {
        txHash: transactionHash,
        gasUsed: txReceipt.gasUsed?.toString()
      });

      return {
        success: true,
        txHash: transactionHash
      };

    } catch (error) {
      console.error('❌ Referral claim failed:', error);
      
      let errorMessage = 'Failed to claim referral payment';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('no pending payment') || message.includes('amount = 0')) {
          errorMessage = 'No pending referral payments to claim';
        } else if (message.includes('user rejected') || message.includes('denied')) {
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
  }
}

export default EvermarkBlockchainService;