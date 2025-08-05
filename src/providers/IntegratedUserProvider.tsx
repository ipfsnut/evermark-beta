import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useFarcasterUser } from '../lib/farcaster';
import { EnhancedUserService, type EnhancedUser } from '../services';

// UPDATED: Import the new secure auth function
import { authenticateWithWallet, getAuthState } from '../lib/supabase';

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
  
  // Supabase auth state
  isSupabaseAuthenticated: boolean;
  supabaseAuthError: string | null;
  
  // User actions
  refreshUser: () => Promise<void>;
  switchUserView: (source: 'farcaster' | 'ens' | 'wallet') => void;
  clearError: () => void;
  
  // Auth actions
  ensureSupabaseAuth: () => Promise<boolean>;
  
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
  
  // Supabase auth state
  const [isSupabaseAuthenticated, setIsSupabaseAuthenticated] = useState(false);
  const [supabaseAuthError, setSupabaseAuthError] = useState<string | null>(null);

  // Load user profile when authentication state changes
  useEffect(() => {
    loadUserProfile();
  }, [account?.address, farcaster.user?.fid, farcaster.isAuthenticated]);

  // Check Supabase auth state on mount
  useEffect(() => {
    checkSupabaseAuthState();
  }, []);

  // Function to check current Supabase auth state
  const checkSupabaseAuthState = useCallback(async () => {
    try {
      const authState = await getAuthState();
      setIsSupabaseAuthenticated(authState.isAuthenticated && authState.isVerified);
      
      if (authState.error) {
        const errorMessage = typeof authState.error === 'string' 
          ? authState.error 
          : authState.error.message;
        setSupabaseAuthError(errorMessage);
      } else {
        setSupabaseAuthError(null);
      }
      
      console.log('🔍 Supabase auth state:', {
        isAuthenticated: authState.isAuthenticated,
        isVerified: authState.isVerified,
        hasUser: !!authState.user,
        hasSession: !!authState.session
      });
    } catch (error) {
      console.error('Failed to check Supabase auth state:', error);
      setSupabaseAuthError('Failed to check authentication');
    }
  }, []);

  // ========================================
  // 🔑 THE KEY CHANGE: Secure Authentication
  // ========================================
  
  // UPDATED: Use secure signature-based authentication
  const ensureSupabaseAuth = useCallback(async (): Promise<boolean> => {
    try {
      // Check if already authenticated with verified signature
      const authState = await getAuthState();
      const hasVerifiedAuth = !!(
        authState.isAuthenticated && 
        authState.isVerified &&
        authState.user?.user_metadata?.verified_signature
      );

      if (hasVerifiedAuth) {
        setIsSupabaseAuthenticated(true);
        setSupabaseAuthError(null);
        return true;
      }

      // Need a wallet to authenticate
      if (!account?.address) {
        setSupabaseAuthError('No wallet connected for authentication');
        return false;
      }

      console.log('🔐 Starting secure wallet authentication...');
      
      // 🔑 THE CRITICAL CHANGE: Use secure authentication instead of anonymous
      const authResult = await authenticateWithWallet(account);
      
      if (authResult.success) {
        console.log('✅ Secure authentication successful');
        setIsSupabaseAuthenticated(true);
        setSupabaseAuthError(null);
        return true;
      } else {
        console.error('❌ Authentication failed:', authResult.error);
        setSupabaseAuthError(authResult.error || 'Authentication failed');
        return false;
      }
    } catch (error) {
      console.error('❌ Authentication error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setSupabaseAuthError(errorMessage);
      return false;
    }
  }, [account?.address]);

  // ========================================
  // ALL OTHER FUNCTIONS STAY EXACTLY THE SAME
  // ========================================

  const loadUserProfile = useCallback(async () => {
    if (!account?.address && !farcaster.user) {
      setUser(null);
      setIsSupabaseAuthenticated(false);
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

        // Automatically ensure Supabase auth after user is loaded
        const walletAddress = enhancedUser.primaryAddress || account?.address;
        if (walletAddress && !isSupabaseAuthenticated) {
          console.log('🔐 Auto-ensuring Supabase authentication for user...');
          await ensureSupabaseAuth();
        }
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
  }, [account?.address, farcaster.user, farcaster.isAuthenticated, isSupabaseAuthenticated, ensureSupabaseAuth]);

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

  // Utility functions (unchanged)
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
    
    // Supabase auth state
    isSupabaseAuthenticated,
    supabaseAuthError,
    
    // Actions
    refreshUser,
    switchUserView,
    clearError,
    
    // Auth actions
    ensureSupabaseAuth, // ← This is the only function that changed!
    
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

// All the existing hook exports stay exactly the same
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
    user,
    hasWallet,
    hasFarcaster,
    supabaseAuthError
  } = useIntegratedUser();
  
  return {
    authorData: getEvermarkAuthorData(),
    isAuthenticated: isFullyAuthenticated,
    isSupabaseAuthenticated,
    canCreate: isFullyAuthenticated && isSupabaseAuthenticated,
    ensureSupabaseAuth,
    user,
    hasWallet,
    hasFarcaster,
    shouldShowFarcasterFeatures: hasFarcaster,
    authError: supabaseAuthError
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
    getIdentityScore 
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
    isHybridUser: (hasWallet && hasFarcaster) || (hasWallet && hasENS) || (hasFarcaster && hasENS)
  };
}
