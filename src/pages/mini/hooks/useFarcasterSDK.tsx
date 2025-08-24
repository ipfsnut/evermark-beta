import { useState, useEffect } from 'react';

interface FarcasterUser {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface FarcasterContext {
  user?: FarcasterUser;
  location?: string;
}

interface UseFarcasterSDKReturn {
  isSDKReady: boolean;
  context: FarcasterContext | null;
  error: string | null;
  sdk: any;
}

export function useFarcasterSDK(): UseFarcasterSDKReturn {
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [context, setContext] = useState<FarcasterContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sdk, setSdk] = useState<any>(null);

  useEffect(() => {
    const initializeSDK = async () => {
      try {
        // Import the SDK
        const { default: farcasterSDK } = await import('@farcaster/miniapp-sdk');
        setSdk(farcasterSDK);

        // Call ready() immediately
        await farcasterSDK.actions.ready();
        console.log('✅ Mini App SDK ready() called successfully');
        
        // Get context
        const miniappContext = await farcasterSDK.context;
        const mappedContext: FarcasterContext = {
          user: miniappContext.user ? {
            fid: miniappContext.user.fid,
            username: miniappContext.user.username,
            displayName: miniappContext.user.displayName,
            pfpUrl: miniappContext.user.pfpUrl
          } : undefined,
          location: typeof miniappContext.location === 'string' 
            ? miniappContext.location 
            : miniappContext.location?.type
        };

        setContext(mappedContext);
        setIsSDKReady(true);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown SDK error';
        setError(errorMessage);
        console.error('❌ Mini App SDK initialization failed:', err);
      }
    };

    // Only initialize in mini app context
    initializeSDK();
  }, []);

  return {
    isSDKReady,
    context,
    error,
    sdk
  };
}