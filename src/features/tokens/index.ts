// features/tokens/index.ts - Public API exports for the Tokens feature - Fixed for Thirdweb v5

import { TokenBalance } from './components/TokenBalance';
import { RewardsClaiming } from './components/RewardsClaiming';
import { useTokenState } from './hooks/useTokenState';
import { TokenService } from './services/TokenService';
import { RewardsService } from './services/RewardsService';
import { TOKEN_CONSTANTS, TokenApprovalParams, TokenDisplayInfo } from './types';

// Types - Export all public interfaces
export type {
  TokenInfo,
  TokenTransaction,
  TokenValidation,
  TokenApprovalParams,
  TokenApprovalResult,
  TokenError,
  TokenErrorCode,
  TokenDisplayInfo,
  UseTokenStateReturn,
  TokenServiceParams,
  TokenContractCall,
  ApprovalConfig,
  BatchTokenOperation,
  BatchTokenResult
} from './types';

// Constants
export { TOKEN_CONSTANTS, TOKEN_ERRORS } from './types';

// Services - Export business logic layer
export { TokenService } from './services/TokenService';
export { RewardsService } from './services/RewardsService';

// Hooks - Export main state management hook
export { useTokenState } from './hooks/useTokenState';

// Components - Export UI components
export { TokenBalance } from './components/TokenBalance';
export { RewardsClaiming } from './components/RewardsClaiming';

// Feature configuration and utilities
export const tokensConfig = {
  name: 'tokens',
  version: '1.0.0',
  description: 'EMARK token balance management and approvals',
  
  // Feature capabilities
  features: {
    balanceDisplay: true,
    approvals: true,
    allowanceChecking: true,
    realTimeUpdates: true,
    transactionTracking: true,
    errorHandling: true,
    validation: true
  },
  
  // Default configuration
  defaults: {
    refreshInterval: 15000, // 15 seconds
    transactionTimeout: 60000, // 60 seconds
    defaultDecimals: 2,
    maxDecimals: 6,
    useUnlimitedApproval: false,
    confirmationRequired: true,
    enableRealTimeUpdates: true
  },
  
  // Contract integration
  contracts: {
    emarkToken: 'EMARK_TOKEN',
    stakingContract: 'CARD_CATALOG'
  },
  
  // UI configuration
  ui: {
    defaultVariant: 'full' as const,
    showActions: true,
    showApprovalStatus: true,
    showDetails: false,
    enableCopyAddress: true,
    showExternalLinks: true
  },
  
  // Security settings
  security: {
    validateAddresses: true,
    checkContractCompatibility: true,
    requireConfirmationForLargeApprovals: true,
    warningThresholds: {
      largeApproval: '1000000', // 1M tokens
      highPercentage: 0.5 // 50% of balance
    }
  }
};

// Utility functions for external use
export const tokensUtils = {
  /**
   * Check if tokens feature is enabled
   */
  isEnabled: (): boolean => {
    return tokensConfig.features.balanceDisplay && tokensConfig.features.approvals;
  },
  
  /**
   * Format token amount for display
   */
  formatAmount: (amount: bigint, decimals = 2): string => {
    return TokenService.formatTokenAmount(amount, decimals);
  },
  
  /**
   * Parse user input to token amount
   */
  parseAmount: (amount: string): bigint => {
    return TokenService.parseTokenAmount(amount);
  },
  
  /**
   * Validate token amount input
   */
  validateAmount: (amount: string, maxAmount?: bigint): { isValid: boolean; errors: string[] } => {
    const validation = TokenService.validateTokenAmount(amount, maxAmount);
    return {
      isValid: validation.isValid,
      errors: validation.errors
    };
  },
  
  /**
   * Check if approval is needed
   */
  needsApproval: (amount: bigint, currentAllowance: bigint): boolean => {
    return TokenService.needsApproval(amount, currentAllowance);
  },
  
  /**
   * Calculate optimal approval amount
   */
  calculateApprovalAmount: (requestedAmount: bigint, useUnlimited = false): bigint => {
    return TokenService.calculateApprovalAmount(requestedAmount, useUnlimited);
  },
  
  /**
   * Get approval transaction summary
   */
  getApprovalSummary: (spender: string, amount: bigint, isUnlimited = false) => {
    return TokenService.getApprovalSummary(spender, amount, isUnlimited);
  },
  
  /**
   * Format approval status for display
   */
  formatApprovalStatus: (currentAllowance: bigint, requestedAmount?: bigint) => {
    return TokenService.formatApprovalStatus(currentAllowance, requestedAmount);
  },
  
  /**
   * Get user-friendly error message
   */
  getUserFriendlyError: (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    return 'An unexpected error occurred';
  },
  
  /**
   * Check if address is valid Ethereum address
   */
  isValidAddress: (address: string): boolean => {
    return TokenService.isValidAddress(address);
  },
  
  /**
   * Get token display information
   */
  getTokenDisplayInfo: (): TokenDisplayInfo => {
    return TokenService.createTokenDisplayInfo();
  },
  
  /**
   * Calculate token metrics
   */
  calculateMetrics: (totalSupply: bigint, userBalance: bigint, stakingBalance: bigint) => {
    return TokenService.calculateTokenMetrics(totalSupply, userBalance, stakingBalance);
  },
  
  /**
   * Get recommended approval strategy
   */
  getApprovalStrategy: (
    requestedAmount: bigint,
    userBalance: bigint,
    frequency: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    return TokenService.getApprovalStrategy(requestedAmount, userBalance, frequency);
  },
  
  /**
   * Format balance with appropriate units
   */
  formatBalanceWithUnits: (balance: bigint): string => {
    const formatted = TokenService.formatTokenAmount(balance, 18);
    return `${formatted} EMARK`;
  },
  
  /**
   * Check if amount is within safe limits
   */
  isSafeAmount: (amount: bigint, userBalance: bigint): boolean => {
    const maxSafeAmount = userBalance * BigInt(95) / BigInt(100); // 95% of balance
    return amount <= maxSafeAmount;
  },
  
  /**
   * Get gas estimation for common operations
   */
  estimateGas: (operation: 'approve' | 'transfer'): { gasLimit: bigint; estimatedCost: string } => {
    switch (operation) {
      case 'approve':
        return TokenService.estimateApprovalGas();
      case 'transfer':
        return {
          gasLimit: BigInt(21000),
          estimatedCost: '~$0.25 USD'
        };
      default:
        return {
          gasLimit: BigInt(50000),
          estimatedCost: '~$0.40 USD'
        };
    }
  },
  
  /**
   * Create approval parameters with validation
   */
  createApprovalParams: (
    spender: string,
    amount: bigint,
    isUnlimited = false
  ): TokenApprovalParams => {
    return {
      spender,
      amount: isUnlimited ? TOKEN_CONSTANTS.MAX_UINT256 : amount,
      isUnlimited
    };
  },
  
  /**
   * Check token compatibility with protocol - Fixed for thirdweb v5
   */
  checkCompatibility: (tokenAddress: string) => {
    return TokenService.checkTokenCompatibility(tokenAddress);
  }
};

// Default export for convenience
export default {
  config: tokensConfig,
  utils: tokensUtils,
  TokenService,
  useTokenState,
  TokenBalance
};