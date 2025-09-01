// src/features/staking/services/VotingPowerService.ts
import { readContract } from 'thirdweb';
import { getEvermarkVotingContract } from '@/lib/contracts';
import { stakingLogger } from '@/utils/logger';

/**
 * Service for calculating voting power and reserved power
 * Handles the interaction between staking and voting systems
 */
export class VotingPowerService {
  /**
   * Calculate reserved voting power - power currently locked in active votes
   */
  static async calculateReservedPower(userAddress: string): Promise<bigint> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get current cycle
      const currentCycle = await readContract({
        contract: votingContract,
        method: "function getCurrentCycle() view returns (uint256)",
        params: []
      });

      // Get user's total voting power used in current cycle
      const reservedPower = await readContract({
        contract: votingContract,
        method: "function getUserTotalVotesInCycle(address user, uint256 cycle) view returns (uint256)",
        params: [userAddress, currentCycle]
      }).catch(() => BigInt(0)); // Fallback to 0 if method doesn't exist

      stakingLogger.debug('Calculated reserved voting power', {
        userAddress,
        currentCycle: currentCycle.toString(),
        reservedPower: reservedPower.toString()
      });

      return reservedPower as bigint;
    } catch (error) {
      stakingLogger.warn('Failed to calculate reserved power, using fallback method', {
        userAddress,
        error
      });

      // Fallback: try to get remaining power and calculate from total
      return this.calculateReservedPowerFallback(userAddress);
    }
  }

  /**
   * Fallback method to calculate reserved power when direct method isn't available
   */
  private static async calculateReservedPowerFallback(userAddress: string): Promise<bigint> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get total voting power and remaining power
      const [totalPower, remainingPower] = await Promise.all([
        readContract({
          contract: votingContract,
          method: "function getVotingPower(address user) view returns (uint256)",
          params: [userAddress]
        }),
        readContract({
          contract: votingContract,
          method: "function getRemainingVotingPower(address user) view returns (uint256)",
          params: [userAddress]
        })
      ]);

      const total = totalPower as bigint;
      const remaining = remainingPower as bigint;
      const reserved = total - remaining;

      stakingLogger.debug('Calculated reserved power via fallback', {
        userAddress,
        totalPower: total.toString(),
        remainingPower: remaining.toString(),
        reservedPower: reserved.toString()
      });

      return reserved;
    } catch (error) {
      stakingLogger.error('Failed to calculate reserved power with fallback', {
        userAddress,
        error
      });
      return BigInt(0);
    }
  }

  /**
   * Get detailed voting power breakdown
   */
  static async getVotingPowerBreakdown(userAddress: string, wEmarkBalance: bigint) {
    try {
      const reservedPower = await this.calculateReservedPower(userAddress);
      const availablePower = wEmarkBalance - reservedPower;

      return {
        total: wEmarkBalance,
        available: availablePower >= BigInt(0) ? availablePower : BigInt(0),
        reserved: reservedPower,
        delegated: reservedPower, // For staking interface compatibility
        utilizationRate: wEmarkBalance > BigInt(0) ? 
          Number((reservedPower * BigInt(100)) / wEmarkBalance) : 0
      };
    } catch (error) {
      stakingLogger.error('Failed to get voting power breakdown', {
        userAddress,
        wEmarkBalance: wEmarkBalance.toString(),
        error
      });

      // Return safe defaults
      return {
        total: wEmarkBalance,
        available: wEmarkBalance,
        reserved: BigInt(0),
        delegated: BigInt(0),
        utilizationRate: 0
      };
    }
  }

  /**
   * Check if user can vote with a specific amount
   */
  static async canVoteWithAmount(userAddress: string, amount: bigint, wEmarkBalance: bigint): Promise<boolean> {
    try {
      const breakdown = await this.getVotingPowerBreakdown(userAddress, wEmarkBalance);
      return breakdown.available >= amount;
    } catch (error) {
      stakingLogger.error('Failed to check voting eligibility', {
        userAddress,
        amount: amount.toString(),
        error
      });
      return false;
    }
  }

  /**
   * Get user's active votes in current cycle
   */
  static async getActiveVotes(userAddress: string): Promise<Array<{
    evermarkId: string;
    amount: bigint;
    timestamp: Date;
  }>> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // Get current cycle
      const currentCycle = await readContract({
        contract: votingContract,
        method: "function getCurrentCycle() view returns (uint256)",
        params: []
      });

      // This would need to be implemented based on the voting contract's event structure
      // For now, return empty array as placeholder
      stakingLogger.debug('Retrieved active votes', {
        userAddress,
        currentCycle: currentCycle.toString(),
        votesCount: 0
      });

      return [];
    } catch (error) {
      stakingLogger.error('Failed to get active votes', {
        userAddress,
        error
      });
      return [];
    }
  }

  /**
   * Estimate gas cost for voting operation
   */
  static async estimateVotingGas(userAddress: string, evermarkId: string, amount: bigint): Promise<bigint> {
    try {
      const votingContract = getEvermarkVotingContract();
      
      // This is a rough estimate - actual gas estimation would need the full transaction
      const baseGasEstimate = BigInt(150000); // Base gas for voting transaction
      
      stakingLogger.debug('Estimated voting gas', {
        userAddress,
        evermarkId,
        amount: amount.toString(),
        estimatedGas: baseGasEstimate.toString()
      });

      return baseGasEstimate;
    } catch (error) {
      stakingLogger.error('Failed to estimate voting gas', {
        userAddress,
        evermarkId,
        amount: amount.toString(),
        error
      });
      return BigInt(200000); // Conservative fallback
    }
  }
}