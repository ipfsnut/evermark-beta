// Simplified EvermarkImage component using new image resolution system
// 
// ⚠️  DEPRECATED: Use UnifiedEvermarkImage instead for better README book support
// This component has been kept for compatibility but UnifiedEvermarkImage provides
// better aspect ratio handling, especially for README books and other book covers.
//
import React from 'react';
import { useImageResolver } from '../../hooks/useImageResolver';
import { cn } from '../../utils/responsive';

interface SimpleEvermarkImageProps {
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
}

export function SimpleEvermarkImage({
  tokenId,
  ipfsHash,
  originalUrl,
  alt,
  className = '',
  variant = 'standard',
  contentType,
  autoGenerate = true,
  onLoad,
  onError
}: SimpleEvermarkImageProps) {
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

  // Notify parent of load/error states
  React.useEffect(() => {
    if (imageUrl && onLoad) onLoad();
  }, [imageUrl, onLoad]);

  React.useEffect(() => {
    if (error && onError) onError(error);
  }, [error, onError]);

  // Get variant-specific classes with book cover optimization
  const getImageClasses = () => {
    // For book covers (README/ISBN), use object-contain to preserve aspect ratio
    const isBookCover = contentType === 'README' || contentType === 'ISBN';
    const objectFit = isBookCover ? 'object-contain' : 'object-cover';
    const baseClasses = `${objectFit} transition-opacity duration-200`;
    
    // Debug logging
    if (isBookCover && process.env.NODE_ENV === 'development') {
      console.log(`🔍 SimpleEvermarkImage - Book cover detected for token ${tokenId}:`, {
        contentType,
        isBookCover,
        objectFit,
        variant
      });
    }
    
    switch (variant) {
      case 'hero':
        return isBookCover 
          ? `${baseClasses} w-full h-80 md:h-96 rounded-xl bg-gradient-to-br from-amber-900/10 to-gray-800/20`
          : `${baseClasses} w-full h-64 md:h-96 rounded-xl`;
      case 'compact':
        return isBookCover 
          ? `${baseClasses} w-16 h-20 rounded-lg bg-gray-800/30`
          : `${baseClasses} w-16 h-16 rounded-lg`;
      case 'list':
        return isBookCover 
          ? `${baseClasses} w-12 h-16 rounded-md bg-gray-800/30`
          : `${baseClasses} w-12 h-12 rounded-md`;
      case 'standard':
      default:
        return isBookCover 
          ? `${baseClasses} w-full h-60 rounded-lg bg-gradient-to-br from-amber-900/10 to-gray-800/20`
          : `${baseClasses} w-full h-48 rounded-lg`;
    }
  };

  const getPlaceholderClasses = () => {
    const isBookCover = contentType === 'README' || contentType === 'ISBN';
    const baseClasses = 'bg-gray-800 flex items-center justify-center animate-pulse';
    
    switch (variant) {
      case 'hero':
        return isBookCover 
          ? `${baseClasses} w-full h-80 md:h-96 rounded-xl`
          : `${baseClasses} w-full h-64 md:h-96 rounded-xl`;
      case 'compact':
        return isBookCover 
          ? `${baseClasses} w-16 h-20 rounded-lg`
          : `${baseClasses} w-16 h-16 rounded-lg`;
      case 'list':
        return isBookCover 
          ? `${baseClasses} w-12 h-16 rounded-md`
          : `${baseClasses} w-12 h-12 rounded-md`;
      case 'standard':
      default:
        return isBookCover 
          ? `${baseClasses} w-full h-60 rounded-lg`
          : `${baseClasses} w-full h-48 rounded-lg`;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(getPlaceholderClasses(), className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyber-primary"></div>
      </div>
    );
  }

  // Error state
  if (error || !imageUrl) {
    return (
      <div className={cn(getPlaceholderClasses(), 'border-2 border-dashed border-gray-600', className)}>
        <div className="text-center p-4">
          <div className="text-gray-400 mb-2">
            {variant === 'compact' || variant === 'list' ? '📷' : '🖼️'}
          </div>
          {variant !== 'compact' && variant !== 'list' && (
            <p className="text-xs text-gray-500">Failed to load image</p>
          )}
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="relative">
      <img
        src={imageUrl}
        alt={alt || `Evermark #${tokenId}`}
        className={cn(getImageClasses(), className)}
        loading="lazy"
      />
      
    </div>
  );
}