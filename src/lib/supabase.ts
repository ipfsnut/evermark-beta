// ========================================
// MINIMAL CHANGES: src/lib/supabase.ts 
// Keep ALL your existing code, just ADD secure auth
// ========================================

// src/lib/supabase.ts - Fixed Supabase client with authentication support
import { createClient } from '@supabase/supabase-js';
import type { Account } from 'thirdweb/wallets'; // ADDED: For new auth function

// Ensure we only create one instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create singleton instance with PROPER AUTH SUPPORT
function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // FIXED: Enable authentication for RLS to work
        autoRefreshToken: true,
        persistSession: true,  // ← CRITICAL: This allows authenticated sessions
        detectSessionInUrl: true,
        storageKey: 'evermark-supabase-auth',
      },
      realtime: {
        // Disable realtime for better performance unless needed
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
// ADDED: Secure wallet authentication interface
// ========================================
interface AuthResult {
  success: boolean;
  session?: any;
  user?: any;
  error?: string;
}

// ========================================
// NEW: Secure signature-based authentication
// ========================================

/**
 * 🔐 SECURE: Authenticate with cryptographic signature verification
 * This replaces the insecure signInWithWallet function
 */
export const authenticateWithWallet = async (account: Account): Promise<AuthResult> => {
  try {
    console.log('🔐 Starting secure wallet authentication for:', account.address);

    // Step 1: Get nonce from backend
    console.log('📝 Getting authentication nonce...');
    const nonceResponse = await fetch('/.netlify/functions/auth-nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: account.address })
    });

    if (!nonceResponse.ok) {
      if (nonceResponse.status === 404) {
        throw new Error('Authentication functions not deployed. Please deploy the Netlify functions first.');
      }
      const errorData = await nonceResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Nonce request failed with status ${nonceResponse.status}`);
    }

    const { nonce } = await nonceResponse.json();

    // Step 2: Generate SIWE-compatible message
    const domain = window.location.hostname;
    const origin = window.location.origin;
    const now = new Date().toISOString();

    const message = `${domain} wants you to sign in with your Ethereum account:
${account.address}

Authenticate to Evermark Beta to create and manage your content.

URI: ${origin}
Version: 1
Chain ID: 8453
Nonce: ${nonce}
Issued At: ${now}`;

    // Step 3: Sign message (proves wallet ownership)
    console.log('✍️ Requesting wallet signature for authentication...');
    const signature = await account.signMessage({ message });

    // Step 4: Verify signature and get JWT
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
      if (authResponse.status === 404) {
        throw new Error('Authentication functions not deployed. Please deploy the Netlify functions first.');
      }
      const errorData = await authResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Authentication failed with status ${authResponse.status}`);
    }

    const { jwt, user } = await authResponse.json();

    // Step 5: Create Supabase session with verified JWT
    console.log('🎫 Creating Supabase session with verified JWT...');
    const { data, error } = await supabase.auth.setSession({
      access_token: jwt,
      refresh_token: jwt,
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
    
    // Provide specific error messages
    let errorMessage = 'Authentication failed';
    
    if (error instanceof Error) {
      const message = error.message;
      
      if (message.includes('functions not deployed')) {
        errorMessage = 'Authentication functions not deployed. Please deploy to Netlify first.';
      } else if (message.includes('user rejected') || message.includes('denied')) {
        errorMessage = 'User rejected the signature request';
      } else if (message.includes('network') || message.includes('fetch')) {
        errorMessage = 'Network error - please check your connection';
      } else {
        errorMessage = message;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// ========================================
// KEEP ALL YOUR EXISTING FUNCTIONS EXACTLY AS THEY ARE
// ========================================

// UPDATED: Helper to sign in user with wallet address
export const signInWithWallet = async (walletAddress: string) => {
  try {
    // Create a deterministic user ID from wallet address
    const userId = walletAddress.toLowerCase();
    
    // Sign in anonymously first, then update user metadata
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          wallet_address: walletAddress,
          display_name: `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          auth_method: 'wallet'
        }
      }
    });

    if (error) {
      console.error('❌ Supabase sign-in failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Supabase user authenticated:', data.user?.id);
    return { success: true, user: data.user };
  } catch (error) {
    console.error('❌ Sign-in error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
};

// ADDED: Helper to sign out
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Sign-out failed:', error);
      return { success: false, error: error.message };
    }
    console.log('✅ User signed out');
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sign-out failed' 
    };
  }
};

// ADDED: Check current auth state
export const getAuthState = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    
    // ENHANCED: Check for verified signature
    const isVerified = !!(
      user?.user_metadata?.verified_signature === true
    );
    
    return {
      user,
      session,
      isAuthenticated: !!user && !!session,
      isVerified, // ADDED: Track signature verification
      walletAddress: user?.user_metadata?.wallet_address,
      authMethod: user?.user_metadata?.auth_method,
      error
    };
  } catch (error) {
    return {
      user: null,
      session: null,
      isAuthenticated: false,
      isVerified: false, // ADDED
      walletAddress: null,
      authMethod: null,
      error: error instanceof Error ? error.message : 'Auth check failed'
    };
  }
};

// Helper function to reset client if needed (for testing)
export const resetSupabaseClient = () => {
  supabaseInstance = null;
};

// Health check function
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
