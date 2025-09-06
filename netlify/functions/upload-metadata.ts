// netlify/functions/upload-metadata.ts - Proxy for IPFS metadata uploads
// This function handles metadata uploads from restricted environments like Farcaster mini-apps

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface UploadMetadataRequest {
  metadata: any;
}

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

  try {
    const body: UploadMetadataRequest = JSON.parse(event.body || '{}');
    
    if (!body.metadata) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing metadata' }),
      };
    }

    // Upload to Pinata using fetch (built-in to Node.js 18+)
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT}`
      },
      body: JSON.stringify({
        pinataContent: body.metadata,
        pinataMetadata: {
          name: `evermark-metadata-${Date.now()}`,
          keyvalues: {
            type: 'evermark-metadata',
            title: body.metadata.name || 'Untitled',
            uploaded_via: 'proxy'
          }
        }
      })
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata metadata upload failed:', errorText);
      return {
        statusCode: pinataResponse.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to upload metadata to IPFS',
          details: errorText 
        }),
      };
    }

    const result = await pinataResponse.json();

    console.log('✅ Metadata uploaded to IPFS via proxy:', result.IpfsHash);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hash: result.IpfsHash,
        url: `ipfs://${result.IpfsHash}`,
        size: result.PinSize,
        timestamp: result.Timestamp
      }),
    };

  } catch (error) {
    console.error('Metadata upload proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};