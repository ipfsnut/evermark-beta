// src/lib/farcaster.tsx - Higher-level Farcaster integration
// Integrates with existing /features/evermarks services

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Import existing evermarks services (your sophisticated implementation)
import { FarcasterService } from '../features/evermarks/services/FarcasterService';
import type { FarcasterCastData } from '../features/evermarks/types';

// Removed Neynar imports - handled by official SDK

interface FarcasterFrameContext {
  user?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
  location?: string;
}

interface FarcasterContextType {
  // Detection state
  isInFarcaster: boolean;
  isFrameSDKReady: boolean;
  
  // Authentication state (simplified - frame context only)
  isAuthenticated: boolean;
  user: null; // Neynar SDK handles user state
  frameContext: FarcasterFrameContext | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refreshUser: () => Promise<void>;
  clearError: () => void;
  
  // Integration methods for evermarks feature
  getUserForEvermarkCreation: () => {
    displayName: string;
    author: string;
    pfpUrl?: string;
    verifiedAddress?: string;
  } | null;
  
  // Cast handling (delegates to existing FarcasterService)
  validateCastInput: (input: string) => { isValid: boolean; error?: string };
  fetchCastData: (input: string) => Promise<FarcasterCastData | null>;
  
  // Utilities
  getPrimaryAddress: () => string | null;
  getVerifiedAddresses: () => string[];
  getUserDisplayName: () => string | null;
  getUserProfileUrl: () => string | null;
}

const FarcasterContext = createContext<FarcasterContextType | null>(null);

interface FarcasterProviderProps {
  children: React.ReactNode;
}

