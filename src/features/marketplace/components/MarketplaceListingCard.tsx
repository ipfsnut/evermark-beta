import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, User, Calendar, ExternalLink } from 'lucide-react';
import { EvermarkCard } from '../../evermarks/components/EvermarkCard';
import { UnifiedEvermarkImage } from '../../../components/images/UnifiedEvermarkImage';
import { formatCurrencySymbol } from '../services/MarketplaceService';
import { useWalletAddress } from '../../../hooks/core/useWalletAccount';
import { cn } from '../../../utils/responsive';
import { useTheme } from '../../../providers/ThemeProvider';
import type { MarketplaceListing } from '../types';
import type { Evermark } from '../../evermarks/types';

interface MarketplaceListingCardProps {
  listing: MarketplaceListing;
  onBuy?: (listingId: string) => void;
  onCancel?: (listingId: string) => void;
  isLoading?: boolean;
  variant?: 'standard' | 'compact';
  className?: string;
}

export function MarketplaceListingCard({
  listing,
  onBuy,
  onCancel,
  isLoading = false,
  variant = 'standard',
  className = ''
}: MarketplaceListingCardProps) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const walletAddress = useWalletAddress();
  const [evermark, setEvermark] = useState<Evermark | null>(null);
  const [isLoadingEvermark, setIsLoadingEvermark] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if current user is the seller
  const isOwnListing = walletAddress && listing.seller.toLowerCase() === walletAddress.toLowerCase();

  // Fetch evermark data for this token ID
  useEffect(() => {
    async function fetchEvermark() {
      try {
        setIsLoadingEvermark(true);
        setError(null);

        // Fetch from the evermarks API
        const response = await fetch(`/.netlify/functions/evermarks?id=${listing.tokenId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch evermark data');
        }

        const data = await response.json();
        
        if (data.evermark) {
          // Single evermark response format
          setEvermark(data.evermark);
        } else if (data.evermarks && data.evermarks.length > 0) {
          // Multiple evermarks response format (fallback)
          setEvermark(data.evermarks[0]);
        } else {
          throw new Error('Evermark not found');
        }
      } catch (err) {
        console.error('Error fetching evermark:', err);
        setError(err instanceof Error ? err.message : 'Failed to load evermark');
      } finally {
        setIsLoadingEvermark(false);
      }
    }

    fetchEvermark();
  }, [listing.tokenId]);

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBuy?.(listing.listingId);
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.(listing.listingId);
  };

  const handleCardClick = () => {
    if (evermark) {
      navigate(`/evermark/${listing.tokenId}`);
    }
  };

  // Format price display
  const priceDisplay = `${listing.price} ${formatCurrencySymbol(listing.currency)}`;

  // Loading state
  if (isLoadingEvermark) {
    return (
      <div className={cn(
        'border rounded-xl p-6 animate-pulse',
        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-300',
        className
      )}>
        <div className={cn(
          'w-full aspect-video rounded-lg mb-4',
          isDark ? 'bg-gray-700' : 'bg-gray-200'
        )} />
        <div className="space-y-3">
          <div className={cn(
            'h-6 rounded',
            isDark ? 'bg-gray-700' : 'bg-gray-200'
          )} />
          <div className={cn(
            'h-4 w-2/3 rounded',
            isDark ? 'bg-gray-700' : 'bg-gray-200'
          )} />
          <div className={cn(
            'h-8 w-24 rounded',
            isDark ? 'bg-gray-700' : 'bg-gray-200'
          )} />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !evermark) {
    return (
      <div className={cn(
        'border rounded-xl p-6',
        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-300',
        className
      )}>
        <div className="text-center">
          <div className="text-4xl mb-2">❌</div>
          <h3 className={cn(
            'font-semibold mb-2',
            isDark ? 'text-white' : 'text-gray-900'
          )}>
            Evermark #{listing.tokenId}
          </h3>
          <p className={cn(
            'text-sm mb-4',
            isDark ? 'text-gray-400' : 'text-gray-600'
          )}>
            {error || 'Unable to load evermark data'}
          </p>
          
          {/* Price and action buttons even without evermark data */}
          <div className="space-y-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-cyber-primary mb-1">
                {priceDisplay}
              </div>
              <div className={cn(
                'text-sm',
                isDark ? 'text-gray-400' : 'text-gray-600'
              )}>
                Listed by {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
              </div>
            </div>

            <div className="flex gap-2">
              {isOwnListing ? (
                <button
                  onClick={handleCancelClick}
                  disabled={isLoading}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Cancelling...' : 'Cancel Listing'}
                </button>
              ) : (
                <button
                  onClick={handleBuyClick}
                  disabled={isLoading}
                  className="flex-1 bg-cyber-primary text-black py-2 px-4 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? 'Purchasing...' : 'Buy Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main listing card with evermark data
  return (
    <div 
      className={cn(
        'border rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer backdrop-blur-sm hover:scale-[1.02]',
        isDark 
          ? 'bg-gray-800/50 border-gray-700 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20' 
          : 'bg-white border-gray-300 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/10',
        className
      )}
      onClick={handleCardClick}>
      {/* Evermark Image */}
      <div className="relative">
        <UnifiedEvermarkImage
          evermark={evermark}
          variant={variant === 'compact' ? 'compact' : 'standard'}
          className="rounded-t-xl"
        />
        
        {/* Marketplace Badge */}
        <div className="absolute top-3 left-3 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          🏪 For Sale
        </div>
        
        {/* Price Badge */}
        <div className="absolute top-3 right-3 bg-cyber-primary/90 text-black text-sm font-bold px-3 py-1 rounded backdrop-blur-sm">
          {priceDisplay}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className={cn(
          'text-lg font-semibold line-clamp-2 group-hover:text-purple-400 transition-colors',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          {evermark.title}
        </h3>

        {/* Author & Created Date */}
        <div className={cn(
          'flex items-center justify-between text-sm',
          isDark ? 'text-gray-400' : 'text-gray-600'
        )}>
          <div className="flex items-center min-w-0 flex-1">
            <User className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">{evermark.author}</span>
          </div>
          <div className="flex items-center flex-shrink-0 ml-2">
            <Calendar className="h-4 w-4 mr-1" />
            <span className="text-xs">#{listing.tokenId}</span>
          </div>
        </div>

        {/* Tags */}
        {evermark.tags && evermark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {evermark.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className={cn(
                  'text-xs px-2 py-1 rounded border',
                  isDark 
                    ? 'bg-purple-900/30 text-purple-300 border-purple-500/30' 
                    : 'bg-purple-100 text-purple-700 border-purple-300'
                )}
              >
                {tag}
              </span>
            ))}
            {evermark.tags.length > 3 && (
              <span className={cn(
                'text-xs',
                isDark ? 'text-gray-500' : 'text-gray-600'
              )}>
                +{evermark.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Seller Info */}
        <div className={cn(
          'text-sm border-t pt-3',
          isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
        )}>
          <div className="flex items-center justify-between">
            <span>
              Seller: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
            </span>
            {isOwnListing && (
              <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
                Your Listing
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {isOwnListing ? (
            <button
              onClick={handleCancelClick}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <X className="h-4 w-4" />
              {isLoading ? 'Cancelling...' : 'Cancel Listing'}
            </button>
          ) : (
            <>
              <button
                onClick={handleBuyClick}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-cyber-primary text-black py-2 px-4 rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <ShoppingCart className="h-4 w-4" />
                {isLoading ? 'Purchasing...' : 'Buy Now'}
              </button>
              
              {evermark.sourceUrl && (
                <a
                  href={evermark.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-md border transition-colors',
                    isDark 
                      ? 'border-gray-600 text-gray-400 hover:text-white hover:border-purple-400' 
                      : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-purple-400'
                  )}
                  title="View original source"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}