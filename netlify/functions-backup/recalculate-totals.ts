import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const POINTS_TABLE = 'beta_points';
const TRANSACTIONS_TABLE = 'beta_point_transactions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST to recalculate.' }),
    };
  }

  try {
    console.log('🔄 Starting points totals recalculation...');

    // 1. Get all unique wallet addresses from transactions
    const { data: wallets, error: walletsError } = await supabase
      .from(TRANSACTIONS_TABLE)
      .select('wallet_address')
      .order('wallet_address');

    if (walletsError) {
      throw new Error(`Failed to fetch wallets: ${walletsError.message}`);
    }

    // Get unique wallets
    const uniqueWallets = [...new Set(wallets?.map(w => w.wallet_address) || [])];
    console.log(`📊 Found ${uniqueWallets.length} unique wallets to recalculate`);

    const recalculationResults: Array<{
      wallet_address: string;
      old_total: number;
      calculated_total: number;
      difference: number;
      transaction_count: number;
    }> = [];

    // 2. For each wallet, sum up their transaction points
    for (const walletAddress of uniqueWallets) {
      // Get all transactions for this wallet
      const { data: transactions, error: txError } = await supabase
        .from(TRANSACTIONS_TABLE)
        .select('points_earned')
        .eq('wallet_address', walletAddress);

      if (txError) {
        console.error(`❌ Failed to fetch transactions for ${walletAddress}:`, txError);
        continue;
      }

      // Calculate total points from transactions
      const calculatedTotal = (transactions || []).reduce((sum, tx) => sum + (tx.points_earned || 0), 0);

      // Get current total from points table
      const { data: currentPoints } = await supabase
        .from(POINTS_TABLE)
        .select('total_points')
        .eq('wallet_address', walletAddress)
        .single();

      const currentTotal = currentPoints?.total_points || 0;

      // Update or insert the correct total
      const { data: updatedPoints, error: updateError } = await supabase
        .from(POINTS_TABLE)
        .upsert({
          wallet_address: walletAddress,
          total_points: calculatedTotal,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (updateError) {
        console.error(`❌ Failed to update total for ${walletAddress}:`, updateError);
        continue;
      }

      recalculationResults.push({
        wallet_address: walletAddress,
        old_total: currentTotal,
        calculated_total: calculatedTotal,
        difference: calculatedTotal - currentTotal,
        transaction_count: transactions?.length || 0
      });

      console.log(`✅ ${walletAddress}: ${currentTotal} → ${calculatedTotal} points (${calculatedTotal - currentTotal >= 0 ? '+' : ''}${calculatedTotal - currentTotal})`);
    }

    const summary = {
      wallets_processed: recalculationResults.length,
      total_corrections: recalculationResults.filter(r => r.difference !== 0).length,
      total_points_added: recalculationResults.reduce((sum, r) => sum + Math.max(0, r.difference), 0),
      total_points_removed: recalculationResults.reduce((sum, r) => sum + Math.abs(Math.min(0, r.difference)), 0),
      net_change: recalculationResults.reduce((sum, r) => sum + r.difference, 0),
      details: recalculationResults
    };

    console.log('🎉 Recalculation completed!');
    console.log(`📊 Summary: ${summary.wallets_processed} wallets, ${summary.total_corrections} corrections, net change: ${summary.net_change} points`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Points totals recalculation completed successfully',
        summary
      }),
    };

  } catch (error: any) {
    console.error('❌ Recalculation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Recalculation failed',
        details: error.message 
      }),
    };
  }
};