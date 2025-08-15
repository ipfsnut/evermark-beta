// Simplified EvermarkImage component using new image resolution system
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
  onLoad,
  onError
}: SimpleEvermarkImageProps) {
  const { imageUrl, isLoading, error, source, isCached } = useImageResolver(
    tokenId,
    ipfsHash,
    originalUrl,
    {
      preferThumbnail: variant === 'compact' || variant === 'list',
      autoLoad: true
    }
  );

  // Notify parent of load/error states
  React.useEffect(() => {
    if (imageUrl && onLoad) onLoad();
  }, [imageUrl, onLoad]);

  React.useEffect(() => {
    if (error && onError) onError(error);
  }, [error, onError]);

  // Get variant-specific classes
  const getImageClasses = () => {
    const baseClasses = 'object-cover transition-opacity duration-200';
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} w-full h-64 md:h-96 rounded-xl`;
      case 'compact':
        return `${baseClasses} w-16 h-16 rounded-lg`;
      case 'list':
        return `${baseClasses} w-12 h-12 rounded-md`;
      case 'standard':
      default:
        return `${baseClasses} w-full h-48 rounded-lg`;
    }
  };

  const getPlaceholderClasses = () => {
    const baseClasses = 'bg-gray-800 flex items-center justify-center animate-pulse';
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} w-full h-64 md:h-96 rounded-xl`;
      case 'compact':
        return `${baseClasses} w-16 h-16 rounded-lg`;
      case 'list':
        return `${baseClasses} w-12 h-12 rounded-md`;
      case 'standard':
      default:
        return `${baseClasses} w-full h-48 rounded-lg`;
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
      
      {/* Cache indicator for development */}
      {import.meta.env.DEV && (
        <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
          {isCached ? '💾' : source === 'pinata' ? '🔗' : '🌐'}
        </div>
      )}
    </div>
  );
}