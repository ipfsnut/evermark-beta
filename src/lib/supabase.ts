import { createClient } from '@supabase/supabase-js';
import type { Account } from 'thirdweb/wallets';

// Singleton pattern - ensure we only create one instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}

// Create singleton instance with PROPER AUTH SUPPORT
function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false, // Manual token management for custom JWTs
        persistSession: true,    // Enable persistent sessions
        detectSessionInUrl: false, // Don't detect from URL params
        storageKey: 'evermark-supabase-auth',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'evermark-beta@2.0.0',
        },
      },
    });
  }
  
  return supabaseInstance;
}

// Export the singleton instance
export const supabase = getSupabaseClient();

// ========================================
// SECURE: Wallet Authentication with Signature Verification
// ========================================

interface AuthMessage {
  nonce: string;
  message: string;
}

interface AuthResult {
  success: boolean;
  session?: any;
  user?: any;
  error?: string;
}

/**
 * 🔐 SECURE: Authenticate with cryptographic signature verification
 * Replaces the insecure signInAnonymously() approach
 */
export const authenticateWithWallet = async (account: Account): Promise<AuthResult> => {
  try {
    console.log('🔐 Starting secure wallet authentication for:', account.address);

    // Step 1: Get nonce from backend
    const { nonce, message } = await generateAuthMessage(account.address);

    // Step 2: Sign message (this proves wallet ownership!)
    console.log('✍️ Requesting wallet signature for authentication...');
    const signature = await account.signMessage({ message });

    // Step 3: Verify with backend and get verified JWT
    console.log('🔍 Verifying signature with backend...');
    const authResponse = await fetch('/.netlify/functions/auth-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: account.address,
        message,
        signature,
        nonce
      })
    });

    if (!authResponse.ok) {
      const error = await authResponse.json().catch(() => ({ error: 'Authentication failed' }));
      throw new Error(error.error || 'Authentication failed');
    }

    const { jwt, user } = await authResponse.json();

    // Step 4: Create Supabase session with VERIFIED JWT
    console.log('🎫 Creating Supabase session with verified JWT...');
    const { data, error } = await supabase.auth.setSession({
      access_token: jwt,
      refresh_token: jwt, // Use same token (24hr lifetime)
    });

    if (error) {
      throw new Error(`Session creation failed: ${error.message}`);
    }

    console.log('✅ Secure authentication completed successfully');

    return {
      success: true,
      user: data.user,
      session: data.session
    };

  } catch (error) {
    console.error('❌ Secure authentication failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
};

/**
 * Generate SIWE-compatible authentication message
 */
async function generateAuthMessage(address: string): Promise<AuthMessage> {
  try {
    // Get nonce from backend
    const nonceResponse = await fetch('/.netlify/functions/auth-nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });

    if (!nonceResponse.ok) {
      throw new Error('Failed to get authentication nonce');
    }

    const { nonce } = await nonceResponse.json();

    // Create SIWE-compatible message
    const domain = window.location.hostname;
    const origin = window.location.origin;
    const now = new Date().toISOString();

    const message = `${domain} wants you to sign in with your Ethereum account:
${address}

Authenticate to Evermark Beta to create and manage your content.

URI: ${origin}
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${now}`;

    return { nonce, message };

  } catch (error) {
    console.error('Message generation failed:', error);
    throw new Error('Failed to generate authentication message');
  }
}

// ========================================
// ENHANCED: Auth State Management
// ========================================

/**
 * Check current authentication state with verification
 */
export const getAuthState = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Verify this is a wallet-authenticated session with signature verification
    const isWalletAuth = !!(
      user?.user_metadata?.wallet_address && 
      user?.user_metadata?.verified_signature
    );
    
    return {
      user,
      session,
      isAuthenticated: !!user && !!session && isWalletAuth,
      walletAddress: user?.user_metadata?.wallet_address,
      isVerified: isWalletAuth,
      error
    };
  } catch (error) {
    return {
      user: null,
      session: null,
      isAuthenticated: false,
      walletAddress: null,
      isVerified: false,
      error: error instanceof Error ? error.message : 'Auth check failed'
    };
  }
};

/**
 * Check if user is authenticated with verified signature
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const authState = await getAuthState();
    return authState.isAuthenticated && authState.isVerified;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
};

/**
 * Get current authenticated wallet address
 */
export const getWalletAddress = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.wallet_address || null;
  } catch (error) {
    console.error('Failed to get wallet address:', error);
    return null;
  }
};

/**
 * Sign out and clear session
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Sign-out failed:', error);
      return { success: false, error: error.message };
    }
    console.log('✅ User signed out successfully');
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sign-out failed' 
    };
  }
};

// ========================================
// LEGACY SUPPORT: Keep old function names but mark as deprecated
// ========================================

/**
 * @deprecated Use authenticateWithWallet() instead
 * This function is insecure and should not be used
 */
export const signInWithWallet = async (walletAddress: string) => {
  console.warn('⚠️ signInWithWallet is deprecated and insecure. Use authenticateWithWallet() instead.');
  
  // For now, just return an error to force migration
  return {
    success: false,
    error: 'This authentication method is deprecated. Please use secure signature verification.'
  };
};

// ========================================
// HEALTH CHECK: Test database connection
// ========================================
export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('evermarks').select('count').limit(1);
    return { connected: !error, error };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// ========================================
// DEBUG: Helper to reset client if needed
// ========================================
export const resetSupabaseClient = () => {
  supabaseInstance = null;
};

// ========================================
// UTILITIES: Auth debugging helpers
// ========================================
export const getAuthDebugInfo = async () => {
  try {
    const authState = await getAuthState();
    const connectionTest = await testSupabaseConnection();
    
    return {
      authState,
      connectionTest,
      environment: {
        hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
        hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...',
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Debug info failed',
      timestamp: new Date().toISOString()
    };
  }
};

// ========================================
// UPDATED: IntegratedUserProvider Integration
// ========================================

/**
 * Helper for IntegratedUserProvider to check auth without importing the whole provider
 */
export const checkSupabaseAuthForProvider = async () => {
  const authState = await getAuthState();
  return {
    isAuthenticated: authState.isAuthenticated,
    isVerified: authState.isVerified,
    walletAddress: authState.walletAddress,
    error: authState.error
  };
};