import { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

interface WalletBalance {
  balanceUSD: number;
  balanceAR: number;
  sufficientForBasicBackup: boolean;
  lastUpdated: string;
}

/**
 * Check ArDrive wallet balance
 * This is a mock implementation - in production you'd integrate with ArDrive API
 */
async function getArDriveBalance(): Promise<WalletBalance> {
  try {
    // Mock implementation using environment variables
    // In production, this would use ArDrive SDK or API calls
    
    const mockBalanceAR = parseFloat(process.env.ARDRIVE_MOCK_BALANCE_AR || '0.025');
    const mockBalanceUSD = parseFloat(process.env.ARDRIVE_MOCK_BALANCE_USD || '5.00');
    
    // In a real implementation, you might call:
    // const ardriveWallet = new ArDriveWallet(process.env.ARDRIVE_PRIVATE_KEY);
    // const balance = await ardriveWallet.getWalletBalance();
    
    const BASIC_BACKUP_COST = 0.50; // Minimum cost for a basic backup
    
    return {
      balanceUSD: Math.round(mockBalanceUSD * 100) / 100,
      balanceAR: Math.round(mockBalanceAR * 1000) / 1000,
      sufficientForBasicBackup: mockBalanceUSD >= BASIC_BACKUP_COST,
      lastUpdated: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('Error checking ArDrive balance:', error);
    
    // Return conservative values on error
    return {
      balanceUSD: 0,
      balanceAR: 0,
      sufficientForBasicBackup: false,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Get wallet usage statistics
 */
async function getUsageStats(): Promise<{
  totalSpent: number;
  operationsCount: number;
  averageCost: number;
}> {
  try {
    // Mock implementation - in production would query actual usage
    return {
      totalSpent: 12.45,
      operationsCount: 24,
      averageCost: 0.52,
    };
  } catch (error) {
    return {
      totalSpent: 0,
      operationsCount: 0,
      averageCost: 0,
    };
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('💳 Checking ArDrive wallet balance...');
    
    // Get current balance
    const balance = await getArDriveBalance();
    
    // Get usage statistics
    const stats = await getUsageStats();
    
    const response = {
      ...balance,
      usage: stats,
      recommendations: {
        topUpSoon: balance.balanceUSD < 2.00,
        topUpUrgent: balance.balanceUSD < 0.50,
        estimatedOperationsRemaining: Math.floor(balance.balanceUSD / (stats.averageCost || 0.50)),
      },
    };

    console.log('✅ Balance check completed:', {
      balanceUSD: balance.balanceUSD,
      sufficient: balance.sufficientForBasicBackup,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('❌ Balance check failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to check balance' 
      }),
    };
  }
};