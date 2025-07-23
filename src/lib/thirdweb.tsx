// src/lib/thirdweb.tsx - Fixed thirdweb v5 implementation
import { createThirdwebClient } from 'thirdweb';
import { defineChain } from 'thirdweb/chains';
import { ThirdwebProvider } from 'thirdweb/react';
import type { ReactNode } from 'react';

// Create the Thirdweb client with proper v5 syntax
export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || ''
});

// Define Base chain with proper v5 syntax - EXPORTED for use in other files
export const CHAIN = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpc: 'https://mainnet.base.org',
  blockExplorers: [
    {
      name: 'BaseScan',
      url: 'https://basescan.org',
    },
  ],
});

// Verify client configuration
if (!import.meta.env.VITE_THIRDWEB_CLIENT_ID) {
  console.warn('⚠️ VITE_THIRDWEB_CLIENT_ID not configured - some features may not work');
}

// Thirdweb Provider component - Fixed for v5
interface AppThirdwebProviderProps {
  children: ReactNode;
}

export function AppThirdwebProvider({ children }: AppThirdwebProviderProps) {
  // In Thirdweb v5, the ThirdwebProvider doesn't need any props
  // The client and chain are passed to individual components/hooks
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}