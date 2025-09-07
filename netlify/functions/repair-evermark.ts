import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// Pinata service configuration
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';

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
    const { tokenId } = body;

    if (!tokenId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Token ID is required' })
      };
    }

    console.log(`🔧 Starting repair for evermark ${tokenId}...`);

    // Get the evermark from database
    const { data: evermark, error: fetchError } = await supabase
      .from('beta_evermarks')
      .select('*')
      .eq('token_id', tokenId)
      .single();

    if (fetchError || !evermark) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: `Evermark ${tokenId} not found` })
      };
    }

    if (evermark.content_type !== 'README') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Only README evermarks can be repaired with this function' })
      };
    }

    console.log(`📚 Repairing README evermark: ${evermark.title}`);

    // Extract contract and token ID from source URL
    const sourceUrl = evermark.source_url;
    const urlMatch = sourceUrl.match(/\/matic\/([^\/]+)\/(\d+)/);
    
    if (!urlMatch) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot extract contract/tokenId from source URL' })
      };
    }

    const [, contract, sourceTokenId] = urlMatch;
    console.log(`📋 Extracted: contract=${contract}, sourceTokenId=${sourceTokenId}`);

    // Fetch README metadata
    const metadataResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/readme-metadata?contract=${contract}&tokenId=${sourceTokenId}`);
    
    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch README metadata');
    }

    const metadataResult = await metadataResponse.json();
    
    if (!metadataResult.success) {
      throw new Error('README metadata fetch failed');
    }

    const nftData = metadataResult.data.nft;
    const imageUrl = nftData.image_url;
    
    if (!imageUrl) {
      throw new Error('No image URL found in metadata');
    }

    console.log(`🖼️ Processing image: ${imageUrl}`);

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

    console.log(`📦 Storing image data for processing...`);

    // Store the processed image data temporarily for the cache-images function to handle
    // We'll create a temporary record that cache-images can process
    const tempImageData = {
      originalUrl: imageUrl,
      processedData: imageResult.dataUrl,
      contentType: imageResult.contentType
    };

    console.log(`💾 Image data prepared for cache processing`);

    // Extract IPFS hash for book content
    const bookContentHash = nftData.animation_url?.includes('ipfs') 
      ? nftData.animation_url.split('/').pop()
      : null;

    // Update database with image data and proper metadata
    const updatedMetadata = {
      tags: ['readme', 'book', nftData.traits?.find((t: any) => t.trait_type === 'Language')?.value?.toLowerCase() || 'en'].filter(Boolean),
      customFields: [
        { key: 'readme_author', value: nftData.traits?.find((t: any) => t.trait_type === 'Author(s)')?.value || '' },
        { key: 'readme_title', value: nftData.name || evermark.title },
        { key: 'readme_language', value: nftData.traits?.find((t: any) => t.trait_type === 'Language')?.value || 'EN' },
        { key: 'readme_publisher', value: 'PageDAO' },
        { key: 'readme_polygon_contract', value: contract },
        { key: 'readme_polygon_token_id', value: sourceTokenId },
        ...(bookContentHash ? [{ key: 'readme_ipfs_hash', value: bookContentHash }] : [])
      ],
      // Add README-specific data
      readmeData: {
        bookTitle: nftData.name || evermark.title,
        bookAuthor: nftData.traits?.find((t: any) => t.trait_type === 'Author(s)')?.value || 'Unknown',
        polygonContract: contract,
        polygonTokenId: sourceTokenId,
        bookDescription: nftData.description || '',
        language: nftData.traits?.find((t: any) => t.trait_type === 'Language')?.value || 'EN',
        publisher: 'PageDAO',
        tokenGated: false,
        ...(bookContentHash ? { ipfsHash: bookContentHash } : {})
      }
    };

    // Store the image URL temporarily in metadata for manual processing
    const metadataWithImageUrl = {
      ...updatedMetadata,
      temporaryImageUrl: imageUrl // Store for manual processing
    };

    // Update the evermark record with metadata
    const { error: updateError } = await supabase
      .from('beta_evermarks')
      .update({
        metadata_json: JSON.stringify(metadataWithImageUrl),
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(`✅ Database updated for evermark ${tokenId}`);

    // Trigger image caching
    try {
      await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/cache-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trigger: 'repair',
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
        message: `Evermark ${tokenId} repaired successfully`,
        tokenId,
        imageUrl,
        bookContentHash,
        author: updatedMetadata.readmeData.bookAuthor,
        title: updatedMetadata.readmeData.bookTitle
      })
    };

  } catch (error) {
    console.error('❌ Evermark repair failed:', error);
    
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