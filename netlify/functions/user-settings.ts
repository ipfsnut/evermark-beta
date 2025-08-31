import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const USER_SETTINGS_TABLE = 'user_settings';

interface UserSettings {
  wallet_address: string;
  referrer_address?: string;
  referrer_set_at?: string;
  created_at: string;
  updated_at: string;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Validate Ethereum address
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
}

// Get wallet address from headers
function getWalletAddress(event: HandlerEvent): string | null {
  const headerAddress = event.headers['x-wallet-address'] || event.headers['X-Wallet-Address'];
  if (headerAddress && isValidWalletAddress(headerAddress)) {
    return headerAddress.toLowerCase();
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

  const { httpMethod, body } = event;
  const walletAddress = getWalletAddress(event);

  if (!walletAddress) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Valid wallet address required',
        details: 'Include wallet address in X-Wallet-Address header'
      }),
    };
  }

  try {
    switch (httpMethod) {
      case 'GET':
        // Get user settings
        const { data: settings, error: getError } = await supabase
          .from(USER_SETTINGS_TABLE)
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();

        if (getError && getError.code !== 'PGRST116') { // PGRST116 = no rows found
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch user settings' }),
          };
        }

        // Return settings or default empty settings
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            settings: settings || {
              wallet_address: walletAddress,
              referrer_address: null,
              referrer_set_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }),
        };

      case 'POST':
        // Create or update user settings
        const requestData = JSON.parse(body || '{}');
        
        // Validate referrer address if provided
        if (requestData.referrer_address && !isValidWalletAddress(requestData.referrer_address)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid referrer address format' }),
          };
        }

        // Prevent self-referral
        if (requestData.referrer_address && 
            requestData.referrer_address.toLowerCase() === walletAddress) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Cannot refer yourself' }),
          };
        }

        const settingsData: Partial<UserSettings> = {
          wallet_address: walletAddress,
          referrer_address: requestData.referrer_address?.toLowerCase() || null,
          referrer_set_at: requestData.referrer_address ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        };

        // Upsert user settings
        const { data: upsertData, error: upsertError } = await supabase
          .from(USER_SETTINGS_TABLE)
          .upsert([settingsData], { 
            onConflict: 'wallet_address',
            ignoreDuplicates: false 
          })
          .select()
          .single();

        if (upsertError) {
          console.error('Upsert error:', upsertError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to save user settings' }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ settings: upsertData }),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error: any) {
    console.error('User settings error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
    };
  }
};