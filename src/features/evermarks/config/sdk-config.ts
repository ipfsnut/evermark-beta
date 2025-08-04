import { 
  createDefaultStorageConfig,
  type StorageConfig 
} from '@ipfsnut/evermark-sdk-core';

// IMPORT OUR EXISTING SINGLETON
import { supabase } from '@/lib/supabase';

import {
  CacheManager,
  PerformanceMonitor,
  CORSHandler,
  createImageLoader,
  type CacheConfig,
  type LoadMetrics
} from '@ipfsnut/evermark-sdk-browser';

// =================
// PERFORMANCE MONITORING
// =================

/**
 * Global performance monitor instance
 * Tracks image loading performance across the app
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Global cache manager instance
 * Manages browser cache for image loading optimization
 */
export const cacheManager = new CacheManager({
  maxSize: 50 * 1024 * 1024, // 50MB
  maxEntries: 100,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  persistent: true
});

/**
 * CORS handler for Supabase Storage
 */
export const corsHandler = new CORSHandler({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  allowedOrigins: ['*'],
  customHeaders: {
    'Cache-Control': 'public, max-age=3600'
  }
});

// =================
// CONFIGURATION FUNCTIONS - FIXED
// =================

/**
 * FIXED: Create storage configuration using our existing Supabase client
 * This prevents creating duplicate clients
 */
export function createEvermarkStorageConfig(): StorageConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  }

  // FIXED: Return config that uses our existing client instead of creating new ones
  return {
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseKey,
      // CRITICAL: Pass our existing client instance
      client: supabase,
    },
    ipfs: {
      gateway: 'https://gateway.pinata.cloud',
    },
    bucket: 'evermark-images'
  };
}

/**
 * Enhanced version with performance monitoring integration
 * FIXED: Uses existing client
 */
export function getEvermarkStorageConfig(): StorageConfig {
  return createEvermarkStorageConfig();
}

/**
 * Enhanced version with performance monitoring integration
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
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      // FIXED: Use our existing client
      client: supabase
    },
    // NEW: Performance monitoring integration
    onLoad: (metrics: LoadMetrics) => {
      performanceMonitor.recordLoad(metrics);
      if (import.meta.env.NODE_ENV === 'development') {
        console.log('📊 Image Load Metrics:', metrics);
      }
    },
    onError: (error: string, source: string) => {
      console.warn(`❌ Image load failed from ${source}:`, error);
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
 * NEW: Debug mode with enhanced logging and performance tracking
 */
export function getDebugImageLoaderOptions() {
  return {
    ...getDefaultImageLoaderOptions(),
    debug: true,
    onProgress: (loaded: number, total: number) => {
      console.log(`📥 Loading progress: ${loaded}/${total} bytes (${Math.round((loaded/total)*100)}%)`);
    },
    onDebug: (info: any) => {
      console.group('🖼️ Image Loading Debug');
      console.log('Sources attempted:', info.sources);
      console.log('Load time:', info.loadTime);
      console.log('Cache hit:', info.fromCache);
      console.log('Current source:', info.currentSource);
      console.groupEnd();
    },
    onCacheHit: (url: string) => {
      console.log(`⚡ Cache hit for: ${url.substring(0, 50)}...`);
    },
    onCacheMiss: (url: string) => {
      console.log(`📡 Loading from network: ${url.substring(0, 50)}...`);
    }
  };
}

/**
 * NEW: High-performance options for bulk operations
 */
export function getBulkOptimizationOptions() {
  return {
    ...getDefaultImageLoaderOptions(),
    timeout: 3000, // Faster timeout for bulk operations
    maxRetries: 1,  // Fewer retries for speed
    resolution: {
      maxSources: 2, // Limit sources for speed
      defaultTimeout: 3000,
      includeIpfs: false, // Skip IPFS for bulk for speed
      preferThumbnail: true
    },
    // Bulk-specific optimizations
    concurrency: 6, // Process 6 images simultaneously
    batchSize: 12,  // Process in batches of 12
    prioritizeCache: true, // Prefer cached images
    skipSlowSources: true // Skip sources that are consistently slow
  };
}

/**
 * NEW: Performance-aware options that adapt based on network conditions
 */
export function getAdaptiveImageLoaderOptions() {
  const connection = (navigator as any).connection;
  const isSlowConnection = connection && (
    connection.effectiveType === 'slow-2g' || 
    connection.effectiveType === '2g' ||
    connection.saveData
  );

  const baseOptions = isSlowConnection ? 
    getMobileImageLoaderOptions() : 
    getDefaultImageLoaderOptions();

  return {
    ...baseOptions,
    // Adaptive timeout based on connection
    timeout: isSlowConnection ? 3000 : 8000,
    resolution: {
      ...baseOptions.resolution,
      // Prefer thumbnails on slow connections
      preferThumbnail: isSlowConnection,
      // Skip IPFS on slow connections
      includeIpfs: !isSlowConnection,
      // Limit sources on slow connections
      maxSources: isSlowConnection ? 1 : 3
    }
  };
}

/**
 * Upload configuration for the SDK - FIXED: Uses existing client
 */
