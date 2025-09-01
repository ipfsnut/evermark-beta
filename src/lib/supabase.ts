// src/lib/supabase.ts
// Fixed Supabase client configuration with proper type safety

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Environment variable validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Create the Supabase client
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'evermark-beta@1.0.0',
        },
      },
    });
    
    console.log('✅ Supabase client initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    supabase = null;
  }
} else {
  console.warn('⚠️ Supabase client not initialized - missing environment variables');
}

// Export the client (can be null)
export { supabase };

// Export type-safe getter function
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase client not available. Please check your environment variables:\n' +
      '- VITE_SUPABASE_URL\n' +
      '- VITE_SUPABASE_ANON_KEY'
    );
  }
  return supabase;
}

// Export configuration status
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// Export for debugging
export function getSupabaseConfig() {
  return {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    isInitialized: !!supabase,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
  };
}

// Export debug info function that main.tsx expects
export function getSupabaseDebugInfo() {
  return getSupabaseConfig();
}

// Export service role client getter (for backend/caching operations only)
export function getSupabaseServiceClient(): SupabaseClient {
  // This function exists for backend compatibility but shouldn't be used in frontend uploads
  console.warn('⚠️ Service role client should not be used for frontend uploads. Use IPFS-first approach.');
  return getSupabaseClient();
}