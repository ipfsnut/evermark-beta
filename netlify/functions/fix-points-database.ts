import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

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
      body: JSON.stringify({ error: 'Method not allowed. Use POST to fix database.' }),
    };
  }

  try {
    console.log('🔄 Starting points database cleanup...');

    // Step 1: Get the current state for reporting
    const { data: beforeStats } = await supabase
      .from('beta_points')
      .select('wallet_address')
      .order('wallet_address');

    const beforeCount = beforeStats?.length || 0;
    const uniqueWalletsBefore = new Set(beforeStats?.map(s => s.wallet_address) || []).size;

    console.log(`📊 Before: ${beforeCount} total rows, ${uniqueWalletsBefore} unique wallets`);

    // Step 2: Calculate correct totals from transactions and rebuild the points table
    
    // First, get all transactions and group by wallet
    const { data: allTransactions } = await supabase
      .from('beta_point_transactions')
      .select('wallet_address, points_earned');

    if (!allTransactions) {
      throw new Error('Failed to fetch transactions');
    }

    // Group transactions by wallet and calculate totals
    const walletTotals = new Map<string, number>();
    
    allTransactions.forEach(tx => {
      const current = walletTotals.get(tx.wallet_address) || 0;
      walletTotals.set(tx.wallet_address, current + tx.points_earned);
    });

    console.log(`💰 Calculated totals for ${walletTotals.size} wallets`);

    // Step 3: Clear the beta_points table completely
    const { error: deleteError } = await supabase
      .from('beta_points')
      .delete()
      .neq('wallet_address', ''); // Delete all rows

    if (deleteError) {
      throw new Error(`Failed to clear points table: ${deleteError.message}`);
    }

    console.log('🗑️ Cleared all existing points records');

    // Step 4: Insert the correct totals (one row per wallet)
    const correctRecords = Array.from(walletTotals.entries()).map(([wallet_address, total_points]) => ({
      wallet_address,
      total_points,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: insertedRecords, error: insertError } = await supabase
      .from('beta_points')
      .insert(correctRecords)
      .select();

    if (insertError) {
      throw new Error(`Failed to insert correct records: ${insertError.message}`);
    }

    console.log(`✅ Inserted ${correctRecords.length} correct point records`);

    // Step 5: Get final state for reporting
    const { data: afterStats } = await supabase
      .from('beta_points')
      .select('wallet_address, total_points')
      .order('total_points', { ascending: false });

    const afterCount = afterStats?.length || 0;
    const topUsers = (afterStats || []).slice(0, 5);

    const summary = {
      before: {
        total_rows: beforeCount,
        unique_wallets: uniqueWalletsBefore
      },
      after: {
        total_rows: afterCount,
        unique_wallets: afterCount // Should be same as total rows now
      },
      transactions_processed: allTransactions.length,
      wallets_with_points: walletTotals.size,
      top_users: topUsers.map((user, index) => ({
        rank: index + 1,
        wallet_address: user.wallet_address,
        total_points: user.total_points
      }))
    };

    console.log('🎉 Database cleanup completed successfully!');
    console.log(`📊 Final state: ${afterCount} wallets with points`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Points database cleanup completed successfully',
        summary
      }),
    };

  } catch (error: any) {
    console.error('❌ Database cleanup failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Database cleanup failed',
        details: error.message 
      }),
    };
  }
};