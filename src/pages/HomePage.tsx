// src/pages/HomePage.tsx - Main homepage composing all features
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlusIcon, 
  TrendingUpIcon, 
  GridIcon,
  ZapIcon,
  StarIcon,
  UserIcon,
  ChevronRightIcon,
  RocketIcon,
  CoinsIcon,
  VoteIcon
} from 'lucide-react';

// Feature imports
import { EvermarkFeed, useEvermarksState } from '@/features/evermarks';
import { StakingWidget, useStakingState } from '@/features/staking';
import { VotingPanel, useVotingState } from '@/features/voting';
import { TokenBalance, useTokenState } from '@/features/tokens';

// Providers and utilities
import { useAppAuth } from '@/providers/AppContext';
import { useFarcasterUser } from '@/lib/farcaster';
import { cn, useIsMobile } from '@/utils/responsive';

// Enhanced stats component with real data
const ProtocolStats: React.FC = () => {
  const { evermarks, totalCount, isLoading } = useEvermarksState();
  const { stakingInfo } = useStakingState();
  const { votingStats } = useVotingState();
  const isMobile = useIsMobile();
  
  const stats = React.useMemo(() => {
    const recentEvermarks = evermarks.slice(0, 100);
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thisWeekCount = recentEvermarks.filter(e => 
      new Date(e.createdAt).getTime() > weekAgo
    ).length;
    
    const uniqueCreators = new Set(recentEvermarks.map(e => e.creator)).size;
    const withImages = recentEvermarks.filter(e => e.image).length;

    return {
      totalEvermarks: totalCount || recentEvermarks.length,
      activeCreators: uniqueCreators,
      thisWeek: thisWeekCount,
      withImages,
      totalStaked: stakingInfo?.totalProtocolStaked || BigInt(0),
      activeVoters: votingStats?.participationRate ? Math.floor(uniqueCreators * votingStats.participationRate) : 0
    };
  }, [evermarks, totalCount, stakingInfo, votingStats]);

  const statCards = [
    {
      label: 'Total Evermarks',
      value: isLoading ? '...' : stats.totalEvermarks.toLocaleString(),
      icon: <StarIcon className="h-5 w-5" />,
      gradient: 'from-purple-400 to-purple-600',
      glow: 'shadow-purple-500/20'
    },
    {
      label: 'With Media',
      value: isLoading ? '...' : stats.withImages.toLocaleString(),
      icon: <GridIcon className="h-5 w-5" />,
      gradient: 'from-green-400 to-green-600',
      glow: 'shadow-green-500/20'
    },
    {
      label: 'Active Creators',
      value: isLoading ? '...' : stats.activeCreators.toLocaleString(),
      icon: <UserIcon className="h-5 w-5" />,
      gradient: 'from-cyan-400 to-cyan-600',
      glow: 'shadow-cyan-500/20'
    },
    {
      label: 'This Week',
      value: isLoading ? '...' : stats.thisWeek.toLocaleString(),
      icon: <TrendingUpIcon className="h-5 w-5" />,
      gradient: 'from-yellow-400 to-yellow-600',
      glow: 'shadow-yellow-500/20'
    }
  ];

  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-2" : "grid-cols-1 md:grid-cols-4"
    )}>
      {statCards.map((stat, index) => (
        <div
          key={index}
          className={cn(
            "bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center transition-all duration-300 hover:border-gray-600",
            stat.glow
          )}
        >
          <div className={cn(
            "w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center bg-gradient-to-r text-black",
            stat.gradient
          )}>
            {stat.icon}
          </div>
          <div className="text-xl font-bold text-white mb-1">
            {stat.value}
          </div>
          <div className="text-gray-400 text-sm">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
};

// Quick Actions component
const QuickActions: React.FC = () => {
  const { isAuthenticated } = useAppAuth();
  const isMobile = useIsMobile();

  const actions = [
    {
      label: 'Create Evermark',
      description: 'Preserve content forever',
      icon: <PlusIcon className="h-5 w-5" />,
      href: '/create',
      gradient: 'from-green-400 to-green-600',
      requireAuth: true
    },
    {
      label: 'Explore All',
      description: 'Browse the collection',
      icon: <GridIcon className="h-5 w-5" />,
      href: '/explore',
      gradient: 'from-blue-400 to-blue-600',
      requireAuth: false
    },
    {
      label: 'Start Staking',
      description: 'Earn voting power',
      icon: <CoinsIcon className="h-5 w-5" />,
      href: '/stake',
      gradient: 'from-purple-400 to-purple-600',
      requireAuth: true
    },
    {
      label: 'View Rankings',
      description: 'See community favorites',
      icon: <TrendingUpIcon className="h-5 w-5" />,
      href: '/leaderboard',
      gradient: 'from-yellow-400 to-yellow-600',
      requireAuth: false
    }
  ];

  const availableActions = actions.filter(action => 
    !action.requireAuth || isAuthenticated
  );

  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4"
    )}>
      {availableActions.map((action, index) => (
        <Link
          key={index}
          to={action.href}
          className="group bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 hover:shadow-lg"
        >
          <div className={cn(
            "w-10 h-10 mb-3 rounded-lg flex items-center justify-center bg-gradient-to-r text-black transition-transform group-hover:scale-110",
            action.gradient
          )}>
            {action.icon}
          </div>
          <h3 className="font-medium text-white mb-1 group-hover:text-gray-100">
            {action.label}
          </h3>
          <p className="text-sm text-gray-400 group-hover:text-gray-300">
            {action.description}
          </p>
        </Link>
      ))}
    </div>
  );
};

