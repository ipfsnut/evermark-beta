import React, { useState, useCallback } from 'react';
import { CoinsIcon, TrendingUpIcon, LoaderIcon, CheckCircleIcon } from 'lucide-react';
import { useActiveAccount } from 'thirdweb/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import { EvermarkBlockchainService } from '../services/BlockchainService';

interface ReferralEarningsProps {
  className?: string;
}

export function ReferralEarnings({ className = '' }: ReferralEarningsProps) {
  const account = useActiveAccount();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Query referral earnings from blockchain
  const { data: earnings, isLoading: earningsLoading, error: earningsError } = useQuery({
    queryKey: ['referral-earnings', account?.address],
    queryFn: async () => {
      if (!account?.address) throw new Error('No wallet connected');
      return await EvermarkBlockchainService.getPendingReferralPayment(account.address);
    },
    enabled: !!account?.address,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Query referral stats from database
  const { data: referralStats, isLoading: statsLoading } = useQuery({
    queryKey: ['referral-stats', account?.address],
    queryFn: async () => {
      if (!account?.address) throw new Error('No wallet connected');
      const response = await fetch(`/api/evermarks?referrals=stats&referrer=${account.address}`);
      if (!response.ok) throw new Error('Failed to fetch referral stats');
      return response.json();
    },
    enabled: !!account?.address,
    refetchInterval: 60000, // Refetch every minute
  });

  const isLoading = earningsLoading || statsLoading;
  const error = earningsError;

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error('No wallet connected');
      const result = await EvermarkBlockchainService.claimReferralPayment(account);
      if (!result.success) {
        throw new Error(result.error || 'Claim failed');
      }
      return result;
    },
    onSuccess: () => {
      // Refetch earnings after successful claim
      queryClient.invalidateQueries({ queryKey: ['referral-earnings', account?.address] });
      setClaimError(null);
    },
    onError: (error: Error) => {
      setClaimError(error.message);
    }
  });

  const handleClaim = useCallback(async () => {
    if (!earnings || earnings === '0' || claiming) return;
    
    setClaiming(true);
    setClaimError(null);
    
    try {
      await claimMutation.mutateAsync();
    } catch (error) {
      console.error('Claim failed:', error);
    } finally {
      setClaiming(false);
    }
  }, [earnings, claiming, claimMutation]);

  if (!account?.address) {
    return (
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="text-center">
          <CoinsIcon className={cn(
            "mx-auto h-12 w-12 mb-4",
            isDark ? "text-gray-600" : "text-gray-400"
          )} />
          <h3 className={cn(
            "text-lg font-medium mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Referral Earnings
          </h3>
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            Connect your wallet to view your referral earnings
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
            Loading referral earnings...
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
          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
          <span className={cn(
            "text-sm",
            isDark ? "text-red-300" : "text-red-700"
          )}>
            Failed to load referral earnings
          </span>
        </div>
      </div>
    );
  }

  const hasEarnings = Boolean(earnings && earnings !== '0' && earnings !== BigInt(0));
  const earningsInEth = hasEarnings ? (Number(earnings) / 1e18).toFixed(8) : '0.00000000';

  return (
    <div className={cn(
      "border rounded-lg p-6",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            hasEarnings 
              ? "bg-gradient-to-r from-green-400 to-cyan-400" 
              : "bg-gray-600"
          )}>
            <CoinsIcon className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className={cn(
              "text-lg font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Referral Earnings
            </h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Your accumulated referral rewards
            </p>
          </div>
        </div>

        <div className={cn(
          "border rounded-lg p-4",
          hasEarnings
            ? (isDark 
                ? "bg-green-900/30 border-green-500/50" 
                : "bg-green-100/50 border-green-300")
            : (isDark 
                ? "bg-gray-700/50 border-gray-600" 
                : "bg-gray-100/50 border-gray-300")
        )}>
          <div className="text-center">
            <div className={cn(
              "text-3xl font-bold mb-1",
              hasEarnings 
                ? "text-green-400" 
                : (isDark ? "text-gray-400" : "text-gray-600")
            )}>
              {earningsInEth} ETH
            </div>
            <div className={cn(
              "text-xs",
              isDark ? "text-gray-500" : "text-gray-600"
            )}>
              Pending Referral Payment
            </div>
          </div>

          {hasEarnings && (
            <div className="mt-4">
              <button
                onClick={handleClaim}
                disabled={claiming || claimMutation.isPending}
                className={cn(
                  "w-full px-4 py-3 rounded-lg font-medium transition-colors",
                  claiming || claimMutation.isPending
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-400 to-cyan-400 text-black hover:from-green-300 hover:to-cyan-300"
                )}
              >
                {claiming || claimMutation.isPending ? (
                  <div className="flex items-center justify-center gap-2">
                    <LoaderIcon className="animate-spin h-4 w-4" />
                    Claiming...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircleIcon className="h-4 w-4" />
                    Claim Earnings
                  </div>
                )}
              </button>
            </div>
          )}
        </div>

        {claimError && (
          <div className={cn(
            "text-xs p-3 rounded border",
            isDark 
              ? "bg-red-900/30 text-red-300 border-red-500/30" 
              : "bg-red-100 text-red-700 border-red-300"
          )}>
            Error: {claimError}
          </div>
        )}

        <div className={cn(
          "text-xs space-y-2 pt-2 border-t",
          isDark ? "text-gray-400 border-gray-600" : "text-gray-600 border-gray-300"
        )}>
          <div className="flex items-center justify-between">
            <span>Referral Rate:</span>
            <span className="text-green-400">10%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Per Referral:</span>
            <span className="text-green-400">0.000007 ETH</span>
          </div>
          {referralStats && (
            <div className="flex items-center justify-between">
              <span>Total Referrals:</span>
              <span className="text-cyan-400">{referralStats.total_referrals || 0}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="h-3 w-3" />
            <span>Earnings accumulate automatically and can be claimed anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}