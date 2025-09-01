import { prepareContractCall, sendTransaction, readContract } from 'thirdweb';
import type { Account } from 'thirdweb/wallets';
import { getNFTStakingContract, getEvermarkNFTContract } from '@/lib/contracts';

export interface NFTStakeInfo {
  tokenId: number;
  staker: string;
  stakedTime: bigint;
  timeUntilUnstake: bigint;
  canUnstake: boolean;
}

export interface NFTStakingStats {
  totalStakedNFTs: number;
  userStakedCount: number;
  userStakedTokens: number[];
  stakingRewards: bigint; // Estimated rewards per hour
}

export class NFTStakingService {
  /**
   * Stake an NFT to earn rewards
   */
  static async stakeNFT(account: Account, tokenId: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const contract = getNFTStakingContract();
      
      // First check if user owns the NFT
      const nftContract = getEvermarkNFTContract();
      const owner = await readContract({
        contract: nftContract,
        method: "function ownerOf(uint256 tokenId) view returns (address)",
        params: [BigInt(tokenId)]
      });
      
      if (owner.toLowerCase() !== account.address.toLowerCase()) {
        return { success: false, error: 'You do not own this NFT' };
      }

      // Check if NFT is already staked
      const isStaked = await readContract({
        contract,
        method: "function isStaked(uint256 tokenId) view returns (bool)",
        params: [BigInt(tokenId)]
      });

      if (isStaked) {
        return { success: false, error: 'NFT is already staked' };
      }

      // Check if NFT is approved for staking
      const approved = await readContract({
        contract: nftContract,
        method: "function getApproved(uint256 tokenId) view returns (address)",
        params: [BigInt(tokenId)]
      });

      // If not approved, need to approve first
      if (approved.toLowerCase() !== contract.address?.toLowerCase()) {
        const approveTransaction = prepareContractCall({
          contract: nftContract,
          method: "function approve(address to, uint256 tokenId)",
          params: [contract.address!, BigInt(tokenId)]
        });

        const approveResult = await sendTransaction({
          transaction: approveTransaction,
          account
        });

        console.log('NFT approved for staking:', approveResult.transactionHash);
      }

      // Stake the NFT
      const transaction = prepareContractCall({
        contract,
        method: "function stakeNFT(uint256 tokenId)",
        params: [BigInt(tokenId)]
      });

      const result = await sendTransaction({
        transaction,
        account
      });

      return {
        success: true,
        txHash: result.transactionHash
      };
    } catch (error: unknown) {
      console.error('Stake NFT error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stake NFT'
      };
    }
  }

  /**
   * Unstake an NFT
   */
  static async unstakeNFT(account: Account, tokenId: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const contract = getNFTStakingContract();
      
      // Check if user can unstake
      const canUnstake = await readContract({
        contract,
        method: "function canUnstake(address staker, uint256 tokenId) view returns (bool)",
        params: [account.address, BigInt(tokenId)]
      });

      if (!canUnstake) {
        return { success: false, error: 'Cannot unstake yet - minimum staking period not met' };
      }

      const transaction = prepareContractCall({
        contract,
        method: "function unstakeNFT(uint256 tokenId)",
        params: [BigInt(tokenId)]
      });

      const result = await sendTransaction({
        transaction,
        account
      });

      return {
        success: true,
        txHash: result.transactionHash
      };
    } catch (error: unknown) {
      console.error('Unstake NFT error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unstake NFT'
      };
    }
  }

  /**
   * Get user's staked NFTs
   */
  static async getUserStakedNFTs(userAddress: string): Promise<number[]> {
    try {
      const contract = getNFTStakingContract();
      
      const stakedTokens = await readContract({
        contract,
        method: "function getUserStakedTokens(address user) view returns (uint256[])",
        params: [userAddress]
      });

      return stakedTokens.map(token => Number(token));
    } catch (error) {
      console.error('Get user staked NFTs error:', error);
      return [];
    }
  }

  /**
   * Get stake info for a specific NFT
   */
  static async getStakeInfo(userAddress: string, tokenId: number): Promise<NFTStakeInfo | null> {
    try {
      const contract = getNFTStakingContract();
      
      const stakeInfo = await readContract({
        contract,
        method: "function getStakeInfo(address staker, uint256 tokenId) view returns (uint256 stakedTime, uint256 timeUntilUnstake)",
        params: [userAddress, BigInt(tokenId)]
      });

      const canUnstake = await readContract({
        contract,
        method: "function canUnstake(address staker, uint256 tokenId) view returns (bool)",
        params: [userAddress, BigInt(tokenId)]
      });

      return {
        tokenId,
        staker: userAddress,
        stakedTime: stakeInfo[0],
        timeUntilUnstake: stakeInfo[1],
        canUnstake
      };
    } catch (error) {
      console.error('Get stake info error:', error);
      return null;
    }
  }

  /**
   * Get total staking statistics
   */
  static async getStakingStats(userAddress?: string): Promise<NFTStakingStats> {
    try {
      const contract = getNFTStakingContract();
      
      // Get total staked NFTs
      const totalStaked = await readContract({
        contract,
        method: "function totalStakedNFTs() view returns (uint256)",
        params: []
      });

      let userStats = {
        userStakedCount: 0,
        userStakedTokens: [] as number[]
      };

      if (userAddress) {
        // Get user's staked count
        const userCount = await readContract({
          contract,
          method: "function getUserStakeCount(address user) view returns (uint256)",
          params: [userAddress]
        });

        // Get user's staked tokens
        const userTokens = await this.getUserStakedNFTs(userAddress);

        userStats = {
          userStakedCount: Number(userCount),
          userStakedTokens: userTokens
        };
      }

      return {
        totalStakedNFTs: Number(totalStaked),
        ...userStats,
        stakingRewards: BigInt(0) // TODO: Calculate based on staking time and rewards rate
      };
    } catch (error) {
      console.error('Get staking stats error:', error);
      return {
        totalStakedNFTs: 0,
        userStakedCount: 0,
        userStakedTokens: [],
        stakingRewards: BigInt(0)
      };
    }
  }

  /**
   * Check if an NFT is staked
   */
  static async isNFTStaked(tokenId: number): Promise<boolean> {
    try {
      const contract = getNFTStakingContract();
      
      const isStaked = await readContract({
        contract,
        method: "function isStaked(uint256 tokenId) view returns (bool)",
        params: [BigInt(tokenId)]
      });

      return isStaked;
    } catch (error) {
      console.error('Check if NFT staked error:', error);
      return false;
    }
  }

  /**
   * Emergency unstake (admin only, in case of emergency)
   */
  static async emergencyUnstake(account: Account, tokenId: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const contract = getNFTStakingContract();
      
      const transaction = prepareContractCall({
        contract,
        method: "function emergencyUnstakeNFT(uint256 tokenId)",
        params: [BigInt(tokenId)]
      });

      const result = await sendTransaction({
        transaction,
        account
      });

      return {
        success: true,
        txHash: result.transactionHash
      };
    } catch (error: unknown) {
      console.error('Emergency unstake error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Emergency unstake failed'
      };
    }
  }

  /**
   * Format staking time for display
   */
  static formatStakingTime(seconds: bigint): string {
    const totalSeconds = Number(seconds);
    
    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (totalSeconds < 86400) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      return `${days}d ${hours}h`;
    }
  }

  /**
   * Calculate estimated rewards based on staking time
   */
  static calculateEstimatedRewards(stakedTime: bigint, rewardRate: number = 0.0001): Promise<number> {
    const hoursStaked = Number(stakedTime) / 3600;
    return Promise.resolve(hoursStaked * rewardRate);
  }
}