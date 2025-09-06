// netlify/functions/upload-image.ts - Proxy for IPFS image uploads
// This function handles image uploads from restricted environments like Farcaster mini-apps
// where direct CORS requests to Pinata API are blocked

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import fetch from 'node-fetch';
import FormData from 'form-data';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface UploadRequest {
  image: string; // Base64 encoded image data
  filename: string;
  size: number;
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
    const body: UploadRequest = JSON.parse(event.body || '{}');
    
    if (!body.image || !body.filename) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing image or filename' }),
      };
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create form data for Pinata
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: body.filename,
      contentType: 'image/jpeg' // Default to JPEG, adjust based on actual type
    });

    const metadata = JSON.stringify({
      name: `evermark-image-${Date.now()}`,
      keyvalues: {
        type: 'evermark-image',
        filename: body.filename,
        size: body.size.toString(),
        uploaded_via: 'proxy'
      }
    });
    formData.append('pinataMetadata', metadata);

    // Upload to Pinata
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT}`,
        ...formData.getHeaders()
      },
      body: formData as any
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata upload failed:', errorText);
      return {
        statusCode: pinataResponse.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to upload to IPFS',
          details: errorText 
        }),
      };
    }

    const result = await pinataResponse.json();
    const gateway = process.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud';

    console.log('✅ Image uploaded to IPFS via proxy:', result.IpfsHash);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hash: result.IpfsHash,
        url: `${gateway}/ipfs/${result.IpfsHash}`,
        size: result.PinSize,
        timestamp: result.Timestamp
      }),
    };

  } catch (error) {
    console.error('Upload proxy error:', error);
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