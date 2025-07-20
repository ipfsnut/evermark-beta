// lib/abis/index.ts - Export all ABI files

import CardCatalogABI from './CardCatalog.json';
import EvermarkVotingABI from './EvermarkVoting.json';
import EvermarkLeaderboardABI from './EvermarkLeaderboard.json';
import FeeCollectorABI from './FeeCollector.json';
import NFTStakingABI from './NFTStaking.json';
import EMARKABI from './EMARK.json';
import EvermarkNFTABI from './EvermarkNFT.json';
import EvermarkRewardsABI from './EvermarkRewards.json';

// Card Catalog ABI (the main staking/wrapping contract)
export const CARD_CATALOG_ABI = CardCatalogABI;

// Export all ABIs
export {
  CardCatalogABI,
  EvermarkNFTABI,
  EvermarkRewardsABI,
  EvermarkVotingABI,
  EvermarkLeaderboardABI,
  FeeCollectorABI,
  NFTStakingABI,
  EMARKABI
};