import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Hash, AlertCircle, Clock, Image, RefreshCw, Wifi, WifiOff } from 'lucide-react';

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
  className?: string;
  onImageLoad?: () => void;
  onImageError?: (error: string) => void;
}

// Content-aware styling
const getContentTypeStyle = (contentType: string) => {
  const styles = {
    'Cast': { gradient: 'from-purple-500 to-pink-500', icon: '💬', color: 'text-purple-300' },
    'DOI': { gradient: 'from-blue-500 to-cyan-500', icon: '📄', color: 'text-blue-300' },
    'ISBN': { gradient: 'from-green-500 to-teal-500', icon: '📚', color: 'text-green-300' },
    'URL': { gradient: 'from-orange-500 to-red-500', icon: '🌐', color: 'text-orange-300' },
    'Custom': { gradient: 'from-gray-500 to-gray-700', icon: '✨', color: 'text-gray-300' }
  };
  
  return styles[contentType as keyof typeof styles] || styles.Custom;
};

// FIXED: Progressive loading with fallback and retry logic
export const EvermarkImage: React.FC<EvermarkImageProps> = ({
  evermark,
  variant = 'standard',
  showPlaceholder = true,
  className = '',
  onImageLoad,
  onImageError
}) => {
  // ENHANCED: More detailed state management
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error' | 'retrying'>('idle');
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const contentStyle = getContentTypeStyle(evermark.contentType);
  
  // FIXED: Get all possible image sources in priority order
  const getImageSources = useCallback((): string[] => {
    const sources: string[] = [];
    
    // Priority 1: Thumbnail for better loading performance (if compact variant)
    if ((variant === 'compact' || variant === 'list') && evermark.thumbnailUrl) {
      sources.push(evermark.thumbnailUrl);
    }
    
    // Priority 2: Supabase image URL (fastest, most reliable)
    if (evermark.supabaseImageUrl) {
      sources.push(evermark.supabaseImageUrl);
    }
    
    // Priority 3: Legacy processed image URL
    if (evermark.processed_image_url) {
      sources.push(evermark.processed_image_url);
    }
    
    // Priority 4: IPFS gateway (slowest but most permanent)
    if (evermark.ipfsHash) {
      sources.push(`https://gateway.pinata.cloud/ipfs/${evermark.ipfsHash}`);
    }
    
    // Remove duplicates while preserving order
    return [...new Set(sources)];
  }, [evermark, variant]);

  // FIXED: Intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);

  // FIXED: Progressive loading with retry mechanism
  const loadImageWithFallback = useCallback(async (sourceIndex: number = 0): Promise<void> => {
    const sources = getImageSources();
    
    if (sourceIndex >= sources.length) {
      setLoadingState('error');
      setCurrentImageUrl(null);
      onImageError?.('All image sources failed to load');
      return;
    }

    const imageUrl = sources[sourceIndex];
    
    // Abort any previous loading attempt
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoadingState('loading');
      setCurrentSourceIndex(sourceIndex);
      
      // Create a new image element for testing
      const testImage = new Image();
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000); // 10 second timeout
        
        testImage.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        
        testImage.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Image load failed'));
        };
        
        // Handle abort
        abortControllerRef.current?.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Image load aborted'));
        });
      });
      
      // Start loading
      testImage.src = imageUrl;
      
      // Wait for load or timeout
      await loadPromise;
      
      // If we get here, the image loaded successfully
      setCurrentImageUrl(imageUrl);
      setLoadingState('loaded');
      setRetryCount(0);
      onImageLoad?.();
      
    } catch (error) {
      console.warn(`Image source ${sourceIndex} failed:`, error);
      
      // Try next source or retry current source
      if (sourceIndex < sources.length - 1) {
        // Try next source immediately
        await loadImageWithFallback(sourceIndex + 1);
      } else if (retryCount < 2) {
        // Retry current source with exponential backoff
        setLoadingState('retrying');
        const retryDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        
        retryTimeoutRef.current = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadImageWithFallback(0); // Start from beginning
        }, retryDelay);
      } else {
        // All sources and retries failed
        setLoadingState('error');
        setCurrentImageUrl(null);
        onImageError?.(`Failed to load image after ${retryCount + 1} attempts`);
      }
    }
  }, [getImageSources, retryCount, onImageLoad, onImageError]);

  // FIXED: Manual retry function
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setCurrentSourceIndex(0);
    loadImageWithFallback(0);
  }, [loadImageWithFallback]);

  // Start loading when visible and sources are available
  useEffect(() => {
    if (!isVisible) return;
    
    const sources = getImageSources();
    if (sources.length > 0) {
      loadImageWithFallback(0);
    } else {
      setLoadingState('error');
    }
  }, [isVisible, getImageSources, loadImageWithFallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Variant-specific classes
  const getSizeClasses = () => {
    const baseClasses = 'relative overflow-hidden bg-gray-800 border border-gray-700 rounded-lg';
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} h-64 sm:h-80`;
      case 'compact':
        return `${baseClasses} h-32 sm:h-40`;
      case 'list':
        return `${baseClasses} w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0`;
      default:
        return `${baseClasses} h-48 sm:h-56`;
    }
  };

  const shouldShowPlaceholder = !currentImageUrl || loadingState !== 'loaded';

  return (
    <div ref={containerRef} className={`${getSizeClasses()} ${className} group`}>
      {/* FIXED: Actual Image with better error handling */}
      {currentImageUrl && (
        <img
          ref={imageRef}
          src={currentImageUrl}
          alt={evermark.title}
          className={`
            w-full h-full object-cover transition-all duration-500 group-hover:scale-105
            ${loadingState === 'loaded' ? 'opacity-100' : 'opacity-0'}
          `}
          loading="lazy"
          onLoad={() => {
            if (loadingState === 'loading') {
              setLoadingState('loaded');
              onImageLoad?.();
            }
          }}
          onError={() => {
            console.warn('Image render failed, trying next source...');
            if (currentSourceIndex < getImageSources().length - 1) {
              loadImageWithFallback(currentSourceIndex + 1);
            }
          }}
        />
      )}

      {/* ENHANCED: Content-Aware Placeholder with better error states */}
      {showPlaceholder && shouldShowPlaceholder && (
        <div className={`
          absolute inset-0 bg-gradient-to-br ${contentStyle.gradient}
          flex flex-col items-center justify-center transition-opacity duration-300
          ${loadingState === 'loaded' ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}>
          <div className="text-center">
            <div className="text-4xl mb-2">{contentStyle.icon}</div>
            <div className="text-white/80 text-sm font-medium">#{evermark.tokenId}</div>
            {variant !== 'compact' && variant !== 'list' && (
              <div className="text-white/60 text-xs mt-1 px-2 max-w-[120px] truncate">
                {evermark.title}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ENHANCED: Status Indicators with better UX */}
      <div className="absolute bottom-2 left-2 z-10">
        {loadingState === 'loading' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <Clock className="h-3 w-3 text-blue-400 animate-spin" />
            <span className="text-blue-400">Loading...</span>
          </div>
        )}
        
        {loadingState === 'retrying' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <RefreshCw className="h-3 w-3 text-yellow-400 animate-spin" />
            <span className="text-yellow-400">Retrying...</span>
          </div>
        )}
        
        {loadingState === 'error' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
            <button 
              onClick={handleRetry}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
              title="Click to retry loading"
            >
              <WifiOff className="h-3 w-3" />
              <span>Retry</span>
            </button>
          </div>
        )}
        
        {evermark.imageStatus === 'processing' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <Clock className="h-3 w-3 text-blue-400 animate-pulse" />
            <span className="text-blue-400">Processing</span>
          </div>
        )}
        
        {loadingState === 'idle' && !isVisible && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <Image className="h-3 w-3 text-gray-400" />
            <span className="text-gray-400">Lazy loading</span>
          </div>
        )}
      </div>

      {/* ENHANCED: Source indicator for debugging */}
      {loadingState === 'loaded' && currentImageUrl && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-black/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
            <Wifi className="h-3 w-3 text-green-400 inline mr-1" />
            <span className="text-green-400">
              {currentImageUrl.includes('supabase') ? 'Supabase' : 
               currentImageUrl.includes('ipfs') ? 'IPFS' : 'Source'}
            </span>
          </div>
        </div>
      )}

      {/* Token ID Badge */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">
        #{evermark.tokenId}
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* ENHANCED: Loading Progress Indicator */}
      {(loadingState === 'loading' || loadingState === 'retrying') && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-700">
          <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse" />
        </div>
      )}
    </div>
  );
};