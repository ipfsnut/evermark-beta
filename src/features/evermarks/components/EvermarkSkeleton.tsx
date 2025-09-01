import React from 'react';
import { useThemeClasses } from '@/providers/ThemeProvider';

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
  const themeClasses = useThemeClasses();
  const getSkeletonClasses = () => {
    const baseClasses = `animate-pulse ${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-xl overflow-hidden`;
    
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
        return `h-48 ${themeClasses.bg.tertiary}`;
      case 'compact':
        return `h-24 ${themeClasses.bg.tertiary}`;
      case 'list':
        return `w-24 h-24 ${themeClasses.bg.tertiary} flex-shrink-0`;
      default:
        return `h-40 ${themeClasses.bg.tertiary}`;
    }
  };

  const SingleSkeleton = () => (
    <div className={getSkeletonClasses()}>
      {/* Image skeleton */}
      <div className={getImageSkeletonClasses()} />
      
      {/* Content skeleton */}
      <div className={`p-4 space-y-3 ${variant === 'list' ? 'flex-1' : ''}`}>
        {/* Title */}
        <div className={`h-4 ${themeClasses.bg.tertiary} rounded w-3/4`} />
        
        {/* Author and date */}
        <div className="flex justify-between">
          <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-1/3`} />
          <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-1/4`} />
        </div>
        
        {/* Description (not for compact) */}
        {variant !== 'compact' && variant !== 'list' && (
          <div className="space-y-2">
            <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-full`} />
            <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-2/3`} />
          </div>
        )}
        
        {/* Tags */}
        <div className="flex space-x-2">
          <div className={`h-6 ${themeClasses.bg.tertiary} rounded-full w-16`} />
          <div className={`h-6 ${themeClasses.bg.tertiary} rounded-full w-20`} />
          {variant !== 'compact' && (
            <div className={`h-6 ${themeClasses.bg.tertiary} rounded-full w-14`} />
          )}
        </div>
        
        {/* Stats */}
        <div className={`flex justify-between items-center pt-2 border-t ${themeClasses.border.primary}`}>
          <div className="flex space-x-3">
            <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-12`} />
            <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-10`} />
          </div>
          <div className={`h-3 ${themeClasses.bg.tertiary} rounded w-8`} />
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
