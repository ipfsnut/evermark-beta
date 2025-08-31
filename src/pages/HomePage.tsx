// src/pages/HomePage.tsx - Updated with Supabase test and real evermarks
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import packageJson from '../../package.json';
import { 
  PlusIcon, 
  TrendingUpIcon, 
  GridIcon,
  ZapIcon,
  StarIcon,
  UserIcon,
  ChevronRightIcon,
  VoteIcon,
  CoinsIcon
} from 'lucide-react';

// Providers and utilities
import { useAppAuth } from '../providers/AppContext';
import { useFarcasterDetection } from '../hooks/useFarcasterDetection';
import { useTheme } from '../providers/ThemeProvider';
import { themeClasses } from '../utils/theme';
import { cn, useIsMobile } from '../utils/responsive';
import { devLog } from '../utils/debug';

// Evermarks feature
import { useEvermarksState, EvermarkFeed } from '../features/evermarks';
import { FarcasterMeta } from '../components/FarcasterMeta';


// Real Protocol Stats using the evermarks hook
const ProtocolStats: React.FC = () => {
  const isMobile = useIsMobile();
  const { totalCount, evermarks, isLoading } = useEvermarksState();
  
  // Calculate stats from real data with null checks
  const safeEvermarks = Array.isArray(evermarks) ? evermarks : [];
  const stats = {
    totalEvermarks: totalCount || 0,
    withImages: safeEvermarks.filter(e => e?.image).length,
    activeCreators: new Set(safeEvermarks.filter(e => e && e.author).map(e => e.author)).size,
    thisWeek: safeEvermarks.filter(e => {
      if (!e?.createdAt) return false;
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(e.createdAt) > weekAgo;
      } catch {
        return false;
      }
    }).length
  };

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
      "grid gap-3",
      isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-4"
    )}>
      {statCards.map((stat, index) => (
        <div
          key={index}
          className={cn(
            "bg-gray-800/50 border border-gray-700 rounded-lg transition-all duration-300 hover:border-gray-600",
            stat.glow,
            isMobile ? "p-3 flex items-center space-x-3" : "p-4 text-center"
          )}
        >
          <div className={cn(
            "rounded-full flex items-center justify-center bg-gradient-to-r text-black flex-shrink-0",
            stat.gradient,
            isMobile ? "w-8 h-8" : "w-10 h-10 mx-auto mb-3"
          )}>
            <div className={cn(isMobile ? "scale-75" : "")}>
              {stat.icon}
            </div>
          </div>
          <div className={cn(isMobile ? "flex-1" : "")}>
            <div className={cn(
              "font-bold text-white",
              isMobile ? "text-base mb-0" : "text-xl mb-1"
            )}>
              {stat.value}
            </div>
            <div className={cn(
              "text-gray-400",
              isMobile ? "text-xs" : "text-sm"
            )}>
              {stat.label}
            </div>
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
      href: '/staking',
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
          className={cn(
            "group bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-all duration-300 hover:shadow-lg",
            isMobile ? "p-4 text-center" : "p-4"
          )}
        >
          <div className={cn(
            "mb-3 rounded-lg flex items-center justify-center bg-gradient-to-r text-black transition-transform group-hover:scale-110",
            action.gradient,
            isMobile ? "w-10 h-10 mx-auto" : "w-10 h-10"
          )}>
            {action.icon}
          </div>
          <h3 className={cn(
            "font-medium text-white mb-1 group-hover:text-gray-100",
            isMobile ? "text-sm" : ""
          )}>
            {action.label}
          </h3>
          <p className={cn(
            "text-gray-400 group-hover:text-gray-300",
            isMobile ? "text-xs" : "text-sm"
          )}>
            {action.description}
          </p>
        </Link>
      ))}
    </div>
  );
};

// Real Evermarks Feed Component
const EvermarksFeed: React.FC = () => {
  const { evermarks, isLoading, error, isEmpty } = useEvermarksState();

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center">
          <GridIcon className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-red-300 mb-2">Failed to Load Evermarks</h3>
        <p className="text-red-400 mb-6">{error}</p>
        <Link
          to="/explore"
          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Explore Page
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
          <GridIcon className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Loading Evermarks...</h3>
        <p className="text-gray-400">Fetching the latest preserved content</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
          <GridIcon className="h-8 w-8 text-black" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Evermarks Yet</h3>
        <p className="text-gray-400 mb-6">
          Be the first to preserve content forever on the blockchain!
        </p>
        <Link
          to="/create"
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Create First Evermark
        </Link>
      </div>
    );
  }

  return (
    <div>
      <EvermarkFeed
        showCreateButton={false}
        showFilters={false}
        variant="grid"
        onEvermarkClick={(evermark) => {
          // Navigate to evermark detail page
          window.location.href = `/evermark/${evermark.id}`;
        }}
        className="space-y-6"
      />
    </div>
  );
};

