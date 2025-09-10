// Marketplace service for Thirdweb marketplace integration
import { getContract, prepareContractCall, toWei, sendTransaction } from 'thirdweb';
import { readContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import { CONTRACTS } from '@/lib/contracts';
import { formatEther, parseEther } from 'viem';
import type { MarketplaceListing, MarketplaceStats, CreateListingParams, MarketplaceCurrency } from '../types';
import type { ContextualTransaction, TransactionResult } from '@/hooks/core/useContextualTransactions';
import type { Account } from 'thirdweb/wallets';

// Constants
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

// Get marketplace contract instance
export function getMarketplaceContract() {
  return getContract({
    client,
    chain: base,
    address: CONTRACTS.MARKETPLACE as `0x${string}`,
  });
}

// Get Evermark NFT contract instance  
export function getEvermarkNFTContract() {
  return getContract({
    client,
    chain: base,
    address: CONTRACTS.EVERMARK_NFT as `0x${string}`,
  });
}

// Get supported payment tokens
export const SUPPORTED_PAYMENT_TOKENS = {
  ETH: NATIVE_TOKEN_ADDRESS,
  EMARK: CONTRACTS.EMARK_TOKEN,
} as const;

// Marketplace configuration
const MARKETPLACE_CONFIG = {
  // Use indefinite duration (10 years in seconds)
  DEFAULT_DURATION: 60 * 60 * 24 * 365 * 10,
  // Fee recipient (FeeCollector contract)
  FEE_RECIPIENT: CONTRACTS.FEE_COLLECTOR,
  // Platform fee (1% in basis points)
  PLATFORM_FEE_BPS: 100, // 1%
} as const;

/**
 * Get all active listings from the marketplace
 */
export async function getActiveListings(): Promise<MarketplaceListing[]> {
  try {
    console.log('Fetching marketplace listings...');
    
    const marketplaceContract = getMarketplaceContract();
    
    // Get total number of listings
    const totalListings = await readContract({
      contract: marketplaceContract,
      method: 'function totalListings() view returns (uint256)',
    });
    
    const listings: MarketplaceListing[] = [];
    const totalCount = Number(totalListings);
    
    console.log(`Found ${totalCount} total listings`);
    
    // Fetch each listing individually using MarketplaceV3 format
    for (let i = 0; i < totalCount; i++) {
      try {
        const listing = await readContract({
          contract: marketplaceContract,
          method: 'function getListing(uint256) view returns (uint256 listingId, uint256 tokenId, uint256 quantity, uint256 pricePerToken, uint128 startTimestamp, uint128 endTimestamp, address listingCreator, address assetContract, address currency, uint8 tokenType, uint8 status, bool reserved)',
          params: [BigInt(i)],
        });
        
        const [
          listingId,
          tokenId,
          quantity,
          pricePerToken,
          startTimestamp,
          endTimestamp,
          listingCreator,
          assetContract,
          currency,
          tokenType,
          status,
          reserved
        ] = listing as [bigint, bigint, bigint, bigint, bigint, bigint, string, string, string, number, number, boolean];
        
        // Only include active listings for our NFT contract
        const currentTime = Math.floor(Date.now() / 1000);
        const isActive = Number(startTimestamp) <= currentTime && Number(endTimestamp) > currentTime && status === 1; // status 1 = CREATED/ACTIVE
        const isOurContract = assetContract.toLowerCase() === CONTRACTS.EVERMARK_NFT.toLowerCase();
        
        if (isActive && isOurContract && Number(quantity) > 0) {
          listings.push({
            listingId: listingId.toString(),
            tokenId: tokenId.toString(),
            seller: listingCreator,
            price: formatEther(pricePerToken),
            currency: currency,
            startTime: Number(startTimestamp),
            endTime: Number(endTimestamp),
            quantity: Number(quantity),
            isActive: true,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch listing ${i}:`, error);
        // Continue with other listings
      }
    }
    
    console.log(`Returning ${listings.length} active listings`);
    return listings;
  } catch (error) {
    console.error('Error fetching marketplace listings:', error);
    // Return empty array instead of throwing to avoid breaking the UI
    return [];
  }
}

/**
 * Get listings for a specific user
 */
export async function getUserListings(userAddress: string): Promise<MarketplaceListing[]> {
  try {
    const allListings = await getActiveListings();
    
    // Filter listings by user address
    const userListings = allListings.filter(
      listing => listing.seller.toLowerCase() === userAddress.toLowerCase()
    );
    
    return userListings;
  } catch (error) {
    console.error('Error fetching user listings:', error);
    throw new Error('Failed to fetch user listings');
  }
}

/**
 * Check if a specific token ID is currently listed for sale
 */
export async function isTokenListed(tokenId: string): Promise<boolean> {
  try {
    const listings = await getActiveListings();
    return listings.some(listing => listing.tokenId === tokenId && listing.isActive);
  } catch (error) {
    console.error('Error checking if token is listed:', error);
    return false;
  }
}

/**
 * Get listing details for a specific token ID
 */
export async function getTokenListing(tokenId: string): Promise<MarketplaceListing | null> {
  try {
    const listings = await getActiveListings();
    return listings.find(listing => listing.tokenId === tokenId && listing.isActive) || null;
  } catch (error) {
    console.error('Error fetching token listing:', error);
    return null;
  }
}

/**
 * Get marketplace statistics
 */
export async function getMarketplaceStats(): Promise<MarketplaceStats> {
  try {
    const listings = await getActiveListings();
    
    if (listings.length === 0) {
      return {
        totalVolume: '0',
        totalSales: 0,
        averagePrice: '0',
        floorPrice: '0',
        activeListings: 0,
      };
    }
    
    // Calculate floor price (minimum price among active listings)
    const prices = listings.map(listing => parseFloat(listing.price));
    const floorPrice = Math.min(...prices);
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    
    // TODO: Implement total volume and sales from historical data
    // This would require tracking completed sales events
    
    return {
      totalVolume: '0', // Would need historical sales data
      totalSales: 0,    // Would need historical sales data
      averagePrice: averagePrice.toFixed(4),
      floorPrice: floorPrice.toFixed(4),
      activeListings: listings.length,
    };
  } catch (error) {
    console.error('Error fetching marketplace stats:', error);
    throw new Error('Failed to fetch marketplace stats');
  }
}

/**
 * Create a direct listing for an NFT
 */
export async function createDirectListing(
  params: CreateListingParams,
  account: Account,
  sendTransactionFn: (transaction: ContextualTransaction) => Promise<TransactionResult>
): Promise<{ success: boolean; listingId?: string; error?: string }> {
  try {
    console.log('Creating listing:', params, 'for account:', account.address);
    
    // First verify the user owns the NFT
    const ownsNFT = await verifyNFTOwnership(account.address, params.tokenId);
    if (!ownsNFT) {
      return {
        success: false,
        error: `You don't own NFT #${params.tokenId}`
      };
    }
    
    // Check if NFT is approved for marketplace
    const isApproved = await isApprovedForMarketplace(account.address, params.tokenId);
    if (!isApproved) {
      return {
        success: false,
        error: 'NFT must be approved for marketplace before listing'
      };
    }
    
    const marketplaceContract = getMarketplaceContract();
    const currencyAddress = params.currency === 'ETH' 
      ? SUPPORTED_PAYMENT_TOKENS.ETH 
      : SUPPORTED_PAYMENT_TOKENS.EMARK;
    
    // Prepare listing parameters using MarketplaceV3 struct format
    const currentTime = Math.floor(Date.now() / 1000);
    const listingParams = {
      assetContract: CONTRACTS.EVERMARK_NFT as `0x${string}`,
      tokenId: BigInt(params.tokenId),
      quantity: BigInt(1), // NFTs are always quantity 1
      currency: currencyAddress as `0x${string}`,
      pricePerToken: parseEther(params.price), // Convert price to wei
      startTimestamp: BigInt(currentTime), // Now
      endTimestamp: BigInt(currentTime + MARKETPLACE_CONFIG.DEFAULT_DURATION), // 10 years from now
      reserved: false, // Not reserved for specific buyers
    };
    
    const contextualTransaction: ContextualTransaction = {
      contract: marketplaceContract,
      method: 'function createListing((address assetContract, uint256 tokenId, uint256 quantity, address currency, uint256 pricePerToken, uint128 startTimestamp, uint128 endTimestamp, bool reserved))',
      params: [listingParams],
    };
    
    const result = await sendTransactionFn(contextualTransaction);
    
    console.log('Listing created successfully:', result.transactionHash);
    
    return { 
      success: true, 
      listingId: result.transactionHash, // Use transaction hash as temporary ID
    };
  } catch (error) {
    console.error('Error creating direct listing:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create listing'
    };
  }
}

/**
 * Buy an NFT from a direct listing
 * Uses proper Thirdweb marketplace contract calls with contextual transaction support
 */
export async function buyDirectListing(
  listingId: string,
  account: Account,
  quantity: number = 1,
  sendTransactionFn: (transaction: ContextualTransaction) => Promise<TransactionResult>
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    console.log('Buying listing:', listingId, 'for account:', account.address);
    
    const marketplaceContract = getMarketplaceContract();
    
    // Get listing details to determine payment amount
    const listings = await getActiveListings();
    const listing = listings.find(l => l.listingId === listingId);
    
    if (!listing) {
      return {
        success: false,
        error: 'Listing not found or no longer active'
      };
    }
    
    // Convert price to Wei if it's ETH
    const priceInWei = listing.currency === 'ETH' 
      ? parseEther(listing.price)
      : BigInt(0); // ERC20 purchases don't need ETH value
    
    // Prepare the contextual transaction
    const transaction: ContextualTransaction = {
      contract: marketplaceContract,
      method: "function buyFromListing(uint256 _listingId, address _buyFor, uint256 _quantityToBuy, address _currency, uint256 _totalPrice)",
      params: [
        BigInt(listingId),
        account.address as `0x${string}`,
        BigInt(quantity),
        listing.currency === 'ETH' ? SUPPORTED_PAYMENT_TOKENS.ETH as `0x${string}` : SUPPORTED_PAYMENT_TOKENS.EMARK as `0x${string}`,
        parseEther(listing.price)
      ],
      value: priceInWei // Include ETH value for ETH purchases
    };
    
    // Execute transaction using contextual transaction system
    const result = await sendTransactionFn(transaction);
    
    return { 
      success: true, 
      transactionHash: result.transactionHash
    };
  } catch (error) {
    console.error('Error buying from marketplace:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to complete purchase'
    };
  }
}

/**
 * Cancel a listing
 * Simulates listing cancellation
 * TODO: Implement with proper Thirdweb marketplace contract calls
 */
export async function cancelListing(
  listingId: string,
  account: Account
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Canceling listing:', listingId, 'for account:', account.address);
    
    // TODO: Implement actual marketplace contract call
    // For now, simulate the transaction
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { success: true };
  } catch (error) {
    console.error('Error canceling listing:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel listing'
    };
  }
}

/**
 * Check if user has approved the marketplace to transfer their NFTs
 */
export async function isApprovedForMarketplace(
  userAddress: string,
  tokenId: string
): Promise<boolean> {
  try {
    const nftContract = getEvermarkNFTContract();
    
    // Check if marketplace is approved for this specific token
    const approved = await readContract({
      contract: nftContract,
      method: 'function getApproved(uint256) view returns (address)',
      params: [BigInt(tokenId)],
    });
    
    if (approved && (approved as string).toLowerCase() === CONTRACTS.MARKETPLACE.toLowerCase()) {
      return true;
    }
    
    // Check if marketplace is approved for all tokens
    const approvedForAll = await readContract({
      contract: nftContract,
      method: 'function isApprovedForAll(address, address) view returns (bool)',
      params: [userAddress as `0x${string}`, CONTRACTS.MARKETPLACE as `0x${string}`],
    });
    
    return Boolean(approvedForAll);
  } catch (error) {
    console.error('Error checking marketplace approval:', error);
    return false;
  }
}

/**
 * Approve the marketplace to transfer a specific NFT
 */
export async function approveMarketplace(
  tokenId: string,
  account: Account,
  sendTransactionFn: (transaction: ContextualTransaction) => Promise<TransactionResult>
): Promise<{ success: boolean; error?: string }> {
  try {
    const nftContract = getEvermarkNFTContract();
    
    const contextualTransaction: ContextualTransaction = {
      contract: nftContract,
      method: 'function approve(address, uint256)',
      params: [
        CONTRACTS.MARKETPLACE as `0x${string}`,
        BigInt(tokenId),
      ],
    };
    
    const result = await sendTransactionFn(contextualTransaction);
    
    console.log('Marketplace approved for token:', result.transactionHash);
    
    return { success: true };
  } catch (error) {
    console.error('Error approving marketplace:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to approve marketplace'
    };
  }
}

/**
 * Get marketplace contract address for external links
 */
export function getMarketplaceAddress(): string {
  return CONTRACTS.MARKETPLACE;
}

/**
 * Get marketplace explorer URL
 */
export function getMarketplaceExplorerUrl(): string {
  return `https://basescan.org/address/${CONTRACTS.MARKETPLACE}`;
}

/**
 * Get supported currencies for marketplace
 */
export function getSupportedCurrencies(): MarketplaceCurrency[] {
  return [
    { symbol: 'ETH', address: NATIVE_TOKEN_ADDRESS, name: 'Ethereum' },
    { symbol: 'EMARK', address: CONTRACTS.EMARK_TOKEN, name: 'Evermark Token' },
  ];
}

/**
 * Format currency symbol for display
 */
export function formatCurrencySymbol(currencyAddress: string): string {
  if (currencyAddress === NATIVE_TOKEN_ADDRESS) return 'ETH';
  if (currencyAddress.toLowerCase() === CONTRACTS.EMARK_TOKEN.toLowerCase()) return 'EMARK';
  return 'Unknown';
}

/**
 * Get listing by ID
 * TODO: Implement with proper Thirdweb marketplace contract calls
 */
export async function getListingById(listingId: string): Promise<MarketplaceListing | null> {
  try {
    const allListings = await getActiveListings();
    return allListings.find(listing => listing.listingId === listingId) || null;
  } catch (error) {
    console.error('Error fetching listing:', error);
    return null;
  }
}

/**
 * Verify user owns a specific NFT token
 */
export async function verifyNFTOwnership(
  userAddress: string,
  tokenId: string
): Promise<boolean> {
  try {
    const nftContract = getEvermarkNFTContract();
    
    const owner = await readContract({
      contract: nftContract,
      method: 'function ownerOf(uint256) view returns (address)',
      params: [BigInt(tokenId)],
    });
    
    return (owner as string).toLowerCase() === userAddress.toLowerCase();
  } catch (error) {
    console.error('Error verifying NFT ownership:', error);
    return false;
  }
}

/**
 * Get user's NFT count for display purposes
 */
export async function getUserNFTCount(userAddress: string): Promise<number> {
  try {
    const nftContract = getEvermarkNFTContract();
    
    const balance = await readContract({
      contract: nftContract,
      method: 'function balanceOf(address) view returns (uint256)',
      params: [userAddress as `0x${string}`],
    });
    
    return Number(balance);
  } catch (error) {
    console.error('Error getting NFT count:', error);
    return 0;
  }
}

/**
 * Get user's owned token IDs by brute force checking
 * WARNING: This is expensive for large collections. Use sparingly.
 */
export async function getUserOwnedTokenIds(
  userAddress: string,
  maxTokenId?: number
): Promise<string[]> {
  try {
    const nftContract = getEvermarkNFTContract();
    
    // Get total supply if no max specified
    const totalSupply = maxTokenId || Number(await readContract({
      contract: nftContract,
      method: 'function totalSupply() view returns (uint256)',
    }));
    
    const ownedTokens: string[] = [];
    
    // Check ownership in smaller batches to avoid overwhelming the RPC
    const batchSize = 5;
    for (let i = 1; i <= totalSupply; i += batchSize) {
      const batch: Promise<void>[] = [];
      for (let j = i; j < Math.min(i + batchSize, totalSupply + 1); j++) {
        batch.push(
          readContract({
            contract: nftContract,
            method: 'function ownerOf(uint256) view returns (address)',
            params: [BigInt(j)],
          }).then(owner => {
            if ((owner as string).toLowerCase() === userAddress.toLowerCase()) {
              ownedTokens.push(j.toString());
            }
          }).catch(() => {
            // Token doesn't exist or other error, skip
          })
        );
      }
      
      await Promise.all(batch);
      
      // Add small delay between batches
      if (i + batchSize <= totalSupply) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
      }
    }
    
    return ownedTokens.sort((a, b) => Number(a) - Number(b));
  } catch (error) {
    console.error('Error getting owned token IDs:', error);
    return [];
  }
}

/**
 * Check user's NFT ownership and approval status for creating listings
 */
export async function getUserNFTsForListing(userAddress: string): Promise<{
  ownedTokens: Array<{ tokenId: string; isApproved: boolean }>;
}> {
  try {
    console.log('Getting NFTs for user:', userAddress);
    
    // Get user's NFT count for display
    const nftCount = await getUserNFTCount(userAddress);
    console.log(`User owns ${nftCount} NFTs`);
    
    // For now, return empty array since enumeration is expensive
    // Could implement brute force enumeration here if needed:
    // const ownedTokenIds = await getUserOwnedTokenIds(userAddress, 50); // Limit to first 50
    
    return { ownedTokens: [] };
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    return { ownedTokens: [] };
  }
}