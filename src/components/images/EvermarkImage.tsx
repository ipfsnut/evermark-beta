import React from 'react';
import { ResponsiveEvermarkImage } from './ResponsiveEvermarkImage';
import { UnifiedEvermarkImage } from './UnifiedEvermarkImage';

interface EvermarkImageProps {
  tokenId: number;
  ipfsHash?: string;
  originalUrl?: string;
  alt?: string;
  className?: string;
  variant?: 'responsive' | 'simple' | 'thumbnail';
  contentType?: string; // For auto-generation logic
  autoGenerate?: boolean; // Enable auto-generation
  maintainContainer?: boolean;
  detectAspectRatio?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

/**
 * Unified EvermarkImage component - single entry point for all evermark images
 * Automatically chooses the best image component and resolution strategy
 */
export function EvermarkImage({
  tokenId,
  ipfsHash,
  originalUrl,
  alt,
  className,
  variant = 'responsive',
  contentType,
  autoGenerate = true,
  maintainContainer = true,
  detectAspectRatio = true,
  onLoad,
  onError
}: EvermarkImageProps) {
  
  // For thumbnails and simple cases, use UnifiedEvermarkImage with appropriate variants
  if (variant === 'simple' || variant === 'thumbnail') {
    return (
      <UnifiedEvermarkImage
        tokenId={tokenId}
        ipfsHash={ipfsHash}
        originalUrl={originalUrl}
        alt={alt}
        className={className}
        variant={variant === 'thumbnail' ? 'thumbnail' : 'compact'}
        contentType={contentType}
        autoGenerate={autoGenerate}
        onLoad={onLoad}
        onError={onError}
      />
    );
  }

  // For responsive layouts, use ResponsiveEvermarkImage
  return (
    <ResponsiveEvermarkImage
      tokenId={tokenId}
      ipfsHash={ipfsHash}
      originalUrl={originalUrl}
      alt={alt}
      className={className}
      variant="standard"
      contentType={contentType}
      autoGenerate={autoGenerate}
      maintainContainer={maintainContainer}
      detectAspectRatio={detectAspectRatio}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

// Export the unified component as default and named
export default EvermarkImage;

// Re-export the specific components for cases where they're needed directly
export { ResponsiveEvermarkImage, UnifiedEvermarkImage };