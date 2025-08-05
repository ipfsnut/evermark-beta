import { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import crypto from 'crypto';

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

    // Store nonce in Netlify Blobs with automatic expiry
    const nonceStore = getStore('auth-nonces');
    const nonceData = {
      nonce,
      timestamp,
      address: address.toLowerCase()
    };

    try {
      await nonceStore.set(address.toLowerCase(), JSON.stringify(nonceData));
    } catch (blobError) {
      console.error('Failed to store nonce in Netlify Blobs:', blobError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate secure nonce' }),
      };
    }

    console.log('✅ Nonce generated and stored for:', address);

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