// Import ABIs from their respective feature directories
import WemarkABI from '../../features/staking/abis/WEMARK.abi.json';
import EvermarkVotingABI from '../../features/voting/abis/EvermarkVoting.json';
import FeeCollectorABI from './FeeCollector.json'; // Keep in lib since it's shared
import NFTStakingABI from './NFTStaking.json'; // Keep in lib since it's shared
import EMARKABI from '../../features/tokens/abis/EMARK.json';
import EvermarkNFTABI from '../../features/evermarks/abis/EvermarkNFT.json';
import EvermarkRewardsABI from '../../features/tokens/abis/EvermarkRewards.json';

// Main contract ABIs - properly typed exports
export const WEMARK_ABI = WemarkABI;
export const EMARK_TOKEN_ABI = EMARKABI;
export const EVERMARK_NFT_ABI = EvermarkNFTABI;
export const EVERMARK_VOTING_ABI = EvermarkVotingABI;
export const EVERMARK_REWARDS_ABI = EvermarkRewardsABI;
export const FEE_COLLECTOR_ABI = FeeCollectorABI;
export const NFT_STAKING_ABI = NFTStakingABI;

// Named exports for backward compatibility
export {
  WemarkABI,
  EvermarkNFTABI,
  EvermarkRewardsABI,
  EvermarkVotingABI,
  FeeCollectorABI,
  NFTStakingABI,
  EMARKABI
};