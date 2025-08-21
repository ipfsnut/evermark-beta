// src/pages/StakePage.tsx - Staking management page
import { StakingWidget } from '@/features/staking';
import { TokenBalance } from '@/features/tokens';
import { useStakingState } from '@/features/staking';
import { useContractsStatus } from '@/hooks/core/useContracts';
import { TrendingUpIcon, CoinsIcon, AlertCircleIcon, CheckCircleIcon } from 'lucide-react';
import { cn, useIsMobile } from '@/utils/responsive';
import { themeClasses } from '@/utils/theme';

export default function StakePage() {
  const stakingState = useStakingState();
  const contractsStatus = useContractsStatus();
  const isMobile = useIsMobile();
  
  const requiredContracts = ['emarkToken', 'wemark'];
  const missingRequiredContracts = requiredContracts.filter(contract => 
    contractsStatus.missing.includes(contract)
  );

  return (
    <div className={themeClasses.page}>
      {/* Header */}
      <div className={cn(
        themeClasses.section,
        "border-b border-purple-400/30"
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                <TrendingUpIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className={themeClasses.headingHero}>
                STAKING CENTER <span className="text-2xl md:text-3xl text-cyan-400 font-normal">[BETA]</span>
              </h1>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              themeClasses.textSecondary
            )}>
              Stake your EMARK tokens to receive wEMARK voting power for content curation.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Contract Status Warning */}
        {missingRequiredContracts.length > 0 && (
          <div className={cn(themeClasses.card, "mb-8 bg-amber-500/10 border-amber-500/30")}>
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-amber-400 mb-2">
                  Beta Configuration Required
                </h3>
                <p className="text-amber-200 text-sm mb-3">
                  Some staking contracts are not configured. Please check your environment variables:
                </p>
                <ul className="text-amber-200 text-sm space-y-1">
                  {missingRequiredContracts.includes('emarkToken') && (
                    <li>• <code className="bg-amber-500/20 px-1 rounded">VITE_EMARK_TOKEN_ADDRESS</code> - EMARK Token contract</li>
                  )}
                  {missingRequiredContracts.includes('wemark') && (
                    <li>• <code className="bg-amber-500/20 px-1 rounded">VITE_WEMARK_ADDRESS</code> - WEMARK Token contract</li>
                  )}
                </ul>
                <p className="text-amber-200 text-xs mt-3">
                  Staking features will be limited until all contracts are configured.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Success message when contracts are configured */}
        {missingRequiredContracts.length === 0 && (
          <div className="mb-8 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-5 h-5 text-green-400" />
              <p className="text-green-200 text-sm">
                ✅ All staking contracts are configured and ready for Beta testing
              </p>
            </div>
          </div>
        )}

        <div className={cn(
          "grid gap-8",
          isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
        )}>
          {/* Left Column - Token Management */}
          <div className="space-y-6">
            {/* Token Balance Widget */}
            <TokenBalance
              variant="full"
              showActions={false}
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
                    <div className="text-sm text-gray-400 mb-1">Real-Time APR</div>
                    <div className="text-lg font-bold text-green-400">
                      {stakingState.stakingStats.realTimeAPR.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Help Section */}
            <div className={cn(themeClasses.card, "bg-blue-500/10 border-blue-500/30")}>
              <h4 className="text-blue-300 font-medium mb-3">💡 Pro Tips</h4>
              <div className="text-sm text-blue-200 space-y-2">
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