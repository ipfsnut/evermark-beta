// src/providers/AppContext.tsx
// Enhanced App Context with better error handling

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';

interface User {
  address?: string;
  displayName?: string;
  username?: string;
  avatar?: string;
}

interface AppContextType {
  // Authentication state
  isAuthenticated: boolean;
  user: User | null;
  
  // Wallet state
  isConnecting: boolean;
  connectionError: string | null;
  
  // Actions
  requireAuth: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  clearError: () => void;
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

  // Update user when account changes
  useEffect(() => {
    if (account?.address) {
      console.log('👤 Account connected:', account.address);
      
      setUser({
        address: account.address,
        displayName: account.address.slice(0, 6) + '...' + account.address.slice(-4),
        username: account.address.slice(0, 8),
        avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${account.address}`
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

  const value: AppContextType = {
    // Authentication state
    isAuthenticated: !!account?.address,
    user,
    
    // Wallet state  
    isConnecting,
    connectionError,
    
    // Actions
    requireAuth,
    disconnect,
    clearError
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

