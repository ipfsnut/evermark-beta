// src/providers/IntegratedUserProvider.tsx
// FIXED: Now uses your existing JWT authentication infrastructure

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useFarcasterUser } from '../lib/farcaster';
import { EnhancedUserService, type EnhancedUser } from '../services';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { WalletAuthService, type WalletAuthResult } from '../services/WalletAuthService';

interface IntegratedUserContextType {
  // Current user (unified profile)
  user: EnhancedUser | null;
  isLoading: boolean;
  error: string | null;
  
  // Authentication states
  hasWallet: boolean;
  hasFarcaster: boolean;
  hasENS: boolean;
  isFullyAuthenticated: boolean;
  
  // Supabase auth state - FIXED with real JWT
  isSupabaseAuthenticated: boolean;
  supabaseAuthError: string | null;
  supabaseSession: any;
  isAuthenticating: boolean;
  
  // User actions
  refreshUser: () => Promise<void>;
  switchUserView: (source: 'farcaster' | 'ens' | 'wallet') => void;
  clearError: () => void;
  
  // Auth actions - ENHANCED with real JWT
  ensureSupabaseAuth: () => Promise<boolean>;
  authenticateWallet: () => Promise<boolean>;
  signOut: () => Promise<void>;
  
  // Data for evermarks integration
  getEvermarkAuthorData: () => {
    author: string;
    displayName: string;
    avatar?: string;
    farcasterFid?: number;
    farcasterUsername?: string;
    walletAddress?: string;
    createdVia: string;
  } | null;
  
  // Identity utilities
  getPrimaryIdentity: () => 'farcaster' | 'ens' | 'wallet' | null;
  getIdentityScore: () => number;
  getDisplayName: () => string;
  getAvatar: () => string | undefined;
  getPrimaryAddress: () => string | undefined;
}

const IntegratedUserContext = createContext<IntegratedUserContextType | null>(null);

interface IntegratedUserProviderProps {
  children: React.ReactNode;
}

