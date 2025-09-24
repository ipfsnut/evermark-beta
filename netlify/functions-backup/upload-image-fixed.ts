// netlify/functions/upload-image.ts - FIXED VERSION
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
    // Parse multipart form data (basic implementation)
    const body = event.body;
    if (!body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data provided' }),
      };
    }

    // For now, handle base64 encoded images
    const parsedBody = JSON.parse(body);
    
    if (!parsedBody.file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing file data' }),
      };
    }

    // Upload to Pinata
    const formData = new FormData();
    
    // Convert base64 to blob if needed
    let fileData;
    if (parsedBody.file.startsWith('data:')) {
      // Handle data URL
      const response = await fetch(parsedBody.file);
      fileData = await response.blob();
    } else {
      // Handle direct file data
      fileData = parsedBody.file;
    }
    
    formData.append('file', fileData);
    formData.append('pinataMetadata', JSON.stringify({
      name: `evermark-image-${Date.now()}`,
      keyvalues: {
        type: 'evermark-image',
        uploaded_via: 'proxy'
      }
    }));

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT}`
      },
      body: formData
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata upload failed:', errorText);
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
    console.log('✅ Image uploaded to IPFS:', result.IpfsHash);

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
    console.error('Image upload error:', error);
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