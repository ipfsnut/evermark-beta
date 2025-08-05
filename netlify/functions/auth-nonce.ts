import { Handler } from '@netlify/functions';
import crypto from 'crypto';

const NONCE_WINDOW_MINUTES = 5; // 5-minute time windows

// Generate deterministic nonce based on address and current time window
function generateDeterministicNonce(address: string): string {
  // Create 5-minute time windows
  const timeWindow = Math.floor(Date.now() / (NONCE_WINDOW_MINUTES * 60 * 1000));
  
  // Create deterministic nonce from address + time window
  const nonce = crypto
    .createHash('sha256')
    .update(`${address.toLowerCase()}-${timeWindow}-evermark-auth`)
    .digest('hex');
    
  return nonce;
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
    const { address } = JSON.parse(event.body || '{}');

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid wallet address' }),
      };
    }

    // Generate deterministic nonce (no storage needed!)
    const nonce = generateDeterministicNonce(address);

    console.log('✅ Deterministic nonce generated for:', address);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ nonce }),
    };

  } catch (error) {
    console.error('Nonce generation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to generate nonce',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};