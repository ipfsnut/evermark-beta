// src/lib/contracts.ts - Fixed with proper v5 imports and contract getters
import { getContract } from 'thirdweb';
import type { Abi } from 'abitype';
import { client, chain as CHAIN } from './thirdweb';
import EvermarkNFTABI from '../features/evermarks/abis/EvermarkNFT.abi.json';
import WEMARKABBI from '../features/staking/abis/WEMARK.abi.json';
import EvermarkVotingABI from '../features/voting/abis/EvermarkVoting.abi.json';
import NFTStakingABI from '../features/staking/abis/NFTStaking.abi.json';
import EvermarkRewardsABI from '../features/tokens/abis/EvermarkRewards.abi.json';
import FeeCollectorABI from './abis/FeeCollector.abi.json';

// Export the chain from thirdweb.tsx so we use the same Thirdweb RPC everywhere
export { CHAIN };

// Contract addresses with validation
export const CONTRACTS = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_ADDRESS ?? '',
  WEMARK: import.meta.env.VITE_WEMARK_ADDRESS ?? '',
  EVERMARK_NFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS ?? '',
  EVERMARK_VOTING: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS ?? '',
  NFT_STAKING: import.meta.env.VITE_NFT_STAKING_ADDRESS ?? '',
  EVERMARK_REWARDS: import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS ?? '',
  FEE_COLLECTOR: import.meta.env.VITE_FEE_COLLECTOR_ADDRESS ?? '',
} as const;

// Placeholder ABIs - These will be imported from features when needed
const PLACEHOLDER_ABI = [
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{"type": "string"}],
    "stateMutability": "view"
  }
] as const satisfies Abi;

// Properly typed contract getters for Thirdweb v5
export function getEmarkTokenContract() {
  if (!CONTRACTS.EMARK_TOKEN) {
    throw new Error('EMARK_TOKEN address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EMARK_TOKEN,
    abi: PLACEHOLDER_ABI, // Will be replaced with actual ABI from features
  });
}

export function getWEMARKContract() {
  if (!CONTRACTS.WEMARK) {
    throw new Error('WEMARK address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.WEMARK,
    abi: WEMARKABBI as Abi,
  });
}

export function getEvermarkNFTContract() {
  if (!CONTRACTS.EVERMARK_NFT) {
    throw new Error('EVERMARK_NFT address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EVERMARK_NFT,
    abi: EvermarkNFTABI as Abi,
  });
}

export function getEvermarkVotingContract() {
  if (!CONTRACTS.EVERMARK_VOTING) {
    throw new Error('EVERMARK_VOTING address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EVERMARK_VOTING,
    abi: EvermarkVotingABI as Abi,
  });
}

export function getNFTStakingContract() {
  if (!CONTRACTS.NFT_STAKING) {
    throw new Error('NFT_STAKING address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.NFT_STAKING,
    abi: NFTStakingABI as Abi,
  });
}

export function getEvermarkRewardsContract() {
  if (!CONTRACTS.EVERMARK_REWARDS) {
    throw new Error('EVERMARK_REWARDS address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EVERMARK_REWARDS,
    abi: EvermarkRewardsABI as Abi,
  });
}

export function getFeeCollectorContract() {
  if (!CONTRACTS.FEE_COLLECTOR) {
    throw new Error('FEE_COLLECTOR address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.FEE_COLLECTOR,
    abi: FeeCollectorABI as Abi,
  });
}

// Contract validation
export function validateContractAddresses(): { isValid: boolean; missing: string[] } {
  const missing = Object.entries(CONTRACTS)
    .filter(([_, address]) => !address || address.length !== 42 || !address.startsWith('0x'))
    .map(([name, _]) => name);
  
  return {
    isValid: missing.length === 0,
    missing
  };
}

// Explorer URL helper
export function getContractExplorerUrl(address: string): string {
  return `${CHAIN.blockExplorers?.[0]?.url}/address/${address}`;
}