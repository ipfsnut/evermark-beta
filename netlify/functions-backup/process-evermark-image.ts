import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const PINATA_JWT = process.env.PINATA_JWT || process.env.VITE_PINATA_JWT;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    const { tokenId, imageUrl } = body;

    if (!tokenId || !imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token ID and image URL are required' })
      };
    }

    console.log(`🖼️ Processing image for evermark ${tokenId}: ${imageUrl}`);

    // Process image via server-side function
    const imageProcessResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/process-readme-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl })
    });

    if (!imageProcessResponse.ok) {
      throw new Error('Image processing failed');
    }

    const imageResult = await imageProcessResponse.json();
    
    if (!imageResult.success) {
      throw new Error(`Image processing failed: ${imageResult.error}`);
    }

    console.log(`📤 Uploading processed image to Pinata...`);
    console.log(`🔑 Pinata JWT available: ${PINATA_JWT ? 'YES' : 'NO'}`);
    console.log(`🔑 JWT length: ${PINATA_JWT?.length || 0}`);

    // Convert base64 to buffer for Pinata upload
    const base64Data = imageResult.dataUrl.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Create proper multipart form data with Buffer concatenation
    const boundary = `----formdata-${Date.now()}`;
    const filename = `evermark-${tokenId}-cover.${imageResult.contentType?.split('/')[1] || 'png'}`;
    
    const header = Buffer.from([
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${filename}"`,
      `Content-Type: ${imageResult.contentType}`,
      '',
      ''
    ].join('\r\n'), 'utf8');
    
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    
    const formDataBuffer = Buffer.concat([header, imageBuffer, footer]);
    
    // Upload to Pinata with proper form data
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formDataBuffer.length.toString()
      },
      body: formDataBuffer
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      throw new Error(`Pinata upload failed: ${pinataResponse.status} - ${errorText}`);
    }

    const pinataResult = await pinataResponse.json();
    const ipfsHash = pinataResult.IpfsHash;

    console.log(`✅ Uploaded to IPFS: ${ipfsHash}`);

    // Update database with IPFS hash
    const { error: updateError } = await supabase
      .from('beta_evermarks')
      .update({
        ipfs_image_hash: ipfsHash,
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(`✅ Database updated with IPFS hash for evermark ${tokenId}`);

    // Trigger image caching
    try {
      await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/cache-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trigger: 'manual',
          tokenIds: [parseInt(tokenId)]
        })
      });
      console.log(`✅ Image caching triggered for evermark ${tokenId}`);
    } catch (cacheError) {
      console.warn(`⚠️ Cache trigger failed for evermark ${tokenId}:`, cacheError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Image processed successfully for evermark ${tokenId}`,
        tokenId,
        ipfsHash,
        imageUrl
      })
    };

  } catch (error) {
    console.error('❌ Image processing failed:', error);
    
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