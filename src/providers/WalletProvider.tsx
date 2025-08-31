// src/providers/WalletProvider.tsx - Unified wallet state for all contexts
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useNeynarContext } from '@neynar/react';
import { useAccount } from 'wagmi';
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

export function WalletProvider({ children }: WalletProviderProps) {
  const { isInFarcaster } = useFarcasterDetection();
  
  // Context detection
  const isPWA = typeof window !== 'undefined' && 
    window.matchMedia('(display-mode: standalone)').matches;
  const context = isInFarcaster ? 'farcaster' : isPWA ? 'pwa' : 'browser';

  // Farcaster context: Neynar + Mini App Wagmi
  let neynarAuth: any = null;
  try {
    neynarAuth = isInFarcaster ? useNeynarContext() : null;
  } catch {
    neynarAuth = null;
  }
  
  const miniAppAccount = isInFarcaster ? useAccount() : null; // From miniapp-wagmi-connector
  
  // Browser/PWA context: Thirdweb
  const thirdwebAccount = !isInFarcaster ? useActiveAccount() : null;

  // Unified wallet address (single source per context)
  const walletAddress = 
    // Priority 1: Farcaster - use custody address from Neynar
    (isInFarcaster && neynarAuth?.user?.custody_address) ||
    // Priority 2: Farcaster - fallback to Mini App Wagmi
    (isInFarcaster && miniAppAccount?.address) ||
    // Priority 3: Browser/PWA - use Thirdweb
    (!isInFarcaster && thirdwebAccount?.address) ||
    null;

  const isConnected = !!walletAddress;
  
  // Determine connection source for debugging
  const connectionSource = 
    (isInFarcaster && neynarAuth?.user?.custody_address) ? 'neynar' :
    (isInFarcaster && miniAppAccount?.address) ? 'miniapp-wagmi' :
    (!isInFarcaster && thirdwebAccount?.address) ? 'thirdweb' :
    null;

  // Context-specific connection logic
  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    if (isInFarcaster) {
      // Farcaster: Connection handled by Neynar SIWN + Mini App
      console.log('🎯 Farcaster context - connection handled by Neynar/Mini App');
      return { success: true };
    } else {
      // Browser/PWA: Handled by Thirdweb ConnectButton component
      console.log('🌐 Browser/PWA context - use ConnectButton component');
      return { success: false, error: 'Use ConnectButton component for manual connection' };
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      if (isInFarcaster && neynarAuth) {
        // Neynar disconnect (if available)
        console.log('🎯 Disconnecting Neynar auth');
        // Neynar SDK should handle this
      } else {
        // Thirdweb disconnect
        console.log('🌐 Disconnecting Thirdweb wallet');
        // Thirdweb disconnect handled by useDisconnect hook in components
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('💼 Wallet Provider State:', {
      context,
      address: walletAddress,
      isConnected,
      connectionSource,
      neynarUser: neynarAuth?.user ? 'present' : 'none',
      thirdwebAccount: thirdwebAccount ? 'present' : 'none',
      miniAppAccount: miniAppAccount ? 'present' : 'none'
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