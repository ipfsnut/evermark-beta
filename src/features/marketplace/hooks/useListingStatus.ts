import { useState, useEffect } from 'react';
import { isTokenListed, getTokenListing } from '../services/MarketplaceService';
import type { MarketplaceListing } from '../types';

/**
 * Hook to check if a token is listed for sale and get listing details
 */
export function useListingStatus(tokenId: string | number) {
  const [isListed, setIsListed] = useState<boolean>(false);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const tokenIdStr = tokenId.toString();

  useEffect(() => {
    if (!tokenIdStr) {
      setIsListed(false);
      setListing(null);
      setIsLoading(false);
      return;
    }

    async function checkListingStatus() {
      try {
        setIsLoading(true);
        
        // Check if token is listed and get listing details in parallel
        const [listed, listingDetails] = await Promise.all([
          isTokenListed(tokenIdStr),
          getTokenListing(tokenIdStr)
        ]);

        setIsListed(listed);
        setListing(listingDetails);
      } catch (error) {
        console.error('Error checking listing status:', error);
        setIsListed(false);
        setListing(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkListingStatus();
  }, [tokenIdStr]);

  return {
    isListed,
    listing,
    isLoading,
    price: listing?.price,
    currency: listing?.currency,
    seller: listing?.seller
  };
}