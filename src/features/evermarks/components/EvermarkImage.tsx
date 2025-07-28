import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Hash, AlertCircle, Clock, ImageIcon, RefreshCw, Wifi, WifiOff } from 'lucide-react';

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

// FIXED: Simplified image loading with better error handling
export const EvermarkImage: React.FC<EvermarkImageProps> = ({
  evermark,
  variant = 'standard',
  showPlaceholder = true,
  className = '',
  onImageLoad,
  onImageError
}) => {
  // SIMPLIFIED: Much simpler state management
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [isVisible, setIsVisible] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const attemptedUrls = useRef<Set<string>>(new Set());
  
  const contentStyle = getContentTypeStyle(evermark.contentType);
  
  // FIXED: Get image sources in priority order (simplified)
  const getImageSources = useCallback((): string[] => {
    const sources: string[] = [];
    
    // Priority 1: Thumbnail for compact/list variants
    if ((variant === 'compact' || variant === 'list') && evermark.thumbnailUrl) {
      sources.push(evermark.thumbnailUrl);
    }
    
    // Priority 2: Supabase image URL (primary)
    if (evermark.supabaseImageUrl) {
      sources.push(evermark.supabaseImageUrl);
    }
    
    // Priority 3: Legacy processed image URL
    if (evermark.processed_image_url && evermark.processed_image_url !== evermark.supabaseImageUrl) {
      sources.push(evermark.processed_image_url);
    }
    
    // Priority 4: IPFS gateway (backup)
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

  // FIXED: Simple image loading with native browser fallback
  const loadImage = useCallback(async () => {
    const sources = getImageSources();
    if (sources.length === 0) {
      setLoadingState('error');
      onImageError?.('No image sources available');
      return;
    }

    setLoadingState('loading');

    // Try each source in order
    for (const source of sources) {
      // Skip if we've already tried this URL and it failed
      if (attemptedUrls.current.has(source)) {
        continue;
      }

      try {
        console.log(`🖼️ Trying image source: ${source.includes('supabase') ? 'Supabase' : source.includes('ipfs') ? 'IPFS' : 'Legacy'}`);
        
        // FIXED: Use native Image() constructor with proper error handling
        const testImage = new Image();
        
        const loadPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Image load timeout'));
          }, 8000); // 8 second timeout
          
          testImage.onload = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          testImage.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image load failed'));
          };
        });
        
        // FIXED: Set crossOrigin to handle CORS issues
        testImage.crossOrigin = 'anonymous';
        testImage.src = source;
        
        // Wait for load
        await loadPromise;
        
        // Success!
        setCurrentImageUrl(source);
        setLoadingState('loaded');
        onImageLoad?.();
        console.log(`✅ Image loaded successfully from ${source.includes('supabase') ? 'Supabase' : source.includes('ipfs') ? 'IPFS' : 'Legacy'}`);
        return;

      } catch (error) {
        console.warn(`❌ Failed to load image from source:`, error);
        attemptedUrls.current.add(source);
        continue;
      }
    }

    // All sources failed
    setLoadingState('error');
    setCurrentImageUrl(null);
    onImageError?.('All image sources failed to load');
    console.error('💥 All image sources failed');
  }, [getImageSources, onImageLoad, onImageError]);

  // FIXED: Manual retry function
  const handleRetry = useCallback(() => {
    console.log('🔄 Manual retry triggered');
    attemptedUrls.current.clear(); // Clear failed attempts
    setLoadingState('idle');
    loadImage();
  }, [loadImage]);

  // Start loading when visible
  useEffect(() => {
    if (isVisible && loadingState === 'idle') {
      loadImage();
    }
  }, [isVisible, loadingState, loadImage]);

  // Reset when evermark changes
  useEffect(() => {
    attemptedUrls.current.clear();
    setLoadingState('idle');
    setCurrentImageUrl(null);
  }, [evermark.id, evermark.supabaseImageUrl, evermark.ipfsHash]);

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
      {/* FIXED: Actual Image with simplified error handling */}
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
          crossOrigin="anonymous"
          onLoad={() => {
            if (loadingState === 'loading') {
              setLoadingState('loaded');
              onImageLoad?.();
            }
          }}
          onError={() => {
            console.warn('Image render failed, marking as error');
            setLoadingState('error');
            setCurrentImageUrl(null);
          }}
        />
      )}

      {/* SIMPLIFIED: Content-Aware Placeholder */}
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

      {/* SIMPLIFIED: Status Indicators */}
      <div className="absolute bottom-2 left-2 z-10">
        {loadingState === 'loading' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <RefreshCw className="h-3 w-3 text-blue-400 animate-spin" />
            <span className="text-blue-400">Loading...</span>
          </div>
        )}
        
        {loadingState === 'error' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
            <button 
              onClick={handleRetry}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
              title="Click to retry loading"
            >
              <AlertCircle className="h-3 w-3" />
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
      </div>

      {/* SIMPLIFIED: Source indicator */}
      {loadingState === 'loaded' && currentImageUrl && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-black/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
            <Wifi className="h-3 w-3 text-green-400 inline mr-1" />
            <span className="text-green-400">
              {currentImageUrl.includes('supabase') ? 'Supabase' : 
               currentImageUrl.includes('ipfs') ? 'IPFS' : 'Legacy'}
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
    </div>
  );
};