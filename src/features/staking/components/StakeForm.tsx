// features/staking/components/StakeForm.tsx - Stake form component

import { useState, useEffect, useCallback } from 'react';
import { toWei } from 'thirdweb/utils';
import { 
  LockIcon, 
  AlertCircleIcon, 
  InfoIcon, 
  CheckCircleIcon 
} from 'lucide-react';
import { StakingService } from '../services/StakingService';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/utils/responsive';
import type { UseStakingStateReturn, StakingValidation } from '../types';

interface StakeFormProps {
  stakingState: UseStakingStateReturn;
  onSuccess?: () => void;
  className?: string;
}

export function StakeForm({ stakingState, onSuccess, className = '' }: StakeFormProps) {
  const [amount, setAmount] = useState('');
  const [validation, setValidation] = useState<StakingValidation>({ 
    isValid: false, 
    errors: [], 
    warnings: [] 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [approvedAmount, setApprovedAmount] = useState<bigint | null>(null);
  const { isDark } = useTheme();

  const { stakingInfo, isStaking, formatTokenAmount } = stakingState;

  // Validate amount whenever it changes
  useEffect(() => {
    if (!amount) {
      setValidation({ isValid: false, errors: [], warnings: [] });
      return;
    }

    const newValidation = stakingState.validateStakeAmount(amount);
    setValidation(newValidation);
  }, [amount, stakingState]);

  // Clear messages after delay
  useEffect(() => {
    if (localError || localSuccess) {
      const timer = setTimeout(() => {
        setLocalError(null);
        setLocalSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return
  }, [localError, localSuccess]);

  // Handle max button click
  const handleMaxClick = useCallback(() => {
    if (stakingInfo?.emarkBalance) {
      const maxAmount = formatTokenAmount(stakingInfo.emarkBalance, 6);
      setAmount(maxAmount);
    }
  }, [stakingInfo?.emarkBalance, formatTokenAmount]);

  // Handle setting up the stake amount (no actual approval, just UI state)
  const handleApproval = useCallback(async () => {
    if (!validation.isValid || !amount || isApproving) return;

    setIsApproving(true);
    setLocalError(null);
    setLocalSuccess(null);

    try {
      const amountWei = toWei(amount);
      
      // Just set the approved amount for UI - actual approval happens in stake()
      setApprovedAmount(amountWei);
      setLocalSuccess(`Ready to stake ${amount} EMARK - click Stake to proceed!`);
    } catch (error: any) {
      console.error('Amount validation failed:', error);
      setLocalError(error.message || 'Amount validation failed.');
    } finally {
      setIsApproving(false);
    }
  }, [validation.isValid, amount, isApproving]);

  // Handle staking (with automatic approval)
  const handleStake = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.isValid || !amount || isSubmitting) return;

    setIsSubmitting(true);
    setLocalError(null);
    setLocalSuccess(null);

    try {
      const amountWei = toWei(amount);
      
      // The stake method handles approval internally
      await stakingState.stake(amountWei);
      
      setLocalSuccess(`Successfully staked ${formatTokenAmount(amountWei, 4)} EMARK!`);
      setAmount('');
      setApprovedAmount(null);
      onSuccess?.();
    } catch (error: any) {
      console.error('Stake submission failed:', error);
      setLocalError(error.message || 'Staking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [validation.isValid, amount, isSubmitting, stakingState, formatTokenAmount, onSuccess]);

  // Handle amount input changes
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow valid number inputs
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setLocalError(null);
      
      // Reset approved amount if user changes the amount
      if (approvedAmount) {
        const newAmountWei = value ? toWei(value) : BigInt(0);
        if (newAmountWei !== approvedAmount) {
          setApprovedAmount(null);
        }
      }
    }
  }, [approvedAmount]);

  if (!stakingState.isConnected) {
    return (
      <div className={cn(
        "rounded-lg p-6 transition-colors duration-200",
        isDark 
          ? "bg-gray-800/50 border border-gray-700" 
          : "bg-yellow-100/50 border border-yellow-200",
        className
      )}>
        <div className="text-center py-8">
          <LockIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Wallet</h3>
          <p className="text-gray-400">Connect your wallet to start staking EMARK tokens</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-lg p-6 transition-colors duration-200",
      isDark 
        ? "bg-gray-800/50 border border-gray-700" 
        : "bg-yellow-100/50 border border-yellow-200",
      className
    )}>
      <div className="flex items-center mb-6">
        <div className="p-2 bg-purple-900/30 border border-purple-500/30 rounded-lg mr-3">
          <LockIcon className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Stake EMARK</h3>
          <p className="text-sm text-gray-400">Convert EMARK to wEMARK for voting power</p>
        </div>
      </div>

      {/* Status Messages */}
      {localError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-start">
          <AlertCircleIcon className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-red-200 text-sm">{localError}</span>
        </div>
      )}

      {localSuccess && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/30 rounded-lg flex items-start">
          <CheckCircleIcon className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
          <span className="text-green-200 text-sm">{localSuccess}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label htmlFor="stake-amount" className="block text-sm font-medium text-gray-300 mb-2">
            Amount to Stake
          </label>
          
          <div className="relative">
            <input
              id="stake-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              className={cn(
                "w-full px-4 py-3 rounded-lg transition-colors pr-20 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20",
                isDark 
                  ? "bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:border-purple-500"
                  : "bg-white/90 border border-yellow-300 text-gray-900 placeholder-gray-500 focus:border-purple-400"
              )}
              placeholder="0.0"
              disabled={isSubmitting || isStaking}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              <span className="text-sm text-gray-400">EMARK</span>
              <button
                type="button"
                onClick={handleMaxClick}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                disabled={isSubmitting || isStaking}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Balance Display */}
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>
              Available: {stakingInfo ? formatTokenAmount(stakingInfo.emarkBalance, 4) : '0'} EMARK
            </span>
            {amount && validation.isValid && (
              <span>
                You'll receive: {amount} wEMARK
              </span>
            )}
          </div>
        </div>

        {/* Validation Messages */}
        {validation.errors.length > 0 && (
          <div className="space-y-1">
            {validation.errors.map((error, index) => (
              <div key={index} className="flex items-center text-red-400 text-sm">
                <AlertCircleIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                {error}
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="space-y-1">
            {validation.warnings.map((warning, index) => (
              <div key={index} className="flex items-center text-yellow-400 text-sm">
                <InfoIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                {warning}
              </div>
            ))}
          </div>
        )}

        {/* Approval Status */}
        {approvedAmount && (
          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center">
            <CheckCircleIcon className="h-4 w-4 text-green-400 mr-2" />
            <span className="text-green-200 text-sm">
              Approved {formatTokenAmount(approvedAmount, 4)} EMARK for staking
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {!approvedAmount || (amount && toWei(amount) !== approvedAmount) ? (
            <button
              type="button"
              onClick={handleApproval}
              disabled={!validation.isValid || isApproving || !amount}
              className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isApproving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Approve {amount || '0'} EMARK
                </>
              )}
            </button>
          ) : null}

          {approvedAmount && (
            <form onSubmit={handleStake}>
              <button
                type="submit"
                disabled={!validation.isValid || isSubmitting || isStaking || !amount || !approvedAmount}
                className="w-full flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSubmitting || isStaking ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Staking...
                  </>
                ) : (
                  <>
                    <LockIcon className="h-4 w-4 mr-2" />
                    Stake {amount || '0'} EMARK
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Information Section */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <div className="flex items-start">
          <InfoIcon className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200 space-y-2">
            <p>
              <strong className="text-blue-300">Two-step process:</strong> First approve EMARK spending, then stake to receive wEMARK tokens.
            </p>
            <p>
              <strong className="text-blue-300">Voting Power:</strong> wEMARK tokens give you voting power in governance and content curation.
            </p>
            <p>
              <strong className="text-blue-300">Unbonding:</strong> Unstaking requires a {stakingInfo ? StakingService.formatUnbondingPeriod(stakingInfo.unbondingPeriod) : '7 day'} waiting period.
            </p>
          </div>
        </div>
      </div>

      {/* Current Stats Display */}
      {stakingInfo && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className={cn(
            "text-center p-3 rounded-lg transition-colors duration-200",
            isDark 
              ? "bg-gray-900/50 border border-gray-600"
              : "bg-white/60 border border-yellow-300"
          )}>
            <div className="text-sm text-gray-400 mb-1">Current Stake</div>
            <div className="text-lg font-medium text-white">
              {formatTokenAmount(stakingInfo.totalStaked)} wEMARK
            </div>
          </div>
          <div className={cn(
            "text-center p-3 rounded-lg transition-colors duration-200",
            isDark 
              ? "bg-gray-900/50 border border-gray-600"
              : "bg-white/60 border border-yellow-300"
          )}>
            <div className="text-sm text-gray-400 mb-1">Voting Power</div>
            <div className="text-lg font-medium text-white">
              {formatTokenAmount(stakingInfo.availableVotingPower)} wEMARK
            </div>
          </div>
        </div>
      )}
    </div>
  );
}