// src/utils/responsive.ts - Responsive utilities for the voting feature

import { useEffect, useState } from 'react';

/**
 * Utility function for conditional class names
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Hook to detect mobile screen size
 */
export function useIsMobile(breakpoint = 768): boolean {
  // Initialize with actual window width on first render to prevent flash
  const [isMobile, setIsMobile] = useState(() => {
    // SSR-safe: Check if window exists
    if (typeof window === 'undefined') {
      return false; // Default to false during SSR
    }
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Check on mount (in case initial state was wrong)
    checkMobile();

    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Hook to detect screen orientation
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const checkOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  return orientation;
}

// Missing ABI files for voting contracts
// lib/abis/Voting.json - Voting contract ABI
export const VOTING_ABI = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "evermarkId", "type": "uint256"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "delegateVotes",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "evermarkId", "type": "uint256"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "undelegateVotes",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256[]", "name": "evermarkIds", "type": "uint256[]"},
      {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
    ],
    "name": "delegateVotesBatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurrentCycle",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "cycle", "type": "uint256"}],
    "name": "getCycleInfo",
    "outputs": [
      {"internalType": "uint256", "name": "startTime", "type": "uint256"},
      {"internalType": "uint256", "name": "endTime", "type": "uint256"},
      {"internalType": "uint256", "name": "totalVotes", "type": "uint256"},
      {"internalType": "uint256", "name": "totalDelegations", "type": "uint256"},
      {"internalType": "bool", "name": "finalized", "type": "bool"},
      {"internalType": "uint256", "name": "activeEvermarksCount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTimeRemainingInCurrentCycle",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "cycle", "type": "uint256"},
      {"internalType": "uint256", "name": "evermarkId", "type": "uint256"}
    ],
    "name": "getEvermarkVotesInCycle",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "cycle", "type": "uint256"},
      {"internalType": "address", "name": "user", "type": "address"},
      {"internalType": "uint256", "name": "evermarkId", "type": "uint256"}
    ],
    "name": "getUserVotesInCycle",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getRemainingVotingPower",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Update contracts configuration to include voting
export const CONTRACTS = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_TOKEN_ADDRESS || '0x1234567890123456789012345678901234567890',
  CARD_CATALOG: import.meta.env.VITE_STAKING_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567891',
  VOTING: import.meta.env.VITE_VOTING_CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567892',
} as const;
