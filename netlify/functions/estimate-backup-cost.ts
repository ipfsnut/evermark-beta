import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Cost estimates per operation (in USD)
const COST_ESTIMATES = {
  BASE_STORAGE: 0.05, // Base metadata storage
  MEDIA_PER_MB: 0.10, // Per MB of media
  THREAD_STORAGE: 0.02, // Thread preservation
  ARWEAVE_BASE_FEE: 0.01, // ArDrive base fee
};

// Wallet balance thresholds
const BALANCE_THRESHOLDS = {
  MINIMUM_BALANCE: 0.50, // Minimum balance to allow operations
  WARNING_THRESHOLD: 2.00, // Warn user when balance is low
};

interface CostEstimateRequest {
  castInput: string;
  includeMedia?: boolean;
  includeThread?: boolean;
  userWallet?: string;
}

interface CostEstimate {
  mediaCostUSD: number;
  storageCostUSD: number;
  totalCostUSD: number;
  ardriveCreditsNeeded: number;
  canAfford: boolean;
  walletBalance?: number;
  breakdown?: {
    baseCost: number;
    mediaCost: number;
    threadCost: number;
    estimatedFileSize: number;
    // Enhanced breakdown for dynamic pricing
    shouldChargeExtra?: boolean;
    accurateBreakdown?: any;
    mediaFiles?: Array<{
      url: string;
      type: string;
      sizeMB: number;
      estimatedCostUSD: number;
    }>;
    ourProfitUSD?: number;
    recommendedFeeUSD?: number;
  };
}

/**
 * Get accurate cost estimate using real file sizes and ArDrive pricing
 */
async function getAccurateArDriveCost(castInput: string): Promise<{
  totalSizeMB: number;
  arDriveCostUSD: number;
  shouldChargeExtra: boolean;
  breakdown: any;
}> {
  try {
    // Simple estimate with 25MB limit - no dynamic pricing needed
    console.log('Estimating costs for cast:', castInput);
    
    // Fallback to original estimation method
    const response = await fetch(`/.netlify/functions/farcaster-cast?hash=${encodeURIComponent(castInput)}`);
    if (!response.ok) return { totalSizeMB: 0, arDriveCostUSD: 0.06, shouldChargeExtra: false, breakdown: {} };

    const result = await response.json();
    if (!result.success || !result.data?.embeds) return { totalSizeMB: 0, arDriveCostUSD: 0.06, shouldChargeExtra: false, breakdown: {} };

    let totalSizeMB = 0;
    for (const embed of result.data.embeds) {
      if (embed.url) {
        const url = embed.url.toLowerCase();
        if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png')) {
          totalSizeMB += 0.5;
        } else if (url.includes('.gif')) {
          totalSizeMB += 2.0;
        } else if (url.includes('.mp4') || url.includes('.webm')) {
          totalSizeMB += 5.0;
        }
      }
    }

    const arDriveCostUSD = Math.max(0.06, totalSizeMB * 0.10); // Conservative estimate
    const shouldChargeExtra = arDriveCostUSD > 0.20;
    
    return {
      totalSizeMB,
      arDriveCostUSD,
      shouldChargeExtra,
      breakdown: { fallback: true }
    };
  } catch (error) {
    console.error('Error estimating ArDrive cost:', error);
    return { 
      totalSizeMB: 0, 
      arDriveCostUSD: 0.06, 
      shouldChargeExtra: false, 
      breakdown: { error: true } 
    };
  }
}

/**
 * Check ArDrive wallet balance
 */
async function checkArDriveBalance(): Promise<number> {
  // This would integrate with ArDrive API to check actual balance
  // For now, return a mock balance
  // In production, you'd use the ArDrive SDK or API to check balance
  
  try {
    // Mock implementation - replace with actual ArDrive balance check
    const mockBalance = parseFloat(process.env.ARDRIVE_MOCK_BALANCE || '5.00');
    return mockBalance;
  } catch (error) {
    console.error('Error checking ArDrive balance:', error);
    return 0;
  }
}

