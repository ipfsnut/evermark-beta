// src/providers/WalletProvider.tsx - Unified wallet state for all contexts
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useActiveAccount } from 'thirdweb/react';
import { useFarcasterDetection } from '../hooks/useFarcasterDetection';
import { authLogger } from '../utils/logger';

interface WalletContextType {
  // Unified wallet state
  address: string | null;
  isConnected: boolean;
  context: 'farcaster' | 'browser' | 'pwa';
  
  // Connection methods (context-specific)
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
  
  // Debug info
  connectionSource: 'neynar' | 'thirdweb' | 'miniapp-wagmi' | 'farcaster-sdk' | null;
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

// Farcaster-specific provider with wallet connection actions
function FarcasterWalletProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const miniAppAccount = useAccount(); // From miniapp-wagmi-connector
  const [manualAddress, setManualAddress] = useState<string | null>(null);

  // Try to get wallet from Farcaster SDK if wagmi fails
  useEffect(() => {
    let mounted = true;
    
    const getWalletFromSDK = async () => {
      if (miniAppAccount?.address || manualAddress) return; // Already connected
      
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Try to get Ethereum provider from SDK with retry for Android
        let ethProvider;
        let retries = 3;
        
        while (retries > 0 && !ethProvider) {
          try {
            ethProvider = await sdk.wallet.getEthereumProvider();
            if (!ethProvider) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              retries--;
            }
          } catch (e) {
            authLogger.debug('Retrying provider connection...', { retries });
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
          }
        }
        
        if (ethProvider && mounted) {
          // Try to get accounts from the provider
          try {
            // Request accounts with explicit chain ID for Android compatibility
            const accounts = await ethProvider.request({ 
              method: 'eth_requestAccounts',
              params: []
            });
            
            if (!accounts || accounts.length === 0) {
              // Fallback to eth_accounts
              const fallbackAccounts = await ethProvider.request({ method: 'eth_accounts' });
              if (fallbackAccounts && fallbackAccounts.length > 0) {
                setManualAddress(fallbackAccounts[0]);
                authLogger.info('Got wallet address from Farcaster SDK (fallback)', { address: fallbackAccounts[0] });
              }
            } else {
              setManualAddress(accounts[0]);
              authLogger.info('Got wallet address from Farcaster SDK', { address: accounts[0] });
            }
          } catch (accountError) {
            authLogger.warn('Failed to get accounts from Farcaster provider', { error: accountError });
          }
        }
      } catch (error) {
        authLogger.warn('Failed to get wallet provider from Farcaster SDK', { error });
      }
    };

    // Attempt to get wallet after a delay to let miniapp initialize
    // Longer delay for Android devices
    const isAndroid = /android/i.test(navigator.userAgent);
    const delay = isAndroid ? 3000 : 2000;
    const timeout = setTimeout(getWalletFromSDK, delay);
    return () => { 
      clearTimeout(timeout);
      mounted = false; 
    };
  }, [miniAppAccount?.address, manualAddress]);

  // Use wagmi address first, fallback to manual address
  const walletAddress = miniAppAccount?.address ?? manualAddress ?? null;
  const isConnected = !!walletAddress;
  const connectionSource = miniAppAccount?.address ? 'miniapp-wagmi' : 
                          manualAddress ? 'farcaster-sdk' : null;

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    authLogger.info('Farcaster context - connection handled by Mini App');
    return { success: true };
  };

  const disconnect = async (): Promise<void> => {
    authLogger.info('Disconnect not supported in Farcaster context');
  };

  // Debug logging
  useEffect(() => {
    authLogger.debug('Farcaster Wallet Provider State', {
      context: 'farcaster',
      address: walletAddress,
      isConnected,
      connectionSource,
      miniAppAccount: miniAppAccount ? 'present' : 'none',
      wagmiAddress: miniAppAccount?.address || 'none',
      manualAddress: manualAddress || 'none'
    });
  }, [walletAddress, isConnected, connectionSource, miniAppAccount, manualAddress]);

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
    authLogger.info('Browser/PWA context - use ConnectButton component');
    return { success: false, error: 'Use ConnectButton component for manual connection' };
  };

  const disconnect = async (): Promise<void> => {
    authLogger.info('Disconnect requested - handled by ConnectButton component');
  };

  // Debug logging
  useEffect(() => {
    authLogger.debug('Browser/PWA Wallet Provider State', {
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