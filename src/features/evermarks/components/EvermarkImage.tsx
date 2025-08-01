import React from 'react';
import { ImageDisplay, type ImageDisplayProps } from '@ipfsnut/evermark-sdk-react';
import { getEvermarkStorageConfig, getDefaultImageLoaderOptions, getMobileImageLoaderOptions } from '../config/sdk-config';
import type { ImageSourceInput } from '@ipfsnut/evermark-sdk-core';

interface EvermarkImageProps {
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
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  showPlaceholder?: boolean;
  enableAutoTransfer?: boolean;
  showTransferStatus?: boolean;
  showDebugInfo?: boolean;
  className?: string;
  onImageLoad?: () => void;
  onImageError?: (error: string) => void;
  onTransferComplete?: (result: { supabaseUrl: string }) => void;
}

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
  // Convert evermark data to ImageSourceInput for SDK
  const sources: ImageSourceInput = React.useMemo(() => {
    const sourceInput: ImageSourceInput = {};
    
    // Add sources in priority order
    if (evermark.supabaseImageUrl) {
      sourceInput.supabaseUrl = evermark.supabaseImageUrl;
    }
    if (evermark.thumbnailUrl) {
      sourceInput.thumbnailUrl = evermark.thumbnailUrl;
    }
    if (evermark.processed_image_url) {
      sourceInput.processedUrl = evermark.processed_image_url;
    }
    if (evermark.ipfsHash) {
      sourceInput.ipfsHash = evermark.ipfsHash;
    }
    
    // Set preference based on variant
    sourceInput.preferThumbnail = variant === 'compact' || variant === 'list';
    
    return sourceInput;
  }, [evermark, variant]);

  // Get appropriate loader options based on variant
  const loaderOptions = React.useMemo(() => {
    if (variant === 'compact' || variant === 'list') {
      return getMobileImageLoaderOptions();
    }
    return getDefaultImageLoaderOptions();
  }, [variant]);

  // Content type styling
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

  // Enhanced placeholder with content type styling
  const enhancedLoadingPlaceholder = showPlaceholder ? (
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
      
      {/* Loading indicator */}
      <div className="absolute bottom-3 right-3">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>
    </div>
  ) : undefined;

  // Enhanced error placeholder
  const enhancedErrorPlaceholder = (
    <div className={`absolute inset-0 bg-gradient-to-br ${contentStyle.gradient} flex flex-col items-center justify-center`}>
      <div className="text-center">
        <div className="text-2xl mb-2">⚠️</div>
        <div className="text-white/80 text-xs font-medium">#{evermark.tokenId}</div>
        <div className="text-white/60 text-xs mt-1">Failed to load</div>
        
        {enableAutoTransfer && showTransferStatus && (
          <div className="mt-2 text-xs text-white/70">
            Checking IPFS backup...
          </div>
        )}
      </div>
    </div>
  );

  // Resolution config based on variant
  const resolutionConfig = React.useMemo(() => ({
    preferThumbnail: variant === 'compact' || variant === 'list',
    maxSources: variant === 'list' ? 2 : 3,
    includeIpfs: enableAutoTransfer,
    mobileOptimization: variant === 'compact' || variant === 'list'
  }), [variant, enableAutoTransfer]);

  return (
    <div className={`evermark-image-wrapper relative ${className}`}>
      <ImageDisplay
        sources={sources}
        alt={evermark.title}
        resolution={resolutionConfig}
        loaderOptions={loaderOptions}
        loadingPlaceholder={enhancedLoadingPlaceholder}
        errorPlaceholder={enhancedErrorPlaceholder}
        onLoad={onImageLoad ? ((url: string, fromCache: boolean) => {
          console.log(`[EvermarkImage] Loaded: ${url} (cached: ${fromCache})`);
          onImageLoad();
        }) : undefined}
        onError={onImageError}
        showDebugInfo={showDebugInfo}
        className="w-full h-full object-cover"
      />
      
      {/* Status indicators */}
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

      {/* Token ID badge */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">
        #{evermark.tokenId}
      </div>
      
      {/* Debug info overlay */}
      {showDebugInfo && (
        <div className="absolute top-2 left-2 bg-black/90 text-white text-xs p-2 rounded max-w-xs backdrop-blur-sm">
          <div>Sources: {Object.keys(sources).length}</div>
          <div>Variant: {variant}</div>
          <div>Status: {evermark.imageStatus}</div>
          {evermark.supabaseImageUrl && <div>✅ Supabase</div>}
          {evermark.ipfsHash && <div>🌐 IPFS</div>}
          {evermark.thumbnailUrl && <div>🖼️ Thumbnail</div>}
        </div>
      )}
    </div>
  );
};