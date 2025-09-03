// src/components/VotingStats.tsx - Display precise voting statistics for an evermark
import React, { useState, useEffect } from 'react';
import { BarChart3, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { useVotingState } from '../features/voting/hooks/useVotingState';
import { cn } from '@/utils/responsive';

interface VotingStatsProps {
  evermarkId: string;
  className?: string;
}

export function VotingStats({ evermarkId, className = '' }: VotingStatsProps) {
  const [totalVotes, setTotalVotes] = useState<bigint>(BigInt(0));
  const [showPrecise, setShowPrecise] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { getEvermarkVotes, formatVoteAmount } = useVotingState();

  // Fetch precise voting data
  useEffect(() => {
    const fetchVotingData = async () => {
      if (!evermarkId) return;
      
      try {
        setIsLoading(true);
        const votes = await getEvermarkVotes(evermarkId);
        setTotalVotes(votes);
      } catch (error) {
        console.error('Failed to fetch voting data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVotingData();
  }, [evermarkId, getEvermarkVotes]);

  // Format precise number with commas
  const formatPreciseNumber = (amount: bigint): string => {
    if (amount === BigInt(0)) return '0';
    
    try {
      // Convert to readable number (remove 18 decimal places)
      const divisor = BigInt('1000000000000000000'); // 10^18
      const wholeNumber = amount / divisor;
      
      // Format with commas
      return wholeNumber.toLocaleString();
    } catch (error) {
      // Fallback: convert to string and add commas manually
      const str = amount.toString();
      if (str.length <= 18) return '0';
      const withoutDecimals = str.slice(0, -18);
      return withoutDecimals.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  };

  if (isLoading) {
    return (
      <div className={cn("bg-gray-800/30 border border-gray-700 rounded-lg p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h3 className="font-semibold text-white">Voting Power</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const shortFormat = formatVoteAmount(totalVotes);
  const preciseFormat = formatPreciseNumber(totalVotes);
  const hasVotes = totalVotes > BigInt(0);

  return (
    <div className={cn("bg-gray-800/30 border border-gray-700 rounded-lg p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h3 className="font-semibold text-white">Voting Power</h3>
        </div>
        
        {hasVotes && (
          <button
            onClick={() => setShowPrecise(!showPrecise)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            title={showPrecise ? 'Show short format' : 'Show precise numbers'}
          >
            {showPrecise ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showPrecise ? 'Compact' : 'Precise'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {hasVotes ? (
          <>
            {/* Vote Count Display */}
            <div className="flex justify-between items-end">
              <span className="text-sm text-gray-400">Total Staked:</span>
              <div className="text-right">
                <div className={cn(
                  "font-bold text-green-400 transition-all duration-200",
                  showPrecise ? "text-sm font-mono" : "text-lg"
                )}>
                  {showPrecise ? preciseFormat : shortFormat}
                </div>
                {showPrecise && (
                  <div className="text-xs text-gray-500 mt-1">
                    wEMARK tokens delegated
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>Voting Power</span>
              <span>{shortFormat} wEMARK</span>
            </div>

            {/* Rank Hint */}
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
              <TrendingUp className="h-3 w-3" />
              <span>Higher voting power = better leaderboard position</span>
            </div>
          </>
        ) : (
          <div className="text-center py-2">
            <div className="text-gray-400 text-sm">No votes yet</div>
            <div className="text-xs text-gray-500 mt-1">Be the first to delegate voting power</div>
          </div>
        )}
      </div>
    </div>
  );
}