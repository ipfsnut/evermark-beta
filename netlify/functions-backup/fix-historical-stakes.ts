import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const TRANSACTIONS_TABLE = 'beta_point_transactions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Based on the migration results we captured earlier
const HISTORICAL_STAKE_FIXES = [
  {
    tx_hash: "0xbc30249d27d2c65e6d8a50f65cda4b87df2eda4d332d9ed55d5f60c570fd8ffa",
    wallet_address: "0x18a85ad341b2d6a2bd67fbb104b4827b922a2a3c",
    correct_points: 3 // 3M EMARK staked
  },
  {
    tx_hash: "0x9b03ad8d1765cdaca3ca7a139298410f3632b2bdb871a21b20cb22a2075b88ae",
    wallet_address: "0x18a85ad341b2d6a2bd67fbb104b4827b922a2a3c", 
    correct_points: 5 // 5M EMARK staked
  },
  {
    tx_hash: "0x10f1359af5259703d6523f263b295935f44b89e2f02de6bd4c6343b42d74bcd7",
    wallet_address: "0xff36a8c20e3975d641b6de59a9d8f4a89a8d47e3",
    correct_points: 5 // 5M EMARK staked
  },
  {
    tx_hash: "0x4e3c6bef048c1602c99236f80fe5054d638e7d4c3e6ef474bf73469450b81b18",
    wallet_address: "0x3427b4716b90c11f9971e43999a48a47cf5b571e",
    correct_points: 1 // 1M EMARK staked
  },
  {
    tx_hash: "0x625be633b11914339df35b7e79c4f5e7b8b9bf992d95b2db655a06c72767d5da",
    wallet_address: "0x18a85ad341b2d6a2bd67fbb104b4827b922a2a3c",
    correct_points: 1 // 1M EMARK staked
  },
  {
    tx_hash: "0x8d3622808d22cc8d98c0a463ceadfe105a3ff9756b9984f99a4d8903b8943e11",
    wallet_address: "0xc2771d8de241fcc2304d4c0e4574b1f41b388527",
    correct_points: 0 // 49K EMARK - below threshold
  },
  {
    tx_hash: "0xf7fa47c3c5ee4e12a306c095daed3b3462fba4e74ec611f1353f63b9963b17c2",
    wallet_address: "0x18a85ad341b2d6a2bd67fbb104b4827b922a2a3c",
    correct_points: 6 // 6M EMARK staked  
  },
  {
    tx_hash: "0xb3e6b0462b9667dd368f6e5fb4d4358d39f95b44c01a04c1781d4d02de77f5ac",
    wallet_address: "0xc6cd1a73fe649febbd2b400717c8cf5c5b5bfd8f",
    correct_points: 2 // 2M EMARK staked
  }
];

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST to fix stakes.' }),
    };
  }

  try {
    console.log('🔄 Starting historical staking points fix...');
    
    const results: Array<{
      tx_hash: string;
      success: boolean;
      error?: string;
      points_updated?: number;
      updated_rows?: number;
    }> = [];
    
    for (const fix of HISTORICAL_STAKE_FIXES) {
      console.log(`⚡ Fixing ${fix.tx_hash} -> ${fix.correct_points} points`);
      
      const { data, error } = await supabase
        .from(TRANSACTIONS_TABLE)
        .update({ points_earned: fix.correct_points })
        .eq('tx_hash', fix.tx_hash)
        .eq('wallet_address', fix.wallet_address)
        .eq('action_type', 'stake')
        .select();
      
      if (error) {
        console.error(`❌ Failed to update ${fix.tx_hash}:`, error);
        results.push({
          tx_hash: fix.tx_hash,
          success: false,
          error: error.message
        });
      } else if (data && data.length > 0) {
        console.log(`✅ Updated ${fix.tx_hash} to ${fix.correct_points} points`);
        results.push({
          tx_hash: fix.tx_hash,
          success: true,
          points_updated: fix.correct_points,
          updated_rows: data.length
        });
      } else {
        console.warn(`⚠️  No transaction found for ${fix.tx_hash}`);
        results.push({
          tx_hash: fix.tx_hash,
          success: false,
          error: 'Transaction not found'
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`🎉 Completed: ${successful} successful, ${failed} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Fixed ${successful} historical staking transactions`,
        summary: {
          total: results.length,
          successful,
          failed
        },
        results
      }),
    };

  } catch (error: any) {
    console.error('❌ Historical stake fix failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Fix failed',
        details: error.message 
      }),
    };
  }
};