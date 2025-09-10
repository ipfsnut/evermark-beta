import type { BetaPointsRecord, PointTransaction, LeaderboardEntry } from '../types';

export class PointsService {
  private static readonly POINTS_API = '/.netlify/functions/beta-points';
  
  /**
   * Award points for user action
   */
  static async awardPoints(
    walletAddress: string,
    actionType: 'create_evermark' | 'vote' | 'stake' | 'marketplace_buy' | 'marketplace_sell',
    relatedId?: string,
    txHash?: string,
    stakeAmount?: string
  ): Promise<{ success: boolean; points_earned: number; total_points: number }> {
    try {
      const response = await fetch(this.POINTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wallet-Address': walletAddress
        },
        body: JSON.stringify({
          action_type: actionType,
          related_id: relatedId,
          tx_hash: txHash,
          stake_amount: stakeAmount
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to award points: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Award points error:', error);
      throw error;
    }
  }

  /**
   * Get user points and transaction history
   */
  static async getUserPoints(walletAddress: string): Promise<{
    points: BetaPointsRecord;
    transactions: PointTransaction[];
  }> {
    try {
      const response = await fetch(this.POINTS_API, {
        method: 'GET',
        headers: {
          'X-Wallet-Address': walletAddress
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch points: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        points: result.points,
        transactions: result.transactions
      };
    } catch (error) {
      console.error('Get user points error:', error);
      throw error;
    }
  }

  /**
   * Get points leaderboard
   */
  static async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch(`${this.POINTS_API}?action=leaderboard`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Add ranks to leaderboard entries
      return result.leaderboard.map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1
      }));
    } catch (error) {
      console.error('Get leaderboard error:', error);
      throw error;
    }
  }

  /**
   * Calculate points for staking action
   */
  static calculateStakePoints(stakeAmount: bigint): number {
    // 1 point per 1,000,000 EMARK (assuming 18 decimals)
    const stakeAmountNum = Number(stakeAmount) / (10 ** 18);
    return Math.floor(stakeAmountNum / 1000000);
  }

  /**
   * Format points for display
   */
  static formatPoints(points: number): string {
    if (points >= 1000000) {
      return `${(points / 1000000).toFixed(1)}M`;
    } else if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}k`;
    }
    return points.toString();
  }
}