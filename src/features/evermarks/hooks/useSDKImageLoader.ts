// src/features/evermarks/hooks/useSDKImageLoader.ts
// Custom hook that wraps the SDK React hook with your specific needs

import { useImageLoader, type UseImageLoaderOptions, type UseImageLoaderResult } from '@ipfsnut/evermark-sdk-react';
import { getDefaultImageLoaderOptions, getMobileImageLoaderOptions } from '../config/sdk-config';
import type { Evermark } from '../types';
import type { ImageSourceInput } from '@ipfsnut/evermark-sdk-core';

interface UseSDKImageLoaderOptions {
  evermark: Evermark;
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  autoLoad?: boolean;
  enableAutoTransfer?: boolean;
  debug?: boolean;
  onProgress?: (progress: { phase: string; percentage: number }) => void;
}

interface UseSDKImageLoaderResult extends UseImageLoaderResult {
  // Additional methods specific to evermarks
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
  
  // Convert evermark to ImageSourceInput
  const sources: ImageSourceInput = {
    supabaseUrl: evermark.supabaseImageUrl,
    thumbnailUrl: evermark.thumbnailUrl,
    processedUrl: evermark.processed_image_url,
    ipfsHash: evermark.ipfsHash,
    preferThumbnail: variant === 'compact' || variant === 'list'
  };

  // Get appropriate options based on variant
  const baseOptions = variant === 'compact' || variant === 'list' 
    ? getMobileImageLoaderOptions() 
    : getDefaultImageLoaderOptions();

  // Customize options
  const options: UseImageLoaderOptions = {
    ...baseOptions,
    autoLoad,
    debug: debug || process.env.NODE_ENV === 'development',
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
      { type: 'supabase', url: evermark.supabaseImageUrl, available: !!evermark.supabaseImageUrl },
      { type: 'thumbnail', url: evermark.thumbnailUrl, available: !!evermark.thumbnailUrl },
      { type: 'processed', url: evermark.processed_image_url, available: !!evermark.processed_image_url },
      { type: 'ipfs', url: evermark.ipfsHash ? `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}` : undefined, available: !!evermark.ipfsHash }
    ].filter(source => source.available),
    attempts: result.attempts,
    timing: {
      loadTime: result.loadTime,
      fromCache: result.fromCache
    }
  });

  // Log progress if handler provided
  if (onProgress && result.isLoading) {
    const phase = result.currentSource ? `Loading from ${result.currentSource}` : 'Preparing';
    const percentage = result.attempts.length * 25; // Rough progress estimate
    onProgress({ phase, percentage });
  }

  return {
    ...result,
    reload,
    getDebugInfo
  };
}