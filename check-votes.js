import { createThirdwebClient, getContract, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';

async function checkVotes() {
  const client = createThirdwebClient({ 
    clientId: process.env.THIRDWEB_CLIENT_ID || '0b1d7a7c085408bf3cfe4ccccd24c08e'
  });

  const votingContract = getContract({
    client,
    chain: base,
    address: '0x5089FE55368E40c8990214Ca99bd2214b34A179D'
  });

  try {
    // Get current season
    const currentSeason = await readContract({
      contract: votingContract,
      method: "function getCurrentSeason() view returns (uint256)",
      params: []
    });
    
    console.log('Current Season:', currentSeason.toString());

    // Check votes for token 19 in current season
    const votesFor19 = await readContract({
      contract: votingContract,
      method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
      params: [currentSeason, BigInt(19)]
    });
    
    console.log('Votes for Token 19:', votesFor19.toString());
    
    // Check votes for token 17 (which shows up)
    const votesFor17 = await readContract({
      contract: votingContract,
      method: "function getEvermarkVotesInSeason(uint256 season, uint256 evermarkId) view returns (uint256)",
      params: [currentSeason, BigInt(17)]
    });
    
    console.log('Votes for Token 17:', votesFor17.toString());

  } catch (error) {
    console.error('Error:', error);
  }
}

checkVotes();