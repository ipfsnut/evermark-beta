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

interface StakeTransaction {
  id: string;
  wallet_address: string;
  action_type: string;
  points_earned: number;
  tx_hash?: string;
  created_at: string;
}

function calculateCorrectStakePoints(stakeAmountStr: string): number {
  // New calculation: 1 point per 1,000,000 EMARK
  const stakeAmount = parseFloat(stakeAmountStr);
  return Math.floor(stakeAmount / 1000000);
}

function calculateOldStakePoints(stakeAmountStr: string): number {
  // Old calculation: 1 point per 1,000 EMARK
  const stakeAmount = parseFloat(stakeAmountStr);
  return Math.floor(stakeAmount / 1000);
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST to run migration.' }),
    };
  }

  try {
    console.log('🔄 Starting stake points migration...');

    // 1. Get all stake transactions from the database
    const { data: stakeTransactions, error: fetchError } = await supabase
      .from(TRANSACTIONS_TABLE)
      .select('*')
      .eq('action_type', 'stake')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch stake transactions: ${fetchError.message}`);
    }

    if (!stakeTransactions || stakeTransactions.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'No stake transactions found to migrate',
          migrated: 0 
        }),
      };
    }

    console.log(`📊 Found ${stakeTransactions.length} stake transactions to process`);

    const migrationResults: Array<{
      id: string;
      wallet_address: string;
      tx_hash: string;
      old_points: number;
      new_points: number;
      points_difference: number;
    }> = [];

    // 2. Process each stake transaction to recalculate points
    for (const transaction of stakeTransactions as StakeTransaction[]) {
      // We need to get the stake amount from somewhere - let's check if it's stored
      // For now, we'll need to reverse-calculate from the old points
      const oldPoints = transaction.points_earned;
      
      // Reverse calculate the stake amount from old points (old: 1 point per 1000 EMARK)
      const estimatedStakeAmount = oldPoints * 1000;
      
      // Calculate new correct points (new: 1 point per 1,000,000 EMARK)
      const newPoints = calculateCorrectStakePoints(estimatedStakeAmount.toString());
      const pointsDifference = newPoints - oldPoints;

      migrationResults.push({
        id: transaction.id,
        wallet_address: transaction.wallet_address,
        tx_hash: transaction.tx_hash || '',
        old_points: oldPoints,
        new_points: newPoints,
        points_difference: pointsDifference
      });

      console.log(`📝 Transaction ${transaction.id}: ${oldPoints} → ${newPoints} points (${pointsDifference >= 0 ? '+' : ''}${pointsDifference})`);
    }

    // 3. Update transaction records with correct points
    const updatePromises = migrationResults.map(async (result) => {
      const { error } = await supabase
        .from(TRANSACTIONS_TABLE)
        .update({ points_earned: result.new_points })
        .eq('id', result.id);

      if (error) {
        console.error(`❌ Failed to update transaction ${result.id}:`, error);
        throw error;
      }
    });

    await Promise.all(updatePromises);
    console.log('✅ Updated all stake transaction records');

    // 4. Recalculate user totals by wallet address
    const walletAdjustments = new Map<string, number>();
    
    migrationResults.forEach(result => {
      const currentAdjustment = walletAdjustments.get(result.wallet_address) || 0;
      walletAdjustments.set(result.wallet_address, currentAdjustment + result.points_difference);
    });

    console.log(`📊 Adjusting points for ${walletAdjustments.size} unique wallets`);

    // 5. Update user total points
    const totalUpdatePromises = Array.from(walletAdjustments.entries()).map(async ([walletAddress, adjustment]) => {
      // Get current total
      const { data: currentPoints } = await supabase
        .from(POINTS_TABLE)
        .select('total_points')
        .eq('wallet_address', walletAddress)
        .single();

      if (currentPoints) {
        const newTotal = Math.max(0, currentPoints.total_points + adjustment);
        
        const { error } = await supabase
          .from(POINTS_TABLE)
          .update({ 
            total_points: newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('wallet_address', walletAddress);

        if (error) {
          console.error(`❌ Failed to update total for ${walletAddress}:`, error);
          throw error;
        }

        console.log(`✅ ${walletAddress}: ${currentPoints.total_points} → ${newTotal} total points (${adjustment >= 0 ? '+' : ''}${adjustment})`);
      }
    });

    await Promise.all(totalUpdatePromises);

    const summary = {
      transactions_migrated: migrationResults.length,
      wallets_affected: walletAdjustments.size,
      total_points_removed: migrationResults.reduce((sum, r) => sum + Math.abs(Math.min(0, r.points_difference)), 0),
      total_points_added: migrationResults.reduce((sum, r) => sum + Math.max(0, r.points_difference), 0),
      net_change: migrationResults.reduce((sum, r) => sum + r.points_difference, 0),
      details: migrationResults
    };

    console.log('🎉 Migration completed successfully!');
    console.log(`📊 Summary: ${summary.transactions_migrated} transactions, ${summary.wallets_affected} wallets, net change: ${summary.net_change} points`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Stake points migration completed successfully',
        summary
      }),
    };

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Migration failed',
        details: error.message 
      }),
    };
  }
};