export function IntegratedUserProvider({ children }: IntegratedUserProviderProps) {
  const account = useActiveAccount();
  const farcaster = useFarcasterUser();
  
  const [user, setUser] = useState<EnhancedUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredSource, setPreferredSource] = useState<'farcaster' | 'ens' | 'wallet'>('farcaster');
  
  // FIXED: Real JWT authentication state
  const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = useState(false);
  const [supabaseAuthError, setSupabaseAuthError] = useState<string | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Load user profile when authentication state changes
  useEffect(() => {
    loadUserProfile();
  }, [account?.address, farcaster.user?.fid, farcaster.isAuthenticated]);

  // Check existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  // Auto-authenticate when wallet connects (optional - you can disable this)
  useEffect(() => {
    if (account?.address && !isSupabaseAuthenticated && !isAuthenticating) {
      // Auto-authenticate on wallet connection
      // Comment this out if you prefer manual authentication
      authenticateWallet();
    }
  }, [account?.address]);

  /**
   * Check if there's an existing valid Supabase session
   */
  const checkExistingSession = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const supabase = getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session && !error) {
        console.log('✅ Found existing Supabase session');
        setSupabaseSession(session);
        setIsSupabaseAuthenticated(true);
        setSupabaseAuthError(null);
      } else if (error) {
        console.log('⚠️ Existing session invalid:', error.message);
        setIsSupabaseAuthenticated(false);
        setSupabaseSession(null);
      }
    } catch (error) {
      console.error('Failed to check existing session:', error);
    }
  }, []);

  /**
   * FIXED: Real wallet authentication using your JWT infrastructure
   */
  const authenticateWallet = useCallback(async (): Promise<boolean> => {
    if (!account) {
      setSupabaseAuthError('No wallet connected');
      return false;
    }

    if (!isSupabaseConfigured()) {
      setSupabaseAuthError('Supabase not configured');
      return false;
    }

    setIsAuthenticating(true);
    setSupabaseAuthError(null);
    
    try {
      console.log('🔐 Starting wallet authentication flow...');
      
      // Use your existing JWT authentication service
      const authResult: WalletAuthResult = await WalletAuthService.authenticateWallet(account);
      
      if (!authResult.success) {
        const friendlyError = WalletAuthService.getErrorMessage(authResult.error || 'Authentication failed');
        setSupabaseAuthError(friendlyError);
        return false;
      }

      if (!authResult.session) {
        setSupabaseAuthError('No session received from authentication');
        return false;
      }

      // Set the JWT session in Supabase client
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token,
      });

      if (error) {
        console.error('❌ Failed to set Supabase session:', error);
        setSupabaseAuthError('Failed to establish session');
        return false;
      }

      // Success!
      setSupabaseSession(data.session);
      setIsSupabaseAuthenticated(true);
      setSupabaseAuthError(null);
      
      console.log('✅ Wallet authentication complete! Session established.');
      
      return true;

    } catch (error) {
      console.error('❌ Wallet authentication failed:', error);
      const friendlyError = WalletAuthService.getErrorMessage(
        error instanceof Error ? error.message : 'Authentication failed'
      );
      setSupabaseAuthError(friendlyError);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [account]);

  /**
   * Ensure authentication - calls authenticateWallet if needed
   */
  const ensureSupabaseAuth = useCallback(async (): Promise<boolean> => {
    // Check if already authenticated
    if (isSupabaseAuthenticated && supabaseSession) {
      // Verify session is still valid
      if (WalletAuthService.isSessionValid(supabaseSession)) {
        return true;
      } else {
        console.log('🔄 Session expired, re-authenticating...');
        setIsSupabaseAuthenticated(false);
        setSupabaseSession(null);
      }
    }

    if (!account?.address) {
      setSupabaseAuthError('Please connect your wallet first');
      return false;
    }

    console.log('🔄 Ensuring Supabase authentication...');
    return await authenticateWallet();
  }, [isSupabaseAuthenticated, supabaseSession, account?.address, authenticateWallet]);

  /**
   * Sign out and clear session
   */
  const signOut = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
      }
      
      setSupabaseSession(null);
      setIsSupabaseAuthenticated(false);
      setSupabaseAuthError(null);
      
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out failed:', error);
    }
  }, []);

  const loadUserProfile = useCallback(async () => {
    if (!account?.address && !farcaster.user) {
      setUser(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let enhancedUser: EnhancedUser | null = null;

      // Priority 1: Farcaster user (best identity data)
      if (farcaster.user && farcaster.isAuthenticated) {
        console.log('🎯 Loading profile from Farcaster FID:', farcaster.user.fid);
        enhancedUser = await EnhancedUserService.getUserByFarcasterFID(farcaster.user.fid);
      }
      
      // Priority 2: Wallet address (try to enhance with ENS)
      else if (account?.address) {
        console.log('🎯 Loading profile from wallet address:', account.address);
        enhancedUser = await EnhancedUserService.getUserByAddress(account.address);
      }

      if (enhancedUser) {
        setUser(enhancedUser);
        console.log('✅ Enhanced user profile loaded:', {
          source: enhancedUser.source,
          identityScore: enhancedUser.identityScore,
          hasFarcaster: !!enhancedUser.farcaster,
          hasENS: !!enhancedUser.ens,
          hasWallet: !!enhancedUser.wallet
        });
      } else {
        console.warn('⚠️ No enhanced profile found');
        setUser(null);
      }

    } catch (err) {
      console.error('❌ Failed to load user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, farcaster.user, farcaster.isAuthenticated]);

  const refreshUser = useCallback(async () => {
    EnhancedUserService.clearCache();
    await loadUserProfile();
  }, [loadUserProfile]);

  const switchUserView = useCallback((source: 'farcaster' | 'ens' | 'wallet') => {
    setPreferredSource(source);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setSupabaseAuthError(null);
  }, []);

  // Get data formatted for evermarks creation
  const getEvermarkAuthorData = useCallback(() => {
    if (!user) return null;

    let author: string;
    let displayName: string;
    let createdVia: string;

    if (user.farcaster && preferredSource !== 'wallet') {
      author = `@${user.farcaster.username}`;
      displayName = user.farcaster.displayName;
      createdVia = 'farcaster';
    } else if (user.ens && preferredSource !== 'wallet') {
      author = user.ens.name;
      displayName = user.ens.name;
      createdVia = 'ens';
    } else if (user.wallet) {
      author = user.wallet.shortAddress;
      displayName = user.displayName;
      createdVia = 'wallet';
    } else {
      return null;
    }

    return {
      author,
      displayName,
      avatar: user.avatar,
      farcasterFid: user.farcaster?.fid,
      farcasterUsername: user.farcaster?.username,
      walletAddress: user.primaryAddress,
      createdVia
    };
  }, [user, preferredSource]);

  // Utility functions
  const getPrimaryIdentity = useCallback((): 'farcaster' | 'ens' | 'wallet' | null => {
    if (!user) return null;
    
    if (user.farcaster && user.farcaster.isVerified) return 'farcaster';
    if (user.ens) return 'ens';
    if (user.farcaster) return 'farcaster';
    if (user.wallet) return 'wallet';
    return null;
  }, [user]);

  const getIdentityScore = useCallback((): number => {
    return user?.identityScore || 0;
  }, [user]);

  const getDisplayName = useCallback((): string => {
    if (!user) return 'Anonymous';
    
    if (user.farcaster?.isVerified) return user.farcaster.displayName;
    if (user.ens?.name) return user.ens.name;
    if (user.farcaster?.displayName) return user.farcaster.displayName;
    
    return user.displayName;
  }, [user]);

  const getAvatar = useCallback((): string | undefined => {
    if (!user) return undefined;
    
    if (user.ens?.avatar) return user.ens.avatar;
    if (user.farcaster?.pfpUrl) return user.farcaster.pfpUrl;
    
    return user.avatar;
  }, [user]);

  const getPrimaryAddress = useCallback((): string | undefined => {
    return user?.primaryAddress || account?.address;
  }, [user, account]);

  // Calculate authentication states
  const hasWallet = !!account?.address;
  const hasFarcaster = !!user?.farcaster;
  const hasENS = !!user?.ens;
  const isFullyAuthenticated = hasWallet || hasFarcaster;

  const value: IntegratedUserContextType = {
    // Current user
    user,
    isLoading,
    error,
    
    // Authentication states
    hasWallet,
    hasFarcaster,
    hasENS,
    isFullyAuthenticated,
    
    // Supabase auth state - FIXED with real JWT
    isSupabaseAuthenticated,
    supabaseAuthError,
    supabaseSession,
    isAuthenticating,
    
    // Actions
    refreshUser,
    switchUserView,
    clearError,
    
    // Auth actions - ENHANCED with real JWT
    ensureSupabaseAuth,
    authenticateWallet,
    signOut,
    
    // Integration helpers
    getEvermarkAuthorData,
    
    // Utilities
    getPrimaryIdentity,
    getIdentityScore,
    getDisplayName,
    getAvatar,
    getPrimaryAddress
  };

  return (
    <IntegratedUserContext.Provider value={value}>
      {children}
    </IntegratedUserContext.Provider>
  );
}

// Export hooks with enhanced authentication
export function useIntegratedUser(): IntegratedUserContextType {
  const context = useContext(IntegratedUserContext);
  if (!context) {
    throw new Error('useIntegratedUser must be used within IntegratedUserProvider');
  }
  return context;
}

export function useUserForEvermarks() {
  const { 
    getEvermarkAuthorData, 
    isFullyAuthenticated, 
    isSupabaseAuthenticated,
    ensureSupabaseAuth,
    authenticateWallet,
    user,
    hasWallet,
    hasFarcaster,
    supabaseAuthError,
    isAuthenticating
  } = useIntegratedUser();
  
  return {
    authorData: getEvermarkAuthorData(),
    isAuthenticated: isFullyAuthenticated,
    isSupabaseAuthenticated,
    canCreate: isFullyAuthenticated && isSupabaseAuthenticated,
    ensureSupabaseAuth,
    authenticateWallet,
    user,
    hasWallet,
    hasFarcaster,
    shouldShowFarcasterFeatures: hasFarcaster,
    authError: supabaseAuthError,
    isAuthenticating
  };
}

export function useUserIdentity() {
  const { 
    user, 
    getPrimaryIdentity, 
    getIdentityScore, 
    getDisplayName, 
    getAvatar,
    getPrimaryAddress 
  } = useIntegratedUser();
  
  return {
    user,
    primaryIdentity: getPrimaryIdentity(),
    identityScore: getIdentityScore(),
    displayName: getDisplayName(),
    avatar: getAvatar(),
    primaryAddress: getPrimaryAddress()
  };
}

export function useAuthenticationState() {
  const { 
    hasWallet, 
    hasFarcaster, 
    hasENS, 
    isFullyAuthenticated,
    isSupabaseAuthenticated,
    getPrimaryIdentity,
    getIdentityScore,
    isAuthenticating
  } = useIntegratedUser();
  
  return {
    hasWallet,
    hasFarcaster,
    hasENS,
    isAuthenticated: isFullyAuthenticated,
    isSupabaseAuthenticated,
    canUpload: isFullyAuthenticated && isSupabaseAuthenticated,
    primaryIdentity: getPrimaryIdentity(),
    identityScore: getIdentityScore(),
    isHybridUser: (hasWallet && hasFarcaster) || (hasWallet && hasENS) || (hasFarcaster && hasENS),
    isAuthenticating
  };
}