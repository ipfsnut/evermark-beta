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
      throw new Error('SIWN only available in Farcaster context');
    }

    setIsLoading(true);
    try {
      // Try to get current Farcaster user from Frame context
      const frameSDK = (window as any).FrameSDK;
      if (frameSDK?.context?.user) {
        const { fid, username, displayName, pfpUrl } = frameSDK.context.user;
        
        // Fetch full user profile including verified addresses using our client
        try {
          const userProfile = await neynarClient.getUserByFid(fid);
          const userData = userProfile.users?.[0];
          
          if (userData) {
            const neynarUser: NeynarUser = {
              fid: userData.fid,
              username: userData.username,
              displayName: userData.display_name || displayName,
              pfpUrl: userData.pfp_url || pfpUrl,
              verifiedAddresses: userData.verified_addresses?.eth_addresses || [],
              custodyAddress: userData.custody_address
            };
            
            setUser(neynarUser);
            localStorage.setItem('neynar_siwn_user', JSON.stringify(neynarUser));
            console.log('✅ SIWN authentication successful:', neynarUser);
            return;
          }
        } catch (profileError) {
          console.warn('Failed to fetch full profile, using Frame context data:', profileError);
        }
        
        // Fallback to Frame context data
        const fallbackUser: NeynarUser = {
          fid,
          username: username || 'unknown',
          displayName: displayName || username || 'Farcaster User',
          pfpUrl: pfpUrl || '',
          verifiedAddresses: [], // Will need to be fetched separately
          custodyAddress: ''
        };
        
        setUser(fallbackUser);
        localStorage.setItem('neynar_siwn_user', JSON.stringify(fallbackUser));
        console.log('✅ SIWN authentication with Frame context:', fallbackUser);
        return;
      }
      
      throw new Error('No Farcaster user context available for SIWN');
      
    } catch (error) {
      console.error('SIWN authentication failed:', error);
      throw error;
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

  // Restore user from localStorage on mount
  useEffect(() => {
    if (isInFarcaster) {
      const stored = localStorage.getItem('neynar_siwn_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (error) {
          console.warn('Failed to restore SIWN user from localStorage:', error);
          localStorage.removeItem('neynar_siwn_user');
        }
      }
    }
  }, [isInFarcaster]);

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