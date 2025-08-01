import { createDefaultStorageConfig, type StorageConfig } from '@ipfsnut/evermark-sdk-core';
import { StorageOrchestrator } from '@ipfsnut/evermark-sdk-storage';
import { ImageLoader, type ImageLoaderOptions } from '@ipfsnut/evermark-sdk-browser';
import type { UseImageLoaderOptions } from '@ipfsnut/evermark-sdk-react';

// FIXED: Use correct StorageConfig type from your SDK
export function createEvermarkStorageConfig(): StorageConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  }

  // Use your SDK's createDefaultStorageConfig
  return createDefaultStorageConfig(supabaseUrl, supabaseKey, 'evermark-images');
}

// Singleton instances
let storageConfigInstance: StorageConfig | null = null;
let storageOrchestratorInstance: StorageOrchestrator | null = null;
let imageLoaderInstance: ImageLoader | null = null;

export function getEvermarkStorageConfig(): StorageConfig {
  if (!storageConfigInstance) {
    storageConfigInstance = createEvermarkStorageConfig();
  }
  return storageConfigInstance;
}

export function getEvermarkStorageOrchestrator(): StorageOrchestrator {
  if (!storageOrchestratorInstance) {
    storageOrchestratorInstance = new StorageOrchestrator(getEvermarkStorageConfig());
  }
  return storageOrchestratorInstance;
}

export function getEvermarkImageLoader(options?: ImageLoaderOptions): ImageLoader {
  if (!imageLoaderInstance) {
    imageLoaderInstance = new ImageLoader({
      debug: process.env.NODE_ENV === 'development',
      timeout: 8000,
      maxRetries: 2,
      useCORS: true,
      ...options
    });
  }
  return imageLoaderInstance;
}

// Default React hook options for your evermarks
export function getDefaultImageLoaderOptions(): UseImageLoaderOptions {
  return {
    autoLoad: true,
    debug: process.env.NODE_ENV === 'development',
    timeout: 8000,
    maxRetries: 2,
    useCORS: true,
    resolution: {
      maxSources: 3,
      defaultTimeout: 8000,
      includeIpfs: true,
      ipfsGateway: 'https://gateway.pinata.cloud/ipfs',
      mobileOptimization: false
    },
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    }
  };
}

// Enhanced configuration for specific use cases
export function getMobileImageLoaderOptions(): UseImageLoaderOptions {
  return {
    ...getDefaultImageLoaderOptions(),
    resolution: {
      maxSources: 2,
      defaultTimeout: 5000,
      includeIpfs: false,
      preferThumbnail: true,
      mobileOptimization: true
    }
  };
}

export function getHighQualityImageLoaderOptions(): UseImageLoaderOptions {
  return {
    ...getDefaultImageLoaderOptions(),
    timeout: 15000,
    resolution: {
      maxSources: 5,
      defaultTimeout: 15000,
      includeIpfs: true,
      preferThumbnail: false,
      mobileOptimization: false
    }
  };
}