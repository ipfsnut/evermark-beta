import { Handler } from '@netlify/functions';

// CORS headers for cross-origin requests
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Neynar API configuration
const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';
const NEYNAR_API_KEY = process.env.VITE_NEYNAR_API_KEY;

// Our FarcasterCastData interface structure
interface FarcasterCastData {
  castHash?: string;
  author?: string;
  username?: string;
  content?: string;
  timestamp?: string;
  engagement?: {
    likes: number;
    recasts: number;
    replies: number;
  };
  // Enhanced fields for better image generation
  author_pfp?: string;
  author_fid?: number;
  channel?: string;
  embeds?: Array<{
    url?: string;
    cast_id?: any;
  }>;
}

// Neynar API response structure (simplified)
interface NeynarCastResponse {
  cast: {
    hash: string;
    author: {
      username: string;
      display_name: string;
      pfp_url: string;
      fid: number;
    };
    text: string;
    timestamp: string;
    reactions: {
      likes_count: number;
      recasts_count: number;
    };
    replies: {
      count: number;
    };
    embeds?: Array<{
      url?: string;
      cast_id?: any;
    }>;
    channel?: {
      id: string;
      name: string;
    };
  };
}

/**
 * Validate if a string is a valid Farcaster cast hash
 */
function isValidCastHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') return false;
  
  // Farcaster cast hashes are hex strings, typically 40-64 characters
  // Can start with 0x or not
  const cleanHash = hash.startsWith('0x') ? hash : `0x${hash}`;
  return /^0x[a-fA-F0-9]{8,64}$/.test(cleanHash);
}

/**
 * Transform Neynar API response to our FarcasterCastData format
 */
function transformNeynarResponse(neynarData: NeynarCastResponse): FarcasterCastData {
  const { cast } = neynarData;
  
  return {
    castHash: cast.hash,
    author: cast.author.display_name || cast.author.username,
    username: cast.author.username,
    content: cast.text || '',
    timestamp: cast.timestamp,
    engagement: {
      likes: cast.reactions?.likes_count || 0,
      recasts: cast.reactions?.recasts_count || 0,
      replies: cast.replies?.count || 0
    },
    // Enhanced fields for better image generation
    author_pfp: cast.author.pfp_url,
    author_fid: cast.author.fid,
    channel: cast.channel?.name || cast.channel?.id,
    embeds: cast.embeds || []
  };
}

/**
 * Fetch cast metadata from Neynar API using hash or URL
 */
async function fetchFromNeynar(identifier: string): Promise<FarcasterCastData> {
  if (!NEYNAR_API_KEY) {
    throw new Error('NEYNAR_API_KEY not configured');
  }

  // Determine if identifier is a URL or hash
  let apiUrl: string;
  let identifierType: string;
  
  if (identifier.startsWith('http')) {
    // It's a URL - use URL lookup
    apiUrl = `${NEYNAR_API_BASE}/cast?identifier=${encodeURIComponent(identifier)}&type=url&api_key=${NEYNAR_API_KEY}`;
    identifierType = 'URL';
    console.log(`🔍 Fetching cast from Neynar by URL: ${identifier}`);
  } else {
    // It's a hash - ensure it has 0x prefix
    const formattedHash = identifier.startsWith('0x') ? identifier : `0x${identifier}`;
    apiUrl = `${NEYNAR_API_BASE}/cast?identifier=${encodeURIComponent(formattedHash)}&type=hash&api_key=${NEYNAR_API_KEY}`;
    identifierType = 'hash';
    console.log(`🔍 Fetching cast from Neynar by hash: ${formattedHash}`);
  }
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    // Add timeout to prevent hanging requests
    signal: AbortSignal.timeout(10000) // 10 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Neynar API error (${response.status}):`, errorText);
    
    if (response.status === 404) {
      throw new Error(`Cast not found: ${identifier}`);
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded - please try again later');
    } else {
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }
  }

  const neynarData: NeynarCastResponse = await response.json();
  return transformNeynarResponse(neynarData);
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        error: 'Method not allowed',
        message: 'Only GET requests are supported'
      }),
    };
  }

  try {
    // Get cast hash from query parameters
    const castHash = event.queryStringParameters?.hash;
    
    if (!castHash) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing cast hash',
          message: 'Please provide a cast hash in the ?hash= query parameter'
        }),
      };
    }

    // Validate cast hash format (if it's not a URL)
    if (!castHash.startsWith('http') && !isValidCastHash(castHash)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid cast identifier format',
          message: 'Identifier must be either a valid hex hash (with or without 0x prefix) or a farcaster.xyz URL'
        }),
      };
    }

    console.log(`📡 Cast metadata request for: ${castHash}`);

    // Fetch cast data from Neynar API (supporting both URLs and hashes)
    const castData = await fetchFromNeynar(castHash);
    
    console.log(`✅ Cast metadata fetched successfully:`, {
      hash: castData.castHash,
      author: castData.author,
      contentLength: castData.content?.length || 0,
      likes: castData.engagement?.likes || 0
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: castData
      }),
    };

  } catch (error) {
    console.error('❌ Cast metadata fetch failed:', error);
    
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('cast not found')) {
        statusCode = 404;
        errorMessage = 'Cast not found - it may have been deleted or the hash is incorrect';
      } else if (message.includes('rate limit')) {
        statusCode = 429;
        errorMessage = 'API rate limit exceeded - please try again in a few minutes';
      } else if (message.includes('timeout') || message.includes('aborted')) {
        statusCode = 408;
        errorMessage = 'Request timeout - Neynar API took too long to respond';
      } else if (message.includes('neynar_api_key not configured')) {
        statusCode = 503;
        errorMessage = 'Service configuration error - please try again later';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
      }),
    };
  }
};