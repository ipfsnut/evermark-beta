import { defineChain, getContract } from 'thirdweb';
import type { Abi } from 'abitype';
import { client } from './thirdweb';

// Import all ABIs with proper typing
import CardCatalogABI from './abis/CardCatalog.json';
import EvermarkNFTABI from './abis/EvermarkNFT.json';
import EvermarkVotingABI from './abis/EvermarkVoting.json';
import EvermarkLeaderboardABI from './abis/EvermarkLeaderboard.json';
import EvermarkRewardsABI from './abis/EvermarkRewards.json';
import EMARKABI from './abis/EMARK.json';
import FeeCollectorABI from './abis/FeeCollector.json';

// Define Base chain with proper v5 syntax
export const CHAIN = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpc: 'https://mainnet.base.org',
  blockExplorers: [
    {
      name: 'BaseScan',
      url: 'https://basescan.org',
    },
  ],
});

// Contract addresses with validation
export const CONTRACTS = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_TOKEN_ADDRESS || '',
  CARD_CATALOG: import.meta.env.VITE_CARD_CATALOG_ADDRESS || '',
  EVERMARK_NFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS || '',
  EVERMARK_VOTING: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS || '',
  EVERMARK_LEADERBOARD: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS || '',
  EVERMARK_REWARDS: import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS || '',
  FEE_COLLECTOR: import.meta.env.VITE_FEE_COLLECTOR_ADDRESS || '',
} as const;

// Properly typed contract getters for Thirdweb v5
export function getEmarkTokenContract() {
  if (!CONTRACTS.EMARK_TOKEN) {
    throw new Error('EMARK_TOKEN address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EMARK_TOKEN,
    abi: EMARKABI as Abi,
  });
}

export function getCardCatalogContract() {
  if (!CONTRACTS.CARD_CATALOG) {
    throw new Error('CARD_CATALOG address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.CARD_CATALOG,
    abi: CardCatalogABI as Abi,
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

export function getEvermarkLeaderboardContract() {
  if (!CONTRACTS.EVERMARK_LEADERBOARD) {
    throw new Error('EVERMARK_LEADERBOARD address not configured');
  }
  return getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EVERMARK_LEADERBOARD,
    abi: EvermarkLeaderboardABI as Abi,
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