import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const NONCE_WINDOW_MINUTES = 5;

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

// Create Supabase-compatible JWT tokens
function createSupabaseJWT(user: any, jwtSecret: string): { accessToken: string; refreshToken: string } {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600; // 1 hour
  const expiresAt = now + expiresIn;

  // Access token payload (follows Supabase JWT structure)
  const accessPayload = {
    aud: 'authenticated',
    exp: expiresAt,
    iat: now,
    iss: 'supabase',
    sub: user.id,
    email: user.email,
    phone: '',
    app_metadata: {
      provider: 'wallet',
      providers: ['wallet']
    },
    user_metadata: user.user_metadata || {},
    role: 'authenticated',
    aal: 'aal1',
    amr: [{ method: 'wallet', timestamp: now }],
    session_id: crypto.randomUUID()
  };

  // Refresh token payload (simpler, longer-lived)
  const refreshPayload = {
    aud: 'authenticated',
    exp: now + (30 * 24 * 60 * 60), // 30 days
    iat: now,
    iss: 'supabase',
    sub: user.id,
    session_id: accessPayload.session_id,
    type: 'refresh'
  };

  const accessToken = jwt.sign(accessPayload, jwtSecret, { algorithm: 'HS256' });
  const refreshToken = jwt.sign(refreshPayload, jwtSecret, { algorithm: 'HS256' });

  return { accessToken, refreshToken };
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
    console.log('🔐 Processing wallet authentication request...');
    
    const { address, message, signature, nonce } = JSON.parse(event.body || '{}');

    // Validate inputs
    if (!address || !message || !signature || !nonce) {
      throw new Error('Missing required fields: address, message, signature, nonce');
    }

    if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      throw new Error('Invalid wallet address format');
    }

    // Verify nonce
    if (!isValidNonce(address, nonce)) {
      throw new Error('Invalid or expired nonce');
    }

    // Verify message format
    const expectedStart = `Authenticate with Evermark:\nWallet: ${address}`;
    if (!message.startsWith(expectedStart)) {
      throw new Error('Invalid message format');
    }

    // Cryptographic signature verification
    const isValidSignature = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValidSignature) {
      throw new Error('Invalid signature');
    }

    console.log('✅ Wallet signature verified for:', address);

    // =============================================================================
    // SUPABASE USER MANAGEMENT
    // =============================================================================
    
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.VITE_SUPABASE_URL) {
      throw new Error('Missing Supabase configuration');
    }

    // Get JWT secret for token signing
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!jwtSecret) {
      throw new Error('Missing JWT secret for token generation');
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const walletEmail = `${address.toLowerCase()}@wallet.evermark`;
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const now = new Date().toISOString();

    console.log('🔄 Finding or creating user for wallet:', address);

    // Find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users?.find(u => u.email === walletEmail);

    if (!user) {
      console.log('👤 Creating new user for wallet');
      
      // Create new user with a random password (required by Supabase but never used)
      const temporaryPassword = crypto.randomBytes(32).toString('hex');
      
      const { data: createUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: walletEmail,
        password: temporaryPassword,
        user_metadata: {
          wallet_address: address.toLowerCase(),
          display_name: displayName,
          auth_method: 'wallet_signature',
          created_at: now,
          signature_verified: true,
          password_auth_disabled: true // Flag that this user doesn't use password auth
        },
        email_confirm: true // Auto-confirm since wallet signature is verification
      });

      if (createUserError || !createUserData.user) {
        throw new Error(`Failed to create user: ${createUserError?.message}`);
      }

      user = createUserData.user;
      console.log('✅ Created new user:', user.id);
    } else {
      console.log('👤 Found existing user:', user.id);
      
      // Update existing user metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          wallet_address: address.toLowerCase(),
          display_name: displayName,
          auth_method: 'wallet_signature',
          last_auth_at: now,
          signature_verified: true
        }
      });

      if (updateError) {
        console.warn('⚠️ Failed to update user metadata:', updateError);
      } else {
        console.log('✅ Updated user metadata');
      }
    }

    // =============================================================================
    // DIRECT JWT SESSION CREATION
    // =============================================================================
    
    console.log('🎫 Creating JWT session tokens...');

    const { accessToken, refreshToken } = createSupabaseJWT(user, jwtSecret);

    // Create session object that matches Supabase client expectations
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: user.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: walletEmail,
        email_confirmed_at: user.email_confirmed_at || now,
        phone: '',
        confirmed_at: user.confirmed_at || now,
        last_sign_in_at: now,
        app_metadata: {
          provider: 'wallet',
          providers: ['wallet']
        },
        user_metadata: {
          wallet_address: address.toLowerCase(),
          display_name: displayName,
          auth_method: 'wallet_signature',
          signature_verified: true,
          ...(user.user_metadata || {})
        },
        identities: [{
          id: user.id,
          user_id: user.id,
          identity_data: {
            email: walletEmail,
            wallet_address: address.toLowerCase(),
            provider: 'wallet'
          },
          provider: 'wallet',
          last_sign_in_at: now,
          created_at: user.created_at,
          updated_at: now
        }],
        created_at: user.created_at,
        updated_at: now
      }
    };

    console.log('✅ JWT session created successfully');

    // Return session in format expected by Supabase client
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        session,
        user: {
          id: user.id,
          wallet_address: address.toLowerCase(),
          display_name: displayName,
          email: walletEmail,
          verified_signature: true,
          authenticated_at: now,
          session_method: 'direct_jwt'
        }
      })
    };

  } catch (error) {
    console.error('❌ Wallet authentication failed:', error);
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Authentication failed'
      })
    };
  }
};