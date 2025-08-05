import { 
  createDefaultStorageConfig,
  type StorageConfig 
} from 'evermark-sdk/core';
import { supabase } from '../../../lib/supabase';

import {
  CacheManager,
  PerformanceMonitor,
  CORSHandler,
  ImageLoader,
  type CacheConfig,
  type LoadMetrics
} from 'evermark-sdk/browser';

export const performanceMonitor = new PerformanceMonitor();

export const cacheManager = new CacheManager({
  maxSize: 50 * 1024 * 1024,
  maxEntries: 100,
  ttl: 24 * 60 * 60 * 1000,
  persistent: true
});

export const corsHandler = new CORSHandler({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  allowedOrigins: ['*'],
  customHeaders: {
    'Cache-Control': 'public, max-age=3600'
  }
});

export function createEvermarkStorageConfig(): StorageConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  }

  return {
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseKey,
      client: supabase, // Should work now!
      bucketName: 'evermark-images'
    },
    ipfs: {
      gateway: 'https://gateway.pinata.cloud/ipfs',
      fallbackGateways: [
        'https://ipfs.io/ipfs',
        'https://cloudflare-ipfs.com/ipfs'
      ],
      timeout: 10000
    },
    upload: {
      maxFileSize: 10 * 1024 * 1024,
      allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      generateThumbnails: true,
      thumbnailSize: { width: 400, height: 400 }
    }
  };
}

export function getEvermarkStorageConfig(): StorageConfig {
  return createEvermarkStorageConfig();
}

export function getDefaultImageLoaderOptions() {
  return {
    autoLoad: true,
    debug: import.meta.env.DEV,
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
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      client: supabase
    },
    onLoad: (metrics: LoadMetrics) => {
      performanceMonitor.recordLoad(metrics);
      if (import.meta.env.DEV) {
        console.log('📊 Image Load Metrics:', metrics);
      }
    },
    onError: (error: string, source: string) => {
      console.warn(`❌ Image load failed from ${source}:`, error);
    }
  };
}

export function getMobileImageLoaderOptions() {
  return {
    autoLoad: true,
    debug: import.meta.env.DEV,
    timeout: 5000,
    maxRetries: 1,
    useCORS: true,
    resolution: {
      maxSources: 2,
      defaultTimeout: 5000,
      includeIpfs: false,
      preferThumbnail: true,
      mobileOptimization: true
    },
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      client: supabase
    },
    onLoad: (metrics: LoadMetrics) => {
      performanceMonitor.recordLoad(metrics);
      if (import.meta.env.DEV) {
        console.log('📱 Mobile Image Load:', metrics);
      }
    },
    onError: (error: string, source: string) => {
      if (import.meta.env.DEV) {
        console.warn(`📱 Mobile load failed from ${source}:`, error);
      }
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
    debug: import.meta.env.DEV,
    supabaseClient: supabase,
    onProgress: (progress: any) => {
      if (import.meta.env.DEV) {
        console.log(`📤 Upload progress: ${progress.percentage}%`);
      }
    }
  };
}