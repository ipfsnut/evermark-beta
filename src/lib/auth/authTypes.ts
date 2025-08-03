// src/lib/auth/authTypes.ts
// Authentication type definitions for dual-context system

import type { User, Session } from '@supabase/supabase-js';
import type { Account } from 'thirdweb/wallets';

// ==============================================
// CORE AUTH CONTEXT TYPES
// ==============================================

/**
 * Supported authentication contexts
 */
export type AuthContextType = 'farcaster' | 'thirdweb' | 'none';

/**
 * Farcaster user data structure
 */
export interface FarcasterUser {
  fid?: number;
  username?: string;
  displayName?: string;
  walletAddress?: string;
  address?: string;
  pfpUrl?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  verifications?: string[];
}

/**
 * Unified authentication context
 */
export interface AuthContext {
  /** Authentication type */
  type: AuthContextType;
  
  /** Whether user is connected/authenticated */
  isConnected: boolean;
  
  /** Wallet address from any context */
  walletAddress: string | null;
  
  /** Display name for UI */
  displayName: string | null;
  
  /** Username/handle */
  username: string | null;
  
  /** Raw user data from the auth provider */
  userInfo: FarcasterUser | Account | null;
  
  /** Additional context-specific data */
  metadata?: {
    fid?: number;
    pfpUrl?: string;
    verifications?: string[];
    chainId?: number;
    [key: string]: any;
  };
}

/**
 * Supabase authentication state
 */
export interface SupabaseAuthState {
  /** Current Supabase session */
  session: Session | null;
  
  /** Supabase user object */
  user: User | null;
  
  /** Whether Supabase session is loading */
  isLoading: boolean;
  
  /** Session creation/validation error */
  error: string | null;
  
  /** Last session refresh time */
  lastRefresh: Date | null;
}

// ==============================================
// AUTH BRIDGE TYPES
// ==============================================

/**
 * Auth bridge configuration
 */
export interface AuthBridgeConfig {
  /** Auto-create Supabase sessions when wallet connects */
  autoCreateSession: boolean;
  
  /** Session timeout in milliseconds */
  sessionTimeout: number;
  
  /** Whether to persist sessions across browser sessions */
  persistSession: boolean;
  
  /** Debug logging enabled */
  debug: boolean;
  
  /** Custom session metadata */
  sessionMetadata?: Record<string, any>;
}

/**
 * Session creation options
 */
export interface SessionCreationOptions {
  /** Wallet address */
  walletAddress: string;
  
  /** Authentication context type */
  contextType: AuthContextType;
  
  /** Original user info */
  userInfo: FarcasterUser | Account;
  
  /** Custom user metadata */
  metadata?: Record<string, any>;
  
  /** Force recreation if session exists */
  forceRecreate?: boolean;
}

/**
 * Session creation result
 */
export interface SessionCreationResult {
  /** Whether session creation was successful */
  success: boolean;
  
  /** Created session (if successful) */
  session: Session | null;
  
  /** Error message (if failed) */
  error: string | null;
  
  /** Whether session was newly created or existing */
  wasCreated: boolean;
  
  /** Session metadata */
  metadata?: Record<string, any>;
}

// ==============================================
// HOOK RETURN TYPES
// ==============================================

/**
 * Enhanced useAppAuth hook return type
 */
export interface UseAppAuthReturn {
  // Legacy compatibility (keep existing interface)
  isAuthenticated: boolean;
  user: {
    displayName: string | null;
    username: string | null;
    walletAddress: string | null;
    authType?: AuthContextType;
  } | null;
  requireAuth: () => Promise<boolean>;
  
  // Enhanced auth context
  authContext: AuthContext;
  account: FarcasterUser | Account | null; // Raw account from provider
  
  // Supabase integration
  supabaseAuth: SupabaseAuthState;
  
  // Context flags
  isInFarcaster: boolean;
  isWalletConnected: boolean;
  isFarcasterUser: boolean;
  isThirdwebUser: boolean;
  
  // Auth actions
  createSupabaseSession: (options: SessionCreationOptions) => Promise<SessionCreationResult>;
  refreshAuthState: () => Promise<void>;
  signOut: () => Promise<void>;
  
  // Debug helpers
  getAuthDebugInfo: () => AuthDebugInfo;
}

/**
 * Auth debug information
 */
