import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';

const client = createThirdwebClient({
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID!
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const VOTING_CONTRACT_ADDRESS = process.env.VITE_EVERMARK_VOTING_ADDRESS!;

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

interface SeasonStatusCheck {
  seasonNumber: number;
  endTime: Date;
  isEnded: boolean;
  totalVotes: bigint;
  totalVoters: number;
  syncStatus: 'complete' | 'pending' | 'error';
  discrepancies: string[];
  canProceed: boolean;
  blockchainFinalized: boolean;
  databaseStored: boolean;
}

interface WizardStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  data?: any;
  errors?: string[];
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    const action = event.queryStringParameters?.action;
    const seasonNumber = event.queryStringParameters?.season ? parseInt(event.queryStringParameters.season) : undefined;

    switch (action) {
      case 'validate-season':
        const validation = await validateSeasonForFinalization(votingContract, seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(validation)
        };

      case 'get-wizard-status':
        const wizardStatus = await getWizardStatus(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(wizardStatus)
        };

      case 'start-wizard':
        if (!seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: safeStringify({ error: 'season_number required' })
          };
        }
        
        const startResult = await startSeasonFinalizationWizard(votingContract, seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(startResult)
        };

      case 'reset-wizard':
        if (!seasonNumber) {
          return {
            statusCode: 400,
            headers,
            body: safeStringify({ error: 'season_number required' })
          };
        }
        
        await resetWizardProgress(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify({ success: true, message: `Wizard reset for season ${seasonNumber}` })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: safeStringify({ 
            error: 'Invalid action',
            available_actions: ['validate-season', 'get-wizard-status', 'start-wizard', 'reset-wizard']
          })
        };
    }

  } catch (error) {
    console.error('Season finalization wizard error:', error);
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

async function validateSeasonForFinalization(votingContract: any, seasonNumber?: number): Promise<SeasonStatusCheck> {
  try {
    // Get current season if not specified
    if (!seasonNumber) {
      const currentSeason = await readContract({
        contract: votingContract,
        method: "function getCurrentSeason() view returns (uint256)",
        params: []
      });
      seasonNumber = Number(currentSeason) - 1; // Previous season for finalization
    }

    // Get season info from contract
    const seasonInfo = await readContract({
      contract: votingContract,
      method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
      params: [BigInt(seasonNumber)]
    });

    if (!seasonInfo) {
      throw new Error(`Season ${seasonNumber} not found`);
    }

    const [startTime, endTime, active, totalVotes] = seasonInfo as [bigint, bigint, boolean, bigint];
    const endDate = new Date(Number(endTime) * 1000);
    const isEnded = Date.now() > endDate.getTime();

    // Check if already stored in database
    const { data: storedSeason } = await supabase
      .from('finalized_seasons')
      .select('season_number')
      .eq('season_number', seasonNumber)
      .single();

    const databaseStored = !!storedSeason;

    // Check sync status by comparing vote counts
    const discrepancies: string[] = [];
    let syncStatus: 'complete' | 'pending' | 'error' = 'complete';
    
    try {
      // Get database vote counts for this season
      const { data: voteCache } = await supabase
        .from('voting_cache')
        .select('total_votes')
        .eq('cycle_number', seasonNumber);
        
      const dbTotalVotes = voteCache?.reduce((sum, cache) => 
        sum + BigInt(cache.total_votes), BigInt(0)
      ) || BigInt(0);

      if (dbTotalVotes !== totalVotes) {
        discrepancies.push(`Vote count mismatch: Contract ${totalVotes.toString()}, DB ${dbTotalVotes.toString()}`);
        syncStatus = 'pending';
      }
    } catch (syncError) {
      discrepancies.push('Failed to verify sync status');
      syncStatus = 'error';
    }

    const canProceed = isEnded && !active && !databaseStored && syncStatus === 'complete';

    return {
      seasonNumber,
      endTime: endDate,
      isEnded,
      totalVotes,
      totalVoters: 0, // Will be calculated during sync
      syncStatus,
      discrepancies,
      canProceed,
      blockchainFinalized: !active,
      databaseStored
    };

  } catch (error) {
    console.error('Season validation failed:', error);
    throw new Error(`Failed to validate season: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getWizardStatus(seasonNumber?: number): Promise<{ steps: WizardStep[]; currentStep: number; canStart: boolean }> {
  try {
    if (!seasonNumber) {
      // Get the most recent finalized season
      const { data: recentSeason } = await supabase
        .from('wizard_progress')
        .select('season_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!recentSeason) {
        return {
          steps: [],
          currentStep: 0,
          canStart: false
        };
      }
      
      seasonNumber = recentSeason.season_number;
    }

    // Check if wizard progress exists
    const { data: progress } = await supabase
      .from('wizard_progress')
      .select('step_data')
      .eq('season_number', seasonNumber)
      .single();

    if (!progress) {
      return {
        steps: initializeWizardSteps(),
        currentStep: 1,
        canStart: true
      };
    }

    const stepData = progress.step_data as WizardStep[];
    const currentStep = stepData.find(s => s.status === 'in_progress')?.step || 1;

    return {
      steps: stepData,
      currentStep,
      canStart: true
    };

  } catch (error) {
    console.error('Failed to get wizard status:', error);
    return {
      steps: initializeWizardSteps(),
      currentStep: 1,
      canStart: false
    };
  }
}

async function startSeasonFinalizationWizard(votingContract: any, seasonNumber: number): Promise<{ success: boolean; wizardId: string; steps: WizardStep[] }> {
  try {
    // Validate season can be finalized
    const validation = await validateSeasonForFinalization(votingContract, seasonNumber);
    
    if (!validation.canProceed) {
      throw new Error(`Season ${seasonNumber} cannot be finalized: ${validation.discrepancies.join(', ')}`);
    }

    // Initialize wizard steps
    const steps = initializeWizardSteps();
    steps[0].status = 'completed'; // Validation step is done
    steps[0].data = validation;
    steps[1].status = 'in_progress'; // Move to data sync

    // Store wizard progress
    const wizardId = `wizard_${seasonNumber}_${Date.now()}`;
    const { error } = await supabase
      .from('wizard_progress')
      .upsert({
        wizard_id: wizardId,
        season_number: seasonNumber,
        current_step: 2,
        step_data: steps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'season_number'
      });

    if (error) {
      throw new Error(`Failed to initialize wizard: ${error.message}`);
    }

    return {
      success: true,
      wizardId,
      steps
    };

  } catch (error) {
    console.error('Failed to start wizard:', error);
    throw error;
  }
}

async function resetWizardProgress(seasonNumber: number): Promise<void> {
  const { error } = await supabase
    .from('wizard_progress')
    .delete()
    .eq('season_number', seasonNumber);

  if (error) {
    throw new Error(`Failed to reset wizard: ${error.message}`);
  }
}

function initializeWizardSteps(): WizardStep[] {
  return [
    {
      step: 1,
      name: 'Season Status & Validation',
      status: 'pending'
    },
    {
      step: 2,
      name: 'Data Sync & Final Ranking',
      status: 'pending'
    },
    {
      step: 3,
      name: 'Winner Selection & Reward Calculation',
      status: 'pending'
    },
    {
      step: 4,
      name: 'Review & Approval',
      status: 'pending'
    },
    {
      step: 5,
      name: 'Execution & Monitoring',
      status: 'pending'
    }
  ];
}