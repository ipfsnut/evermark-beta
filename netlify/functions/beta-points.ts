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
  const { action } = event.queryStringParameters || {};

  if (action === 'cleanup') {
    // Special admin endpoint to fix duplicate points
    try {
      console.log('🔄 Starting points database cleanup...');

      // Get all transactions and group by wallet
      const { data: allTransactions } = await supabase
        .from(TRANSACTIONS_TABLE)
        .select('wallet_address, points_earned');

      if (!allTransactions) {
        throw new Error('Failed to fetch transactions');
      }

      // Calculate correct totals
      const walletTotals = new Map<string, number>();
      allTransactions.forEach(tx => {
        const current = walletTotals.get(tx.wallet_address) || 0;
        walletTotals.set(tx.wallet_address, current + tx.points_earned);
      });

      // Clear existing points table
      await supabase.from(POINTS_TABLE).delete().neq('wallet_address', '');

      // Insert correct records
      const correctRecords = Array.from(walletTotals.entries()).map(([wallet_address, total_points]) => ({
        wallet_address,
        total_points,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from(POINTS_TABLE)
        .insert(correctRecords);

      if (insertError) {
        throw new Error(`Failed to insert correct records: ${insertError.message}`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: `Database cleaned up: ${correctRecords.length} wallets with correct totals`,
          wallets: correctRecords.length
        }),
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Cleanup failed: ${error.message}` }),
      };
    }
  }

  if (action === 'fix-stakes') {
    // Fix historical staking points based on migration data
    try {
      const HISTORICAL_STAKE_FIXES = [
        { tx_hash: "0xbc30249d27d2c65e6d8a50f65cda4b87df2eda4d332d9ed55d5f60c570fd8ffa", correct_points: 3 },
        { tx_hash: "0x9b03ad8d1765cdaca3ca7a139298410f3632b2bdb871a21b20cb22a2075b88ae", correct_points: 5 },
        { tx_hash: "0x10f1359af5259703d6523f263b295935f44b89e2f02de6bd4c6343b42d74bcd7", correct_points: 5 },
        { tx_hash: "0x4e3c6bef048c1602c99236f80fe5054d638e7d4c3e6ef474bf73469450b81b18", correct_points: 1 },
        { tx_hash: "0x625be633b11914339df35b7e79c4f5e7b8b9bf992d95b2db655a06c72767d5da", correct_points: 1 },
        { tx_hash: "0x8d3622808d22cc8d98c0a463ceadfe105a3ff9756b9984f99a4d8903b8943e11", correct_points: 0 },
        { tx_hash: "0xf7fa47c3c5ee4e12a306c095daed3b3462fba4e74ec611f1353f63b9963b17c2", correct_points: 6 },
        { tx_hash: "0xb3e6b0462b9667dd368f6e5fb4d4358d39f95b44c01a04c1781d4d02de77f5ac", correct_points: 2 }
      ];

      let fixed = 0;
      for (const fix of HISTORICAL_STAKE_FIXES) {
        const { error } = await supabase
          .from(TRANSACTIONS_TABLE)
          .update({ points_earned: fix.correct_points })
          .eq('tx_hash', fix.tx_hash)
          .eq('action_type', 'stake');
        
        if (!error) fixed++;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: `Fixed ${fixed} historical staking transactions`,
          fixed_count: fixed
        }),
      };
    } catch (error: any) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `Stakes fix failed: ${error.message}` }),
      };
    }
  }

  // Admin actions that don't require wallet address
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

  // User-specific actions require wallet address
  const walletAddress = getWalletAddress(event);
  
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
    }, {
      onConflict: 'wallet_address'
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