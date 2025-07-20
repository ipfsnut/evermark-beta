
import { defineChain } from 'thirdweb';

export const CHAIN = defineChain({
  id: 8453, // Base Mainnet
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

// Contract addresses
export const CONTRACTS = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_TOKEN_ADDRESS || '0x1234567890123456789012345678901234567890',
  CARD_CATALOG: import.meta.env.VITE_STAKING_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567891',
} as const;

// Validate contract addresses
export function validateContractAddresses(): boolean {
  const addresses = Object.values(CONTRACTS);
  return addresses.every(address => 
    address && 
    address.length === 42 && 
    address.startsWith('0x')
  );
}

// Get contract explorer URL
export function getContractExplorerUrl(address: string): string {
  return `${CHAIN.blockExplorers?.[0]?.url}/address/${address}`;
}

// src/lib/thirdweb.ts - Thirdweb client and provider setup

import { createThirdwebClient } from 'thirdweb';
import { ThirdwebProvider } from 'thirdweb/react';
import React from 'react';

// Create the Thirdweb client
export const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID || 'your-client-id'
});

// Thirdweb Provider component
interface AppThirdwebProviderProps {
  children: React.ReactNode;
}

export function AppThirdwebProvider({ children }: AppThirdwebProviderProps) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}