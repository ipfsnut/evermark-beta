// src/providers/AppProviders.tsx - Context-aware provider loading
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThirdwebProvider } from 'thirdweb/react';
import { NeynarContextProvider } from '@neynar/react';
import { WagmiProvider, createConfig } from 'wagmi';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { http } from 'viem';
import { base } from 'viem/chains';

import { client } from '@/lib/thirdweb';
import { WalletProvider } from './WalletProvider';
import { BlockchainProvider } from './BlockchainProvider';
import { IntegratedUserProvider } from './IntegratedUserProvider';
import { AppContextProvider } from './AppContext';
import { ThemeProvider } from './ThemeProvider';
import { useFarcasterDetection } from '../hooks/useFarcasterDetection';

// React Query client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

// Mini App Wagmi config (for Farcaster context)
const miniAppWagmiConfig = createConfig({
  chains: [base],
  connectors: [farcasterMiniApp()],
  transports: {
    [base.id]: http()
  }
});

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const { isInFarcaster, isLoading } = useFarcasterDetection();
  
  console.log('🔍 AppProviders context detection:', { isInFarcaster, isLoading });

  // Wait for detection to complete
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Farcaster Mini App Provider Stack with Neynar authentication
  if (isInFarcaster) {
    console.log('🎯 Loading Farcaster Mini App providers (Mini App Wagmi + Neynar)');

    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NeynarContextProvider settings={{ clientId: import.meta.env.VITE_NEYNAR_CLIENT_ID }}>
            <WagmiProvider config={miniAppWagmiConfig}>
              <WalletProvider>
                <BlockchainProvider>
                  <IntegratedUserProvider>
                    <AppContextProvider>
                      {children}
                    </AppContextProvider>
                  </IntegratedUserProvider>
                </BlockchainProvider>
              </WalletProvider>
            </WagmiProvider>
          </NeynarContextProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  }

  // Browser/PWA Provider Stack
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// queryClient is only used internally in this file