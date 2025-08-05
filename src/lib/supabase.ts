// src/lib/supabase.ts - Fixed Supabase client with authentication support
import { createClient } from '@supabase/supabase-js';

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

// ADDED: Helper to sign in user with wallet address
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
    
    return {
      user,
      session,
      isAuthenticated: !!user && !!session,
      error
    };
  } catch (error) {
    return {
      user: null,
      session: null,
      isAuthenticated: false,
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