// features/tokens/hooks/useTokenState.ts - Main state management hook for tokens feature

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReadContract } from 'thirdweb/react';
import { useActiveAccount } from 'thirdweb/react';
import { prepareContractCall, sendTransaction } from 'thirdweb';
import { getContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { CHAIN, CONTRACTS } from '@/lib/contracts';
import { EMARK_TOKEN_ABI, CARD_CATALOG_ABI } from '@/lib/abis';
import { TokenService } from '../services/TokenService';
import {
  type TokenBalance,
  type TokenInfo,
  type TokenValidation,
  type TokenApprovalResult,
  type UseTokenStateReturn,
  type TokenError,
  TOKEN_CONSTANTS,
  TOKEN_ERRORS
} from '../types';

// Query keys for React Query
const QUERY_KEYS = {
  tokenBalance: (address?: string) => ['token', 'balance', address],
  tokenAllowance: (owner?: string, spender?: string) => ['token', 'allowance', owner, spender],
  tokenInfo: (address: string) => ['token', 'info', address],
} as const;

/**
 * Main state management hook for Tokens feature
 * Handles balance queries, allowances, approvals, and validation
 */
export function useTokenState(): UseTokenStateReturn {
  // State
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  
  // Wallet and contracts
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  
  // Contract instances
  const emarkToken = useMemo(() => getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.EMARK_TOKEN,
    abi: EMARK_TOKEN_ABI
  }), []);

  const cardCatalog = useMemo(() => getContract({
    client,
    chain: CHAIN,
    address: CONTRACTS.CARD_CATALOG,
    abi: CARD_CATALOG_ABI
  }), []);
  
  const userAddress = account?.address;
  const isConnected = !!account && !!userAddress;
  const stakingContractAddress = CONTRACTS.CARD_CATALOG;

  // Token balance query
  const { 
    data: emarkBalance, 
    isLoading: isLoadingBalance,
    error: balanceError,
    refetch: refetchBalance
  } = useReadContract({
    contract: emarkToken,
    method: "function balanceOf(address) view returns (uint256)",
    params: userAddress ? [userAddress] : undefined,
  });

  // Token allowance query (for staking contract)
  const { 
    data: stakingAllowance, 
    isLoading: isLoadingAllowance,
    error: allowanceError,
    refetch: refetchAllowance
  } = useReadContract({
    contract: emarkToken,
    method: "function allowance(address owner, address spender) view returns (uint256)",
    params: userAddress ? [userAddress, stakingContractAddress] : undefined,
  });

  // Token info query
  const { 
    data: tokenInfoData,
    isLoading: isLoadingTokenInfo
  } = useQuery({
    queryKey: QUERY_KEYS.tokenInfo(CONTRACTS.EMARK_TOKEN),
    queryFn: async () => {
      // In a real implementation, you might fetch this from the contract
      // For now, return static info
      return TokenService.createDefaultTokenInfo(CONTRACTS.EMARK_TOKEN, userAddress || '');
    },
    enabled: !!CONTRACTS.EMARK_TOKEN,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Approval mutation
  const approvalMutation = useMutation({
    mutationFn: async ({ spender, amount }: { spender: string; amount: bigint }) => {
      if (!account) {
        throw TokenService.createError(
          TOKEN_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      setApprovalError(null);
      setIsApproving(true);

      try {
        // Prepare approval transaction
        const transaction = prepareContractCall({
          contract: emarkToken,
          method: "function approve(address spender, uint256 amount)",
          params: [spender, amount]
        });

        // Send transaction
        const result = await sendTransaction({
          transaction,
          account
        });

        return {
          success: true,
          hash: result.transactionHash
        };
      } catch (error: any) {
        console.error('Approval failed:', error);
        const tokenError = TokenService.parseContractError(error);
        throw tokenError;
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.tokenAllowance(userAddress, stakingContractAddress) 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.tokenBalance(userAddress) 
      });
    },
    onError: (error: TokenError) => {
      setApprovalError(TokenService.getUserFriendlyError(error));
    },
    onSettled: () => {
      setIsApproving(false);
    }
  });

  // Computed values
  const tokenBalance: TokenBalance | null = useMemo(() => {
    if (!isConnected || emarkBalance === undefined || stakingAllowance === undefined) {
      return null;
    }

    return TokenService.calculateTokenBalance(
      emarkBalance || BigInt(0),
      stakingAllowance || BigInt(0)
    );
  }, [isConnected, emarkBalance, stakingAllowance]);

  const tokenInfo: TokenInfo | null = useMemo(() => {
    if (!tokenInfoData || !userAddress) return null;

    return {
      ...tokenInfoData,
      userBalance: emarkBalance || BigInt(0),
      userAllowances: {
        [stakingContractAddress]: stakingAllowance || BigInt(0)
      }
    };
  }, [tokenInfoData, userAddress, emarkBalance, stakingAllowance, stakingContractAddress]);

  const error = useMemo(() => {
    if (balanceError) return 'Failed to load token balance';
    if (allowanceError) return 'Failed to load token allowance';
    return null;
  }, [balanceError, allowanceError]);

  const isLoading = isLoadingBalance || isLoadingAllowance || isLoadingTokenInfo;

  // Action creators
  const approveForStaking = useCallback(async (amount?: bigint): Promise<TokenApprovalResult> => {
    if (!isConnected) {
      const error = TokenService.createError(
        TOKEN_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
      return { success: false, error: TokenService.getUserFriendlyError(error) };
    }

    if (!tokenBalance) {
      return { success: false, error: 'Token balance not loaded' };
    }

    try {
      // Use provided amount or calculate optimal amount
      const approvalAmount = amount || TokenService.calculateApprovalAmount(
        tokenBalance.emarkBalance,
        false // Don't use unlimited by default
      );

      // Validate approval
      const validation = TokenService.validateApprovalParams({
        spender: stakingContractAddress,
        amount: approvalAmount
      });

      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const result = await approvalMutation.mutateAsync({
        spender: stakingContractAddress,
        amount: approvalAmount
      });

      return result;
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message || 'Approval failed' 
      };
    }
  }, [isConnected, tokenBalance, stakingContractAddress, approvalMutation]);

  const approveUnlimited = useCallback(async (): Promise<TokenApprovalResult> => {
    return approveForStaking(TOKEN_CONSTANTS.MAX_UINT256);
  }, [approveForStaking]);

  const checkAllowance = useCallback(async (spender: string): Promise<bigint> => {
    if (!userAddress || !TokenService.isValidAddress(spender)) {
      return BigInt(0);
    }

    try {
      // This would typically make a contract call
      // For now, return cached value if it's the staking contract
      if (spender === stakingContractAddress) {
        return stakingAllowance || BigInt(0);
      }

      // For other spenders, would need to make a new contract call
      return BigInt(0);
    } catch (error) {
      console.error('Error checking allowance:', error);
      return BigInt(0);
    }
  }, [userAddress, stakingContractAddress, stakingAllowance]);

  // Utility functions
  const formatTokenAmount = useCallback((amount: bigint, decimals = 2): string => {
    return TokenService.formatTokenAmount(amount, decimals);
  }, []);

  const parseTokenAmount = useCallback((amount: string): bigint => {
    return TokenService.parseTokenAmount(amount);
  }, []);

  const validateAmount = useCallback((amount: string, maxAmount?: bigint): TokenValidation => {
    return TokenService.validateTokenAmount(amount, maxAmount);
  }, []);

  const needsApproval = useCallback((amount: bigint, spender?: string): boolean => {
    const relevantSpender = spender || stakingContractAddress;
    const currentAllowance = relevantSpender === stakingContractAddress 
      ? (stakingAllowance || BigInt(0))
      : BigInt(0);
    
    return TokenService.needsApproval(amount, currentAllowance);
  }, [stakingContractAddress, stakingAllowance]);

  // State management functions
  const refetch = useCallback(async (): Promise<void> => {
    await Promise.all([
      refetchBalance(),
      refetchAllowance()
    ]);
  }, [refetchBalance, refetchAllowance]);

  const clearErrors = useCallback(() => {
    setApprovalError(null);
    approvalMutation.reset();
  }, [approvalMutation]);

  return {
    // Data
    tokenInfo,
    tokenBalance,
    
    // Loading states
    isLoading,
    isApproving,
    isTransacting: approvalMutation.isPending,
    
    // Error states
    error,
    approvalError,
    
    // Actions
    approveForStaking,
    approveUnlimited,
    checkAllowance,
    
    // Utilities
    formatTokenAmount,
    parseTokenAmount,
    validateAmount,
    needsApproval,
    
    // State management
    refetch,
    clearErrors,
    
    // Connection status
    isConnected,
    userAddress
  };
}