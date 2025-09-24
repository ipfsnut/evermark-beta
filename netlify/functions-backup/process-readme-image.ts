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

// Helper function to extract IPFS alternatives from OpenSea URLs
function getIPFSAlternatives(imageUrl: string): string[] {
  const alternatives: string[] = [];
  
  // If it's an OpenSea CDN URL, try to extract the IPFS hash
  if (imageUrl.includes('openseauserdata.com') || imageUrl.includes('opensea.io')) {
    // OpenSea often includes IPFS hashes in their URLs
    const ipfsHashMatch = imageUrl.match(/([a-zA-Z0-9]{46,})/);
    if (ipfsHashMatch) {
      const ipfsHash = ipfsHashMatch[1];
      alternatives.push(
        `https://ipfs.io/ipfs/${ipfsHash}`,
        `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
      );
    }
  }
  
  return alternatives;
}

// Helper function to get different OpenSea image sizes
function getOpenSeaAlternatives(imageUrl: string): string[] {
  const alternatives: string[] = [];
  
  if (imageUrl.includes('openseauserdata.com')) {
    // Try removing size parameters to get original
    const baseUrl = imageUrl.split('=')[0];
    alternatives.push(
      baseUrl, // Original size
      `${baseUrl}=s550`, // Large size
      `${baseUrl}=s250`  // Medium size (fallback)
    );
  }
  
  return alternatives;
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

    // Try multiple strategies to get the best quality image
    const imageUrls = [
      imageUrl,
      // Try to get IPFS version if this is an OpenSea CDN URL
      ...getIPFSAlternatives(imageUrl),
      // Try different OpenSea image sizes if available
      ...getOpenSeaAlternatives(imageUrl)
    ].filter(Boolean);

    console.log(`🔄 Trying ${imageUrls.length} image sources for best quality`);

    let response: Response | null = null;
    let finalUrl: string = imageUrl;

    // Try each URL until we find one that works
    for (const url of imageUrls) {
      try {
        console.log(`📥 Attempting to fetch: ${url}`);
        const fetchResponse = await fetch(url, {
          headers: {
            'User-Agent': 'EvermarkBot/1.0',
            'Accept': 'image/*',
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout per attempt
        });

        if (fetchResponse.ok) {
          response = fetchResponse;
          finalUrl = url;
          console.log(`✅ Successfully fetched from: ${url}`);
          break;
        } else {
          console.warn(`⚠️ Failed to fetch from ${url}: ${fetchResponse.status}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error fetching from ${url}:`, error);
        continue;
      }
    }

    if (!response) {
      throw new Error('Failed to download image from all attempted sources');
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
      source: finalUrl,
      size: `${imageBuffer.byteLength} bytes`,
      type: contentType,
      dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
      aspectRatio: dimensions ? (dimensions.width / dimensions.height).toFixed(3) : 'unknown',
      isLikelyBookCover: dimensions ? (dimensions.width / dimensions.height) < 0.8 : 'unknown'
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