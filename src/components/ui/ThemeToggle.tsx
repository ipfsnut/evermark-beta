// src/components/ui/ThemeToggle.tsx - Dark/Light mode toggle component
import React from 'react';
import { SunIcon, MoonIcon } from 'lucide-react';
import { useTheme } from '../../providers/ThemeProvider';
import { cn } from '../../utils/responsive';

interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ 
  size = 'md', 
  variant = 'icon',
  showLabel = false,
  className 
}: ThemeToggleProps) {
  const { theme: _theme, toggleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-3'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const buttonClasses = cn(
    'relative inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50',
    isDark 
      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600' 
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 border border-gray-200 hover:border-gray-300',
    sizeClasses[size],
    className
  );

  if (variant === 'button' && showLabel) {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50',
          isDark 
            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-600' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 border border-gray-200 hover:border-gray-300',
          className
        )}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <span className="relative">
          {isDark ? (
            <SunIcon className={iconSizeClasses[size]} />
          ) : (
            <MoonIcon className={iconSizeClasses[size]} />
          )}
        </span>
        <span className="text-sm font-medium">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={buttonClasses}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="relative">
        {isDark ? (
          <>
            <SunIcon className={cn(iconSizeClasses[size], 'transition-transform duration-200')} />
          </>
        ) : (
          <>
            <MoonIcon className={cn(iconSizeClasses[size], 'transition-transform duration-200')} />
          </>
        )}
      </span>
    </button>
  );
}

// Animated version with smooth transitions
export function AnimatedThemeToggle({ 
  size = 'md', 
  className 
}: Pick<ThemeToggleProps, 'size' | 'className'>) {
  const { toggleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative overflow-hidden rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-50 group',
        isDark 
          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 hover:border-gray-600' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 hover:border-gray-300',
        sizeClasses[size],
        className
      )}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Sun icon */}
        <SunIcon 
          className={cn(
            iconSizeClasses[size],
            'absolute transition-all duration-300 text-yellow-400',
            isDark 
              ? 'opacity-0 scale-0 rotate-90' 
              : 'opacity-100 scale-100 rotate-0'
          )}
        />
        
        {/* Moon icon */}
        <MoonIcon 
          className={cn(
            iconSizeClasses[size],
            'absolute transition-all duration-300 text-blue-400',
            isDark 
              ? 'opacity-100 scale-100 rotate-0' 
              : 'opacity-0 scale-0 -rotate-90'
          )}
        />
      </div>
      
      {/* Subtle glow effect */}
      <div className={cn(
        'absolute inset-0 rounded-lg transition-opacity duration-300 pointer-events-none',
        isDark 
          ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100' 
          : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100'
      )} />
    </button>
  );
}