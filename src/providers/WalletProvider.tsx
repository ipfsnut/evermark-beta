// src/providers/WalletProvider.tsx - Fixed based on actual Thirdweb v5 API
import React, { createContext, useContext, useEffect } from 'react';
import { useActiveAccount, useConnect, useDisconnect, useActiveWallet } from 'thirdweb/react';
import { createWallet } from 'thirdweb/wallets';
import { client } from '../lib/thirdweb';
import { setCurrentWallet, prodLog } from '../utils/debug';

interface WalletContextType {
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
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

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Use the correct useConnect API signature with browser wallets
      const connectedWallet = await thirdwebConnect(async () => {
        // Try MetaMask first (most common browser wallet)
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
      
      let errorMessage = 'Failed to connect wallet';
      if (error instanceof Error) {
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          errorMessage = 'Connection rejected by user';
        } else if (error.message.includes('No wallet')) {
          errorMessage = 'No wallet extension found. Please install MetaMask or Coinbase Wallet.';
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

  const value: WalletContextType = {
    isConnected: !!account?.address,
    address: account?.address || null,
    isConnecting,
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