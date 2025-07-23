import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThirdwebProvider } from 'thirdweb/react';

import { FarcasterProvider } from '../lib/farcaster';
  import { WalletProvider } from './WalletProvider';
import { BlockchainProvider } from './BlockchainProvider';
import { AppContextProvider } from './AppContext';

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
 * AppProviders - Combines all global providers with proper order:
 * 1. React Query (data management)
 * 2. Thirdweb Provider (blockchain SDK)
 * 3. Farcaster Provider (authentication & context detection)
 * 4. Wallet Provider (wallet connection management)
 * 5. Blockchain Provider (contract interactions)
 * 6. App Context (unified state management)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThirdwebProvider>
        <FarcasterProvider>
          <WalletProvider>
            <BlockchainProvider>
              <AppContextProvider>
                {children}
              </AppContextProvider>
            </BlockchainProvider>
          </WalletProvider>
        </FarcasterProvider>
      </ThirdwebProvider>
    </QueryClientProvider>
  );
}

// Export the configured query client for use in custom hooks
export { queryClient };