// features/voting/types/index.ts - Complete type definitions for voting feature

export interface Vote {
  id: string;
  userAddress: string;
  evermarkId: string;
  amount: bigint;
  cycle: number;
  timestamp: Date;
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'delegate' | 'undelegate';
}

export interface Delegation {
  evermarkId: string;
  amount: bigint;
  cycle: number;
  timestamp: Date;
  transactionHash?: string;
  isActive: boolean;
}

export interface VotingCycle {
  cycleNumber: number;
  startTime: Date;
  endTime: Date;
  totalVotes: bigint;
  totalDelegations: number;
  isFinalized: boolean;
  activeEvermarksCount: number;
}

export interface VotingPower {
  total: bigint;
  available: bigint;
  delegated: bigint;
  reserved: bigint;
}

export interface VotingStats {
  totalVotesCast: bigint;
  activeEvermarks: number;
  averageVotesPerEvermark: bigint;
  topEvermarkVotes: bigint;
  userRanking: number;
  participationRate: number;
}

export interface VotingValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface VotingTransaction {
  hash: string;
  type: Vote['type'];
  evermarkId: string;
  amount: bigint;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: bigint;
  error?: string;
}

export interface VotingError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  recoverable: boolean;
}

export interface VotingConfiguration {
  // Contract addresses
  votingContractAddress: string;
  cardCatalogAddress: string;
  
  // Cycle parameters
  cycleDuration: number; // seconds
  maxDelegationsPerCycle: number;
  minVotingAmount: bigint;
  maxVotingAmount: bigint;
  
  // UI configuration
  enableBatchVoting: boolean;
  showVotingHistory: boolean;
  enableVotingAnalytics: boolean;
  autoRefreshInterval: number;
}

// Hook return types
export interface UseVotingStateReturn {
  // Data
  votingPower: VotingPower | null;
  currentDelegations: Delegation[];
  votingHistory: Vote[];
  currentCycle: VotingCycle | null;
  votingStats: VotingStats | null;
  
  // Evermark-specific data
  getEvermarkVotes: (evermarkId: string) => bigint;
  getUserVotes: (evermarkId: string) => bigint;
  
  // UI State
  isLoading: boolean;
  isDelegating: boolean;
  isUndelegating: boolean;
  error: VotingError | null;
  success: string | null;
  
  // Actions
  delegateVotes: (evermarkId: string, amount: bigint) => Promise<VotingTransaction>;
  undelegateVotes: (evermarkId: string, amount: bigint) => Promise<VotingTransaction>;
  delegateVotesBatch: (delegations: { evermarkId: string; amount: bigint }[]) => Promise<VotingTransaction>;
  
  // Utilities
  validateVoteAmount: (amount: string, evermarkId?: string) => VotingValidation;
  calculateVotingPower: (stakedAmount: bigint) => bigint;
  formatVoteAmount: (amount: bigint, decimals?: number) => string;
  getTimeRemainingInCycle: () => number;
  
  // State management
  clearErrors: () => void;
  clearSuccess: () => void;
  refetch: () => Promise<void>;
  
  // Connection status
  isConnected: boolean;
  userAddress: string | undefined;
}

// Service layer types
export interface VotingServiceParams {
  userAddress: string;
  votingContractAddress: string;
  cardCatalogAddress: string;
}

export interface VotingContractCall {
  contractAddress: string;
  functionName: string;
  params: any[];
  value?: bigint;
}

// Configuration and constants
export const VOTING_CONSTANTS = {
  MIN_VOTE_AMOUNT: BigInt(1), // 1 wEMARK minimum
  MAX_VOTE_AMOUNT: BigInt(1000000), // 1M wEMARK maximum
  CYCLE_DURATION: 7 * 24 * 60 * 60, // 7 days in seconds
  MAX_DELEGATIONS_PER_CYCLE: 100,
  TRANSACTION_TIMEOUT: 60000, // 60 seconds
  RETRY_ATTEMPTS: 3,
  CACHE_DURATION: 30000, // 30 seconds
  REFRESH_INTERVAL: 15000, // 15 seconds
} as const;

export const VOTING_ERRORS = {
  INSUFFICIENT_VOTING_POWER: 'INSUFFICIENT_VOTING_POWER',
  INVALID_EVERMARK: 'INVALID_EVERMARK',
  CYCLE_ENDED: 'CYCLE_ENDED',
  ALREADY_VOTED: 'ALREADY_VOTED',
  AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SELF_VOTE_ATTEMPTED: 'SELF_VOTE_ATTEMPTED',
  NO_VOTES_TO_UNDELEGATE: 'NO_VOTES_TO_UNDELEGATE',
} as const;

