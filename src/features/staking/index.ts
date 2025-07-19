// features/staking/index.ts - Public API exports for staking feature

// Types
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
  StakingErrorCode
} from './types';

// Constants
export { STAKING_CONSTANTS, STAKING_ERRORS } from './types';

// Services
export { StakingService } from './services/StakingService';

// Hooks
export { useStakingState } from './hooks/useStakingState';

// Components
export { StakingWidget } from './components/StakingWidget';
export { StakeForm } from './components/StakeForm';

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
  }
};

// Default export for convenience
export default {
  config: stakingConfig,
  utils: stakingUtils,
  StakingService,
  useStakingState,
  StakingWidget,
  StakeForm
};