import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { readContract, getContractEvents, prepareEvent, createThirdwebClient } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';

// Create client for backend use
const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID || process.env.VITE_THIRDWEB_CLIENT_ID!
});

// Use same Supabase config as evermarks (which works)
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
          const season = queryStringParameters?.cycle ? parseInt(queryStringParameters.cycle) : undefined;
          
          if (!evermarkId) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'evermark_id required' }),
            };
          }

          await syncEvermarkVotingData(votingContract, evermarkId, season);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: `Synced voting data for evermark ${evermarkId}` }),
          };
        }
        
        else if (action === 'sync-cycle') {
          // Sync current season data (cycle is legacy naming)
          let season: number;
          if (queryStringParameters?.cycle) {
            season = parseInt(queryStringParameters.cycle);
          } else {
            const currentSeason = await getCurrentSeason(votingContract);
            if (currentSeason === null) {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No active season found' }),
              };
            }
            season = currentSeason;
          }

          // Sync season metadata
          await syncVotingSeasonData(votingContract, season);
          
          // Sync all evermark votes for this season
          const syncResult = await syncAllEvermarkVotesForSeason(votingContract, season);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              message: `Synced season ${season} data`,
              evermarksSynced: syncResult.syncedCount,
              debugInfo: syncResult.debugInfo
            }),
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
        
        else if (action === 'get-current-cycle') {
          // Get current season from contract (cycle is legacy naming)
          try {
            const currentSeason = await getCurrentSeason(votingContract);
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ 
                currentCycle: currentSeason,  // Keep 'currentCycle' key for compatibility
                currentSeason: currentSeason,
                message: `Current season: ${currentSeason}`
              }),
            };
          } catch (error) {
            console.error('Failed to get current season:', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ 
                error: 'Failed to read current season',
                details: error instanceof Error ? error.message : 'Unknown error'
              }),
            };
          }
        }
        
        else if (action === 'debug-env') {
          // Debug environment variables
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
              hasSupabaseAnonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
              hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
              hasVotingContract: !!process.env.VITE_EVERMARK_VOTING_ADDRESS,
              votingContract: process.env.VITE_EVERMARK_VOTING_ADDRESS
            }),
          };
        }
        
        else if (action === 'test-cache') {
          // Test if we can write to voting_cache table
          try {
            const { data, error } = await supabase
              .from('voting_cache')
              .upsert({
                evermark_id: '999',
                cycle_number: 3,
                total_votes: '1000000000000000000000',
                voter_count: 1,
                last_updated: new Date().toISOString()
              }, {
                onConflict: 'evermark_id,cycle_number'
              });
              
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: !error,
                error: error ? {
                  message: error.message,
                  code: error.code,
                  details: error.details,
                  hint: error.hint
                } : null,
                data
              }),
            };
          } catch (testError) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                success: false,
                error: testError instanceof Error ? testError.message : 'Unknown error'
              }),
            };
          }
        }
        
        else if (action === 'debug-votes') {
          // Debug specific evermark votes
          const evermarkId = queryStringParameters?.evermark_id || '2';
          const season = queryStringParameters?.cycle ? parseInt(queryStringParameters.cycle) : 3;
          
          try {
            const votes = await readContract({
              contract: votingContract,
              method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
              params: [BigInt(season), BigInt(evermarkId)]
            }) as bigint;
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                evermarkId,
                season,
                votes: votes.toString(),
                contractAddress: VOTING_CONTRACT_ADDRESS,
                rawVotes: votes.toString()
              }),
            };
          } catch (error) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                error: 'Failed to read votes',
                details: error instanceof Error ? error.message : 'Unknown error'
              }),
            };
          }
        }
        
        else if (action === 'get-user-votes') {
          // Get user's voting history from cache
          const userAddress = queryStringParameters?.user_address;
          
          if (!userAddress) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'user_address required' }),
            };
          }
          
          try {
            const { data: votes, error } = await supabase
              .from('user_votes_cache')
              .select('*')
              .eq('user_address', userAddress.toLowerCase())
              .order('updated_at', { ascending: false });
              
            if (error) {
              console.error('Failed to fetch user votes from cache:', error);
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                  success: false,
                  error: 'Failed to fetch user votes from cache',
                  details: error.message
                }),
              };
            }
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                votes: votes || [],
                count: votes?.length || 0
              }),
            };
          } catch (error) {
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'Failed to fetch user votes',
                details: error instanceof Error ? error.message : 'Unknown error'
              }),
            };
          }
        }
        
        else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Invalid action',
              available_actions: ['sync-evermark', 'sync-cycle', 'sync-recent', 'stats', 'get-current-cycle']
            }),
          };
        }

      case 'POST':
        // Webhook endpoint for real-time vote updates
        const webhookData = JSON.parse(event.body || '{}');
        
        if (webhookData.type === 'vote_cast') {
          const { evermarkId, userAddress, amount, transactionHash, blockNumber, season } = webhookData;
          
          // Cache the user vote
          await cacheUserVote(userAddress, evermarkId, season, amount, transactionHash, blockNumber);
          
          // Update the evermark voting totals
          await syncEvermarkVotingData(votingContract, evermarkId, season);
          
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
 * Get current voting season from contract
 */
async function getCurrentSeason(votingContract: any): Promise<number | null> {
  try {
    const currentSeason = await readContract({
      contract: votingContract,
      method: "function getCurrentSeason() view returns (uint256)",
      params: []
    });
    
    return Number(currentSeason);
  } catch (error) {
    console.error('Failed to get current season:', error);
    return null;
  }
}

/**
 * Sync voting data for a specific evermark
 */
async function syncEvermarkVotingData(votingContract: any, evermarkId: string, season?: number): Promise<void> {
  try {
    if (!season) {
      const currentSeason = await getCurrentSeason(votingContract);
      if (currentSeason === null) return;
      season = currentSeason;
    }

    // Get vote amount from contract
    const votes = await readContract({
      contract: votingContract,
      method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
      params: [BigInt(season), BigInt(evermarkId)]
    }) as bigint;

    // Get unique voter count from events
    const voterCount = await getEvermarkVoterCount(votingContract, evermarkId, season);

    // Update cache (using season as cycle_number for compatibility)
    await updateVotingCache(evermarkId, season, votes, voterCount);
    
    console.log(`Synced voting data for evermark ${evermarkId} season ${season}:`, {
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
async function getEvermarkVoterCount(votingContract: any, evermarkId: string, season: number): Promise<number> {
  try {
    const voteCastEvent = prepareEvent({
      signature: "event VoteCast(address indexed voter, uint256 indexed season, uint256 indexed evermarkId, uint256 votes)"
    });

    const events = await getContractEvents({
      contract: votingContract,
      events: [voteCastEvent],
      fromBlock: 0n,
      toBlock: 'latest'
    });

    const uniqueVoters = new Set(
      events
        .filter(event => 
          event.args.evermarkId?.toString() === evermarkId &&
          Number(event.args.season) === season
        )
        .map(event => event.args.voter)
    );

    return uniqueVoters.size;
  } catch (error) {
    console.error('Failed to get voter count:', error);
    return 0;
  }
}

/**
 * Sync all evermark votes for a season
 */
async function syncAllEvermarkVotesForSeason(votingContract: any, season: number): Promise<{syncedCount: number; debugInfo: any}> {
  try {
    // Get all evermarks from the database
    const { data: evermarks, error } = await supabase
      .from('beta_evermarks')
      .select('token_id')
      .order('token_id', { ascending: true });
    
    if (error || !evermarks) {
      console.error('Failed to fetch evermarks:', error);
      return { 
        syncedCount: 0, 
        debugInfo: { error: error?.message || 'Failed to fetch evermarks' }
      };
    }
    
    console.log(`Found ${evermarks.length} evermarks to check for votes in season ${season}`);
    console.log('First few evermarks:', evermarks.slice(0, 3).map(e => ({ token_id: e.token_id, hasTokenId: !!e.token_id })));
    
    let syncedCount = 0;
    const debugLogs: string[] = [];
    
    // Check each evermark for votes
    for (const evermark of evermarks) {
      // Skip evermarks with null or undefined token_id
      if (!evermark.token_id && evermark.token_id !== 0) {
        console.warn(`Skipping evermark with null token_id:`, evermark);
        continue;
      }
      
      try {
        const evermarkId = evermark.token_id.toString();
        
        // Get votes from contract
        const votes = await readContract({
          contract: votingContract,
          method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
          params: [BigInt(season), BigInt(evermarkId)]
        }) as bigint;
        
        // Log vote results for debugging (especially for evermarks 2 and 3)
        if (evermarkId === '2' || evermarkId === '3' || votes > BigInt(0)) {
          const logMsg = `🔍 Evermark ${evermarkId} votes in season ${season}: ${votes.toString()}`;
          console.log(logMsg);
          debugLogs.push(logMsg);
        }
        
        if (votes > BigInt(0)) {
          try {
            // Skip voter count for now since it's expensive and might be causing timeouts
            const voterCount = 0;
            
            // Update cache
            debugLogs.push(`Attempting to update cache for evermark ${evermarkId}...`);
            await updateVotingCache(evermarkId, season, votes, voterCount);
            debugLogs.push(`Cache update successful for evermark ${evermarkId}`);
            
            const successMsg = `Synced evermark ${evermarkId}: ${votes.toString()} votes, ${voterCount} voters`;
            console.log(successMsg);
            debugLogs.push(successMsg);
            syncedCount++;
          } catch (syncError) {
            const errorMsg = `Failed to sync evermark ${evermarkId}: ${syncError instanceof Error ? syncError.message : JSON.stringify(syncError)}`;
            console.error(errorMsg);
            debugLogs.push(errorMsg);
          }
        }
      } catch (error) {
        console.error(`Failed to sync evermark ${evermark.token_id}:`, error);
      }
    }
    
    console.log(`Synced ${syncedCount} evermarks with votes in season ${season}`);
    
    const debugInfo = {
      season,
      totalEvermarksChecked: evermarks.length,
      sampleTokenIds: evermarks.slice(0, 5).map(e => e.token_id),
      nullTokenIds: evermarks.filter(e => !e.token_id && e.token_id !== 0).length,
      debugLogs
    };
    
    return { syncedCount, debugInfo };
    
  } catch (error) {
    console.error('Failed to sync all evermark votes:', error);
    return { 
      syncedCount: 0, 
      debugInfo: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Sync voting season metadata
 */
async function syncVotingSeasonData(votingContract: any, season: number): Promise<void> {
  try {
    const seasonInfo = await readContract({
      contract: votingContract,
      method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
      params: [BigInt(season)]
    });

    if (!seasonInfo) return;

    const [startTime, endTime, active, totalVotes] = seasonInfo as [bigint, bigint, boolean, bigint];

    await updateVotingCycle(
      season,
      new Date(Number(startTime) * 1000),
      new Date(Number(endTime) * 1000),
      active,
      !active,  // finalized is opposite of active
      totalVotes,
      0,  // totalDelegations not available in this contract
      0   // activeEvermarksCount not available in this contract
    );

    console.log(`Synced season ${season} data:`, {
      isActive: active,
      totalVotes: totalVotes.toString()
    });
  } catch (error) {
    console.error(`Failed to sync season ${season} data:`, error);
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

    const voteCastEvent = prepareEvent({
      signature: "event VoteCast(address indexed voter, uint256 indexed season, uint256 indexed evermarkId, uint256 votes)"
    });

    const events = await getContractEvents({
      contract: votingContract,
      events: [voteCastEvent],
      fromBlock,
      toBlock: 'latest'
    });

    // Process events and update cache
    for (const event of events) {
      const { voter, evermarkId, votes, season } = event.args;
      
      if (voter && evermarkId && votes && season) {
        await cacheUserVote(
          voter,
          evermarkId.toString(),
          Number(season),
          votes,
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
  season: number, 
  totalVotes: bigint, 
  voterCount: number
): Promise<void> {
  // Try voting_cache first, fallback to leaderboard if it fails
  const { error: cacheError } = await supabase
    .from('voting_cache')
    .upsert({
      evermark_id: evermarkId,
      cycle_number: season,  // DB field is still cycle_number for compatibility
      total_votes: totalVotes.toString(),
      voter_count: voterCount,
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'evermark_id,cycle_number'
    });

  // If voting_cache fails (table doesn't exist), update leaderboard directly
  if (cacheError) {
    console.log(`voting_cache update failed for evermark ${evermarkId}, updating leaderboard directly:`, cacheError);
    
    const { error: leaderboardError } = await supabase
      .from('leaderboard')
      .upsert({
        evermark_id: evermarkId,
        cycle_id: season,
        total_votes: totalVotes.toString(),
        rank: 1, // Will be recalculated by refresh function
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'evermark_id,cycle_id'
      });

    if (leaderboardError) {
      console.error('Failed to update leaderboard:', leaderboardError);
      throw new Error(`Supabase leaderboard upsert failed: ${leaderboardError.message || leaderboardError.code || 'Unknown Supabase error'}`);
    }
    
    console.log(`Successfully updated leaderboard for evermark ${evermarkId}`);
  } else {
    console.log(`Successfully updated voting_cache for evermark ${evermarkId}`);
  }
}

/**
 * Cache user vote
 */
async function cacheUserVote(
  userAddress: string,
  evermarkId: string,
  season: number,
  voteAmount: bigint,
  transactionHash?: string,
  blockNumber?: bigint
): Promise<void> {
  const { error } = await supabase
    .from('user_votes_cache')
    .upsert({
      user_address: userAddress.toLowerCase(),
      evermark_id: evermarkId,
      cycle_number: season,  // DB field is still cycle_number for compatibility
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