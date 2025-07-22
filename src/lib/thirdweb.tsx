// src/lib/thirdweb.tsx - Fixed thirdweb v5 imports and exports
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

// Thirdweb Provider component
interface AppThirdwebProviderProps {
  children: ReactNode;
}

export function AppThirdwebProvider({ children }: AppThirdwebProviderProps) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}