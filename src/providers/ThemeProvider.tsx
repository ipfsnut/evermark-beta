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
      metaThemeColor.setAttribute('content', newTheme === 'dark' ? '#0a0a0a' : '#fefce8');
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
  const { isDark, isLight } = useTheme();
  
  return {
    // Background classes - subtle dull yellow light theme colors
    bg: {
      primary: isDark ? 'bg-black' : 'bg-yellow-50',
      secondary: isDark ? 'bg-gray-900' : 'bg-yellow-25',
      tertiary: isDark ? 'bg-gray-800' : 'bg-yellow-100/50',
      card: isDark ? 'bg-gray-900' : 'bg-white/90',
      hover: isDark ? 'hover:bg-gray-800' : 'hover:bg-yellow-100'
    },
    
    // Text classes
    text: {
      primary: isDark ? 'text-white' : 'text-gray-900',
      secondary: isDark ? 'text-gray-300' : 'text-gray-700',
      muted: isDark ? 'text-gray-400' : 'text-gray-500',
      inverse: isDark ? 'text-gray-900' : 'text-white'
    },
    
    // Border classes
    border: {
      primary: isDark ? 'border-gray-700' : 'border-gray-200',
      secondary: isDark ? 'border-gray-600' : 'border-gray-300',
      hover: isDark ? 'hover:border-gray-600' : 'hover:border-gray-300'
    },
    
    // Accent colors remain the same (cyan, purple, etc.)
    accent: {
      primary: 'text-cyan-400',
      secondary: 'text-purple-400',
      success: 'text-green-400',
      warning: 'text-yellow-400',
      error: 'text-red-400'
    }
  };
}