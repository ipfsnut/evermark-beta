// netlify/functions/upload-image.ts - WORKING VERSION FOR FARCASTER
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

  try {
    const body = JSON.parse(event.body || '{}');
    
    if (!body.image) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing image data' }),
      };
    }

    // Convert base64 to buffer for upload
    const base64Data = body.image.split(',')[1]; // Remove data:image/...;base64, prefix
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Create FormData for Pinata upload
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('file', imageBuffer, {
      filename: body.filename || 'evermark-image.jpg',
      contentType: body.image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
    });
    
    formData.append('pinataMetadata', JSON.stringify({
      name: `evermark-image-${Date.now()}`,
      keyvalues: {
        type: 'evermark-image',
        filename: body.filename || 'evermark-image.jpg',
        size: body.size?.toString() || '0',
        uploaded_via: 'farcaster-proxy'
      }
    }));

    // Upload to Pinata
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT}`
      },
      body: formData
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata image upload failed:', errorText);
      return {
        statusCode: pinataResponse.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to upload image to IPFS',
          details: errorText 
        }),
      };
    }

    const result = await pinataResponse.json();
    console.log('✅ Image uploaded to IPFS via Farcaster proxy:', result.IpfsHash);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hash: result.IpfsHash,
        url: `ipfs://${result.IpfsHash}`,
        pinataUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
        size: result.PinSize,
        timestamp: result.Timestamp
      }),
    };

  } catch (error) {
    console.error('Farcaster image upload error:', error);
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