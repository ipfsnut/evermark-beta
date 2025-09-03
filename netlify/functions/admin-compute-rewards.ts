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

interface RewardCalculation {
  totalPool: bigint;
  creatorRewards: {
    first: { evermarkId: string; creator: string; amount: bigint; title: string };
    second: { evermarkId: string; creator: string; amount: bigint; title: string };
    third: { evermarkId: string; creator: string; amount: bigint; title: string };
  };
  supporterRewards: {
    address: string;
    amount: bigint;
    evermarkId: string;
    voteContribution: bigint;
  }[];
  totalDistribution: bigint;
  remainingPool: bigint;
  distributionBreakdown: {
    creatorPool: bigint;
    supporterPool: bigint;
    firstPlaceTotal: bigint;
    secondPlaceTotal: bigint;
    thirdPlaceTotal: bigint;
  };
}

interface Distribution {
  recipient: string;
  amount: bigint;
  category: string;
  evermarkId: number;
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const action = event.queryStringParameters?.action;
    const seasonNumber = event.queryStringParameters?.season ? parseInt(event.queryStringParameters.season) : undefined;
    const poolSize = event.queryStringParameters?.pool ? BigInt(event.queryStringParameters.pool) : BigInt("2100000000000000000000"); // 2100 EMARK default

    if (!seasonNumber) {
      return {
        statusCode: 400,
        headers,
        body: safeStringify({ error: 'season_number required' })
      };
    }

    const votingContract = getContract({
      client,
      chain: base,
      address: VOTING_CONTRACT_ADDRESS
    });

    switch (action) {
      case 'calculate-rewards':
        const rewards = await calculateSeasonRewards(votingContract, seasonNumber, poolSize);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(rewards)
        };

