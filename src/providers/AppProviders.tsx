import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThirdwebProvider } from 'thirdweb/react';

import { FarcasterProvider } from '@/lib/farcaster';
import { client } from '@/lib/thirdweb';
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
 * 1. BrowserRouter (routing)
 * 2. React Query (data management)
 * 3. Thirdweb Provider (blockchain SDK)
 * 4. Farcaster Provider (authentication & context detection)
 * 5. Wallet Provider (wallet connection management)
 * 6. Blockchain Provider (contract interactions)
 * 7. App Context (unified state management)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

// Export the configured query client for use in custom hooks
export { queryClient };