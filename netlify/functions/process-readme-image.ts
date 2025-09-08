import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Simple image dimension extraction for common formats
function getImageDimensions(buffer: Buffer, contentType: string): { width: number; height: number } | null {
  try {
    if (contentType.includes('png')) {
      // PNG: Check for IHDR chunk
      const ihdrIndex = buffer.indexOf('IHDR');
      if (ihdrIndex !== -1) {
        const width = buffer.readUInt32BE(ihdrIndex + 4);
        const height = buffer.readUInt32BE(ihdrIndex + 8);
        return { width, height };
      }
    } else if (contentType.includes('jpeg')) {
      // JPEG: Look for SOF (Start of Frame) markers
      for (let i = 0; i < buffer.length - 4; i++) {
        if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC2)) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    } else if (contentType.includes('webp')) {
      // WebP: Basic VP8 header parsing
      const vp8Index = buffer.indexOf('VP8');
      if (vp8Index !== -1) {
        // Simple WebP dimension extraction (works for basic VP8)
        const width = buffer.readUInt16LE(vp8Index + 6) & 0x3FFF;
        const height = buffer.readUInt16LE(vp8Index + 8) & 0x3FFF;
        return { width, height };
      }
    }
  } catch (error) {
    console.warn('Error extracting image dimensions:', error);
  }
  return null;
}

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

    // Analyze image dimensions for better rendering decisions
    let dimensions: { width: number; height: number } | null = null;
    try {
      // Basic image dimension detection (works for JPEG, PNG, WebP)
      const buffer = Buffer.from(imageBuffer);
      dimensions = getImageDimensions(buffer, contentType);
    } catch (error) {
      console.warn('⚠️ Could not extract image dimensions:', error);
    }

    // Convert to base64 for sending back to client
    const base64Data = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Data}`;

    console.log(`✅ Successfully processed README book image:`, {
      size: `${imageBuffer.byteLength} bytes`,
      type: contentType,
      dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
      aspectRatio: dimensions ? (dimensions.width / dimensions.height).toFixed(3) : 'unknown'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        dataUrl,
        contentType,
        size: imageBuffer.byteLength,
        dimensions: dimensions ? {
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: dimensions.width / dimensions.height
        } : null
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