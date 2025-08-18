// netlify/functions/shares.ts - Social sharing tracking
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const { httpMethod, queryStringParameters, body } = event;

  try {
    switch (httpMethod) {
      case 'GET':
        const tokenId = queryStringParameters?.token_id;
        
        if (tokenId) {
          // Get share statistics for specific evermark
          const { data, error } = await supabase
            .from('shares')
            .select('platform')
            .eq('token_id', parseInt(tokenId));

          if (error) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: 'Failed to get share stats' }),
            };
          }

          // Count shares by platform
          const shareStats = (data || []).reduce((acc: any, share: any) => {
            acc[share.platform] = (acc[share.platform] || 0) + 1;
            return acc;
          }, {});

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              token_id: parseInt(tokenId),
              shares: shareStats,
              total: data?.length || 0
            }),
          };
        } else {
          // Get trending shares from last 7 days
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          
          const { data, error } = await supabase
            .from('shares')
            .select(`
              token_id,
              evermarks!inner(title, author, description, processed_image_url)
            `)
            .gte('created_at', sevenDaysAgo);

          if (error) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: 'Failed to get trending shares' }),
            };
          }

          // Group by token_id and count
          const trending = (data || []).reduce((acc: any, share: any) => {
            const tokenId = share.token_id;
            if (!acc[tokenId]) {
              acc[tokenId] = {
                token_id: tokenId,
                share_count: 0,
                evermark: share.evermarks
              };
            }
            acc[tokenId].share_count++;
            return acc;
          }, {});

          const trendingArray = Object.values(trending)
            .sort((a: any, b: any) => b.share_count - a.share_count)
            .slice(0, 10);

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ trending: trendingArray }),
          };
        }

      case 'POST':
        // Record a share
        const shareData = JSON.parse(body || '{}');
        
        if (!shareData.token_id || !shareData.platform) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing token_id or platform' }),
          };
        }

        const { data: share, error } = await supabase
          .from('shares')
          .insert([{
            token_id: shareData.token_id,
            platform: shareData.platform,
            user_address: shareData.user_address,
            metadata: shareData.metadata || {},
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (error) {
          console.error('Share creation error:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to record share' }),
          };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(share),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Shares function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};