export function getUploadOptions() {
  return {
    generateThumbnails: true,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    debug: import.meta.env.NODE_ENV === 'development',
    // FIXED: Use our existing Supabase client
    supabaseClient: supabase,
    // NEW: Progress tracking
    onProgress: (progress: any) => {
      if (import.meta.env.NODE_ENV === 'development') {
        console.log(`📤 Upload progress: ${progress.percentage}%`);
      }
    }
  };
}

// =================
// PERFORMANCE UTILITIES
// =================

/**
 * NEW: Get comprehensive performance statistics
 */
export function getPerformanceStats() {
  const stats = performanceMonitor.getStats();
  const cacheStats = cacheManager.getStats();
  
  return {
    images: {
      totalLoads: stats.totalLoads,
      successfulLoads: stats.successfulLoads,
      failedLoads: stats.failedLoads,
      averageLoadTime: stats.averageLoadTime,
      cacheHitRate: stats.cacheHitRate
    },
    cache: {
      size: cacheStats.size,
      entries: cacheStats.entries,
      totalSize: cacheStats.totalSize,
      hitRate: cacheStats.hitRate
    },
    sources: stats.sourceSuccessRates,
    errors: stats.commonErrors
  };
}

/**
 * NEW: Clear all performance data and cache
 */
export function clearPerformanceData() {
  performanceMonitor.clear();
  cacheManager.clear();
  console.log('🧹 Performance data and cache cleared');
}

/**
 * NEW: Log performance summary (useful for debugging)
 */
export function logPerformanceSummary() {
  const stats = getPerformanceStats();
  
  console.group('📊 Evermark Image Performance Summary');
  console.log(`Total loads: ${stats.images.totalLoads}`);
  console.log(`Success rate: ${((stats.images.successfulLoads / stats.images.totalLoads) * 100).toFixed(1)}%`);
  console.log(`Average load time: ${stats.images.averageLoadTime.toFixed(0)}ms`);
  console.log(`Cache hit rate: ${(stats.images.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`Cache entries: ${stats.cache.entries}`);
  console.log(`Cache size: ${(stats.cache.totalSize / 1024 / 1024).toFixed(1)}MB`);
  
  if (stats.errors.length > 0) {
    console.log('Common errors:', stats.errors);
  }
  
  console.groupEnd();
}

/**
 * NEW: Preload critical images for better performance
 */
export async function preloadCriticalImages(imageUrls: string[]) {
  const loader = createImageLoader({
    ...getBulkOptimizationOptions(),
    debug: import.meta.env.NODE_ENV === 'development'
  });

  console.log(`🚀 Preloading ${imageUrls.length} critical images...`);
  
  const results = await Promise.allSettled(
    imageUrls.slice(0, 5).map(url => // Limit to 5 for performance
      loader.loadImage([{ url, type: 'primary', priority: 1 }])
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ Preloaded ${successful}/${imageUrls.length} critical images`);
  
  return { successful, total: imageUrls.length };
}

/**
 * NEW: Test SDK configuration and connectivity
 */
export async function testSDKConfiguration() {
  console.log('🔧 Testing SDK configuration...');
  
  const results = {
    storageConfig: false,
    corsHandler: false,
    cacheManager: false,
    performanceMonitor: false,
    supabaseConnectivity: false
  };

  try {
    // Test storage config
    const config = getEvermarkStorageConfig();
    results.storageConfig = !!(config.supabase.url && config.supabase.anonKey);
    
    // Test CORS handler
    results.corsHandler = await corsHandler.testCORS('https://httpbin.org/get').then(r => r.success);
    
    // Test cache manager
    cacheManager.set('test', { url: 'test', timestamp: Date.now(), accessCount: 1, lastAccessed: Date.now() });
    results.cacheManager = cacheManager.has('test');
    cacheManager.delete('test');
    
    // Test performance monitor
    performanceMonitor.recordLoad({
      url: 'test',
      source: 'test',
      startTime: Date.now(),
      endTime: Date.now() + 100,
      loadTime: 100,
      fromCache: false,
      success: true,
      retryCount: 0
    });
    results.performanceMonitor = performanceMonitor.getStats().totalLoads > 0;
    
    console.log('✅ SDK Configuration Test Results:', results);
    return results;
    
  } catch (error) {
    console.error('❌ SDK Configuration Test Failed:', error);
    return results;
  }
}

// =================
// INITIALIZATION
// =================

/**
 * Initialize SDK with optimal settings
 * Call this once when the app starts
 */
export function initializeSDK() {
  console.log('🚀 Initializing Evermark SDK...');
  
  // Test configuration in development
  if (import.meta.env.NODE_ENV === 'development') {
    testSDKConfiguration();
    
    // Log performance stats every 30 seconds in development
    setInterval(() => {
      const stats = getPerformanceStats();
      if (stats.images.totalLoads > 0) {
        logPerformanceSummary();
      }
    }, 30000);
  }
  
  // Set up global error handling
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('image') || event.reason?.message?.includes('loading')) {
      console.warn('🖼️ Unhandled image loading error:', event.reason);
    }
  });
  
  console.log('✅ Evermark SDK initialized successfully');
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  // Initialize after a short delay to let other modules load
  setTimeout(initializeSDK, 100);
}