import React, { useState, useEffect, useCallback } from 'react';
import { 
  ImageDisplay, 
  ImageTransferStatus,
  useImageLoader 
} from '@ipfsnut/evermark-sdk-react';
import type { 
  ImageSourceInput, 
  StorageConfig 
} from '@ipfsnut/evermark-sdk-core';

import { getEvermarkStorageConfig, getDefaultImageLoaderOptions, getMobileImageLoaderOptions } from '../config/sdk-config';

interface EvermarkImageProps {
  /** Evermark data - same interface as your existing component */
  evermark: {
    id: string;
    tokenId: number;
    title: string;
    contentType: string;
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
    imageStatus?: 'processed' | 'processing' | 'failed' | 'none';
  };
  /** Display variant - same as your existing component */
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  /** Show placeholder when no image */
  showPlaceholder?: boolean;
  /** Enable automatic IPFS→Supabase transfer */
  enableAutoTransfer?: boolean;
  /** Show transfer status overlay */
  showTransferStatus?: boolean;
  /** Show debug information */
  showDebugInfo?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when image loads */
  onImageLoad?: () => void;
  /** Callback when image fails */
  onImageError?: (error: string) => void;
  /** Callback when transfer completes */
  onTransferComplete?: (result: { supabaseUrl: string }) => void;
}

/**
 * Enhanced version of your existing EvermarkImage component
 * Now powered by the SDK for better performance and reliability
 */
