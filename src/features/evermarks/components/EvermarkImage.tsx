import React, { useState, useCallback, useEffect } from 'react';
import { Hash, AlertCircle, Clock, Image } from 'lucide-react';
import { SupabaseImageService } from '../services/SupabaseImageService';

interface EvermarkImageProps {
  evermark: {
    id: string;
    tokenId: number;
    title: string;
    contentType: string;
    supabaseImageUrl?: string;
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

export const EvermarkImage: React.FC<EvermarkImageProps> = ({
  evermark,
  variant = 'standard',
  showPlaceholder = true,
  className = '',
  onImageLoad,
  onImageError
}) => {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error' | 'none'>('none');
  const [isBlurred, setIsBlurred] = useState(true);

  const imageUrl = SupabaseImageService.getImageUrl(evermark);
  const contentStyle = getContentTypeStyle(evermark.contentType);

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

  const handleImageLoad = useCallback(() => {
    setImageState('loaded');
    setTimeout(() => setIsBlurred(false), 100);
    onImageLoad?.();
  }, [onImageLoad]);

  const handleImageError = useCallback(() => {
    console.warn('🖼️ Image load failed:', imageUrl);
    setImageState('error');
    onImageError?.('Image failed to load');
  }, [imageUrl, onImageError]);

  // Initialize loading state
  useEffect(() => {
    if (imageUrl) {
      setImageState('loading');
      setIsBlurred(true);
    } else {
      setImageState('none');
    }
  }, [imageUrl]);

  const shouldShowPlaceholder = !imageUrl || imageState !== 'loaded';

  return (
    <div className={`${getSizeClasses()} ${className} group`}>
      {/* Actual Image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={evermark.title}
          className={`
            w-full h-full object-cover transition-all duration-500 group-hover:scale-105
            ${isBlurred ? 'blur-sm scale-110' : 'blur-0 scale-100'}
            ${imageState === 'loaded' ? 'opacity-100' : 'opacity-0'}
          `}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
        />
      )}

      {/* Content-Aware Placeholder */}
      {showPlaceholder && shouldShowPlaceholder && (
        <div className={`
          absolute inset-0 bg-gradient-to-br ${contentStyle.gradient}
          flex flex-col items-center justify-center transition-opacity duration-300
          ${imageState === 'loaded' ? 'opacity-0 pointer-events-none' : 'opacity-100'}
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

      {/* Status Indicators */}
      <div className="absolute bottom-2 left-2 z-10">
        {imageState === 'loading' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <Clock className="h-3 w-3 text-yellow-400 animate-spin" />
            <span className="text-yellow-400">Loading...</span>
          </div>
        )}
        
        {imageState === 'error' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <AlertCircle className="h-3 w-3 text-red-400" />
            <span className="text-red-400">Failed</span>
          </div>
        )}
        
        {evermark.imageStatus === 'processing' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <Clock className="h-3 w-3 text-blue-400 animate-pulse" />
            <span className="text-blue-400">Processing</span>
          </div>
        )}
        
        {imageState === 'none' && (
          <div className="bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
            <Image className="h-3 w-3 text-gray-400" />
            <span className="text-gray-400">No image</span>
          </div>
        )}
      </div>

      {/* Token ID Badge */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">
        #{evermark.tokenId}
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Loading Shimmer */}
      {imageState === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
      )}
    </div>
  );
};

