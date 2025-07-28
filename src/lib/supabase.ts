// src/lib/supabase.ts - Fixed Supabase client singleton
import { createClient } from '@supabase/supabase-js';

// Ensure we only create one instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create singleton instance
function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Disable auto-refresh to prevent multiple instances
        autoRefreshToken: false,
        persistSession: false,
        // Use a unique storage key to prevent conflicts
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