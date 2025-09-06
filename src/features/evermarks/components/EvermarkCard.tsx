import React, { useState } from 'react';
import { 
  User, 
  Calendar, 
  Eye, 
  Vote,
  ExternalLink,
  Hash,
  FileText,
  MessageCircle,
  Clock,
  Zap,
  CheckCircle
} from 'lucide-react';
import { Formatters } from '../../../utils/formatters';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '../../../utils/responsive';

// Use ResponsiveEvermarkImage for better aspect ratio handling (especially for book covers)
import { ResponsiveEvermarkImage } from '../../../components/images/ResponsiveEvermarkImage';
import { AttestationPopup } from './AttestationPopup';
import { type Evermark } from '../types';

// TODO: Replace SDK-based performance monitoring with simple alternatives
// import { 
//   performanceMonitor, 
//   cacheManager, 
//   getDebugImageLoaderOptions,
//   getEvermarkStorageConfig 
// } from '../config/sdk-config';

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
  const { isDark } = useTheme();
  const [showAttestationPopup, setShowAttestationPopup] = useState(false);
  
  const handleClick = () => {
    onClick?.(evermark);
  };

  const handleVerificationClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowAttestationPopup(true);
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
      case 'README':
        return <span className="text-sm">📖</span>;
      case 'URL':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getVariantClasses = () => {
    const baseClasses = cn(
      'border rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer backdrop-blur-sm hover:scale-[1.02]',
      isDark 
        ? 'bg-gray-800/50 border-gray-700 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20' 
        : 'bg-white border-gray-300 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/10'
    );
    
    const hoverClasses = isDark
      ? {
          hero: 'hover:shadow-xl hover:shadow-purple-500/30 hover:border-purple-400/70',
          compact: 'hover:border-blue-400/50 hover:shadow-blue-500/20',
          list: 'flex flex-row hover:border-green-400/50 hover:shadow-green-500/20 hover:scale-[1.01]',
        }
      : {
          hero: 'hover:shadow-xl hover:shadow-purple-500/20 hover:border-purple-400/80',
          compact: 'hover:border-blue-400/60 hover:shadow-blue-500/10',
          list: 'flex flex-row hover:border-green-400/60 hover:shadow-green-500/10 hover:scale-[1.01]',
        };
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} ${hoverClasses.hero}`;
      case 'compact':
        return `${baseClasses} ${hoverClasses.compact}`;
      case 'list':
        return `${baseClasses} ${hoverClasses.list}`;
      default:
        return baseClasses;
    }
  };

  const getTitleClasses = () => {
    const colorClass = isDark ? 'text-white' : 'text-gray-900';
    
    switch (variant) {
      case 'hero':
        return `text-xl sm:text-2xl font-bold ${colorClass}`;
      case 'compact':
        return `text-base font-semibold ${colorClass}`;
      case 'list':
        return `text-base font-semibold ${colorClass}`;
      default:
        return `text-lg sm:text-xl font-semibold ${colorClass}`;
    }
  };

  // FIXED: Check if image is cached for performance indicator
  const isImageCached = () => {
    if (!evermark.supabaseImageUrl && !evermark.thumbnailUrl) return false;
    
    const _primaryUrl = variant === 'compact' || variant === 'list' 
      ? evermark.thumbnailUrl || evermark.supabaseImageUrl
      : evermark.supabaseImageUrl || evermark.thumbnailUrl;
      
    // TODO: Replace with simple cache check
    return false; // primaryUrl ? cacheManager.has(primaryUrl) : false;
  };

  // FIXED: Get performance stats for this specific image
  const getImagePerformanceInfo = () => {
    if (!showPerformanceInfo) return null;
    
    // TODO: Replace with simple performance tracking
    const stats = { totalLoads: 0, totalFailed: 0, averageLoadTime: 0, cacheHitRate: 0 }; // performanceMonitor.getStats();
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


  // List variant layout
  if (variant === 'list') {
    return (
      <>
        <div 
          className={`${getVariantClasses()} ${className}`}
          onClick={handleClick}
        >
          {/* FIXED: Responsive Image Component with dynamic borders */}
          {showImage && (
            <div className="relative overflow-hidden rounded-lg w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
              <ResponsiveEvermarkImage
                tokenId={evermark.tokenId}
                ipfsHash={evermark.ipfsHash}
                originalUrl={evermark.supabaseImageUrl}
                variant="list"
                maintainContainer={true}
                detectAspectRatio={true}
                onLoad={() => {
                  if (showPerformanceInfo) {
                    console.log(`✅ List image loaded for evermark #${evermark.tokenId}`);
                  }
                }}
                onError={(error) => {
                  console.warn(`❌ List image error for #${evermark.tokenId}:`, error);
                }}
              />
              <PerformanceIndicator />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
            <div>
              <h3 className={cn(
                getTitleClasses(),
                "group-hover:text-purple-400 transition-colors mb-1 line-clamp-2"
              )}>
                {evermark.title}
              </h3>
              
              <div className={cn(
                "flex items-center gap-3 text-sm mb-2",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                <div className="flex items-center min-w-0 flex-1">
                  <User className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="truncate">{evermark.author}</span>
                  {evermark.verified && (
                    <button
                      onClick={handleVerificationClick}
                      className="ml-1 flex-shrink-0 hover:scale-110 transition-transform"
                    >
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    </button>
                  )}
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
                      className={cn(
                        "text-xs px-2 py-1 rounded border",
                        isDark 
                          ? "bg-purple-900/30 text-purple-300 border-purple-500/30" 
                          : "bg-purple-100 text-purple-700 border-purple-300"
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                  {evermark.tags.length > 3 && (
                    <span className={cn(
                      "text-xs",
                      isDark ? "text-gray-500" : "text-gray-600"
                    )}>
                      +{evermark.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className={cn(
              "flex items-center justify-between text-xs",
              isDark ? "text-gray-500" : "text-gray-600"
            )}>
              <div className="flex items-center gap-3">
                <span>{Formatters.formatRelativeTime(evermark.createdAt)}</span>
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
        
        {/* Attestation Popup */}
        <AttestationPopup 
          evermark={evermark}
          isOpen={showAttestationPopup}
          onClose={() => setShowAttestationPopup(false)}
        />
      </>
    );
  }

  // Standard card layout (vertical)
  return (
    <div 
      className={`${getVariantClasses()} ${className} flex flex-col h-full`}
      onClick={handleClick}
    >
      {/* FIXED: Responsive Image Component with dynamic borders for book covers */}
      {showImage && (
        <div className={`relative overflow-hidden rounded-t-xl ${variant === 'hero' ? 'h-64 sm:h-80' : 'h-48 sm:h-56'}`}>
          <ResponsiveEvermarkImage
            tokenId={evermark.tokenId}
            ipfsHash={evermark.ipfsHash}
            originalUrl={evermark.supabaseImageUrl}
            variant={variant}
            maintainContainer={true}
            detectAspectRatio={true}
            onLoad={() => {
              if (showPerformanceInfo) {
                console.log(`✅ Card image loaded for evermark #${evermark.tokenId}`);
              }
            }}
            onError={(error) => {
              console.warn(`❌ Card image error for #${evermark.tokenId}:`, error);
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
            {evermark.verified && (
              <button
                onClick={handleVerificationClick}
                className="ml-1 flex-shrink-0 hover:scale-110 transition-transform"
              >
                <CheckCircle className="h-4 w-4 text-green-400" />
              </button>
            )}
          </div>
          <div className="flex items-center flex-shrink-0 ml-2">
            <Calendar className="h-4 w-4 mr-1" />
            <span className="text-xs">
              {Formatters.formatRelativeTime(evermark.createdAt)}
            </span>
          </div>
        </div>

        {showDescription && evermark.description && variant !== 'compact' && (
          <p className="text-sm text-gray-300 line-clamp-3 flex-1 mb-4">
            {evermark.description}
          </p>
        )}

        {evermark.tags && evermark.tags.length > 0 && (
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
      
      {/* Attestation Popup */}
      <AttestationPopup 
        evermark={evermark}
        isOpen={showAttestationPopup}
        onClose={() => setShowAttestationPopup(false)}
      />
    </div>
  );
}