export interface AuthDebugInfo {
  authContext: AuthContext;
  supabaseAuth: SupabaseAuthState;
  connectionStatus: {
    wallet: boolean;
    farcaster: boolean;
    supabase: boolean;
  };
  lastActions: {
    lastConnect?: Date;
    lastSessionCreate?: Date;
    lastRefresh?: Date;
    lastError?: Date;
  };
  environment: {
    isInFarcaster: boolean;
    hasSupabaseConfig: boolean;
    hasWalletProvider: boolean;
  };
}

// ==============================================
// STORAGE AUTH TYPES
// ==============================================

/**
 * Storage authentication configuration
 */
export interface StorageAuthConfig {
  /** Base storage configuration */
  baseConfig: any; // From SDK
  
  /** Authentication context */
  authContext: AuthContext;
  
  /** Supabase session */
  session: Session | null;
  
  /** Custom headers for storage requests */
  customHeaders?: Record<string, string>;
}

/**
 * Storage auth validation result
 */
export interface StorageAuthValidation {
  /** Whether storage auth is valid */
  isValid: boolean;
  
  /** Validation error if invalid */
  error: string | null;
  
  /** Suggested fixes for invalid auth */
  suggestions: string[];
  
  /** Auth context used for validation */
  authContext: AuthContext;
}

// ==============================================
// ERROR TYPES
// ==============================================

/**
 * Authentication error types
 */
export enum AuthErrorType {
  NO_WALLET = 'NO_WALLET',
  NO_FARCASTER = 'NO_FARCASTER',
  SUPABASE_SESSION_FAILED = 'SUPABASE_SESSION_FAILED',
  INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CONTEXT_MISMATCH = 'CONTEXT_MISMATCH',
  STORAGE_AUTH_FAILED = 'STORAGE_AUTH_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Structured authentication error
 */
export class AuthError extends Error {
  public readonly type: AuthErrorType;
  public readonly context: AuthContextType;
  public readonly metadata?: Record<string, any>;
  
  constructor(
    type: AuthErrorType,
    message: string,
    context: AuthContextType = 'none',
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.context = context;
    this.metadata = metadata;
  }
  
  static noWallet(): AuthError {
    return new AuthError(
      AuthErrorType.NO_WALLET,
      'No wallet connected. Please connect your wallet to continue.',
      'none'
    );
  }
  
  static noFarcaster(): AuthError {
    return new AuthError(
      AuthErrorType.NO_FARCASTER,
      'Farcaster authentication required. Please authenticate with Farcaster.',
      'farcaster'
    );
  }
  
  static supabaseSessionFailed(details?: string): AuthError {
    return new AuthError(
      AuthErrorType.SUPABASE_SESSION_FAILED,
      `Failed to create Supabase session${details ? `: ${details}` : ''}`,
      'none',
      { details }
    );
  }
  
  static storageAuthFailed(reason?: string): AuthError {
    return new AuthError(
      AuthErrorType.STORAGE_AUTH_FAILED,
      `Storage authentication failed${reason ? `: ${reason}` : ''}`,
      'none',
      { reason }
    );
  }
}

// ==============================================
// EVENT TYPES
// ==============================================

/**
 * Authentication event types
 */
export enum AuthEventType {
  WALLET_CONNECTED = 'WALLET_CONNECTED',
  WALLET_DISCONNECTED = 'WALLET_DISCONNECTED',
  FARCASTER_CONNECTED = 'FARCASTER_CONNECTED',
  FARCASTER_DISCONNECTED = 'FARCASTER_DISCONNECTED',
  SUPABASE_SESSION_CREATED = 'SUPABASE_SESSION_CREATED',
  SUPABASE_SESSION_REFRESHED = 'SUPABASE_SESSION_REFRESHED',
  SUPABASE_SESSION_EXPIRED = 'SUPABASE_SESSION_EXPIRED',
  AUTH_ERROR = 'AUTH_ERROR'
}

/**
 * Authentication event data
 */
export interface AuthEvent {
  type: AuthEventType;
  timestamp: Date;
  context: AuthContext;
  data?: Record<string, any>;
  error?: AuthError;
}

/**
 * Auth event handler
 */
export type AuthEventHandler = (event: AuthEvent) => void;

// ==============================================
// CONSTANTS
// ==============================================

/**
 * Default auth bridge configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthBridgeConfig = {
  autoCreateSession: true,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  persistSession: true,
  debug: process.env.NODE_ENV === 'development'
};

/**
 * Auth context detection patterns
 */
export const FARCASTER_DETECTION_PATTERNS = [
  'farcaster-',
  'warpcast-app',
  'farcaster.xyz',
  'warpcast.com',
  'inFeed=true',
  'action_type=share'
] as const;

/**
 * Wallet address validation regex
 */
export const WALLET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;