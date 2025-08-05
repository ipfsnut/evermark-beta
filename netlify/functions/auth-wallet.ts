import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import crypto from 'crypto';

const nonceStore = new Map<string, { nonce: string; timestamp: number }>();
const NONCE_EXPIRY = 5 * 60 * 1000;

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;
const DOMAIN = process.env.URL || 'https://evermarks.net';

if (!JWT_SECRET) {
  throw new Error('SUPABASE_JWT_SECRET environment variable is required');
}

// Manual JWT creation using Node.js built-in crypto
function createJWT(payload: any, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');

  return `${data}.${signature}`;
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

    // Create JWT with verified claims
    const userId = address.toLowerCase();
    const now_seconds = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: `${DOMAIN}/auth/v1`,
      sub: userId,
      aud: 'authenticated',
      exp: now_seconds + (24 * 60 * 60),
      iat: now_seconds,
      role: 'authenticated',
      aal: 'aal1',
      user_metadata: {
        wallet_address: address,
        verified_signature: true,
        auth_method: 'wallet_signature',
        verified_at: new Date().toISOString(),
      },
      app_metadata: {
        provider: 'wallet',
        wallet_verified: true,
      }
    };

    const token = createJWT(payload, JWT_SECRET);

    console.log('✅ Wallet signature verified and JWT issued for:', address);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        jwt: token,
        user: {
          id: userId,
          wallet_address: address,
          display_name: `${address.slice(0, 6)}...${address.slice(-4)}`,
        }
      }),
    };

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
