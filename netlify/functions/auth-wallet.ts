import { Handler } from '@netlify/functions';
import { verifyMessage } from 'viem';
import crypto from 'crypto';

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
    // SIMPLIFIED WALLET AUTHENTICATION FOR NFT CREATION
    // =============================================================================
    // Goal: Web3 wallet login for NFT creation on Base mainnet
    // The wallet signature verification is sufficient authentication for creating Evermarks
    
    const walletAddress = address.toLowerCase();
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const now = new Date().toISOString();
    
    // Generate a simple auth token for this session
    const authToken = crypto
      .createHash('sha256')
      .update(`${walletAddress}-${nonce}-${now}-evermark-auth`)
      .digest('hex');
    
    console.log('✅ Wallet authenticated successfully - ready for NFT creation');

    // Return simplified auth response for NFT creation
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        authenticated: true,
        user: {
          wallet_address: walletAddress,
          display_name: displayName,
          verified_signature: true,
          authenticated_at: now,
          can_create_nft: true,
          chain_id: 8453, // Base mainnet
          auth_method: 'wallet_signature'
        },
        // Auth token for subsequent API calls that need to verify this wallet session
        auth_token: authToken,
        // Expires in 24 hours
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
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