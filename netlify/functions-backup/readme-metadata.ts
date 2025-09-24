import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { contract, tokenId } = event.queryStringParameters || {};
    
    if (!contract || !tokenId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing contract or tokenId parameter' })
      };
    }

    console.log(`🔍 Fetching README metadata for ${contract}/${tokenId}`);

    // Try multiple OpenSea endpoints
    const endpoints = [
      `https://api.opensea.io/v2/chain/matic/contract/${contract}/nfts/${tokenId}`,
      `https://api.opensea.io/api/v1/asset/${contract}/${tokenId}`,
    ];

    let data = null;
    let usedEndpoint = '';

    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': 'Evermarks/1.0 (https://evermarks.net)',
            'Accept': 'application/json',
          }
        });

        if (response.ok) {
          data = await response.json();
          usedEndpoint = endpoint;
          console.log(`✅ Success with endpoint: ${endpoint}`);
          break;
        } else {
          console.log(`❌ Failed endpoint ${endpoint}: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Error with endpoint ${endpoint}:`, error);
        continue;
      }
    }

    if (!data) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Could not fetch metadata from any OpenSea endpoint',
          tried: endpoints 
        })
      };
    }

    // Process and normalize the data based on which endpoint worked
    const processedData = {
      success: true,
      method: usedEndpoint.includes('v2') ? 'opensea_v2' : 'opensea_v1',
      data: data
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(processedData)
    };

  } catch (error) {
    console.error('README metadata fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };