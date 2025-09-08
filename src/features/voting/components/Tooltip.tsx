import type { ReactNode } from 'react';
import React from 'react';
import { cn } from '@/utils/responsive';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ 
  content, 
  children, 
  position = 'top',
  className = '' 
}: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800'
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div className={cn(
        "absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200",
        positionClasses[position],
        className
      )}>
        <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
          {content}
        </div>
        <div className={cn(
          "absolute w-0 h-0 border-4 border-transparent",
          arrowClasses[position]
        )} />
      </div>
    </div>
  );
}