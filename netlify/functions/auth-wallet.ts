import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import crypto from 'crypto';

const NONCE_WINDOW_MINUTES = 5;
const DOMAIN = process.env.URL || 'https://evermarks.net';

console.log('🔍 Auth function environment check:', {
  DOMAIN,
  NODE_ENV: process.env.NODE_ENV,
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasJwtSecret: !!process.env.SUPABASE_JWT_SECRET,
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

// Create simple session token (Thirdweb-compatible)
function createSessionToken(address: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (24 * 60 * 60); // 24 hours
  
  const payload = {
    sub: address.toLowerCase(),
    iat: now,
    exp: exp,
    wallet_address: address,
    display_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
    auth_method: 'wallet_signature',
    verified_at: new Date().toISOString(),
  };

  // Simple signed token 
  const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = crypto
    .createHmac('sha256', process.env.SUPABASE_JWT_SECRET || 'evermark-fallback-secret')
    .update(tokenData)
    .digest('hex');

  return `${tokenData}.${signature}`;
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
    const expectedStart = `${new URL(DOMAIN).hostname} wants you to sign in with your Ethereum account:\n${address}`;
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

    // Generate session token (no Supabase Auth needed!)
    const sessionToken = createSessionToken(address);
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const userId = address.toLowerCase();

    console.log('✅ Session token generated for:', address);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        session: {
          access_token: sessionToken,
          token_type: 'bearer',
          expires_in: 86400,
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          refresh_token: null,
        },
        user: {
          id: userId,
          wallet_address: address,
          display_name: displayName,
          verified_signature: true,
          authenticated_at: new Date().toISOString(),
          email: `${userId}@wallet.evermark`,
          user_metadata: {
            wallet_address: address,
            display_name: displayName,
            auth_method: 'wallet_signature',
          }
        }
      }),
    };

  } catch (error) {
    console.error('💥 Auth endpoint critical error:', error);
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