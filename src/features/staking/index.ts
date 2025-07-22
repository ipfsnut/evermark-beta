// features/staking/index.ts - Fixed public API exports for staking feature

// Types - Export all public interfaces
export type {
  StakingInfo,
  StakeAction,
  StakeFormData,
  UnstakeFormData,
  StakingTransaction,
  StakingValidation,
  StakingConfiguration,
  StakingStats,
  StakingError,
  StakingEvent,
  UseStakingStateReturn,
  StakingServiceParams,
  StakingContractCall,
  StakingErrorCode,
  StakingWidgetProps,
  StakeFormProps,
  UnstakeFormProps,
  StakingTheme,
  StakingAnalytics,
  StakingAPIResponse,
  StakingHistoryItem,
  StakingHistory,
  StakingNotification,
  StakingFeatureFlags,
  StakingPerformanceMetrics,
  StakingRewards,
  StakingDelegation,
  StakingGovernance
} from './types';

// Constants
export { STAKING_CONSTANTS, STAKING_ERRORS } from './types';

// Services
export { StakingService } from './services/StakingService';

// ✅ FIXED: Export the correct internal hooks
export { useStakingState } from './hooks/useStakingState';
export { useStakingData } from './hooks/useStakingData';
export { useStakingStats } from './hooks/useStakingStats';
export { useStakingTransactions } from './hooks/useStakingTransactions';

// ✅ FIXED: Export existing components only
export { StakingWidget } from './components/StakingWidget';
export { StakeForm } from './components/StakeForm';
export { UnstakeForm } from './components/UnstakeForm';

// Feature configuration and utilities
export const stakingConfig = {
  name: 'staking',
  version: '1.0.0',
  description: 'EMARK token staking for voting power and governance',
  
  // Feature capabilities
  features: {
    stake: true,
    unstake: true,
    cancelUnbonding: true,
    completeUnstake: true,
    votingPower: true,
    stakingStats: true,
    rewardsCalculation: false, // Future feature
    autoCompounding: false     // Future feature
  },
  
  // Default configuration
  defaults: {
    minStakeAmount: '1',
    maxStakeAmount: '10000000',
    unbondingPeriod: 7 * 24 * 60 * 60, // 7 days in seconds
    refreshInterval: 30000, // 30 seconds
    transactionTimeout: 60000 // 60 seconds
  },
  
  // Contract integration
  contracts: {
    emarkToken: 'EMARK_TOKEN',
    stakingContract: 'CARD_CATALOG', // Uses wrapping contract
    votingContract: 'CARD_CATALOG'
  },
  
  // UI configuration
  ui: {
    defaultTab: 'stake' as const,
    showAdvancedOptions: false,
    enableTransactionHistory: true,
    showStakingStats: true
  }
};

