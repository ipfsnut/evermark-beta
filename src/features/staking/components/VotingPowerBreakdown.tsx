import React, { useState, useEffect } from 'react';
import { Vote, Zap, Lock, CircleDot } from 'lucide-react';
import { VotingPowerService } from '../services/VotingPowerService';
import { TokenService } from '@/features/tokens/services/TokenService';

interface VotingPowerBreakdownProps {
  userAddress: string | undefined;
  wEmarkBalance: bigint;
  className?: string;
}

interface PowerBreakdown {
  total: bigint;
  available: bigint;
  reserved: bigint;
  utilizationRate: number;
}

export function VotingPowerBreakdown({ userAddress, wEmarkBalance, className = '' }: VotingPowerBreakdownProps) {
  const [breakdown, setBreakdown] = useState<PowerBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBreakdown() {
      if (!userAddress || wEmarkBalance === BigInt(0)) {
        setBreakdown({
          total: BigInt(0),
          available: BigInt(0),
          reserved: BigInt(0),
          utilizationRate: 0
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const powerBreakdown = await VotingPowerService.getVotingPowerBreakdown(userAddress, wEmarkBalance);
        setBreakdown(powerBreakdown);
      } catch (error) {
        console.error('Failed to fetch voting power breakdown:', error);
        setBreakdown({
          total: wEmarkBalance,
          available: wEmarkBalance,
          reserved: BigInt(0),
          utilizationRate: 0
        });
      } finally {
        setLoading(false);
      }
    }

    fetchBreakdown();
  }, [userAddress, wEmarkBalance]);

  if (loading) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Vote className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Voting Power</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!breakdown) return null;

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Vote className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Voting Power</h3>
      </div>

      <div className="space-y-4">
        {/* Total Voting Power */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-purple-400" />
            <span className="text-gray-300">Total Power</span>
          </div>
          <span className="text-white font-medium">
            {TokenService.formatTokenAmount(breakdown.total, 18)} wEMARK
          </span>
        </div>

        {/* Available Power */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-green-400" />
            <span className="text-gray-300">Available</span>
          </div>
          <span className="text-green-400 font-medium">
            {TokenService.formatTokenAmount(breakdown.available, 18)} wEMARK
          </span>
        </div>

        {/* Reserved Power */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-orange-400" />
            <span className="text-gray-300">In Active Votes</span>
          </div>
          <span className="text-orange-400 font-medium">
            {TokenService.formatTokenAmount(breakdown.reserved, 18)} wEMARK
          </span>
        </div>

        {/* Utilization Rate */}
        {breakdown.total > BigInt(0) && (
          <div className="pt-3 border-t border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-400">Power Utilization</span>
              <span className="text-sm text-purple-300 font-medium">
                {breakdown.utilizationRate.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, breakdown.utilizationRate)}%` }}
              />
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mt-4">
          <p className="text-xs text-blue-200">
            <strong>Available power</strong> can be used for new votes. <strong>Reserved power</strong> is locked in active votes until the weekly cycle ends.
          </p>
        </div>
      </div>
    </div>
  );
}