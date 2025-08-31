// features/voting/index.ts - Public API exports for voting feature

import { DelegateButton } from './components/DelegateButton';
import { VotingPanel } from './components/VotingPanel';
import { useVotingState } from './hooks/useVotingState';
import { VotingService } from './services/VotingService';
import type { BatchVotingRequest, EvermarkRanking, VotingAnalytics, VotingError, VotingErrorCode, VotingFeatureFlags, VotingNotification, VotingPerformanceMetrics, VotingPower, VotingTheme, VotingTransaction, VotingValidation, Vote } from './types';
import { VOTING_CONSTANTS } from './types';

// Types - Export all public interfaces
export type {
  Vote,
  Delegation,
  VotingCycle,
  VotingPower,
  VotingStats,
  VotingValidation,
  VotingTransaction,
  VotingError,
  VotingErrorCode,
  VotingConfiguration,
  UseVotingStateReturn,
  VotingPanelProps,
  DelegateButtonProps,
  VotingHistoryProps,
  EvermarkRanking,
  LeaderboardEntry,
  BatchVotingRequest,
  BatchVotingResult,
  VotingStrategy,
  VotingNotification,
  VotingAnalytics,
  VotingPerformanceMetrics,
  VotingFeatureFlags,
  VotingTheme
} from './types';

// Constants
export { VOTING_CONSTANTS, VOTING_ERRORS } from './types';

// Services
export { VotingService } from './services/VotingService';

// Hooks
export { useVotingState } from './hooks/useVotingState';

// Components
export { VotingPanel } from './components/VotingPanel';
export { DelegateButton } from './components/DelegateButton';

// Feature configuration and utilities
export const votingConfig = {
  name: 'voting',
  version: '1.0.0',
  description: 'Delegation-based voting system for Evermark content curation',
  
  // Feature capabilities
  features: {
    delegation: true,
    undelegation: true,
    batchVoting: true,
    votingHistory: true,
    votingAnalytics: true,
    cycleManagement: true,
    rankingCalculation: true,
    rewardDistribution: false, // Future feature
    governanceVoting: false    // Future feature
  },
  
  // Default configuration
  defaults: {
    minVoteAmount: '0.01',
    maxVoteAmount: '1000000',
    cycleDuration: 7 * 24 * 60 * 60, // 7 days in seconds
    maxDelegationsPerCycle: 100,
    refreshInterval: 15000, // 15 seconds
    transactionTimeout: 60000, // 60 seconds
    enableAutoRefresh: true,
    showVotingHistory: true
  },
  
  // Contract integration
  contracts: {
    votingContract: 'VOTING',
    stakingContract: 'CARD_CATALOG',
    evermarkContract: 'EVERMARK_NFT'
  },
  
  // UI configuration
  ui: {
    defaultVariant: 'default' as const,
    showAdvancedOptions: false,
    enableQuickVoting: true,
    showVotingImpact: true,
    enableBatchInterface: false,
    compactMode: false
  },
  
  // Performance settings
  performance: {
    cacheVotingData: true,
    batchContractCalls: true,
    optimisticUpdates: true,
    preloadCycleData: true
  }
};

