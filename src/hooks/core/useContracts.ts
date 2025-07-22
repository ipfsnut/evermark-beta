import { useMemo } from 'react';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN, CONTRACTS } from '@/lib/contracts';
import { 
  CARD_CATALOG_ABI, 
  EMARK_TOKEN_ABI,
  EVERMARK_NFT_ABI,
  EVERMARK_VOTING_ABI,
  EVERMARK_LEADERBOARD_ABI,
  EVERMARK_REWARDS_ABI,
  FEE_COLLECTOR_ABI
} from '@/lib/abis';

export function useContracts() {
  // Memoize contract instances to prevent recreation
  const contracts = useMemo(() => {
    const contractInstances: Record<string, any> = {};

    // Only create contract instances for configured addresses
    if (CONTRACTS.EMARK_TOKEN) {
      contractInstances.emarkToken = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.EMARK_TOKEN,
        abi: EMARK_TOKEN_ABI
      });
    }

    if (CONTRACTS.CARD_CATALOG) {
      contractInstances.cardCatalog = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.CARD_CATALOG,
        abi: CARD_CATALOG_ABI
      });
    }

    if (CONTRACTS.EVERMARK_NFT) {
      contractInstances.evermarkNFT = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.EVERMARK_NFT,
        abi: EVERMARK_NFT_ABI
      });
    }

    if (CONTRACTS.EVERMARK_VOTING) {
      contractInstances.evermarkVoting = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.EVERMARK_VOTING,
        abi: EVERMARK_VOTING_ABI
      });
    }

    if (CONTRACTS.EVERMARK_LEADERBOARD) {
      contractInstances.evermarkLeaderboard = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.EVERMARK_LEADERBOARD,
        abi: EVERMARK_LEADERBOARD_ABI
      });
    }

    if (CONTRACTS.EVERMARK_REWARDS) {
      contractInstances.evermarkRewards = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.EVERMARK_REWARDS,
        abi: EVERMARK_REWARDS_ABI
      });
    }

    if (CONTRACTS.FEE_COLLECTOR) {
      contractInstances.feeCollector = getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.FEE_COLLECTOR,
        abi: FEE_COLLECTOR_ABI
      });
    }

    return contractInstances;
  }, []); // Empty dependency array since contract addresses are constants

  return contracts;
}