import React, { createContext, useContext } from 'react';
import { useActiveAccount, useConnect, useDisconnect } from 'thirdweb/react';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { client } from '@/lib/thirdweb';

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

// Define available wallets for v5
const wallets = [
  inAppWallet(),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
];

export function WalletProvider({ children }: WalletProviderProps) {
  const account = useActiveAccount();
  const { connect: thirdwebConnect, isConnecting } = useConnect();
  const { disconnect: thirdwebDisconnect } = useDisconnect();

  const connect = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Try to connect with the first available wallet
      const wallet = wallets[0]; // Default to in-app wallet
      await thirdwebConnect(async () => {
        const connectedAccount = await wallet.connect({ client });
        return connectedAccount;
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