import React, { useState, useCallback } from 'react';
import { 
  GiftIcon, 
  CoinsIcon, 
  LoaderIcon, 
  CheckCircleIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  DollarSignIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveAccount } from 'thirdweb/react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import { RewardsService, type UserRewardInfo } from '../services/RewardsService';

interface RewardsClaimingProps {
  className?: string;
  userStakedAmount?: bigint;
}

export function RewardsClaiming({ className = '', userStakedAmount = BigInt(0) }: RewardsClaimingProps) {
  const { isDark } = useTheme();
  const account = useActiveAccount();
  const queryClient = useQueryClient();
  
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  // Query user reward information
  const { data: rewardInfo, isLoading, error } = useQuery({
    queryKey: ['user-rewards', account?.address],
    queryFn: async () => {
      if (!account?.address) throw new Error('No wallet connected');
      return await RewardsService.getUserRewardInfo(account.address);
    },
    enabled: !!account?.address,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Query reward rates
  const { data: rewardRates } = useQuery({
    queryKey: ['reward-rates'],
    queryFn: () => RewardsService.getRewardRates(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Query estimated daily rewards
  const { data: dailyRewards } = useQuery({
    queryKey: ['daily-rewards', userStakedAmount?.toString()],
    queryFn: () => RewardsService.calculateDailyRewards(userStakedAmount),
    enabled: userStakedAmount > BigInt(0),
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  // Claim rewards mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error('Wallet not connected');
      const result = await RewardsService.claimRewards(account);
      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }
      return result;
    },
    onSuccess: (result) => {
      // Invalidate and refetch reward queries
      queryClient.invalidateQueries({ queryKey: ['user-rewards', account?.address] });
      queryClient.invalidateQueries({ queryKey: ['reward-rates'] });
      setClaimError(null);
      setClaimSuccess(`Rewards claimed successfully! TX: ${result.txHash?.slice(0, 10)}...`);
      setTimeout(() => setClaimSuccess(null), 5000);
    },
    onError: (error: Error) => {
      setClaimError(error.message);
      setTimeout(() => setClaimError(null), 5000);
    },
  });

  const handleClaimRewards = useCallback(async () => {
    setClaimError(null);
    setClaimSuccess(null);
    await claimMutation.mutateAsync();
  }, [claimMutation]);

  if (!account) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="text-center">
          <GiftIcon className={cn(
            "mx-auto h-12 w-12 mb-4",
            isDark ? "text-gray-600" : "text-gray-400"
          )} />
          <h3 className={cn(
            "text-lg font-medium mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Rewards Center
          </h3>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Connect your wallet to view and claim your staking rewards
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="flex items-center gap-3">
          <LoaderIcon className="animate-spin h-5 w-5 text-blue-400" />
          <span className={cn(
            "text-sm",
            isDark ? "text-gray-300" : "text-gray-700"
          )}>
            Loading rewards data...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-red-900/30 border-red-500/50" 
          : "bg-red-100/80 border-red-300",
        className
      )}>
        <div className="flex items-center gap-3">
          <AlertCircleIcon className="h-5 w-5 text-red-400" />
          <span className={cn(
            "text-sm",
            isDark ? "text-red-300" : "text-red-700"
          )}>
            Failed to load rewards data
          </span>
        </div>
      </div>
    );
  }

  const hasEthRewards = rewardInfo && rewardInfo.pendingEth > BigInt(0);
  const hasEmarkRewards = rewardInfo && rewardInfo.pendingEmark > BigInt(0);
  const hasAnyRewards = hasEthRewards || hasEmarkRewards;
  const isClaiming = claimMutation.isPending;

  const formatAmount = (amount: bigint, decimals: number = 18): string => {
    return RewardsService.formatRewardAmount(amount, decimals);
  };

  return (
    <div className={cn(
      "border rounded-lg",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            hasAnyRewards 
              ? "bg-gradient-to-r from-green-400 to-cyan-400" 
              : "bg-gray-600"
          )}>
            <GiftIcon className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Dual Rewards System
            </h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Claim your ETH and EMARK staking rewards
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Messages */}
        {claimError && (
          <div className={cn(
            "p-3 rounded border flex items-start gap-2",
            isDark 
              ? "bg-red-900/30 text-red-300 border-red-500/30" 
              : "bg-red-100 text-red-700 border-red-300"
          )}>
            <AlertCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{claimError}</span>
          </div>
        )}

        {claimSuccess && (
          <div className={cn(
            "p-3 rounded border flex items-start gap-2",
            isDark 
              ? "bg-green-900/30 text-green-300 border-green-500/30" 
              : "bg-green-100 text-green-700 border-green-300"
          )}>
            <CheckCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{claimSuccess}</span>
          </div>
        )}

        {/* Pending Rewards */}
        <div className="space-y-4">
          <h4 className={cn(
            "text-sm font-medium",
            isDark ? "text-cyan-400" : "text-purple-600"
          )}>
            Available to Claim
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ETH Rewards */}
            <div className={cn(
              "p-4 rounded-lg border",
              hasEthRewards
                ? (isDark 
                    ? "bg-blue-900/30 border-blue-500/50" 
                    : "bg-blue-100/50 border-blue-300")
                : (isDark 
                    ? "bg-gray-700/30 border-gray-600" 
                    : "bg-gray-100/30 border-gray-300")
            )}>
              <div className="flex items-center gap-3 mb-2">
                <DollarSignIcon className="h-4 w-4 text-blue-400" />
                <span className={cn(
                  "font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  ETH Rewards
                </span>
              </div>
              <div className={cn(
                "text-2xl font-bold",
                hasEthRewards ? "text-blue-400" : (isDark ? "text-gray-400" : "text-gray-600")
              )}>
                {rewardInfo ? formatAmount(rewardInfo.pendingEth) : '0'} ETH
              </div>
              <div className={cn(
                "text-xs mt-1",
                isDark ? "text-gray-500" : "text-gray-600"
              )}>
                Staking rewards in ETH
              </div>
            </div>

            {/* EMARK Rewards */}
            <div className={cn(
              "p-4 rounded-lg border",
              hasEmarkRewards
                ? (isDark 
                    ? "bg-green-900/30 border-green-500/50" 
                    : "bg-green-100/50 border-green-300")
                : (isDark 
                    ? "bg-gray-700/30 border-gray-600" 
                    : "bg-gray-100/30 border-gray-300")
            )}>
              <div className="flex items-center gap-3 mb-2">
                <CoinsIcon className="h-4 w-4 text-green-400" />
                <span className={cn(
                  "font-medium",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  EMARK Rewards
                </span>
              </div>
              <div className={cn(
                "text-2xl font-bold",
                hasEmarkRewards ? "text-green-400" : (isDark ? "text-gray-400" : "text-gray-600")
              )}>
                {rewardInfo ? formatAmount(rewardInfo.pendingEmark) : '0'} EMARK
              </div>
              <div className={cn(
                "text-xs mt-1",
                isDark ? "text-gray-500" : "text-gray-600"
              )}>
                Token rewards for staking
              </div>
            </div>
          </div>

          {/* Claim Button */}
          <button
            onClick={handleClaimRewards}
            disabled={!hasAnyRewards || isClaiming}
            className={cn(
              "w-full px-6 py-4 rounded-lg font-medium transition-colors",
              hasAnyRewards && !isClaiming
                ? "bg-gradient-to-r from-green-400 to-cyan-400 text-black hover:from-green-300 hover:to-cyan-300"
                : "bg-gray-600 text-gray-300 cursor-not-allowed"
            )}
          >
            {isClaiming ? (
              <div className="flex items-center justify-center gap-2">
                <LoaderIcon className="animate-spin h-4 w-4" />
                Claiming Rewards...
              </div>
            ) : hasAnyRewards ? (
              <div className="flex items-center justify-center gap-2">
                <GiftIcon className="h-4 w-4" />
                Claim All Rewards
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <GiftIcon className="h-4 w-4" />
                No Rewards Available
              </div>
            )}
          </button>
        </div>

        {/* Estimated Daily Rewards */}
        {dailyRewards && userStakedAmount > BigInt(0) && (
          <div className={cn(
            "p-4 rounded-lg border",
            isDark 
              ? "bg-purple-900/30 border-purple-500/50" 
              : "bg-purple-100/50 border-purple-300"
          )}>
            <h5 className={cn(
              "text-sm font-medium mb-2 flex items-center gap-2",
              isDark ? "text-purple-300" : "text-purple-700"
            )}>
              <TrendingUpIcon className="h-4 w-4" />
              Estimated Daily Earnings
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-400">
                  {formatAmount(dailyRewards.ethPerDay)} ETH
                </div>
                <div className={cn(
                  "text-xs",
                  isDark ? "text-gray-500" : "text-gray-600"
                )}>
                  per day
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">
                  {formatAmount(dailyRewards.emarkPerDay)} EMARK
                </div>
                <div className={cn(
                  "text-xs",
                  isDark ? "text-gray-500" : "text-gray-600"
                )}>
                  per day
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Information */}
        <div className={cn(
          "text-xs space-y-2",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          <div className="flex items-center justify-between">
            <span>Gas Cost:</span>
            <span className="text-cyan-400">{RewardsService.estimateClaimGasCost()}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Rewards are distributed automatically based on your staking participation</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex-shrink-0">•</span>
            <span>You can claim ETH and EMARK rewards separately or together</span>
          </div>
        </div>
      </div>
    </div>
  );
}