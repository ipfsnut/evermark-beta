// features/staking/index.ts - Fixed and simplified public API exports

// ✅ IMPORT TYPES AND CONSTANTS FIRST
import { 
  STAKING_CONSTANTS, 
  STAKING_ERRORS,
  type StakingInfo,
  type StakeAction,
  type StakeFormData,
  type UnstakeFormData,
  type StakingTransaction,
  type StakingValidation,
  type StakingConfiguration,
  type StakingStats,
  type StakingError,
  type StakingEvent,
  type UseStakingStateReturn,
  type StakingErrorCode,
  type StakingWidgetProps,
  type StakeFormProps,
  type UnstakeFormProps
} from './types';

// ✅ IMPORT NFT STAKING
import { NFTStakingService, type NFTStakeInfo, type NFTStakingStats } from './services/NFTStakingService';
import { useNFTStaking, type UseNFTStakingReturn } from './hooks/useNFTStaking';

// ✅ CORE TYPES - Re-export for external use
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
  StakingErrorCode,
  StakingWidgetProps,
  StakeFormProps,
  UnstakeFormProps,
  // NFT Staking types
  NFTStakeInfo,
  NFTStakingStats,
  UseNFTStakingReturn
};

// ✅ CONSTANTS - Import and re-export
export { STAKING_CONSTANTS, STAKING_ERRORS };

// ✅ SERVICES - Core business logic
import { StakingService } from './services/StakingService';
export { StakingService, NFTStakingService };

// ✅ HOOKS - Internal feature hooks
import { useStakingState } from './hooks/useStakingState';
import { useStakingData } from './hooks/useStakingData';
import { useStakingStats } from './hooks/useStakingStats';
import { useStakingTransactions } from './hooks/useStakingTransactions';
export { useStakingState, useStakingData, useStakingStats, useStakingTransactions, useNFTStaking };

// ✅ COMPONENTS - Existing UI components
import { StakingWidget } from './components/StakingWidget';
import { StakeForm } from './components/StakeForm';
import { UnstakeForm } from './components/UnstakeForm';
import { NFTStakingPanel } from './components/NFTStakingPanel';
export { StakingWidget, StakeForm, UnstakeForm, NFTStakingPanel };

// ✅ CORE CONFIGURATION - Simplified and working
export const stakingConfig = {
  name: 'staking',
  version: '1.0.0',
  description: 'EMARK token staking for voting power and content curation',
  
  // Feature capabilities
  features: {
    stake: true,
    unstake: true,
    cancelUnbonding: true,
    completeUnstake: true,
    votingPower: true,
    stakingStats: true,
    rewardsCalculation: false,
    autoCompounding: false
  },
  
  // Default configuration values
  defaults: {
    minStakeAmount: '1',
    maxStakeAmount: '10000000',
    unbondingPeriod: 7 * 24 * 60 * 60, // 7 days in seconds
    refreshInterval: 30000, // 30 seconds
    transactionTimeout: 60000 // 60 seconds
  },
  
  // Contract integration points
  contracts: {
    emarkToken: 'EMARK_TOKEN',
    stakingContract: 'CARD_CATALOG',
    votingContract: 'CARD_CATALOG'
  },
  
  // UI configuration
  ui: {
    defaultTab: 'stake' as const,
    showAdvancedOptions: false,
    enableTransactionHistory: true,
    showStakingStats: true
  }
} as const;