// Utility functions for external use
export const votingUtils = {
  /**
   * Check if voting is enabled for a given chain/network
   */
  isVotingEnabled: (): boolean => {
    // In production, this would check against supported chains
    return true;
  },
  
  /**
   * Get minimum vote amount for a chain
   */
  getMinVoteAmount: (): bigint => {
    return VOTING_CONSTANTS.MIN_VOTE_AMOUNT;
  },
  
  /**
   * Get maximum vote amount for a chain
   */
  getMaxVoteAmount: (): bigint => {
    return VOTING_CONSTANTS.MAX_VOTE_AMOUNT;
  },
  
  /**
   * Get current cycle duration for a chain
   */
  getCycleDuration: (): number => {
    return VOTING_CONSTANTS.CYCLE_DURATION;
  },
  
  /**
   * Format vote amount for display
   */
  formatVoteAmount: (amount: bigint, decimals = 2): string => {
    return VotingService.formatVoteAmount(amount, decimals);
  },
  
  /**
   * Parse vote amount from user input
   */
  parseVoteAmount: (amount: string): bigint => {
    return VotingService.parseVoteAmount(amount);
  },
  
  /**
   * Validate vote amount
   */
  validateVoteAmount: (
    amount: string, 
    availablePower: bigint, 
    evermarkId?: string,
    userAddress?: string
  ): VotingValidation => {
    // Fixed: Removed the extra creatorAddress parameter
    return VotingService.validateVoteAmount(amount, evermarkId, userAddress);
  },
  
  /**
   * Validate undelegation amount
   */
  validateUndelegateAmount: (amount: string, currentDelegation: bigint): VotingValidation => {
    return VotingService.validateUndelegateAmount(amount, currentDelegation);
  },
  
  /**
   * Calculate voting power from staked amount
   */
  calculateVotingPower: (stakedAmount: bigint): bigint => {
    return VotingService.calculateVotingPower(stakedAmount);
  },
  
  /**
   * Format time remaining in cycle
   */
  formatTimeRemaining: (seconds: number): string => {
    return VotingService.formatTimeRemaining(seconds);
  },
  
  /**
   * Calculate time remaining from end time
   */
  getTimeRemaining: async (endTime: Date): Promise<number> => {
    return await VotingService.getTimeRemainingInCycle();
  },
  
  /**
   * Check if user can vote in current cycle
   */
  canVoteInCycle: (cycleNumber: number): boolean => {
    return VotingService.canVoteInCycle(cycleNumber);
  },
  
  /**
   * Calculate voting power efficiency
   */
  calculateEfficiency: (userVotes: Vote[]): number => {
    return VotingService.calculateVotingEfficiency(userVotes);
  },
  
  /**
   * Generate voting recommendations
   */
  getRecommendations: (availablePower: bigint) => {
    return VotingService.generateVotingRecommendations(availablePower);
  },
  
  /**
   * Calculate optimal vote distribution
   */
  calculateDistribution: (
    availablePower: bigint,
    targetEvermarks: string[],
    strategy: 'equal' | 'weighted' | 'concentrated' = 'equal'
  ): Record<string, bigint> => {
    return VotingService.calculateOptimalDistribution(targetEvermarks, availablePower);
  },
  
  /**
   * Validate batch voting request
   */
  validateBatchVoting: (request: BatchVotingRequest): VotingValidation => {
    return VotingService.validateBatchVoting(request.delegations);
  },
  
  /**
   * Calculate delegation impact on ranking
   */
  calculateImpact: (evermarkId: string, amount: bigint) => {
    return VotingService.calculateDelegationImpact(evermarkId, amount);
  },
  
  /**
   * Estimate delegation rewards
   */
  estimateRewards: (evermarkId: string, delegatedAmount: bigint) => {
    return VotingService.estimateDelegationRewards(evermarkId, delegatedAmount);
  },
  
  /**
   * Get user-friendly error message
   */
  getUserFriendlyError: (error: VotingError): string => {
    return VotingService.getUserFriendlyError(error);
  },
  
  /**
   * Parse contract error into structured format
   */
  parseContractError: (error: any): VotingError => {
    return VotingService.parseContractError(error);
  },
  
  /**
   * Create standardized error
   */
  createError: (
    code: VotingErrorCode,
    message: string,
    details?: Record<string, any>
  ): VotingError => {
    return VotingService.createError(code, message);
  },
  
  /**
   * Generate transaction summary
   */
  generateSummary: (delegations: any[]) => {
    return VotingService.generateDelegationSummary(delegations);
  },
  
  /**
   * Calculate Evermark rankings from vote data
   */
  calculateRankings: (evermarkId: string): EvermarkRanking => {
    return VotingService.calculateEvermarkRanking(evermarkId);
  },
  
  /**
   * Get gas cost estimates
   */
  getGasCosts: async (evermarkId: string, amount: bigint): Promise<bigint> => {
    return await VotingService.estimateVotingGas(evermarkId, amount);
  },
  
  /**
   * Create voting power summary
   */
  createPowerSummary: (votingPower: VotingPower) => {
    return VotingService.createVotingPowerSummary(votingPower);
  },
  
  /**
   * Format voting transaction for display
   */
  formatTransaction: (transaction: VotingTransaction) => {
    return VotingService.formatVotingTransaction(transaction);
  }
};

// Integration helpers
export const votingIntegration = {
  /**
   * Initialize voting feature with configuration
   */
  initialize: (config: Partial<typeof votingConfig> = {}) => {
    return {
      ...votingConfig,
      ...config,
      defaults: { ...votingConfig.defaults, ...config.defaults },
      ui: { ...votingConfig.ui, ...config.ui }
    };
  },
  
  /**
   * Connect to staking feature for voting power
   */
  connectStaking: (stakingHook: any) => {
    return {
      getVotingPower: (address: string) => stakingHook.getVotingPower(address),
      getStakedBalance: (address: string) => stakingHook.getStakedBalance(address),
      subscribeToStakingChanges: (callback: (data: any) => void) => stakingHook.subscribe(callback)
    };
  },
  
  /**
   * Connect to Evermarks feature for delegation targets
   */
  connectEvermarks: (evermarksService: any) => {
    return {
      getEvermark: (id: string) => evermarksService.getEvermark(id),
      getCreator: (id: string) => evermarksService.getCreator(id),
      validateEvermark: (id: string) => evermarksService.exists(id)
    };
  },
  
  /**
   * Connect to leaderboard for ranking updates
   */
  connectLeaderboard: (leaderboardService: any) => {
    return {
      updateRankings: (votes: Array<{ evermarkId: string; votes: bigint }>) => 
        leaderboardService.updateRankings(votes),
      getRankings: (cycle?: number) => leaderboardService.getRankings(cycle),
      subscribeToRankingChanges: (callback: (rankings: any[]) => void) => 
        leaderboardService.subscribe(callback)
    };
  },
  
  /**
   * Connect to analytics service
   */
  connectAnalytics: (analyticsService: any) => {
    return {
      track: (event: VotingAnalytics) => analyticsService.track('voting', event),
      identify: (userId: string) => analyticsService.identify(userId),
      recordVotingSession: (sessionData: any) => analyticsService.recordSession(sessionData)
    };
  },
  
  /**
   * Connect to notification service
   */
  connectNotifications: (notificationService: any) => {
    return {
      show: (notification: VotingNotification) => notificationService.show(notification),
      clear: (id: string) => notificationService.clear(id),
      notifyDelegationSuccess: (evermarkId: string, amount: bigint) => 
        notificationService.show({
          id: `delegation-${evermarkId}-${Date.now()}`,
          type: 'delegation_success',
          title: 'Delegation Successful',
          message: `Voted for Evermark #${evermarkId}`,
          evermarkId,
          amount,
          timestamp: Date.now(),
          read: false
        })
    };
  }
};

