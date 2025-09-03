// Responsive Evermark Image component with dynamic aspect ratio handling
// Especially optimized for book covers with varying dimensions
import React, { useState, useEffect, useRef } from 'react';
import { useImageResolver } from '../../hooks/useImageResolver';
import { cn } from '../../utils/responsive';

interface ResponsiveEvermarkImageProps {
  tokenId: number;
  ipfsHash?: string;
  originalUrl?: string;
  alt?: string;
  className?: string;
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  contentType?: string;
  autoGenerate?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
  // New props for aspect ratio handling
  maintainContainer?: boolean; // Keep container size constant
  detectAspectRatio?: boolean; // Auto-detect and adjust borders
}

interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isTall: boolean; // Book-like proportions
  isSquare: boolean;
  isWide: boolean;
}

export function ResponsiveEvermarkImage({
  tokenId,
  ipfsHash,
  originalUrl,
  alt,
  className = '',
  variant = 'standard',
  contentType,
  autoGenerate = true,
  onLoad,
  onError,
  maintainContainer = true,
  detectAspectRatio = true
}: ResponsiveEvermarkImageProps) {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const { imageUrl, isLoading, error, source, isCached } = useImageResolver(
    tokenId,
    ipfsHash,
    originalUrl,
    {
      preferThumbnail: variant === 'compact' || variant === 'list',
      autoLoad: true,
      contentType,
      autoGenerate
    }
  );

  // Detect image dimensions and aspect ratio
  const handleImageLoad = () => {
    if (imgRef.current && detectAspectRatio) {
      const img = imgRef.current;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = width / height;
      
      const dims: ImageDimensions = {
        width,
        height,
        aspectRatio,
        isPortrait: aspectRatio < 0.95,
        isTall: aspectRatio < 0.75, // Typical book proportion
        isSquare: aspectRatio >= 0.95 && aspectRatio <= 1.05,
        isWide: aspectRatio > 1.05
      };
      
      setDimensions(dims);
    }
    
    setImageLoaded(true);
    onLoad?.();
  };

  // Notify parent of error states
  useEffect(() => {
    if (error && onError) onError(error);
  }, [error, onError]);

  // Get container dimensions based on variant
  const getContainerDimensions = () => {
    switch (variant) {
      case 'hero':
        return { height: 'h-80 sm:h-96', width: 'w-full' };
      case 'compact':
        return { height: 'h-40', width: 'w-full' };
      case 'list':
        return { height: 'h-24 sm:h-32', width: 'w-24 sm:w-32' };
      case 'standard':
      default:
        return { height: 'h-56 sm:h-64', width: 'w-full' };
    }
  };

  // Calculate dynamic padding based on aspect ratio
  const getDynamicPadding = () => {
    if (!dimensions || !maintainContainer) return '';
    
    // For tall images (like book covers), add horizontal padding
    if (dimensions.isTall) {
      switch (variant) {
        case 'hero':
          return 'px-12 sm:px-20 md:px-32 lg:px-40';
        case 'standard':
          return 'px-8 sm:px-12 md:px-16';
        case 'compact':
          return 'px-4 sm:px-6';
        case 'list':
          return 'px-2';
        default:
          return 'px-8 sm:px-12';
      }
    }
    
    // For portrait images, add moderate padding
    if (dimensions.isPortrait) {
      switch (variant) {
        case 'hero':
          return 'px-6 sm:px-10 md:px-16';
        case 'standard':
          return 'px-4 sm:px-6';
        case 'compact':
          return 'px-2 sm:px-3';
        default:
          return 'px-4';
      }
    }
    
    // For wide images, add vertical padding
    if (dimensions.isWide) {
      switch (variant) {
        case 'hero':
          return 'py-8 sm:py-12';
        case 'standard':
          return 'py-4 sm:py-6';
        case 'compact':
          return 'py-2';
        default:
          return 'py-4';
      }
    }
    
    // Square images need minimal padding
    return 'p-2';
  };

  // Get background pattern for padding areas
  const getBackgroundPattern = () => {
    if (!dimensions || !maintainContainer) return '';
    
    // Add subtle gradient or pattern for book covers
    if (dimensions.isTall) {
      return 'bg-gradient-to-b from-gray-900/50 via-gray-800/30 to-gray-900/50';
    }
    
    return 'bg-gray-800/30';
  };

  // Get image fit mode based on aspect ratio
  const getObjectFit = () => {
    if (!dimensions || !maintainContainer) return 'object-cover';
    
    // For tall images (books), use contain to show full cover
    if (dimensions.isTall || dimensions.isPortrait) {
      return 'object-contain';
    }
    
    // For wide images, cover works better
    return 'object-cover';
  };

  const containerDims = getContainerDimensions();
  const dynamicPadding = getDynamicPadding();
  const backgroundPattern = getBackgroundPattern();
  const objectFit = getObjectFit();

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center animate-pulse bg-gray-800',
        containerDims.height,
        containerDims.width,
        className
      )}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Error state
  if (error || !imageUrl) {
    return (
      <div className={cn(
        'flex items-center justify-center border-2 border-dashed border-gray-600 bg-gray-800/50',
        containerDims.height,
        containerDims.width,
        className
      )}>
        <div className="text-center p-4">
          <div className="text-gray-400 mb-2 text-2xl">📚</div>
          {variant !== 'compact' && variant !== 'list' && (
            <p className="text-xs text-gray-500">Image unavailable</p>
          )}
        </div>
      </div>
    );
  }

  // Success state with responsive container
  return (
    <div 
      className={cn(
        'relative overflow-hidden flex items-center justify-center transition-all duration-300',
        containerDims.height,
        containerDims.width,
        backgroundPattern,
        dynamicPadding,
        className
      )}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt={alt || `Evermark #${tokenId}`}
        className={cn(
          'max-w-full max-h-full transition-opacity duration-300',
          objectFit,
          imageLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleImageLoad}
        loading="lazy"
      />
      
      {/* Loading overlay */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      )}
      
      
      {/* Visual indicator for book covers */}
      {dimensions?.isTall && variant !== 'list' && variant !== 'compact' && (
        <div className="absolute bottom-2 left-2 bg-purple-900/60 backdrop-blur-sm text-purple-200 text-xs px-2 py-1 rounded">
          📖 Book Cover
        </div>
      )}
    </div>
  );
}