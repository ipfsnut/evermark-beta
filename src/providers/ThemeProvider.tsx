// src/providers/ThemeProvider.tsx - Dark/Light mode theme management
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('evermark-theme');
      if (stored === 'dark' || stored === 'light') {
        return stored as Theme;
      }
      
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    
    // Default to dark theme for Evermark
    return 'dark';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('evermark-theme', newTheme);
    
    // Update document class for Tailwind dark mode
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    
    // Update meta theme-color for mobile browsers and Farcaster frames
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', newTheme === 'dark' ? '#0a0a0a' : '#1e293b');
    }
    
    // Also update viewport meta for better mobile experience
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Apply theme on mount and when theme changes
  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a preference
      const stored = localStorage.getItem('evermark-theme');
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const value: ThemeContextType = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook to get theme-aware classes
export function useThemeClasses() {
  const { isDark, isLight: _isLight } = useTheme();
  
  return {
    // Background classes - card-focused design
    bg: {
      primary: isDark ? 'bg-black' : 'bg-white',
      secondary: isDark ? 'bg-gray-900' : 'bg-gray-50',
      tertiary: isDark ? 'bg-gray-800' : 'bg-gray-100',
      card: isDark ? 'bg-gray-900' : 'bg-white',
      hover: isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50',
      accent: isDark ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10' : 'bg-gradient-to-r from-evermark-primary-50 to-evermark-secondary-50'
    },
    
    // Text classes - optimized for card-based design
    text: {
      primary: isDark ? 'text-white' : 'text-gray-900',
      secondary: isDark ? 'text-gray-300' : 'text-gray-600',
      muted: isDark ? 'text-gray-400' : 'text-gray-500',
      inverse: isDark ? 'text-gray-900' : 'text-white',
      accent: isDark ? 'text-cyan-400' : 'text-evermark-primary-600'
    },
    
    // Border classes
    border: {
      primary: isDark ? 'border-gray-700' : 'border-gray-200',
      secondary: isDark ? 'border-gray-600' : 'border-gray-300',
      hover: isDark ? 'hover:border-gray-600' : 'hover:border-evermark-primary-300',
      focus: isDark ? 'focus:border-cyan-400' : 'focus:border-evermark-primary-500'
    },
    
    // Brand accent colors (updated for light mode)
    accent: {
      primary: isDark ? 'text-cyan-400' : 'text-evermark-primary-600',
      secondary: isDark ? 'text-purple-400' : 'text-evermark-secondary-600',
      success: isDark ? 'text-green-400' : 'text-green-600',
      warning: isDark ? 'text-yellow-400' : 'text-amber-600',
      error: isDark ? 'text-red-400' : 'text-red-600'
    },
    
    // Button classes
    button: {
      primary: isDark 
        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 shadow-lg shadow-cyan-500/25' 
        : 'bg-evermark-primary-500 text-white hover:bg-evermark-primary-600 shadow-sm hover:shadow-md',
      secondary: isDark
        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-gray-400',
      ghost: isDark
        ? 'bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white'
        : 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    },
    
    // Card shadows
    shadow: {
      sm: isDark ? 'shadow-sm shadow-black/50' : 'shadow-sm',
      md: isDark ? 'shadow-md shadow-black/50' : 'shadow-md',
      lg: isDark ? 'shadow-lg shadow-black/50' : 'shadow-lg',
      glow: isDark ? 'shadow-cyan-500/20' : 'shadow-evermark-primary-500/20'
    }
  };
}