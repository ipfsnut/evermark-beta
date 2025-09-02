// src/components/ConnectButton.tsx - Context-aware wallet connection
import React from 'react';
import { ConnectButton } from 'thirdweb/react';
import { WalletIcon, LogOutIcon } from 'lucide-react';
import { createWallet, inAppWallet } from 'thirdweb/wallets';
import { UserAvatar } from './ui/UserAvatar';

import { client } from '@/lib/thirdweb';
import { CHAIN } from '@/lib/contracts';
import { useWallet } from '../providers/WalletProvider';
import { useAppAuth } from '@/providers/AppContext';
import { useThemeClasses } from '@/providers/ThemeProvider';

interface WalletConnectProps {
  className?: string;
  variant?: 'default' | 'compact';
}

// Wallet configurations by context
const getBrowserWallets = () => [
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'), 
  createWallet('me.rainbow'),
];

const getPWAWallets = () => [
  inAppWallet(), // Email/phone signup first for PWA
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
];

export function WalletConnect({ className = '', variant = 'default' }: WalletConnectProps) {
  const { address, isConnected, context, disconnect } = useWallet();
  const { user } = useAppAuth();
  const themeClasses = useThemeClasses();
  
  // Get display info from integrated user system
  const getDisplayInfo = () => {
    const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
    
    if (user) {
      // Use enhanced user data with proper fallback chain
      const displayName = user.displayName || user.username || user.ensName;
      return {
        displayName,
        shortAddress,
        avatar: user.avatar || user.pfpUrl
      };
    }
    
    return {
      displayName: null,
      shortAddress,
      avatar: null
    };
  };

  const { displayName, shortAddress, avatar } = getDisplayInfo();

  // Connected state - show user info
  if (isConnected && address) {
    if (variant === 'compact') {
      return (
        <div className={`flex items-center space-x-2 px-3 py-2 ${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg ${className}`}>
          <UserAvatar 
            user={user ? {
              fid: user.farcasterFid || 0,
              username: user.username || user.farcasterUsername || '',
              displayName: displayName || user.displayName || '',
              pfpUrl: avatar || '',
              bio: '',
              followerCount: 0,
              followingCount: 0,
              verifiedAddresses: address ? [address] : [],
              isVerified: false,
              hasPowerBadge: false,
              isActive: true
            } : null}
            address={address}
            size="xs"
            fallbackType="blockies"
          />
          <button
            onClick={disconnect}
            className={`text-sm font-medium ${themeClasses.text.primary} hover:text-cyber-primary transition-colors cursor-pointer`}
            title="Click to logout"
          >
            {displayName ?? shortAddress}
          </button>
        </div>
      );
    }

    // Default variant
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 ${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg ${className}`}>
        <UserAvatar 
          user={user ? {
            fid: user.farcasterFid || 0,
            username: user.username || user.farcasterUsername || '',
            displayName: displayName || user.displayName || '',
            pfpUrl: avatar || '',
            bio: '',
            followerCount: 0,
            followingCount: 0,
            verifiedAddresses: address ? [address] : [],
            isVerified: false,
            hasPowerBadge: false,
            isActive: true
          } : null}
          address={address}
          size="sm"
          fallbackType="blockies"
        />
        <div className="flex flex-col">
          <button
            onClick={disconnect}
            className={`text-sm font-medium ${themeClasses.text.primary} hover:text-cyber-primary transition-colors cursor-pointer text-left`}
            title="Click to logout"
          >
            {displayName ?? shortAddress}
          </button>
          <span className={`text-xs ${themeClasses.text.muted}`}>
            {user?.authType === 'farcaster' ? 'Farcaster' : 
             user?.authType === 'ens' ? 'ENS' :
             context === 'farcaster' ? 'Farcaster' : 'Connected'}
          </span>
        </div>
        <LogOutIcon className={`h-4 w-4 ${themeClasses.text.muted} hover:text-cyber-primary transition-colors cursor-pointer`} onClick={disconnect} />
      </div>
    );
  }

  // Not connected - show appropriate connection method
  
  // Farcaster context - wallet connects automatically via miniapp-wagmi-connector
  if (context === 'farcaster') {
    return (
      <div className={className}>
        <button 
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <WalletIcon className="h-4 w-4 mr-2" />
          Connecting...
        </button>
      </div>
    );
  }

  // Browser/PWA context - use Thirdweb ConnectButton
  const wallets = context === 'pwa' ? getPWAWallets() : getBrowserWallets();
  
  return (
    <ConnectButton
      client={client}
      wallets={wallets}
      chain={CHAIN}
      connectModal={{ size: "wide" }}
      connectButton={{
        label: (
          <span className="flex items-center">
            <WalletIcon className="h-4 w-4 mr-2" />
            {context === 'pwa' ? 'Sign In' : 'Connect Wallet'}
          </span>
        ),
        className: `inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyber-primary to-cyber-secondary text-black font-medium rounded-lg hover:opacity-90 transition-opacity ${className}`
      }}
    />
  );
}

// Simplified connect button for basic usage
export function SimpleConnectButton({ className = '' }: { className?: string }) {
  const { address, isConnected, context } = useWallet();
  const { user } = useAppAuth();
  const themeClasses = useThemeClasses();

  if (isConnected && address) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const displayName = user?.displayName || user?.username || user?.ensName;
    const avatar = user?.avatar || user?.pfpUrl;
    
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 ${themeClasses.bg.card} border ${themeClasses.border.primary} rounded-lg ${className}`}>
        <UserAvatar 
          user={user ? {
            fid: user.farcasterFid || 0,
            username: user.username || user.farcasterUsername || '',
            displayName: displayName || user.displayName || '',
            pfpUrl: avatar || '',
            bio: '',
            followerCount: 0,
            followingCount: 0,
            verifiedAddresses: address ? [address] : [],
            isVerified: false,
            hasPowerBadge: false,
            isActive: true
          } : null}
          address={address}
          size="sm"
          fallbackType="blockies"
        />
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${themeClasses.text.primary}`}>
            {displayName ?? shortAddress}
          </span>
          <span className={`text-xs ${themeClasses.text.muted}`}>
            {user?.authType === 'farcaster' ? 'Farcaster' : 
             user?.authType === 'ens' ? 'ENS' :
             context === 'farcaster' ? 'Farcaster' : 'Connected'}
          </span>
        </div>
      </div>
    );
  }

  return <WalletConnect className={className} variant="default" />;
}