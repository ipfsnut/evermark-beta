// src/providers/AppContext.tsx
// Enhanced App Context with better error handling and UI state

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';

interface User {
  address?: string;
  displayName?: string;
  username?: string;
  avatar?: string;
  pfpUrl?: string;
  ensName?: string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
  read?: boolean;
}

type Theme = 'dark' | 'light' | 'system';

interface AppContextType {
  // Authentication state
  isAuthenticated: boolean;
  user: User | null;
  
  // Wallet state
  isConnecting: boolean;
  connectionError: string | null;
  
  // UI state
  isSidebarOpen: boolean;
  sidebarOpen: boolean; // Alias for backwards compatibility
  isMobile: boolean;
  theme: Theme;
  isDarkMode: boolean;
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  requireAuth: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  
  // UI actions
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  
  // Theme actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  
  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppAuth = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppAuth must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => {
    // Get theme from localStorage or default to 'dark'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app-theme') as Theme;
      return saved || 'dark';
    }
    return 'dark';
  });
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Theme management
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const updateTheme = () => {
      let shouldBeDark = false;

      if (theme === 'dark') {
        shouldBeDark = true;
      } else if (theme === 'light') {
        shouldBeDark = false;
      } else { // system
        shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      setIsDarkMode(shouldBeDark);
      
      // Apply theme to document
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }

      // Save to localStorage
      localStorage.setItem('app-theme', theme);
    };

    updateTheme();

    // Listen for system theme changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
    return
  }, [theme]);

  // Update user when account changes
  useEffect(() => {
    if (account?.address) {
      console.log('👤 Account connected:', account.address);
      
      setUser({
        address: account.address,
        displayName: account.address.slice(0, 6) + '...' + account.address.slice(-4),
        username: account.address.slice(0, 8),
        avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${account.address}`,
        pfpUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${account.address}`, // Same as avatar for now
      });
      
      setConnectionError(null);
    } else {
      console.log('👤 No account connected');
      setUser(null);
    }
  }, [account]);

  // Monitor wallet connection state
  useEffect(() => {
    if (wallet) {
      console.log('💼 Wallet connected:', wallet.id);
    } else {
      console.log('💼 No wallet connected');
    }
  }, [wallet]);

  const requireAuth = async (): Promise<boolean> => {
    if (account?.address) {
      return true;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // If no wallet is connected, user needs to connect manually
      if (!wallet) {
        setConnectionError('Please connect your wallet to continue');
        return false;
      }

      // Wait a bit to see if account becomes available
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (account?.address) {
        return true;
      }
      
      setConnectionError('Failed to connect wallet. Please try again.');
      return false;
    } catch (error) {
      console.error('Authentication failed:', error);
      setConnectionError(
        error instanceof Error ? error.message : 'Authentication failed'
      );
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      if (wallet) {
        await wallet.disconnect();
      }
      setUser(null);
      setConnectionError(null);
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const clearError = () => {
    setConnectionError(null);
  };

  // UI actions
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const openSidebar = () => {
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // Notification actions
  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-remove after 5 seconds for success/info notifications
    if (notification.type === 'success' || notification.type === 'info') {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 5000);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Theme actions
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('system');
    } else {
      setTheme('dark');
    }
  };

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  const value: AppContextType = {
    // Authentication state
    isAuthenticated: !!account?.address,
    user,
    
    // Wallet state  
    isConnecting,
    connectionError,
    
    // UI state
    isSidebarOpen,
    sidebarOpen: isSidebarOpen, // Alias for backwards compatibility
    isMobile,
    theme,
    isDarkMode,
    
    // Notifications
    notifications,
    unreadCount,
    
    // Actions
    requireAuth,
    disconnect,
    clearError,
    
    // UI actions
    toggleSidebar,
    openSidebar,
    closeSidebar,
    
    // Theme actions
    setTheme,
    toggleTheme,
    
    // Notification actions
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Export aliases for backwards compatibility
export const AppContextProvider = AppProvider;
export const useAppUI = useAppAuth;