import { useState, useEffect, useRef, useCallback } from 'react';

interface UseImageOptimizationOptions {
  lazy?: boolean;
  preload?: boolean;
  fallbackDelay?: number;
  retryAttempts?: number;
  preferThumbnail?: boolean;
  enableProgressiveLoading?: boolean;
}

interface UseImageOptimizationResult {
  imageUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  currentSource: 'supabase' | 'ipfs' | 'processed' | 'thumbnail' | null;
  retryCount: number;
  loadProgress: number;
  loadImage: () => void;
  retryLoad: () => void;
  resetState: () => void;
}

interface ImageSource {
  url: string;
  type: 'supabase' | 'ipfs' | 'processed' | 'thumbnail';
  priority: number;
}

export function useImageOptimization(
  evermark: {
    supabaseImageUrl?: string;
    thumbnailUrl?: string;
    processed_image_url?: string;
    ipfsHash?: string;
  },
  options: UseImageOptimizationOptions = {}
): UseImageOptimizationResult {
  const {
    lazy = true,
    preload = false,
    fallbackDelay = 2000,
    retryAttempts = 2,
    preferThumbnail = false,
    enableProgressiveLoading = true
  } = options;

  // ENHANCED: More detailed state management
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [currentSource, setCurrentSource] = useState<'supabase' | 'ipfs' | 'processed' | 'thumbnail' | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // FIXED: Get image sources in optimized priority order
  const getImageSources = useCallback((): ImageSource[] => {
    const sources: ImageSource[] = [];
    
    // Use thumbnail first if preferred and available
    if (preferThumbnail && evermark.thumbnailUrl) {
      sources.push({ 
        url: evermark.thumbnailUrl, 
        type: 'thumbnail', 
        priority: 1 
      });
    }
    
    // Supabase URLs (primary - fastest and most reliable)
    if (evermark.supabaseImageUrl) {
      sources.push({ 
        url: evermark.supabaseImageUrl, 
        type: 'supabase', 
        priority: preferThumbnail ? 2 : 1 
      });
    }
    
    // Legacy processed image URL
    if (evermark.processed_image_url) {
      sources.push({ 
        url: evermark.processed_image_url, 
        type: 'processed', 
        priority: 3 
      });
    }
    
    // IPFS as fallback (slowest but most permanent)
    if (evermark.ipfsHash) {
      sources.push({ 
        url: `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`, 
        type: 'ipfs', 
        priority: 4 
      });
    }
    
    return sources.sort((a, b) => a.priority - b.priority);
  }, [evermark, preferThumbnail]);

  // ENHANCED: Progressive loading with retry and fallback
  const loadImageWithFallback = useCallback(async (sourceIndex: number = 0): Promise<void> => {
    const sources = getImageSources();
    
    if (sourceIndex >= sources.length) {
      setIsLoading(false);
      setHasError(true);
      setImageUrl(null);
      setCurrentSource(null);
      setLoadProgress(0);
      return;
    }

    const source = sources[sourceIndex];
    
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setHasError(false);
    setCurrentSourceIndex(sourceIndex);
    setCurrentSource(source.type);

    // ENHANCED: Progressive loading simulation for better UX
    if (enableProgressiveLoading) {
      setLoadProgress(0);
      progressIntervalRef.current = setInterval(() => {
        setLoadProgress(prev => {
          if (prev >= 90) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
            return 90; // Stay at 90% until actual load completes
          }
          return prev + Math.random() * 10;
        });
      }, 100);
    }

    try {
      // Test if image loads with timeout and abort support
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        
        const cleanup = () => {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        };
        
        // Set up timeout
        timeoutRef.current = setTimeout(() => {
          cleanup();
          reject(new Error(`Image load timeout for ${source.type}`));
        }, source.type === 'ipfs' ? 15000 : fallbackDelay); // Longer timeout for IPFS
        
        // Set up load handlers
        img.onload = () => {
          cleanup();
          resolve();
        };
        
        img.onerror = () => {
          cleanup();
          reject(new Error(`Image load failed for ${source.type}`));
        };
        
        // Handle abort
        abortControllerRef.current?.signal.addEventListener('abort', () => {
          cleanup();
          reject(new Error('Image load aborted'));
        });
        
        // Start loading
        img.src = source.url;
      });

      // Success - use this URL
      setImageUrl(source.url);
      setCurrentSource(source.type);
      setIsLoading(false);
      setHasError(false);
      setRetryCount(0);
      setLoadProgress(100);
      
      console.log(`✅ Image loaded successfully from ${source.type}`);

    } catch (error) {
      console.warn(`❌ Image load failed for ${source.type}:`, error);
      
      // Clear progress on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      setLoadProgress(0);
      
      // Try next source or retry
      if (sourceIndex < sources.length - 1) {
        console.log(`🔄 Trying next source: ${sources[sourceIndex + 1].type}`);
        await loadImageWithFallback(sourceIndex + 1);
      } else if (retryCount < retryAttempts) {
        // Retry from beginning with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`⏳ Retrying in ${retryDelay}ms (attempt ${retryCount + 1})`);
        
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadImageWithFallback(0);
        }, retryDelay);
      } else {
        // All sources and retries failed
        setIsLoading(false);
        setHasError(true);
        setImageUrl(null);
        setCurrentSource(null);
        console.error(`💥 All image sources failed after ${retryCount + 1} attempts`);
      }
    }
  }, [getImageSources, retryCount, retryAttempts, fallbackDelay, enableProgressiveLoading]);

  // ENHANCED: Manual retry function
  const retryLoad = useCallback(() => {
    console.log('🔄 Manual retry triggered');
    setRetryCount(0);
    setCurrentSourceIndex(0);
    setHasError(false);
    loadImageWithFallback(0);
  }, [loadImageWithFallback]);

  // ENHANCED: Reset state function
  const resetState = useCallback(() => {
    setRetryCount(0);
    setCurrentSourceIndex(0);
    setHasError(false);
    setIsLoading(false);
    setImageUrl(null);
    setCurrentSource(null);
    setLoadProgress(0);
    
    // Cancel any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  }, []);

  // ENHANCED: Trigger loading
  const loadImage = useCallback(() => {
    const sources = getImageSources();
    if (sources.length > 0) {
      loadImageWithFallback(0);
    } else {
      setHasError(true);
      setImageUrl(null);
      setCurrentSource(null);
    }
  }, [getImageSources, loadImageWithFallback]);

  // Initial load or preload
  useEffect(() => {
    if (preload || !lazy) {
      loadImage();
    }
  }, [loadImage, preload, lazy]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Reset state when evermark changes
  useEffect(() => {
    resetState();
    
    if (!lazy) {
      // Small delay to allow for cleanup
      setTimeout(() => {
        loadImage();
      }, 50);
    }
  }, [
    evermark.supabaseImageUrl, 
    evermark.processed_image_url, 
    evermark.ipfsHash, 
    evermark.thumbnailUrl,
    lazy,
    resetState,
    loadImage
  ]);

  return {
    imageUrl,
    isLoading,
    hasError,
    currentSource,
    retryCount,
    loadProgress,
    loadImage,
    retryLoad,
    resetState
  };
}