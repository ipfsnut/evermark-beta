// Farcaster detection using miniapp-sdk context
import { useState, useEffect } from 'react';

export function useFarcasterDetection() {
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [miniAppContext, setMiniAppContext] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectFarcaster = async () => {
      try {
        // Wait for SDK to be ready if it's being initialized
        const maxWaitTime = 2000; // 2 seconds max wait
        const startTime = Date.now();
        
        while (typeof (window as any).__evermark_farcaster_sdk_ready === 'undefined') {
          if (Date.now() - startTime > maxWaitTime) {
            console.log('⏱️ Timeout waiting for SDK ready flag');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // If SDK is explicitly not ready, we're not in Farcaster
        if ((window as any).__evermark_farcaster_sdk_ready === false) {
          setIsInFarcaster(false);
          console.log('🌐 Browser/PWA mode (SDK ready flag is false)');
          setIsLoading(false);
          return;
        }
        
        // Try to access miniapp-sdk context
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Ensure ready() has been called (it should have been called in main.tsx)
        // But we'll call it again just to be safe - it's idempotent
        try {
          await sdk.actions.ready();
          console.log('✅ SDK ready() confirmed in useFarcasterDetection');
        } catch (readyError) {
          console.log('⚠️ SDK ready() call failed (might already be ready):', readyError);
        }
        
        // Now get the context
        const context = await sdk.context;
        
        // Consider it Farcaster if we have a real user context (even on localhost for testing)
        if (context?.user) {
          setIsInFarcaster(true);
          setMiniAppContext(context);
          console.log('🎯 Farcaster Mini App context detected with user:', {
            fid: context.user.fid,
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl
          });
        } else {
          setIsInFarcaster(false);
          console.log('🌐 Browser/PWA mode (no user context)');
        }
      } catch (error) {
        setIsInFarcaster(false);
        console.log('🌐 Farcaster SDK not available - browser/PWA mode:', error);
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