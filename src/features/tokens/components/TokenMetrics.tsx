import { 
  TrendingUp,
  Coins,
  ShieldCheck,
  DollarSign
} from 'lucide-react';

interface TokenMetricsProps {
  tokenState: any;
  stakingState: any;
  className?: string;
}

export function TokenMetrics({ tokenState, stakingState, className = '' }: TokenMetricsProps) {
  const { tokenBalance, formatTokenAmount } = tokenState;
  const { stakingInfo } = stakingState;
  
  if (!tokenBalance || !stakingInfo) {
    return (
      <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalPortfolioValue = tokenBalance.emarkBalance + stakingInfo.totalStaked;
  const stakingPercentage = totalPortfolioValue > BigInt(0) 
    ? Number((stakingInfo.totalStaked * BigInt(100)) / totalPortfolioValue)
    : 0;

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg ${className}`}>
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-green-400" />
            Portfolio Overview
          </h3>
          <div className="text-sm text-gray-400">
            Total Value: {formatTokenAmount(totalPortfolioValue)} EMARK
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Available Balance */}
          <div className="bg-gray-700/30 border border-gray-600/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Coins className="h-5 w-5 text-blue-400" />
              <span className="text-xs text-gray-400">Available</span>
            </div>
            <div className="text-xl font-bold text-blue-300">
              {formatTokenAmount(tokenBalance.emarkBalance)}
            </div>
            <div className="text-xs text-gray-500">EMARK</div>
          </div>

          {/* Staked Amount */}
          <div className="bg-gray-700/30 border border-gray-600/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <span className="text-xs text-gray-400">Staked</span>
            </div>
            <div className="text-xl font-bold text-purple-300">
              {stakingState.formatTokenAmount(stakingInfo.totalStaked)}
            </div>
            <div className="text-xs text-gray-500">wEMARK</div>
          </div>

          {/* Voting Power */}
          <div className="bg-gray-700/30 border border-gray-600/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              <span className="text-xs text-gray-400">Voting Power</span>
            </div>
            <div className="text-xl font-bold text-cyan-300">
              {stakingState.formatTokenAmount(stakingInfo.availableVotingPower)}
            </div>
            <div className="text-xs text-gray-500">Available</div>
          </div>

          {/* Staking Ratio */}
          <div className="bg-gray-700/30 border border-gray-600/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-green-400" />
              <span className="text-xs text-gray-400">Staked</span>
            </div>
            <div className="text-xl font-bold text-green-300">
              {stakingPercentage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">of Portfolio</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">Asset Allocation</span>
            <span className="text-xs text-gray-500">
              {(100 - stakingPercentage).toFixed(1)}% Available, {stakingPercentage.toFixed(1)}% Staked
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${stakingPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}