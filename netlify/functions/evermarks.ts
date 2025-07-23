// netlify/functions/evermarks.ts - Main evermarks API endpoint
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Based on your actual schema
interface EvermarkRecord {
  token_id: number;
  title: string;
  author: string;
  owner: string;
  description?: string;
  content_type: string;
  source_url?: string;
  token_uri: string;
  created_at: string;
  sync_timestamp?: string;
  metadata_fetched: boolean;
  updated_at?: string;
  verified: boolean;
  user_id?: string;
  last_synced_at?: string;
  processed_image_url?: string;
  image_processing_status?: string;
  metadata?: any;
  tx_hash?: string;
  block_number?: number;
  image_processed_at?: string;
  metadata_json?: any;
  ipfs_metadata?: any;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const { httpMethod, path, queryStringParameters, body } = event;
  const tokenId = path?.split('/').pop();

  try {
    switch (httpMethod) {
      case 'GET':
        if (tokenId && tokenId !== 'evermarks') {
          // Get single evermark by token_id
          const { data, error } = await supabase
            .from('evermarks')
            .select('*')
            .eq('token_id', parseInt(tokenId))
            .single();

          if (error || !data) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Evermark not found' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data),
          };
        } else {
          // Get all evermarks with pagination and filtering
          const page = parseInt(queryStringParameters?.page || '1');
          const limit = parseInt(queryStringParameters?.limit || '12');
          const offset = (page - 1) * limit;
          
          const contentType = queryStringParameters?.content_type;
          const search = queryStringParameters?.search;
          const author = queryStringParameters?.author;
          const owner = queryStringParameters?.owner;
          const verified = queryStringParameters?.verified;
          const sortBy = queryStringParameters?.sort_by || 'created_at';
          const sortOrder = queryStringParameters?.sort_order || 'desc';

          let query = supabase
            .from('evermarks')
            .select('*', { count: 'exact' })
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(offset, offset + limit - 1);

          // Apply filters
          if (contentType) {
            query = query.eq('content_type', contentType);
          }
          if (author) {
            query = query.ilike('author', `%${author}%`);
          }
          if (owner) {
            query = query.eq('owner', owner);
          }
          if (verified !== undefined) {
            query = query.eq('verified', verified === 'true');
          }
          if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,author.ilike.%${search}%`);
          }

          const { data, error, count } = await query;

          if (error) {
            console.error('Database error:', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: 'Database query failed' }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              evermarks: data || [],
              pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
              },
            }),
          };
        }

      case 'POST':
        // Create new evermark
        const evermarkData = JSON.parse(body || '{}');
        
        // Validate required fields
        if (!evermarkData.title || !evermarkData.author || !evermarkData.owner || !evermarkData.content_type) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields: title, author, owner, content_type' }),
          };
        }

        const newEvermark: Partial<EvermarkRecord> = {
          ...evermarkData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata_fetched: false,
          verified: false,
        };

        const { data: createdData, error: createError } = await supabase
          .from('evermarks')
          .insert([newEvermark])
          .select()
          .single();

        if (createError) {
          console.error('Create error:', createError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create evermark' }),
          };
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(createdData),
        };

      case 'PUT':
        // Update evermark
        if (!tokenId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Token ID required for update' }),
          };
        }

        const updateData = JSON.parse(body || '{}');
        updateData.updated_at = new Date().toISOString();

        const { data: updatedData, error: updateError } = await supabase
          .from('evermarks')
          .update(updateData)
          .eq('token_id', parseInt(tokenId))
          .select()
          .single();

        if (updateError) {
          console.error('Update error:', updateError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to update evermark' }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedData),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Function error:', error);
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