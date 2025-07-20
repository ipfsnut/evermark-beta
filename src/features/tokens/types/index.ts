// features/tokens/types/index.ts - Type definitions for the Tokens feature

export interface TokenBalance {
  // Raw balance values (wei)
  emarkBalance: bigint;
  allowanceForStaking: bigint;
  
  // Formatted display values
  formattedBalance: string;
  formattedAllowance: string;
  
  // Helper properties
  hasBalance: boolean;
  hasAllowance: boolean;
  canStake: boolean;
}

export interface TokenInfo {
  // Contract details
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  
  // Supply information
  totalSupply?: bigint;
  
  // User-specific data
  userBalance: bigint;
  userAllowances: Record<string, bigint>; // spender address -> allowance
}

export interface TokenTransaction {
  type: 'approve' | 'transfer' | 'stake' | 'unstake';
  hash: string;
  amount: bigint;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: bigint;
  gasPrice?: bigint;
  error?: string;
}

export interface TokenValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TokenApprovalParams {
  spender: string;
  amount: bigint;
  isUnlimited?: boolean;
}

export interface TokenApprovalResult {
  success: boolean;
  hash?: string;
  error?: string;
}

// Hook return type
export interface UseTokenStateReturn {
  // Data
  tokenInfo: TokenInfo | null;
  tokenBalance: TokenBalance | null;
  
  // Loading states
  isLoading: boolean;
  isApproving: boolean;
  isTransacting: boolean;
  
  // Error states
  error: string | null;
  approvalError: string | null;
  
  // Actions
  approveForStaking: (amount?: bigint) => Promise<TokenApprovalResult>;
  approveUnlimited: () => Promise<TokenApprovalResult>;
  checkAllowance: (spender: string) => Promise<bigint>;
  
  // Utilities
  formatTokenAmount: (amount: bigint, decimals?: number) => string;
  parseTokenAmount: (amount: string) => bigint;
  validateAmount: (amount: string, maxAmount?: bigint) => TokenValidation;
  needsApproval: (amount: bigint, spender?: string) => boolean;
  
  // State management
  refetch: () => Promise<void>;
  clearErrors: () => void;
  
  // Connection status
  isConnected: boolean;
  userAddress: string | undefined;
}

// Service layer types
export interface TokenServiceParams {
  userAddress: string;
  tokenAddress: string;
  stakingContractAddress: string;
}

export interface TokenContractCall {
  contractAddress: string;
  functionName: string;
  params: any[];
  value?: bigint;
}

// Configuration and constants
export const TOKEN_CONSTANTS = {
  DECIMALS: 18,
  MAX_UINT256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  DEFAULT_APPROVAL_AMOUNT: BigInt('1000000000000000000000000'), // 1M tokens
  MIN_APPROVAL_AMOUNT: BigInt('1000000000000000000'), // 1 token
  TRANSACTION_TIMEOUT: 60000, // 60 seconds
  RETRY_ATTEMPTS: 3,
  CACHE_DURATION: 30000, // 30 seconds
  REFRESH_INTERVAL: 15000, // 15 seconds for real-time updates
} as const;

export const TOKEN_ERRORS = {
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE: 'INSUFFICIENT_ALLOWANCE',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  APPROVAL_FAILED: 'APPROVAL_FAILED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',
} as const;

export type TokenErrorCode = typeof TOKEN_ERRORS[keyof typeof TOKEN_ERRORS];

export interface TokenError {
  code: TokenErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
  recoverable: boolean;
}

// Event types for state management
export type TokenEvent = 
  | { type: 'APPROVAL_INITIATED'; spender: string; amount: bigint }
  | { type: 'APPROVAL_CONFIRMED'; spender: string; amount: bigint; hash: string }
  | { type: 'APPROVAL_FAILED'; error: TokenError }
  | { type: 'BALANCE_UPDATED'; newBalance: bigint }
  | { type: 'ALLOWANCE_UPDATED'; spender: string; newAllowance: bigint }
  | { type: 'TRANSACTION_INITIATED'; type: TokenTransaction['type']; amount: bigint }
  | { type: 'TRANSACTION_CONFIRMED'; hash: string }
  | { type: 'TRANSACTION_FAILED'; error: TokenError }
  | { type: 'DATA_REFRESHED'; timestamp: number }
  | { type: 'ERROR_CLEARED' };

// Approval configuration
export interface ApprovalConfig {
  useUnlimitedApproval: boolean;
  defaultApprovalAmount: bigint;
  confirmationRequired: boolean;
  gasLimit?: bigint;
}

// Token metadata for display
export interface TokenDisplayInfo {
  name: string;
  symbol: string;
  logo?: string;
  description?: string;
  website?: string;
  coinGeckoId?: string;
  
  // Display formatting
  displayDecimals: number;
  priceDecimals: number;
  
  // UI preferences
  showInWallet: boolean;
  iconColor: string;
  
  // Market data (optional)
  priceUSD?: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
}

// Batch operations
export interface BatchTokenOperation {
  operations: Array<{
    type: 'approve' | 'transfer';
    target: string;
    amount: bigint;
    params?: Record<string, any>;
  }>;
  executeSequentially: boolean;
  continueOnError: boolean;
}

export interface BatchTokenResult {
  results: Array<{
    success: boolean;
    hash?: string;
    error?: string;
  }>;
  overallSuccess: boolean;
  successCount: number;
  failureCount: number;
}