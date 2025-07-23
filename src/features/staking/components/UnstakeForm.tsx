// features/staking/components/UnstakeForm.tsx - Unstake form component

import { useState, useEffect, useCallback } from 'react';
import { toWei } from 'thirdweb/utils';
import { 
  UnlockIcon, 
  AlertCircleIcon, 
  InfoIcon,
  ClockIcon,
  CheckCircleIcon 
} from 'lucide-react';
import { StakingService } from '../services/StakingService';
import type { UseStakingStateReturn, StakingValidation } from '../types';

interface UnstakeFormProps {
  stakingState: UseStakingStateReturn;
  onSuccess?: () => void;
  className?: string;
}

export function UnstakeForm({ stakingState, onSuccess, className = '' }: UnstakeFormProps) {
  const [amount, setAmount] = useState('');
  const [validation, setValidation] = useState<StakingValidation>({ 
    isValid: false, 
    errors: [], 
    warnings: [] 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  const { stakingInfo, isUnstaking, formatTokenAmount } = stakingState;

  // Validate amount whenever it changes
  useEffect(() => {
    if (!amount) {
      setValidation({ isValid: false, errors: [], warnings: [] });
      return;
    }

    const newValidation = stakingState.validateUnstakeAmount(amount);
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
    if (stakingInfo?.wEmarkBalance) {
      const maxAmount = formatTokenAmount(stakingInfo.wEmarkBalance, 6);
      setAmount(maxAmount);
    }
  }, [stakingInfo?.wEmarkBalance, formatTokenAmount]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.isValid || !amount || isSubmitting) return;

    setIsSubmitting(true);
    setLocalError(null);
    setLocalSuccess(null);

    try {
      const amountWei = toWei(amount);
      await stakingState.requestUnstake(amountWei);
      
      setLocalSuccess(`Unstaking request submitted for ${amount} wEMARK!`);
      setAmount('');
      onSuccess?.();
    } catch (error: any) {
      console.error('Unstake submission failed:', error);
      setLocalError(error.message || 'Unstaking request failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [validation.isValid, amount, isSubmitting, stakingState, onSuccess]);

  // Handle amount input changes
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow valid number inputs
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setLocalError(null);
    }
  }, []);

  if (!stakingState.isConnected) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <UnlockIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Wallet</h3>
          <p className="text-gray-400">Connect your wallet to unstake tokens</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-center mb-6">
        <div className="p-2 bg-orange-900/30 border border-orange-500/30 rounded-lg mr-3">
          <UnlockIcon className="h-5 w-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white">Unstake wEMARK</h3>
          <p className="text-sm text-gray-400">Convert wEMARK back to EMARK tokens</p>
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount Input */}
        <div>
          <label htmlFor="unstake-amount" className="block text-sm font-medium text-gray-300 mb-2">
            Amount to Unstake
          </label>
          
          <div className="relative">
            <input
              id="unstake-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20 transition-colors pr-24"
              placeholder="0.0"
              disabled={isSubmitting || isUnstaking}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              <span className="text-sm text-gray-400">wEMARK</span>
              <button
                type="button"
                onClick={handleMaxClick}
                className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
                disabled={isSubmitting || isUnstaking}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Balance Display */}
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>
              Staked: {stakingInfo ? formatTokenAmount(stakingInfo.wEmarkBalance, 4) : '0'} wEMARK
            </span>
            {amount && validation.isValid && (
              <span>
                You'll receive: {amount} EMARK (after unbonding)
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!validation.isValid || isSubmitting || isUnstaking || !amount}
          className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting || isUnstaking ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <UnlockIcon className="h-4 w-4 mr-2" />
              Request Unstake
            </>
          )}
        </button>
      </form>

      {/* Unbonding Information */}
      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start">
          <ClockIcon className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-200 space-y-2">
            <p>
              <strong className="text-yellow-300">Unbonding Period:</strong> Unstaking requires a {stakingInfo ? StakingService.formatUnbondingPeriod(stakingInfo.unbondingPeriod) : '7 day'} waiting period.
            </p>
            <p>
              <strong className="text-yellow-300">Process:</strong> After requesting unstake, you must wait for the unbonding period to complete before claiming your EMARK tokens.
            </p>
            <p>
              <strong className="text-yellow-300">Voting Power:</strong> You will lose voting power immediately when you request unstake.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Unbonding Display */}
      {stakingInfo && stakingInfo.unbondingAmount > BigInt(0) && (
        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <h4 className="text-sm font-medium text-blue-300 mb-3">Pending Unstake Request</h4>
          
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-white">
                {formatTokenAmount(stakingInfo.unbondingAmount)} EMARK
              </div>
              <div className="text-sm text-blue-200">
                {stakingInfo.canClaimUnbonding ? (
                  <span className="text-green-400 font-medium">Ready to claim!</span>
                ) : (
                  <>
                    <ClockIcon className="inline h-3 w-3 mr-1" />
                    {StakingService.formatTimeRemaining(stakingInfo.timeUntilRelease)} remaining
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {stakingInfo.canClaimUnbonding ? (
              <button
                onClick={() => stakingState.completeUnstake()}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                {isSubmitting ? 'Processing...' : 'Claim EMARK'}
              </button>
            ) : (
              <button
                onClick={() => stakingState.cancelUnbonding()}
                disabled={isSubmitting}
                className="px-4 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 transition-colors disabled:opacity-50 rounded-lg border border-blue-500/30"
              >
                Cancel Unbonding
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}