import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, getContractEvents, prepareEvent, createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';

// Create client directly in Netlify function context
const client = createThirdwebClient({
  clientId: process.env.VITE_THIRDWEB_CLIENT_ID!
});

// Environment setup
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin operations
);

const VOTING_CONTRACT_ADDRESS = process.env.VITE_EVERMARK_VOTING_ADDRESS!;
const EVERMARKS_API_URL = process.env.URL ? `${process.env.URL}/.netlify/functions/evermarks` : 'http://localhost:8888/.netlify/functions/evermarks';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface Evermark {
  id: string;
  title?: string;
  description?: string;
  creator?: string;
  author?: string;
  createdAt: string;
  sourceUrl?: string;
  image?: string;
  contentType?: string;
  tags?: string[];
  verified?: boolean;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const { httpMethod, queryStringParameters } = event;

  try {
    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    switch (httpMethod) {
      case 'GET':
        const action = queryStringParameters?.action;
        
        if (action === 'detect-finalizations') {
          // Check for newly finalized seasons and store them
          const newFinalizations = await detectAndStoreFinalizations(votingContract);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              newFinalizations,
              message: `Detected ${newFinalizations.length} new finalized seasons`
            }),
          };
        }
        
        else if (action === 'finalize-season') {
          // Manually finalize a specific season
          const seasonNumber = queryStringParameters?.season_number;
          
          if (!seasonNumber) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'season_number required' }),
            };
          }
          
          const season = parseInt(seasonNumber);
          await finalizeSpecificSeason(votingContract, season);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              message: `Manually finalized season ${season}`
            }),
          };
        }
        
        else if (action === 'check-finalized') {
          // Check finalization status
          const seasonNumber = queryStringParameters?.season_number;
          
          if (!seasonNumber) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'season_number required' }),
            };
          }
          
          const season = parseInt(seasonNumber);
          const status = await checkFinalizationStatus(votingContract, season);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(status),
          };
        }
        
        else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid action',
              available_actions: ['detect-finalizations', 'finalize-season', 'check-finalized']
            }),
          };
        }

      case 'POST':
        // Webhook endpoint for finalization events
        const webhookData = JSON.parse(event.body || '{}');
        
        if (webhookData.type === 'cycle_finalized') {
          const { seasonNumber } = webhookData;
          await finalizeSpecificSeason(votingContract, seasonNumber);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: `Season ${seasonNumber} finalized` }),
          };
        }
        
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid webhook data' }),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Season finalization error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

/**
 * Detect newly finalized seasons and store their leaderboards
 */
async function detectAndStoreFinalizations(votingContract: any): Promise<number[]> {
  try {
    // Get current season to know how far back to check
    const currentCycle = await readContract({
      contract: votingContract,
      method: "function getCurrentCycle() view returns (uint256)",
      params: []
    });
    
    const currentSeasonNumber = Number(currentCycle);
    const newFinalizations: number[] = [];
    
    // Check last 5 seasons for finalization
    const seasonsToCheck = Array.from(
      { length: Math.min(5, currentSeasonNumber) }, 
      (_, i) => currentSeasonNumber - i - 1 // Check previous seasons, not current
    ).filter(season => season > 0);
    
    for (const seasonNumber of seasonsToCheck) {
      // Check if already stored
      const { data: existing } = await supabase
        .from('finalized_seasons')
        .select('season_number')
        .eq('season_number', seasonNumber)
        .single();
        
      if (existing) {
        continue; // Already stored
      }
      
      // Check if finalized on blockchain
      const cycleInfo = await readContract({
        contract: votingContract,
        method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
        params: [BigInt(seasonNumber)]
      });
      
      if (!cycleInfo) continue;
      
      const [, , , , finalized] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];
      
      if (finalized) {
        console.log(`🔔 Detected newly finalized season: ${seasonNumber}`);
        await finalizeSpecificSeason(votingContract, seasonNumber);
        newFinalizations.push(seasonNumber);
      }
    }
    
    return newFinalizations;
  } catch (error) {
    console.error('Failed to detect finalizations:', error);
    return [];
  }
}

/**
 * Finalize a specific season
 */
