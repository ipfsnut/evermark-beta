import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThirdwebProvider } from 'thirdweb/react';

import { NeynarContextProvider } from '@neynar/react';
import { WalletProvider } from './WalletProvider';
import { BlockchainProvider } from './BlockchainProvider';
import { IntegratedUserProvider } from './IntegratedUserProvider'; // NOW INCLUDED
import { AppContextProvider } from './AppContext';
import { ThemeProvider } from './ThemeProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

// Configure React Query with optimized settings for Web3 + Farcaster
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Blockchain data caching strategy
      staleTime: 30 * 1000, // 30 seconds for financial data
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors, retry on network issues
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Disable for better UX in mobile frames
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false, // Never retry mutations (blockchain transactions)
    },
  },
});

/**
 * AppProviders - CLEAN DUAL AUTH ARCHITECTURE:
 * 1. React Query (data management)
 * 2. Theme Provider (dark/light mode)  
 * 3. Thirdweb Provider (blockchain SDK - always present)
 * 4. Conditional Neynar Provider (only in Farcaster context)
 * 5. Wallet Provider (handles both auth types)
 * 6. Blockchain Provider (contract interactions)
 * 7. IntegratedUserProvider (unified user management)
 * 8. App Context (app-level state)
 */
export function AppProviders({ children }: AppProvidersProps) {
  // Detect Farcaster context
  const isInFarcaster = typeof window !== 'undefined' && 
    (window.parent !== window || navigator.userAgent.toLowerCase().includes('farcaster'));

  const providers = (
    <ThirdwebProvider>
      <WalletProvider>
        <BlockchainProvider>
          <IntegratedUserProvider>
            <AppContextProvider>
              {children}
            </AppContextProvider>
          </IntegratedUserProvider>
        </BlockchainProvider>
      </WalletProvider>
    </ThirdwebProvider>
  );

  // Wrap with Neynar only in Farcaster context
  const content = isInFarcaster ? (
    <NeynarContextProvider settings={{ clientId: import.meta.env.VITE_NEYNAR_CLIENT_ID }}>
      {providers}
    </NeynarContextProvider>
  ) : providers;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {content}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Export the configured query client for use in custom hooks
export { queryClient };