// Query all smart contracts for actual season data
// This will give us the on-chain truth about seasons

import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import fetch from 'node-fetch';

// Initialize client
const client = createThirdwebClient({
  clientId: process.env.THIRDWEB_CLIENT_ID || process.env.VITE_THIRDWEB_CLIENT_ID
});

// Contract addresses from environment
const VOTING_ADDRESS = process.env.VITE_EVERMARK_VOTING_ADDRESS;
const LEADERBOARD_ADDRESS = process.env.VITE_EVERMARK_LEADERBOARD_ADDRESS;
const REWARDS_ADDRESS = process.env.VITE_EVERMARK_REWARDS_ADDRESS;

async function queryAllContractSeasons() {
  console.log('🔍 Querying all smart contracts for season data...\n');
  
  try {
    // 1. VOTING CONTRACT SEASONS
    console.log('📊 VOTING CONTRACT SEASONS:');
    console.log('Address:', VOTING_ADDRESS);
    
    if (VOTING_ADDRESS) {
      const votingContract = getContract({
        client,
        chain: base,
        address: VOTING_ADDRESS
      });

      try {
        // Get current season
        const currentSeason = await readContract({
          contract: votingContract,
          method: "function getCurrentSeason() view returns (uint256)",
          params: []
        });
        console.log('Current Season:', currentSeason.toString());

        // Get season info for current season
        const seasonInfo = await readContract({
          contract: votingContract,
          method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
          params: [currentSeason]
        });
        
        const [startTime, endTime, active, totalVotes] = seasonInfo;
        console.log('Season Info:');
        console.log('  Start Time:', new Date(Number(startTime) * 1000).toISOString());
        console.log('  End Time:', new Date(Number(endTime) * 1000).toISOString());
        console.log('  Active:', active);
        console.log('  Total Votes:', totalVotes.toString());

        // Check if there are seasons before current
        for (let i = Math.max(1, Number(currentSeason) - 3); i < Number(currentSeason); i++) {
          try {
            const pastSeasonInfo = await readContract({
              contract: votingContract,
              method: "function getSeasonInfo(uint256 season) view returns (uint256 startTime, uint256 endTime, bool active, uint256 totalVotes)",
              params: [BigInt(i)]
            });
            console.log(`Season ${i}:`, {
              active: pastSeasonInfo[2],
              votes: pastSeasonInfo[3].toString()
            });
          } catch (e) {
            console.log(`Season ${i}: Not found or error`);
          }
        }

      } catch (error) {
        console.log('❌ Error querying voting contract:', error.message);
      }
    } else {
      console.log('❌ No voting contract address found');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 2. LEADERBOARD CONTRACT SEASONS
    console.log('🏆 LEADERBOARD CONTRACT SEASONS:');
    console.log('Address:', LEADERBOARD_ADDRESS);
    
    if (LEADERBOARD_ADDRESS) {
      const leaderboardContract = getContract({
        client,
        chain: base,
        address: LEADERBOARD_ADDRESS
      });

      try {
        // Try to get current season (if method exists)
        const currentSeason = await readContract({
          contract: leaderboardContract,
          method: "function getCurrentSeason() view returns (uint256)",
          params: []
        });
        console.log('Current Season:', currentSeason.toString());
      } catch (error) {
        console.log('No getCurrentSeason method or error:', error.message);
      }

      try {
        // Try to get season data (method names may vary)
        const seasonData = await readContract({
          contract: leaderboardContract,
          method: "function currentSeason() view returns (uint256)",
          params: []
        });
        console.log('Current Season (alt method):', seasonData.toString());
      } catch (error) {
        console.log('No currentSeason method or error:', error.message);
      }

    } else {
      console.log('❌ No leaderboard contract address found');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 3. REWARDS CONTRACT SEASONS/PERIODS
    console.log('💰 REWARDS CONTRACT PERIODS:');
    console.log('Address:', REWARDS_ADDRESS);
    
    if (REWARDS_ADDRESS) {
      const rewardsContract = getContract({
        client,
        chain: base,
        address: REWARDS_ADDRESS
      });

      try {
        // Get period status
        const periodStatus = await readContract({
          contract: rewardsContract,
          method: "function getPeriodStatus() view returns (uint256 currentPeriod, uint256 periodEnd, uint256 wethRate, uint256 emarkRate)",
          params: []
        });
        
        const [currentPeriod, periodEnd, wethRate, emarkRate] = periodStatus;
        console.log('Current Period:', currentPeriod.toString());
        console.log('Period End:', new Date(Number(periodEnd) * 1000).toISOString());
        console.log('WETH Rate:', wethRate.toString());
        console.log('EMARK Rate:', emarkRate.toString());

      } catch (error) {
        console.log('❌ Error querying rewards contract:', error.message);
      }

      try {
        // Try alternative methods
        const currentSeason = await readContract({
          contract: rewardsContract,
          method: "function getCurrentSeason() view returns (uint256)",
          params: []
        });
        console.log('Current Season (rewards):', currentSeason.toString());
      } catch (error) {
        console.log('No getCurrentSeason method in rewards:', error.message);
      }

    } else {
      console.log('❌ No rewards contract address found');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // 4. OFF-CHAIN SEASON CALCULATION
    console.log('🕒 OFF-CHAIN SEASON CALCULATION:');
    
    const SEASON_START = new Date('2024-01-01T00:00:00Z');
    const now = new Date();
    const weeksSinceStart = Math.floor(
      (now.getTime() - SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const calculatedSeason = Math.max(1, weeksSinceStart + 1);
    
    console.log('Season Start Date:', SEASON_START.toISOString());
    console.log('Current Date:', now.toISOString());
    console.log('Weeks Since Start:', weeksSinceStart);
    console.log('Calculated Season:', calculatedSeason);

    // Check season oracle endpoint
    try {
      const seasonOracleResponse = await fetch('http://localhost:8888/.netlify/functions/season-oracle');
      const seasonOracleData = await seasonOracleResponse.json();
      
      console.log('\n🔮 SEASON ORACLE RESPONSE:');
      console.log('Success:', seasonOracleData.success);
      if (seasonOracleData.success && seasonOracleData.state) {
        console.log('Current Season:', seasonOracleData.state.current.number);
        console.log('Year:', seasonOracleData.state.current.year);
        console.log('Week:', seasonOracleData.state.current.week);
        console.log('Status:', seasonOracleData.state.current.status);
        console.log('Start:', new Date(seasonOracleData.state.current.startTimestamp).toISOString());
        console.log('End:', new Date(seasonOracleData.state.current.endTimestamp).toISOString());
      }
    } catch (error) {
      console.log('❌ Error querying season oracle:', error.message);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the query
queryAllContractSeasons().catch(console.error);