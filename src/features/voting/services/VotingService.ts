import { formatUnits, parseUnits } from 'viem';
import { readContract, getContractEvents, estimateGas, getGasPrice, prepareEvent } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN } from '@/lib/contracts';
import { 
  type Vote,
  type Delegation,
  type VotingCycle,
  type VotingPower,
  type VotingStats,
  type VotingValidation,
  type VotingError,
  type VotingErrorCode,
  type VotingTransaction,
  type EvermarkRanking,
  type BatchVotingRequest,
  type BatchVotingResult,
  VOTING_CONSTANTS,
  VOTING_ERRORS
} from '../types';

export class VotingService {
  
  /**
   * Fetch delegation history from contract events
   */
  static async fetchDelegationHistory(
    userAddress: string,
    votingContract: any,
    fromBlock?: bigint,
    toBlock?: bigint
  ): Promise<Vote[]> {
    try {
      // Prepare event definitions for type safety
      const delegateEvent = prepareEvent({
        signature: "event VoteDelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
      });

      const undelegateEvent = prepareEvent({
        signature: "event VoteUndelegated(address indexed user, uint256 indexed evermarkId, uint256 amount, uint256 indexed cycle)"
      });

      const [delegateEvents, undelegateEvents] = await Promise.all([
        getContractEvents({
          contract: votingContract,
          events: [delegateEvent],
          fromBlock: fromBlock || 0n,
          toBlock: toBlock || 'latest'
        }),
        getContractEvents({
          contract: votingContract,
          events: [undelegateEvent],
          fromBlock: fromBlock || 0n,
          toBlock: toBlock || 'latest'
        })
      ]);

      const allEvents = [
        ...delegateEvents
          .filter(event => event.args.user.toLowerCase() === userAddress.toLowerCase())
          .map(event => ({
            id: `${event.transactionHash}-${event.logIndex}`,
            userAddress,
            evermarkId: event.args.evermarkId.toString(),
            amount: event.args.amount,
            cycle: Number(event.args.cycle),
            timestamp: new Date(Number(event.blockTimestamp || 0) * 1000),
            transactionHash: event.transactionHash,
            status: 'confirmed' as const,
            type: 'delegate' as const
          })),
        ...undelegateEvents
          .filter(event => event.args.user.toLowerCase() === userAddress.toLowerCase())
          .map(event => ({
            id: `${event.transactionHash}-${event.logIndex}`,
            userAddress,
            evermarkId: event.args.evermarkId.toString(),
            amount: event.args.amount,
            cycle: Number(event.args.cycle),
            timestamp: new Date(Number(event.blockTimestamp || 0) * 1000),
            transactionHash: event.transactionHash,
            status: 'confirmed' as const,
            type: 'undelegate' as const
          }))
      ];

      // Sort by timestamp descending
      return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to fetch delegation history:', error);
      return [];
    }
  }

  /**
   * Get evermark votes in current cycle from contract
   */
  static async getEvermarkVotes(
    evermarkId: string,
    cycle: number,
    votingContract: any
  ): Promise<bigint> {
    try {
      const votes = await readContract({
        contract: votingContract,
        method: "function getEvermarkVotesInCycle(uint256 cycle, uint256 evermarkId) view returns (uint256)",
        params: [BigInt(cycle), BigInt(evermarkId)]
      });
      return votes;
    } catch (error) {
      console.error(`Failed to get votes for evermark ${evermarkId}:`, error);
      return BigInt(0);
    }
  }

  /**
   * Get user votes for specific evermark in cycle
   */
  static async getUserVotes(
    userAddress: string,
    evermarkId: string,
    cycle: number,
    votingContract: any
  ): Promise<bigint> {
    try {
      const votes = await readContract({
        contract: votingContract,
        method: "function getUserVotesInCycle(uint256 cycle, address user, uint256 evermarkId) view returns (uint256)",
        params: [BigInt(cycle), userAddress, BigInt(evermarkId)]
      });
      return votes;
    } catch (error) {
      console.error(`Failed to get user votes for evermark ${evermarkId}:`, error);
      return BigInt(0);
    }
  }

  /**
   * Get user's remaining voting power
   */
  static async getRemainingVotingPower(
    userAddress: string,
    votingContract: any
  ): Promise<bigint> {
    try {
      const remainingPower = await readContract({
        contract: votingContract,
        method: "function getRemainingVotingPower(address user) view returns (uint256)",
        params: [userAddress]
      });
      return remainingPower;
    } catch (error) {
      console.error('Failed to get remaining voting power:', error);
      return BigInt(0);
    }
  }

