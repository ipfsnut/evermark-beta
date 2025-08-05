import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const NONCE_WINDOW_MINUTES = 5;
const DOMAIN = process.env.URL || 'https://evermarks.net';

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY; // New format: sb_secret_...
const serviceKey = process.env.SUPABASE_SERVICE_KEY; // Legacy format: eyJhbGciO...
const jwtSecret = process.env.SUPABASE_JWT_SECRET; // Your project's JWT secret

console.log('Environment check:', {
  SUPABASE_URL: supabaseUrl ? '✅ Set' : '❌ Missing',
  SECRET_KEY: secretKey ? '✅ Set (New Format)' : '❌ Missing',
  SERVICE_KEY: serviceKey ? '✅ Set (Legacy Format)' : '❌ Missing',
  JWT_SECRET: jwtSecret ? '✅ Set' : '❌ Missing',
  DOMAIN: DOMAIN
});

// Use the new secret key if available, fallback to legacy service key
const adminKey = secretKey || serviceKey;

if (!supabaseUrl || !adminKey || !jwtSecret) {
  throw new Error(`Missing Supabase configuration: URL=${!!supabaseUrl}, ADMIN_KEY=${!!adminKey}, JWT_SECRET=${!!jwtSecret}`);
}

// Admin client for user management
const supabaseAdmin = createClient(
  supabaseUrl,
  adminKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

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

// Create Supabase-compatible JWT for wallet user
function createSupabaseJWT(address: string, userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (24 * 60 * 60); // 24 hours
  
  const payload = {
    iss: 'supabase',
    ref: supabaseUrl?.split('//')[1]?.split('.')[0], // Extract project ref
    aud: 'authenticated',
    exp: exp,
    iat: now,
    sub: userId, // Use the actual Supabase user ID
    email: `${address.toLowerCase()}@wallet.evermark`,
    phone: '',
    app_metadata: {
      provider: 'wallet',
      providers: ['wallet'],
      wallet_verified: true,
    },
    user_metadata: {
      wallet_address: address,
      auth_method: 'wallet_signature',
      display_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
    },
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'wallet', timestamp: now }],
    session_id: crypto.randomUUID(),
  };

  // Create JWT manually (basic version - use jsonwebtoken library for production)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', jwtSecret!)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');

  return `${header}.${payloadStr}.${signature}`;
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

    // Verify nonce using deterministic validation
    if (!isValidNonce(address, nonce)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired nonce' }),
      };
    }

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

    // Create or update user in auth.users table using admin client
    const userId = address.toLowerCase();
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;
    
    try {
      // Use Supabase Auth Admin API to create/update user
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: `${userId}@wallet.evermark`, // Fake email format
        email_confirm: true,
        user_metadata: {
          wallet_address: address,
          display_name: displayName,
          auth_method: 'wallet_signature',
          verified_at: new Date().toISOString(),
        },
        app_metadata: {
          provider: 'wallet',
          wallet_verified: true,
        }
      });

      // If user already exists, find them and update
      if (userError && userError.message.includes('already registered')) {
        // Get existing user by email (since we can't set custom user_id)
        const { data: existingUsers, error: getUserError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000 // Adjust as needed
        });

        if (getUserError) {
          console.error('Failed to list users:', getUserError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to find existing user',
              details: getUserError.message
            }),
          };
        }

        // Find user by wallet address in metadata
        const existingUser = existingUsers?.users?.find(u => 
          u.user_metadata?.wallet_address?.toLowerCase() === address.toLowerCase()
        );

        if (!existingUser) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'User exists but could not be found',
            }),
          };
        }

        // Update existing user
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            user_metadata: {
              ...existingUser.user_metadata,
              wallet_address: address,
              display_name: displayName,
              auth_method: 'wallet_signature',
              last_login: new Date().toISOString(),
            }
          }
        );

        if (updateError) {
          console.error('User update error:', updateError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to update user',
              details: updateError.message
            }),
          };
        }
        
        // Use the existing user's ID for JWT
        const accessToken = createSupabaseJWT(address, existingUser.id);
        
        console.log('✅ Existing wallet user updated:', address);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            session: {
              access_token: accessToken,
              token_type: 'bearer',
              expires_in: 86400,
              expires_at: Math.floor(Date.now() / 1000) + 86400,
              refresh_token: null,
            },
            user: {
              id: existingUser.id,
              wallet_address: address,
              display_name: displayName,
              verified_signature: true,
              email: existingUser.email,
              user_metadata: updatedUser?.user?.user_metadata || existingUser.user_metadata,
            }
          }),
        };
      }

      // New user created successfully
      const newUserId = userData?.user?.id;
      if (!newUserId) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'User created but ID not returned' }),
        };
      }

      const accessToken = createSupabaseJWT(address, newUserId);
      
      console.log('✅ New wallet user created:', address);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          session: {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: 86400,
            expires_at: Math.floor(Date.now() / 1000) + 86400,
            refresh_token: null,
          },
          user: {
            id: newUserId,
            wallet_address: address,
            display_name: displayName,
            verified_signature: true,
            email: userData.user?.email,
            user_metadata: userData.user?.user_metadata,
          }
        }),
      };

    } catch (error) {
      console.error('Auth processing error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Authentication processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
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