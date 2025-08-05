import { Handler } from '@netlify/functions';
import crypto from 'crypto';

const nonceStore = new Map<string, { nonce: string; timestamp: number }>();
const NONCE_EXPIRY = 5 * 60 * 1000; // 5 minutes

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

    // Generate secure nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    // Store nonce
    nonceStore.set(address.toLowerCase(), { nonce, timestamp });

    // Clean expired nonces
    for (const [addr, data] of nonceStore.entries()) {
      if (timestamp - data.timestamp > NONCE_EXPIRY) {
        nonceStore.delete(addr);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ nonce }),
    };

  } catch (error) {
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