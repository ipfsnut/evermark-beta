// src/features/evermarks/components/EvermarkCard.tsx
// Individual evermark card component

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
  
  // Handle click
  const handleClick = () => {
    onClick?.(evermark);
  };

  // Format view count
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Get content type icon
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

  // Get image status indicator
  const getImageStatusIndicator = () => {
    if (!showImage || evermark.imageStatus === 'processed') return null;

    const statusConfig = {
      processing: { icon: Clock, color: 'text-yellow-400', text: 'Processing' },
      failed: { icon: AlertCircle, color: 'text-red-400', text: 'Failed' },
      none: { icon: AlertCircle, color: 'text-gray-400', text: 'No image' }
    };

    const status = statusConfig[evermark.imageStatus];
    if (!status) return null;

    const IconComponent = status.icon;

    return (
      <div className="absolute bottom-2 left-2 z-10 bg-black/80 text-xs px-2 py-1 rounded flex items-center gap-1 backdrop-blur-sm">
        <IconComponent className="h-3 w-3" />
        <span className={status.color}>{status.text}</span>
      </div>
    );
  };

  // Variant-specific classes
  const getVariantClasses = () => {
    const baseClasses = 'bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden transition-all duration-300 group cursor-pointer hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 backdrop-blur-sm';
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} hover:shadow-xl hover:shadow-purple-500/30 hover:border-purple-400/70`;
      case 'compact':
        return `${baseClasses} hover:border-blue-400/50 hover:shadow-blue-500/20`;
      case 'list':
        return `${baseClasses} flex flex-row hover:border-green-400/50 hover:shadow-green-500/20`;
      default:
        return baseClasses;
    }
  };

  // Image dimensions based on variant
  const getImageClasses = () => {
    switch (variant) {
      case 'hero':
        return 'h-64 sm:h-80';
      case 'compact':
        return 'h-32 sm:h-40';
      case 'list':
        return 'w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0';
      default:
        return 'h-48 sm:h-56';
    }
  };

  // Title classes based on variant
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

  // For list variant, use horizontal layout
  if (variant === 'list') {
    return (
      <div 
        className={`${getVariantClasses()} ${className}`}
        onClick={handleClick}
      >
        {/* Image */}
        {showImage && evermark.image && (
          <div className={`relative ${getImageClasses()}`}>
            <img
              src={evermark.image}
              alt={evermark.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
            {evermark.verified && (
              <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1">
                <CheckCircle className="h-3 w-3 text-white" />
              </div>
            )}
            {getImageStatusIndicator()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
          {/* Title and meta */}
          <div>
            <h3 className={`${getTitleClasses()} group-hover:text-purple-400 transition-colors mb-1`}>
              {evermark.title}
            </h3>
            
            <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
              <div className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <span className="truncate">{evermark.author}</span>
              </div>
              <div className="flex items-center">
                {getContentTypeIcon(evermark.contentType)}
                <span className="ml-1">{evermark.contentType}</span>
              </div>
            </div>

            {/* Tags */}
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

          {/* Stats */}
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
      {/* Image */}
      {showImage && evermark.image && (
        <div className={`relative ${getImageClasses()}`}>
          <img
            src={evermark.image}
            alt={evermark.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Verified badge */}
          {evermark.verified && (
            <div className="absolute top-3 right-3 bg-green-600 rounded-full p-1.5">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          )}

          {/* Content type badge */}
          <div className="absolute top-3 left-3 bg-black/80 text-purple-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 backdrop-blur-sm">
            {getContentTypeIcon(evermark.contentType)}
            <span>{evermark.contentType}</span>
          </div>

          {getImageStatusIndicator()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 sm:p-6">
        {/* Title */}
        <h3 className={`${getTitleClasses()} mb-3 line-clamp-2 group-hover:text-purple-400 transition-colors`}>
          {evermark.title}
        </h3>

        {/* Author and date */}
        <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
          <div className="flex items-center min-w-0">
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

        {/* Description */}
        {showDescription && evermark.description && variant !== 'compact' && (
          <p className="text-sm text-gray-300 line-clamp-3 flex-1 mb-4">
            {evermark.description}
          </p>
        )}

        {/* Tags */}
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

        {/* Footer with stats */}
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

          {/* External link indicator */}
          {evermark.sourceUrl && (
            <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}