import { Handler } from '@netlify/functions';
import { createThirdwebClient, getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { readContract } from 'thirdweb';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const address = event.queryStringParameters?.address;
  if (!address) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'address required' })
    };
  }

  try {
    const client = createThirdwebClient({ 
      clientId: process.env.THIRDWEB_CLIENT_ID!
    });

    // Contract addresses
    const emarkAddress = '0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07';
    const wEmarkAddress = '0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15';
    const votingAddress = '0x5089FE55368E40c8990214Ca99bd2214b34A179D';

    const emarkContract = getContract({ client, chain: base, address: emarkAddress });
    const wEmarkContract = getContract({ client, chain: base, address: wEmarkAddress });
    const votingContract = getContract({ client, chain: base, address: votingAddress });

    // Step 1: Check EMARK balance
    const emarkBalance = await readContract({
      contract: emarkContract,
      method: 'function balanceOf(address account) view returns (uint256)',
      params: [address]
    });

    // Step 2: Check wEMARK (staked) balance
    const wEmarkBalance = await readContract({
      contract: wEmarkContract,
      method: 'function balanceOf(address account) view returns (uint256)',
      params: [address]
    });

    // Step 3: Check if voting contract can see wEMARK balance
    let votingContractReadsWEmark = '0';
    try {
      // Try different function names that might exist
      votingContractReadsWEmark = await readContract({
        contract: votingContract,
        method: 'function getStakedBalance(address account) view returns (uint256)',
        params: [address]
      });
    } catch (e) {
      try {
        votingContractReadsWEmark = await readContract({
          contract: votingContract,
          method: 'function balanceOf(address account) view returns (uint256)',
          params: [address]
        });
      } catch (e2) {
        // Function doesn't exist
      }
    }

    // Step 4: Check voting power calculation
    const votingPower = await readContract({
      contract: votingContract,
      method: 'function getVotingPower(address voter) view returns (uint256)',
      params: [address]
    });

    // Step 5: Check what the voting contract thinks about wEMARK contract
    let configuredStakingContract = '';
    try {
      configuredStakingContract = await readContract({
        contract: votingContract,
        method: 'function stakingContract() view returns (address)',
        params: []
      });
    } catch (e) {
      try {
        configuredStakingContract = await readContract({
          contract: votingContract,
          method: 'function wEmarkContract() view returns (address)',
          params: []
        });
      } catch (e2) {
        configuredStakingContract = 'function not found';
      }
    }

    // Step 6: Check current season
    let currentSeason = '0';
    try {
      currentSeason = await readContract({
        contract: votingContract,
        method: 'function getCurrentSeason() view returns (uint256)',
        params: []
      });
    } catch (e) {
      try {
        currentSeason = await readContract({
          contract: votingContract,
          method: 'function currentSeason() view returns (uint256)',
          params: []
        });
      } catch (e2) {
        currentSeason = 'function not found';
      }
    }

    // Step 7: Check if voting is active
    let votingActive = false;
    try {
      votingActive = await readContract({
        contract: votingContract,
        method: 'function isVotingActive() view returns (bool)',
        params: []
      });
    } catch (e) {
      votingActive = null;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        address,
        contractAddresses: {
          emark: emarkAddress,
          wEmark: wEmarkAddress,
          voting: votingAddress
        },
        step1_emarkBalance: emarkBalance.toString(),
        step2_wEmarkBalance: wEmarkBalance.toString(),
        step3_votingContractReadsWEmark: votingContractReadsWEmark.toString(),
        step4_votingPower: votingPower.toString(),
        step5_configuredStakingContract: configuredStakingContract.toString(),
        step6_currentSeason: currentSeason.toString(),
        step7_votingActive: votingActive,
        analysis: {
          hasEmark: emarkBalance.toString() !== '0',
          hasStaked: wEmarkBalance.toString() !== '0',
          votingSeesStaking: votingContractReadsWEmark.toString() !== '0',
          hasVotingPower: votingPower.toString() !== '0',
          stakingContractMatch: configuredStakingContract.toLowerCase() === wEmarkAddress.toLowerCase()
        },
        timestamp: new Date().toISOString()
      }, null, 2)
    };

  } catch (error) {
    console.error('Debug error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Debug failed',
        errorDetails: error instanceof Error ? error.toString() : String(error)
      })
    };
  }
};