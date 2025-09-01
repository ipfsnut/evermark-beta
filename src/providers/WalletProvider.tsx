// src/providers/WalletProvider.tsx - Unified wallet state for all contexts
import React, { createContext, useContext, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useActiveAccount } from 'thirdweb/react';
import { useFarcasterDetection } from '../hooks/useFarcasterDetection';

interface WalletContextType {
  // Unified wallet state
  address: string | null;
  isConnected: boolean;
  context: 'farcaster' | 'browser' | 'pwa';
  
  // Connection methods (context-specific)
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
  
  // Debug info
  connectionSource: 'neynar' | 'thirdweb' | 'miniapp-wagmi' | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps): React.ReactNode {
  const { isInFarcaster } = useFarcasterDetection();
  
  // Context detection
  const isPWA = typeof window !== 'undefined' && 
    window.matchMedia('(display-mode: standalone)').matches;
  const context = isInFarcaster ? 'farcaster' : isPWA ? 'pwa' : 'browser';

  // For Farcaster context, we'll create a separate component that uses wagmi hooks
  if (isInFarcaster) {
    return <FarcasterWalletProvider>{children}</FarcasterWalletProvider>;
  }
  
  // For Browser/PWA context, we'll create a separate component that uses thirdweb hooks
  return <BrowserWalletProvider context={context as 'browser' | 'pwa'}>{children}</BrowserWalletProvider>;
}

// Farcaster-specific provider using wagmi hooks
function FarcasterWalletProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const miniAppAccount = useAccount(); // From miniapp-wagmi-connector

  const walletAddress = miniAppAccount?.address ?? null;
  const isConnected = !!walletAddress;
  const connectionSource = walletAddress ? 'miniapp-wagmi' : null;

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    console.log('🎯 Farcaster context - connection handled by Mini App');
    return { success: true };
  };

  const disconnect = async (): Promise<void> => {
    console.log('Disconnect not supported in Farcaster context');
  };

  // Debug logging
  useEffect(() => {
    console.log('💼 Farcaster Wallet Provider State:', {
      context: 'farcaster',
      address: walletAddress,
      isConnected,
      connectionSource,
      miniAppAccount: miniAppAccount ? 'present' : 'none'
    });
  }, [walletAddress, isConnected, connectionSource]);

  const value: WalletContextType = {
    address: walletAddress,
    isConnected,
    context: 'farcaster',
    connect,
    disconnect,
    connectionSource
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Browser/PWA-specific provider using thirdweb hooks
function BrowserWalletProvider({ children, context }: { children: React.ReactNode; context: 'browser' | 'pwa' }): React.ReactNode {
  // Use thirdweb hook directly since this component only renders in Browser/PWA context
  const thirdwebAccount = useActiveAccount();

  const walletAddress = thirdwebAccount?.address ?? null;
  const isConnected = !!walletAddress;
  const connectionSource = walletAddress ? 'thirdweb' : null;

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    console.log('🌐 Browser/PWA context - use ConnectButton component');
    return { success: false, error: 'Use ConnectButton component for manual connection' };
  };

  const disconnect = async (): Promise<void> => {
    console.log('Disconnect requested - handled by ConnectButton component');
  };

  // Debug logging
  useEffect(() => {
    console.log('💼 Browser/PWA Wallet Provider State:', {
      context,
      address: walletAddress,
      isConnected,
      connectionSource,
      thirdwebAccount: thirdwebAccount ? 'present' : 'none'
    });
  }, [context, walletAddress, isConnected, connectionSource]);

  const value: WalletContextType = {
    address: walletAddress,
    isConnected,
    context,
    connect,
    disconnect,
    connectionSource
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

// Backwards compatibility hook
export function useWalletConnection() {
  const { address, isConnected, connect } = useWallet();
  
  return {
    address,
    isConnected,
    connect,
    isAutoConnecting: false, // Simplified - no auto-connect complexity
    autoConnectFailed: false
  };
}