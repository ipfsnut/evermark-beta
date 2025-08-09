import { 
  createDefaultStorageConfig,
  CacheManager,
  PerformanceMonitor, 
  CORSHandler,
  type StorageConfig,
  type CacheConfig,
  type LoadMetrics
} from 'evermark-sdk';

import { supabase } from '../../../lib/supabase';

// FIXED: Singleton instances with proper initialization
let performanceMonitorInstance: PerformanceMonitor | null = null;
let cacheManagerInstance: CacheManager | null = null;
let corsHandlerInstance: CORSHandler | null = null;
let storageConfigInstance: StorageConfig | null = null;

// Initialize with error handling
function initializeSDK() {
  try {
    // Initialize performance monitor
    if (!performanceMonitorInstance) {
      performanceMonitorInstance = new PerformanceMonitor();
    }

    // Initialize cache manager
    if (!cacheManagerInstance) {
      cacheManagerInstance = new CacheManager({
        maxSize: 50 * 1024 * 1024, // 50MB
        maxEntries: 100,
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        persistent: true
      });
    }

    // Initialize CORS handler
    if (!corsHandlerInstance) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        corsHandlerInstance = new CORSHandler({
          supabaseUrl,
          supabaseAnonKey: supabaseKey,
          allowedOrigins: ['*'],
          customHeaders: {
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }

    console.log('✅ SDK initialized successfully');
  } catch (error) {
    console.error('❌ SDK initialization failed:', error);
  }
}

// Initialize on first import
initializeSDK();

// Export instances with fallbacks
export const performanceMonitor = performanceMonitorInstance || new PerformanceMonitor();
export const cacheManager = cacheManagerInstance || new CacheManager({});
export const corsHandler = corsHandlerInstance || new CORSHandler({});

// FIXED: Storage config with proper error handling
export function createEvermarkStorageConfig(): StorageConfig {
  if (storageConfigInstance) {
    return storageConfigInstance;
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
    }

    // FIXED: Check if supabase client is available
    if (!supabase) {
      console.warn('⚠️ Supabase client not available, creating config without existing client');
    }

    const config = createDefaultStorageConfig(
      supabaseUrl,
      supabaseKey,
      'evermark-images',
      supabase // This might be undefined - SDK should handle it
    );

    storageConfigInstance = config;
    
    console.log('✅ Storage config created successfully');
    return config;

  } catch (error) {
    console.error('❌ Failed to create storage config:', error);
    
    // Return minimal fallback config
    return {
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
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
}

export function getEvermarkStorageConfig(): StorageConfig {
  return createEvermarkStorageConfig();
}

// FIXED: Image loader options with proper error handling
export function getDefaultImageLoaderOptions() {
  try {
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
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      },
      onLoad: (metrics: LoadMetrics) => {
        try {
          performanceMonitor.recordLoad(metrics);
          if (import.meta.env.DEV) {
            console.log('📊 Image Load Metrics:', metrics);
          }
        } catch (error) {
          console.warn('Failed to record load metrics:', error);
        }
      },
      onError: (error: string, source: string) => {
        console.warn(`❌ Image load failed from ${source}:`, error);
      }
    };
  } catch (error) {
    console.error('Failed to create image loader options:', error);
    // Return minimal config
    return {
      autoLoad: true,
      debug: false,
      timeout: 8000,
      maxRetries: 2
    };
  }
}

// Debug version
export function getDebugImageLoaderOptions() {
  const options = getDefaultImageLoaderOptions();
  return {
    ...options,
    debug: true,
    resolution: {
      ...options.resolution,
      maxSources: 5,
      defaultTimeout: 10000
    },
    onLoad: (metrics: LoadMetrics) => {
      console.log('🐛 DEBUG Image Load Metrics:', metrics);
      try {
        performanceMonitor.recordLoad(metrics);
      } catch (error) {
        console.warn('Failed to record debug metrics:', error);
      }
    },
    onError: (error: string, source: string) => {
      console.error(`🐛 DEBUG Image load failed from ${source}:`, error);
    }
  };
}

// Mobile optimized version
export function getMobileImageLoaderOptions() {
  const options = getDefaultImageLoaderOptions();
  return {
    ...options,
    timeout: 5000,
    maxRetries: 1,
    resolution: {
      maxSources: 2,
      defaultTimeout: 5000,
      includeIpfs: false,
      preferThumbnail: true,
      mobileOptimization: true
    },
    onLoad: (metrics: LoadMetrics) => {
      try {
        performanceMonitor.recordLoad(metrics);
        if (import.meta.env.DEV) {
          console.log('📱 Mobile Image Load:', metrics);
        }
      } catch (error) {
        console.warn('Failed to record mobile metrics:', error);
      }
    }
  };
}

// Upload options
export function getUploadOptions() {
  return {
    generateThumbnails: true,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    debug: import.meta.env.DEV,
    onProgress: (progress: any) => {
      if (import.meta.env.DEV) {
        console.log(`📤 Upload progress: ${progress.percentage}%`);
      }
    }
  };
}

// SDK status check
export function getSDKStatus() {
  return {
    initialized: !!(performanceMonitorInstance && cacheManagerInstance),
    hasStorageConfig: !!storageConfigInstance,
    environment: {
      supabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      supabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      isDev: import.meta.env.DEV
    },
    cacheStats: cacheManagerInstance ? {
      size: cacheManager.getStats().size,
      entries: cacheManager.getStats().entries
    } : null,
    performanceStats: performanceMonitorInstance ? performanceMonitor.getStats() : null
  };
}

// Debug function
export function debugSDK() {
  console.log('🔧 SDK Status:', getSDKStatus());
  
  if (import.meta.env.DEV) {
    console.log('📈 Performance Stats:', performanceMonitor.getStats());
    console.log('💾 Cache Stats:', cacheManager.getStats());
  }
}