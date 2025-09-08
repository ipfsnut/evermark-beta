import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const POINTS_TABLE = 'beta_points';
const TRANSACTIONS_TABLE = 'beta_point_transactions';

interface PointsRecord {
  wallet_address: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

interface PointTransaction {
  wallet_address: string;
  action_type: 'create_evermark' | 'vote' | 'stake';
  points_earned: number;
  related_id?: string;
  tx_hash?: string;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Wallet-Address',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// Point values matching beta-points.txt
const POINT_VALUES = {
  create_evermark: 10,
  vote: 1,
  stake: 1 // per 1,000,000 EMARK
};

function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address);
}

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
    return { statusCode: 200, headers, body: '' };
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        return await handleGetPoints(event);
      case 'POST':
        return await handleAwardPoints(event);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error: any) {
    console.error('Beta points error:', error);
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

async function handleGetPoints(event: HandlerEvent) {
  const walletAddress = getWalletAddress(event);
  const { action } = event.queryStringParameters || {};

  if (action === 'leaderboard') {
    // Get leaderboard
    const { data: leaderboard, error } = await supabase
      .from(POINTS_TABLE)
      .select('wallet_address, total_points')
      .order('total_points', { ascending: false })
      .limit(100);

    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch leaderboard' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ leaderboard }),
    };
  }

  if (!walletAddress) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Valid wallet address required' }),
    };
  }

  // Get user points
  const { data: points, error: pointsError } = await supabase
    .from(POINTS_TABLE)
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (pointsError && pointsError.code !== 'PGRST116') {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch points' }),
    };
  }

  // Get user transaction history
  const { data: transactions, error: txError } = await supabase
    .from(TRANSACTIONS_TABLE)
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .limit(50);

  if (txError) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch transaction history' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      points: points || { wallet_address: walletAddress, total_points: 0 },
      transactions: transactions || []
    }),
  };
}

async function handleAwardPoints(event: HandlerEvent) {
  const walletAddress = getWalletAddress(event);
  
  if (!walletAddress) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Valid wallet address required' }),
    };
  }

  const requestData = JSON.parse(event.body || '{}');
  const { action_type, related_id, tx_hash, stake_amount } = requestData;

  if (!action_type || !POINT_VALUES[action_type as keyof typeof POINT_VALUES]) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action_type' }),
    };
  }

  // Calculate points based on action
  let points_earned = POINT_VALUES[action_type as keyof typeof POINT_VALUES];
  
  if (action_type === 'stake' && stake_amount) {
    // 1 point per 1,000,000 EMARK staked
    const stakeAmountNum = parseFloat(stake_amount);
    points_earned = Math.floor(stakeAmountNum / 1000000);
  }

  // Start transaction to update both tables
  const { data: transaction, error: txError } = await supabase
    .from(TRANSACTIONS_TABLE)
    .insert([{
      wallet_address: walletAddress,
      action_type,
      points_earned,
      related_id,
      tx_hash
    }])
    .select()
    .single();

  if (txError) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to record point transaction' }),
    };
  }

  // Get existing points first
  const { data: existingPoints } = await supabase
    .from(POINTS_TABLE)
    .select('total_points')
    .eq('wallet_address', walletAddress)
    .single();

  const currentTotal = existingPoints?.total_points || 0;
  const newTotal = currentTotal + points_earned;

  // Upsert total points with proper increment
  const { data: updatedPoints, error: pointsError } = await supabase
    .from(POINTS_TABLE)
    .upsert({
      wallet_address: walletAddress,
      total_points: newTotal,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (pointsError) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update points total' }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      points_earned,
      total_points: updatedPoints.total_points,
      transaction
    }),
  };
}