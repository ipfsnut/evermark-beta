// src/services/UserAuthService.ts
// Manages user authentication state - Thirdweb + Farcaster integration

import { farcasterUserService } from './FarcasterUserService';
import type { AppFarcasterUser } from '../lib/neynar/neynarTypes';

export interface AuthenticatedUser {
  // Identity
  id: string; // Unique identifier for this user
  displayName: string;
  avatar?: string;
  
  // Authentication methods
  wallet?: {
    address: string;
    isConnected: boolean;
    walletType?: string; // metamask, coinbase, etc
  };
  
  farcaster?: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
    isVerified: boolean;
    verifiedAddresses: string[];
  };
  
  // Session info
  authMethod: 'wallet' | 'farcaster' | 'hybrid'; // How they authenticated
  sessionId: string;
  authenticatedAt: string;
  expiresAt: string;
}

export interface AuthState {
  // Current state
  isAuthenticated: boolean;
  user: AuthenticatedUser | null;
  isLoading: boolean;
  error: string | null;
  
  // Connection states
  isWalletConnected: boolean;
  isFarcasterConnected: boolean;
  isInFarcasterFrame: boolean;
  
  // Capabilities
  canCreateEvermarks: boolean;
  canSignTransactions: boolean;
}

export class UserAuthService {
  private static currentUser: AuthenticatedUser | null = null;
  private static sessionListeners: Array<(user: AuthenticatedUser | null) => void> = [];

  /**
   * THIRDWEB INTEGRATION: Check wallet connection
   */
  static checkWalletConnection() {
    // This should be called from a React component that has access to Thirdweb hooks
    // We'll provide a hook-based interface for this
    return {
      isConnected: false, // Will be provided by hook
      address: null as string | null,
      walletType: null as string | null
    };
  }

  /**
   * FARCASTER INTEGRATION: Check Farcaster authentication
   */
  static async checkFarcasterAuth(): Promise<{
    isAuthenticated: boolean;
    user: AppFarcasterUser | null;
    isInFrame: boolean;
  }> {
    try {
      // Check if we're in a Farcaster frame
      const isInFrame = this.detectFarcasterFrame();
      
      if (!isInFrame) {
        return { isAuthenticated: false, user: null, isInFrame: false };
      }

      // Try to get user from Frame SDK context
      const frameUser = this.getFarcasterFrameUser();
      
      if (frameUser?.fid) {
        // Fetch full profile from Neynar
        const fullUser = await farcasterUserService.fetchUserByFid(frameUser.fid);
        return {
          isAuthenticated: !!fullUser,
          user: fullUser,
          isInFrame: true
        };
      }

      return { isAuthenticated: false, user: null, isInFrame: true };
    } catch (error) {
      console.error('Failed to check Farcaster auth:', error);
      return { isAuthenticated: false, user: null, isInFrame: false };
    }
  }