      case 'get-top-winners':
        const winners = await getTopThreeWinners(seasonNumber);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(winners)
        };

      case 'get-supporter-distributions':
        const supporters = await getSupporterDistributions(seasonNumber, poolSize);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(supporters)
        };

      case 'prepare-distributions':
        const distributions = await prepareDistributionArray(votingContract, seasonNumber, poolSize);
        return {
          statusCode: 200,
          headers,
          body: safeStringify(distributions)
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: safeStringify({ 
            error: 'Invalid action',
            available_actions: ['calculate-rewards', 'get-top-winners', 'get-supporter-distributions', 'prepare-distributions']
          })
        };
    }

  } catch (error) {
    console.error('Reward computation error:', error);
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

async function calculateSeasonRewards(votingContract: any, seasonNumber: number, totalPool: bigint): Promise<RewardCalculation> {
  try {
    // Get top 3 winners using the same function as the endpoint
    const leaderboard = await getTopThreeWinners(seasonNumber);
    
    if (!leaderboard || leaderboard.length === 0) {
      throw new Error('No winner data found for season');
    }

    // Calculate pools (60% creators, 40% supporters)
    const creatorPool = (totalPool * BigInt(60)) / BigInt(100);
    const supporterPool = (totalPool * BigInt(40)) / BigInt(100);

    // Progressive scaling for creator rewards (50%, 30%, 20%)
    const firstPlace = leaderboard[0]; // First in array
    const secondPlace = leaderboard[1]; // Second in array 
    const thirdPlace = leaderboard[2]; // Third in array

    const creatorRewards = {
      first: firstPlace ? {
        evermarkId: firstPlace.evermark_id,
        creator: (firstPlace.beta_evermarks as any).creator_address,
        amount: (creatorPool * BigInt(50)) / BigInt(100),
        title: (firstPlace.beta_evermarks as any).title || 'Untitled'
      } : null,
      second: secondPlace ? {
        evermarkId: secondPlace.evermark_id,
        creator: (secondPlace.beta_evermarks as any).creator_address,
        amount: (creatorPool * BigInt(30)) / BigInt(100),
        title: (secondPlace.beta_evermarks as any).title || 'Untitled'
      } : null,
      third: thirdPlace ? {
        evermarkId: thirdPlace.evermark_id,
        creator: (thirdPlace.beta_evermarks as any).creator_address,
        amount: (creatorPool * BigInt(20)) / BigInt(100),
        title: (thirdPlace.beta_evermarks as any).title || 'Untitled'
      } : null
    };

    // Calculate supporter rewards for each winning evermark
    const supporterRewards: any[] = [];
    
    for (let i = 0; i < leaderboard.length; i++) {
      const winner = leaderboard[i];
      const rank = i + 1; // Get rank from array position
      const evermarkSupporterPool = rank === 1 
        ? (supporterPool * BigInt(50)) / BigInt(100)
        : rank === 2
        ? (supporterPool * BigInt(30)) / BigInt(100)
        : (supporterPool * BigInt(20)) / BigInt(100);

      // Get supporters for this evermark
      const { data: supporters } = await supabase
        .from('votes')
        .select('user_address, amount')
        .eq('evermark_id', winner.evermark_id)
        .eq('season', seasonNumber);

      if (supporters && supporters.length > 0) {
        const totalEvermarkVotes = BigInt(winner.total_votes);
        
        for (const supporter of supporters) {
          const userVotes = BigInt(supporter.amount);
          const supporterReward = (userVotes * evermarkSupporterPool) / totalEvermarkVotes;
          
          if (supporterReward > BigInt(0)) {
            supporterRewards.push({
              address: supporter.user_address,
              amount: supporterReward,
              evermarkId: winner.evermark_id,
              voteContribution: userVotes
            });
          }
        }
      }
    }

    // Calculate totals
    const totalCreatorDistribution = Object.values(creatorRewards)
      .filter(reward => reward !== null)
      .reduce((sum, reward) => sum + reward!.amount, BigInt(0));
      
    const totalSupporterDistribution = supporterRewards
      .reduce((sum, reward) => sum + reward.amount, BigInt(0));
      
    const totalDistribution = totalCreatorDistribution + totalSupporterDistribution;

    return {
      totalPool,
      creatorRewards: creatorRewards as any,
      supporterRewards,
      totalDistribution,
      remainingPool: totalPool - totalDistribution,
      distributionBreakdown: {
        creatorPool,
        supporterPool,
        firstPlaceTotal: creatorRewards.first ? creatorRewards.first.amount + (supporterPool * BigInt(50)) / BigInt(100) : BigInt(0),
        secondPlaceTotal: creatorRewards.second ? creatorRewards.second.amount + (supporterPool * BigInt(30)) / BigInt(100) : BigInt(0),
        thirdPlaceTotal: creatorRewards.third ? creatorRewards.third.amount + (supporterPool * BigInt(20)) / BigInt(100) : BigInt(0)
      }
    };

  } catch (error) {
    console.error('Reward calculation failed:', error);
    throw error;
  }
}

async function getTopThreeWinners(seasonNumber: number): Promise<any[]> {
  // For testing: use current evermarks data since finalized_leaderboards may be empty
  const { data: evermarks, error } = await supabase
    .from('beta_evermarks')
    .select('token_id, title, description, owner, supabase_image_url')
    .limit(3);
  
  if (error || !evermarks) {
    throw new Error(`Failed to get winners: ${error?.message || 'No data'}`);
  }
  
  // Mock top 3 winners with simulated vote counts for testing
  return evermarks.map((evermark: any, index: number) => ({
    evermark_id: evermark.token_id.toString(),
    total_votes: (1000 - (index * 200)).toString(), // 1000, 800, 600 votes
    beta_evermarks: {
      title: evermark.title || 'Untitled',
      description: evermark.description,
      creator_address: evermark.owner, // Use 'owner' field instead of 'creator_address'
      supabase_image_url: evermark.supabase_image_url
    }
  }));
}

async function getSupporterDistributions(seasonNumber: number, totalPool: bigint): Promise<any[]> {
  const calculation = await calculateSeasonRewards({}, seasonNumber, totalPool);
  return calculation.supporterRewards;
}

async function prepareDistributionArray(votingContract: any, seasonNumber: number, totalPool: bigint): Promise<Distribution[]> {
  const calculation = await calculateSeasonRewards(votingContract, seasonNumber, totalPool);
  const distributions: Distribution[] = [];

  // Add creator distributions
  if (calculation.creatorRewards.first) {
    distributions.push({
      recipient: calculation.creatorRewards.first.creator,
      amount: calculation.creatorRewards.first.amount,
      category: "creator_winner",
      evermarkId: parseInt(calculation.creatorRewards.first.evermarkId)
    });
  }

  if (calculation.creatorRewards.second) {
    distributions.push({
      recipient: calculation.creatorRewards.second.creator,
      amount: calculation.creatorRewards.second.amount,
      category: "creator_winner",
      evermarkId: parseInt(calculation.creatorRewards.second.evermarkId)
    });
  }

  if (calculation.creatorRewards.third) {
    distributions.push({
      recipient: calculation.creatorRewards.third.creator,
      amount: calculation.creatorRewards.third.amount,
      category: "creator_winner",
      evermarkId: parseInt(calculation.creatorRewards.third.evermarkId)
    });
  }

  // Add supporter distributions
  for (const supporter of calculation.supporterRewards) {
    distributions.push({
      recipient: supporter.address,
      amount: supporter.amount,
      category: "supporter",
      evermarkId: parseInt(supporter.evermarkId)
    });
  }

  return distributions;
}