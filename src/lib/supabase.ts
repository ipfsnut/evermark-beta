// src/lib/supabase.ts
// FIXED: Proper singleton Supabase client configuration

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Environment variables validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// FIXED: Singleton pattern to prevent multiple instances
let supabaseClient: SupabaseClient | null = null;
let instanceCount = 0;

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Cannot create Supabase client: missing environment variables');
    return null;
  }

  if (supabaseClient) {
    console.log('✅ Returning existing Supabase client instance');
    return supabaseClient;
  }

  try {
    instanceCount++;
    console.log(`🔍 Creating Supabase instance #${instanceCount}`);

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // SIMPLIFIED: No persistent sessions for wallet-based auth
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce'
      },
      realtime: {
        params: {
          eventsPerSecond: 2 // Rate limit for realtime
        }
      },
      global: {
        headers: {
          'x-client-info': 'evermark-beta@1.0.0'
        }
      },
      db: {
        schema: 'public'
      }
    });

    console.log('✅ Supabase client created successfully');
    return supabaseClient;

  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    instanceCount--;
    return null;
  }
}

// Create the client
const client = createSupabaseClient();

// Export the client (may be null if configuration is invalid)
export const supabase = client;

// Type-safe getter with error handling
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error('Supabase client is not available. Check your environment variables.');
  }
  return client;
}

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!(client && supabaseUrl && supabaseAnonKey);
}

// Get configuration info for debugging
export function getSupabaseConfig() {
  return {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    hasClient: !!client,
    url: supabaseUrl ? `${supabaseUrl.slice(0, 20)}...` : 'Not set',
    keyPrefix: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 8)}...` : 'Not set'
  };
}

// Test connection function
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  error?: string;
  latency?: number;
}> {
  if (!client) {
    return { success: false, error: 'Client not initialized' };
  }

  const startTime = Date.now();
  
  try {
    // Simple test query
    const { data, error } = await client
      .from('evermarks')
      .select('token_id')
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      return { success: false, error: error.message, latency };
    }

    return { success: true, latency };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - startTime
    };
  }
}

// Debug information
export function getSupabaseDebugInfo() {
  return {
    configured: isSupabaseConfigured(),
    config: getSupabaseConfig(),
    instanceCount,
    clientAvailable: !!client,
    timestamp: new Date().toISOString()
  };
}

// Health check
export async function healthCheck() {
  const config = getSupabaseConfig();
  const connection = await testSupabaseConnection();
  
  return {
    healthy: config.hasClient && connection.success,
    config,
    connection,
    timestamp: new Date().toISOString()
  };
}

// Handle cleanup if needed
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (client) {
      // Cleanup if needed
      console.log('🧹 Cleaning up Supabase client');
    }
  });
}

// Development logging
if (import.meta.env.DEV) {
  console.log('🔍 Supabase Configuration:', getSupabaseConfig());
}