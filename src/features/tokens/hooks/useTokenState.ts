// src/features/tokens/hooks/useTokenState.ts - Cleaner approach without conditional params

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSendTransaction } from 'thirdweb/react';
import { useActiveAccount } from 'thirdweb/react';
import { prepareContractCall, getContract, readContract } from 'thirdweb';
import { client } from '@/lib/thirdweb';
import { base } from 'thirdweb/chains';

// Local contract constants to avoid @/lib/contracts dependency
const CHAIN = base;
const LOCAL_CONTRACTS = {
  EMARK_TOKEN: import.meta.env.VITE_EMARK_ADDRESS || '',
  WEMARK_STAKING: import.meta.env.VITE_WEMARK_ADDRESS || '', // Using WEMARK as the EMARK staking contract
} as const;

// Import ABIs from the actual JSON files
import EMARK_ABI from '@/features/tokens/abis/EMARK.json';

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
 * Uses React Query for all contract reads to avoid thirdweb useReadContract params issues
 */
export function useTokenState(): UseTokenStateReturn {
  // State
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  
  // Wallet and contracts
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  const { mutateAsync: sendTransaction } = useSendTransaction();
  
  // Contract instances with proper error handling
  const emarkToken = useMemo(() => {
    try {
      return getContract({
        client,
        chain: CHAIN,
        address: LOCAL_CONTRACTS.EMARK_TOKEN,
        abi: EMARK_ABI as any
      });
    } catch (error) {
      if (!LOCAL_CONTRACTS.EMARK_TOKEN) {
        console.warn('[EVERMARK BETA] EMARK token address not configured. Staking features disabled.');
      } else {
        console.error('[EVERMARK BETA] Failed to create EMARK token contract:', error);
      }
      return null;
    }
  }, []);
  
  const userAddress = account?.address;
  const isConnected = !!account && !!userAddress;
  const stakingContractAddress = LOCAL_CONTRACTS.WEMARK_STAKING;

  // Token balance query using React Query + readContract
  const { 
    data: emarkBalance, 
    isLoading: isLoadingBalance,
    error: balanceError,
    refetch: refetchBalance
  } = useQuery({
    queryKey: QUERY_KEYS.tokenBalance(userAddress),
    queryFn: async () => {
      if (!emarkToken || !userAddress) {
        return BigInt(0);
      }

      try {
        const balance = await readContract({
          contract: emarkToken,
          method: "function balanceOf(address) view returns (uint256)",
          params: [userAddress]
        });
        return balance;
      } catch (error) {
        console.error('Error reading token balance:', error);
        return BigInt(0);
      }
    },
    enabled: !!emarkToken && !!userAddress,
    refetchInterval: 15000,
    retry: 3
  });

  // Token allowance query using React Query + readContract
  const { 
    data: stakingAllowance, 
    isLoading: isLoadingAllowance,
    error: allowanceError,
    refetch: refetchAllowance
  } = useQuery({
    queryKey: QUERY_KEYS.tokenAllowance(userAddress, stakingContractAddress),
    queryFn: async () => {
      if (!emarkToken || !userAddress || !stakingContractAddress) {
        return BigInt(0);
      }

      try {
        const allowance = await readContract({
          contract: emarkToken,
          method: "function allowance(address owner, address spender) view returns (uint256)",
          params: [userAddress, stakingContractAddress]
        });
        return allowance;
      } catch (error) {
        console.error('Error reading token allowance:', error);
        return BigInt(0);
      }
    },
    enabled: !!emarkToken && !!userAddress && !!stakingContractAddress,
    refetchInterval: 15000,
    retry: 3
  });

  // Token info query
  const { 
    data: tokenInfoData,
    isLoading: isLoadingTokenInfo,
    error: tokenInfoError
  } = useQuery({
    queryKey: QUERY_KEYS.tokenInfo(LOCAL_CONTRACTS.EMARK_TOKEN),
    queryFn: async () => {
      return TokenService.createDefaultTokenInfo(LOCAL_CONTRACTS.EMARK_TOKEN);
    },
    enabled: !!LOCAL_CONTRACTS.EMARK_TOKEN,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Approval mutation with proper error handling
  const approvalMutation = useMutation({
    mutationFn: async ({ spender, amount }: { spender: string; amount: bigint }) => {
      if (!account) {
        throw TokenService.createError(
          TOKEN_ERRORS.WALLET_NOT_CONNECTED,
          'Please connect your wallet first'
        );
      }

      if (!emarkToken) {
        throw TokenService.createError(
          TOKEN_ERRORS.CONTRACT_ERROR,
          'Token contract not available'
        );
      }

      setApprovalError(null);
      setIsApproving(true);

      try {
        // Prepare approval transaction with proper method signature
        const transaction = prepareContractCall({
          contract: emarkToken,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [spender, amount]
        });

        // Send transaction
        const result = await sendTransaction(transaction);

        return {
          success: true,
          hash: result.transactionHash
        } as const;
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

  // Computed values with proper null checks
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

  // Error handling with proper fallbacks
  const error = useMemo(() => {
    if (balanceError) return 'Failed to load token balance';
    if (allowanceError) return 'Failed to load token allowance';
    if (tokenInfoError) return 'Failed to load token information';
    if (!emarkToken) return 'Token contract not available';
    return null;
  }, [balanceError, allowanceError, tokenInfoError, emarkToken]);

  const isLoading = isLoadingBalance || isLoadingAllowance || isLoadingTokenInfo;

  // Action creators with proper error handling
  const approveForStaking = useCallback(async (amount?: bigint): Promise<TokenApprovalResult> => {
    if (!isConnected) {
      const error = TokenService.createError(
        TOKEN_ERRORS.WALLET_NOT_CONNECTED,
        'Please connect your wallet first'
      );
      return { 
        success: false, 
        error: TokenService.getUserFriendlyError(error) 
      } as const;
    }

    if (!tokenBalance) {
      return { 
        success: false, 
        error: 'Token balance not loaded' 
      } as const;
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
        return { 
          success: false, 
          error: validation.errors[0] || 'Validation failed' 
        } as const;
      }

      const result = await approvalMutation.mutateAsync({
        spender: stakingContractAddress,
        amount: approvalAmount
      });

      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Approval failed';
      return { 
        success: false, 
        error: errorMessage
      } as const;
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
      // Return cached value if it's the staking contract
      if (spender === stakingContractAddress) {
        return stakingAllowance || BigInt(0);
      }

      // For other spenders, make a fresh contract call
      if (emarkToken) {
        const allowance = await readContract({
          contract: emarkToken,
          method: "function allowance(address owner, address spender) view returns (uint256)",
          params: [userAddress, spender]
        });
        return allowance;
      }

      return BigInt(0);
    } catch (error) {
      console.error('Error checking allowance:', error);
      return BigInt(0);
    }
  }, [userAddress, stakingContractAddress, stakingAllowance, emarkToken]);

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