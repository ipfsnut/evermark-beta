import { 
  User, 
  Calendar, 
  Eye, 
  Vote,
  ExternalLink,
  Hash,
  FileText,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  RotateCcw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Use our local EvermarkImage component with style support
import { EvermarkImage } from './EvermarkImage';
import { type Evermark } from '../types';

// FIXED: Import performance monitoring from updated config
import { 
  performanceMonitor, 
  cacheManager, 
  getDebugImageLoaderOptions,
  getEvermarkStorageConfig 
} from '../config/sdk-config';

interface EvermarkCardProps {
  evermark: Evermark;
  variant?: 'standard' | 'compact' | 'list' | 'hero';
  onClick?: (evermark: Evermark) => void;
  showVotes?: boolean;
  showViews?: boolean;
  showDescription?: boolean;
  showImage?: boolean;
  showPerformanceInfo?: boolean;
  enableRetry?: boolean;
  className?: string;
}

export function EvermarkCard({
  evermark,
  variant = 'standard',
  onClick,
  showVotes = true,
  showViews = true,
  showDescription = true,
  showImage = true,
  showPerformanceInfo = import.meta.env.NODE_ENV === 'development',
  enableRetry = true,
  className = ''
}: EvermarkCardProps) {
  
  const handleClick = () => {
    onClick?.(evermark);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const getContentTypeIcon = (contentType: Evermark['contentType']) => {
    switch (contentType) {
      case 'Cast':
        return <MessageCircle className="h-4 w-4" />;
      case 'DOI':
        return <FileText className="h-4 w-4" />;
      case 'ISBN':
        return <FileText className="h-4 w-4" />;
      case 'URL':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 backdrop-blur-sm hover:scale-[1.02]';
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} hover:shadow-xl hover:shadow-purple-500/30 hover:border-purple-400/70`;
      case 'compact':
        return `${baseClasses} hover:border-blue-400/50 hover:shadow-blue-500/20`;
      case 'list':
        return `${baseClasses} flex flex-row hover:border-green-400/50 hover:shadow-green-500/20 hover:scale-[1.01]`;
      default:
        return baseClasses;
    }
  };

  const getTitleClasses = () => {
    switch (variant) {
      case 'hero':
        return 'text-xl sm:text-2xl font-bold text-white';
      case 'compact':
        return 'text-base font-semibold text-white';
      case 'list':
        return 'text-base font-semibold text-white';
      default:
        return 'text-lg sm:text-xl font-semibold text-white';
    }
  };

  // FIXED: Check if image is cached for performance indicator
  const isImageCached = () => {
    if (!evermark.supabaseImageUrl && !evermark.thumbnailUrl) return false;
    
    const primaryUrl = variant === 'compact' || variant === 'list' 
      ? evermark.thumbnailUrl || evermark.supabaseImageUrl
      : evermark.supabaseImageUrl || evermark.thumbnailUrl;
      
    return primaryUrl ? cacheManager.has(primaryUrl) : false;
  };

  // FIXED: Get performance stats for this specific image
  const getImagePerformanceInfo = () => {
    if (!showPerformanceInfo) return null;
    
    const stats = performanceMonitor.getStats();
    const imageUrl = evermark.supabaseImageUrl || evermark.thumbnailUrl;
    
    if (!imageUrl) return null;
    
    return {
      cached: isImageCached(),
      totalLoads: stats?.totalLoads || 0,
      cacheHitRate: stats?.cacheHitRate || 0,
      averageLoadTime: stats?.averageLoadTime || 0
    };
  };

  // FIXED: Performance indicator component
  const PerformanceIndicator = () => {
    const perfInfo = getImagePerformanceInfo();
    if (!perfInfo || !showPerformanceInfo) return null;

    return (
      <div className="absolute top-2 left-2 bg-black/80 text-xs px-2 py-1 rounded backdrop-blur-sm">
        <div className="flex items-center gap-1">
          {perfInfo.cached ? (
            <>
              <Zap className="h-3 w-3 text-green-400" />
              <span className="text-green-400">CACHED</span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 text-yellow-400" />
              <span className="text-yellow-400">LOADING</span>
            </>
          )}
        </div>
        <div className="text-gray-400 text-xs">
          Hit: {(perfInfo.cacheHitRate * 100).toFixed(0)}% | 
          Avg: {perfInfo.averageLoadTime.toFixed(0)}ms
        </div>
      </div>
    );
  };

  // Enhanced error placeholder with retry functionality
  const EnhancedErrorPlaceholder = ({ onRetry }: { onRetry?: () => void }) => (
    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-700/20 flex flex-col items-center justify-center cursor-pointer group">
      <div className="text-center" onClick={onRetry}>
        <AlertCircle className="h-8 w-8 text-red-400 mb-2 mx-auto" />
        <div className="text-red-300 text-sm font-medium mb-1">Failed to load</div>
        {enableRetry && (
          <button 
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors bg-red-900/30 px-2 py-1 rounded border border-red-500/30"
            onClick={(e) => {
              e.stopPropagation();
              onRetry?.();
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );

  // Progressive loading placeholder
  const ProgressiveLoadingPlaceholder = ({ progress }: { progress?: number }) => (
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-2 mx-auto"></div>
        <div className="text-blue-300 text-sm font-medium">Loading...</div>
        {typeof progress === 'number' && (
          <div className="text-xs text-blue-400 mt-1">{Math.round(progress)}%</div>
        )}
      </div>
    </div>
  );

  // List variant layout
  if (variant === 'list') {
    return (
      <div 
        className={`${getVariantClasses()} ${className}`}
        onClick={handleClick}
      >
        {/* FIXED: SDK Image Component */}
        {showImage && (
          <div className="relative overflow-hidden rounded-lg w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
            <EvermarkImage
              evermark={evermark}
              variant="list"
              enableAutoTransfer={true}
              onLoad={() => {
                if (showPerformanceInfo) {
                  console.log(`✅ List image loaded for evermark #${evermark.tokenId}`);
                }
              }}
              onError={(error) => {
                console.warn(`❌ List image error for #${evermark.tokenId}:`, error);
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <PerformanceIndicator />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
          <div>
            <h3 className={`${getTitleClasses()} group-hover:text-purple-400 transition-colors mb-1 line-clamp-2`}>
              {evermark.title}
            </h3>
            
            <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
              <div className="flex items-center min-w-0 flex-1">
                <User className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">{evermark.author}</span>
              </div>
              <div className="flex items-center flex-shrink-0">
                {getContentTypeIcon(evermark.contentType)}
                <span className="ml-1">{evermark.contentType}</span>
              </div>
            </div>

            {evermark.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {evermark.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/30"
                  >
                    {tag}
                  </span>
                ))}
                {evermark.tags.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{evermark.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span>{formatDistanceToNow(new Date(evermark.createdAt), { addSuffix: true })}</span>
              {showViews && evermark.viewCount !== undefined && (
                <span className="flex items-center text-cyan-400">
                  <Eye className="h-3 w-3 mr-1" />
                  {formatCount(evermark.viewCount)}
                </span>
              )}
              {showVotes && evermark.votes !== undefined && evermark.votes > 0 && (
                <span className="flex items-center text-green-400">
                  <Vote className="h-3 w-3 mr-1" />
                  {formatCount(evermark.votes)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard card layout (vertical)
  return (
    <div 
      className={`${getVariantClasses()} ${className} flex flex-col h-full`}
      onClick={handleClick}
    >
      {/* FIXED: SDK Image Component */}
      {showImage && (
        <div className={`relative overflow-hidden rounded-t-xl ${variant === 'hero' ? 'h-64 sm:h-80' : 'h-48 sm:h-56'}`}>
          <EvermarkImage
            evermark={evermark}
            variant={variant}
            enableAutoTransfer={true}
            onLoad={() => {
              if (showPerformanceInfo) {
                console.log(`✅ Card image loaded for evermark #${evermark.tokenId}`);
              }
            }}
            onError={(error) => {
              console.warn(`❌ Card image error for #${evermark.tokenId}:`, error);
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <PerformanceIndicator />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 sm:p-6">
        <h3 className={`${getTitleClasses()} mb-3 line-clamp-2 group-hover:text-purple-400 transition-colors`}>
          {evermark.title}
        </h3>

        <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
          <div className="flex items-center min-w-0 flex-1">
            <User className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">{evermark.author}</span>
          </div>
          <div className="flex items-center flex-shrink-0 ml-2">
            <Calendar className="h-4 w-4 mr-1" />
            <span className="text-xs">
              {formatDistanceToNow(new Date(evermark.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {showDescription && evermark.description && variant !== 'compact' && (
          <p className="text-sm text-gray-300 line-clamp-3 flex-1 mb-4">
            {evermark.description}
          </p>
        )}

        {evermark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {evermark.tags.slice(0, variant === 'compact' ? 2 : 3).map((tag, index) => (
              <span
                key={index}
                className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-500/30"
              >
                {tag}
              </span>
            ))}
            {evermark.tags.length > (variant === 'compact' ? 2 : 3) && (
              <span className="text-xs text-gray-500">
                +{evermark.tags.length - (variant === 'compact' ? 2 : 3)} more
              </span>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-700">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {showViews && evermark.viewCount !== undefined && (
              <span className="flex items-center text-cyan-400">
                <Eye className="h-3 w-3 mr-1" />
                {formatCount(evermark.viewCount)}
              </span>
            )}
            {showVotes && evermark.votes !== undefined && evermark.votes > 0 && (
              <span className="flex items-center text-green-400">
                <Vote className="h-3 w-3 mr-1" />
                {formatCount(evermark.votes)}
              </span>
            )}
            {/* FIXED: Performance indicator in footer */}
            {showPerformanceInfo && isImageCached() && (
              <span className="flex items-center text-green-400" title="Image cached for fast loading">
                <Zap className="h-3 w-3 mr-1" />
                Fast
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Content type indicator */}
            <div className="flex items-center text-xs text-gray-500">
              {getContentTypeIcon(evermark.contentType)}
              <span className="ml-1 hidden sm:inline">{evermark.contentType}</span>
            </div>
            
            {evermark.sourceUrl && (
              <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}