// ✅ UTILITY FUNCTIONS - Only what's actually implemented
export const stakingUtils = {
  /**
   * Check if staking is enabled for a given chain/network
   */
  isStakingEnabled: (): boolean => {
    return true; // Always enabled for now
  },
  
  /**
   * Get minimum stake amount
   */
  getMinStakeAmount: (): bigint => {
    return STAKING_CONSTANTS.MIN_STAKE_AMOUNT;
  },
  
  /**
   * Get maximum stake amount
   */
  getMaxStakeAmount: (): bigint => {
    return STAKING_CONSTANTS.MAX_STAKE_AMOUNT;
  },
  
  /**
   * Get unbonding period in seconds
   */
  getUnbondingPeriod: (): number => {
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
  validateStakeAmount: (amount: string, balance: bigint): StakingValidation => {
    return StakingService.validateStakeAmount(amount, balance);
  },
  
  /**
   * Validate unstake amount
   */
  validateUnstakeAmount: (amount: string, balance: bigint): StakingValidation => {
    return StakingService.validateUnstakeAmount(amount, balance);
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
  createError: (code: StakingErrorCode, message: string): StakingError => {
    return StakingService.createError(code, message);
  },
  
  /**
   * Calculate voting power from staked amount
   */
  calculateVotingPower: (stakedAmount: bigint): bigint => {
    return StakingService.calculateVotingPower(stakedAmount);
  },
  
  /**
   * Check if amount is economically viable
   */
  isEconomicallyViable: (amount: bigint): boolean => {
    return StakingService.isEconomicallyViable(amount);
  },
  
  /**
   * Format percentage for display
   */
  formatPercentage: (value: number, decimals = 2): string => {
    return StakingService.formatPercentage(value, decimals);
  }
};

// ✅ INTEGRATION HELPERS - Simplified
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
   * Get feature status
   */
  getFeatureStatus: () => {
    return {
      isEnabled: true,
      version: stakingConfig.version,
      features: stakingConfig.features
    };
  },
  
  /**
   * Validate configuration
   */
  validateConfig: (config: typeof stakingConfig) => {
    const requiredFields = ['name', 'version', 'features', 'defaults'];
    const missing = requiredFields.filter(field => !(field in config));
    
    return {
      isValid: missing.length === 0,
      missingFields: missing,
      config
    };
  }
};

// ✅ FEATURE FLAGS - Simple and working
export const stakingFeatureFlags = {
  enableAdvancedMetrics: true,
  enableNotifications: true,
  enableTransactionHistory: true,
  enableAPYCalculations: true,
  enableAutoCompounding: false,
  enableGasOptimization: true,
  enableBatchTransactions: false
} as const;

// ✅ MAIN STAKING API - Everything you need
export const StakingAPI = {
  // Core service
  service: StakingService,
  
  // React hook for state management
  useStaking: useStakingState,
  
  // UI components
  components: {
    StakingWidget,
    StakeForm,
    UnstakeForm
  },
  
  // Configuration and utilities
  config: stakingConfig,
  utils: stakingUtils,
  integration: stakingIntegration,
  featureFlags: stakingFeatureFlags,
  
  // Constants and types
  constants: STAKING_CONSTANTS,
  errors: STAKING_ERRORS
};

// ✅ DEFAULT EXPORT - Complete staking module
export default {
  // Main API
  ...StakingAPI,
  
  // Direct component exports for convenience
  StakingWidget,
  StakeForm,
  UnstakeForm,
  
  // Direct hook export
  useStakingState,
  
  // Service class
  StakingService,
  
  // Type guards and validators
  validators: {
    isStakingInfo: (obj: any): obj is StakingInfo => {
      return obj && 
        typeof obj.emarkBalance === 'bigint' &&
        typeof obj.wEmarkBalance === 'bigint' &&
        typeof obj.totalStaked === 'bigint';
    },
    
    isStakingError: (obj: any): obj is StakingError => {
      return obj &&
        typeof obj.code === 'string' &&
        typeof obj.message === 'string' &&
        typeof obj.timestamp === 'number';
    },
    
    isValidStakeAmount: (amount: string): boolean => {
      const parsed = parseFloat(amount);
      return !isNaN(parsed) && parsed > 0;
    }
  },
  
  // Error handling utilities
  errorHandler: {
    createError: StakingService.createError,
    parseError: StakingService.parseContractError,
    
    isRecoverableError: (error: StakingError): boolean => {
      return error.recoverable;
    },
    
    getErrorMessage: (error: StakingError): string => {
      return error.message;
    }
  }
};