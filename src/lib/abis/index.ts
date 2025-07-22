import CardCatalogABI from './CardCatalog.json';
import EvermarkVotingABI from './EvermarkVoting.json';
import EvermarkLeaderboardABI from './EvermarkLeaderboard.json';
import FeeCollectorABI from './FeeCollector.json';
import NFTStakingABI from './NFTStaking.json';
import EMARKABI from './EMARK.json';
import EvermarkNFTABI from '../../features/evermarks/abis/EvermarkNFT.json';
import EvermarkRewardsABI from './EvermarkRewards.json';

// Main contract ABIs
export const CARD_CATALOG_ABI = CardCatalogABI;
export const EMARK_TOKEN_ABI = EMARKABI;
export const EVERMARK_NFT_ABI = EvermarkNFTABI;
export const EVERMARK_VOTING_ABI = EvermarkVotingABI;
export const EVERMARK_LEADERBOARD_ABI = EvermarkLeaderboardABI;
export const EVERMARK_REWARDS_ABI = EvermarkRewardsABI;
export const FEE_COLLECTOR_ABI = FeeCollectorABI;
export const NFT_STAKING_ABI = NFTStakingABI;

// Named exports for compatibility
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