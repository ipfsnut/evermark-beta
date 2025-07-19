// hooks/core/useContracts.ts - Core contract instances

import { useMemo } from 'react';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN, CONTRACTS } from '@/lib/contracts';
import { EMARK_TOKEN_ABI, CARD_CATALOG_ABI } from '@/lib/abis';

export function useContracts() {
  // Memoize contract instances to prevent recreation
  const contracts = useMemo(() => {
    return {
      emarkToken: getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.EMARK_TOKEN,
        abi: EMARK_TOKEN_ABI
      }),
      
      cardCatalog: getContract({
        client,
        chain: CHAIN,
        address: CONTRACTS.CARD_CATALOG,
        abi: CARD_CATALOG_ABI
      })
    };
  }, []); // Empty dependency array since contract addresses don't change

  return contracts;
}