  /**
   * Create authenticated user from wallet connection
   */
  static async authenticateWithWallet(
    address: string, 
    walletType: string
  ): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
    try {
      console.log('🔐 Authenticating with wallet:', address);

      // Try to enhance with Farcaster data if available
      let farcasterData: AppFarcasterUser | null = null;
      try {
        // This would require a reverse lookup - placeholder for now
        // farcasterData = await this.findFarcasterByAddress(address);
      } catch (error) {
        console.log('No Farcaster data found for wallet address');
      }

      const user: AuthenticatedUser = {
        id: `wallet-${address}`,
        displayName: farcasterData?.displayName || this.formatAddress(address),
        avatar: farcasterData?.pfpUrl,
        
        wallet: {
          address,
          isConnected: true,
          walletType
        },
        
        farcaster: farcasterData ? {
          fid: farcasterData.fid,
          username: farcasterData.username,
          displayName: farcasterData.displayName,
          pfpUrl: farcasterData.pfpUrl,
          isVerified: farcasterData.isVerified,
          verifiedAddresses: farcasterData.verifiedAddresses
        } : undefined,
        
        authMethod: farcasterData ? 'hybrid' : 'wallet',
        sessionId: this.generateSessionId(),
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      this.setCurrentUser(user);
      this.persistSession(user);

      console.log('✅ Wallet authentication successful');
      return { success: true, user };

    } catch (error) {
      console.error('❌ Wallet authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Create authenticated user from Farcaster
   */
  static async authenticateWithFarcaster(
    farcasterUser: AppFarcasterUser,
    walletAddress?: string
  ): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
    try {
      console.log('🔐 Authenticating with Farcaster FID:', farcasterUser.fid);

      const user: AuthenticatedUser = {
        id: `farcaster-${farcasterUser.fid}`,
        displayName: farcasterUser.displayName,
        avatar: farcasterUser.pfpUrl,
        
        wallet: walletAddress ? {
          address: walletAddress,
          isConnected: true,
          walletType: 'frame' // Connected through Farcaster frame
        } : undefined,
        
        farcaster: {
          fid: farcasterUser.fid,
          username: farcasterUser.username,
          displayName: farcasterUser.displayName,
          pfpUrl: farcasterUser.pfpUrl,
          isVerified: farcasterUser.isVerified,
          verifiedAddresses: farcasterUser.verifiedAddresses
        },
        
        authMethod: walletAddress ? 'hybrid' : 'farcaster',
        sessionId: this.generateSessionId(),
        authenticatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };

      this.setCurrentUser(user);
      this.persistSession(user);

      console.log('✅ Farcaster authentication successful');
      return { success: true, user };

    } catch (error) {
      console.error('❌ Farcaster authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Get current authentication state
   */
  static getAuthState(): AuthState {
    const user = this.getCurrentUser();
    
    return {
      isAuthenticated: !!user,
      user,
      isLoading: false, // This would be managed by the React hook
      error: null, // This would be managed by the React hook
      
      isWalletConnected: !!user?.wallet?.isConnected,
      isFarcasterConnected: !!user?.farcaster,
      isInFarcasterFrame: this.detectFarcasterFrame(),
      
      canCreateEvermarks: !!user && (!!user.wallet || !!user.farcaster),
      canSignTransactions: !!user?.wallet?.isConnected
    };
  }

  /**
   * Get user data formatted for evermark creation
   */
  static getEvermarkCreatorData(): {
    author: string;
    displayName: string;
    avatar?: string;
    walletAddress?: string;
    farcasterFid?: number;
    farcasterUsername?: string;
    createdVia: 'web' | 'farcaster';
  } | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    return {
      author: user.farcaster?.username ? `@${user.farcaster.username}` : this.formatAddress(user.wallet?.address || ''),
      displayName: user.displayName,
      avatar: user.avatar,
      walletAddress: user.wallet?.address,
      farcasterFid: user.farcaster?.fid,
      farcasterUsername: user.farcaster?.username,
      createdVia: user.farcaster ? 'farcaster' : 'web'
    };
  }

  /**
   * Sign out user
   */
  static signOut(): void {
    console.log('🔐 Signing out user');
    this.setCurrentUser(null);
    this.clearSession();
  }

  /**
   * Session management
   */
  static getCurrentUser(): AuthenticatedUser | null {
    // Try memory first
    if (this.currentUser) return this.currentUser;
    
    // Try to restore from storage
    const restored = this.restoreSession();
    if (restored) {
      this.currentUser = restored;
      return restored;
    }
    
    return null;
  }

  private static setCurrentUser(user: AuthenticatedUser | null): void {
    this.currentUser = user;
    // Notify listeners
    this.sessionListeners.forEach(listener => listener(user));
  }

  private static persistSession(user: AuthenticatedUser): void {
    try {
      localStorage.setItem('evermark_auth_session', JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to persist session:', error);
    }
  }

  private static restoreSession(): AuthenticatedUser | null {
    try {
      const stored = localStorage.getItem('evermark_auth_session');
      if (!stored) return null;

      const user: AuthenticatedUser = JSON.parse(stored);
      
      // Check if session is expired
      if (new Date() > new Date(user.expiresAt)) {
        this.clearSession();
        return null;
      }

      return user;
    } catch (error) {
      console.warn('Failed to restore session:', error);
      this.clearSession();
      return null;
    }
  }

  private static clearSession(): void {
    try {
      localStorage.removeItem('evermark_auth_session');
    } catch (error) {
      console.warn('Failed to clear session:', error);
    }
  }

  /**
   * Farcaster frame detection
   */
  private static detectFarcasterFrame(): boolean {
    if (typeof window === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    return (
      ua.includes('farcaster-') ||
      ua.includes('warpcast-app') ||
      url.includes('farcaster.xyz') ||
      url.includes('warpcast.com') ||
      window.location.search.includes('inFeed=true') ||
      (window as any).__evermark_farcaster_detected === true
    );
  }

  private static getFarcasterFrameUser(): { fid?: number; username?: string } | null {
    try {
      if (typeof window !== 'undefined' && (window as any).FrameSDK?.context?.user) {
        return (window as any).FrameSDK.context.user;
      }
      return null;
    } catch (error) {
      console.warn('Failed to get Farcaster frame user:', error);
      return null;
    }
  }

  /**
   * Utilities
   */
  private static formatAddress(address: string): string {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Add session listener for React components
   */
  static addSessionListener(listener: (user: AuthenticatedUser | null) => void): () => void {
    this.sessionListeners.push(listener);
    return () => {
      const index = this.sessionListeners.indexOf(listener);
      if (index > -1) {
        this.sessionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Debug info
   */
  static getDebugInfo() {
    const user = this.getCurrentUser();
    
    return {
      hasUser: !!user,
      authMethod: user?.authMethod,
      hasWallet: !!user?.wallet,
      hasFarcaster: !!user?.farcaster,
      isInFrame: this.detectFarcasterFrame(),
      sessionExpiry: user?.expiresAt,
      capabilities: {
        canCreate: this.getAuthState().canCreateEvermarks,
        canSign: this.getAuthState().canSignTransactions
      }
    };
  }
}