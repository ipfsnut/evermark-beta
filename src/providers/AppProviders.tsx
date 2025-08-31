import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThirdwebProvider } from 'thirdweb/react';

import { FarcasterProvider } from '../lib/farcaster';
import { NeynarSIWNProvider } from './NeynarSIWNProvider';
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
 * AppProviders - UPDATED ORDER with NeynarSIWN and IntegratedUserProvider:
 * 1. React Query (data management)
 * 2. Theme Provider (dark/light mode)
 * 3. Thirdweb Provider (blockchain SDK)
 * 4. Farcaster Provider (authentication & context detection)
 * 5. Neynar SIWN Provider (Farcaster authentication) ← NEW
 * 6. Wallet Provider (wallet connection management)
 * 7. Blockchain Provider (contract interactions)
 * 8. IntegratedUserProvider (UNIFIED USER MANAGEMENT)
 * 9. App Context (app-level state) ← RECEIVES INTEGRATED USER
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThirdwebProvider>
          <FarcasterProvider>
            <NeynarSIWNProvider clientId={import.meta.env.VITE_NEYNAR_CLIENT_ID}>
              <WalletProvider>
                <BlockchainProvider>
                  <IntegratedUserProvider>
                    <AppContextProvider>
                      {children}
                    </AppContextProvider>
                  </IntegratedUserProvider>
                </BlockchainProvider>
              </WalletProvider>
            </NeynarSIWNProvider>
          </FarcasterProvider>
        </ThirdwebProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Export the configured query client for use in custom hooks
export { queryClient };