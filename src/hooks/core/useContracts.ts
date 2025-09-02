// src/hooks/core/useContracts.ts
// Single source of truth for contract instances - prevents duplicate creation

import { useMemo } from 'react';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';
import type { Abi } from 'abitype';

// Import all ABIs from their feature folders
import EMARKABI from '@/features/tokens/abis/EMARK.json';
import WEMARKABBI from '@/features/staking/abis/WEMARK.abi.json';
import EvermarkNFTABI from '@/features/evermarks/abis/EvermarkNFT.abi.json';
import EvermarkVotingABI from '@/features/voting/abis/EvermarkVoting.abi.json';
import NFTStakingABI from '@/features/staking/abis/NFTStaking.abi.json';
import EvermarkRewardsABI from '@/features/tokens/abis/EvermarkRewards.abi.json';
import FeeCollectorABI from '@/lib/abis/FeeCollector.abi.json';

// Contract addresses with fallbacks for different environments
const CONTRACT_ADDRESSES = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_ADDRESS || '0xf87F3ebbF8CaCF321C2a4027bb66Df639a6f4B07',
  WEMARK: import.meta.env.VITE_WEMARK_ADDRESS || '0xDf756488A3A27352ED1Be38A94f6621A6CE2Ce15',
  EVERMARK_NFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS || '0x504a0BDC3aea29237a6f8E53D0ECDA8e4c9009F2',
  EVERMARK_VOTING: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '0x5089FE55368E40c8990214Ca99bd2214b34A179D',
  NFT_STAKING: import.meta.env.VITE_NFT_STAKING_ADDRESS || '0x95f9aaDb35E74aba92DAAFfe1Ae74Cb467149210',
  EVERMARK_REWARDS: import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS || '0x88E5C57FFC8De966eD789ebd5A8E3B290Ed2B55C',
  FEE_COLLECTOR: import.meta.env.VITE_FEE_COLLECTOR_ADDRESS || '0xaab93405679576ec743fDAA57AA603D949850604'
} as const;

const getContractAddress = (address: string, contractName: string): `0x${string}` => {
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    console.warn(`[EVERMARK BETA] ${contractName} address is invalid or zero address. Contract will not function.`);
  }
  return address as `0x${string}`;
};

export function useContracts() {
  const contracts = useMemo(() => {
    try {
      return {
        emarkToken: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.EMARK_TOKEN, 'EMARK Token'),
          abi: EMARKABI as Abi
        }),
        
        wemark: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.WEMARK, 'WEMARK Token'),
          abi: WEMARKABBI as Abi
        }),
        
        evermarkNFT: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.EVERMARK_NFT, 'Evermark NFT'),
          abi: EvermarkNFTABI as Abi
        }),
        
        evermarkVoting: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.EVERMARK_VOTING, 'Evermark Voting'),
          abi: ((EvermarkVotingABI as any).abi || EvermarkVotingABI) as unknown as Abi
        }),
        
        nftStaking: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.NFT_STAKING, 'NFT Staking'),
          abi: NFTStakingABI as Abi
        }),
        
        evermarkRewards: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.EVERMARK_REWARDS, 'Evermark Rewards'),
          abi: EvermarkRewardsABI as Abi
        }),
        
        feeCollector: getContract({
          client,
          chain: base,
          address: getContractAddress(CONTRACT_ADDRESSES.FEE_COLLECTOR, 'Fee Collector'),
          abi: FeeCollectorABI as Abi
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
      emarkToken: CONTRACT_ADDRESSES.EMARK_TOKEN,
      wemark: CONTRACT_ADDRESSES.WEMARK,
      evermarkNFT: CONTRACT_ADDRESSES.EVERMARK_NFT,
      evermarkVoting: CONTRACT_ADDRESSES.EVERMARK_VOTING,
      nftStaking: CONTRACT_ADDRESSES.NFT_STAKING,
      evermarkRewards: CONTRACT_ADDRESSES.EVERMARK_REWARDS,
      feeCollector: CONTRACT_ADDRESSES.FEE_COLLECTOR
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