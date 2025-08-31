import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { neynarClient } from '../lib/neynar/neynarClient';

interface NeynarUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  verifiedAddresses: string[];
  custodyAddress: string;
}

interface NeynarSIWNContextType {
  user: NeynarUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  getWalletAddress: () => string | null;
}

const NeynarSIWNContext = createContext<NeynarSIWNContextType | null>(null);

interface NeynarSIWNProviderProps {
  children: React.ReactNode;
  clientId: string;
}

export function NeynarSIWNProvider({ children, clientId }: NeynarSIWNProviderProps) {
  const [user, setUser] = useState<NeynarUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if we're in Farcaster context
  const isInFarcaster = typeof window !== 'undefined' && 
    (window.parent !== window || navigator.userAgent.toLowerCase().includes('farcaster'));

  const signIn = useCallback(async () => {
    if (!isInFarcaster) {
      throw new Error('Not in Farcaster context');
    }

    setIsLoading(true);
    try {
      // Frame SDK MUST provide user context in Mini App
      const frameSDK = (window as any).FrameSDK;
      if (!frameSDK?.context?.user) {
        throw new Error('Frame SDK user context not available - Mini App not properly initialized');
      }

      const { fid, username, displayName, pfpUrl } = frameSDK.context.user;
      console.log('🎯 Frame SDK user context:', { fid, username, displayName });
      
      // Get verified addresses from Neynar API
      const userProfile = await neynarClient.getUserByFid(fid);
      const userData = userProfile.users?.[0];
      
      if (!userData) {
        throw new Error(`Failed to fetch user profile for FID ${fid}`);
      }

      // Prefer verified addresses, use custody address as backup
      const walletAddresses = userData.verified_addresses?.eth_addresses || [];
      const custodyAddress = userData.custody_address || frameSDK.context.user.custodyAddress;
      
      if (walletAddresses.length === 0 && !custodyAddress) {
        throw new Error('No wallet addresses available for this Farcaster user');
      }

      const neynarUser: NeynarUser = {
        fid: userData.fid,
        username: userData.username,
        displayName: userData.display_name || displayName,
        pfpUrl: userData.pfp_url || pfpUrl,
        verifiedAddresses: walletAddresses,
        custodyAddress: custodyAddress
      };
      
      setUser(neynarUser);
      localStorage.setItem('neynar_siwn_user', JSON.stringify(neynarUser));
      console.log('✅ SIWN authentication complete:', {
        addresses: walletAddresses,
        custody: custodyAddress
      });
      
    } finally {
      setIsLoading(false);
    }
  }, [isInFarcaster]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('neynar_siwn_user');
  }, []);

  const getWalletAddress = useCallback(() => {
    return user?.verifiedAddresses[0] || user?.custodyAddress || null;
  }, [user]);

  // Auto-authenticate when Frame SDK context is available (Mini App)
  useEffect(() => {
    const autoAuthenticate = async () => {
      if (!isInFarcaster) return;
      
      // First, try to restore from localStorage
      const stored = localStorage.getItem('neynar_siwn_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
          console.log('✅ Restored SIWN user from localStorage');
          return;
        } catch (error) {
          console.warn('Failed to restore SIWN user from localStorage:', error);
          localStorage.removeItem('neynar_siwn_user');
        }
      }
      
      // Auto-authenticate with Frame SDK context if available
      const frameSDK = (window as any).FrameSDK;
      if (frameSDK?.context?.user) {
        console.log('🎯 Auto-authenticating with Frame SDK context...');
        try {
          await signIn();
        } catch (error) {
          console.warn('Auto-authentication failed:', error);
        }
      }
    };
    
    // Try immediately and after delays to ensure Frame SDK is ready
    autoAuthenticate();
    const timeout1 = setTimeout(autoAuthenticate, 1000);
    const timeout2 = setTimeout(autoAuthenticate, 3000);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [isInFarcaster, signIn]);

  const contextValue: NeynarSIWNContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signOut,
    getWalletAddress
  };

  return (
    <NeynarSIWNContext.Provider value={contextValue}>
      {children}
    </NeynarSIWNContext.Provider>
  );
}

export function useNeynarSIWN() {
  const context = useContext(NeynarSIWNContext);
  if (!context) {
    throw new Error('useNeynarSIWN must be used within NeynarSIWNProvider');
  }
  return context;
}

// Custom SIWN button component
interface NeynarAuthButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function NeynarAuthButton({ onSuccess, onError }: NeynarAuthButtonProps) {
  const { signIn, signOut, isAuthenticated, isLoading } = useNeynarSIWN();

  const handleAuth = async () => {
    try {
      if (isAuthenticated) {
        signOut();
      } else {
        await signIn();
        onSuccess?.();
      }
    } catch (error) {
      onError?.(error as Error);
    }
  };

  return (
    <button
      onClick={handleAuth}
      disabled={isLoading}
      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
    >
      {isLoading 
        ? 'Connecting...' 
        : isAuthenticated 
          ? 'Sign Out' 
          : 'Sign in with Farcaster'
      }
    </button>
  );
}