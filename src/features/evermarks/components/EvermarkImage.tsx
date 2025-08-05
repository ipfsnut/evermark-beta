import React from 'react';
import { 
  useImageLoader,
  EvermarkImage as SDKEvermarkImage,
  type UseImageLoaderOptions,
  type UseImageLoaderResult
} from 'evermark-sdk/react';

import { 
  resolveImageSources,
  type ImageSourceInput 
} from 'evermark-sdk/core';

import { 
  getDefaultImageLoaderOptions,
  getDebugImageLoaderOptions 
} from '../config/sdk-config';

import type { Evermark } from '../types';

// ADDED: Define ImageTransferStatus since it's missing from SDK exports
export interface ImageTransferStatus {
  phase: 'idle' | 'transferring' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

interface EvermarkImageProps {
  evermark: Evermark;
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  className?: string;
  alt?: string;
  enableAutoTransfer?: boolean;
  debug?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
  onTransferProgress?: (status: ImageTransferStatus) => void;
}

export function EvermarkImage({
  evermark,
  variant = 'standard',
  className = '',
  alt,
  enableAutoTransfer = true,
  debug = false,
  onLoad,
  onError,
  onTransferProgress
}: EvermarkImageProps) {
  
  // Convert evermark to ImageSourceInput
  const sources: ImageSourceInput = {
    supabaseUrl: evermark.supabaseImageUrl,
    thumbnailUrl: evermark.thumbnailUrl,
    processedUrl: evermark.processed_image_url,
    ipfsHash: evermark.ipfsHash,
    preferThumbnail: variant === 'compact' || variant === 'list'
  };

  // Get loader options based on variant and debug mode
  const baseOptions = debug ? getDebugImageLoaderOptions() : getDefaultImageLoaderOptions();
  
  const options: UseImageLoaderOptions = {
    ...baseOptions,
    autoLoad: true,
    debug: debug || import.meta.env.DEV,
    resolution: {
      ...baseOptions.resolution,
      preferThumbnail: variant === 'compact' || variant === 'list',
      maxSources: variant === 'list' ? 2 : 3,
      includeIpfs: enableAutoTransfer
    }
    // REMOVED: onLoad and onError - these don't exist in UseImageLoaderOptions
  };

  // Use the SDK hook
  const { 
    imageUrl, 
    isLoading, 
    hasError, 
    attempts, 
    currentSource,
    load 
  } = useImageLoader(sources, options);

  // Handle callbacks through useEffect since they're not part of options
  React.useEffect(() => {
    if (imageUrl && onLoad) {
      onLoad();
    }
  }, [imageUrl, onLoad]);

  React.useEffect(() => {
    if (hasError && onError) {
      onError('Image failed to load');
    }
  }, [hasError, onError]);

  // Handle transfer progress reporting
  React.useEffect(() => {
    if (onTransferProgress) {
      if (isLoading && currentSource) {
        onTransferProgress({
          phase: 'transferring',
          progress: Math.min(attempts.length * 25, 75),
          message: `Loading from ${currentSource}...`
        });
      } else if (imageUrl) {
        onTransferProgress({
          phase: 'completed',
          progress: 100,
          message: 'Image loaded successfully'
        });
      } else if (hasError) {
        onTransferProgress({
          phase: 'failed',
          progress: 0,
          message: 'Failed to load image',
          error: 'All image sources failed'
        });
      }
    }
  }, [isLoading, imageUrl, hasError, currentSource, attempts.length, onTransferProgress]);

  // Generate appropriate CSS classes based on variant
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
    const baseClasses = 'bg-gray-800 flex items-center justify-center';
    
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

  // Render loading state
  if (isLoading) {
    return (
      <div className={`${getPlaceholderClasses()} ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyber-primary"></div>
      </div>
    );
  }

  // Render error state with retry option
  if (hasError || !imageUrl) {
    return (
      <div className={`${getPlaceholderClasses()} ${className} border-2 border-dashed border-gray-600`}>
        <div className="text-center p-4">
          <div className="text-gray-400 mb-2">
            {variant === 'compact' || variant === 'list' ? '📷' : '🖼️'}
          </div>
          {variant !== 'compact' && variant !== 'list' && (
            <>
              <p className="text-xs text-gray-500 mb-2">Image failed to load</p>
              <button
                onClick={() => load()}
                className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render successful image
  return (
    <img
      src={imageUrl}
      alt={alt || evermark.title || 'Evermark image'}
      className={`${getImageClasses()} ${className}`}
      onLoad={onLoad}
      onError={() => onError?.('Image failed to load')}
      loading="lazy"
    />
  );
}