  /**
   * Calculate real voting statistics from contract data
   */
  static calculateVotingStats(
    userDelegations: Delegation[],
    totalVotingPower: bigint,
    cycleData: VotingCycle | null,
    allUserVotes?: Vote[]
  ): VotingStats {
    const totalVotesCast = userDelegations.reduce((sum, delegation) => sum + delegation.amount, BigInt(0));
    const activeEvermarks = userDelegations.filter(d => d.isActive).length;
    const averageVotesPerEvermark = activeEvermarks > 0 ? totalVotesCast / BigInt(activeEvermarks) : BigInt(0);
    
    // Find top evermark votes
    const topEvermarkVotes = userDelegations.reduce((max, delegation) => 
      delegation.amount > max ? delegation.amount : max, BigInt(0)
    );

    // Calculate user ranking based on total votes cast
    let userRanking = 0;
    if (allUserVotes && totalVotesCast > BigInt(0)) {
      const usersByVotes = allUserVotes
        .reduce((acc, vote) => {
          const existing = acc.find(u => u.address === vote.userAddress);
          if (existing) {
            existing.totalVotes += vote.amount;
          } else {
            acc.push({ address: vote.userAddress, totalVotes: vote.amount });
          }
          return acc;
        }, [] as { address: string; totalVotes: bigint }[])
        .sort((a, b) => Number(b.totalVotes - a.totalVotes));
      
      userRanking = usersByVotes.findIndex(u => u.totalVotes <= totalVotesCast) + 1;
    }

    // Calculate participation rate
    const participationRate = cycleData && allUserVotes ? 
      allUserVotes.length / cycleData.totalDelegations : 0;

    return {
      totalVotesCast,
      activeEvermarks,
      averageVotesPerEvermark,
      topEvermarkVotes,
      userRanking,
      participationRate
    };
  }

  /**
   * Real gas estimation using current network conditions
   */
  static async estimateVotingGas(votingContract: any): Promise<{
    delegate: { gasLimit: bigint; estimatedCost: string };
    undelegate: { gasLimit: bigint; estimatedCost: string };
    batchDelegate: { gasLimit: bigint; estimatedCost: string };
  }> {
    try {
      const [gasPrice, delegateGas, undelegateGas] = await Promise.all([
        getGasPrice({ client, chain: CHAIN }),
        estimateGas({
          contract: votingContract,
          method: "function delegateVotes(uint256 evermarkId, uint256 amount)",
          params: [BigInt(1), parseUnits('1', 18)]
        }),
        estimateGas({
          contract: votingContract,
          method: "function undelegateVotes(uint256 evermarkId, uint256 amount)",
          params: [BigInt(1), parseUnits('1', 18)]
        })
      ]);

      const batchGas = delegateGas * BigInt(3); // Estimate for 3 delegations

      // Convert to USD (rough estimate - $2000/ETH)
      const ethPrice = 2000;
      const delegateCostUSD = Number(formatUnits(delegateGas * gasPrice, 18)) * ethPrice;
      const undelegateCostUSD = Number(formatUnits(undelegateGas * gasPrice, 18)) * ethPrice;
      const batchCostUSD = Number(formatUnits(batchGas * gasPrice, 18)) * ethPrice;

      return {
        delegate: {
          gasLimit: delegateGas,
          estimatedCost: `~$${delegateCostUSD.toFixed(2)} USD`
        },
        undelegate: {
          gasLimit: undelegateGas,
          estimatedCost: `~$${undelegateCostUSD.toFixed(2)} USD`
        },
        batchDelegate: {
          gasLimit: batchGas,
          estimatedCost: `~$${batchCostUSD.toFixed(2)} USD`
        }
      };
    } catch (error) {
      console.warn('Gas estimation failed, using fallback values:', error);
      return {
        delegate: {
          gasLimit: BigInt(80000),
          estimatedCost: '~$0.60 USD'
        },
        undelegate: {
          gasLimit: BigInt(65000),
          estimatedCost: '~$0.50 USD'
        },
        batchDelegate: {
          gasLimit: BigInt(200000),
          estimatedCost: '~$1.50 USD'
        }
      };
    }
  }

