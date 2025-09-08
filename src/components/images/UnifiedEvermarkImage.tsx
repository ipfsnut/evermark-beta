/**
 * Unified Evermark Image Component
 * 
 * The ONE and ONLY way to display evermark images.
 * Intelligently handles all aspect ratios with consistent container sizes.
 * 
 * DESIGN PRINCIPLE:
 * - All containers are the same size for visual consistency
 * - Smart padding automatically adjusts based on actual image dimensions
 * - Content detection provides hints but doesn't override aspect ratio logic
 * - Graceful fallbacks handle edge cases and loading states
 */

import React, { useState, useEffect, useRef } from 'react';
import { useImageResolver } from '../../hooks/useImageResolver';
import { cn } from '../../utils/responsive';
import type { Evermark } from '../../features/evermarks/types';

interface UnifiedEvermarkImageProps {
  // Core data - prefer passing full evermark object
  evermark?: Partial<Evermark>;
  
  // Fallback individual props (for compatibility)
  tokenId?: number;
  ipfsHash?: string;
  originalUrl?: string;
  contentType?: string;
  
  // Display options
  variant?: 'hero' | 'standard' | 'compact' | 'list' | 'thumbnail';
  alt?: string;
  className?: string;
  
  // Behavior
  autoGenerate?: boolean;
  enableHover?: boolean;
  
  // Events
  onLoad?: () => void;
  onError?: (error: string) => void;
  onClick?: () => void;
}

interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;   // < 0.95 (most books, some photos)
  isTall: boolean;       // < 0.6 (very tall books, screenshots)
  isSquare: boolean;     // 0.95 - 1.05 (profile pics, some logos) 
  isWide: boolean;       // > 1.05 (landscapes, banners)
  isSuperWide: boolean;  // > 2.0 (very wide banners, panoramas)
}

type PaddingStrategy = 'none' | 'horizontal' | 'vertical' | 'all';