async function finalizeSpecificSeason(votingContract: any, seasonNumber: number): Promise<void> {
  try {
    // Fetch evermarks data
    const evermarksResponse = await fetch(EVERMARKS_API_URL);
    if (!evermarksResponse.ok) {
      throw new Error('Failed to fetch evermarks data');
    }
    
    const evermarksData = await evermarksResponse.json();
    const evermarks: Evermark[] = evermarksData.evermarks || [];
    
    if (evermarks.length === 0) {
      console.warn(`No evermarks data available for season ${seasonNumber} finalization`);
      return;
    }
    
    // Import and use FinalizationService
    // Note: We can't import directly due to ES module issues in Netlify Functions
    // So we'll implement the finalization logic here
    
    // Get season info from blockchain
    const cycleInfo = await readContract({
      contract: votingContract,
      method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
      params: [BigInt(seasonNumber)]
    });
    
    if (!cycleInfo) {
      throw new Error(`Failed to get cycle info for season ${seasonNumber}`);
    }
    
    const [startTime, endTime, totalVotes, totalDelegations, finalized, activeEvermarksCount] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];
    
    if (!finalized) {
      throw new Error(`Season ${seasonNumber} is not finalized on blockchain`);
    }
    
    // Get leaderboard data from blockchain contract
    let contractLeaderboard: Array<{evermarkId: bigint; votes: bigint}> = [];
    
    try {
      const leaderboardData = await readContract({
        contract: votingContract,
        method: "function getLeaderboard(uint256) view returns ((uint256,uint256)[])",
        params: [BigInt(seasonNumber)]
      });
      
      // Convert tuple array to object array
      contractLeaderboard = (leaderboardData as Array<[bigint, bigint]>).map(([evermarkId, votes]) => ({
        evermarkId,
        votes
      }));
    } catch (error) {
      console.warn(`Failed to get contract leaderboard for season ${seasonNumber}:`, error);
      contractLeaderboard = [];
    }
    
    if (!contractLeaderboard || contractLeaderboard.length === 0) {
      console.warn(`No leaderboard data found for season ${seasonNumber}`);
      return;
    }
    
    // Calculate total votes for percentages
    const seasonTotalVotes = contractLeaderboard.reduce((sum, entry) => sum + entry.votes, BigInt(0));
    
    // Calculate snapshot hash first
    const snapshotData = contractLeaderboard
      .map((entry, index) => `${entry.evermarkId.toString()}:${index + 1}:${entry.votes.toString()}`)
      .join('|');
    const snapshotHash = await calculateSimpleHash(snapshotData);
    
    // Prepare finalized entries
    const finalizedEntries = contractLeaderboard.map((entry, index) => ({
      season_number: seasonNumber,
      evermark_id: entry.evermarkId.toString(),
      final_rank: index + 1,
      total_votes: entry.votes.toString(),
      percentage_of_total: seasonTotalVotes > BigInt(0) 
        ? Number((entry.votes * BigInt(10000)) / seasonTotalVotes) / 100
        : 0,
      finalized_at: new Date().toISOString(),
      snapshot_hash: snapshotHash
    }));
    
    // Store season metadata
    const finalizedSeason = {
      season_number: seasonNumber,
      start_time: new Date(Number(startTime) * 1000).toISOString(),
      end_time: new Date(Number(endTime) * 1000).toISOString(),
      total_votes: seasonTotalVotes.toString(),
      total_evermarks_count: finalizedEntries.length,
      top_evermark_id: finalizedEntries[0]?.evermark_id,
      top_evermark_votes: finalizedEntries[0]?.total_votes || '0',
      finalized_at: new Date().toISOString(),
      snapshot_hash: snapshotHash
    };
    
    // Store in database
    const { error: seasonError } = await supabase
      .from('finalized_seasons')
      .insert(finalizedSeason);
      
    if (seasonError) {
      throw new Error(`Failed to store finalized season: ${seasonError.message}`);
    }
    
    // Store leaderboard entries in batches
    const batchSize = 50;
    for (let i = 0; i < finalizedEntries.length; i += batchSize) {
      const batch = finalizedEntries.slice(i, i + batchSize);
      
      const { error: entriesError } = await supabase
        .from('finalized_leaderboards')
        .insert(batch);
        
      if (entriesError) {
        throw new Error(`Failed to store finalized entries: ${entriesError.message}`);
      }
    }
    
    console.log(`✅ Successfully finalized season ${seasonNumber}:`, {
      totalEntries: finalizedEntries.length,
      totalVotes: seasonTotalVotes.toString(),
      topEvermark: finalizedEntries[0]?.evermark_id,
      snapshotHash
    });
    
  } catch (error) {
    console.error(`Failed to finalize season ${seasonNumber}:`, error);
    throw error;
  }
}

/**
 * Check finalization status for a season
 */
async function checkFinalizationStatus(votingContract: any, seasonNumber: number): Promise<{
  seasonNumber: number;
  blockchainFinalized: boolean;
  databaseStored: boolean;
  canFinalize: boolean;
}> {
  try {
    // Check blockchain status
    const cycleInfo = await readContract({
      contract: votingContract,
      method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
      params: [BigInt(seasonNumber)]
    }).catch(() => null);
    
    const blockchainFinalized = cycleInfo ? (cycleInfo as any)[4] : false;
    
    // Check database status
    const { data: stored } = await supabase
      .from('finalized_seasons')
      .select('season_number')
      .eq('season_number', seasonNumber)
      .single();
      
    const databaseStored = !!stored;
    
    return {
      seasonNumber,
      blockchainFinalized,
      databaseStored,
      canFinalize: blockchainFinalized && !databaseStored
    };
  } catch (error) {
    console.error('Failed to check finalization status:', error);
    return {
      seasonNumber,
      blockchainFinalized: false,
      databaseStored: false,
      canFinalize: false
    };
  }
}

/**
 * Simple hash function for Node.js environment
 */
async function calculateSimpleHash(data: string): Promise<string> {
  // Simple hash for server environment
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}