// Utility functions for external use
export const stakingUtils = {
  /**
   * Check if staking is enabled for a given chain/network
   */
  isStakingEnabled: (chainId?: number): boolean => {
    // In production, this would check against supported chains
    return true;
  },
  
  /**
   * Get minimum stake amount for a chain
   */
  getMinStakeAmount: (chainId?: number): bigint => {
    return STAKING_CONSTANTS.MIN_STAKE_AMOUNT;
  },
  
  /**
   * Get maximum stake amount for a chain
   */
  getMaxStakeAmount: (chainId?: number): bigint => {
    return STAKING_CONSTANTS.MAX_STAKE_AMOUNT;
  },
  
  /**
   * Get unbonding period for a chain
   */
  getUnbondingPeriod: (chainId?: number): number => {
    return STAKING_CONSTANTS.UNBONDING_PERIOD_SECONDS;
  },
  
  /**
   * Format staking amount for display
   */
  formatStakeAmount: (amount: bigint, decimals = 2): string => {
    return StakingService.formatTokenAmount(amount, decimals);
  },
  
  /**
   * Format time remaining for unbonding
   */
  formatUnbondingTime: (seconds: number): string => {
    return StakingService.formatTimeRemaining(seconds);
  },
  
  /**
   * Validate stake amount
   */
  validateAmount: (
    amount: string, 
    balance: bigint, 
    type: 'stake' | 'unstake' = 'stake'
  ): StakingValidation => {
    if (type === 'stake') {
      return StakingService.validateStakeAmount(amount, balance);
    } else {
      return StakingService.validateUnstakeAmount(amount, balance);
    }
  },
  
  /**
   * Create transaction summary
   */
  createTransactionSummary: (
    type: StakingTransaction['type'],
    amount?: bigint,
    currentStake?: bigint
  ) => {
    return StakingService.generateTransactionSummary(type, amount, currentStake);
  },
  
  /**
   * Calculate voting power from staked amount
   */
  calculateVotingPower: (stakedAmount: bigint, multiplier = 1): bigint => {
    return StakingService.calculateVotingPower(stakedAmount, multiplier);
  },
  
  /**
   * Get staking recommendations based on user goals
   */
  getStakingRecommendations: (
    balance: bigint,
    currentStake: bigint,
    userGoal: 'maximize_rewards' | 'moderate_risk' | 'maximum_voting_power'
  ) => {
    return StakingService.getStakingRecommendations(balance, currentStake, userGoal);
  },
  
  /**
   * Calculate estimated APY
   */
  calculateAPY: (
    totalStaked: bigint,
    totalRewards: bigint,
    timeperiod?: number
  ): number => {
    return StakingService.calculateAPY(totalStaked, totalRewards, timeperiod);
  },
  
  /**
   * Check if amount is economically viable
   */
  isEconomicallyViable: (amount: bigint, gasPrice?: bigint): boolean => {
    return StakingService.isEconomicallyViable(amount, gasPrice);
  },
  
  /**
   * Get gas cost estimates
   */
  getGasCostEstimates: () => {
    return StakingService.estimateGasCosts();
  },
  
  /**
   * Format percentage for display
   */
  formatPercentage: (value: number, decimals = 2): string => {
    return StakingService.formatPercentage(value, decimals);
  },
  
  /**
   * Parse contract error into user-friendly message
   */
  parseContractError: (error: any): StakingError => {
    return StakingService.parseContractError(error);
  },
  
  /**
   * Create standardized error
   */
  createError: (
    code: StakingErrorCode,
    message: string,
    details?: Record<string, any>
  ): StakingError => {
    return StakingService.createError(code, message, details);
  }
};

// Integration helpers
export const stakingIntegration = {
  /**
   * Initialize staking feature with configuration
   */
  initialize: (config: Partial<typeof stakingConfig> = {}) => {
    return {
      ...stakingConfig,
      ...config
    };
  },
  
  /**
   * Connect to external token service
   */
  connectTokenService: (tokenService: any) => {
    // Integration point for external token services
    return {
      getBalance: (address: string) => tokenService.getBalance(address),
      approve: (spender: string, amount: bigint) => tokenService.approve(spender, amount),
      transfer: (to: string, amount: bigint) => tokenService.transfer(to, amount)
    };
  },
  
  /**
   * Connect to external analytics service
   */
  connectAnalytics: (analyticsService: any) => {
    return {
      track: (event: StakingAnalytics) => analyticsService.track('staking', event),
      identify: (userId: string) => analyticsService.identify(userId)
    };
  },
  
  /**
   * Connect to external notification service
   */
  connectNotifications: (notificationService: any) => {
    return {
      show: (notification: StakingNotification) => notificationService.show(notification),
      clear: (id: string) => notificationService.clear(id)
    };
  }
};

// ✅ SIMPLIFIED: Removed complex theme and performance utilities to avoid type errors
// These can be added back when needed

// Feature flags
export const stakingFeatureFlags = {
  enableAdvancedMetrics: true,
  enableNotifications: true,
  enableTransactionHistory: true,
  enableAPYCalculations: true,
  enableAutoCompounding: false, // Future feature
  enableGasOptimization: true,
  enableBatchTransactions: false // Future feature
} as const;

// Default export for convenience
export default {
  config: stakingConfig,
  utils: stakingUtils,
  integration: stakingIntegration,
  featureFlags: stakingFeatureFlags,
  StakingService,
  useStakingState,
  StakingWidget,
  StakeForm,
  UnstakeForm
};