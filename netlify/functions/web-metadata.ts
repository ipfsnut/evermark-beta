import { Handler } from '@netlify/functions';
import { WebMetadataService } from '../../src/features/evermarks/services/WebMetadataService';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'URL parameter is required' }),
    };
  }

  try {
    console.log('📰 Fetching web metadata for:', url);
    
    // Use server-side method that can fetch HTML without CORS
    const metadata = await WebMetadataService.fetchWebContentMetadataServerSide(url);
    
    if (!metadata) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No metadata found for URL' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, metadata }),
    };
  } catch (error) {
    console.error('Web metadata fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};