// src/hooks/core/useContracts.ts
// Fixed version - thirdweb v5 can work without ABIs for verified contracts

import { useMemo } from 'react';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import EMARKABI from '@/features/tokens/abis/EMARK.json';
import type { Abi } from 'abitype';

// Contract addresses from environment variables
const getContractAddress = (envVar: string | undefined, contractName: string): `0x${string}` => {
  if (!envVar) {
    console.warn(`[EVERMARK BETA] Missing contract address for ${contractName}. Please check environment variables.`);
    return '0x0000000000000000000000000000000000000000';
  }
  if (envVar === '0x0000000000000000000000000000000000000000') {
    console.warn(`[EVERMARK BETA] ${contractName} address is set to zero address. Contract will not function.`);
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
          address: getContractAddress(import.meta.env.VITE_EMARK_ADDRESS, 'EMARK Token'),
          abi: EMARKABI as Abi
        }),
        
        wemark: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_WEMARK_ADDRESS, 'WEMARK Token')
        }),
        
        evermarkNFT: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_NFT_ADDRESS, 'Evermark NFT')
        }),
        
        evermarkVoting: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_VOTING_ADDRESS, 'Evermark Voting')
        }),
        
        nftStaking: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_NFT_STAKING_ADDRESS, 'NFT Staking')
        }),
        
        evermarkRewards: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS, 'Evermark Rewards')
        }),
        
        feeCollector: getContract({
          client,
          chain: base,
          address: getContractAddress(import.meta.env.VITE_FEE_COLLECTOR_ADDRESS, 'Fee Collector')
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
      emarkToken: import.meta.env.VITE_EMARK_ADDRESS,
      wemark: import.meta.env.VITE_WEMARK_ADDRESS,
      evermarkNFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS,
      evermarkVoting: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS,
      nftStaking: import.meta.env.VITE_NFT_STAKING_ADDRESS,
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

// Individual contracts must be accessed via useContracts() hook within React components

// Type exports for external use
export type ContractsType = ReturnType<typeof useContracts>;
export type ContractName = keyof ContractsType;