// src/providers/WalletProvider.tsx - Fixed based on actual Thirdweb v5 API
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useActiveAccount, useConnect, useDisconnect, useActiveWallet } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
// Removed frameConnector - using Thirdweb v5 native Farcaster support
import { client } from '../lib/thirdweb';
import { setCurrentWallet, prodLog } from '../utils/debug';

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
                           (window as any).__evermark_farcaster_detected === true;
      
      // Check if we're on mobile
      const isMobile = typeof window !== 'undefined' && 
                      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768);
      
      // Use the correct Thirdweb v5 connect API
      const connectedWallet = await thirdwebConnect(async () => {
        if (isInFarcaster) {
          // In Farcaster context, use different strategies for mobile vs desktop
          try {
            console.log('🎯 Connecting in Farcaster context...', { isMobile, hasFrameSDK: !!window.FrameSDK });
            
            // For mobile Farcaster, always use embedded wallet with Farcaster strategy
            if (isMobile) {
              console.log('📱 Mobile Farcaster detected, using embedded wallet...');
              const embeddedWallet = createWallet('embedded');
              await embeddedWallet.connect({ 
                client,
                strategy: 'farcaster',
                // Use popup mode for better mobile UX
                mode: 'popup'
              });
              prodLog('Connected to Farcaster embedded wallet on mobile');
              return embeddedWallet;
            }
            
            // For desktop Farcaster or when SDK is available
            if (window.FrameSDK?.context) {
              console.log('✅ Desktop Farcaster SDK detected, using embedded wallet...');
              const embeddedWallet = createWallet('embedded');
              await embeddedWallet.connect({ 
                client,
                strategy: 'farcaster'
              });
              prodLog('Connected to Farcaster embedded wallet on desktop');
              return embeddedWallet;
            }
            
            // Fallback: standard embedded wallet
            console.log('🔄 Standard embedded wallet connection...');
            const embeddedWallet = createWallet('embedded');
            await embeddedWallet.connect({ 
              client,
              strategy: 'farcaster'
            });
            prodLog('Connected to Farcaster embedded wallet successfully');
            return embeddedWallet;
          } catch (farcasterError) {
            console.warn('Farcaster wallet connection failed:', farcasterError);
            // Don't try MetaMask on mobile Farcaster - it won't work
            if (!isMobile) {
              try {
                const metamaskWallet = createWallet('io.metamask');
                await metamaskWallet.connect({ client });
                prodLog('Connected to MetaMask in Farcaster context');
                return metamaskWallet;
              } catch (fallbackError) {
                console.warn('MetaMask fallback also failed:', fallbackError);
              }
            }
            throw new Error('Unable to connect wallet in Farcaster context');
          }
        }
        
        // Non-Farcaster context: Try MetaMask first (most common browser wallet)
        try {
          const metamaskWallet = createWallet('io.metamask');
          await metamaskWallet.connect({ client });
          return metamaskWallet;
        } catch (metamaskError) {
          // Fallback to Coinbase Wallet
          console.warn('MetaMask failed, trying Coinbase:', metamaskError);
          const coinbaseWallet = createWallet('com.coinbase.wallet');
          await coinbaseWallet.connect({ client });
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
    setCurrentWallet(account?.address || null);
  }, [account?.address]);

  // Auto-connect to Farcaster wallet when in Farcaster context
  useEffect(() => {
    const checkAndConnect = async () => {
      // Skip if already attempted or connected
      if (autoConnectAttempted.current || account?.address || isConnecting) {
        return;
      }

      const isInFarcaster = typeof window !== 'undefined' && 
                           (window as any).__evermark_farcaster_detected === true;
      
      // Also check URL parameter for testing
      const testMode = typeof window !== 'undefined' && 
                      (window.location.search.includes('farcaster=true') || 
                       window.location.search.includes('fc=true'));
      
      // Check if we're on mobile
      const isMobile = typeof window !== 'undefined' && 
                      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent) ||
                       window.innerWidth <= 768);
      
      const shouldAutoConnect = (isInFarcaster || testMode) && isMobile && !account?.address;
      
      console.log('🔍 Auto-connect check:', {
        isInFarcaster,
        testMode,
        isMobile,
        hasAccount: !!account?.address,
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

    // Check immediately and also after a short delay to ensure detection script runs
    checkAndConnect();
    const timeoutId = setTimeout(checkAndConnect, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      if (autoConnectTimeoutRef.current) {
        clearTimeout(autoConnectTimeoutRef.current);
      }
    };
  }, []); // Only run once on mount

  const value: WalletContextType = {
    isConnected: !!account?.address,
    address: account?.address || null,
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