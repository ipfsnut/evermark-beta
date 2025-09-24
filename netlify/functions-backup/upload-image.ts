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
    const base64Data = body.image.includes(',') ? body.image.split(',')[1] : body.image;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Determine content type from data URL
    let contentType = 'image/jpeg';
    if (body.image.includes('data:image/png')) {
      contentType = 'image/png';
    } else if (body.image.includes('data:image/gif')) {
      contentType = 'image/gif';
    } else if (body.image.includes('data:image/webp')) {
      contentType = 'image/webp';
    }
    
    // Create multipart form data manually (no external dependencies)
    const boundary = `----formdata-boundary-${Date.now()}`;
    const filename = body.filename || `evermark-image-${Date.now()}.jpg`;
    
    const metadata = JSON.stringify({
      name: `evermark-image-${Date.now()}`,
      keyvalues: {
        type: 'evermark-image',
        filename: body.filename || 'evermark-image',
        size: body.size?.toString() || imageBuffer.length.toString(),
        uploaded_via: 'farcaster-proxy',
        timestamp: new Date().toISOString()
      }
    });

    // Build multipart form data manually
    const formParts: string[] = [];
    
    // Add file part
    formParts.push(`--${boundary}`);
    formParts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
    formParts.push(`Content-Type: ${contentType}`);
    formParts.push('');
    
    // Add metadata part  
    const metadataPart = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="pinataMetadata"`,
      '',
      metadata,
      `--${boundary}--`
    ].join('\r\n');

    // Combine text parts and binary data
    const textParts = formParts.join('\r\n') + '\r\n';
    const textBuffer = Buffer.from(textParts, 'utf8');
    const endBuffer = Buffer.from('\r\n' + metadataPart, 'utf8');
    const formBody = Buffer.concat([textBuffer, imageBuffer, endBuffer]);

    // Upload to Pinata
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_PINATA_JWT}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formBody.length.toString()
      },
      body: formBody
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata image upload failed:', {
        status: pinataResponse.status,
        statusText: pinataResponse.statusText,
        error: errorText
      });
      
      return {
        statusCode: pinataResponse.status,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to upload image to IPFS',
          details: `Pinata API returned ${pinataResponse.status}: ${errorText}`,
          suggestion: 'Please check your image format and size (max 10MB)'
        }),
      };
    }

    const result = await pinataResponse.json();
    console.log('✅ Image uploaded to IPFS via Farcaster proxy:', {
      hash: result.IpfsHash,
      size: result.PinSize,
      filename: body.filename
    });

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
    console.error('Farcaster image upload error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: event.body?.substring(0, 200) + '...' // First 200 chars for debugging
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Please try uploading a smaller image or contact support'
      }),
    };
  }
};