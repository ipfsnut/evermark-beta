// src/hooks/core/useWalletAccount.ts - Unified wallet account hook for all contexts

import { useWallet } from '@/providers/WalletProvider';

/**
 * Unified wallet account hook that works in both Farcaster and Browser contexts.
 * Use this instead of useActiveAccount() from Thirdweb for consistent behavior.
 * 
 * In Farcaster context: Gets account from Wagmi (miniapp-wagmi-connector)
 * In Browser context: Gets account from Thirdweb
 */
export function useWalletAccount() {
  const { address, isConnected, context, connectionSource } = useWallet();

  // Return account object that matches Thirdweb's useActiveAccount() interface
  return address ? {
    address: address as `0x${string}`,
    chain: { id: 8453 }, // Base chain
    isConnected,
    context,
    connectionSource
  } : undefined;
}

/**
 * Hook for checking if wallet is connected in any context
 */
export function useIsWalletConnected(): boolean {
  const { isConnected } = useWallet();
  return isConnected;
}

/**
 * Hook for getting wallet address in any context
 */
export function useWalletAddress(): string | null {
  const { address } = useWallet();
  return address;
}