import { 
  useImageLoader, 
  type UseImageLoaderOptions, 
  type UseImageLoaderResult 
} from 'evermark-sdk/react';

import { 
  getDefaultImageLoaderOptions, 
  getMobileImageLoaderOptions 
} from '../config/sdk-config';

import type { Evermark } from '../types';
import type { ImageSourceInput } from 'evermark-sdk/core';

interface UseSDKImageLoaderOptions {
  evermark: Evermark;
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  autoLoad?: boolean;
  enableAutoTransfer?: boolean;
  debug?: boolean;
  onProgress?: (progress: { phase: string; percentage: number }) => void;
}

interface UseSDKImageLoaderResult extends UseImageLoaderResult {
  reload: () => void;
  getDebugInfo: () => {
    sources: any[];
    attempts: any[];
    timing: {
      loadTime: number | null;
      fromCache: boolean;
    };
  };
}

export function useSDKImageLoader({
  evermark,
  variant = 'standard',
  autoLoad = true,
  enableAutoTransfer = true,
  debug = false,
  onProgress
}: UseSDKImageLoaderOptions): UseSDKImageLoaderResult {
  
  // Simplified source selection - use best available URL only
  const getBestImageUrl = () => {
    // For thumbnails, prefer thumbnailUrl
    if ((variant === 'compact' || variant === 'list') && evermark.thumbnailUrl) {
      return evermark.thumbnailUrl;
    }
    // Otherwise use supabase URL if available
    if (evermark.supabaseImageUrl) {
      return evermark.supabaseImageUrl;
    }
    // Fallback to processed URL if not from problematic gateway
    if (evermark.processed_image_url && !evermark.processed_image_url.includes('gateway.pinata.cloud')) {
      return evermark.processed_image_url;
    }
    // Last resort: use image field
    return evermark.image;
  };

  const sources: ImageSourceInput = {
    supabaseUrl: getBestImageUrl(),
    thumbnailUrl: undefined, // Don't provide multiple sources to avoid retries
    processedUrl: undefined, // Don't provide multiple sources to avoid retries
    ipfsHash: undefined, // Never use IPFS to avoid slow loads
    preferThumbnail: variant === 'compact' || variant === 'list'
  };

  // MOBILE-FIRST: Use mobile options for compact/list, default for others
  // The app is telling us it wants this optimization
  const baseOptions = variant === 'compact' || variant === 'list' 
    ? getMobileImageLoaderOptions() 
    : getDefaultImageLoaderOptions();

  // Customize options
  const options: UseImageLoaderOptions = {
    ...baseOptions,
    autoLoad,
    debug: debug || import.meta.env.DEV, // FIXED: Use import.meta.env
    resolution: {
      ...baseOptions.resolution,
      preferThumbnail: variant === 'compact' || variant === 'list',
      maxSources: variant === 'list' ? 2 : 3,
      includeIpfs: enableAutoTransfer
    }
  };

  // Use the SDK hook
  const result = useImageLoader(sources, options);

  // Enhanced reload function
  const reload = () => {
    console.log(`[useSDKImageLoader] Reloading image for evermark #${evermark.tokenId}`);
    result.load();
  };

  // Debug information getter
  const getDebugInfo = () => ({
    sources: [
      { type: 'supabase', url: evermark.supabaseImageUrl, available: !!evermark.supabaseImageUrl, priority: 1 },
      { type: 'thumbnail', url: evermark.thumbnailUrl, available: !!evermark.thumbnailUrl, priority: 1 },
      { 
        type: 'processed', 
        url: evermark.processed_image_url, 
        available: !!evermark.processed_image_url && !evermark.processed_image_url?.includes('gateway.pinata.cloud'),
        priority: 2,
        blocked: evermark.processed_image_url?.includes('gateway.pinata.cloud') 
      },
      { 
        type: 'ipfs', 
        url: evermark.ipfsHash ? `https://ipfs.io/ipfs/${evermark.ipfsHash}` : undefined, 
        available: !!evermark.ipfsHash && enableAutoTransfer,
        priority: 3,
        gateway: 'ipfs.io'
      }
    ].filter(source => source.available),
    attempts: result.attempts,
    timing: {
      loadTime: result.loadTime,
      fromCache: result.fromCache
    },
    config: {
      variant,
      enableAutoTransfer,
      preferThumbnail: variant === 'compact' || variant === 'list'
    }
  });

  // Removed progress handler to prevent re-render loops
  // Progress tracking should be handled at a higher level if needed

  return {
    ...result,
    reload,
    getDebugInfo
  };
}