export type VotingErrorCode = typeof VOTING_ERRORS[keyof typeof VOTING_ERRORS];

// Component prop types
export interface VotingPanelProps {
  evermarkId: string;
  isOwner?: boolean;
  showHistory?: boolean;
  className?: string;
}

export interface DelegateButtonProps {
  evermarkId: string;
  isOwner?: boolean;
  variant?: 'default' | 'compact' | 'icon';
  className?: string;
  onSuccess?: (transaction: VotingTransaction) => void;
}

export interface VotingHistoryProps {
  userAddress?: string;
  cycleFilter?: number;
  evermarkFilter?: string;
  limit?: number;
  className?: string;
}

// Event types for state management
export type VotingEvent = 
  | { type: 'DELEGATION_INITIATED'; evermarkId: string; amount: bigint }
  | { type: 'DELEGATION_CONFIRMED'; evermarkId: string; amount: bigint; hash: string }
  | { type: 'DELEGATION_FAILED'; evermarkId: string; error: VotingError }
  | { type: 'UNDELEGATION_INITIATED'; evermarkId: string; amount: bigint }
  | { type: 'UNDELEGATION_CONFIRMED'; evermarkId: string; amount: bigint; hash: string }
  | { type: 'UNDELEGATION_FAILED'; evermarkId: string; error: VotingError }
  | { type: 'CYCLE_STARTED'; cycle: VotingCycle }
  | { type: 'CYCLE_ENDED'; cycle: VotingCycle }
  | { type: 'VOTING_POWER_UPDATED'; newPower: VotingPower }
  | { type: 'DATA_REFRESHED'; timestamp: number }
  | { type: 'ERROR_CLEARED' }
  | { type: 'SUCCESS_CLEARED' };

// Analytics and tracking types
export interface VotingAnalytics {
  userId?: string;
  sessionId: string;
  timestamp: number;
  action: 'delegate' | 'undelegate' | 'batch_delegate';
  evermarkId?: string;
  amount?: bigint;
  cycle: number;
  success: boolean;
  errorCode?: string;
  transactionHash?: string;
  gasUsed?: bigint;
}

// API response types
export interface VotingAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Leaderboard integration types
export interface EvermarkRanking {
  evermarkId: string;
  rank: number;
  totalVotes: bigint;
  voteCount: number;
  percentageOfTotal: number;
  trending: 'up' | 'down' | 'stable';
}

export interface LeaderboardEntry {
  evermarkId: string;
  votes: bigint;
  rank: number;
  previousRank?: number;
  creatorAddress: string;
  metadata?: {
    title?: string;
    url?: string;
    description?: string;
  };
}

// Batch voting types
export interface BatchVotingRequest {
  delegations: Array<{
    evermarkId: string;
    amount: bigint;
  }>;
  totalAmount: bigint;
  estimatedGas: bigint;
}

export interface BatchVotingResult {
  success: boolean;
  transactionHash?: string;
  successfulDelegations: string[];
  failedDelegations: Array<{
    evermarkId: string;
    error: string;
  }>;
  totalGasUsed?: bigint;
}

// Voting strategy types
export interface VotingStrategy {
  name: string;
  description: string;
  allocateVotes: (
    availablePower: bigint,
    evermarks: string[],
    userPreferences?: Record<string, any>
  ) => Record<string, bigint>;
}

// Notification types
export interface VotingNotification {
  id: string;
  type: 'delegation_success' | 'cycle_ending' | 'voting_power_updated' | 'ranking_changed';
  title: string;
  message: string;
  evermarkId?: string;
  amount?: bigint;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

// Performance metrics
export interface VotingPerformanceMetrics {
  averageTransactionTime: number;
  successRate: number;
  gasEfficiency: number;
  userEngagement: number;
  cycleParticipation: number;
}

// Feature flags
export interface VotingFeatureFlags {
  enableBatchVoting: boolean;
  enableVotingAnalytics: boolean;
  enableAutoRefresh: boolean;
  enableNotifications: boolean;
  enableAdvancedStats: boolean;
  enableVotingStrategies: boolean;
  enableCyclePreview: boolean;
}

// Theme and styling
export interface VotingTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    active: string;
    inactive: string;
  };
  animations: {
    enableVoteAnimations: boolean;
    enableCounterAnimations: boolean;
    transitionDuration: number;
  };
  spacing: {
    buttonPadding: string;
    panelPadding: string;
    itemSpacing: string;
  };
}