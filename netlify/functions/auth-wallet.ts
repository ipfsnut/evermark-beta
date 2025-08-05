import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import { createClient } from '@supabase/supabase-js';

const nonceStore = new Map<string, { nonce: string; timestamp: number }>();
const NONCE_EXPIRY = 5 * 60 * 1000;

const DOMAIN = process.env.URL || 'https://evermarks.net';

// Create Supabase client with service key for admin operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // Use service key for admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { address, message, signature, nonce } = JSON.parse(event.body || '{}');

    // Validate inputs
    if (!address || !message || !signature || !nonce) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: address, message, signature, nonce' }),
      };
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid wallet address format' }),
      };
    }

    // Verify nonce
    const storedNonce = nonceStore.get(address.toLowerCase());
    if (!storedNonce || storedNonce.nonce !== nonce) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired nonce' }),
      };
    }

    if (Date.now() - storedNonce.timestamp > NONCE_EXPIRY) {
      nonceStore.delete(address.toLowerCase());
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Nonce expired' }),
      };
    }

    // Remove used nonce
    nonceStore.delete(address.toLowerCase());

    // Verify message format
    const expectedStart = `${new URL(DOMAIN).hostname} wants you to sign in with your Ethereum account:\n${address}`;
    if (!message.startsWith(expectedStart)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid message format' }),
      };
    }

    // Cryptographic signature verification
    let isValidSignature = false;
    try {
      isValidSignature = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      console.error('Signature verification failed:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Signature verification failed' }),
      };
    }

    if (!isValidSignature) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    // Use Supabase's modern auth system instead of manual JWT creation
    const userId = address.toLowerCase();
    
    try {
      // Method 1: Create user with signInAnonymously and verified metadata
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            wallet_address: address,
            verified_signature: true,
            auth_method: 'wallet_signature',
            verified_at: new Date().toISOString(),
            display_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
          }
        }
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create authenticated session' }),
        };
      }

      console.log('✅ Wallet signature verified and Supabase session created for:', address);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          session: {
            access_token: authData.session?.access_token,
            refresh_token: authData.session?.refresh_token,
            expires_at: authData.session?.expires_at,
          },
          user: {
            id: authData.user?.id,
            wallet_address: address,
            display_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
            verified_signature: true,
          }
        }),
      };

    } catch (supabaseError) {
      console.error('Supabase operation failed:', supabaseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Authentication service error',
          details: supabaseError instanceof Error ? supabaseError.message : 'Unknown error'
        }),
      };
    }

  } catch (error) {
    console.error('Auth endpoint error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Authentication server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};