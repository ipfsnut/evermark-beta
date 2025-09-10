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
} from '../services/MarketplaceService';
import type { MarketplaceListing, MarketplaceStats, MarketplaceFilter, MarketplaceTab } from '../types';

export function useMarketplaceState() {
  const walletAddress = useWalletAddress();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>('browse');
  const [filters, setFilters] = useState<MarketplaceFilter>({
    sortBy: 'newest'
  });
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  // Query for all active listings
  const {
    data: listings = [],
    isLoading: isLoadingListings,
    error: listingsError,
    refetch: refetchListings
  } = useQuery({
    queryKey: ['marketplace-listings', filters],
    queryFn: getActiveListings,
    staleTime: 30000, // 30 seconds
    enabled: activeTab === 'browse'
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

  // Query for marketplace stats
  const {
    data: stats,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: getMarketplaceStats,
    staleTime: 60000, // 1 minute
  });

  // Create a direct listing
  const handleCreateListing = async (
    tokenId: string,
    priceInEth: string,
    durationInDays: number
  ) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setIsCreatingListing(true);
    try {
      const durationInSeconds = durationInDays * 24 * 60 * 60;
      const result = await createDirectListing(tokenId, priceInEth, durationInSeconds);
      
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
  const handleBuyNFT = async (listingId: string) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setIsBuying(true);
    try {
      const result = await buyDirectListing(listingId);
      
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
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await cancelListing(listingId);
      
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

  // Filter listings based on current filters
  const filteredListings = listings.filter((listing) => {
    if (filters.priceMin && parseFloat(listing.price) < parseFloat(filters.priceMin)) {
      return false;
    }
    if (filters.priceMax && parseFloat(listing.price) > parseFloat(filters.priceMax)) {
      return false;
    }
    if (filters.listingType && filters.listingType !== 'all' && listing.listingType !== filters.listingType) {
      return false;
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
    refetchListings,
    refetchUserListings,
    
    // Computed
    isConnected: !!walletAddress,
    hasListings: filteredListings.length > 0,
    hasUserListings: userListings.length > 0,
  };
}