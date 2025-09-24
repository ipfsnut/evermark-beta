import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Helper to serialize BigInt values
const safeStringify = (obj: any) => {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
};

interface Distribution {
  recipient: string;
  amount: string;
  category: string;
  evermarkId: number;
}

interface ExecutionProgress {
  season: number;
  totalRecipients: number;
  processed: number;
  successful: number;
  failed: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  currentBatch: number;
  totalBatches: number;
  transactionHashes: string[];
  errorDetails: Array<{ recipient: string; error: string; amount: string }>;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const action = event.queryStringParameters?.action;
    const seasonNumber = event.queryStringParameters?.season ? parseInt(event.queryStringParameters.season) : undefined;

    switch (action) {
      case 'start-distribution':
        if (!seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: safeStringify({ error: 'season_number required' })
          };
        }

        const distributionId = await startDistributionExecution(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify({ 
            success: true, 
            distributionId,
            message: `Distribution execution started for season ${seasonNumber}`
          })
        };

      case 'get-progress':
        if (!seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: safeStringify({ error: 'season_number required' })
          };
        }

        const progress = await getDistributionProgress(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(progress)
        };

      case 'simulate-distribution':
        if (!seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: safeStringify({ error: 'season_number required' })
          };
        }

        const simulation = await simulateDistribution(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(simulation)
        };

      case 'validate-recipients':
        if (!seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: safeStringify({ error: 'season_number required' })
          };
        }

        const validation = await validateDistributionRecipients(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(validation)
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: safeStringify({ 
            error: 'Invalid action',
            available_actions: ['start-distribution', 'get-progress', 'simulate-distribution', 'validate-recipients']
          })
        };
    }

  } catch (error) {
    console.error('Distribution execution error:', error);
    return {
      statusCode: 500,
      headers,
      body: safeStringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

async function startDistributionExecution(seasonNumber: number): Promise<string> {
  try {
    // Get prepared distributions
    const { data: wizardProgress } = await supabase
      .from('wizard_progress')
      .select('step_data')
      .eq('season_number', seasonNumber)
      .single();

    if (!wizardProgress) {
      throw new Error('Wizard progress not found');
    }

    const steps = wizardProgress.step_data as any[];
    const distributionStep = steps.find(s => s.step === 4);
    
    if (!distributionStep?.data?.distributions) {
      throw new Error('Distribution data not found in wizard progress');
    }

    const distributions = distributionStep.data.distributions as Distribution[];
    
    // Initialize execution progress
    const distributionId = `dist_${seasonNumber}_${Date.now()}`;
    const batchSize = 50;
    const totalBatches = Math.ceil(distributions.length / batchSize);

    const progress: ExecutionProgress = {
      season: seasonNumber,
      totalRecipients: distributions.length,
      processed: 0,
      successful: 0,
      failed: 0,
      status: 'in_progress',
      startTime: new Date().toISOString(),
      currentBatch: 1,
      totalBatches,
      transactionHashes: [],
      errorDetails: []
    };

    // Store initial progress
    const { error: progressError } = await supabase
      .from('distribution_progress')
      .insert({
        distribution_id: distributionId,
        season_number: seasonNumber,
        progress_data: progress,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (progressError) {
      throw new Error(`Failed to initialize progress tracking: ${progressError.message}`);
    }

    // Note: Actual blockchain execution would happen here
    // For now, we'll simulate the distribution process
    await simulateBlockchainDistribution(distributionId, seasonNumber, distributions);

    return distributionId;

  } catch (error) {
    console.error('Failed to start distribution:', error);
    throw error;
  }
}

async function simulateBlockchainDistribution(distributionId: string, seasonNumber: number, distributions: Distribution[]): Promise<void> {
  try {
    // Simulate batch processing with delays
    const batchSize = 50;
    const batches: Distribution[][] = [];
    
    for (let i = 0; i < distributions.length; i += batchSize) {
      batches.push(distributions.slice(i, i + batchSize));
    }

    let processed = 0;
    let successful = 0;
    let failed = 0;
    const transactionHashes: string[] = [];
    const errorDetails: any[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Simulate transaction execution
      const txHash = `0x${Math.random().toString(16).slice(2).padStart(64, '0')}`;
      transactionHashes.push(txHash);
      
      // Simulate some failures (5% failure rate)
      const batchSuccessful = batch.filter(() => Math.random() > 0.05).length;
      const batchFailed = batch.length - batchSuccessful;
      
      processed += batch.length;
      successful += batchSuccessful;
      failed += batchFailed;

      // Add error details for failed distributions
      for (let i = 0; i < batchFailed; i++) {
        errorDetails.push({
          recipient: batch[i].recipient,
          error: 'Simulated network error',
          amount: batch[i].amount
        });
      }

      // Update progress
      const updatedProgress: ExecutionProgress = {
        season: seasonNumber,
        totalRecipients: distributions.length,
        processed,
        successful,
        failed,
        status: batchIndex === batches.length - 1 ? 'completed' : 'in_progress',
        startTime: new Date().toISOString(),
        endTime: batchIndex === batches.length - 1 ? new Date().toISOString() : undefined,
        currentBatch: batchIndex + 1,
        totalBatches: batches.length,
        transactionHashes,
        errorDetails
      };

      await supabase
        .from('distribution_progress')
        .update({
          progress_data: updatedProgress,
          updated_at: new Date().toISOString()
        })
        .eq('distribution_id', distributionId);

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Mark season as distributed
    await supabase
      .from('finalized_seasons')
      .update({ 
        rewards_distributed: true,
        distribution_completed_at: new Date().toISOString()
      })
      .eq('season_number', seasonNumber);

    console.log(`✅ Distribution simulation completed for season ${seasonNumber}`);

  } catch (error) {
    console.error('Distribution simulation failed:', error);
    throw error;
  }
}

async function getDistributionProgress(seasonNumber: number): Promise<ExecutionProgress | null> {
  try {
    const { data: progress, error } = await supabase
      .from('distribution_progress')
      .select('progress_data')
      .eq('season_number', seasonNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !progress) {
      return null;
    }

    return progress.progress_data as ExecutionProgress;

  } catch (error) {
    console.error('Failed to get distribution progress:', error);
    return null;
  }
}

async function simulateDistribution(seasonNumber: number): Promise<{
  estimatedGasCost: string;
  batchCount: number;
  totalRecipients: number;
  estimatedDuration: string;
}> {
  try {
    // Get distribution count from compute-rewards
    const computeResponse = await fetch(`${process.env.URL}/.netlify/functions/admin/compute-rewards?action=prepare-distributions&season=${seasonNumber}`);
    
    if (!computeResponse.ok) {
      throw new Error('Failed to get distribution data');
    }

    const distributions = await computeResponse.json();
    const totalRecipients = distributions.length;
    const batchCount = Math.ceil(totalRecipients / 50);
    
    // Estimate costs (rough estimates)
    const gasPerDistribution = 50000; // 50k gas per distribution
    const gasPrice = 2000000000; // 2 gwei in wei
    const ethPrice = 3000; // $3000 per ETH (rough estimate)
    
    const totalGas = totalRecipients * gasPerDistribution;
    const gasCostWei = BigInt(totalGas) * BigInt(gasPrice);
    const estimatedDurationMinutes = Math.ceil(batchCount * 2); // 2 minutes per batch

    return {
      estimatedGasCost: gasCostWei.toString(),
      batchCount,
      totalRecipients,
      estimatedDuration: `${estimatedDurationMinutes} minutes`
    };

  } catch (error) {
    console.error('Distribution simulation failed:', error);
    throw error;
  }
}

async function validateDistributionRecipients(seasonNumber: number): Promise<{
  validRecipients: number;
  invalidRecipients: number;
  duplicateRecipients: number;
  totalDistributionAmount: string;
  validationErrors: string[];
}> {
  try {
    // Get distributions from wizard progress
    const { data: wizardProgress } = await supabase
      .from('wizard_progress')
      .select('step_data')
      .eq('season_number', seasonNumber)
      .single();

    if (!wizardProgress) {
      throw new Error('Wizard progress not found');
    }

    const steps = wizardProgress.step_data as any[];
    const distributionStep = steps.find(s => s.step === 4);
    
    if (!distributionStep?.data?.distributions) {
      throw new Error('Distribution data not found');
    }

    const distributions = distributionStep.data.distributions as Distribution[];
    const validationErrors: string[] = [];
    let validRecipients = 0;
    let invalidRecipients = 0;
    
    // Check for valid addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    const recipientCounts = new Map<string, number>();
    let totalAmount = BigInt(0);

    for (const dist of distributions) {
      if (addressRegex.test(dist.recipient)) {
        validRecipients++;
        recipientCounts.set(dist.recipient, (recipientCounts.get(dist.recipient) || 0) + 1);
        totalAmount += BigInt(dist.amount);
      } else {
        invalidRecipients++;
        validationErrors.push(`Invalid address: ${dist.recipient}`);
      }
    }

    // Check for duplicates
    const duplicateCount = Array.from(recipientCounts.values()).filter(count => count > 1).length;
    
    return {
      validRecipients,
      invalidRecipients,
      duplicateRecipients: duplicateCount,
      totalDistributionAmount: totalAmount.toString(),
      validationErrors
    };

  } catch (error) {
    console.error('Recipient validation failed:', error);
    throw error;
  }
}