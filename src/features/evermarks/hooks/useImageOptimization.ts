import { useState, useEffect, useRef, useCallback } from 'react';

interface UseImageOptimizationOptions {
  lazy?: boolean;
  preload?: boolean;
  fallbackDelay?: number;
  retryAttempts?: number;
  preferThumbnail?: boolean;
}

interface UseImageOptimizationResult {
  imageUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  loadImage: () => void;
  retryLoad: () => void;
  currentSource: 'supabase' | 'ipfs' | 'processed' | null;
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
    preferThumbnail = false
  } = options;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [currentSource, setCurrentSource] = useState<'supabase' | 'ipfs' | 'processed' | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get image URLs in priority order
  const getImageUrls = useCallback((): Array<{ url: string; source: 'supabase' | 'ipfs' | 'processed' }> => {
    const urls: Array<{ url: string; source: 'supabase' | 'ipfs' | 'processed' }> = [];
    
    // Use thumbnail first if preferred and available
    if (preferThumbnail && evermark.thumbnailUrl) {
      urls.push({ url: evermark.thumbnailUrl, source: 'supabase' });
    }
    
    // Supabase URLs (primary)
    if (evermark.supabaseImageUrl) {
      urls.push({ url: evermark.supabaseImageUrl, source: 'supabase' });
    }
    
    // Legacy processed image URL
    if (evermark.processed_image_url) {
      urls.push({ url: evermark.processed_image_url, source: 'processed' });
    }
    
    // IPFS as fallback
    if (evermark.ipfsHash) {
      urls.push({ 
        url: `https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`, 
        source: 'ipfs' 
      });
    }
    
    return urls;
  }, [evermark, preferThumbnail]);

  const loadImage = useCallback(async () => {
    const urls = getImageUrls();
    if (urls.length === 0) {
      setImageUrl(null);
      setIsLoading(false);
      setCurrentSource(null);
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setHasError(false);
    abortControllerRef.current = new AbortController();

    // Try URLs in priority order
    for (let i = 0; i < urls.length && i <= attempts; i++) {
      try {
        const { url, source } = urls[i];
        
        // Test if image loads
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
          img.src = url;
          
          // Add timeout for slow loading images
          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, fallbackDelay);
          
          img.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image load failed'));
          };
        });

        // Success - use this URL
        setImageUrl(url);
        setCurrentSource(source);
        setIsLoading(false);
        setHasError(false);
        return;

      } catch (error) {
        console.warn(`Image load failed for source ${urls[i].source}:`, error);
        
        // If this was the last URL, set error state
        if (i === urls.length - 1 || i >= retryAttempts) {
          setHasError(true);
          setIsLoading(false);
          setImageUrl(null);
          setCurrentSource(null);
        }
      }
    }
  }, [getImageUrls, attempts, retryAttempts, fallbackDelay]);

  const retryLoad = useCallback(() => {
    if (attempts < retryAttempts) {
      setAttempts(prev => prev + 1);
      setHasError(false);
      loadImage();
    }
  }, [attempts, retryAttempts, loadImage]);

  // Initial load or preload
  useEffect(() => {
    if (preload || !lazy) {
      loadImage();
    }
  }, [loadImage, preload, lazy]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Reset state when evermark changes
  useEffect(() => {
    setAttempts(0);
    setHasError(false);
    setImageUrl(null);
    setCurrentSource(null);
    
    if (!lazy) {
      loadImage();
    }
  }, [evermark.supabaseImageUrl, evermark.processed_image_url, evermark.ipfsHash, lazy, loadImage]);

  return {
    imageUrl,
    isLoading,
    hasError,
    loadImage,
    retryLoad,
    currentSource
  };
}