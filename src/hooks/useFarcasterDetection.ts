// Simple Farcaster detection hook to replace complex FarcasterProvider
import { useState, useEffect } from 'react';

export function useFarcasterDetection() {
  const [isInFarcaster] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.parent !== window || 
           navigator.userAgent.toLowerCase().includes('farcaster');
  });

  return {
    isInFarcaster,
    isFrameSDKReady: false, // Simplified - no Frame SDK complexity
    frameContext: null,
    error: null,
    isAuthenticated: false, // Let Neynar handle this
    user: null, // Let Neynar handle this
    isLoading: false
  };
}

// Backwards compatibility exports
export function useFarcasterUser() {
  return useFarcasterDetection();
}

export function useFarcasterAuth() {
  const { isAuthenticated, isLoading } = useFarcasterDetection();
  return { isAuthenticated, user: null, isLoading };
}

export function useFarcasterProfile() {
  return {
    user: null,
    displayName: null,
    profileUrl: null,
    primaryAddress: null,
    verifiedAddresses: [],
    refreshProfile: async () => {}
  };
}