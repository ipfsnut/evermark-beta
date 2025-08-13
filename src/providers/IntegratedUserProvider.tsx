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
  
  // Wallet auth state - simplified
  isWalletAuthenticated: boolean;
  walletAuthError: string | null;
  isAuthenticating: boolean;
  
  // User actions
  refreshUser: () => Promise<void>;
  switchUserView: (source: 'farcaster' | 'ens' | 'wallet') => void;
  clearError: () => void;
  
  // Auth actions - simplified wallet auth
  ensureWalletAuth: () => Promise<boolean>;
  authenticateWallet: () => Promise<boolean>;
  signOut: () => void;
  
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
  
  // Simplified wallet authentication state
  const [isWalletAuthenticated, setIsWalletAuthenticated] = useState(false);
  const [walletAuthError, setWalletAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Load user profile when authentication state changes
  useEffect(() => {
    loadUserProfile();
  }, [account?.address, farcaster.user?.fid, farcaster.isAuthenticated]);

  // Check existing wallet auth on mount
  useEffect(() => {
    checkExistingWalletAuth();
  }, []);

  // Auto-authenticate when wallet connects (optional - you can disable this)
  useEffect(() => {
    if (account?.address && !isWalletAuthenticated && !isAuthenticating) {
      // Auto-authenticate on wallet connection
      // Comment this out if you prefer manual authentication
      authenticateWallet();
    }
  }, [account?.address]);

  /**
   * Check if there's an existing valid wallet auth
   */
  const checkExistingWalletAuth = useCallback(() => {
    try {
      const storedAuth = localStorage.getItem('evermark-wallet-auth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        if (authData.expires_at && new Date(authData.expires_at) > new Date()) {
          console.log('✅ Found existing wallet auth');
          setAuthToken(authData.auth_token);
          setIsWalletAuthenticated(true);
          setWalletAuthError(null);
        } else {
          console.log('⚠️ Wallet auth expired');
          localStorage.removeItem('evermark-wallet-auth');
        }
      }
    } catch (error) {
      console.error('Failed to check existing wallet auth:', error);
      localStorage.removeItem('evermark-wallet-auth');
    }
  }, []);

  /**
   * Simplified wallet authentication for NFT creation
   */
  const authenticateWallet = useCallback(async (): Promise<boolean> => {
    if (!account) {
      setWalletAuthError('No wallet connected');
      return false;
    }

    setIsAuthenticating(true);
    setWalletAuthError(null);
    
    try {
      console.log('🔐 Starting wallet authentication flow...');
      
      // Use the simplified wallet authentication service
      const authResult: WalletAuthResult = await WalletAuthService.authenticateWallet(account);
      
      if (!authResult.success) {
        const friendlyError = WalletAuthService.getErrorMessage(authResult.error || 'Authentication failed');
        setWalletAuthError(friendlyError);
        return false;
      }

      if (!authResult.user || !authResult.auth_token) {
        setWalletAuthError('No auth token received from authentication');
        return false;
      }

      // Store auth data locally
      const authData = {
        auth_token: authResult.auth_token,
        expires_at: authResult.expires_at,
        wallet_address: authResult.user.wallet_address
      };
      localStorage.setItem('evermark-wallet-auth', JSON.stringify(authData));

      // Success!
      setAuthToken(authResult.auth_token);
      setIsWalletAuthenticated(true);
      setWalletAuthError(null);
      
      console.log('✅ Wallet authentication complete! Ready for NFT creation.');
      
      return true;

    } catch (error) {
      console.error('❌ Wallet authentication failed:', error);
      const friendlyError = WalletAuthService.getErrorMessage(
        error instanceof Error ? error.message : 'Authentication failed'
      );
      setWalletAuthError(friendlyError);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [account]);

  /**
   * Ensure authentication - calls authenticateWallet if needed
   */
  const ensureWalletAuth = useCallback(async (): Promise<boolean> => {
    // Check if already authenticated and token is valid
    if (isWalletAuthenticated && authToken) {
      const storedAuth = localStorage.getItem('evermark-wallet-auth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        if (authData.expires_at && new Date(authData.expires_at) > new Date()) {
          return true;
        }
      }
      // Token expired, clear state
      console.log('🔄 Auth token expired, re-authenticating...');
      setIsWalletAuthenticated(false);
      setAuthToken(null);
      localStorage.removeItem('evermark-wallet-auth');
    }

    if (!account?.address) {
      setWalletAuthError('Please connect your wallet first');
      return false;
    }

    console.log('🔄 Ensuring wallet authentication...');
    return await authenticateWallet();
  }, [isWalletAuthenticated, authToken, account?.address, authenticateWallet]);

  /**
   * Sign out and clear wallet auth
   */
  const signOut = useCallback(() => {
    try {
      localStorage.removeItem('evermark-wallet-auth');
      setAuthToken(null);
      setIsWalletAuthenticated(false);
      setWalletAuthError(null);
      
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
    setWalletAuthError(null);
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
    
    // Wallet auth state - simplified
    isWalletAuthenticated,
    walletAuthError,
    isAuthenticating,
    
    // Actions
    refreshUser,
    switchUserView,
    clearError,
    
    // Auth actions - simplified wallet auth
    ensureWalletAuth,
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
    isWalletAuthenticated,
    ensureWalletAuth,
    authenticateWallet,
    user,
    hasWallet,
    hasFarcaster,
    walletAuthError,
    isAuthenticating
  } = useIntegratedUser();
  
  return {
    authorData: getEvermarkAuthorData(),
    isAuthenticated: isFullyAuthenticated,
    isWalletAuthenticated,
    canCreate: isFullyAuthenticated && isWalletAuthenticated,
    ensureWalletAuth,
    authenticateWallet,
    user,
    hasWallet,
    hasFarcaster,
    shouldShowFarcasterFeatures: hasFarcaster,
    authError: walletAuthError,
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
    isWalletAuthenticated,
    getPrimaryIdentity,
    getIdentityScore,
    isAuthenticating
  } = useIntegratedUser();
  
  return {
    hasWallet,
    hasFarcaster,
    hasENS,
    isAuthenticated: isFullyAuthenticated,
    isWalletAuthenticated,
    canUpload: isFullyAuthenticated && isWalletAuthenticated,
    primaryIdentity: getPrimaryIdentity(),
    identityScore: getIdentityScore(),
    isHybridUser: (hasWallet && hasFarcaster) || (hasWallet && hasENS) || (hasFarcaster && hasENS),
    isAuthenticating
  };
}