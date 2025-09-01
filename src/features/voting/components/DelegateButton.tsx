import React, { useState, useCallback, useEffect } from 'react';
import { 
  VoteIcon, 
  ZapIcon, 
  MinusIcon,
  LoaderIcon,
  CheckCircleIcon,
  AlertCircleIcon 
} from 'lucide-react';
import { useVotingState } from '../hooks/useVotingState';
import { VotingService } from '../services/VotingService';
import { cn } from '@/utils/responsive';
import type { DelegateButtonProps } from '../types';

type ButtonVariant = 'default' | 'undelegate' | 'compact' | 'icon';

interface DelegateButtonExtendedProps extends Omit<DelegateButtonProps, 'variant'> {
  amount?: string;
  variant?: ButtonVariant;
}

export function DelegateButton({ 
  evermarkId, 
  isOwner = false,
  variant = 'default',
  className = '',
  amount,
  onSuccess 
}: DelegateButtonExtendedProps) {
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<bigint>(BigInt(0));

  const {
    votingPower,
    isDelegating,
    isUndelegating,
    getUserVotesForEvermark,
    delegateVotes,
    undelegateVotes,
    validateVoteAmount,
    formatVoteAmount,
    isConnected
  } = useVotingState();

  const isProcessing = isDelegating || isUndelegating || localLoading;

  // Load user's current votes for this evermark
  useEffect(() => {
    function loadUserVotes() {
      if (isConnected && evermarkId) {
        try {
          const votes = getUserVotesForEvermark(evermarkId);
          setUserVotes(votes);
        } catch (error) {
          console.error('Failed to load user votes:', error);
        }
      }
    }
    
    loadUserVotes();
  }, [evermarkId, isConnected, getUserVotesForEvermark]);

  // Handle delegation
  const handleDelegate = useCallback(async () => {
    if (!amount || !isConnected || isOwner) return;

    setLocalError(null);
    setLocalSuccess(null);
    setLocalLoading(true);

    try {
      // Validate amount
      const validation = validateVoteAmount(amount, evermarkId);
      if (!validation.isValid) {
        setLocalError(validation.errors[0] || 'Invalid amount');
        return;
      }

      // Parse amount and delegate
      const amountWei = VotingService.parseVoteAmount(amount);
      const transaction = await delegateVotes(evermarkId, amountWei);
      
      setLocalSuccess(`Successfully delegated ${amount} wEMARK!`);
      
      // Reload user votes
      const newVotes = getUserVotesForEvermark(evermarkId);
      setUserVotes(newVotes);
      
      onSuccess?.(transaction);
      
    } catch (error: unknown) {
      console.error('Delegation failed:', error);
      setLocalError(error instanceof Error ? error.message : 'Failed to delegate votes');
    } finally {
      setLocalLoading(false);
    }
  }, [amount, isConnected, isOwner, validateVoteAmount, evermarkId, delegateVotes, getUserVotesForEvermark, onSuccess]);

  // Handle undelegation
  const handleUndelegate = useCallback(async () => {
    if (!amount || !isConnected || isOwner) return;

    setLocalError(null);
    setLocalSuccess(null);
    setLocalLoading(true);

    try {
      // Validate amount against current delegation
      const validation = VotingService.validateUndelegateAmount(amount, userVotes);
      if (!validation.isValid) {
        setLocalError(validation.errors[0] || 'Invalid amount');
        return;
      }

      // Parse amount and undelegate
      const amountWei = VotingService.parseVoteAmount(amount);
      const transaction = await undelegateVotes(evermarkId, amountWei);
      
      setLocalSuccess(`Successfully undelegated ${amount} wEMARK!`);
      
      // Reload user votes
      const newVotes = getUserVotesForEvermark(evermarkId);
      setUserVotes(newVotes);
      
      onSuccess?.(transaction);
      
    } catch (error: unknown) {
      console.error('Undelegation failed:', error);
      setLocalError(error instanceof Error ? error.message : 'Failed to undelegate votes');
    } finally {
      setLocalLoading(false);
    }
  }, [amount, isConnected, isOwner, userVotes, undelegateVotes, evermarkId, getUserVotesForEvermark, onSuccess]);

  // Quick delegate button (for compact variant)
  const handleQuickDelegate = useCallback(async () => {
    if (!votingPower?.available || !isConnected || isOwner) return;

    setLocalError(null);
    setLocalSuccess(null);
    setLocalLoading(true);

    try {
      // Use 1% of available voting power for quick delegation
      const quickAmount = votingPower.available / BigInt(100);
      if (quickAmount < VotingService.parseVoteAmount('0.01')) {
        setLocalError('Insufficient voting power for quick delegation');
        return;
      }

      const transaction = await delegateVotes(evermarkId, quickAmount);
      setLocalSuccess(`Quick delegation successful!`);
      
      // Reload user votes
      const newVotes = getUserVotesForEvermark(evermarkId);
      setUserVotes(newVotes);
      
      onSuccess?.(transaction);
      
    } catch (error: unknown) {
      console.error('Quick delegation failed:', error);
      setLocalError(error instanceof Error ? error.message : 'Quick delegation failed');
    } finally {
      setLocalLoading(false);
    }
  }, [votingPower?.available, isConnected, isOwner, delegateVotes, evermarkId, getUserVotesForEvermark, onSuccess]);

  // Clear messages after delay
  useEffect(() => {
    if (localError || localSuccess) {
      const timer = setTimeout(() => {
        setLocalError(null);
        setLocalSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return
  }, [localError, localSuccess]);

  // Don't render for owners
  if (isOwner) {
    return null;
  }

  // Icon variant (minimal)
  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleQuickDelegate}
          disabled={!isConnected || isProcessing || !votingPower?.available}
          className={cn(
            "p-2 rounded-full transition-all duration-200 relative group",
            "bg-purple-600/20 border border-purple-500/30 text-purple-400",
            "hover:bg-purple-500/30 hover:border-purple-400/50 hover:text-purple-300",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "hover:shadow-lg hover:shadow-purple-500/20",
            className
          )}
          title={isConnected ? "Quick vote with 1% of voting power" : "Connect wallet to vote"}
        >
          {isProcessing ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <VoteIcon className="h-4 w-4" />
          )}
        </button>
        
        {/* Status indicator */}
        {localSuccess && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
        {localError && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleQuickDelegate}
            disabled={!isConnected || isProcessing || !votingPower?.available}
            className={cn(
              "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              "bg-purple-600/20 border border-purple-500/30 text-purple-400",
              "hover:bg-purple-500/30 hover:border-purple-400/50 hover:text-purple-300",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className
            )}
          >
            {isProcessing ? (
              <LoaderIcon className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <ZapIcon className="h-3 w-3 mr-1" />
            )}
            Vote
          </button>
          
          {userVotes > BigInt(0) && (
            <span className="px-2 py-1 text-xs bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400">
              {formatVoteAmount(userVotes, 18)}
            </span>
          )}
        </div>
        
        {/* Status messages */}
        {localError && (
          <div className="text-xs text-red-400 flex items-center">
            <AlertCircleIcon className="h-3 w-3 mr-1" />
            {localError}
          </div>
        )}
        {localSuccess && (
          <div className="text-xs text-green-400 flex items-center">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            {localSuccess}
          </div>
        )}
      </div>
    );
  }

  // Undelegate variant
  if (variant === 'undelegate') {
    return (
      <button
        onClick={handleUndelegate}
        disabled={!isConnected || isProcessing || !amount || userVotes === BigInt(0)}
        className={cn(
          "flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200",
          "bg-gray-700/30 border border-gray-600/50 text-gray-300",
          "hover:bg-gray-600/30 hover:border-gray-500/50 hover:text-gray-200",
          "disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm",
          className
        )}
      >
        {isProcessing ? (
          <>
            <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <MinusIcon className="h-4 w-4 mr-2" />
            Withdraw
          </>
        )}
      </button>
    );
  }

  // Default variant (delegate)
  return (
    <button
      onClick={handleDelegate}
      disabled={!isConnected || isProcessing || !amount || !votingPower?.available}
      className={cn(
        "flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all duration-200",
        "bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-cyan-300",
        "hover:from-purple-500/30 hover:to-blue-500/30 hover:border-cyan-400/50 hover:text-cyan-200",
        "disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/20",
        "backdrop-blur-sm",
        className
      )}
    >
      {isProcessing ? (
        <>
          <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
          {isDelegating ? 'Delegating...' : isUndelegating ? 'Processing...' : 'Processing...'}
        </>
      ) : (
        <>
          <ZapIcon className="h-4 w-4 mr-2" />
          Delegate
        </>
      )}
    </button>
  );
}