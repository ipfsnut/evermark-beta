// src/providers/AppContext.tsx - Global state management following clean architecture
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useFarcasterUser } from '@/lib/farcaster';
import { useWalletConnection } from './WalletProvider';

// Global UI state interface
interface UIState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
}

// User authentication state
interface AuthState {
  isAuthenticated: boolean;
  user: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
    address?: string;
    verifiedAddresses: string[];
  } | null;
  authMethod: 'farcaster' | 'wallet' | null;
}

// Notification interface
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Combined app state
interface AppState {
  ui: UIState;
  auth: AuthState;
}

// Action types for state updates
type AppAction =
  | { type: 'SET_THEME'; payload: 'dark' | 'light' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTH'; payload: Partial<AuthState> }
  | { type: 'ADD_NOTIFICATION'; payload: Omit<Notification, 'id' | 'timestamp' | 'read'> }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'CLEAR_NOTIFICATIONS' };

// Initial state
const initialState: AppState = {
  ui: {
    theme: 'dark', // Default to dark theme for cyber aesthetic
    sidebarOpen: false,
    notifications: [],
    isLoading: false,
    error: null,
  },
  auth: {
    isAuthenticated: false,
    user: null,
    authMethod: null,
  },
};

// State reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_THEME':
      return {
        ...state,
        ui: { ...state.ui, theme: action.payload },
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
      };

    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload },
      };

    case 'SET_ERROR':
      return {
        ...state,
        ui: { ...state.ui, error: action.payload },
      };

    case 'SET_AUTH':
      return {
        ...state,
        auth: { ...state.auth, ...action.payload },
      };

    case 'ADD_NOTIFICATION':
      const newNotification: Notification = {
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        read: false,
      };
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [newNotification, ...state.ui.notifications],
        },
      };

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.map(n =>
            n.id === action.payload ? { ...n, read: true } : n
          ),
        },
      };

    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        ui: { ...state.ui, notifications: [] },
      };

    default:
      return state;
  }
}

// Context interface
interface AppContextType {
  state: AppState;
  
  // UI actions
  setTheme: (theme: 'dark' | 'light') => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  
  // Auth helpers
  isAuthenticated: boolean;
  requireAuth: () => Promise<boolean>;
  
  // Wallet helpers
  isWalletConnected: boolean;
  requireWallet: () => Promise<boolean>;
}

// Create context
const AppContext = createContext<AppContextType | null>(null);

// Provider component
interface AppContextProviderProps {
  children: React.ReactNode;
}

export function AppContextProvider({ children }: AppContextProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Integrate with Farcaster and Wallet providers
  const farcaster = useFarcasterUser();
  const wallet = useWalletConnection();

  // Sync authentication state when providers change
  useEffect(() => {
    const updateAuthState = () => {
      let authState: Partial<AuthState> = {
        isAuthenticated: false,
        user: null,
        authMethod: null,
      };

      // Priority: Farcaster authentication first
      if (farcaster.isAuthenticated && farcaster.user) {
        authState = {
          isAuthenticated: true,
          authMethod: 'farcaster',
          user: {
            fid: farcaster.user.fid,
            username: farcaster.user.username,
            displayName: farcaster.user.displayName,
            pfpUrl: farcaster.user.pfpUrl,
            address: farcaster.getPrimaryAddress() || undefined,
            verifiedAddresses: farcaster.getVerifiedAddresses(),
          },
        };
      }
      // Fallback: Wallet-only authentication
      else if (wallet.isConnected && wallet.address) {
        authState = {
          isAuthenticated: true,
          authMethod: 'wallet',
          user: {
            address: wallet.address,
            verifiedAddresses: [wallet.address],
          },
        };
      }

      dispatch({ type: 'SET_AUTH', payload: authState });
    };

    updateAuthState();
  }, [
    farcaster.isAuthenticated,
    farcaster.user,
    wallet.isConnected,
    wallet.address,
    farcaster.getPrimaryAddress,
    farcaster.getVerifiedAddresses
  ]);

  // UI action creators
  const setTheme = useCallback((theme: 'dark' | 'light') => {
    dispatch({ type: 'SET_THEME', payload: theme });
    // Persist theme preference
    localStorage.setItem('evermark-theme', theme);
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  // Notification action creators
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
  }, []);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, []);

  // Authentication helpers
  const requireAuth = useCallback(async (): Promise<boolean> => {
    if (state.auth.isAuthenticated) {
      return true;
    }

    // Try Farcaster authentication first
    if (farcaster.isInFarcaster && !farcaster.isAuthenticated) {
      addNotification({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please authenticate with Farcaster to continue',
      });
      return false;
    }

    // Try wallet authentication
    const walletResult = await wallet.requireConnection();
    if (!walletResult.success) {
      addNotification({
        type: 'error',
        title: 'Connection Required',
        message: walletResult.error || 'Please connect your wallet to continue',
      });
      return false;
    }

    return true;
  }, [state.auth.isAuthenticated, farcaster, wallet, addNotification]);

  const requireWallet = useCallback(async (): Promise<boolean> => {
    const walletResult = await wallet.requireConnection();
    if (!walletResult.success) {
      addNotification({
        type: 'error',
        title: 'Wallet Required',
        message: walletResult.error || 'Please connect your wallet for this action',
      });
      return false;
    }
    return true;
  }, [wallet, addNotification]);

  // Load theme preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('evermark-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  // Context value
  const contextValue: AppContextType = {
    state,
    setTheme,
    toggleSidebar,
    setLoading,
    setError,
    addNotification,
    markNotificationRead,
    clearNotifications,
    isAuthenticated: state.auth.isAuthenticated,
    requireAuth,
    isWalletConnected: wallet.isConnected,
    requireWallet,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook for accessing app context
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}

// Convenience hooks for specific functionality
export function useAppState() {
  const { state } = useAppContext();
  return state;
}

export function useAppAuth() {
  const { state, isAuthenticated, requireAuth, isWalletConnected, requireWallet } = useAppContext();
  return {
    isAuthenticated,
    user: state.auth.user,
    authMethod: state.auth.authMethod,
    requireAuth,
    isWalletConnected,
    requireWallet,
  };
}

export function useAppUI() {
  const { 
    state, 
    setTheme, 
    toggleSidebar, 
    setLoading, 
    setError,
    addNotification,
    markNotificationRead,
    clearNotifications 
  } = useAppContext();
  
  return {
    theme: state.ui.theme,
    sidebarOpen: state.ui.sidebarOpen,
    notifications: state.ui.notifications,
    isLoading: state.ui.isLoading,
    error: state.ui.error,
    setTheme,
    toggleSidebar,
    setLoading,
    setError,
    addNotification,
    markNotificationRead,
    clearNotifications,
  };
}