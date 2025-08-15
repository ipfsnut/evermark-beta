import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Simple wallet address validation
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
}

// Get wallet address from headers or body
function getWalletAddress(event: HandlerEvent): string | null {
  // Try header first
  const headerAddress = event.headers['x-wallet-address'] || event.headers['X-Wallet-Address'];
  if (headerAddress && isValidWalletAddress(headerAddress)) {
    return headerAddress.toLowerCase();
  }

  // Try body
  try {
    const body = JSON.parse(event.body || '{}');
    if (body.wallet_address && isValidWalletAddress(body.wallet_address)) {
      return body.wallet_address.toLowerCase();
    }
    if (body.owner && isValidWalletAddress(body.owner)) {
      return body.owner.toLowerCase();
    }
  } catch {
    // Invalid JSON, continue
  }

  return null;
}

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
        // Validate wallet address for creating evermarks
        const walletAddress = getWalletAddress(event);
        if (!walletAddress) {
          console.log('❌ No valid wallet address provided');
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Valid wallet address required to create evermarks',
              details: 'Include wallet address in X-Wallet-Address header or request body'
            }),
          };
        }

        console.log('✅ Creating evermark for wallet:', walletAddress);

        // Create new evermark
        const evermarkData = JSON.parse(body || '{}');
        
        // Validate required fields
        if (!evermarkData.title || !evermarkData.content_type) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing required fields: title, content_type' }),
          };
        }

        // PRODUCTION: This endpoint is now called AFTER successful blockchain minting
        // Validate that we have the required blockchain data
        if (!evermarkData.token_id || !evermarkData.tx_hash) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Missing blockchain data',
              message: 'token_id and tx_hash are required for database sync after minting'
            }),
          };
        }
        
        console.log('✅ Creating evermark database record after blockchain mint:', {
          tokenId: evermarkData.token_id,
          txHash: evermarkData.tx_hash,
          wallet: walletAddress
        });
        
        // Auto-populate user data from wallet address
        const newEvermark: Partial<EvermarkRecord> = {
          ...evermarkData,
          author: evermarkData.author || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          owner: walletAddress,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata_fetched: true, // We have the metadata from IPFS
          verified: false, // Will be verified later
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
            body: JSON.stringify({ 
              error: 'Failed to create evermark',
              details: createError.message 
            }),
          };
        }

        console.log('✅ Evermark created:', createdData.token_id);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(createdData),
        };

      case 'PUT':
        // Validate wallet address for updating evermarks
        const updateWalletAddress = getWalletAddress(event);
        if (!updateWalletAddress) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Valid wallet address required to update evermarks' }),
          };
        }

        // Update evermark
        if (!tokenId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Token ID required for update' }),
          };
        }

        // First, check if the wallet owns this evermark
        const { data: existingEvermark, error: fetchError } = await supabase
          .from('evermarks')
          .select('owner, user_id')
          .eq('token_id', parseInt(tokenId))
          .single();

        if (fetchError || !existingEvermark) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Evermark not found' }),
          };
        }

        // Check ownership - only check owner field since user_id is UUID
        const isOwner = existingEvermark.owner?.toLowerCase() === updateWalletAddress;

        if (!isOwner) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'You can only update your own evermarks' }),
          };
        }

        const updateData = JSON.parse(body || '{}');
        
        // Don't allow changing ownership
        delete updateData.owner;
        delete updateData.user_id; // Keep this to prevent any attempts to set it
        
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

        console.log('✅ Evermark updated by owner:', updateWalletAddress);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updatedData),
        };

      case 'DELETE':
        // Validate wallet address for deleting evermarks
        const deleteWalletAddress = getWalletAddress(event);
        if (!deleteWalletAddress) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Valid wallet address required to delete evermarks' }),
          };
        }

        if (!tokenId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Token ID required for deletion' }),
          };
        }

        // Check ownership before deletion
        const { data: deleteEvermark, error: deleteFetchError } = await supabase
          .from('evermarks')
          .select('owner, user_id, title')
          .eq('token_id', parseInt(tokenId))
          .single();

        if (deleteFetchError || !deleteEvermark) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Evermark not found' }),
          };
        }

        // Check ownership - only check owner field since user_id is UUID
        const isDeleteOwner = deleteEvermark.owner?.toLowerCase() === deleteWalletAddress;

        if (!isDeleteOwner) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'You can only delete your own evermarks' }),
          };
        }

        const { error: deleteError } = await supabase
          .from('evermarks')
          .delete()
          .eq('token_id', parseInt(tokenId));

        if (deleteError) {
          console.error('Delete error:', deleteError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to delete evermark' }),
          };
        }

        console.log('✅ Evermark deleted by owner:', deleteWalletAddress);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Evermark deleted successfully' }),
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