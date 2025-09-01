import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const EVERMARKS_TABLE = 'beta_evermarks';

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Extract Farcaster cast hash from URL
 */
function extractCastHash(url: string): string | null {
  // Match patterns like:
  // https://farcaster.xyz/username/0x123abc
  // https://farcaster.xyz/horsefacts.eth/0x941d16c5
  // https://warpcast.com/username/0x123abc
  
  // Look for the last 0x followed by hex characters
  const match = url.match(/\/0x([a-fA-F0-9]+)(?:\/|$)/);
  return match ? `0x${match[1]}` : null;
}

/**
 * Fetch cast metadata from our farcaster-cast API endpoint
 */
async function fetchCastMetadata(sourceUrl: string) {
  console.log(`🔍 Fetching cast metadata for URL: ${sourceUrl}`);

  // Pass the full URL to our farcaster-cast endpoint
  // It will handle URL vs hash detection automatically
  const response = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/farcaster-cast?hash=${encodeURIComponent(sourceUrl)}`);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cast metadata fetch failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Cast metadata fetch failed: ${result.error}`);
  }

  return result.data;
}

/**
 * Repair a single cast evermark
 */
async function repairCastEvermark(tokenId: number, sourceUrl: string) {
  console.log(`🔧 Repairing cast evermark #${tokenId}: ${sourceUrl}`);

  let castData = null;
  let isPlaceholder = false;

  try {
    // 1. Try to fetch rich cast metadata
    castData = await fetchCastMetadata(sourceUrl);
    console.log(`✅ Fetched cast metadata:`, {
      author: castData.author,
      username: castData.username,
      likes: castData.engagement?.likes,
      contentLength: castData.content?.length
    });
  } catch (error) {
    console.warn(`⚠️ Could not fetch cast metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Create placeholder metadata for missing/deleted casts
    const castHash = extractCastHash(sourceUrl);
    const username = sourceUrl.match(/farcaster\.xyz\/([^\/]+)/)?.[1] || 'unknown';
    
    castData = {
      castHash: castHash || 'unknown',
      author: `@${username}`,
      username: username,
      content: '[This cast is no longer available - it may have been deleted]',
      timestamp: new Date().toISOString(),
      engagement: { likes: 0, recasts: 0, replies: 0 },
      author_pfp: null,
      author_fid: null,
      channel: null,
      embeds: []
    };
    
    isPlaceholder = true;
    console.log(`🔄 Created placeholder metadata for deleted cast #${tokenId}`);
  }

  try {
    // 2. Create rich metadata in the same format as working cast #3
    const richMetadata = {
      cast: {
        text: castData.content,
        author_username: castData.username,
        author_display_name: castData.author,
        author_pfp: castData.author_pfp,
        author_fid: castData.author_fid,
        likes: castData.engagement?.likes || 0,
        recasts: castData.engagement?.recasts || 0,
        replies: castData.engagement?.replies || 0,
        timestamp: castData.timestamp,
        hash: castData.castHash,
        channel: castData.channel,
        embeds: castData.embeds || []
      },
      tags: ['farcaster', 'cast'],
      customFields: [
        { key: 'cast_author', value: castData.username || '' },
        { key: 'cast_hash', value: castData.castHash || '' },
        { key: 'cast_likes', value: String(castData.engagement?.likes || 0) },
        { key: 'cast_recasts', value: String(castData.engagement?.recasts || 0) },
        { key: 'cast_timestamp', value: castData.timestamp || '' }
      ]
    };

    // 3. Update database record
    const { data: updateData, error: updateError } = await supabase
      .from(EVERMARKS_TABLE)
      .update({
        metadata_json: JSON.stringify(richMetadata),
        updated_at: new Date().toISOString()
      })
      .eq('token_id', tokenId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(`✅ Updated database record for cast #${tokenId}`);

    // 4. Regenerate cast preview image
    try {
      console.log(`🖼️ Regenerating cast preview image for #${tokenId}`);
      const imageResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/generate-cast-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_id: tokenId })
      });

      if (imageResponse.ok) {
        const imageResult = await imageResponse.json();
        console.log(`✅ Generated new cast preview image: ${imageResult.imageUrl}`);
      } else {
        console.warn(`⚠️ Image generation failed: ${imageResponse.status}`);
      }
    } catch (imageError) {
      console.warn(`⚠️ Image generation failed:`, imageError);
      // Don't fail the repair if image generation fails
    }

    return {
      success: true,
      tokenId,
      sourceUrl,
      author: castData.author,
      likes: castData.engagement?.likes || 0,
      recasts: castData.engagement?.recasts || 0,
      isPlaceholder: isPlaceholder,
      status: isPlaceholder ? 'repaired_with_placeholder' : 'repaired_successfully'
    };

  } catch (error) {
    console.error(`❌ Repair failed for cast #${tokenId}:`, error);
    return {
      success: false,
      tokenId,
      sourceUrl,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Find broken cast evermarks that need repair
 */
async function findBrokenCasts() {
  console.log('🔍 Finding broken cast evermarks...');

  // Query for cast evermarks with minimal metadata
  const { data: allCasts, error } = await supabase
    .from(EVERMARKS_TABLE)
    .select('token_id, source_url, content_type, metadata_json')
    .eq('content_type', 'Cast');

  if (error) {
    throw new Error(`Failed to query casts: ${error.message}`);
  }

  // Filter for broken casts (those without rich cast data)
  const brokenCasts = allCasts.filter(cast => {
    try {
      const metadata = JSON.parse(cast.metadata_json);
      // A cast is broken if it doesn't have a 'cast' object in metadata
      return !metadata.cast || !metadata.cast.text || !metadata.cast.author_username;
    } catch {
      return true; // If metadata can't be parsed, it's definitely broken
    }
  });

  console.log(`📊 Found ${brokenCasts.length} broken cast evermarks:`, 
    brokenCasts.map(c => `#${c.token_id}`).join(', '));

  return brokenCasts;
}

export const handler: Handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests for safety
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only POST requests are supported'
      }),
    };
  }

  try {
    const requestBody = event.body ? JSON.parse(event.body) : {};
    const { action = 'repair_all', token_ids } = requestBody;

    console.log(`🚀 Starting cast metadata repair - Action: ${action}`);

    let castsToRepair = [];

    if (action === 'repair_specific' && token_ids && Array.isArray(token_ids)) {
      // Repair specific token IDs
      console.log(`🎯 Repairing specific casts: ${token_ids.join(', ')}`);
      
      const { data: specificCasts, error } = await supabase
        .from(EVERMARKS_TABLE)
        .select('token_id, source_url, content_type')
        .in('token_id', token_ids)
        .eq('content_type', 'Cast');

      if (error) {
        throw new Error(`Failed to fetch specific casts: ${error.message}`);
      }

      castsToRepair = specificCasts;
    } else {
      // Find and repair all broken casts
      castsToRepair = await findBrokenCasts();
    }

    if (castsToRepair.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'No broken cast evermarks found',
          repairs: []
        }),
      };
    }

    // Repair each cast
    const repairs = [];
    for (const cast of castsToRepair) {
      const result = await repairCastEvermark(cast.token_id, cast.source_url);
      repairs.push(result);
    }

    const successfulRepairs = repairs.filter(r => r.success);
    const failedRepairs = repairs.filter(r => !r.success);

    console.log(`📈 Repair Summary: ${successfulRepairs.length} successful, ${failedRepairs.length} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Repaired ${successfulRepairs.length} of ${repairs.length} cast evermarks`,
        repairs: {
          successful: successfulRepairs,
          failed: failedRepairs
        },
        summary: {
          total: repairs.length,
          successful: successfulRepairs.length,
          failed: failedRepairs.length
        }
      }),
    };

  } catch (error) {
    console.error('❌ Cast repair operation failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
      }),
    };
  }
};