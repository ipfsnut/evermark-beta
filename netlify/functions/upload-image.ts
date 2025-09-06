// netlify/functions/upload-image.ts - Proxy for IPFS image uploads
// This function handles image uploads from restricted environments like Farcaster mini-apps
// where direct CORS requests to Pinata API are blocked

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
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

  // For now, we'll return a message that the proxy isn't available
  // The client-side code will fall back to direct upload
  return {
    statusCode: 501,
    headers,
    body: JSON.stringify({ 
      error: 'Image proxy upload not yet implemented',
      message: 'Please use direct upload or try from a different browser. The Farcaster mini-app CORS restrictions require a more complex proxy implementation.'
    }),
  };
};