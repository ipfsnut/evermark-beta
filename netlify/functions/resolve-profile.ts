import { Handler } from '@netlify/functions';

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Neynar API configuration
const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster';
const NEYNAR_API_KEY = process.env.VITE_NEYNAR_API_KEY;

interface ProfileInfo {
  address: string;
  farcasterUsername?: string;
  farcasterDisplayName?: string;
  farcasterFid?: number;
  farcasterPfp?: string;
  ensName?: string;
  displayName: string; // Final resolved name to use
  source: 'farcaster' | 'ens' | 'address';
}

/**
 * Resolve user profile information with priority:
 * 1. Farcaster username
 * 2. ENS name  
 * 3. Truncated address
 */
async function resolveProfile(address: string): Promise<ProfileInfo> {
  const normalizedAddress = address.toLowerCase();
  let profile: ProfileInfo = {
    address: normalizedAddress,
    displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
    source: 'address'
  };

  // 1. Try Farcaster lookup
  if (NEYNAR_API_KEY) {
    try {
      console.log(`🔍 Looking up Farcaster profile for ${address}`);
      
      const response = await fetch(
        `${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${normalizedAddress}&api_key=${NEYNAR_API_KEY}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        }
      );

      if (response.ok) {
        const data = await response.json();
        const userData = data[normalizedAddress]?.[0];
        
        if (userData) {
          profile.farcasterUsername = userData.username;
          profile.farcasterDisplayName = userData.display_name;
          profile.farcasterFid = userData.fid;
          profile.farcasterPfp = userData.pfp_url;
          profile.displayName = userData.display_name || userData.username;
          profile.source = 'farcaster';
          
          console.log(`✅ Found Farcaster profile: ${profile.displayName}`);
          return profile;
        }
      }
    } catch (error) {
      console.warn('⚠️ Farcaster lookup failed:', error);
    }
  }

  // 2. Try ENS lookup (simplified version - could be enhanced)
  try {
    console.log(`🔍 Looking up ENS for ${address}`);
    
    // Using a public ENS API service
    const ensResponse = await fetch(
      `https://api.ensideas.com/ens/resolve/${normalizedAddress}`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (ensResponse.ok) {
      const ensData = await ensResponse.json();
      if (ensData.name && ensData.name !== normalizedAddress) {
        profile.ensName = ensData.name;
        profile.displayName = ensData.name;
        profile.source = 'ens';
        
        console.log(`✅ Found ENS name: ${profile.displayName}`);
        return profile;
      }
    }
  } catch (error) {
    console.warn('⚠️ ENS lookup failed:', error);
  }

  // 3. Fallback to truncated address (already set)
  console.log(`📍 Using truncated address: ${profile.displayName}`);
  return profile;
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
    const address = event.queryStringParameters?.address;
    
    if (!address) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing address parameter',
          message: 'Please provide an address in the ?address= query parameter'
        }),
      };
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid address format',
          message: 'Address must be a valid Ethereum address'
        }),
      };
    }

    console.log(`📡 Profile resolution request for: ${address}`);

    const profile = await resolveProfile(address);
    
    console.log(`✅ Profile resolved:`, {
      address: profile.address,
      displayName: profile.displayName,
      source: profile.source
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        profile
      }),
    };

  } catch (error) {
    console.error('❌ Profile resolution failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Profile resolution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};