export function FarcasterProvider({ children }: FarcasterProviderProps) {
  // Simplified Farcaster detection for SIWN
  const [isInFarcaster] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    // Simple detection - iframe or Farcaster user agent
    const isInIframe = window.parent !== window;
    const userAgent = navigator.userAgent.toLowerCase();
    const isFarcasterUA = userAgent.includes('farcaster') || userAgent.includes('warpcast');
    
    const detected = isInIframe || isFarcasterUA;
    
    if (detected) {
      console.log('🎯 Farcaster context detected:', { isInIframe, isFarcasterUA });
    } else {
      console.log('🌐 Not in Farcaster context');
    }
    
    return detected;
  });
  
  const [isFrameSDKReady, setIsFrameSDKReady] = useState(false);
  
  // No user state - Neynar SDK handles authentication
  const [frameContext, setFrameContext] = useState<FarcasterFrameContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simplified Frame SDK initialization for Mini Apps only
  useEffect(() => {
    const initializeFrameSDK = async () => {
      if (!isInFarcaster) {
        setIsFrameSDKReady(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Simple Frame SDK initialization (no complex retry logic)
        if (window.FrameSDK?.actions?.ready) {
          await window.FrameSDK.actions.ready({ disableNativeGestures: true });
          console.log('✅ Frame SDK initialized');
          setIsFrameSDKReady(true);
          
          // Get frame context only (no user profile fetching)
          const context: FarcasterFrameContext = window.FrameSDK.context || {};
          setFrameContext(context);
          console.log('📱 Frame context:', context);
        } else {
          console.log('🌐 Frame SDK not available - not in frame context');
          setIsFrameSDKReady(false);
        }

      } catch (err) {
        console.error('❌ Frame SDK initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Frame SDK initialization failed');
        setIsFrameSDKReady(false);
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(initializeFrameSDK, 100);
    return () => clearTimeout(timeout);
  }, [isInFarcaster]);

  // Simplified refresh - no user profile fetching (Neynar handles this)
  const refreshUser = useCallback(async (): Promise<void> => {
    console.log('🔄 Frame context refresh requested');
    // Frame context is read-only - just clear any errors
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // INTEGRATION: Get user data formatted for evermark creation (from frame context only)
  const getUserForEvermarkCreation = useCallback(() => {
    if (!frameContext?.user) return null;

    const displayName = frameContext.user.displayName || frameContext.user.username || 'Farcaster User';
    const author = frameContext.user.username ? `@${frameContext.user.username}` : displayName;
    const pfpUrl = frameContext.user.pfpUrl;

    return {
      displayName,
      author,
      pfpUrl,
      verifiedAddress: undefined // Neynar SDK provides this separately
    };
  }, [frameContext]);

  // INTEGRATION: Delegate cast validation to existing FarcasterService
  const validateCastInput = useCallback((input: string) => {
    return FarcasterService.validateFarcasterInput(input);
  }, []);

  // INTEGRATION: Delegate cast fetching to existing FarcasterService
  const fetchCastData = useCallback(async (input: string): Promise<FarcasterCastData | null> => {
    return await FarcasterService.fetchCastMetadata(input);
  }, []);

  // Simplified utility functions (no user state, just frame context)
  const getPrimaryAddress = useCallback((): string | null => {
    return null; // Neynar SDK handles address resolution
  }, []);

  const getVerifiedAddresses = useCallback((): string[] => {
    return []; // Neynar SDK handles verified addresses
  }, []);

  const getUserDisplayName = useCallback((): string | null => {
    return frameContext?.user?.displayName || frameContext?.user?.username || null;
  }, [frameContext]);

  const getUserProfileUrl = useCallback((): string | null => {
    if (!frameContext?.user?.username) return null;
    return `https://warpcast.com/${frameContext.user.username}`;
  }, [frameContext]);

  // Calculate authentication state (frame context only)
  const isAuthenticated = !!frameContext?.user;

  const value: FarcasterContextType = {
    // Detection state
    isInFarcaster,
    isFrameSDKReady,
    
    // Authentication state (simplified - just frame context)
    isAuthenticated,
    user: null, // No user state - Neynar SDK handles this
    frameContext,
    
    // Loading states
    isLoading,
    error,
    
    // Actions
    refreshUser,
    clearError,
    
    // Integration methods
    getUserForEvermarkCreation,
    validateCastInput,
    fetchCastData,
    
    // Utilities
    getPrimaryAddress,
    getVerifiedAddresses,
    getUserDisplayName,
    getUserProfileUrl
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcasterUser(): FarcasterContextType {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error('useFarcasterUser must be used within FarcasterProvider');
  }
  return context;
}

// Simplified convenience hooks (frame context only)
export function useFarcasterAuth() {
  const { isAuthenticated, isLoading } = useFarcasterUser();
  return { isAuthenticated, user: null, isLoading }; // No user state
}

export function useFarcasterProfile() {
  const { 
    getUserDisplayName, 
    getUserProfileUrl, 
    refreshUser 
  } = useFarcasterUser();
  
  return {
    user: null, // No user state - use Neynar SDK
    displayName: getUserDisplayName(),
    profileUrl: getUserProfileUrl(),
    primaryAddress: null, // Neynar SDK handles this
    verifiedAddresses: [], // Neynar SDK handles this
    refreshProfile: refreshUser
  };
}

// INTEGRATION HOOK: For evermarks feature integration
export function useFarcasterForEvermarks() {
  const { 
    getUserForEvermarkCreation,
    validateCastInput,
    fetchCastData,
    isAuthenticated,
    isInFarcaster
  } = useFarcasterUser();
  
  return {
    // Frame context data for evermark creation (basic info only)
    farcasterUser: getUserForEvermarkCreation(),
    
    // Cast handling (delegates to existing services)
    validateCastInput,
    fetchCastData,
    
    // State
    isAuthenticated, // Frame context available
    isInFarcaster,
    
    // Helper to check if we should auto-populate forms (frame context only)
    shouldAutoPopulate: isAuthenticated && isInFarcaster
  };
}

export function useFarcasterFrame() {
  const { isInFarcaster, isFrameSDKReady, frameContext, error } = useFarcasterUser();
  
  return {
    isInFrame: isInFarcaster,
    isSDKReady: isFrameSDKReady,
    context: frameContext,
    error
  };
}

// Type exports for external use
export type { FarcasterFrameContext };