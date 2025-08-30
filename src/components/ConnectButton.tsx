// src/components/ConnectButton.tsx - Fixed for Thirdweb v5
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { client } from '@/lib/thirdweb';
import { CHAIN } from '@/lib/contracts';
import { WalletIcon, UserIcon, LogOutIcon } from 'lucide-react';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { useAppAuth } from '../providers/AppContext';
import { useWalletConnection } from '../providers/WalletProvider';

interface WalletConnectProps {
  className?: string;
  variant?: 'default' | 'compact';
}

// Define supported wallets for v5 - Fixed wallet array typing
const getWallets = () => [
  inAppWallet(),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'), 
  createWallet('me.rainbow'),
];

export function WalletConnect({ className = '', variant = 'default' }: WalletConnectProps) {
  const account = useActiveAccount();
  const { disconnect } = useAppAuth();
  const { isAutoConnecting, autoConnectFailed } = useWalletConnection();

  const handleLogout = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  if (account) {
    const address = account.address;
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    if (variant === 'compact') {
      return (
        <div className={`flex items-center space-x-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
          <div className="w-6 h-6 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-full flex items-center justify-center">
            <UserIcon className="h-3 w-3 text-black" />
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-white hover:text-cyber-primary transition-colors cursor-pointer"
            title="Click to logout"
          >
            {shortAddress}
          </button>
        </div>
      );
    }
  }

  // For the default variant when connected, show a custom wallet display with logout
  if (account && variant === 'default') {
    const address = account.address;
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
        <div className="w-8 h-8 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-full flex items-center justify-center">
          <UserIcon className="h-4 w-4 text-black" />
        </div>
        <div className="flex flex-col">
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-white hover:text-cyber-primary transition-colors cursor-pointer text-left"
            title="Click to logout"
          >
            {shortAddress}
          </button>
          <span className="text-xs text-gray-400">Connected</span>
        </div>
        <LogOutIcon className="h-4 w-4 text-gray-400 hover:text-cyber-primary transition-colors cursor-pointer" onClick={handleLogout} />
      </div>
    );
  }

  // If we're auto-connecting, show a loading state
  if (isAutoConnecting) {
    return (
      <div className={`inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
        <span className="flex items-center text-gray-400">
          <WalletIcon className="h-4 w-4 mr-2 animate-pulse" />
          Connecting...
        </span>
      </div>
    );
  }
  
  // If auto-connect failed, show a message with the connect button
  if (autoConnectFailed && !account) {
    return (
      <div className="flex flex-col items-center gap-2">
        <ConnectButton
          client={client}
          wallets={getWallets()}
          chain={CHAIN}
          connectButton={{
            label: (
              <span className="flex items-center">
                <WalletIcon className="h-4 w-4 mr-2" />
                Connect Wallet
              </span>
            ),
            className: `inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity ${className}`
          }}
        />
        <span className="text-xs text-gray-400">Auto-connect failed. Please connect manually.</span>
      </div>
    );
  }

  return (
    <ConnectButton
      client={client}
      wallets={getWallets()}
      chain={CHAIN}
      connectButton={{
        label: (
          <span className="flex items-center">
            <WalletIcon className="h-4 w-4 mr-2" />
            Connect Wallet
          </span>
        ),
        className: `inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity ${className}`
      }}
    />
  );
}

// Alternative simple connect button for basic usage
export function SimpleConnectButton({ className = '' }: { className?: string }) {
  const account = useActiveAccount();
  const { disconnect } = useAppAuth();
  const { isAutoConnecting, autoConnectFailed } = useWalletConnection();

  const handleLogout = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  if (account) {
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
        <div className="w-8 h-8 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-full flex items-center justify-center">
          <UserIcon className="h-4 w-4 text-black" />
        </div>
        <div className="flex flex-col">
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-white hover:text-cyber-primary transition-colors cursor-pointer text-left"
            title="Click to logout"
          >
            {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
          </button>
          <span className="text-xs text-gray-400">Connected</span>
        </div>
      </div>
    );
  }

  // If we're auto-connecting, show a loading state
  if (isAutoConnecting) {
    return (
      <div className={`inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
        <span className="flex items-center text-gray-400">
          <WalletIcon className="h-4 w-4 mr-2 animate-pulse" />
          Connecting...
        </span>
      </div>
    );
  }
  
  // If auto-connect failed, show a message with the connect button
  if (autoConnectFailed && !account) {
    return (
      <div className="flex flex-col items-center gap-2">
        <ConnectButton
          client={client}
          wallets={getWallets()}
          chain={CHAIN}
          connectButton={{
            label: (
              <span className="flex items-center">
                <WalletIcon className="h-4 w-4 mr-2" />
                Connect Wallet
              </span>
            ),
            className: `inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity ${className}`
          }}
        />
        <span className="text-xs text-gray-400">Auto-connect failed. Please connect manually.</span>
      </div>
    );
  }

  return (
    <ConnectButton
      client={client}
      wallets={getWallets()}
      chain={CHAIN}
      connectButton={{
        label: (
          <span className="flex items-center">
            <WalletIcon className="h-4 w-4 mr-2" />
            Connect Wallet
          </span>
        ),
        className: `inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity ${className}`
      }}
    />
  );
}