export function UnifiedEvermarkImage({
  evermark,
  tokenId: fallbackTokenId,
  ipfsHash: fallbackIpfsHash,
  originalUrl: fallbackOriginalUrl,
  contentType: fallbackContentType,
  variant = 'standard',
  alt,
  className = '',
  autoGenerate = true,
  enableHover = true,
  onLoad,
  onError,
  onClick
}: UnifiedEvermarkImageProps) {
  
  // Extract data from evermark object or use fallbacks
  const tokenId = evermark?.tokenId ?? fallbackTokenId;
  const ipfsHash = evermark?.ipfsHash ?? fallbackIpfsHash;
  const originalUrl = evermark?.supabaseImageUrl ?? evermark?.image ?? fallbackOriginalUrl;
  const contentType = evermark?.contentType ?? fallbackContentType;
  
  // State for intelligent image handling
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [paddingStrategy, setPaddingStrategy] = useState<PaddingStrategy>('none');
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Use existing image resolution system
  const { imageUrl, isLoading, error, source } = useImageResolver(
    tokenId ?? 0,
    ipfsHash,
    originalUrl,
    {
      preferThumbnail: variant === 'compact' || variant === 'list' || variant === 'thumbnail',
      autoLoad: !!tokenId,
      contentType,
      autoGenerate
    }
  );

  // Handle image load and intelligently detect dimensions
  const handleImageLoad = () => {
    if (imgRef.current) {
      const img = imgRef.current;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = width / height;
      
      const dims: ImageDimensions = {
        width,
        height,
        aspectRatio,
        isPortrait: aspectRatio < 0.95,
        isTall: aspectRatio < 0.6,        // Very tall (books, long screenshots)
        isSquare: aspectRatio >= 0.95 && aspectRatio <= 1.05,
        isWide: aspectRatio > 1.05 && aspectRatio <= 2.0,
        isSuperWide: aspectRatio > 2.0    // Very wide (banners, panoramas)
      };
      
      // Determine optimal padding strategy based on aspect ratio and content type
      let strategy: PaddingStrategy = 'none';
      
      // Special handling for README books - they need different treatment
      if (isBookCover) {
        if (dims.isTall || dims.isPortrait) {
          strategy = 'horizontal'; // Book covers are typically tall, need horizontal padding
        } else if (dims.isWide || dims.isSuperWide) {
          strategy = 'vertical'; // Wide book covers (rare) need vertical padding
        }
        // Square book covers get minimal horizontal padding
        else if (dims.isSquare) {
          strategy = 'horizontal';
        }
      } else {
        // Standard content handling
        if (dims.isSuperWide) {
          strategy = 'vertical';  // Add top/bottom padding for very wide images
        } else if (dims.isTall) {
          strategy = 'horizontal'; // Add left/right padding for very tall images  
        } else if (dims.isWide) {
          strategy = 'vertical';  // Add top/bottom padding for wide images
        } else if (dims.isPortrait) {
          strategy = 'horizontal'; // Add left/right padding for portrait images
        }
        // Square images get no padding (strategy = 'none') for non-books
      }
      
      // Debug logging for README books and development
      if (import.meta.env.DEV && isBookCover) {
        console.log(`📚 README Book Image Analysis - Token #${tokenId}:`, {
          imageUrl: imageUrl?.substring(0, 80) + '...',
          dimensions: dims,
          actualSize: `${dims.width}x${dims.height}`,
          aspectRatio: dims.aspectRatio.toFixed(3),
          classification: {
            isPortrait: dims.isPortrait,
            isTall: dims.isTall,
            isSquare: dims.isSquare,
            isWide: dims.isWide,
            isSuperWide: dims.isSuperWide
          },
          paddingStrategy: strategy,
          contentType: contentType,
          isBookCover: isBookCover
        });
      }
      
      setDimensions(dims);
      setPaddingStrategy(strategy);
    }
    
    setImageLoaded(true);
    onLoad?.();
  };

  // Handle errors
  useEffect(() => {
    if (error && onError) onError(error);
  }, [error, onError]);

  // Get consistent container classes - same size regardless of content
  const getContainerClasses = () => {
    const baseClasses = 'relative overflow-hidden flex items-center justify-center transition-all duration-300';
    
    // CONSISTENT sizing - all containers are the same size for visual uniformity
    const sizeClasses = (() => {
      switch (variant) {
        case 'hero':
          return 'w-full h-64 md:h-80'; // Consistent hero size
            
        case 'standard':
          return 'w-full h-48'; // Consistent standard size
            
        case 'compact':
          return 'w-16 h-16'; // Consistent compact size
            
        case 'list':
          return 'w-12 h-12'; // Consistent list size
            
        case 'thumbnail':
          return 'w-8 h-8'; // Consistent thumbnail size
          
        default:
          return 'w-full h-48';
      }
    })();
    
    // Smart padding - apply to README books which need extra spacing
    const paddingClasses = (() => {
      // Only add padding if image is loaded and we have a strategy
      if (!imageLoaded || paddingStrategy === 'none') return '';
      
      const paddingAmounts = {
        hero: { horizontal: 'px-4 sm:px-6 md:px-8', vertical: 'py-3 sm:py-4 md:py-6' },
        standard: { horizontal: 'px-3 sm:px-4', vertical: 'py-2 sm:py-3' },
        compact: { horizontal: 'px-1', vertical: 'py-1' },
        list: { horizontal: 'px-1', vertical: 'py-0.5' },
        thumbnail: { horizontal: 'px-0.5', vertical: 'py-0.5' }
      };
      
      const amounts = paddingAmounts[variant] || paddingAmounts.standard;
      
      // Apply padding based on strategy
      if (paddingStrategy === 'horizontal') {
        return amounts.horizontal;
      } else if (paddingStrategy === 'vertical') {
        return amounts.vertical;
      }
      
      return '';
    })();
    
    // Subtle background that works for all content types
    const backgroundClasses = 'bg-gray-800/20';
    
    // Rounded corners
    const roundedClasses = (() => {
      switch (variant) {
        case 'hero': return 'rounded-xl';
        case 'standard': return 'rounded-lg';
        case 'compact': return 'rounded-lg';
        case 'list': return 'rounded-md';
        case 'thumbnail': return 'rounded-sm';
        default: return 'rounded-lg';
      }
    })();
    
    return cn(
      baseClasses,
      sizeClasses,
      paddingClasses,
      backgroundClasses,
      roundedClasses,
      enableHover && 'group cursor-pointer hover:scale-[1.02]',
      className
    );
  };

  // Helper functions for content detection
  const isBookCover = contentType === 'README' || contentType === 'ISBN';
  const showDebugInfo = import.meta.env.DEV && false; // Disabled per user request
  
  // Get image classes with intelligent object-fit based on aspect ratio detection
  const getImageClasses = () => {
    // Smart object-fit strategy based on content type and dimensions
    let objectFit = 'object-contain'; // Safe default that preserves aspect ratio
    
    // README books always use object-contain to show the full cover
    if (isBookCover) {
      objectFit = 'object-contain';
    }
    // For non-book content, use object-cover for square images in compact views
    else if (dimensions?.isSquare && (variant === 'compact' || variant === 'list' || variant === 'thumbnail')) {
      objectFit = 'object-cover';
    }
    // Keep object-contain for all other cases to prevent cropping
    
    return cn(
      'w-full h-full transition-opacity duration-300',
      objectFit,
      enableHover && 'group-hover:scale-105 transition-transform duration-300',
      imageLoaded ? 'opacity-100' : 'opacity-0'
    );
  };

  // Loading state
  if (isLoading || !tokenId) {
    return (
      <div className={getContainerClasses()}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Error state  
  if (error || !imageUrl) {
    return (
      <div className={cn(
        getContainerClasses(),
        'border-2 border-dashed border-gray-600'
      )}>
        <div className="text-center p-4">
          <div className="text-gray-400 mb-2 text-2xl">
            {isBookCover ? '📚' : '🖼️'}
          </div>
          {variant !== 'compact' && variant !== 'list' && variant !== 'thumbnail' && (
            <p className="text-xs text-gray-500">Image unavailable</p>
          )}
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div 
      className={getContainerClasses()}
      onClick={onClick}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt={alt ?? `Evermark #${tokenId}`}
        className={getImageClasses()}
        onLoad={handleImageLoad}
        loading="lazy"
      />
      
      {/* Loading overlay */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
        </div>
      )}
      
    </div>
  );
}

// Export as both named and default
export default UnifiedEvermarkImage;