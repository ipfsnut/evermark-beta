// src/lib/farcaster.tsx - Higher-level Farcaster integration
// Integrates with existing /features/evermarks services

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Import existing evermarks services (your sophisticated implementation)
import { FarcasterService } from '../features/evermarks/services/FarcasterService';
import type { FarcasterCastData } from '../features/evermarks/types';

// Import Neynar client (to be placed at app level, not in evermarks feature)
import { neynarClient } from './neynar/neynarClient';
import type { AppFarcasterUser } from './neynar/neynarTypes';
import { farcasterUserService } from '../services/FarcasterUserService';

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
  
  // Authentication state (integrates with your AppContext)
  isAuthenticated: boolean;
  user: AppFarcasterUser | null;
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
  // Simple Farcaster detection - detect or fail clearly
  const [isInFarcaster] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    // Check for Frame SDK (primary detection method)
    const hasFrameSDK = typeof (window as any).FrameSDK !== 'undefined';
    
    // Check user agent for Farcaster mobile app
    const userAgent = navigator.userAgent.toLowerCase();
    const isFarcasterUA = userAgent.includes('farcaster') || userAgent.includes('warpcast');
    
    // Check if in iframe with Farcaster referrer
    const isInIframe = window.parent !== window;
    const farcasterReferrer = document.referrer.includes('warpcast.com') || 
                             document.referrer.includes('farcaster.xyz');
    
    const detected = hasFrameSDK || isFarcasterUA || (isInIframe && farcasterReferrer);
    
    if (detected) {
      console.log('🎯 Farcaster detected:', { hasFrameSDK, isFarcasterUA, isInIframe, farcasterReferrer });
      (window as any).__evermark_farcaster_detected = true;
    } else {
      console.log('🌐 Not in Farcaster context');
    }
    
    return detected;
  });
  
  const [isFrameSDKReady, setIsFrameSDKReady] = useState(false);
  
  // User state
  const [user, setUser] = useState<AppFarcasterUser | null>(null);
  const [frameContext, setFrameContext] = useState<FarcasterFrameContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Frame SDK - ALWAYS attempt initialization for Mini Apps
  useEffect(() => {
    const initializeFrameSDK = async () => {
      try {
        setIsLoading(true);
        setError(null);


        // Wait for Frame SDK to be available (required for Mini Apps)
        let attempts = 0;
        const maxAttempts = 50;
        
        while (!window.FrameSDK && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.FrameSDK) {
          // For Mini Apps, we still call ready() even without SDK detection
          console.warn('⚠️ Frame SDK not available after 5s wait');
          setIsFrameSDKReady(false);
          
          // Try importing and calling ready from the modern SDK
          try {
            const { sdk } = await import('@farcaster/frame-sdk');
            await sdk.actions.ready();
            console.log('✅ Modern Frame SDK ready() called');
            setIsFrameSDKReady(true);
          } catch (modernSDKError) {
            console.warn('⚠️ Modern Frame SDK also not available');
          }
          return;
        }

        // Initialize SDK - ALWAYS call ready() for Mini Apps
        if (window.FrameSDK.actions?.ready) {
          await window.FrameSDK.actions.ready({ 
            disableNativeGestures: true 
          });
          console.log('✅ Frame SDK initialized');
        }

        setIsFrameSDKReady(true);

        // Get frame context (may be empty if not in frame)
        const context: FarcasterFrameContext = window.FrameSDK.context || {};
        setFrameContext(context);
        
        console.log('📱 Frame context:', context);

        // Only fetch user profiles if we're actually in Farcaster AND have user info
        if (isInFarcaster) {
          if (context.user?.fid) {
            await fetchUserProfile(context.user.fid);
          } else if (context.user?.username) {
            await fetchUserByUsername(context.user.username);
          }
        }

      } catch (err) {
        console.error('❌ Frame SDK initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Frame SDK initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(initializeFrameSDK, 100);
    return () => clearTimeout(timeout);
  }, []); // Remove isInFarcaster dependency - always try to initialize

  // Fetch user profile by FID using our service
  const fetchUserProfile = useCallback(async (fid: number): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Use our FarcasterUserService
      const profile = await farcasterUserService.fetchUserByFid(fid);
      
      if (profile) {
        setUser(profile);
        console.log('✅ Fetched Farcaster profile:', profile.username);
      } else {
        console.warn('⚠️ No profile found for FID:', fid);
        setError('Unable to load Farcaster profile');
      }
    } catch (err) {
      console.error('❌ Failed to fetch user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch user profile by username
  const fetchUserByUsername = useCallback(async (username: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const profile = await farcasterUserService.fetchUserByUsername(username);
      
      if (profile) {
        setUser(profile);
        console.log('✅ Fetched Farcaster profile by username:', profile.username);
      } else {
        console.warn('⚠️ No profile found for username:', username);
        setError('Unable to load Farcaster profile');
      }
    } catch (err) {
      console.error('❌ Failed to fetch user by username:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh current user
  const refreshUser = useCallback(async (): Promise<void> => {
    if (user?.fid) {
      await fetchUserProfile(user.fid);
    } else if (frameContext?.user?.fid) {
      await fetchUserProfile(frameContext.user.fid);
    } else if (frameContext?.user?.username) {
      await fetchUserByUsername(frameContext.user.username);
    }
  }, [user, frameContext, fetchUserProfile, fetchUserByUsername]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // INTEGRATION: Get user data formatted for evermark creation
  const getUserForEvermarkCreation = useCallback(() => {
    if (!user && !frameContext?.user) return null;

    const displayName = user?.displayName || frameContext?.user?.displayName || user?.username || 'Farcaster User';
    const author = user?.username ? `@${user.username}` : displayName;
    const pfpUrl = user?.pfpUrl || frameContext?.user?.pfpUrl;
    const verifiedAddress = user?.verifiedAddresses?.[0];

    return {
      displayName,
      author,
      pfpUrl,
      verifiedAddress
    };
  }, [user, frameContext]);

  // INTEGRATION: Delegate cast validation to existing FarcasterService
  const validateCastInput = useCallback((input: string) => {
    return FarcasterService.validateFarcasterInput(input);
  }, []);

  // INTEGRATION: Delegate cast fetching to existing FarcasterService
  const fetchCastData = useCallback(async (input: string): Promise<FarcasterCastData | null> => {
    return await FarcasterService.fetchCastMetadata(input);
  }, []);

  // Utility functions
  const getPrimaryAddress = useCallback((): string | null => {
    return user?.verifiedAddresses?.[0] || null;
  }, [user]);

  const getVerifiedAddresses = useCallback((): string[] => {
    return user?.verifiedAddresses || [];
  }, [user]);

  const getUserDisplayName = useCallback((): string | null => {
    return user?.displayName || frameContext?.user?.displayName || user?.username || null;
  }, [user, frameContext]);

  const getUserProfileUrl = useCallback((): string | null => {
    if (!user?.username) return null;
    return `https://warpcast.com/${user.username}`;
  }, [user]);

  // Calculate authentication state
  const isAuthenticated = !!(user || frameContext?.user);

  const value: FarcasterContextType = {
    // Detection state
    isInFarcaster,
    isFrameSDKReady,
    
    // Authentication state
    isAuthenticated,
    user,
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

// Convenience hooks for specific use cases
export function useFarcasterAuth() {
  const { isAuthenticated, user, isLoading } = useFarcasterUser();
  return { isAuthenticated, user, isLoading };
}

export function useFarcasterProfile() {
  const { 
    user, 
    getUserDisplayName, 
    getUserProfileUrl, 
    getPrimaryAddress,
    getVerifiedAddresses,
    refreshUser 
  } = useFarcasterUser();
  
  return {
    user,
    displayName: getUserDisplayName(),
    profileUrl: getUserProfileUrl(),
    primaryAddress: getPrimaryAddress(),
    verifiedAddresses: getVerifiedAddresses(),
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
    // User data formatted for evermark creation
    farcasterUser: getUserForEvermarkCreation(),
    
    // Cast handling (delegates to your existing services)
    validateCastInput,
    fetchCastData,
    
    // State
    isAuthenticated,
    isInFarcaster,
    
    // Helper to check if we should auto-populate forms
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
export type { AppFarcasterUser, FarcasterFrameContext };