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
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EvermarkImage } from '@ipfsnut/evermark-sdk-react';
import { type Evermark } from '../types';

interface EvermarkCardProps {
  evermark: Evermark;
  variant?: 'standard' | 'compact' | 'list' | 'hero';
  onClick?: (evermark: Evermark) => void;
  showVotes?: boolean;
  showViews?: boolean;
  showDescription?: boolean;
  showImage?: boolean;
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

  // SDK configuration for image loading
  const getSDKConfig = () => {
    const baseConfig = {
      resolution: {
        preferThumbnail: variant === 'compact' || variant === 'list',
        maxSources: 3,
        includeIpfs: true,
        mobileOptimization: variant === 'compact' || variant === 'list'
      },
      loaderOptions: {
        debug: process.env.NODE_ENV === 'development',
        timeout: variant === 'list' ? 5000 : 8000,
        maxRetries: 2,
        useCORS: true
      }
    };

    return baseConfig;
  };

  // List variant layout
  if (variant === 'list') {
    return (
      <div 
        className={`${getVariantClasses()} ${className}`}
        onClick={handleClick}
      >
        {/* Enhanced SDK Image Component */}
        {showImage && (
          <EvermarkImage
            evermark={evermark}
            variant="list"
            showPlaceholder={true}
            onImageLoad={() => console.log('SDK: List image loaded successfully')}
            onImageError={(error) => console.warn('SDK: List image error:', error)}
            {...getSDKConfig()}
          />
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
      {/* Enhanced SDK Image Component */}
      {showImage && (
        <EvermarkImage
          evermark={evermark}
          variant={variant}
          showPlaceholder={true}
          onImageLoad={() => console.log('SDK: Card image loaded successfully')}
          onImageError={(error) => console.warn('SDK: Card image error:', error)}
          {...getSDKConfig()}
        />
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
          </div>

          {evermark.sourceUrl && (
            <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}