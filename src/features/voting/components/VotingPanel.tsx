// features/voting/components/VotingPanel.tsx - Main voting interface component

import React, { useState, useEffect, useCallback } from 'react';
import { 
  VoteIcon, 
  TrendingUpIcon, 
  AlertCircleIcon, 
  CheckCircleIcon, 
  ClockIcon,
  InfoIcon,
  BarChart3Icon
} from 'lucide-react';
import { useVotingState } from '../hooks/useVotingState';
import { VotingService } from '../services/VotingService';
import { DelegateButton } from './DelegateButton';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import type { VotingPanelProps } from '../types';

export function VotingPanel({ 
  evermarkId, 
  isOwner = false, 
  className = '' 
}: VotingPanelProps) {
  const [voteAmount, setVoteAmount] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [totalVotes, setTotalVotes] = useState<bigint>(BigInt(0));
  const [userVotes, setUserVotes] = useState<bigint>(BigInt(0));
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const { isDark } = useTheme();
  
  const {
    votingPower,
    currentCycle,
    error,
    success,
    getEvermarkVotes,
    getUserVotesForEvermark,
    validateVoteAmount,
    formatVoteAmount,
    getTimeRemainingInCycle,
    clearErrors,
    clearSuccess,
    isConnected
  } = useVotingState();

  // Fetch data for this specific evermark
  useEffect(() => {
    if (!isConnected || !evermarkId) return;
    
    const fetchData = async () => {
      try {
        const [votes, userVoteCount, remaining] = await Promise.all([
          getEvermarkVotes(evermarkId),
          getUserVotesForEvermark(evermarkId),
          getTimeRemainingInCycle()
        ]);
        setTotalVotes(votes);
        setUserVotes(userVoteCount);
        setTimeRemaining(remaining);
      } catch (error) {
        console.error('Failed to fetch voting data:', error);
      }
    };
    
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [evermarkId, isConnected, getEvermarkVotes, getUserVotesForEvermark, getTimeRemainingInCycle]);
  
  // Clear messages after delay
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        clearErrors();
        clearSuccess();
      }, 5000);
      return () => clearTimeout(timer);
    }
    return
  }, [error, success, clearErrors, clearSuccess]);

  // Validate amount whenever it changes
  const validation = voteAmount ? validateVoteAmount(voteAmount, evermarkId) : null;

  // Handle max button click
  const handleMaxClick = useCallback(() => {
    if (votingPower?.available) {
      const maxAmount = formatVoteAmount(votingPower.available, 18);
      setVoteAmount(maxAmount);
    }
  }, [votingPower?.available, formatVoteAmount]);

  // Handle clear button click
  const handleClearClick = useCallback(() => {
    setVoteAmount('');
    clearErrors();
  }, [clearErrors]);

  if (!isConnected) {
    return (
      <div className={cn(
        "border rounded-lg shadow-lg p-4 sm:p-6 backdrop-blur-sm",
        isDark 
          ? "bg-gray-800/50 border-gray-700" 
          : "bg-white border-gray-300",
        className
      )}>
        <div className="text-center py-6 sm:py-8">
          <VoteIcon className={cn(
            "mx-auto h-10 w-10 sm:h-12 sm:w-12 mb-4",
            isDark ? "text-gray-500" : "text-gray-400"
          )} />
          <h3 className={cn(
            "text-base sm:text-lg font-medium mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>Connect to Vote</h3>
          <p className={cn(
            "text-sm sm:text-base",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>Connect your wallet to delegate voting power to this Evermark</p>
        </div>
      </div>
    );
  }

  if (!votingPower) {
    return (
      <div className={cn("bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6 backdrop-blur-sm", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "border rounded-lg shadow-lg backdrop-blur-sm",
      isDark 
        ? "bg-gray-800/50 border-gray-700" 
        : "bg-white border-gray-300",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "p-4 sm:p-6 border-b",
        isDark ? "border-gray-700" : "border-gray-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mr-3 shadow-lg shadow-purple-500/30">
              <VoteIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h3 className={cn(
                "text-base sm:text-lg font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}>Voting Power</h3>
              <p className={cn(
                "text-xs sm:text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>Delegate wEMARK to support quality content</p>
            </div>
          </div>
          
          {/* Cycle info */}
          {currentCycle && (
            <div className="text-right">
              <div className={cn(
                "text-xs sm:text-sm",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>Cycle {currentCycle.cycleNumber}</div>
              <div className={cn(
                "flex items-center text-xs",
                isDark ? "text-gray-500" : "text-gray-500"
              )}>
                <ClockIcon className="h-3 w-3 mr-1" />
                {VotingService.formatTimeRemaining(timeRemaining)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 border-b border-gray-700">
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start backdrop-blur-sm">
            <AlertCircleIcon className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-red-300 text-sm leading-relaxed">
              {VotingService.getUserFriendlyError(error)}
            </span>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 border-b border-gray-700">
          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-start backdrop-blur-sm">
            <CheckCircleIcon className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-green-300 text-sm leading-relaxed">{success}</span>
          </div>
        </div>
      )}

      {/* Voting Stats Grid */}
      <div className="p-4 sm:p-6 border-b border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gray-700/30 border border-gray-600/50 p-3 sm:p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <TrendingUpIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-400 mr-2 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">Total Votes</p>
                <p className="text-lg sm:text-xl font-bold text-green-300 truncate">
                  {formatVoteAmount(totalVotes)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700/30 border border-gray-600/50 p-3 sm:p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <VoteIcon className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400 mr-2 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">Your Votes</p>
                <p className="text-lg sm:text-xl font-bold text-cyan-300 truncate">
                  {formatVoteAmount(userVotes)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700/30 border border-gray-600/50 p-3 sm:p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <div className="h-4 w-4 sm:h-5 sm:w-5 bg-purple-600/30 border border-purple-400/50 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                <span className="text-purple-400 text-xs font-bold">P</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">Available</p>
                <p className="text-lg sm:text-xl font-bold text-purple-300 truncate">
                  {formatVoteAmount(votingPower.available)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voting Interface */}
      {!isOwner ? (
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Amount Input */}
            <div>
              <label htmlFor="vote-amount" className="block text-sm font-medium text-gray-300 mb-2">
                Vote Amount (wEMARK)
              </label>
              <div className="relative">
                <input
                  id="vote-amount"
                  type="text"
                  inputMode="decimal"
                  value={voteAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setVoteAmount(value);
                      clearErrors();
                    }
                  }}
                  className={cn(
                    "w-full px-3 py-2 sm:py-3 bg-gray-700/50 border rounded-lg text-white placeholder-gray-500 text-base transition-colors backdrop-blur-sm pr-20",
                    validation?.isValid === false ? "border-red-500/50 focus:border-red-400" : "border-gray-600/50 focus:border-cyan-400/50",
                    "focus:ring-2 focus:ring-cyan-400/20"
                  )}
                  placeholder="0.0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                  <span className="text-sm text-gray-400">wEMARK</span>
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    MAX
                  </button>
                </div>
                {/* Cyber-style input glow effect */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-400/10 to-purple-400/10 opacity-0 focus-within:opacity-100 transition-opacity pointer-events-none" />
              </div>

              {/* Balance Display */}
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Available: {formatVoteAmount(votingPower.available, 18)} wEMARK</span>
                {userVotes > BigInt(0) && (
                  <span>Currently delegated: {formatVoteAmount(userVotes, 18)} wEMARK</span>
                )}
              </div>
            </div>

            {/* Validation Messages */}
            {validation && !validation.isValid && (
              <div className="space-y-1">
                {validation.errors.map((error, index) => (
                  <div key={index} className="flex items-center text-red-400 text-sm">
                    <AlertCircleIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                    {error}
                  </div>
                ))}
              </div>
            )}

            {validation && validation.warnings.length > 0 && (
              <div className="space-y-1">
                {validation.warnings.map((warning, index) => (
                  <div key={index} className="flex items-center text-yellow-400 text-sm">
                    <InfoIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                    {warning}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <DelegateButton
                evermarkId={evermarkId}
                amount={voteAmount}
                variant="default"
                className="flex-1"
                onSuccess={() => {
                  setVoteAmount('');
                  clearErrors();
                }}
              />
              
              {userVotes > BigInt(0) && (
                <DelegateButton
                  evermarkId={evermarkId}
                  amount={voteAmount}
                  variant="undelegate"
                  className="flex-1"
                  onSuccess={() => {
                    setVoteAmount('');
                    clearErrors();
                  }}
                />
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              {votingPower.available > BigInt(0) && (
                <>
                  <button
                    onClick={() => setVoteAmount(formatVoteAmount(votingPower.available / BigInt(4), 18))}
                    className="px-3 py-1 text-xs bg-gray-700/30 border border-gray-600/50 rounded text-gray-300 hover:text-white hover:border-gray-500/50 transition-colors"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => setVoteAmount(formatVoteAmount(votingPower.available / BigInt(2), 18))}
                    className="px-3 py-1 text-xs bg-gray-700/30 border border-gray-600/50 rounded text-gray-300 hover:text-white hover:border-gray-500/50 transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setVoteAmount(formatVoteAmount(votingPower.available * BigInt(3) / BigInt(4), 18))}
                    className="px-3 py-1 text-xs bg-gray-700/30 border border-gray-600/50 rounded text-gray-300 hover:text-white hover:border-gray-500/50 transition-colors"
                  >
                    75%
                  </button>
                </>
              )}
              {voteAmount && (
                <button
                  onClick={handleClearClick}
                  className="px-3 py-1 text-xs bg-red-900/30 border border-red-500/30 rounded text-red-300 hover:text-red-200 hover:border-red-400/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Advanced Options Toggle */}
            <div className="pt-2">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <BarChart3Icon className="h-3 w-3 mr-1" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>
            </div>

            {/* Advanced Options */}
            {showAdvanced && (
              <div className="pt-4 border-t border-gray-700/50 space-y-3">
                <div className="text-sm text-gray-300 mb-2">Voting Impact Analysis</div>
                
                {voteAmount && validation?.isValid && (
                  <div className="bg-gray-700/20 border border-gray-600/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Estimated Ranking Impact:</span>
                      <span className="text-green-400">Positive</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Your Voting Power Usage:</span>
                      <span className="text-cyan-400">
                        {votingPower.available > BigInt(0) 
                          ? ((parseFloat(voteAmount) / Number(votingPower.available / BigInt(10 ** 18))) * 100).toFixed(1)
                          : '0'
                        }%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Estimated Gas Cost:</span>
                      <span className="text-yellow-400">~$0.60 USD</span>
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500 leading-relaxed">
                  <p className="mb-1">• Voting helps quality content rise in rankings</p>
                  <p className="mb-1">• Higher-ranked Evermarks may provide better curation rewards</p>
                  <p>• You can adjust or withdraw your votes anytime during the cycle</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Owner view
        <div className="p-4 sm:p-6">
          <div className="text-center py-4 bg-gray-700/20 border border-gray-600/30 rounded-lg backdrop-blur-sm">
            <InfoIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-gray-400 text-sm mb-1">You cannot vote on your own Evermark</p>
            <p className="text-xs text-gray-500">Share this content to gather community support!</p>
          </div>
        </div>
      )}

      {/* Information Footer */}
      <div className="px-4 sm:px-6 py-3 bg-blue-900/20 border-t border-gray-700 rounded-b-lg">
        <div className="flex items-start">
          <InfoIcon className="h-4 w-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-200 leading-relaxed">
            <p>
              <strong className="text-blue-300">Voting Power:</strong> Delegate your wEMARK tokens to support quality content and influence rankings.
              {currentCycle && currentCycle.isActive && (
                <span className="ml-1">Current cycle ends {currentCycle.endTime.toLocaleDateString()}.</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}