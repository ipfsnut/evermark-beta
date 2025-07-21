import React, { createContext, useContext } from 'react';
import { useActiveAccount, useConnect, useDisconnect } from 'thirdweb/react';
import { inAppWallet, createWallet } from 'thirdweb/wallets';

interface WalletContextType {
  // Connection state
  isConnected: boolean;
  address: string | null;
  isConnecting: boolean;
  
  // Connection methods
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
  const { connect: thirdwebConnect, isConnecting } = useConnect();
  const { disconnect: thirdwebDisconnect } = useDisconnect();

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const wallet = createWallet('io.metamask');
      await thirdwebConnect(async () => {
        const account = await wallet.connect({
          client: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
        });
        return account;
      });
      
      return { success: true };
    } catch (error) {
      console.error('Wallet connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet'
      };
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      await thirdwebDisconnect();
    } catch (error) {
      console.error('Wallet disconnection failed:', error);
    }
  };

  const requireConnection = async (): Promise<{ success: boolean; error?: string }> => {
    if (account?.address) {
      return { success: true };
    }
    
    return await connect();
  };

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