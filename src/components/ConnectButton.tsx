// src/components/ConnectButton.tsx - Fixed for Thirdweb v5
import { ConnectButton, useActiveAccount } from 'thirdweb/react';
import { client } from '@/lib/thirdweb';
import { CHAIN } from '@/lib/contracts';
import { WalletIcon, UserIcon } from 'lucide-react';
import { createWallet, inAppWallet } from 'thirdweb/wallets';

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

  if (account) {
    const address = account.address;
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    if (variant === 'compact') {
      return (
        <div className={`flex items-center space-x-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
          <div className="w-6 h-6 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-full flex items-center justify-center">
            <UserIcon className="h-3 w-3 text-black" />
          </div>
          <span className="text-sm font-medium text-white">{shortAddress}</span>
        </div>
      );
    }
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
      detailsButton={{
        displayBalanceToken: {
          [CHAIN.id]: import.meta.env.VITE_EMARK_TOKEN_ADDRESS
        }
      }}
    />
  );
}

// Alternative simple connect button for basic usage
export function SimpleConnectButton({ className = '' }: { className?: string }) {
  const account = useActiveAccount();

  if (account) {
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg ${className}`}>
        <div className="w-8 h-8 bg-gradient-to-r from-cyber-primary to-cyber-secondary rounded-full flex items-center justify-center">
          <UserIcon className="h-4 w-4 text-black" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">
            {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
          </span>
          <span className="text-xs text-gray-400">Connected</span>
        </div>
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