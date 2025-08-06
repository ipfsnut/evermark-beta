// src/lib/supabase.ts - Fixed to prevent multiple instances
import { createClient } from '@supabase/supabase-js';

// Add debugging to track instance creation
let instanceCount = 0;
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create singleton instance with proper tracking
function getSupabaseClient() {
  if (!supabaseInstance) {
    instanceCount++;
    console.log(`🔍 Creating Supabase instance #${instanceCount}`);
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // CRITICAL: Disable auto session management to prevent multiple GoTrueClient instances
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: 'evermark-supabase-auth',
        // Set custom storage key to avoid conflicts
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
      realtime: {
        // Disable realtime for better performance and fewer connections
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'evermark-beta@2.0.0',
          'X-Instance-ID': `instance-${instanceCount}`,
        },
      },
    });
    
    console.log('✅ Supabase client created successfully');
  } else {
    console.log('♻️ Reusing existing Supabase instance');
  }
  
  return supabaseInstance;
}

// Export the singleton instance
export const supabase = getSupabaseClient();

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

// Helper function to reset client if needed (for testing)
export const resetSupabaseClient = () => {
  console.log('🔄 Resetting Supabase client instance');
  supabaseInstance = null;
  instanceCount = 0;
};

// Debug function to check instance status
export const getSupabaseDebugInfo = () => {
  return {
    instanceCount,
    hasInstance: !!supabaseInstance,
    isProduction: process.env.NODE_ENV === 'production',
    url: supabaseUrl?.substring(0, 20) + '...',
  };
};