// Main HomePage component
export default function HomePage() {
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterDetection();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();

  return (
    <div className={themeClasses.page}>
      {/* Default Farcaster Mini App Meta Tags for Homepage */}
      <FarcasterMeta
        title="Evermark Protocol"
        description="Discover amazing content online and earn rewards by sharing Evermarks through community curation"
        imageUrl="https://evermarks.net/og-image.png"
        url="https://evermarks.net"
        buttonText="🚀 Open Evermark"
        buttonAction="link"
      />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden transition-colors duration-200 bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-black dark:to-gray-900">
        {/* Animated background effects - responsive sizing */}
        <div className={cn(
          "absolute top-0 right-0 bg-gradient-to-br from-green-400/20 to-purple-500/20 rounded-full blur-3xl animate-pulse",
          isMobile ? "w-64 h-64 -top-32 -right-32" : "w-96 h-96"
        )} />
        <div className={cn(
          "absolute bottom-0 left-0 bg-gradient-to-tr from-cyan-400/20 to-yellow-500/20 rounded-full blur-3xl animate-pulse",
          isMobile ? "w-64 h-64 -bottom-32 -left-32" : "w-96 h-96"
        )} style={{ animationDelay: '2s' }} />
        
        <div className={cn(
          "relative container mx-auto px-4",
          isMobile ? "py-12" : "py-16 md:py-20"
        )}>
          <div className="text-center space-y-6 sm:space-y-8">
            {/* Logo */}
            <div className={cn("flex justify-center", isMobile ? "mb-6" : "mb-8")}>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-purple-500 rounded-3xl blur-xl opacity-40 scale-110 animate-pulse" />
                <img 
                  src="/EvermarkLogo.png" 
                  alt="Evermark Protocol" 
                  className={cn(
                    "relative w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300",
                    isMobile ? "h-16 sm:h-20" : "h-24 md:h-32"
                  )}
                />
              </div>
            </div>
            
            {/* Title and description */}
            <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
              <h1 className={cn(
                "font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent leading-tight",
                isMobile 
                  ? "text-2xl sm:text-3xl" 
                  : "text-4xl md:text-6xl"
              )}>
                EVERMARK PROTOCOL{' '}
                <span className={cn(
                  "text-cyan-400 font-normal",
                  isMobile ? "text-lg sm:text-xl block mt-1" : "text-2xl md:text-4xl"
                )}>
                  [BETA]
                </span>
              </h1>
              
              <p className={cn(
                "text-gray-300 leading-relaxed max-w-3xl mx-auto",
                isMobile ? "text-base sm:text-lg px-2" : "text-xl md:text-2xl"
              )}>
                Discover amazing content online and earn rewards by sharing Evermarks through{' '}
                <span className="text-green-400 font-bold">community curation</span>
              </p>
              
              {/* Feature badges */}
              <div className={cn(
                "flex flex-wrap justify-center",
                isMobile ? "gap-2 px-4" : "gap-3"
              )}>
                <span className={cn(
                  "bg-green-400/20 text-green-400 rounded-full font-medium border border-green-400/30",
                  isMobile ? "px-3 py-1 text-sm" : "px-4 py-2"
                )}>
                  🔗 Permanent Links
                </span>
                <span className={cn(
                  "bg-purple-400/20 text-purple-400 rounded-full font-medium border border-purple-400/30",
                  isMobile ? "px-3 py-1 text-sm" : "px-4 py-2"
                )}>
                  💰 $WEMARK Rewards
                </span>
                <span className={cn(
                  "bg-cyan-400/20 text-cyan-400 rounded-full font-medium border border-cyan-400/30",
                  isMobile ? "px-3 py-1 text-sm" : "px-4 py-2"
                )}>
                  🗳️ Community Voting
                </span>
                {isInFarcaster && (
                  <span className={cn(
                    "bg-yellow-400/20 text-yellow-400 rounded-full font-medium border border-yellow-400/30",
                    isMobile ? "px-3 py-1 text-sm" : "px-4 py-2"
                  )}>
                    🚀 Farcaster Native
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Protocol Stats */}
      <div className={cn(
        "container mx-auto px-4",
        isMobile ? "py-8" : "py-12"
      )}>
        <ProtocolStats />
      </div>

      {/* Quick Actions */}
      <div className={cn(
        "container mx-auto px-4",
        isMobile ? "py-6" : "py-8"
      )}>
        <div className={cn(
          "text-center",
          isMobile ? "mb-6" : "mb-8"
        )}>
          <h2 className={cn(
            "font-bold text-white mb-2",
            isMobile ? "text-xl" : "text-2xl"
          )}>Get Started</h2>
          <p className={cn(
            "text-gray-400",
            isMobile ? "text-sm px-4" : ""
          )}>Choose your path in the Evermark ecosystem</p>
        </div>
        <QuickActions />
      </div>

      {/* Main Content Layout */}
      <div className={cn(
        "container mx-auto px-4",
        isMobile ? "py-6" : "py-8"
      )}>
        <div className={cn(
          isMobile ? "space-y-6" : "grid grid-cols-1 lg:grid-cols-3 gap-8"
        )}>
          {/* Left Column - Main Feed (2/3 width on desktop) */}
          <div className={cn(
            isMobile ? "space-y-6" : "space-y-8 lg:col-span-2"
          )}>
            <div className="flex items-center justify-between">
              <h2 className={cn(
                "font-bold text-white",
                isMobile ? "text-xl" : "text-2xl"
              )}>Community Feed</h2>
              <Link 
                to="/explore"
                className="inline-flex items-center text-cyan-400 hover:text-cyan-300 font-medium group"
              >
                <span className={cn(isMobile ? "text-sm" : "")}>View All</span>
                <ChevronRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            
            <EvermarksFeed />
          </div>

          {/* Right Column - Sidebar (1/3 width on desktop) */}
          <div className={cn(isMobile ? "space-y-4" : "space-y-6")}>
            {/* Connect prompt for non-authenticated users */}
            {!isAuthenticated ? (
              <div className={cn(
                "bg-gray-800/30 border border-gray-700 rounded-lg text-center",
                isMobile ? "p-4" : "p-6"
              )}>
                <VoteIcon className={cn(
                  "mx-auto text-gray-500 mb-4",
                  isMobile ? "h-10 w-10" : "h-12 w-12"
                )} />
                <h3 className={cn(
                  "font-medium text-white mb-2",
                  isMobile ? "text-base" : "text-lg"
                )}>Join the Community</h3>
                <p className={cn(
                  "text-gray-400 mb-4",
                  isMobile ? "text-sm" : ""
                )}>
                  Connect your wallet to vote on content and earn rewards
                </p>
                <div className={cn(
                  "bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg",
                  isMobile ? "p-3" : "p-4"
                )}>
                  <p className={cn(
                    "text-blue-300",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {isInFarcaster 
                      ? "🚀 Native Farcaster wallet integration ready"
                      : "🖥️ Desktop wallet connection available"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className={cn(
                "bg-gray-800/30 border border-gray-700 rounded-lg text-center",
                isMobile ? "p-4" : "p-6"
              )}>
                <CoinsIcon className={cn(
                  "mx-auto text-gray-500 mb-4",
                  isMobile ? "h-10 w-10" : "h-12 w-12"
                )} />
                <h3 className={cn(
                  "font-medium text-white mb-2",
                  isMobile ? "text-base" : "text-lg"
                )}>Welcome Back!</h3>
                <p className={cn(
                  "text-gray-400 mb-4",
                  isMobile ? "text-sm" : ""
                )}>
                  Your wallet is connected. Start creating and curating content.
                </p>
                <Link
                  to="/create"
                  className={cn(
                    "inline-flex items-center bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors",
                    isMobile ? "px-3 py-2 text-sm" : "px-4 py-2"
                  )}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Evermark
                </Link>
              </div>
            )}

            {/* Community Insights */}
            <div className={cn(
              "bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-lg",
              isMobile ? "p-4" : "p-6"
            )}>
              <h3 className={cn(
                "font-semibold text-white mb-4",
                isMobile ? "text-base" : "text-lg"
              )}>Protocol Insights</h3>
              <div className={cn(
                "space-y-3",
                isMobile ? "text-xs" : "text-sm"
              )}>
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
                  <span className="text-purple-400 font-medium">Beta v{packageJson.version}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      {!isAuthenticated && (
        <div className={cn(
          "container mx-auto px-4",
          isMobile ? "py-12" : "py-16"
        )}>
          <div className={cn(
            "bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-2xl text-center",
            isMobile ? "p-6" : "p-8 md:p-12"
          )}>
            <div className="max-w-3xl mx-auto">
              <h2 className={cn(
                "font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent mb-6",
                isMobile ? "text-2xl" : "text-3xl md:text-4xl"
              )}>
                Ready to Preserve Something Amazing?
              </h2>
              <p className={cn(
                "text-gray-300 leading-relaxed",
                isMobile ? "text-base mb-6" : "text-lg mb-8"
              )}>
                Transform any online content into a permanent, shareable Evermark. 
                Join our community of curators and earn <span className="text-green-400 font-bold">$WEMARK</span> rewards.
              </p>
              
              <div className={cn(
                "flex justify-center",
                isMobile ? "flex-col gap-3 max-w-sm mx-auto" : "flex-row gap-4"
              )}>
                <Link
                  to="/create"
                  className={cn(
                    "inline-flex items-center justify-center bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-lg hover:from-green-300 hover:to-green-500 transition-all shadow-lg shadow-green-500/30",
                    isMobile ? "px-6 py-3 text-sm" : "px-8 py-4"
                  )}
                >
                  <ZapIcon className="w-5 h-5 mr-2" />
                  <span className={isMobile ? "text-sm" : ""}>
                    Create Your First Evermark
                  </span>
                </Link>
                <Link
                  to="/explore"
                  className={cn(
                    "inline-flex items-center justify-center bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors",
                    isMobile ? "px-6 py-3 text-sm" : "px-8 py-4"
                  )}
                >
                  <GridIcon className="w-5 h-5 mr-2" />
                  <span className={isMobile ? "text-sm" : ""}>
                    Explore All Evermarks
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}