/**
 * Get cost history for similar operations
 */
async function getCostHistory(userWallet?: string): Promise<{
  averageCost: number;
  lastOperationCost: number;
}> {
  if (!userWallet) {
    return { averageCost: 0.25, lastOperationCost: 0 };
  }

  try {
    const { data, error } = await supabase
      .from('backup_costs')
      .select('cost_usd')
      .eq('user_wallet', userWallet.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data?.length) {
      return { averageCost: 0.25, lastOperationCost: 0 };
    }

    const costs = data.map(row => row.cost_usd);
    const averageCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
    const lastOperationCost = costs[0];

    return { averageCost, lastOperationCost };
  } catch (error) {
    console.error('Error getting cost history:', error);
    return { averageCost: 0.25, lastOperationCost: 0 };
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const {
      castInput,
      includeMedia = true,
      includeThread = false,
      userWallet,
    }: CostEstimateRequest = JSON.parse(event.body || '{}');

    if (!castInput) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cast input is required' }),
      };
    }

    console.log('💰 Estimating backup cost for:', castInput);

    // Get accurate ArDrive cost estimation
    const accurateCost = await getAccurateArDriveCost(castInput);
    
    // Calculate base costs
    const baseCost = COST_ESTIMATES.BASE_STORAGE + COST_ESTIMATES.ARWEAVE_BASE_FEE;
    let threadCost = 0;

    // Add thread costs if requested
    if (includeThread) {
      threadCost = COST_ESTIMATES.THREAD_STORAGE;
    }

    // Use accurate costs for media, fallback to estimates if needed
    const mediaCostUSD = includeMedia ? Math.max(
      accurateCost.arDriveCostUSD - baseCost,  // Subtract base from total
      0  // Don't go negative
    ) : 0;
    
    const storageCostUSD = baseCost + threadCost;
    const totalCostUSD = storageCostUSD + mediaCostUSD;

    // Check wallet balance
    const walletBalance = await checkArDriveBalance();
    const canAfford = walletBalance >= totalCostUSD + BALANCE_THRESHOLDS.MINIMUM_BALANCE;

    // Get historical data for better estimates
    const costHistory = await getCostHistory(userWallet);

    // Convert to ArDrive credits (rough conversion)
    const ardriveCreditsNeeded = Math.ceil(totalCostUSD / 0.005); // Approx 1 credit = $0.005

    const estimate: CostEstimate = {
      mediaCostUSD: Math.round(mediaCostUSD * 100) / 100,
      storageCostUSD: Math.round(storageCostUSD * 100) / 100,
      totalCostUSD: Math.round(totalCostUSD * 100) / 100,
      ardriveCreditsNeeded,
      canAfford,
      walletBalance: Math.round(walletBalance * 100) / 100,
      breakdown: {
        baseCost: Math.round(baseCost * 100) / 100,
        mediaCost: Math.round(mediaCostUSD * 100) / 100,
        threadCost: Math.round(threadCost * 100) / 100,
        estimatedFileSize: Math.round(accurateCost.totalSizeMB * 100) / 100,
        // Enhanced breakdown from accurate pricing
        shouldChargeExtra: accurateCost.shouldChargeExtra,
        accurateBreakdown: accurateCost.breakdown,
        mediaFiles: accurateCost.breakdown?.mediaFiles || [],
        ourProfitUSD: accurateCost.breakdown?.ourProfitUSD || (0.30 - totalCostUSD),
        recommendedFeeUSD: accurateCost.breakdown?.recommendedFeeUSD || 0.30,
      },
    };

    console.log('✅ Cost estimate completed:', estimate);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(estimate),
    };

  } catch (error) {
    console.error('❌ Cost estimation failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to estimate cost' 
      }),
    };
  }
};