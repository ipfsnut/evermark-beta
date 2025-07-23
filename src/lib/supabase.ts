import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to check connection
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('evermarks')
      .select('count(*)', { count: 'exact', head: true });
    
    return !error;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}

// Helper to get database info for debugging
export async function getSupabaseInfo() {
  try {
    const { data, error } = await supabase
      .from('evermarks')
      .select('count(*)', { count: 'exact', head: true });
    
    return {
      connected: !error,
      error: error?.message,
      hasData: (data as any)?.length > 0,
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url: supabaseUrl,
      hasKey: !!supabaseAnonKey
    };
  }
}