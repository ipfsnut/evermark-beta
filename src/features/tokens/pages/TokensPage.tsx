import { useState } from 'react';
import { 
  Coins,
  Send,
  History,
  TrendingUp,
  Info
} from 'lucide-react';
import { useTokenState } from '../hooks/useTokenState';
import { useStakingState } from '@/features/staking';
import { themeClasses } from '@/utils/theme';
import { TokenMetrics } from '../components/TokenMetrics';
import { TokenTransfer } from '../components/TokenTransfer';
import { TokenHistory } from '../components/TokenHistory';
import { TokenBalance } from '../components/TokenBalance';
import { cn, useIsMobile } from '@/utils/responsive';

export default function TokensPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const isMobile = useIsMobile();
  
  const tokenState = useTokenState();
  const stakingState = useStakingState();
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'transfer', label: 'Send', icon: Send },
    { id: 'history', label: 'History', icon: History }
  ];

  if (!tokenState.isConnected) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
            <Coins className="mx-auto h-16 w-16 text-gray-500 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to manage your EMARK tokens, view transaction history, and more.
            </p>
            <button className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-purple-400/30">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/50">
                <Coins className="h-7 w-7 text-black" />
              </div>
              <h1 className={themeClasses.headingHero}>
                TOKEN MANAGER
              </h1>
            </div>
            
            <p className="text-gray-300 max-w-3xl mx-auto text-lg">
              Manage your EMARK tokens, send transfers, and track your transaction history.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="container mx-auto px-4">
          <div className={cn(
            "flex",
            isMobile ? "space-x-4" : "space-x-8"
          )}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center px-4 py-4 text-sm font-medium transition-colors border-b-2",
                    activeTab === tab.id
                      ? 'text-purple-400 border-purple-400'
                      : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-600'
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Portfolio Metrics */}
            <TokenMetrics 
              tokenState={tokenState} 
              stakingState={stakingState}
            />
            
            {/* Two Column Layout */}
            <div className={cn(
              "grid gap-8",
              isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"
            )}>
              {/* Enhanced Token Balance */}
              <TokenBalance
                variant="full"
                showActions={true}
                showApprovalStatus={true}
                onApprovalSuccess={() => {
                  // Refresh token data after approval
                  tokenState.refetch();
                }}
              />

              {/* Recent Transactions Preview */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <History className="h-5 w-5 mr-2 text-purple-400" />
                    Recent Activity
                  </h3>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    View All
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <History className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                      <p className="text-gray-400">Transaction history will appear here</p>
                      <button
                        onClick={() => setActiveTab('history')}
                        className="mt-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        View Transaction History
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveTab('transfer')}
                className="p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-lg hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-200 group"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-blue-600/30 rounded-lg mr-4 group-hover:bg-blue-500/40 transition-colors">
                    <Send className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-white">Send EMARK</h3>
                    <p className="text-sm text-gray-400">Transfer tokens to any address</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className="p-6 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 rounded-lg hover:from-purple-500/30 hover:to-cyan-500/30 transition-all duration-200 group"
              >
                <div className="flex items-center">
                  <div className="p-3 bg-purple-600/30 rounded-lg mr-4 group-hover:bg-purple-500/40 transition-colors">
                    <History className="h-6 w-6 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-white">Transaction History</h3>
                    <p className="text-sm text-gray-400">View all your token activity</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Information Section */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-200 space-y-2">
                  <p>
                    <strong className="text-blue-300">EMARK Tokens:</strong> The native utility token of the Evermark protocol. 
                    Use EMARK for staking and voting power in content curation.
                  </p>
                  <p>
                    <strong className="text-blue-300">Token Management:</strong> Send tokens to other addresses, track your transaction history, 
                    and manage approvals for smart contracts.
                  </p>
                  <p>
                    <strong className="text-blue-300">Staking Integration:</strong> Stake your EMARK tokens to receive wEMARK voting power 
                    and participate in content curation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="max-w-2xl mx-auto">
            <TokenTransfer tokenState={tokenState} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto">
            <TokenHistory />
          </div>
        )}
      </div>
    </div>
  );
}