// netlify/functions/evermark-bot-processor.ts
// Core logic for processing evermark requests from comments
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Beta table name
const EVERMARKS_TABLE = 'beta_evermarks';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface FarcasterCastData {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  text: string;
  timestamp: string;
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
  parent_hash?: string;
  parent_url?: string;
}

interface EvermarkRequest {
  requester: {
    fid: number;
    username: string;
    display_name: string;
  };
  request_cast_hash: string;
  parent_cast_data?: FarcasterCastData;
}

// Fetch cast data from Neynar
async function fetchCastData(castHash: string): Promise<FarcasterCastData | null> {
  try {
    if (!process.env.NEYNAR_API_KEY) {
      throw new Error('NEYNAR_API_KEY not configured');
    }

    const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`, {
      headers: {
        'accept': 'application/json',
        'api_key': process.env.NEYNAR_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status}`);
    }

    const data = await response.json();
    const cast = data.cast;

    return {
      hash: cast.hash,
      author: {
        fid: cast.author.fid,
        username: cast.author.username,
        display_name: cast.author.display_name,
        pfp_url: cast.author.pfp_url
      },
      text: cast.text || '',
      timestamp: cast.timestamp,
      reactions: {
        likes_count: cast.reactions?.likes_count || 0,
        recasts_count: cast.reactions?.recasts_count || 0
      },
      parent_hash: cast.parent_hash,
      parent_url: cast.parent_url
    };
  } catch (error) {
    console.error('Failed to fetch cast data:', error);
    return null;
  }
}

// Check if cast is already evermarked
async function checkExistingEvermark(castHash: string): Promise<{ exists: boolean; tokenId?: number }> {
  try {
    const { data, error } = await supabase
      .from(EVERMARKS_TABLE)
      .select('token_id')
      .or(`cast_hash.eq.${castHash},cast_url.ilike.%${castHash}%`)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Database error checking existing evermark:', error);
      return { exists: false };
    }

    return { 
      exists: !!data, 
      tokenId: data?.token_id 
    };
  } catch (error) {
    console.error('Failed to check existing evermark:', error);
    return { exists: false };
  }
}

// Create evermark from cast data
async function createEvermarkFromCast(castData: FarcasterCastData, requester: EvermarkRequest['requester']): Promise<{ success: boolean; tokenId?: number; error?: string }> {
  try {
    // Construct the cast URL
    const castUrl = `https://warpcast.com/${castData.author.username}/${castData.hash}`;

    // Prepare evermark metadata
    const evermarkMetadata = {
      title: castData.text.substring(0, 100) || `Cast by ${castData.author.display_name}`,
      description: castData.text || 'Farcaster cast preserved by community request',
      sourceUrl: castUrl,
      author: castData.author.display_name,
      tags: ['farcaster', 'cast', 'community-requested'],
      contentType: 'Cast',
      customFields: [
        { key: 'requested_by_fid', value: requester.fid.toString() },
        { key: 'requested_by_username', value: requester.username },
        { key: 'cast_author_fid', value: castData.author.fid.toString() },
        { key: 'cast_author_username', value: castData.author.username },
        { key: 'cast_hash', value: castData.hash },
        { key: 'cast_likes', value: castData.reactions.likes_count.toString() },
        { key: 'cast_recasts', value: castData.reactions.recasts_count.toString() },
        { key: 'cast_timestamp', value: castData.timestamp }
      ]
    };

    // Call the existing evermarks API to create the evermark
    const createResponse = await fetch(`${process.env.URL || 'https://evermarks.net'}/.netlify/functions/evermarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metadata: evermarkMetadata,
        // Note: No image for bot-created evermarks, will use auto-generated cast image
      })
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      throw new Error(`Evermark creation failed: ${errorData}`);
    }

    const result = await createResponse.json();
    
    if (result.success && result.evermark) {
      console.log('✅ Evermark created:', result.evermark.token_id);
      return { 
        success: true, 
        tokenId: result.evermark.token_id 
      };
    } else {
      throw new Error(result.error || 'Unknown creation error');
    }

  } catch (error) {
    console.error('Evermark creation failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Log evermark request result
async function logRequestResult(requestData: {
  requester_fid: number;
  requester_username: string;
  request_cast_hash: string;
  parent_cast_hash?: string;
  status: 'completed' | 'failed';
  token_id?: number;
  error_message?: string;
}) {
  try {
    await supabase
      .from('evermark_requests')
      .insert([{
        ...requestData,
        created_at: new Date().toISOString()
      }]);
  } catch (error) {
    console.error('Failed to log request result:', error);
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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
    const requestData: EvermarkRequest = JSON.parse(event.body || '{}');
    
    console.log('🔄 Processing evermark request:', {
      requester: requestData.requester.username,
      request_hash: requestData.request_cast_hash
    });

    // If no parent cast is provided, we need to find it
    let targetCastHash = requestData.parent_cast_data?.hash;
    
    if (!targetCastHash) {
      // If no parent cast data, fetch the request cast to find its parent
      const requestCast = await fetchCastData(requestData.request_cast_hash);
      if (!requestCast?.parent_hash) {
        throw new Error('No cast found to evermark. Make sure you\'re replying to a cast!');
      }
      targetCastHash = requestCast.parent_hash;
    }

    // Check if already evermarked
    const existingCheck = await checkExistingEvermark(targetCastHash);
    if (existingCheck.exists) {
      await logRequestResult({
        requester_fid: requestData.requester.fid,
        requester_username: requestData.requester.username,
        request_cast_hash: requestData.request_cast_hash,
        parent_cast_hash: targetCastHash,
        status: 'failed',
        error_message: `Already evermarked as Token ID: ${existingCheck.tokenId}`
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: `This cast is already evermarked! Token ID: ${existingCheck.tokenId}`,
          existing_token_id: existingCheck.tokenId
        }),
      };
    }

    // Fetch the target cast data
    const targetCastData = await fetchCastData(targetCastHash);
    if (!targetCastData) {
      throw new Error('Could not fetch the cast data. The cast might be deleted or private.');
    }

    // Create the evermark
    const createResult = await createEvermarkFromCast(targetCastData, requestData.requester);
    
    if (createResult.success) {
      await logRequestResult({
        requester_fid: requestData.requester.fid,
        requester_username: requestData.requester.username,
        request_cast_hash: requestData.request_cast_hash,
        parent_cast_hash: targetCastHash,
        status: 'completed',
        token_id: createResult.tokenId
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          token_id: createResult.tokenId,
          cast_author: targetCastData.author.username,
          cast_text: targetCastData.text.substring(0, 100)
        }),
      };
    } else {
      await logRequestResult({
        requester_fid: requestData.requester.fid,
        requester_username: requestData.requester.username,
        request_cast_hash: requestData.request_cast_hash,
        parent_cast_hash: targetCastHash,
        status: 'failed',
        error_message: createResult.error
      });

      throw new Error(createResult.error || 'Evermark creation failed');
    }

  } catch (error) {
    console.error('Evermark processor error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};