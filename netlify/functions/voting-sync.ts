import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, getContractEvents, prepareEvent } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';
import { client } from '../../src/lib/thirdweb';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Contract addresses from environment
const VOTING_CONTRACT_ADDRESS = process.env.VITE_EVERMARK_VOTING_ADDRESS!;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

interface VotingCacheEntry {
  evermark_id: string;
  cycle_number: number;
  total_votes: string;
  voter_count: number;
  last_updated: string;
}

interface UserVoteEntry {
  user_address: string;
  evermark_id: string;
  cycle_number: number;
  vote_amount: string;
  transaction_hash?: string;
  block_number?: string;
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
    // Get voting contract
    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    switch (httpMethod) {
      case 'GET':
        const action = queryStringParameters?.action;
        
        if (action === 'sync-evermark') {
          // Sync specific evermark voting data
          const evermarkId = queryStringParameters?.evermark_id;
          const cycle = queryStringParameters?.cycle ? parseInt(queryStringParameters.cycle) : undefined;
          
          if (!evermarkId) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'evermark_id required' }),
            };
          }

          await syncEvermarkVotingData(votingContract, evermarkId, cycle);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: `Synced voting data for evermark ${evermarkId}` }),
          };
        }
        
        else if (action === 'sync-cycle') {
          // Sync current cycle data
          let cycle: number;
          if (queryStringParameters?.cycle) {
            cycle = parseInt(queryStringParameters.cycle);
          } else {
            const currentCycle = await getCurrentCycle(votingContract);
            if (!currentCycle) {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No active cycle found' }),
              };
            }
            cycle = currentCycle;
          }

          await syncVotingCycleData(votingContract, cycle);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: `Synced cycle ${cycle} data` }),
          };
        }
        
        else if (action === 'sync-recent') {
          // Sync recent voting events (last 1000 blocks)
          const blockRange = queryStringParameters?.blocks ? parseInt(queryStringParameters.blocks) : 1000;
          
          await syncRecentVotingEvents(votingContract, blockRange);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: `Synced recent voting events (${blockRange} blocks)` }),
          };
        }
        
        else if (action === 'stats') {
          // Get cache statistics
          const stats = await getCacheStats();
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(stats),
          };
        }
        
        else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid action',
              available_actions: ['sync-evermark', 'sync-cycle', 'sync-recent', 'stats']
            }),
          };
        }

      case 'POST':
        // Webhook endpoint for real-time vote updates
        const webhookData = JSON.parse(event.body || '{}');
        
        if (webhookData.type === 'vote_cast') {
          const { evermarkId, userAddress, amount, transactionHash, blockNumber, cycle } = webhookData;
          
          // Cache the user vote
          await cacheUserVote(userAddress, evermarkId, cycle, amount, transactionHash, blockNumber);
          
          // Update the evermark voting totals
          await syncEvermarkVotingData(votingContract, evermarkId, cycle);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Vote cached successfully' }),
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
    console.error('Voting sync error:', error);
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
 * Get current voting cycle from contract
 */
async function getCurrentCycle(votingContract: any): Promise<number | null> {
  try {
    const currentCycle = await readContract({
      contract: votingContract,
      method: "function getCurrentCycle() view returns (uint256)",
      params: []
    });
    
    return Number(currentCycle);
  } catch (error) {
    console.error('Failed to get current cycle:', error);
    return null;
  }
}

/**
 * Sync voting data for a specific evermark
 */
async function syncEvermarkVotingData(votingContract: any, evermarkId: string, cycle?: number): Promise<void> {
  try {
    if (!cycle) {
      const currentCycle = await getCurrentCycle(votingContract);
      if (!currentCycle) return;
      cycle = currentCycle;
    }

    // Get vote amount from contract
    const votes = await readContract({
      contract: votingContract,
      method: "function getEvermarkVotesInCycle(uint256 cycle, uint256 evermarkId) view returns (uint256)",
      params: [BigInt(cycle), BigInt(evermarkId)]
    }) as bigint;

    // Get unique voter count from events
    const voterCount = await getEvermarkVoterCount(votingContract, evermarkId, cycle);

    // Update cache
    await updateVotingCache(evermarkId, cycle, votes, voterCount);
    
    console.log(`Synced voting data for evermark ${evermarkId} cycle ${cycle}:`, {
      votes: votes.toString(),
      voterCount
    });
  } catch (error) {
    console.error(`Failed to sync evermark ${evermarkId} voting data:`, error);
  }
}

/**
 * Get unique voter count for an evermark in a cycle
 */
async function getEvermarkVoterCount(votingContract: any, evermarkId: string, cycle: number): Promise<number> {
  try {
    const voteDelegatedEvent = prepareEvent({
      signature: "event VoteDelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
    });

    const events = await getContractEvents({
      contract: votingContract,
      events: [voteDelegatedEvent],
      fromBlock: 0n,
      toBlock: 'latest'
    });

    const uniqueVoters = new Set(
      events
        .filter(event => 
          event.args.evermarkId?.toString() === evermarkId &&
          Number(event.args.cycle) === cycle
        )
        .map(event => event.args.user)
    );

    return uniqueVoters.size;
  } catch (error) {
    console.error('Failed to get voter count:', error);
    return 0;
  }
}

/**
 * Sync voting cycle metadata
 */
async function syncVotingCycleData(votingContract: any, cycle: number): Promise<void> {
  try {
    const cycleInfo = await readContract({
      contract: votingContract,
      method: "function getCycleInfo(uint256 cycle) view returns (uint256 startTime, uint256 endTime, uint256 totalVotes, uint256 totalDelegations, bool finalized, uint256 activeEvermarksCount)",
      params: [BigInt(cycle)]
    });

    if (!cycleInfo) return;

    const [startTime, endTime, totalVotes, totalDelegations, finalized, activeEvermarksCount] = cycleInfo as [bigint, bigint, bigint, bigint, boolean, bigint];

    const isActive = !finalized && Date.now() < Number(endTime) * 1000;

    await updateVotingCycle(
      cycle,
      new Date(Number(startTime) * 1000),
      new Date(Number(endTime) * 1000),
      isActive,
      finalized,
      totalVotes,
      Number(totalDelegations),
      Number(activeEvermarksCount)
    );

    console.log(`Synced cycle ${cycle} data:`, {
      isActive,
      finalized,
      totalVotes: totalVotes.toString(),
      totalVoters: Number(totalDelegations)
    });
  } catch (error) {
    console.error(`Failed to sync cycle ${cycle} data:`, error);
  }
}

/**
 * Sync recent voting events
 */
async function syncRecentVotingEvents(votingContract: any, blockRange: number): Promise<void> {
  try {
    // Get current block number
    const currentBlock = await votingContract.chain.rpc('eth_blockNumber');
    const fromBlock = BigInt(parseInt(currentBlock, 16)) - BigInt(blockRange);

    const voteDelegatedEvent = prepareEvent({
      signature: "event VoteDelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
    });

    const events = await getContractEvents({
      contract: votingContract,
      events: [voteDelegatedEvent],
      fromBlock,
      toBlock: 'latest'
    });

    // Process events and update cache
    for (const event of events) {
      const { user, evermarkId, amount, cycle } = event.args;
      
      if (user && evermarkId && amount && cycle) {
        await cacheUserVote(
          user,
          evermarkId.toString(),
          Number(cycle),
          amount,
          event.transactionHash,
          BigInt(event.blockNumber)
        );
      }
    }

    console.log(`Synced ${events.length} recent voting events`);
  } catch (error) {
    console.error('Failed to sync recent voting events:', error);
  }
}

/**
 * Update voting cache for evermark
 */
async function updateVotingCache(
  evermarkId: string, 
  cycle: number, 
  totalVotes: bigint, 
  voterCount: number
): Promise<void> {
  const { error } = await supabase
    .from('voting_cache')
    .upsert({
      evermark_id: evermarkId,
      cycle_number: cycle,
      total_votes: totalVotes.toString(),
      voter_count: voterCount,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'evermark_id,cycle_number'
    });

  if (error) {
    console.error('Failed to update voting cache:', error);
    throw error;
  }
}

/**
 * Cache user vote
 */
async function cacheUserVote(
  userAddress: string,
  evermarkId: string,
  cycle: number,
  voteAmount: bigint,
  transactionHash?: string,
  blockNumber?: bigint
): Promise<void> {
  const { error } = await supabase
    .from('user_votes_cache')
    .upsert({
      user_address: userAddress.toLowerCase(),
      evermark_id: evermarkId,
      cycle_number: cycle,
      vote_amount: voteAmount.toString(),
      transaction_hash: transactionHash,
      block_number: blockNumber?.toString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_address,evermark_id,cycle_number'
    });

  if (error) {
    console.error('Failed to cache user vote:', error);
    throw error;
  }
}

/**
 * Update voting cycle cache
 */
async function updateVotingCycle(
  cycleNumber: number,
  startTime: Date,
  endTime: Date,
  isActive: boolean,
  finalized: boolean,
  totalVotes?: bigint,
  totalVoters?: number,
  activeEvermarksCount?: number
): Promise<void> {
  const { error } = await supabase
    .from('voting_cycles_cache')
    .upsert({
      cycle_number: cycleNumber,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      total_votes: totalVotes?.toString() || '0',
      total_voters: totalVoters || 0,
      active_evermarks_count: activeEvermarksCount || 0,
      is_active: isActive,
      finalized: finalized,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'cycle_number'
    });

  if (error) {
    console.error('Failed to update voting cycle cache:', error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats(): Promise<any> {
  try {
    const [entriesResult, lastUpdatedResult, cyclesResult] = await Promise.all([
      supabase.from('voting_cache').select('id', { count: 'exact', head: true }),
      supabase.from('voting_cache').select('last_updated').order('last_updated', { ascending: false }).limit(1).single(),
      supabase.from('voting_cycles_cache').select('cycle_number', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    return {
      totalEntries: entriesResult.count || 0,
      lastUpdated: lastUpdatedResult.data?.last_updated || null,
      activeCycles: cyclesResult.count || 0,
      cacheHealth: 'healthy'
    };
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return {
      totalEntries: 0,
      lastUpdated: null,
      activeCycles: 0,
      cacheHealth: 'error'
    };
  }
}