// Theme utilities
export const votingTheme = {
  /**
   * Get default theme configuration
   */
  getDefaultTheme: (): VotingTheme => ({
    colors: {
      primary: '#8B5CF6',
      secondary: '#06B6D4', 
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      active: '#00FF41',
      inactive: '#6B7280'
    },
    animations: {
      enableVoteAnimations: true,
      enableCounterAnimations: true,
      transitionDuration: 200
    },
    spacing: {
      buttonPadding: '0.75rem 1rem',
      panelPadding: '1.5rem',
      itemSpacing: '0.75rem'
    }
  }),
  
  /**
   * Apply theme to voting components
   */
  applyTheme: (theme: Partial<VotingTheme>) => {
    const defaultTheme = votingTheme.getDefaultTheme();
    return {
      ...defaultTheme,
      ...theme,
      colors: { ...defaultTheme.colors, ...theme.colors },
      animations: { ...defaultTheme.animations, ...theme.animations },
      spacing: { ...defaultTheme.spacing, ...theme.spacing }
    };
  }
};

// Performance monitoring
export const votingPerformance = {
  /**
   * Create performance monitor for voting operations
   */
  createMonitor: () => {
    const metrics: VotingPerformanceMetrics = {
      averageTransactionTime: 0,
      successRate: 0,
      gasEfficiency: 0,
      userEngagement: 0,
      cycleParticipation: 0
    };
    
    return {
      startTimer: (operation: string) => {
        const start = performance.now();
        return () => {
          const end = performance.now();
          if (operation === 'transaction') {
            metrics.averageTransactionTime = end - start;
          }
        };
      },
      recordSuccess: () => {
        metrics.successRate += 1;
      },
      recordFailure: () => {
        // Update failure metrics
      },
      recordGasUsage: () => {
        // Update gas efficiency metrics
      },
      recordEngagement: () => {
        metrics.userEngagement += 1;
      },
      getMetrics: () => ({ ...metrics })
    };
  }
};

// Voting strategies
export const votingStrategies = {
  /**
   * Equal distribution strategy
   */
  equalDistribution: {
    name: 'Equal Distribution',
    description: 'Distribute voting power equally across selected Evermarks',
    allocateVotes: (availablePower: bigint, evermarks: string[]) => {
      return votingUtils.calculateDistribution(availablePower, evermarks, 'equal');
    }
  },
  
  /**
   * Weighted distribution strategy
   */
  weightedDistribution: {
    name: 'Weighted Distribution',
    description: 'Allocate more voting power to higher-ranked Evermarks',
    allocateVotes: (availablePower: bigint, evermarks: string[]) => {
      return votingUtils.calculateDistribution(availablePower, evermarks, 'weighted');
    }
  },
  
  /**
   * Concentrated voting strategy
   */
  concentratedVoting: {
    name: 'Concentrated Voting',
    description: 'Focus most voting power on top choices',
    allocateVotes: (availablePower: bigint, evermarks: string[]) => {
      return votingUtils.calculateDistribution(availablePower, evermarks, 'concentrated');
    }
  }
};

// Feature flags
export const votingFeatureFlags: VotingFeatureFlags = {
  enableBatchVoting: true,
  enableVotingAnalytics: true,
  enableAutoRefresh: true,
  enableNotifications: true,
  enableAdvancedStats: true,
  enableVotingStrategies: false, // Future feature
  enableCyclePreview: false      // Future feature
};

// Export comprehensive voting configuration
export const completeVotingConfig = {
  config: votingConfig,
  utils: votingUtils,
  integration: votingIntegration,
  theme: votingTheme,
  performance: votingPerformance,
  strategies: votingStrategies,
  featureFlags: votingFeatureFlags
};

// Default export for convenience
export default {
  ...completeVotingConfig,
  VotingService,
  useVotingState,
  VotingPanel,
  DelegateButton
};