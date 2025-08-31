// src/providers/WalletProvider.tsx - Updated with Neynar SIWN integration
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useActiveAccount, useConnect, useDisconnect, useActiveWallet } from 'thirdweb/react';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { client } from '../lib/thirdweb';
import { setCurrentWallet, prodLog } from '../utils/debug';
import { useNeynarContext } from '@neynar/react';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
  isAutoConnecting: boolean;
  autoConnectFailed: boolean;
  connect: () => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
  requireConnection: () => Promise<{ success: boolean; error?: string }>;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { connect: thirdwebConnect, isConnecting } = useConnect();
  const { disconnect: thirdwebDisconnect } = useDisconnect();
  
  // Try to use Neynar context (may be undefined if not in Farcaster)
  let neynarAuth;
  try {
    neynarAuth = useNeynarContext();
  } catch {
    neynarAuth = null; // Not in Neynar context
  }
  
  // Use Neynar address if available, fallback to Thirdweb account
  const walletAddress = neynarAuth?.user?.verified_addresses?.eth_addresses?.[0] ||
                       neynarAuth?.user?.custody_address ||
                       account?.address || 
                       null;
  const isConnected = !!walletAddress;
  
  // Track auto-connection state
  const [isAutoConnecting, setIsAutoConnecting] = useState(false);
  const [autoConnectFailed, setAutoConnectFailed] = useState(false);
  const autoConnectAttempted = useRef(false);
  const autoConnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Reset auto-connect state when manually connecting
      setAutoConnectFailed(false);
      
      const isInFarcaster = typeof window !== 'undefined' && 
                           (window.parent !== window || navigator.userAgent.toLowerCase().includes('farcaster'));
      
      // Check if we're on mobile
      const isMobile = typeof window !== 'undefined' && 
                      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768);
      
      // PRIORITY 1: Farcaster context - should use Neynar SIWN
      if (isInFarcaster) {
        console.log('🎯 Farcaster context - should authenticate via Neynar SIWN');
        return { success: true }; // Neynar handles auth automatically
      }
      
      // PRIORITY 2: Non-Farcaster context - use MetaMask or Coinbase
      const connectedWallet = await thirdwebConnect(async () => {
        // Try MetaMask first
        try {
          const metamaskWallet = createWallet('io.metamask');
          await metamaskWallet.connect({ client });
          console.log('✅ Connected to MetaMask');
          return metamaskWallet;
        } catch (metamaskError) {
          console.log('MetaMask failed, trying Coinbase Wallet');
          const coinbaseWallet = createWallet('com.coinbase.wallet');
          await coinbaseWallet.connect({ client });
          console.log('✅ Connected to Coinbase Wallet');
          return coinbaseWallet;
        }
      });
      
      if (connectedWallet) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to connect wallet' };
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      
      const isInFarcaster = typeof window !== 'undefined' && 
                           (window as any).__evermark_farcaster_detected === true;
      
      let errorMessage = 'Failed to connect wallet';
      if (error instanceof Error) {
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          errorMessage = 'Connection rejected by user';
        } else if (error.message.includes('No wallet')) {
          errorMessage = isInFarcaster 
            ? 'Farcaster wallet not available. Please try connecting in a browser with MetaMask.'
            : 'No wallet extension found. Please install MetaMask or Coinbase Wallet.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      // useDisconnect requires the wallet parameter
      if (wallet) {
        thirdwebDisconnect(wallet);
        prodLog('Wallet disconnected successfully');
      }
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  };

  const requireConnection = async (): Promise<{ success: boolean; error?: string }> => {
    if (account?.address) {
      return { success: true };
    }
    return await connect();
  };

  // Track wallet address changes for debug logging
  useEffect(() => {
    setCurrentWallet(walletAddress);
  }, [walletAddress]);

  // Auto-connect to Farcaster wallet when in Farcaster context
  useEffect(() => {
    const checkAndConnect = async () => {
      // Skip if already attempted or connected
      if (autoConnectAttempted.current || walletAddress || isConnecting) {
        return;
      }

      const isInFarcaster = typeof window !== 'undefined' && 
                           (window.parent !== window || navigator.userAgent.toLowerCase().includes('farcaster'));
      
      // Also check URL parameter for testing
      const testMode = typeof window !== 'undefined' && 
                      (window.location.search.includes('farcaster=true') || 
                       window.location.search.includes('fc=true'));
      
      // Check if we're on mobile
      const isMobile = typeof window !== 'undefined' && 
                      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768);
      
      const isNeynarAuthenticated = !!neynarAuth?.user;
      const shouldAutoConnect = !isNeynarAuthenticated && (isInFarcaster || testMode) && isMobile && !walletAddress;
      
      console.log('🔍 Auto-connect check:', {
        isInFarcaster,
        testMode,
        isMobile,
        hasWalletAddress: !!walletAddress,
        isNeynarAuthenticated,
        isConnecting,
        shouldAutoConnect,
        attempted: autoConnectAttempted.current
      });
      
      if (shouldAutoConnect) {
        autoConnectAttempted.current = true;
        setIsAutoConnecting(true);
        setAutoConnectFailed(false);
        
        console.log('🎯 Auto-connecting to Farcaster wallet...');
        
        // Set a timeout for auto-connection (5 seconds)
        autoConnectTimeoutRef.current = setTimeout(() => {
          console.warn('⏱️ Auto-connect timeout after 5 seconds');
          setIsAutoConnecting(false);
          setAutoConnectFailed(true);
        }, 5000);
        
        try {
          const result = await connect();
          
          // Clear timeout if connection succeeded or failed
          if (autoConnectTimeoutRef.current) {
            clearTimeout(autoConnectTimeoutRef.current);
          }
          
          if (result.success) {
            prodLog('Auto-connected to Farcaster wallet successfully');
            setIsAutoConnecting(false);
            setAutoConnectFailed(false);
          } else {
            console.warn('Auto-connect to Farcaster wallet failed:', result.error);
            setIsAutoConnecting(false);
            setAutoConnectFailed(true);
          }
        } catch (error) {
          console.warn('Auto-connect to Farcaster wallet error:', error);
          if (autoConnectTimeoutRef.current) {
            clearTimeout(autoConnectTimeoutRef.current);
          }
          setIsAutoConnecting(false);
          setAutoConnectFailed(true);
        }
      }
    };

    // Check immediately when SIWN state changes
    checkAndConnect();
    
    return () => {
      if (autoConnectTimeoutRef.current) {
        clearTimeout(autoConnectTimeoutRef.current);
      }
    };
  }, [account?.address]); // Re-run when wallet changes

  const value: WalletContextType = {
    isConnected,
    address: walletAddress,
    isConnecting,
    isAutoConnecting,
    autoConnectFailed,
    connect,
    disconnect,
    requireConnection,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletConnection(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletConnection must be used within WalletProvider');
  }
  return context;
}