export const EvermarkImage: React.FC<EvermarkImageProps> = ({
  evermark,
  variant = 'standard',
  showPlaceholder = true,
  enableAutoTransfer = true,
  showTransferStatus = false,
  showDebugInfo = false,
  className = '',
  onImageLoad,
  onImageError,
  onTransferComplete
}) => {
  const [currentSupabaseUrl, setCurrentSupabaseUrl] = useState(evermark.supabaseImageUrl);
  const [transferInProgress, setTransferInProgress] = useState(false);

  // Convert evermark data to SDK ImageSourceInput format
  const sources: ImageSourceInput = {
    supabaseUrl: currentSupabaseUrl,
    thumbnailUrl: evermark.thumbnailUrl,
    processedUrl: evermark.processed_image_url,
    ipfsHash: evermark.ipfsHash,
    preferThumbnail: variant === 'compact' || variant === 'list'
  };

  // Get appropriate loader options based on variant
  const loaderOptions = variant === 'compact' || variant === 'list' ? 
    getMobileImageLoaderOptions() : 
    getDefaultImageLoaderOptions();

  // Use SDK image loader hook for enhanced functionality
  const {
    imageUrl,
    isLoading,
    hasError,
    error,
    fromCache,
    loadTime,
    retry,
    attempts
  } = useImageLoader(sources, loaderOptions);

  // Handle transfer completion
  const handleTransferComplete = useCallback((result: { supabaseUrl: string }) => {
    setCurrentSupabaseUrl(result.supabaseUrl);
    setTransferInProgress(false);
    onTransferComplete?.(result);
  }, [onTransferComplete]);

  // Trigger callbacks when image loads/fails
  useEffect(() => {
    if (imageUrl && onImageLoad) {
      onImageLoad();
    }
  }, [imageUrl, onImageLoad]);

  useEffect(() => {
    if (hasError && error && onImageError) {
      onImageError(error);
    }
  }, [hasError, error, onImageError]);

  // Variant-specific styles (keeping your existing styling approach)
  const getVariantStyles = () => {
    const baseStyles = 'relative overflow-hidden bg-gray-800 border border-gray-700 rounded-lg';
    
    switch (variant) {
      case 'hero':
        return `${baseStyles} h-64 sm:h-80`;
      case 'compact':
        return `${baseStyles} h-32 sm:h-40`;
      case 'list':
        return `${baseStyles} w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0`;
      default:
        return `${baseStyles} h-48 sm:h-56`;
    }
  };

  // Content type styling (keeping your existing approach)
  const getContentTypeStyle = (contentType: string) => {
    const styles = {
      'Cast': { gradient: 'from-purple-500 to-pink-500', icon: '💬' },
      'DOI': { gradient: 'from-blue-500 to-cyan-500', icon: '📄' },
      'ISBN': { gradient: 'from-green-500 to-teal-500', icon: '📚' },
      'URL': { gradient: 'from-orange-500 to-red-500', icon: '🌐' },
      'Custom': { gradient: 'from-gray-500 to-gray-700', icon: '✨' }
    };
    
    return styles[contentType as keyof typeof styles] || styles.Custom;
  };

  const contentStyle = getContentTypeStyle(evermark.contentType);

  // Enhanced placeholder (keeping your existing design but with SDK loading state)
  const placeholder = showPlaceholder ? (
    <div className={`absolute inset-0 bg-gradient-to-br ${contentStyle.gradient} flex flex-col items-center justify-center`}>
      <div className="text-center">
        <div className="text-4xl mb-2">{contentStyle.icon}</div>
        <div className="text-white/80 text-sm font-medium">#{evermark.tokenId}</div>
        {variant !== 'compact' && variant !== 'list' && (
          <div className="text-white/60 text-xs mt-1 px-2 max-w-[120px] truncate">
            {evermark.title}
          </div>
        )}
      </div>
      
      {/* Enhanced loading indicator */}
      {isLoading && (
        <div className="absolute bottom-3 right-3">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  ) : undefined;

  // Enhanced error placeholder with retry functionality
  const errorPlaceholder = (
    <div className={`absolute inset-0 bg-gradient-to-br ${contentStyle.gradient} flex flex-col items-center justify-center cursor-pointer`}>
      <div className="text-center" onClick={retry}>
        <div className="text-2xl mb-2">⚠️</div>
        <div className="text-white/80 text-xs font-medium">#{evermark.tokenId}</div>
        <div className="text-white/60 text-xs mt-1">Click to retry</div>
        
        {/* Show retry count if applicable */}
        {attempts.length > 1 && (
          <div className="text-white/40 text-xs mt-1">
            Tried {attempts.length} sources
          </div>
        )}
      </div>
    </div>
  );

  // Determine if transfer should be shown
  const shouldShowTransfer = enableAutoTransfer && 
    showTransferStatus &&
    !currentSupabaseUrl && 
    evermark.ipfsHash &&
    !transferInProgress;

  return (
    <div className={`evermark-image-wrapper ${getVariantStyles()} ${className} group cursor-pointer hover:scale-105 transition-transform`}>
      {/* SDK-powered image display */}
      <ImageDisplay
        sources={sources}
        alt={evermark.title}
        className="w-full h-full object-cover"
        loadingPlaceholder={placeholder}
        errorPlaceholder={errorPlaceholder}
        onLoad={onImageLoad ? ((url: string, fromCache: boolean) => {
          console.log(`SDK: Image loaded from ${fromCache ? 'cache' : 'network'}: ${url}`);
          onImageLoad();
        }) : undefined}
        onError={onImageError}
        showDebugInfo={showDebugInfo}
        resolution={{
          preferThumbnail: variant === 'compact' || variant === 'list',
          maxSources: 3,
          includeIpfs: enableAutoTransfer
        }}
        loaderOptions={loaderOptions}
      />

      {/* Transfer Status Overlay - Only shows when needed */}
      {shouldShowTransfer && (
        <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-2 rounded backdrop-blur-sm">
          <ImageTransferStatus
            ipfsHash={evermark.ipfsHash!}
            storageConfig={getEvermarkStorageConfig()}
            onTransferComplete={handleTransferComplete}
            onTransferError={onImageError}
            autoStart={enableAutoTransfer}
          />
        </div>
      )}

      {/* Status indicators (keeping your existing approach) */}
      {evermark.imageStatus === 'processing' && (
        <div className="absolute bottom-2 left-2 bg-black/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-blue-400">Processing</span>
          </div>
        </div>
      )}

      {evermark.imageStatus === 'failed' && !showDebugInfo && (
        <div className="absolute bottom-2 left-2 bg-red-900/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400">Failed</span>
          </div>
        </div>
      )}

      {/* Transfer Status Badge */}
      {transferInProgress && (
        <div className="absolute top-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>Transferring</span>
          </div>
        </div>
      )}

      {/* Performance indicator (from cache) */}
      {fromCache && showDebugInfo && (
        <div className="absolute top-2 left-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          ⚡ Cached
        </div>
      )}

      {/* Load time indicator */}
      {loadTime && showDebugInfo && (
        <div className="absolute top-8 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
          {loadTime}ms
        </div>
      )}

      {/* Token ID badge (keeping your existing approach) */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">
        #{evermark.tokenId}
      </div>
      
      {/* Debug info overlay */}
      {showDebugInfo && (
        <div className="absolute top-2 left-2 bg-black/90 text-white text-xs p-2 rounded max-w-xs backdrop-blur-sm">
          <div>Status: {evermark.imageStatus}</div>
          <div>Sources: {Object.keys(sources).filter(k => sources[k as keyof typeof sources]).length}</div>
          <div>Variant: {variant}</div>
          <div>Current: {imageUrl ? 'Loaded' : hasError ? 'Error' : 'Loading'}</div>
          {attempts.length > 0 && (
            <div>Attempts: {attempts.length}</div>
          )}
          {evermark.supabaseImageUrl && <div>✅ Supabase</div>}
          {evermark.ipfsHash && <div>🌐 IPFS</div>}
          {evermark.thumbnailUrl && <div>🖼️ Thumbnail</div>}
        </div>
      )}
    </div>
  );
};