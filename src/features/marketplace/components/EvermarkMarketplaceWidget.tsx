import React, { useState, useEffect } from 'react';
import { ShoppingCart, Tag, X, Loader, DollarSign } from 'lucide-react';
import { useMarketplaceState } from '../hooks/useMarketplaceState';
import CreateListingModal from './CreateListingModal';
import { formatCurrencySymbol } from '../services/MarketplaceService';
import { useWalletAddress } from '../../../hooks/core/useWalletAccount';
import { cn } from '../../../utils/responsive';
import { useTheme } from '../../../providers/ThemeProvider';
import type { MarketplaceListing } from '../types';

interface EvermarkMarketplaceWidgetProps {
  tokenId: string;
  ownerAddress: string;
  className?: string;
}

export function EvermarkMarketplaceWidget({
  tokenId,
  ownerAddress,
  className = ''
}: EvermarkMarketplaceWidgetProps) {
  const { isDark } = useTheme();
  const walletAddress = useWalletAddress();
  const {
    listings,
    isLoadingListings,
    handleBuyNFT,
    handleCancelListing,
    isBuying,
    refetchListings,
    isConnected
  } = useMarketplaceState();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentListing, setCurrentListing] = useState<MarketplaceListing | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if current user is the owner
  const isOwner = walletAddress && ownerAddress.toLowerCase() === walletAddress.toLowerCase();

  // Find active listing for this token
  useEffect(() => {
    const listing = listings.find(l => l.tokenId === tokenId && l.isActive);
    setCurrentListing(listing || null);
  }, [listings, tokenId]);

  const handleBuyClick = async () => {
    if (!currentListing) return;
    
    setIsProcessing(true);
    try {
      const result = await handleBuyNFT(currentListing.listingId);
      if (result.success) {
        setCurrentListing(null);
        await refetchListings();
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelClick = async () => {
    if (!currentListing) return;
    
    setIsProcessing(true);
    try {
      const result = await handleCancelListing(currentListing.listingId);
      if (result.success) {
        setCurrentListing(null);
        await refetchListings();
      }
    } catch (error) {
      console.error('Cancel failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleListingSuccess = () => {
    setShowCreateModal(false);
    refetchListings();
  };

  // Loading state
  if (isLoadingListings) {
    return (
      <div className={cn(
        'border rounded-lg p-6',
        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200',
        className
      )}>
        <div className="flex items-center justify-center">
          <Loader className="h-5 w-5 animate-spin text-gray-400 mr-2" />
          <span className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Loading marketplace data...
          </span>
        </div>
      </div>
    );
  }

  // If there's an active listing
  if (currentListing) {
    return (
      <>
        <div className={cn(
          'border rounded-lg p-6',
          isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200',
          className
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Tag className="h-5 w-5 text-cyber-primary" />
            <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              For Sale
            </h3>
          </div>

          <div className="space-y-4">
            {/* Price Display */}
            <div className="text-center">
              <div className="text-3xl font-bold text-cyber-primary mb-1">
                {currentListing.price} {formatCurrencySymbol(currentListing.currency)}
              </div>
              <div className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                Listed by {currentListing.seller.slice(0, 6)}...{currentListing.seller.slice(-4)}
              </div>
            </div>

            {/* Action Button */}
            <div className="space-y-2">
              {isOwner ? (
                <button
                  onClick={handleCancelClick}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {isProcessing ? 'Cancelling...' : 'Cancel Listing'}
                </button>
              ) : (
                <button
                  onClick={handleBuyClick}
                  disabled={!isConnected || isProcessing}
                  className="w-full flex items-center justify-center gap-2 bg-cyber-primary text-black py-2 px-4 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isProcessing ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  {isProcessing ? 'Purchasing...' : 'Buy Now'}
                </button>
              )}
              
              {!isConnected && !isOwner && (
                <p className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-gray-600')}>
                  Connect your wallet to purchase
                </p>
              )}
            </div>

            {/* Listing Details */}
            <div className={cn(
              'text-xs border-t pt-3 space-y-1',
              isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-600'
            )}>
              <div>Listed on {new Date(currentListing.startTime * 1000).toLocaleDateString()}</div>
              <div>Valid until {new Date(currentListing.endTime * 1000).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Create Listing Modal */}
        <CreateListingModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleListingSuccess}
        />
      </>
    );
  }

  // If no listing and user is the owner
  if (isOwner) {
    return (
      <>
        <div className={cn(
          'border rounded-lg p-6',
          isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200',
          className
        )}>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-gray-400" />
            <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Marketplace
            </h3>
          </div>

          <div className="text-center space-y-4">
            <div>
              <div className={cn('text-sm mb-3', isDark ? 'text-gray-400' : 'text-gray-600')}>
                This Evermark is not currently listed for sale.
              </div>
              
              {isConnected ? (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full flex items-center justify-center gap-2 bg-cyber-primary text-black py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors font-medium"
                >
                  <Tag className="h-4 w-4" />
                  List for Sale
                </button>
              ) : (
                <div className="space-y-2">
                  <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Connect your wallet to list this Evermark for sale
                  </p>
                </div>
              )}
            </div>

            <div className={cn(
              'text-xs border-t pt-3',
              isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-600'
            )}>
              <div>• 1% marketplace fee</div>
              <div>• Revenue funds leaderboard rewards</div>
              <div>• Cancel anytime</div>
            </div>
          </div>
        </div>

        {/* Create Listing Modal */}
        <CreateListingModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleListingSuccess}
        />
      </>
    );
  }

  // If no listing and user is not the owner
  return (
    <div className={cn(
      'border rounded-lg p-6',
      isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200',
      className
    )}>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-gray-400" />
        <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          Marketplace
        </h3>
      </div>

      <div className="text-center">
        <div className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
          This Evermark is not currently for sale.
        </div>
        <div className={cn(
          'text-xs mt-3 pt-3 border-t',
          isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-600'
        )}>
          Check back later or browse other listings in the marketplace.
        </div>
      </div>
    </div>
  );
}