// Marketplace state hook following the established pattern
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletAddress } from '@/hooks/core/useWalletAccount';
import {
  getActiveListings,
  getUserListings,
  getMarketplaceStats,
  createDirectListing,
  buyDirectListing,
  cancelListing,
  approveMarketplace,
  isApprovedForMarketplace,
} from '../services/MarketplaceService';
import { useWalletAccount } from '@/hooks/core/useWalletAccount';
import { useContextualTransactions } from '@/hooks/core/useContextualTransactions';
import type { Account } from 'thirdweb/wallets';
import type { CreateListingParams } from '../types';
import type { MarketplaceListing, MarketplaceStats, MarketplaceFilter, MarketplaceTab } from '../types';

export function useMarketplaceState() {
  const walletAddress = useWalletAddress();
  const walletAccount = useWalletAccount() as unknown as Account | null;
  const { sendTransaction } = useContextualTransactions();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const [filters, setFilters] = useState<MarketplaceFilter>({
    sortBy: 'newest'
  });
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Query for all active listings - always fetch but cache heavily
  const {
    data: listings = [],
    isLoading: isLoadingListings,
    error: listingsError,
    refetch: refetchListings
  } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: getActiveListings,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2
  });

  // Query for user's listings
  const {
    data: userListings = [],
    isLoading: isLoadingUserListings,
    refetch: refetchUserListings
  } = useQuery({
    queryKey: ['marketplace-user-listings', walletAddress],
    queryFn: () => walletAddress ? getUserListings(walletAddress) : Promise.resolve([]),
    staleTime: 30000,
    enabled: activeTab === 'my-listings' && !!walletAddress
  });

  // Query for marketplace stats - heavily cached
  const {
    data: stats,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: getMarketplaceStats,
    staleTime: 60000, // 1 minute
    gcTime: 120000, // Keep in cache for 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  // Create a direct listing
  const handleCreateListing = async (
    tokenId: string,
    price: string,
    currency: 'ETH' | 'EMARK' = 'ETH'
  ) => {
    if (!walletAccount) {
      throw new Error('Wallet not connected');
    }

    setIsCreatingListing(true);
    try {
      const listingParams: CreateListingParams = {
        tokenId,
        price,
        currency
      };
      
      const result = await createDirectListing(listingParams, walletAccount, sendTransaction);
      
      if (result.success) {
        await refetchUserListings();
        await refetchListings();
        return result;
      } else {
        throw new Error(result.error || 'Failed to create listing');
      }
    } finally {
      setIsCreatingListing(false);
    }
  };

  // Buy an NFT
  const handleBuyNFT = async (listingId: string, quantity: number = 1) => {
    if (!walletAccount) {
      throw new Error('Wallet not connected');
    }

    setIsBuying(true);
    try {
      const result = await buyDirectListing(listingId, walletAccount, quantity, sendTransaction);
      
      if (result.success) {
        await refetchListings();
        await refetchUserListings();
        return result;
      } else {
        throw new Error(result.error || 'Failed to purchase NFT');
      }
    } finally {
      setIsBuying(false);
    }
  };

  // Cancel a listing
  const handleCancelListing = async (listingId: string) => {
    if (!walletAccount) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await cancelListing(listingId, walletAccount);
      
      if (result.success) {
        await refetchUserListings();
        await refetchListings();
        return result;
      } else {
        throw new Error(result.error || 'Failed to cancel listing');
      }
    } catch (error) {
      console.error('Error canceling listing:', error);
      throw error;
    }
  };

  // Approve marketplace for NFT
  const handleApproveMarketplace = async (tokenId: string) => {
    if (!walletAccount) {
      throw new Error('Wallet not connected');
    }

    setIsApproving(true);
    try {
      const result = await approveMarketplace(tokenId, walletAccount, sendTransaction);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve marketplace');
      }
      
      return result;
    } finally {
      setIsApproving(false);
    }
  };

  // Check if marketplace is approved for tokenId
  const checkApproval = async (tokenId: string): Promise<boolean> => {
    if (!walletAddress) return false;
    
    try {
      return await isApprovedForMarketplace(walletAddress, tokenId);
    } catch (error) {
      console.error('Error checking approval:', error);
      return false;
    }
  };

  // Filter listings based on current filters
  const filteredListings = listings.filter((listing) => {
    if (filters.priceMin && parseFloat(listing.price) < parseFloat(filters.priceMin)) {
      return false;
    }
    if (filters.priceMax && parseFloat(listing.price) > parseFloat(filters.priceMax)) {
      return false;
    }
    if (filters.currency && filters.currency !== 'all') {
      const listingCurrency = listing.currency.toLowerCase();
      const expectedCurrency = filters.currency.toLowerCase();
      if (expectedCurrency === 'eth' && !listingCurrency.includes('eth') && !listingCurrency.includes('0x000')) {
        return false;
      }
      if (expectedCurrency === 'emark' && !listingCurrency.toLowerCase().includes('emark')) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'price_asc':
        return parseFloat(a.price) - parseFloat(b.price);
      case 'price_desc':
        return parseFloat(b.price) - parseFloat(a.price);
      case 'oldest':
        return a.startTime - b.startTime;
      case 'newest':
      default:
        return b.startTime - a.startTime;
    }
  });

  return {
    // State
    activeTab,
    filters,
    isCreatingListing,
    isBuying,
    isApproving,
    
    // Data
    listings: filteredListings,
    userListings,
    stats,
    
    // Loading states
    isLoadingListings,
    isLoadingUserListings,
    isLoadingStats,
    
    // Errors
    listingsError,
    
    // Actions
    setActiveTab,
    setFilters,
    handleCreateListing,
    handleBuyNFT,
    handleCancelListing,
    handleApproveMarketplace,
    checkApproval,
    refetchListings,
    refetchUserListings,
    
    // Computed
    isConnected: !!walletAddress,
    hasListings: filteredListings.length > 0,
    hasUserListings: userListings.length > 0,
    walletAccount,
  };
}