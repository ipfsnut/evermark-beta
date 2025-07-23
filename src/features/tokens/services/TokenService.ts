// features/tokens/services/TokenService.ts - Business logic for token operations

import { formatUnits, parseUnits } from 'viem';
import { 
  type TokenBalance,
  type TokenInfo,
  type TokenValidation,
  type TokenApprovalParams,
  type TokenError,
  type TokenErrorCode,
  type TokenDisplayInfo,
  TOKEN_CONSTANTS,
  TOKEN_ERRORS
} from '../types';

/**
 * TokenService - Core business logic for $EMARK token operations
 * Handles balance queries, allowances, approvals, and validation
 */
export class TokenService {
  
  /**
   * Format token amount for display
   */
  static formatTokenAmount(amount: bigint, decimals = 2): string {
    try {
      if (amount === BigInt(0)) return '0';
      
      const formatted = formatUnits(amount, TOKEN_CONSTANTS.DECIMALS);
      const number = parseFloat(formatted);
      
      // Handle very small amounts
      if (number < 0.001 && number > 0) {
        return '< 0.001';
      }
      
      // Handle large amounts with appropriate formatting
      if (number >= 1000000) {
        return `${(number / 1000000).toFixed(decimals)}M`;
      } else if (number >= 1000) {
        return `${(number / 1000).toFixed(decimals)}K`;
      }
      
      // Round to specified decimals
      return number.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      });
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  }

  /**
   * Parse user input to token amount in wei
   */
  static parseTokenAmount(amount: string): bigint {
    try {
      if (!amount || amount.trim() === '') {
        return BigInt(0);
      }
      
      // Clean the input
      const cleanAmount = amount.trim().replace(/,/g, '');
      
      // Validate format
      if (!/^\d*\.?\d*$/.test(cleanAmount)) {
        throw new Error('Invalid number format');
      }
      
      return parseUnits(cleanAmount, TOKEN_CONSTANTS.DECIMALS);
    } catch (error) {
      console.error('Error parsing token amount:', error);
      throw new Error('Invalid amount format');
    }
  }

  /**
   * Validate token amount input
   */
  static validateTokenAmount(
    amount: string,
    maxAmount?: bigint,
    minAmount = TOKEN_CONSTANTS.MIN_APPROVAL_AMOUNT
  ): TokenValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!amount || amount.trim() === '') {
      errors.push('Amount is required');
      return { isValid: false, errors, warnings };
    }

    try {
      const parsedAmount = this.parseTokenAmount(amount);
      
      // Check minimum amount
      if (parsedAmount < minAmount) {
        errors.push(`Amount must be at least ${this.formatTokenAmount(minAmount)} EMARK`);
      }
      
      // Check maximum amount
      if (maxAmount && parsedAmount > maxAmount) {
        errors.push(`Amount exceeds available balance of ${this.formatTokenAmount(maxAmount)} EMARK`);
      }
      
      // Check for zero amount
      if (parsedAmount === BigInt(0)) {
        errors.push('Amount must be greater than zero');
      }
      
      // Warnings for large amounts
      if (maxAmount && parsedAmount > maxAmount / BigInt(2)) {
        warnings.push('You are using more than 50% of your balance');
      }
      
      // Warning for very large approvals
      if (parsedAmount > TOKEN_CONSTANTS.DEFAULT_APPROVAL_AMOUNT) {
        warnings.push('This is a large approval amount');
      }
      
    } catch (error) {
      errors.push('Invalid amount format');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate token balance info
   */
  static calculateTokenBalance(
    emarkBalance: bigint,
    allowanceForStaking: bigint
  ): TokenBalance {
    return {
      emarkBalance,
      allowanceForStaking,
      formattedBalance: this.formatTokenAmount(emarkBalance, 4),
      formattedAllowance: this.formatTokenAmount(allowanceForStaking, 4),
      hasBalance: emarkBalance > BigInt(0),
      hasAllowance: allowanceForStaking > BigInt(0),
      canStake: emarkBalance > BigInt(0) && allowanceForStaking > BigInt(0)
    };
  }

  /**
   * Check if approval is needed for an amount
   */
  static needsApproval(amount: bigint, currentAllowance: bigint): boolean {
    return currentAllowance < amount;
  }

  /**
   * Calculate optimal approval amount
   */
  static calculateApprovalAmount(
    requestedAmount: bigint,
    useUnlimited = false
  ): bigint {
    if (useUnlimited) {
      return TOKEN_CONSTANTS.MAX_UINT256;
    }
    
    // Use requested amount or default minimum, whichever is larger
    const minApproval = TOKEN_CONSTANTS.DEFAULT_APPROVAL_AMOUNT;
    return requestedAmount > minApproval ? requestedAmount : minApproval;
  }

  /**
   * Create token display info
   */
  static createTokenDisplayInfo(): TokenDisplayInfo {
    return {
      name: 'Evermark Token',
      symbol: 'EMARK',
      description: 'Governance token for the Evermark protocol',
      displayDecimals: 2,
      priceDecimals: 4,
      showInWallet: true,
      iconColor: '#8B5CF6' // Purple from theme
    };
  }

  /**
   * Create standardized error
   */
  static createError(
    code: TokenErrorCode,
    message: string,
    details?: Record<string, any>
  ): TokenError {
    return {
      code,
      message,
      details,
      timestamp: Date.now(),
      recoverable: this.isRecoverableError(code)
    };
  }

  /**
   * Check if an error is recoverable
   */
  private static isRecoverableError(code: TokenErrorCode): boolean {
    const recoverableErrors = new Set<TokenErrorCode>([
  "TRANSACTION_FAILED",
  "NETWORK_ERROR", 
  "APPROVAL_FAILED"
]);
    return recoverableErrors.has(code);
  }

  /**
   * Parse contract error into user-friendly message
   */
  static parseContractError(error: any): TokenError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Common error patterns
    if (errorMessage.includes('insufficient allowance')) {
      return this.createError(
        TOKEN_ERRORS.INSUFFICIENT_ALLOWANCE,
        'Token allowance insufficient for this transaction'
      );
    }
    
    if (errorMessage.includes('insufficient balance')) {
      return this.createError(
        TOKEN_ERRORS.INSUFFICIENT_BALANCE,
        'Insufficient EMARK balance for this transaction'
      );
    }
    
    if (errorMessage.includes('user rejected')) {
      return this.createError(
        TOKEN_ERRORS.TRANSACTION_FAILED,
        'Transaction was rejected by user'
      );
    }
    
    if (errorMessage.includes('network')) {
      return this.createError(
        TOKEN_ERRORS.NETWORK_ERROR,
        'Network error occurred. Please try again.'
      );
    }
    
    // Generic contract error
    return this.createError(
      TOKEN_ERRORS.CONTRACT_ERROR,
      `Contract error: ${errorMessage.substring(0, 100)}...`,
      { originalError: errorMessage }
    );
  }

  /**
   * Validate approval parameters
   */
  static validateApprovalParams(params: TokenApprovalParams): TokenValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.spender || params.spender.length !== 42 || !params.spender.startsWith('0x')) {
      errors.push('Invalid spender address');
    }

    if (params.amount < BigInt(0)) {
      errors.push('Amount cannot be negative');
    }

    if (params.isUnlimited && params.amount !== TOKEN_CONSTANTS.MAX_UINT256) {
      warnings.push('Unlimited approval requested but amount is not MAX_UINT256');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get approval transaction summary
   */
  static getApprovalSummary(
spender: string, amount: bigint, isUnlimited = false  ): {
    title: string;
    description: string;
    amount: string;
    risk: 'low' | 'medium' | 'high';
    recommendations: string[];
  } {
    const formattedAmount = isUnlimited ? 'Unlimited' : this.formatTokenAmount(amount);
    
    const summary = {
      title: isUnlimited ? 'Unlimited Token Approval' : 'Token Approval',
      description: `Allow the contract to spend ${formattedAmount} EMARK tokens on your behalf`,
      amount: formattedAmount,
      risk: isUnlimited ? 'high' as const : 'low' as const,
      recommendations: [] as string[]
    };

    if (isUnlimited) {
      summary.recommendations.push('Consider approving only the amount you need');
      summary.recommendations.push('You can revoke this approval later if needed');
    } else {
      summary.recommendations.push('This approval is limited to the specified amount');
      summary.recommendations.push('You may need to approve again for future transactions');
    }

    return summary;
  }

  /**
   * Calculate gas estimation for approval
   */
  static estimateApprovalGas(): {
    gasLimit: bigint;
    estimatedCost: string;
  } {
    // Standard ERC20 approval gas limit
    const gasLimit = BigInt(60000);
    
    return {
      gasLimit,
      estimatedCost: '~$0.50 USD' // Mock estimation
    };
  }

  /**
   * Format approval status for display
   */
  static formatApprovalStatus(
    currentAllowance: bigint,
    requestedAmount?: bigint
  ): {
    status: 'sufficient' | 'insufficient' | 'none';
    message: string;
    actionRequired: boolean;
  } {
    if (currentAllowance === BigInt(0)) {
      return {
        status: 'none',
        message: 'No approval set',
        actionRequired: true
      };
    }

    if (requestedAmount && currentAllowance < requestedAmount) {
      return {
        status: 'insufficient',
        message: `Current approval: ${this.formatTokenAmount(currentAllowance)} EMARK`,
        actionRequired: true
      };
    }

    return {
      status: 'sufficient',
      message: `Current approval: ${this.formatTokenAmount(currentAllowance)} EMARK`,
      actionRequired: false
    };
  }

  /**
   * Get recommended approval strategy
   */
  static getApprovalStrategy(
    requestedAmount: bigint,
    userBalance: bigint,
    transactionFrequency: 'low' | 'medium' | 'high' = 'medium'
  ): {
    strategy: 'exact' | 'buffer' | 'unlimited';
    amount: bigint;
    reasoning: string;
  } {
    // For high frequency users, recommend unlimited
    if (transactionFrequency === 'high') {
      return {
        strategy: 'unlimited',
        amount: TOKEN_CONSTANTS.MAX_UINT256,
        reasoning: 'Unlimited approval recommended for frequent transactions'
      };
    }

    // For large amounts relative to balance, use exact
    if (requestedAmount > userBalance / BigInt(2)) {
      return {
        strategy: 'exact',
        amount: requestedAmount,
        reasoning: 'Exact approval for security when using large portion of balance'
      };
    }

    // Default to buffer strategy
    const bufferAmount = requestedAmount * BigInt(2); // 2x buffer
    return {
      strategy: 'buffer',
      amount: bufferAmount,
      reasoning: 'Approval with buffer to reduce future transaction costs'
    };
  }

  /**
   * Check token compatibility
   */
  static checkTokenCompatibility(tokenAddress: string): {
    isCompatible: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Basic address validation
    if (!tokenAddress || tokenAddress.length !== 42 || !tokenAddress.startsWith('0x')) {
      issues.push('Invalid token contract address');
    }

    // In a real implementation, you might check:
    // - Contract exists
    // - Implements ERC20 interface
    // - Has expected methods
    // - Security audit status

    return {
      isCompatible: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Format transaction receipt for display
   */
  static formatTransactionReceipt(receipt: any): {
    status: 'success' | 'failed';
    hash: string;
    gasUsed: string;
    gasPrice?: string;
    totalCost?: string;
    blockNumber: number;
    confirmations: number;
  } {
    return {
      status: receipt.status === 1 ? 'success' : 'failed',
      hash: receipt.transactionHash,
      gasUsed: receipt.gasUsed ? this.formatTokenAmount(BigInt(receipt.gasUsed), 0) : 'Unknown',
      blockNumber: receipt.blockNumber || 0,
      confirmations: receipt.confirmations || 0
    };
  }

  /**
   * Generate approval transaction data
   */
  static generateApprovalData(spender: string): {
    to: string;
    data: string;
    value: bigint;
  } {
    // This would generate the actual transaction data for ERC20 approve
    // For now, return structure that would be used
    return {
      to: spender,
      data: '0x', // Would be encoded approve function call
      value: BigInt(0)
    };
  }

  /**
   * Calculate token metrics for analytics
   */
  static calculateTokenMetrics(
    totalSupply: bigint,
    userBalance: bigint,
    stakingContractBalance: bigint
  ): {
    userPercentage: number;
    stakingPercentage: number;
    circulatingSupply: bigint;
    stakingRatio: number;
  } {
    const totalSupplyNumber = Number(formatUnits(totalSupply, TOKEN_CONSTANTS.DECIMALS));
    const userBalanceNumber = Number(formatUnits(userBalance, TOKEN_CONSTANTS.DECIMALS));
    const stakingBalanceNumber = Number(formatUnits(stakingContractBalance, TOKEN_CONSTANTS.DECIMALS));

    return {
      userPercentage: totalSupplyNumber > 0 ? (userBalanceNumber / totalSupplyNumber) * 100 : 0,
      stakingPercentage: totalSupplyNumber > 0 ? (stakingBalanceNumber / totalSupplyNumber) * 100 : 0,
      circulatingSupply: totalSupply - stakingContractBalance,
      stakingRatio: totalSupplyNumber > 0 ? stakingBalanceNumber / totalSupplyNumber : 0
    };
  }

  /**
   * Helper to create default token info
   */
  static createDefaultTokenInfo(address: string): TokenInfo {
    return {
      address,
      name: 'Evermark Token',
      symbol: 'EMARK',
      decimals: TOKEN_CONSTANTS.DECIMALS,
      userBalance: BigInt(0),
      userAllowances: {}
    };
  }

  /**
   * Validate contract address format
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyError(error: TokenError): string {
    switch (error.code) {
      case TOKEN_ERRORS.WALLET_NOT_CONNECTED:
        return 'Please connect your wallet to continue';
      case TOKEN_ERRORS.INSUFFICIENT_BALANCE:
        return 'You don\'t have enough EMARK tokens for this transaction';
      case TOKEN_ERRORS.INSUFFICIENT_ALLOWANCE:
        return 'Please approve EMARK tokens for spending first';
      case TOKEN_ERRORS.INVALID_AMOUNT:
        return 'Please enter a valid amount';
      case TOKEN_ERRORS.APPROVAL_FAILED:
        return 'Token approval failed. Please try again';
      case TOKEN_ERRORS.TRANSACTION_FAILED:
        return 'Transaction failed. Please check your wallet and try again';
      case TOKEN_ERRORS.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again';
      default:
        return error.message || 'An unexpected error occurred';
    }
  }
}