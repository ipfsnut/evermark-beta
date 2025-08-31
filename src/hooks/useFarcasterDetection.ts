// Farcaster detection using miniapp-sdk context
import { useState, useEffect } from 'react';

export function useFarcasterDetection() {
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [miniAppContext, setMiniAppContext] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectFarcaster = async () => {
      try {
        // Try to access miniapp-sdk context
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const context = await sdk.context;
        
        // Only consider it Farcaster if we have a real user context AND we're not on localhost
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        if (context?.user && !isLocalhost) {
          setIsInFarcaster(true);
          setMiniAppContext(context);
          console.log('🎯 Farcaster Mini App context detected');
        } else {
          setIsInFarcaster(false);
          console.log('🌐 Browser/PWA mode (localhost or no user context)');
        }
      } catch {
        setIsInFarcaster(false);
        console.log('🌐 Farcaster SDK not available - browser/PWA mode');
      }
      setIsLoading(false);
    };

    detectFarcaster();
  }, []);

  return {
    isInFarcaster,
    miniAppContext,
    isLoading,
    isFrameSDKReady: isInFarcaster && !isLoading,
    frameContext: miniAppContext,
    error: null,
    isAuthenticated: false, // Let Neynar handle this
    user: null, // Let Neynar handle this
  };
}

// Backwards compatibility exports
export function useFarcasterUser() {
  return useFarcasterDetection();
}

export function useFarcasterAuth() {
  const { isAuthenticated, isLoading } = useFarcasterDetection();
  return { isAuthenticated, user: null, isLoading };
}

export function useFarcasterProfile() {
  return {
    user: null,
    displayName: null,
    profileUrl: null,
    primaryAddress: null,
    verifiedAddresses: [],
    refreshProfile: async () => {}
  };
}