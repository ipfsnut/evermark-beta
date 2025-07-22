// Import ABIs from their respective feature directories
import CardCatalogABI from '../../features/staking/abis/CardCatalog.json';
import EvermarkVotingABI from '../../features/voting/abis/EvermarkVoting.json';
import EvermarkLeaderboardABI from '../../features/leaderboard/abis/EvermarkLeaderboard.json';
import FeeCollectorABI from './FeeCollector.json'; // Keep in lib since it's shared
import NFTStakingABI from './NFTStaking.json'; // Keep in lib since it's shared
import EMARKABI from '../../features/tokens/abis/EMARK.json';
import EvermarkNFTABI from '../../features/evermarks/abis/EvermarkNFT.json';
import EvermarkRewardsABI from '../../features/tokens/abis/EvermarkRewards.json';

// Main contract ABIs - properly typed exports
export const CARD_CATALOG_ABI = CardCatalogABI;
export const EMARK_TOKEN_ABI = EMARKABI;
export const EVERMARK_NFT_ABI = EvermarkNFTABI;
export const EVERMARK_VOTING_ABI = EvermarkVotingABI;
export const EVERMARK_LEADERBOARD_ABI = EvermarkLeaderboardABI;
export const EVERMARK_REWARDS_ABI = EvermarkRewardsABI;
export const FEE_COLLECTOR_ABI = FeeCollectorABI;
export const NFT_STAKING_ABI = NFTStakingABI;

// Named exports for backward compatibility
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