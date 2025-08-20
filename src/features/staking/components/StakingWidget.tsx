// features/staking/components/StakingWidget.tsx - Main staking widget component

import { useState } from 'react';
import { 
  LockIcon, 
  UnlockIcon, 
  TrendingUpIcon, 
  ClockIcon,
  AlertTriangleIcon,
  XIcon,
  CheckCircleIcon
} from 'lucide-react';
import { StakeForm } from './StakeForm';
import { StakingService } from '../services/StakingService';
import type { UseStakingStateReturn } from '../types';

interface StakingWidgetProps {
  stakingState: UseStakingStateReturn;
  className?: string;
}

interface TabType {
  id: 'stake' | 'unstake';
  label: string;
  icon: React.ReactNode;
}

const tabs: TabType[] = [
  {
    id: 'stake',
    label: 'Stake',
    icon: <LockIcon className="h-4 w-4" />
  },
  {
    id: 'unstake', 
    label: 'Unstake',
    icon: <UnlockIcon className="h-4 w-4" />
  }
];

export function StakingWidget({ stakingState, className = '' }: StakingWidgetProps) {
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  const { 
    stakingInfo, 
    isUnstaking, 
    formatTokenAmount, 
    formatTimeRemaining,
    validateUnstakeAmount,
    requestUnstake,
    completeUnstake,
    cancelUnbonding,
    isConnected
  } = stakingState;

  // Handle unstake form submission
  const handleUnstakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!unstakeAmount || isSubmitting) return;

    const validation = validateUnstakeAmount(unstakeAmount);
    if (!validation.isValid) {
      setLocalError(validation.errors[0] || 'Invalid amount');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    try {
      const amountWei = BigInt(parseFloat(unstakeAmount) * 1e18);
      await requestUnstake(amountWei);
      setLocalSuccess(`Unstake request submitted for ${unstakeAmount} wEMARK`);
      setUnstakeAmount('');
    } catch (error: any) {
      setLocalError(error.message || 'Unstake request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle complete unstake
  const handleCompleteUnstake = async () => {
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await completeUnstake();
      setLocalSuccess('Successfully claimed unstaked tokens!');
    } catch (error: any) {
      setLocalError(error.message || 'Failed to complete unstake');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel unbonding
  const handleCancelUnbonding = async () => {
    setIsSubmitting(true);
    setLocalError(null);

    try {
      await cancelUnbonding();
      setLocalSuccess('Unbonding request cancelled successfully!');
    } catch (error: any) {
      setLocalError(error.message || 'Failed to cancel unbonding');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle max unstake button
  const handleMaxUnstake = () => {
    if (stakingInfo?.wEmarkBalance) {
      const maxAmount = formatTokenAmount(stakingInfo.wEmarkBalance, false);
      setUnstakeAmount(maxAmount);
    }
  };

  if (!isConnected) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <LockIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Connect Wallet</h3>
          <p className="text-gray-400">Connect your wallet to access staking features</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center">
          <TrendingUpIcon className="h-6 w-6 mr-3 text-purple-400" />
          Staking Dashboard
        </h2>
        <p className="text-gray-400">
          Stake EMARK tokens to receive wEMARK and participate in content curation
        </p>
      </div>

      {/* Status Messages */}
      {(localError || localSuccess) && (
        <div className="p-4 border-b border-gray-700">
          {localError && (
            <div className="mb-3 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-start">
              <AlertTriangleIcon className="h-4 w-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-red-200 text-sm">{localError}</span>
            </div>
          )}
          
          {localSuccess && (
            <div className="p-3 bg-green-900/30 border border-green-500/30 rounded-lg flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-green-200 text-sm">{localSuccess}</span>
            </div>
          )}
        </div>
      )}

      {/* Current Staking Status */}
      {stakingInfo && (
        <div className="p-6 border-b border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="text-sm text-purple-400 mb-1">Total Staked</div>
              <div className="text-xl font-bold text-white">
                {formatTokenAmount(stakingInfo.totalStaked)} wEMARK
              </div>
            </div>
            
            <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="text-sm text-blue-400 mb-1">Available to Vote</div>
              <div className="text-xl font-bold text-white">
                {formatTokenAmount(stakingInfo.availableVotingPower)} wEMARK
              </div>
            </div>
            
            <div className="text-center p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="text-sm text-green-400 mb-1">EMARK Balance</div>
              <div className="text-xl font-bold text-white">
                {formatTokenAmount(stakingInfo.emarkBalance)} EMARK
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center ${
                activeTab === tab.id
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/20'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'stake' && (
          <StakeForm 
            stakingState={stakingState}
            onSuccess={() => {
              setLocalSuccess('Staking transaction submitted successfully!');
              setTimeout(() => setLocalSuccess(null), 5000);
            }}
          />
        )}

        {activeTab === 'unstake' && (
          <div className="space-y-6">
            {/* Unstake Form */}
            <form onSubmit={handleUnstakeSubmit} className="space-y-4">
              <div>
                <label htmlFor="unstake-amount" className="block text-sm font-medium text-gray-300 mb-2">
                  Amount to Unstake
                </label>
                
                <div className="relative">
                  <input
                    id="unstake-amount"
                    type="text"
                    inputMode="decimal"
                    value={unstakeAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setUnstakeAmount(value);
                        setLocalError(null);
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 transition-colors pr-24"
                    placeholder="0.0"
                    disabled={isSubmitting || isUnstaking}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <span className="text-sm text-gray-400">wEMARK</span>
                    <button
                      type="button"
                      onClick={handleMaxUnstake}
                      className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                      disabled={isSubmitting || isUnstaking}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  Available: {stakingInfo ? formatTokenAmount(stakingInfo.wEmarkBalance, true) : '0'} wEMARK
                </div>
              </div>

              <button
                type="submit"
                disabled={!unstakeAmount || isSubmitting || isUnstaking}
                className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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

            {/* Unbonding Period Info */}
            <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start">
                <ClockIcon className="h-5 w-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-200">
                  <p className="font-medium mb-1">Unbonding Period</p>
                  <p>
                    Unstaking requires a {stakingInfo ? StakingService.formatUnbondingPeriod(stakingInfo.unbondingPeriod) : '7 day'} waiting period before your EMARK tokens are available again.
                  </p>
                </div>
              </div>
            </div>

            {/* Pending Unbonding Request */}
            {stakingInfo && stakingInfo.unbondingAmount > BigInt(0) && (
              <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                <h4 className="text-sm font-medium text-orange-300 mb-3">Pending Unbonding Request</h4>
                
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {formatTokenAmount(stakingInfo.unbondingAmount)} EMARK
                    </div>
                    <div className="text-sm text-orange-200">
                      {stakingInfo.canClaimUnbonding ? (
                        <span className="text-green-400 font-medium">Ready to claim!</span>
                      ) : (
                        <>
                          <ClockIcon className="inline h-3 w-3 mr-1" />
                          {formatTimeRemaining(stakingInfo.timeUntilRelease)} remaining
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {stakingInfo.canClaimUnbonding ? (
                    <button
                      onClick={handleCompleteUnstake}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {isSubmitting ? 'Processing...' : 'Claim EMARK'}
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelUnbonding}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 transition-colors disabled:opacity-50 rounded-lg border border-orange-500/30"
                    >
                      <XIcon className="h-4 w-4 inline mr-1" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}