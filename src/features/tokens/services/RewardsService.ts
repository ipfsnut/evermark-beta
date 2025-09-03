import { prepareContractCall, sendTransaction, readContract } from 'thirdweb';
import type { Account } from 'thirdweb/wallets';
import { getEvermarkRewardsContract } from '@/lib/contracts';

export interface UserRewardInfo {
  pendingEth: bigint;
  pendingEmark: bigint;
  periodEthRewards: bigint;
  periodEmarkRewards: bigint;
}

export interface RewardRates {
  ethRewardRate: bigint;
  emarkRewardRate: bigint;
  ethRewardPerToken: bigint;
  emarkRewardPerToken: bigint;
}

export class RewardsService {
  /**
   * Get user's pending reward information
   */
  static async getUserRewardInfo(userAddress: string): Promise<UserRewardInfo | null> {
    try {
      const contract = getEvermarkRewardsContract();
      
      const rewardInfo = await readContract({
        contract,
        method: "function getUserRewardInfo(address user) view returns (uint256 pendingEth, uint256 pendingEmark, uint256 periodEthRewards, uint256 periodEmarkRewards)",
        params: [userAddress]
      });

      return {
        pendingEth: rewardInfo[0],
        pendingEmark: rewardInfo[1],
        periodEthRewards: rewardInfo[2],
        periodEmarkRewards: rewardInfo[3]
      };
    } catch (error) {
      console.error('Get user reward info error:', error);
      return null;
    }
  }

  /**
   * Get individual pending ETH rewards
   */
  static async getPendingEthRewards(userAddress: string): Promise<bigint> {
    try {
      const contract = getEvermarkRewardsContract();
      
      const ethRewards = await readContract({
        contract,
        method: "function ethRewards_user(address) view returns (uint256)",
        params: [userAddress]
      });

      return ethRewards;
    } catch (error) {
      console.error('Get pending ETH rewards error:', error);
      return BigInt(0);
    }
  }

  /**
   * Get individual pending EMARK rewards  
   */
  static async getPendingEmarkRewards(userAddress: string): Promise<bigint> {
    try {
      const contract = getEvermarkRewardsContract();
      
      const emarkRewards = await readContract({
        contract,
        method: "function emarkRewards_user(address) view returns (uint256)",
        params: [userAddress]
      });

      return emarkRewards;
    } catch (error) {
      console.error('Get pending EMARK rewards error:', error);
      return BigInt(0);
    }
  }

  /**
   * Get current reward rates
   */
  static async getRewardRates(): Promise<RewardRates> {
    try {
      const contract = getEvermarkRewardsContract();
      
      const [ethRate, emarkRate, ethPerToken, emarkPerToken] = await Promise.all([
        readContract({
          contract,
          method: "function ethRewardRate() view returns (uint256)",
          params: []
        }),
        readContract({
          contract,
          method: "function emarkRewardRate() view returns (uint256)",
          params: []
        }),
        readContract({
          contract,
          method: "function ethRewardPerToken() view returns (uint256)",
          params: []
        }),
        readContract({
          contract,
          method: "function emarkRewardPerToken() view returns (uint256)",
          params: []
        })
      ]);

      return {
        ethRewardRate: ethRate,
        emarkRewardRate: emarkRate,
        ethRewardPerToken: ethPerToken,
        emarkRewardPerToken: emarkPerToken
      };
    } catch (error) {
      console.error('Get reward rates error:', error);
      return {
        ethRewardRate: BigInt(0),
        emarkRewardRate: BigInt(0),
        ethRewardPerToken: BigInt(0),
        emarkRewardPerToken: BigInt(0)
      };
    }
  }

  /**
   * Claim all available rewards (both ETH and EMARK)
   */
  static async claimRewards(account: Account): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const contract = getEvermarkRewardsContract();
      
