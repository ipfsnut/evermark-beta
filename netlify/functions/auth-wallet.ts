// =============================================================================
// File 1: netlify/functions/auth-wallet.ts (ENHANCED)
// =============================================================================

import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const NONCE_WINDOW_MINUTES = 5;
const DOMAIN = process.env.URL || 'https://evermarks.net';

console.log('🔍 Enhanced auth function environment check:', {
  DOMAIN,
  NODE_ENV: process.env.NODE_ENV,
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// Generate the same deterministic nonce as auth-nonce.ts
function generateDeterministicNonce(address: string): string {
  const timeWindow = Math.floor(Date.now() / (NONCE_WINDOW_MINUTES * 60 * 1000));
  
  return crypto
    .createHash('sha256')
    .update(`${address.toLowerCase()}-${timeWindow}-evermark-auth`)
    .digest('hex');
}

// Check if nonce is valid (current or previous time window)
function isValidNonce(address: string, providedNonce: string): boolean {
  const currentWindow = Math.floor(Date.now() / (NONCE_WINDOW_MINUTES * 60 * 1000));
  
  for (let i = 0; i <= 1; i++) {
    const timeWindow = currentWindow - i;
    const expectedNonce = crypto
      .createHash('sha256')
      .update(`${address.toLowerCase()}-${timeWindow}-evermark-auth`)
      .digest('hex');
      
    if (expectedNonce === providedNonce) {
      return true;
    }
  }
  
  return false;
}

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
    console.log('🔐 Processing enhanced wallet authentication request...');
    
    const { address, message, signature, nonce } = JSON.parse(event.body || '{}');

    console.log('📋 Request data:', {
      hasAddress: !!address,
      hasMessage: !!message,
      hasSignature: !!signature,
      hasNonce: !!nonce,
      addressFormat: address ? (address.length === 42 ? 'valid' : 'invalid') : 'missing'
    });

    // Validate inputs
    if (!address || !message || !signature || !nonce) {
      console.log('❌ Missing required fields');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: address, message, signature, nonce' }),
      };
    }

    if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      console.log('❌ Invalid address format:', address);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid wallet address format' }),
      };
    }

    // Verify nonce using deterministic validation
    if (!isValidNonce(address, nonce)) {
      console.log('❌ Invalid nonce for address:', address);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired nonce' }),
      };
    }

    console.log('✅ Nonce validated');

    // Verify message format
    const expectedStart = `Authenticate with Evermark:\nWallet: ${address}`;
    if (!message.startsWith(expectedStart)) {
      console.log('❌ Invalid message format. Expected start:', expectedStart);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid message format' }),
      };
    }

    console.log('✅ Message format validated');

    // Cryptographic signature verification
    let isValidSignature = false;
    try {
      isValidSignature = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Signature verification failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
      };
    }

    if (!isValidSignature) {
      console.log('❌ Invalid signature');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    console.log('✅ Signature verified successfully');

    // =============================================================================
    // NEW: CREATE SUPABASE SESSION WITH WALLET AUTHENTICATION
    // =============================================================================
    
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key for admin operations
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const walletEmail = `${address.toLowerCase()}@wallet.evermark`;
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;

    console.log('🔄 Creating/updating Supabase user for wallet:', address);

    // Try to create user (will fail if exists, which is fine)
    const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: walletEmail,
      user_metadata: {
        wallet_address: address.toLowerCase(),
        display_name: displayName,
        auth_method: 'wallet_signature',
        verified_at: new Date().toISOString(),
        signature_verified: true
      },
      email_confirm: true // Auto-confirm since wallet signature is verification
    });

    // If user already exists, that's fine - we'll get them in the next step
    if (createUserError && !createUserError.message.includes('already registered')) {
      console.error('❌ Failed to create Supabase user:', createUserError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to create user session',
          details: createUserError.message 
        }),
      };
    }

    // Get or update user
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('❌ Failed to list users:', listError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to retrieve user' }),
      };
    }

    const existingUser = existingUsers.users.find(user => user.email === walletEmail);
    
    if (!existingUser) {
      console.error('❌ User not found after creation');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'User creation failed' }),
      };
    }

    // Update user metadata with latest auth info
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      {
        user_metadata: {
          ...existingUser.user_metadata,
          wallet_address: address.toLowerCase(),
          display_name: displayName,
          auth_method: 'wallet_signature',
          last_auth_at: new Date().toISOString(),
          signature_verified: true
        }
      }
    );

    if (updateError) {
      console.warn('⚠️ Failed to update user metadata:', updateError);
      // Continue anyway as this is not critical
    }

    // Generate session for the user
    console.log('🎫 Generating session token for user:', existingUser.id);
    
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: walletEmail,
      options: {
        redirectTo: `${process.env.URL || 'https://evermarks.net'}/auth/callback`
      }
    });

    if (sessionError) {
      console.error('❌ Failed to generate session:', sessionError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to generate session',
          details: sessionError.message 
        }),
      };
    }

    // Extract access token from the magic link
    const magicLinkUrl = new URL(sessionData.properties.action_link);
    const accessToken = magicLinkUrl.searchParams.get('access_token');
    const refreshToken = magicLinkUrl.searchParams.get('refresh_token');

    if (!accessToken) {
      console.error('❌ No access token in magic link');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to extract session tokens' }),
      };
    }

    console.log('✅ Supabase session created successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
        user: {
          id: existingUser.id,
          wallet_address: address.toLowerCase(),
          display_name: displayName,
          email: walletEmail,
          verified_signature: true,
          authenticated_at: new Date().toISOString(),
          user_metadata: {
            wallet_address: address.toLowerCase(),
            display_name: displayName,
            auth_method: 'wallet_signature',
            signature_verified: true
          }
        }
      }),
    };

  } catch (error) {
    console.error('💥 Enhanced auth endpoint critical error:', error);
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
