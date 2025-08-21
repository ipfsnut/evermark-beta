// src/providers/AppContext.tsx
// Enhanced App Context that consumes IntegratedUserProvider

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { useIntegratedUser } from './IntegratedUserProvider'; // NEW: Import integrated user
import { NotificationService } from '../services/NotificationService';

interface User {
  address?: string;
  displayName?: string;
  username?: string;
  avatar?: string;
  pfpUrl?: string;
  ensName?: string;
  // NEW: Enhanced user fields
  farcasterFid?: number;
  farcasterUsername?: string;
  identityScore?: number;
  authType?: 'farcaster' | 'ens' | 'wallet' | 'hybrid';
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'share' | 'vote';
  title: string;
  message?: string;
  timestamp: number;
  read?: boolean;
  evermarkId?: string;
  userAddress?: string;
  metadata?: any;
}

type Theme = 'dark' | 'light' | 'system';

interface AppContextType {
  // Authentication state - ENHANCED with integrated user
  isAuthenticated: boolean;
  user: User | null;
  
  // NEW: Identity information
  identityScore: number;
  primaryIdentity: 'farcaster' | 'ens' | 'wallet' | null;
  hasMultipleIdentities: boolean;
  
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
  
  // NEW: Get integrated user data
  const {
    user: integratedUser,
    isLoading: integratedUserLoading,
    hasWallet,
    hasFarcaster,
    hasENS,
    isConnected,
    getPrimaryIdentity,
    getIdentityScore,
    getDisplayName,
    getAvatar,
    getPrimaryAddress
  } = useIntegratedUser();
  
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

  // NEW: Update user from integrated user provider
  useEffect(() => {
    if (integratedUser) {
      console.log('👤 Integrated user updated:', {
        displayName: getDisplayName(),
        source: integratedUser.source,
        identityScore: getIdentityScore()
      });
      
      setUser({
        address: getPrimaryAddress(),
        displayName: getDisplayName(),
        username: integratedUser.farcaster?.username,
        avatar: getAvatar(),
        pfpUrl: getAvatar(), // Alias for backward compatibility
        ensName: integratedUser.ens?.name,
        // Enhanced fields
        farcasterFid: integratedUser.farcaster?.fid,
        farcasterUsername: integratedUser.farcaster?.username,
        identityScore: getIdentityScore(),
        authType: integratedUser.source
      });
      
      setConnectionError(null);
    } else if (!integratedUserLoading) {
      // Don't fallback to any wallet automatically - require explicit connection
      console.log('👤 No authenticated user - wallet connection required');
      setUser(null);
      
      // If there's a connected account but no integrated user, it means auth failed
      if (account?.address) {
        console.warn('⚠️ Account detected but authentication failed. User must reconnect wallet.');
        setConnectionError('Wallet connection failed. Please connect your wallet to continue.');
      }
    }
  }, [integratedUser, account, integratedUserLoading, getDisplayName, getAvatar, getPrimaryAddress, getIdentityScore]);

  // Monitor wallet connection state
  useEffect(() => {
    if (wallet) {
      console.log('💼 Wallet connected:', wallet.id);
    } else {
      console.log('💼 No wallet connected');
    }
  }, [wallet]);

  const requireAuth = async (): Promise<boolean> => {
    // Check if user is properly authenticated through IntegratedUserProvider
    if (isConnected && user) {
      return true;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Clear error message - user must connect wallet explicitly
      setConnectionError('Please connect your wallet to continue. Click the "Connect Wallet" button.');
      return false;
    } catch (error) {
      console.error('Authentication check failed:', error);
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

  // Initialize notification service
  useEffect(() => {
    NotificationService.initialize(addNotification);
    
    // Add test notifications in development
    if (import.meta.env.DEV) {
      // Trigger test notifications after 3 seconds to demo the system
      setTimeout(() => {
        NotificationService.triggerTestNotifications();
      }, 3000);
    }
  }, []);

  // NEW: Enhanced identity information
  const identityScore = getIdentityScore();
  const primaryIdentity = getPrimaryIdentity();
  const hasMultipleIdentities = (hasWallet && hasFarcaster) || (hasWallet && hasENS) || (hasFarcaster && hasENS);

  const value: AppContextType = {
    // Authentication state - ENHANCED
    isAuthenticated: isConnected,
    user,
    
    // NEW: Identity information
    identityScore,
    primaryIdentity,
    hasMultipleIdentities,
    
    // Wallet state  
    isConnecting: isConnecting || integratedUserLoading,
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