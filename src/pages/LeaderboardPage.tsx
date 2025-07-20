// src/pages/LeaderboardPage.tsx - Community rankings page (enhanced)
import React, { useState } from 'react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useProfile } from '@/hooks/useProfile';
import { useDelegationHistory } from '@/hooks/useDelegationHistory';
import { VotingPanel } from '@/features/voting';
import { LeaderboardEvermarkCard } from '@/components/evermark/EvermarkCard';
import { EnhancedEvermarkModal } from '@/components/evermark/EnhancedEvermarkModal';
import { useModal } from '@/hooks/useModal';
import { toEther } from 'thirdweb/utils';
import { 
  TrophyIcon, 
  ZapIcon, 
  CalendarIcon,
  InfoIcon,
  TrendingUpIcon,
  UsersIcon,
  CoinsIcon
} from 'lucide-react';
import { cn, useIsMobile } from '@/utils/responsive';

type LeaderboardTab = 'current' | 'previous' | 'delegate';

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('current');
  const [selectedEvermarkId, setSelectedEvermarkId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  const { primaryAddress } = useProfile();
  const { delegationStats } = useDelegationHistory(primaryAddress);
  
  // Get current and previous week leaderboards
  const currentWeek = useLeaderboard();
  const previousWeekNumber = currentWeek.weekNumber > 1 ? currentWeek.weekNumber - 1 : 1;
  const previousWeek = useLeaderboard(previousWeekNumber);
  
  const activeLeaderboard = activeTab === 'current' ? currentWeek : previousWeek;

  // Use the unified modal hook
  const { modalState, openModal, closeModal } = useModal();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Cyber Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-green-400/30">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            {/* Title Section */}
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50">
                <TrophyIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-green-400 via-yellow-400 to-purple-500 bg-clip-text text-transparent">
                LEADERBOARD
              </h1>
            </div>
            
            <p className="text-gray-300 max-w-3xl mx-auto text-lg leading-relaxed">
              Weekly rankings powered by <span className="text-green-400 font-bold">$WEMARK</span> delegations. 
              Support your favorite content and earn multiplied rewards.
            </p>
            
            {/* Status Indicators */}
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
                <CalendarIcon className="h-4 w-4 text-cyan-400" />
                <span className="text-gray-300">Week {currentWeek.weekNumber}</span>
              </div>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full font-medium border",
                currentWeek.isFinalized 
                  ? 'bg-green-900/30 text-green-400 border-green-400/50' 
                  : 'bg-orange-900/30 text-orange-400 border-orange-400/50 animate-pulse'
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  currentWeek.isFinalized ? 'bg-green-400' : 'bg-orange-400'
                )} />
                <span>{currentWeek.isFinalized ? 'FINALIZED' : 'LIVE VOTING'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Delegation Dashboard */}
      {primaryAddress && (
        <div className="container mx-auto px-4 py-6">
          <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6 backdrop-blur-sm">
            <div className={cn(
              "flex justify-between items-center",
              isMobile && "flex-col space-y-4 text-center"
            )}>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-purple-400">Your Power Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <ZapIcon className="h-4 w-4 text-yellow-400" />
                    <span className="text-gray-300">
                      {parseFloat(toEther(delegationStats.totalDelegated)).toFixed(2)} wEMARK
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUpIcon className="h-4 w-4 text-green-400" />
                    <span className="text-gray-300">
                      {delegationStats.rewardMultiplier.toFixed(2)}x Multiplier
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CoinsIcon className="h-4 w-4 text-cyan-400" />
                    <span className="text-gray-300">
                      {delegationStats.weeklyDelegations} This Week
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <a 
                  href="/wrapping" 
                  className="px-4 py-2 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded hover:from-green-300 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
                >
                  Get wEMARK
                </a>
                <button
                  onClick={() => setActiveTab('delegate')}
                  className="px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                >
                  Delegate Power
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-gray-900/50 border-b border-gray-700 sticky top-0 z-10 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex justify-center">
            {[
              { key: 'current', label: 'CURRENT WEEK', icon: '🔥' },
              { key: 'previous', label: 'PREVIOUS WEEK', icon: '📈' },
              { key: 'delegate', label: 'DELEGATE POWER', icon: '⚡' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as LeaderboardTab)}
                className={cn(
                  "py-4 px-6 border-b-2 font-bold text-sm transition-all duration-200",
                  activeTab === tab.key
                    ? 'border-green-400 text-green-400 bg-green-400/10'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600',
                  isMobile && "flex-1 text-center text-xs px-3"
                )}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {(activeTab === 'current' || activeTab === 'previous') && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {activeLeaderboard.entries.length}
                </div>
                <div className="text-gray-400 text-sm">Total Entries</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {activeLeaderboard.entries.length > 0 
                    ? parseFloat(toEther(activeLeaderboard.entries[0].votes)).toFixed(0)
                    : '0'
                  }
                </div>
                <div className="text-gray-400 text-sm">Top Votes</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-400 mb-1">
                  {activeLeaderboard.weekNumber}
                </div>
                <div className="text-gray-400 text-sm">Week #</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <div className={cn(
                  "text-2xl font-bold mb-1",
                  activeLeaderboard.isFinalized ? 'text-green-400' : 'text-orange-400'
                )}>
                  {activeLeaderboard.isFinalized ? 'FINAL' : 'LIVE'}
                </div>
                <div className="text-gray-400 text-sm">Status</div>
              </div>
            </div>

            {/* Leaderboard Entries */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {activeTab === 'current' ? 'Current Rankings' : 'Previous Week Results'}
                </h2>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <UsersIcon className="h-4 w-4" />
                  <span>{activeLeaderboard.entries.length} competing</span>
                </div>
              </div>
              
              {activeLeaderboard.isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-gray-800 rounded-lg h-64 animate-pulse border border-gray-700" />
                  ))}
                </div>
              ) : activeLeaderboard.error ? (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-8 text-center">
                  <div className="text-red-400 text-4xl mb-4">⚠️</div>
                  <h3 className="text-lg font-medium text-white mb-2">Error Loading Leaderboard</h3>
                  <p className="text-red-400 mb-4">{activeLeaderboard.error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : activeLeaderboard.entries.length === 0 ? (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center">
                  <div className="text-6xl mb-4">🏆</div>
                  <h3 className="text-xl font-medium text-white mb-2">No Entries Yet</h3>
                  <p className="text-gray-400 mb-6">Be the first to delegate $WEMARK this week!</p>
                  <button
                    onClick={() => setActiveTab('delegate')}
                    className="bg-gradient-to-r from-green-400 to-green-600 text-black font-bold px-6 py-3 rounded hover:from-green-300 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
                  >
                    Start Delegating
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeLeaderboard.entries.map((entry) => (
                    <LeaderboardEvermarkCard
                      key={entry.evermark.id}
                      evermark={entry.evermark}
                      rank={entry.rank}
                      votes={entry.votes}
                      onOpenModal={openModal}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Delegation Tab */}
        {activeTab === 'delegate' && (
          <div className="space-y-8">
            {!primaryAddress ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">🔗</div>
                <h3 className="text-xl font-medium text-white mb-2">Connect Your Wallet</h3>
                <p className="text-gray-400">
                  Connect your wallet to delegate $WEMARK and participate in weekly rankings
                </p>
              </div>
            ) : (
              <>
                {/* Instructions */}
                <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-400 mb-4">
                    ⚡ How $WEMARK Delegation Works
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                    <div className="space-y-2">
                      <p>• Wrap your EMARK tokens to get $WEMARK voting power</p>
                      <p>• Delegate $WEMARK to support your favorite Evermarks</p>
                    </div>
                    <div className="space-y-2">
                      <p>• Earn reward multipliers: 50%+ = 1.25x, 75%+ = 1.5x, 100% = 2x</p>
                      <p>• Get consistency bonuses for regular participation</p>
                    </div>
                  </div>
                </div>

                {/* Voting Panel */}
                {selectedEvermarkId ? (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
                    <div className="p-6 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">
                          Delegate to Evermark #{selectedEvermarkId}
                        </h3>
                        <button
                          onClick={() => setSelectedEvermarkId(null)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          ✕ Close
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                      <VotingPanel evermarkId={selectedEvermarkId} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
                    <div className="text-6xl mb-4">🎯</div>
                    <h3 className="text-xl font-medium text-white mb-2">
                      Select an Evermark to Support
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Click any Evermark above to open its details and delegate your voting power.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => setActiveTab('current')}
                        className="bg-gradient-to-r from-green-400 to-green-600 text-black font-bold px-6 py-3 rounded hover:from-green-300 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
                      >
                        View Current Rankings
                      </button>
                      <a 
                        href="/explore"
                        className="bg-gray-700 text-white px-6 py-3 rounded hover:bg-gray-600 transition-colors"
                      >
                        Browse All Evermarks
                      </a>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Evermark Modal */}
      {modalState.isOpen && (
        <EnhancedEvermarkModal
          evermarkId={modalState.evermarkId}
          isOpen={modalState.isOpen}
          onClose={closeModal}
          autoExpandDelegation={modalState.options.autoExpandDelegation}
          initialExpandedSection={modalState.options.initialExpandedSection}
        />
      )}
    </div>
  );
}