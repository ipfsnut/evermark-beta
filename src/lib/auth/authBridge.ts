// src/lib/auth/authBridge.ts - FID-based authentication bridge
// Integrates Farcaster auth with existing Thirdweb/Supabase setup

import { supabase } from '../supabase';
import type { AppFarcasterUser } from '../neynar/neynarTypes';

interface AuthSession {
  sessionId: string;
  userId: string;
  farcasterFid?: number;
  farcasterUsername?: string;
  walletAddress?: string;
  createdAt: string;
  expiresAt: string;
  metadata: {
    authMethod: 'farcaster' | 'wallet' | 'hybrid';
    displayName?: string;
    pfpUrl?: string;
    verifiedAddresses?: string[];
  };
}

interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

export class FarcasterAuthBridge {
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly SESSION_KEY = 'evermark_auth_session';

  /**
   * Create FID-based session (primary authentication method for Farcaster users)
   */
  static async createFarcasterSession(
    farcasterUser: AppFarcasterUser,
    walletAddress?: string
  ): Promise<AuthResult> {
    try {
      console.log('🔐 Creating Farcaster-based session for FID:', farcasterUser.fid);

      // Generate session ID
      const sessionId = this.generateSessionId('farcaster', farcasterUser.fid.toString());
      
      // Create user ID (FID-based for consistency)
      const userId = `fid-${farcasterUser.fid}`;

      // Session metadata
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.SESSION_DURATION);

      const session: AuthSession = {
        sessionId,
        userId,
        farcasterFid: farcasterUser.fid,
        farcasterUsername: farcasterUser.username,
        walletAddress,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadata: {
          authMethod: walletAddress ? 'hybrid' : 'farcaster',
          displayName: farcasterUser.displayName,
          pfpUrl: farcasterUser.pfpUrl,
          verifiedAddresses: farcasterUser.verifiedAddresses
        }
      };

      // Store session in localStorage
      this.storeSession(session);

      // Create/update user record in Supabase with Farcaster data
      await this.upsertFarcasterUser(farcasterUser, walletAddress);

      // Set Supabase auth context (custom JWT or similar)
      await this.setSupabaseAuthContext(session);

      console.log('✅ Farcaster session created successfully');

      return {
        success: true,
        session
      };

    } catch (error) {
      console.error('❌ Failed to create Farcaster session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session creation failed'
      };
    }
  }

  /**
   * Create wallet-based session (fallback for non-Farcaster users)
   */
  static async createWalletSession(walletAddress: string): Promise<AuthResult> {
    try {
      console.log('🔐 Creating wallet-based session for:', walletAddress);

      const sessionId = this.generateSessionId('wallet', walletAddress);
      const userId = `wallet-${walletAddress.toLowerCase()}`;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.SESSION_DURATION);

      const session: AuthSession = {
        sessionId,
        userId,
        walletAddress,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadata: {
          authMethod: 'wallet'
        }
      };

      this.storeSession(session);
      await this.setSupabaseAuthContext(session);

      console.log('✅ Wallet session created successfully');

      return {
        success: true,
        session
      };

    } catch (error) {
      console.error('❌ Failed to create wallet session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session creation failed'
      };
    }
  }

  /**
   * Upgrade wallet session to hybrid (wallet + Farcaster)
   */
  static async upgradeToHybridSession(
    currentSession: AuthSession,
    farcasterUser: AppFarcasterUser
  ): Promise<AuthResult> {
    try {
      console.log('🔄 Upgrading to hybrid session');

      // Create new hybrid session
      const hybridSession: AuthSession = {
        ...currentSession,
        farcasterFid: farcasterUser.fid,
        farcasterUsername: farcasterUser.username,
        metadata: {
          ...currentSession.metadata,
          authMethod: 'hybrid',
          displayName: farcasterUser.displayName,
          pfpUrl: farcasterUser.pfpUrl,
          verifiedAddresses: farcasterUser.verifiedAddresses
        }
      };

      this.storeSession(hybridSession);
      await this.upsertFarcasterUser(farcasterUser, currentSession.walletAddress);
      await this.setSupabaseAuthContext(hybridSession);

      console.log('✅ Session upgraded to hybrid successfully');

      return {
        success: true,
        session: hybridSession
      };

    } catch (error) {
      console.error('❌ Failed to upgrade session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session upgrade failed'
      };
    }
  }

  /**
   * Get current session
   */
  static getCurrentSession(): AuthSession | null {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;

      const session: AuthSession = JSON.parse(sessionData);
      
      // Check if session is expired
      if (new Date() > new Date(session.expiresAt)) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to get current session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Clear session
   */
  static clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
    // Could also clear Supabase auth context here
  }

  /**
   * Check if user is authenticated with any method
   */
  static isAuthenticated(): boolean {
    return !!this.getCurrentSession();
  }

  /**
   * Check if user has Farcaster authentication
   */
  static hasFarcasterAuth(): boolean {
    const session = this.getCurrentSession();
    return !!(session?.farcasterFid);
  }

  /**
   * Get user context for database operations
   */
  static getUserContext(): {
    userId: string;
    farcasterFid?: number;
    farcasterUsername?: string;
    walletAddress?: string;
    authMethod: 'farcaster' | 'wallet' | 'hybrid';
  } | null {
    const session = this.getCurrentSession();
    if (!session) return null;

    return {
      userId: session.userId,
      farcasterFid: session.farcasterFid,
      farcasterUsername: session.farcasterUsername,
      walletAddress: session.walletAddress,
      authMethod: session.metadata.authMethod
    };
  }

  /**
   * Private: Generate session ID
   */
  private static generateSessionId(type: string, identifier: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${type}_${identifier}_${timestamp}_${random}`;
  }

  /**
   * Private: Store session in localStorage
   */
  private static storeSession(session: AuthSession): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Private: Create/update Farcaster user in database
   */
  private static async upsertFarcasterUser(
    farcasterUser: AppFarcasterUser,
    walletAddress?: string
  ): Promise<void> {
    try {
      const userData = {
        farcaster_fid: farcasterUser.fid,
        farcaster_username: farcasterUser.username,
        display_name: farcasterUser.displayName,
        pfp_url: farcasterUser.pfpUrl,
        bio: farcasterUser.bio,
        follower_count: farcasterUser.followerCount,
        following_count: farcasterUser.followingCount,
        verified_addresses: farcasterUser.verifiedAddresses,
        is_verified: farcasterUser.isVerified,
        has_power_badge: farcasterUser.hasPowerBadge,
        wallet_address: walletAddress,
        updated_at: new Date().toISOString()
      };

      // Upsert user record
      const { error } = await supabase
        .from('farcaster_users')
        .upsert(userData, {
          onConflict: 'farcaster_fid',
          ignoreDuplicates: false
        });

      if (error) {
        console.warn('Failed to upsert Farcaster user (non-critical):', error);
      }
    } catch (error) {
      console.warn('Database user upsert failed (non-critical):', error);
    }
  }

  /**
   * Private: Set Supabase auth context
   */
  private static async setSupabaseAuthContext(session: AuthSession): Promise<void> {
    try {
      // This is where you'd set custom JWT or auth context in Supabase
      // For now, we'll use RLS policies based on user_id
      
      // You could also set a custom header or use signInWithPassword with custom logic
      // Implementation depends on your specific Supabase RLS setup
      
      console.log('Setting Supabase auth context for:', session.userId);
      
      // Example: Set custom headers for RLS
      // This would require custom RLS policies that check these values
      
    } catch (error) {
      console.warn('Failed to set Supabase auth context:', error);
    }
  }

  /**
   * Get authentication status for UI
   */
  static getAuthStatus() {
    const session = this.getCurrentSession();
    
    return {
      isAuthenticated: !!session,
      authMethod: session?.metadata.authMethod || null,
      hasFarcaster: !!session?.farcasterFid,
      hasWallet: !!session?.walletAddress,
      user: session ? {
        userId: session.userId,
        displayName: session.metadata.displayName,
        username: session.farcasterUsername,
        pfpUrl: session.metadata.pfpUrl,
        walletAddress: session.walletAddress
      } : null
    };
  }

  /**
   * For debugging and development
   */
  static getDebugInfo() {
    const session = this.getCurrentSession();
    
    return {
      hasSession: !!session,
      sessionExpiry: session?.expiresAt,
      authMethod: session?.metadata.authMethod,
      farcasterFid: session?.farcasterFid,
      walletAddress: session?.walletAddress,
      sessionAge: session ? Date.now() - new Date(session.createdAt).getTime() : null
    };
  }
}

// Hook for React components
export function useAuthBridge() {
  const session = FarcasterAuthBridge.getCurrentSession();
  const authStatus = FarcasterAuthBridge.getAuthStatus();

  return {
    ...authStatus,
    session,
    createFarcasterSession: FarcasterAuthBridge.createFarcasterSession,
    createWalletSession: FarcasterAuthBridge.createWalletSession,
    upgradeToHybridSession: FarcasterAuthBridge.upgradeToHybridSession,
    clearSession: FarcasterAuthBridge.clearSession,
    getUserContext: FarcasterAuthBridge.getUserContext
  };
}