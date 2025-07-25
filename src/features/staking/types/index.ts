// features/staking/types/index.ts - Complete type definitions for staking feature

export interface StakingInfo {
  // Token balances
  emarkBalance: bigint;
  wEmarkBalance: bigint;
  totalStaked: bigint;
  
  // Voting power
  availableVotingPower: bigint;
  delegatedPower: bigint;
  reservedPower: bigint;
  
  // Unbonding state
  unbondingAmount: bigint;
  unbondingReleaseTime: bigint;
  canClaimUnbonding: boolean;
  timeUntilRelease: number; // seconds
  isUnbonding: boolean;
  
  // Protocol stats
  totalProtocolStaked: bigint;
  unbondingPeriod: number; // seconds
  unbondingPeriodDays: number;
}

export interface StakeAction {
  type: 'stake' | 'unstake' | 'complete_unstake' | 'cancel_unbonding';
  amount?: bigint;
  timestamp: number;
  transactionHash?: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

export interface StakeFormData {
  amount: string;
  maxAmount: bigint;
  isValid: boolean;
  errors: string[];
}

export interface UnstakeFormData {
  amount: string;
  maxAmount: bigint;
  isValid: boolean;
  errors: string[];
}

export interface StakingTransaction {
  hash: string;
  type: StakeAction['type'];
  amount?: bigint;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: bigint;
  error?: string;
}

export interface StakingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StakingConfiguration {
  // Contract addresses
  emarkTokenAddress: string;
  cardCatalogAddress: string;
  
  // Protocol parameters
  unbondingPeriod: number;
  minStakeAmount: bigint;
  maxStakeAmount: bigint;
  
  // UI configuration
  enableStaking: boolean;
  enableUnstaking: boolean;
  showAdvancedOptions: boolean;
}

export interface StakingStats {
  // User statistics
  userStakePercentage: number; // % of total protocol stake
  stakingRewards: bigint;
  stakingDuration: number; // seconds staked
  
  // Protocol statistics
  totalStakers: number;
  averageStakeAmount: bigint;
  stakingRatio: number; // staked/total supply ratio
  
  // Performance metrics
  aprEstimate: number; // estimated APR
  stakingYield: number; // yield percentage
}

export interface StakingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  recoverable: boolean;
  retryCount?: number;
}

// Event types for state management
export type StakingEvent = 
  | { type: 'STAKE_INITIATED'; amount: bigint }
  | { type: 'STAKE_CONFIRMED'; amount: bigint; hash: string }
  | { type: 'STAKE_FAILED'; error: StakingError }
  | { type: 'UNSTAKE_REQUESTED'; amount: bigint }
  | { type: 'UNSTAKE_COMPLETED'; amount: bigint; hash: string }
  | { type: 'UNBONDING_CANCELLED'; hash: string }
  | { type: 'DATA_REFRESHED'; timestamp: number }
  | { type: 'ERROR_CLEARED' }
  | { type: 'TRANSACTION_UPDATED'; hash: string; status: StakingTransaction['status'] };

// Hook return types
export interface UseStakingStateReturn {
  // Data
  stakingInfo: StakingInfo | null;
  stakingStats: StakingStats | null;
  
  // UI State
  isLoading: boolean;
  isStaking: boolean;
  isUnstaking: boolean;
  isProcessing: boolean;
  error: StakingError | null;
  success: string | null;
  
  // Actions
  stake: (amount: bigint) => Promise<void>;
  requestUnstake: (amount: bigint) => Promise<void>;
  completeUnstake: () => Promise<void>;
  cancelUnbonding: () => Promise<void>;
  
  // Utilities
  validateStakeAmount: (amount: string) => StakingValidation;
  validateUnstakeAmount: (amount: string) => StakingValidation;
  formatTokenAmount: (amount: bigint, decimals?: number) => string;
  formatTimeRemaining: (seconds: number) => string;
  calculateStakingYield: () => number;
  
  // State management
  clearError: () => void;
  clearSuccess: () => void;
  refetch: () => Promise<void>;
  
  // Connection status
  isConnected: boolean;
  hasWalletAccess: boolean;
}

// Service layer types
export interface StakingServiceParams {
  userAddress: string;
  emarkTokenAddress: string;
  cardCatalogAddress: string;
}

export interface StakingContractCall {
  contractAddress: string;
  functionName: string;
  params: any[];
  value?: bigint;
}

// Configuration and constants
export const STAKING_CONSTANTS = {
  MIN_STAKE_AMOUNT: BigInt(1), // 1 EMARK minimum
  MAX_STAKE_AMOUNT: BigInt(10000000), // 10M EMARK maximum
  DECIMALS: 18,
  UNBONDING_PERIOD_SECONDS: 7 * 24 * 60 * 60, // 7 days default
  DEFAULT_SLIPPAGE: 0.01, // 1%
  TRANSACTION_TIMEOUT: 60000, // 60 seconds
  RETRY_ATTEMPTS: 3,
  CACHE_DURATION: 30000, // 30 seconds
} as const;

export const STAKING_ERRORS = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE: 'INSUFFICIENT_ALLOWANCE',
  AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNBONDING_NOT_READY: 'UNBONDING_NOT_READY',
  NO_UNBONDING_REQUEST: 'NO_UNBONDING_REQUEST',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
} as const;

export type StakingErrorCode = typeof STAKING_ERRORS[keyof typeof STAKING_ERRORS];

// Component prop types
export interface StakingWidgetProps {
  stakingState: UseStakingStateReturn;
  className?: string;
}

export interface StakeFormProps {
  stakingState: UseStakingStateReturn;
  onSuccess?: () => void;
  className?: string;
}

export interface UnstakeFormProps {
  stakingState: UseStakingStateReturn;
  onSuccess?: () => void;
  className?: string;
}

// Theme and styling types
export interface StakingTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}

// Analytics and tracking types
export interface StakingAnalytics {
  userId?: string;
  sessionId: string;
  timestamp: number;
  action: StakeAction['type'];
  amount?: bigint;
  success: boolean;
  errorCode?: string;
  transactionHash?: string;
  gasUsed?: bigint;
}

// API response types
export interface StakingAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface StakingHistoryItem {
  id: string;
  type: StakeAction['type'];
  amount: bigint;
  timestamp: number;
  transactionHash: string;
  status: 'completed' | 'failed';
  gasUsed?: bigint;
  gasCost?: bigint;
}

export interface StakingHistory {
  items: StakingHistoryItem[];
  totalCount: number;
  hasMore: boolean;
}

// Notification types
export interface StakingNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

// Feature flags and configuration
export interface StakingFeatureFlags {
  enableAdvancedMetrics: boolean;
  enableNotifications: boolean;
  enableTransactionHistory: boolean;
  enableAPYCalculations: boolean;
  enableAutoCompounding: boolean;
  enableGasOptimization: boolean;
  enableBatchTransactions: boolean;
}

// Performance and optimization types
export interface StakingPerformanceMetrics {
  loadTime: number;
  transactionTime: number;
  errorRate: number;
  retryCount: number;
  cacheHitRate: number;
}

// Future extension types
export interface StakingRewards {
  totalEarned: bigint;
  currentAPR: number;
  projectedAPR: number;
  nextRewardTime: number;
  claimableAmount: bigint;
}

export interface StakingDelegation {
  delegatee: string;
  amount: bigint;
  timestamp: number;
  transactionHash: string;
}

export interface StakingGovernance {
  votingPower: bigint;
  delegatedPower: bigint;
  activeProposals: number;
  participationRate: number;
}