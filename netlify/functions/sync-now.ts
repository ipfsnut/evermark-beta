import { Handler } from '@netlify/functions';
import { syncRecentEvermarks } from '../../src/lib/chain-sync';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('🔄 Manual sync triggered');
    
    // Get count from query params (default to 20 for manual sync)
    const count = parseInt(event.queryStringParameters?.count || '20', 10);
    
    console.log(`📊 Syncing last ${count} Evermarks from chain...`);
    
    const result = await syncRecentEvermarks(count);
    
    console.log('✅ Sync completed:', result);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Sync completed successfully`,
        synced: result.synced,
        needsCache: result.needsCache,
        timestamp: new Date().toISOString()
      }),
    };
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
    };
  }
};