  /**
   * Estimate delegation rewards based on historical performance
   */
  static async estimateDelegationRewards(
    delegatedAmount: bigint,
    evermarkId: string,
    votingContract: any,
    cycleDuration: number = VOTING_CONSTANTS.CYCLE_DURATION
  ): Promise<{
    estimatedRewards: bigint;
    rewardRate: number;
    confidenceLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      // Get historical performance data for this evermark
      const currentCycle = await readContract({
        contract: votingContract,
        method: "function getCurrentCycle() view returns (uint256)",
        params: []
      });

      // Get votes for last 3 cycles to calculate performance
      const historicalVotes = await Promise.all([
        this.getEvermarkVotes(evermarkId, Number(currentCycle) - 1, votingContract),
        this.getEvermarkVotes(evermarkId, Number(currentCycle) - 2, votingContract),
        this.getEvermarkVotes(evermarkId, Number(currentCycle) - 3, votingContract)
      ]);

      // Calculate performance trend
      const avgVotes = historicalVotes.reduce((sum, votes) => sum + votes, BigInt(0)) / BigInt(historicalVotes.length);
      const performanceScore = Math.min(100, Number(avgVotes) / 1000); // Scale to 0-100

      // Base reward rate varies by performance
      const baseRewardRate = 0.02 + (performanceScore / 100) * 0.08; // 2-10% annual
      const timeMultiplier = cycleDuration / (365 * 24 * 60 * 60); // Convert to yearly fraction
      
      const rewardRate = baseRewardRate * timeMultiplier;
      const estimatedRewards = BigInt(Math.floor(Number(delegatedAmount) * rewardRate));
      
      // Confidence based on historical data availability
      let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
      if (historicalVotes.every(v => v > BigInt(0))) confidenceLevel = 'high';
      if (historicalVotes.every(v => v === BigInt(0))) confidenceLevel = 'low';

      return {
        estimatedRewards,
        rewardRate: rewardRate * 100, // Convert to percentage
        confidenceLevel
      };
    } catch (error) {
      console.error('Failed to estimate rewards:', error);
      return {
        estimatedRewards: BigInt(0),
        rewardRate: 5.0, // Fallback 5%
        confidenceLevel: 'low'
      };
    }
  }

  // ... (keep all validation and utility methods from previous version)
  static validateVoteAmount(
    amount: string,
    availableVotingPower: bigint,
    evermarkId?: string,
    userAddress?: string,
    creatorAddress?: string
  ): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!amount || amount.trim() === '') {
      errors.push('Vote amount is required');
      return { isValid: false, errors, warnings };
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Vote amount must be a positive number');
      return { isValid: false, errors, warnings };
    }

    const amountWei = parseUnits(amount, 18);

    if (amountWei < VOTING_CONSTANTS.MIN_VOTE_AMOUNT) {
      errors.push(`Minimum vote amount is ${this.formatVoteAmount(VOTING_CONSTANTS.MIN_VOTE_AMOUNT)} wEMARK`);
    }

    if (amountWei > VOTING_CONSTANTS.MAX_VOTE_AMOUNT) {
      errors.push(`Maximum vote amount is ${this.formatVoteAmount(VOTING_CONSTANTS.MAX_VOTE_AMOUNT)} wEMARK`);
    }

    if (amountWei > availableVotingPower) {
      errors.push(`Insufficient voting power. Available: ${this.formatVoteAmount(availableVotingPower)} wEMARK`);
    }

    if (userAddress && creatorAddress && userAddress.toLowerCase() === creatorAddress.toLowerCase()) {
      errors.push('You cannot vote on your own Evermark');
    }

    if (amountWei > availableVotingPower / BigInt(2)) {
      warnings.push('You are using more than 50% of your available voting power');
    }

    if (amountWei < parseUnits('1', 18)) {
      warnings.push('Small vote amounts may have minimal impact on rankings');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateUndelegateAmount(amount: string, currentDelegation: bigint): VotingValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!amount || amount.trim() === '') {
      errors.push('Amount is required');
      return { isValid: false, errors, warnings };
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      errors.push('Amount must be a positive number');
      return { isValid: false, errors, warnings };
    }

    const amountWei = parseUnits(amount, 18);

    if (currentDelegation === BigInt(0)) {
      errors.push('No votes delegated to this Evermark');
    }

    if (amountWei > currentDelegation) {
      errors.push(`Cannot undelegate more than current delegation of ${this.formatVoteAmount(currentDelegation)} wEMARK`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static calculateVotingPower(stakedAmount: bigint): bigint {
    return stakedAmount; // 1:1 ratio for now
  }

  static formatVoteAmount(amount: bigint, decimals = 2): string {
    if (amount === BigInt(0)) return '0';
    
    const formatted = formatUnits(amount, 18);
    const number = parseFloat(formatted);
    
    if (number < 0.0001) return '< 0.0001';
    if (number >= 1000000) return `${(number / 1000000).toFixed(decimals)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(decimals)}K`;
    
    return number.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  }

  static parseVoteAmount(amount: string): bigint {
    try {
      if (!amount || amount.trim() === '') return BigInt(0);
      const cleanAmount = amount.trim().replace(/,/g, '');
      if (!/^\d*\.?\d*$/.test(cleanAmount)) throw new Error('Invalid number format');
      return parseUnits(cleanAmount, 18);
    } catch (error) {
      console.error('Error parsing vote amount:', error);
      throw new Error('Invalid amount format');
    }
  }

  static getTimeRemainingInCycle(cycleEndTime: Date): number {
    const now = new Date();
    const endTime = new Date(cycleEndTime);
    return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
  }

  static formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Cycle ended';
    
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }

  static createError(code: VotingErrorCode, message: string, details?: Record<string, any>): VotingError {
    return {
      code,
      message,
      timestamp: Date.now(),
      recoverable: this.isRecoverableError(code),
      details
    };
  }

  private static isRecoverableError(code: VotingErrorCode): boolean {
    const recoverableErrors = new Set([
      VOTING_ERRORS.NETWORK_ERROR,
      VOTING_ERRORS.TRANSACTION_FAILED,
      VOTING_ERRORS.CONTRACT_ERROR
    ]);
    return recoverableErrors.has(code);
  }

  static parseContractError(error: any): VotingError {
    const timestamp = Date.now();
    let code: VotingErrorCode = VOTING_ERRORS.CONTRACT_ERROR;
    let message = 'Transaction failed';
    let recoverable = true;

    if (error?.message) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('insufficient voting power')) {
        code = VOTING_ERRORS.INSUFFICIENT_VOTING_POWER;
        message = 'Insufficient voting power for this delegation';
      } else if (errorMessage.includes('cycle is finalized') || errorMessage.includes('cycle ended')) {
        code = VOTING_ERRORS.CYCLE_ENDED;
        message = 'Current voting cycle has ended';
      } else if (errorMessage.includes('cannot vote on own')) {
        code = VOTING_ERRORS.SELF_VOTE_ATTEMPTED;
        message = 'You cannot vote on your own Evermark';
        recoverable = false;
      } else if (errorMessage.includes('evermark does not exist')) {
        code = VOTING_ERRORS.INVALID_EVERMARK;
        message = 'This Evermark does not exist';
        recoverable = false;
      } else if (errorMessage.includes('user rejected')) {
        code = VOTING_ERRORS.TRANSACTION_FAILED;
        message = 'Transaction was rejected';
        recoverable = false;
      } else if (errorMessage.includes('network')) {
        code = VOTING_ERRORS.NETWORK_ERROR;
        message = 'Network error. Please try again';
      } else if (errorMessage.includes('no votes to undelegate')) {
        code = VOTING_ERRORS.NO_VOTES_TO_UNDELEGATE;
        message = 'No votes delegated to this Evermark';
      }
    }

    return { code, message, timestamp, recoverable, details: { originalError: error?.message || 'Unknown error', stack: error?.stack } };
  }

  static getUserFriendlyError(error: VotingError): string {
    switch (error.code) {
      case VOTING_ERRORS.WALLET_NOT_CONNECTED:
        return 'Please connect your wallet to vote';
      case VOTING_ERRORS.INSUFFICIENT_VOTING_POWER:
        return 'You don\'t have enough voting power for this delegation';
      case VOTING_ERRORS.INVALID_EVERMARK:
        return 'This Evermark does not exist or is invalid';
      case VOTING_ERRORS.CYCLE_ENDED:
        return 'The current voting cycle has ended';
      case VOTING_ERRORS.SELF_VOTE_ATTEMPTED:
        return 'You cannot vote on your own Evermark';
      case VOTING_ERRORS.NO_VOTES_TO_UNDELEGATE:
        return 'You have no votes delegated to this Evermark';
      case VOTING_ERRORS.AMOUNT_TOO_LOW:
        return 'Vote amount is below the minimum required';
      case VOTING_ERRORS.AMOUNT_TOO_HIGH:
        return 'Vote amount exceeds the maximum allowed';
      case VOTING_ERRORS.TRANSACTION_FAILED:
        return 'Transaction failed. Please try again';
      case VOTING_ERRORS.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again';
      default:
        return error.message || 'An unexpected error occurred';
    }
  }
}
