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

export const BASE_CHAIN = defineChain({
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

// Contract addresses from environment
export const CONTRACT_ADDRESSES = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_TOKEN_ADDRESS,
  CARD_CATALOG: import.meta.env.VITE_CARD_CATALOG_ADDRESS,
  EVERMARK_NFT: import.meta.env.VITE_EVERMARK_NFT_ADDRESS,
  EVERMARK_VOTING: import.meta.env.VITE_EVERMARK_VOTING_ADDRESS,
  EVERMARK_LEADERBOARD: import.meta.env.VITE_EVERMARK_LEADERBOARD_ADDRESS,
  EVERMARK_REWARDS: import.meta.env.VITE_EVERMARK_REWARDS_ADDRESS,
  FEE_COLLECTOR: import.meta.env.VITE_FEE_COLLECTOR_ADDRESS,
} as const;

// Contract instances with proper ABI typing
export const CONTRACTS = {
  EMARK_TOKEN: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.EMARK_TOKEN,
    abi: EMARKABI as Abi,
  }),
  
  CARD_CATALOG: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.CARD_CATALOG,
    abi: CardCatalogABI as Abi,
  }),
  
  EVERMARK_NFT: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.EVERMARK_NFT,
    abi: EvermarkNFTABI as Abi,
  }),
  
  EVERMARK_VOTING: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.EVERMARK_VOTING,
    abi: EvermarkVotingABI as Abi,
  }),
  
  EVERMARK_LEADERBOARD: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.EVERMARK_LEADERBOARD,
    abi: EvermarkLeaderboardABI as Abi,
  }),
  
  EVERMARK_REWARDS: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.EVERMARK_REWARDS,
    abi: EvermarkRewardsABI as Abi,
  }),
  
  FEE_COLLECTOR: getContract({
    client,
    chain: BASE_CHAIN,
    address: CONTRACT_ADDRESSES.FEE_COLLECTOR,
    abi: FeeCollectorABI as Abi,
  }),
} as const;

// Validation helpers
export function validateContractAddresses(): boolean {
  return Object.values(CONTRACT_ADDRESSES).every(address => 
    address && 
    address.length === 42 && 
    address.startsWith('0x')
  );
}

export function getContractExplorerUrl(address: string): string {
  return `${BASE_CHAIN.blockExplorers?.[0]?.url}/address/${address}`;
}

// Contract interaction helpers
export function getEvermarkNFT() {
  return CONTRACTS.EVERMARK_NFT;
}

export function getCardCatalog() {
  return CONTRACTS.CARD_CATALOG;
}

export function getEvermarkVoting() {
  return CONTRACTS.EVERMARK_VOTING;
}