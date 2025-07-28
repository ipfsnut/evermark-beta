import React from 'react';

interface EvermarkSkeletonProps {
  variant?: 'hero' | 'standard' | 'compact' | 'list';
  count?: number;
  className?: string;
}

export const EvermarkSkeleton: React.FC<EvermarkSkeletonProps> = ({
  variant = 'standard',
  count = 1,
  className = ''
}) => {
  const getSkeletonClasses = () => {
    const baseClasses = 'animate-pulse bg-gray-800 border border-gray-700 rounded-xl overflow-hidden';
    
    switch (variant) {
      case 'hero':
        return `${baseClasses} h-80`;
      case 'compact':
        return `${baseClasses} h-40`;
      case 'list':
        return `${baseClasses} flex flex-row h-24`;
      default:
        return `${baseClasses} h-64`;
    }
  };

  const getImageSkeletonClasses = () => {
    switch (variant) {
      case 'hero':
        return 'h-48 bg-gray-700';
      case 'compact':
        return 'h-24 bg-gray-700';
      case 'list':
        return 'w-24 h-24 bg-gray-700 flex-shrink-0';
      default:
        return 'h-40 bg-gray-700';
    }
  };

  const SingleSkeleton = () => (
    <div className={getSkeletonClasses()}>
      {/* Image skeleton */}
      <div className={getImageSkeletonClasses()} />
      
      {/* Content skeleton */}
      <div className={`p-4 space-y-3 ${variant === 'list' ? 'flex-1' : ''}`}>
        {/* Title */}
        <div className="h-4 bg-gray-700 rounded w-3/4" />
        
        {/* Author and date */}
        <div className="flex justify-between">
          <div className="h-3 bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-700 rounded w-1/4" />
        </div>
        
        {/* Description (not for compact) */}
        {variant !== 'compact' && variant !== 'list' && (
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-2/3" />
          </div>
        )}
        
        {/* Tags */}
        <div className="flex space-x-2">
          <div className="h-6 bg-gray-700 rounded-full w-16" />
          <div className="h-6 bg-gray-700 rounded-full w-20" />
          {variant !== 'compact' && (
            <div className="h-6 bg-gray-700 rounded-full w-14" />
          )}
        </div>
        
        {/* Stats */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <div className="flex space-x-3">
            <div className="h-3 bg-gray-700 rounded w-12" />
            <div className="h-3 bg-gray-700 rounded w-10" />
          </div>
          <div className="h-3 bg-gray-700 rounded w-8" />
        </div>
      </div>
    </div>
  );

  if (count === 1) {
    return <SingleSkeleton />;
  }

  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <SingleSkeleton key={index} />
      ))}
    </div>
  );
};
