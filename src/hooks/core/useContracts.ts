// src/hooks/core/useContracts.ts
// Fixed version - thirdweb v5 can work without ABIs for verified contracts

import { useMemo } from 'react';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';

// Contract addresses from environment variables
const getContractAddress = (envVar: string | undefined): `0x${string}` => {
  if (!envVar) {
    console.warn(`Contract address not found for ${envVar}`);
    return '0x0000000000000000000000000000000000000000';
  }
  return envVar as `0x${string}`;
};

export function useContracts() {
  const contracts = useMemo(() => {
    try {
      return {
        emarkToken: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EMARK_TOKEN_ADDRESS)
          // ABI omitted - thirdweb v5 will auto-resolve for verified contracts
        }),
        
        cardCatalog: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_CARD_CATALOG_ADDRESS)
        }),
        
        evermarkNFT: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_NFT_ADDRESS)
        }),
        
        evermarkVoting: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_VOTING_ADDRESS)
        }),
        
        evermarkLeaderboard: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS)
        }),
        
        evermarkRewards: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS)
        }),
        
        feeCollector: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_FEE_COLLECTOR_ADDRESS)
        })
      };
    } catch (error) {
      console.error('Error initializing contracts:', error);
      throw new Error('Failed to initialize blockchain contracts');
    }
  }, []);

  return contracts;
}

// Helper hook to check contract configuration status
export function useContractsStatus() {
  const contracts = useContracts();
  
  const status = useMemo(() => {
    const addresses = {
      emarkToken: import.meta.env.VITE_EMARK_TOKEN_ADDRESS,
      cardCatalog: import.meta.env.VITE_CARD_CATALOG_ADDRESS,
      evermarkNFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS,
      evermarkVoting: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS,
      evermarkLeaderboard: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS,
      evermarkRewards: import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS,
      feeCollector: import.meta.env.VITE_FEE_COLLECTOR_ADDRESS
    };

    const configured = Object.values(addresses).every(address => 
      address && 
      address.length === 42 && 
      address.startsWith('0x') &&
      address !== '0x0000000000000000000000000000000000000000'
    );

    const missing = Object.entries(addresses)
      .filter(([, address]) => !address || address === '0x0000000000000000000000000000000000000000')
      .map(([name]) => name);

    return {
      configured,
      addresses,
      missing,
      contracts: Object.keys(contracts)
    };
  }, [contracts]);

  return status;
}

// Export individual contracts for direct access if needed
export const getIndividualContract = (contractName: keyof ReturnType<typeof useContracts>) => {
  const contracts = useContracts();
  return contracts[contractName];
};

// Type exports for external use
export type ContractsType = ReturnType<typeof useContracts>;
export type ContractName = keyof ContractsType;