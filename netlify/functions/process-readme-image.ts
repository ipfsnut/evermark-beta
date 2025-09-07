import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event, context) => {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { imageUrl } = body;

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Image URL is required' })
      };
    }

    console.log('🖼️ Processing README book image:', imageUrl);

    // Download the image from external URL (server-side, no CORS issues)
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'EvermarkBot/1.0'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    // Convert to base64 for sending back to client
    const base64Data = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Data}`;

    console.log(`✅ Successfully processed image: ${imageBuffer.byteLength} bytes, type: ${contentType}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        dataUrl,
        contentType,
        size: imageBuffer.byteLength
      })
    };

  } catch (error) {
    console.error('❌ README image processing failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};