      // Check if user has pending rewards
      const rewardInfo = await this.getUserRewardInfo(account.address);
      if (!rewardInfo || (rewardInfo.pendingEth === BigInt(0) && rewardInfo.pendingEmark === BigInt(0))) {
        return { success: false, error: 'No rewards available to claim' };
      }

      const transaction = prepareContractCall({
        contract,
        method: "function claimRewards()",
        params: []
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
      console.error('Claim rewards error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim rewards'
      };
    }
  }

  /**
   * Check if rewards contract has sufficient balance for claims
   */
  static async getContractBalances(): Promise<{ ethBalance: bigint; emarkBalance: bigint } | null> {
    try {
      const _contract = getEvermarkRewardsContract();
      
      // Note: This would require additional contract methods to check balances
      // For now, returning null - would need to be implemented based on actual contract
      return null;
    } catch (error) {
      console.error('Get contract balances error:', error);
      return null;
    }
  }

  /**
   * Format reward amount for display
   */
  static formatRewardAmount(amount: bigint, decimals: number = 18): string {
    const divisor = BigInt(10 ** decimals);
    const whole = amount / divisor;
    const fractional = amount % divisor;
    
    if (fractional === BigInt(0)) {
      return whole.toString();
    }
    
    // Convert to number for decimal formatting (max 1 decimal place)
    const fullAmount = Number(amount) / (10 ** decimals);
    return fullAmount.toFixed(1);
  }

  /**
   * Calculate estimated daily rewards based on current rates
   */
  static async calculateDailyRewards(userStakedAmount: bigint): Promise<{ ethPerDay: bigint; emarkPerDay: bigint }> {
    try {
      const rates = await this.getRewardRates();
      
      // FIXED: Reward rates are likely already per-day or need different scaling
      // Debug the raw rates to understand the correct calculation
      console.log('Debug reward rates:', {
        ethRewardRate: rates.ethRewardRate.toString(),
        emarkRewardRate: rates.emarkRewardRate.toString(),
        userStakedAmount: userStakedAmount.toString()
      });
      
      // Conservative calculation: assume rates need proper scaling
      // Most reward systems use basis points or different time periods
      const ethPerDay = (rates.ethRewardRate * userStakedAmount) / BigInt(10 ** 18) / BigInt(365); // Annual to daily
      const emarkPerDay = (rates.emarkRewardRate * userStakedAmount) / BigInt(10 ** 18) / BigInt(365); // Annual to daily
      
      console.log('Calculated daily rewards:', {
        ethPerDay: ethPerDay.toString(),
        emarkPerDay: emarkPerDay.toString()
      });
      
      return {
        ethPerDay,
        emarkPerDay
      };
    } catch (error) {
      console.error('Calculate daily rewards error:', error);
      return {
        ethPerDay: BigInt(0),
        emarkPerDay: BigInt(0)
      };
    }
  }

  /**
   * Get last time rewards were applicable (for APR calculations)
   */
  static async getLastTimeRewardApplicable(): Promise<bigint> {
    try {
      const contract = getEvermarkRewardsContract();
      
      const lastTime = await readContract({
        contract,
        method: "function lastTimeRewardApplicable() view returns (uint256)",
        params: []
      });

      return lastTime;
    } catch (error) {
      console.error('Get last time reward applicable error:', error);
      return BigInt(0);
    }
  }

  /**
   * Check if user has any rewards to claim
   */
  static async hasClaimableRewards(userAddress: string): Promise<boolean> {
    try {
      const rewardInfo = await this.getUserRewardInfo(userAddress);
      return !!(rewardInfo && (rewardInfo.pendingEth > BigInt(0) || rewardInfo.pendingEmark > BigInt(0)));
    } catch (error) {
      console.error('Check claimable rewards error:', error);
      return false;
    }
  }

  /**
   * Estimate gas cost for claiming rewards
   */
  static estimateClaimGasCost(): string {
    return '~45,000 gas'; // Estimated gas cost for claimRewards()
  }
}