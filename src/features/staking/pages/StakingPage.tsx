// src/pages/StakePage.tsx - Staking management page
import { StakingWidget } from '@/features/staking';
import { TokenBalance } from '@/features/tokens';
import { useStakingState } from '@/features/staking';
import { TrendingUpIcon, CoinsIcon } from 'lucide-react';
import { cn, useIsMobile } from '@/utils/responsive';

export default function StakePage() {
  const stakingState = useStakingState();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-purple-400/30">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                <TrendingUpIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-green-500 bg-clip-text text-transparent">
                STAKING CENTER
              </h1>
            </div>
            
            <p className="text-gray-300 max-w-3xl mx-auto text-lg">
              Stake your EMARK tokens to receive wEMARK voting power and participate in governance.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className={cn(
          "grid gap-8",
          isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
        )}>
          {/* Left Column - Token Management */}
          <div className="space-y-6">
            {/* Token Balance Widget */}
            <TokenBalance
              variant="full"
              showActions={true}
              showApprovalStatus={true}
              onApprovalSuccess={() => {
                // Refresh staking data after approval
                stakingState.refetch();
              }}
            />

            {/* Staking Information */}
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center">
                <CoinsIcon className="h-5 w-5 mr-2" />
                How Staking Works
              </h3>
              <div className="space-y-3 text-sm text-blue-200">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-blue-300 mb-1">Approve EMARK</p>
                    <p>Allow the staking contract to use your EMARK tokens</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-purple-300 mb-1">Stake Tokens</p>
                    <p>Convert EMARK to wEMARK to gain voting power</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-green-300 mb-1">Earn Rewards</p>
                    <p>Use voting power to delegate and earn rewards</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Staking Interface */}
          <div className="space-y-6">
            {/* Main Staking Widget */}
            <StakingWidget
              stakingState={stakingState}
              className="w-full"
            />

            {/* Quick Stats */}
            {stakingState.stakingStats && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Your Staking Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Stake Percentage</div>
                    <div className="text-lg font-bold text-purple-400">
                      {stakingState.stakingStats.userStakePercentage.toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-center p-3 bg-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Estimated APR</div>
                    <div className="text-lg font-bold text-green-400">
                      {stakingState.stakingStats.aprEstimate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Help Section */}
            <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-6">
              <h4 className="text-yellow-300 font-medium mb-3">💡 Pro Tips</h4>
              <div className="text-sm text-yellow-200 space-y-2">
                <p>• Stake more tokens to get higher voting power multipliers</p>
                <p>• wEMARK can be used to vote on quality content for rewards</p>
                <p>• Unstaking has a 7-day waiting period for security</p>
                <p>• Regular participation increases your reward multiplier</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}