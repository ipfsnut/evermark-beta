import { 
  createDefaultStorageConfig,
  type StorageConfig 
} from '@ipfsnut/evermark-sdk-core';

/**
 * Create storage configuration from environment variables
 * This replaces the existing getEvermarkStorageConfig function
 */
export function createEvermarkStorageConfig(): StorageConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  }

  return createDefaultStorageConfig(supabaseUrl, supabaseKey, 'evermark-images');
}

/**
 * Enhanced version of your existing getEvermarkStorageConfig
 * Maintains the same interface for backward compatibility
 */
export function getEvermarkStorageConfig(): StorageConfig {
  return createEvermarkStorageConfig();
}

/**
 * Enhanced version of your existing image loader options
 * Now powered by the SDK with better defaults
 */
export function getDefaultImageLoaderOptions() {
  return {
    autoLoad: true,
    debug: import.meta.env.NODE_ENV === 'development',
    timeout: 8000,
    maxRetries: 2,
    useCORS: true,
    resolution: {
      maxSources: 3,
      defaultTimeout: 8000,
      includeIpfs: true,
      mobileOptimization: false
    },
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    }
  };
}

/**
 * Mobile-optimized options for compact/list views
 */
export function getMobileImageLoaderOptions() {
  return {
    ...getDefaultImageLoaderOptions(),
    timeout: 5000,
    maxRetries: 1,
    resolution: {
      maxSources: 2,
      defaultTimeout: 5000,
      includeIpfs: false,
      preferThumbnail: true,
      mobileOptimization: true
    }
  };
}

/**
 * Upload configuration for the SDK
 */
export function getUploadOptions() {
  return {
    generateThumbnails: true,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    debug: import.meta.env.NODE_ENV === 'development'
  };
}