// Main HomePage component
export default function HomePage() {
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterUser();
  const isMobile = useIsMobile();
  
  // Feature state hooks
  const evermarksState = useEvermarksState();
  const stakingState = useStakingState();
  const votingState = useVotingState();
  const tokenState = useTokenState();

  const [selectedEvermarkId, setSelectedEvermarkId] = useState<string | null>(null);

  const handleEvermarkClick = (evermark: any) => {
    if (isAuthenticated) {
      setSelectedEvermarkId(evermark.id);
    }
  };

  const handleCreateClick = () => {
    // EvermarkFeed component should handle this
    evermarksState.loadEvermarks({ page: 1 });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
        {/* Animated background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-cyan-400/20 to-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="relative container mx-auto px-4 py-16 md:py-20">
          <div className="text-center space-y-8">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-purple-500 rounded-3xl blur-xl opacity-40 scale-110 animate-pulse" />
                <img 
                  src="/EvermarkLogo.png" 
                  alt="Evermark Protocol" 
                  className="relative h-24 md:h-32 w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>
            
            {/* Title and description */}
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight">
                EVERMARK PROTOCOL
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
                Discover amazing content online and earn rewards by sharing Evermarks through{' '}
                <span className="text-green-400 font-bold">community curation</span>
              </p>
              
              {/* Feature badges */}
              <div className="flex flex-wrap gap-3 justify-center">
                <span className="px-4 py-2 bg-green-400/20 text-green-400 rounded-full font-medium border border-green-400/30">
                  🔗 Permanent Links
                </span>
                <span className="px-4 py-2 bg-purple-400/20 text-purple-400 rounded-full font-medium border border-purple-400/30">
                  💰 $WEMARK Rewards
                </span>
                <span className="px-4 py-2 bg-cyan-400/20 text-cyan-400 rounded-full font-medium border border-cyan-400/30">
                  🗳️ Community Voting
                </span>
                {isInFarcaster && (
                  <span className="px-4 py-2 bg-yellow-400/20 text-yellow-400 rounded-full font-medium border border-yellow-400/30">
                    🚀 Farcaster Native
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Stats */}
      <div className="container mx-auto px-4 py-12">
        <ProtocolStats />
      </div>

      {/* Quick Actions */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
          <p className="text-gray-400">Choose your path in the Evermark ecosystem</p>
        </div>
        <QuickActions />
      </div>

      {/* Main Content Layout */}
      <div className="container mx-auto px-4 py-8">
        <div className={cn(
          "gap-8",
          isMobile ? "space-y-8" : "grid grid-cols-1 lg:grid-cols-3"
        )}>
          {/* Left Column - Main Feed (2/3 width on desktop) */}
          <div className={cn("space-y-8", !isMobile && "lg:col-span-2")}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Community Feed</h2>
              <Link 
                to="/explore"
                className="inline-flex items-center text-cyan-400 hover:text-cyan-300 font-medium group"
              >
                View All
                <ChevronRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <EvermarkFeed 
              className="bg-gray-800/30 border border-gray-700 rounded-lg"
              showCreateButton={true}
              showFilters={true}
              onCreateClick={handleCreateClick}
              onEvermarkClick={handleEvermarkClick}
              variant="grid"
              emptyMessage="No evermarks found. Be the first to create one!"
            />
          </div>

          {/* Right Column - Sidebar (1/3 width on desktop) */}
          <div className="space-y-6">
            {/* Token Balance Widget */}
            {isAuthenticated && (
              <TokenBalance 
                variant="compact"
                showActions={true}
                showApprovalStatus={true}
                className="bg-gray-800/30 border border-gray-700"
              />
            )}

            {/* Staking Widget */}
            {isAuthenticated ? (
              <StakingWidget 
                stakingState={stakingState}
                className="bg-gray-800/30 border border-gray-700"
              />
            ) : (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
                <CoinsIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Start Staking</h3>
                <p className="text-gray-400 mb-4">
                  Stake EMARK tokens to earn voting power and participate in governance
                </p>
                <Link
                  to="/stake"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-500 hover:to-blue-500 transition-colors"
                >
                  <RocketIcon className="h-4 w-4 mr-2" />
                  Get Started
                </Link>
              </div>
            )}

            {/* Voting Panel */}
            {selectedEvermarkId && isAuthenticated ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Vote on Content</h3>
                  <button
                    onClick={() => setSelectedEvermarkId(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <VotingPanel 
                  evermarkId={selectedEvermarkId}
                  className="bg-gray-800/30 border border-gray-700"
                />
              </div>
            ) : isAuthenticated ? (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
                <VoteIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Community Voting</h3>
                <p className="text-gray-400 mb-4">
                  Click any Evermark to delegate your voting power and support quality content
                </p>
                <Link
                  to="/leaderboard"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-colors"
                >
                  <TrendingUpIcon className="h-4 w-4 mr-2" />
                  View Rankings
                </Link>
              </div>
            ) : (
              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
                <VoteIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Join the Community</h3>
                <p className="text-gray-400 mb-4">
                  Connect your wallet to vote on content and earn rewards
                </p>
                <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    {isInFarcaster 
                      ? "🚀 Native Farcaster wallet integration ready"
                      : "🖥️ Desktop wallet connection available"
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Community Insights */}
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Protocol Insights</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-green-400 font-medium">Base Mainnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Storage:</span>
                  <span className="text-cyan-400 font-medium">IPFS + Blockchain</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400 font-medium flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    Live
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Version:</span>
                  <span className="text-purple-400 font-medium">Beta v2.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      {!isAuthenticated && (
        <div className="container mx-auto px-4 py-16">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 md:p-12 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent mb-6">
                Ready to Preserve Something Amazing?
              </h2>
              <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                Transform any online content into a permanent, shareable Evermark. 
                Join our community of curators and earn <span className="text-green-400 font-bold">$WEMARK</span> rewards.
              </p>
              
              <div className={cn(
                "flex gap-4 justify-center",
                isMobile ? "flex-col" : "flex-row"
              )}>
                <Link
                  to="/create"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-lg hover:from-green-300 hover:to-green-500 transition-all shadow-lg shadow-green-500/30"
                >
                  <ZapIcon className="w-5 h-5 mr-2" />
                  Create Your First Evermark
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex items-center px-8 py-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <GridIcon className="w-5 h-5 mr-2" />
                  Explore All Evermarks
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}