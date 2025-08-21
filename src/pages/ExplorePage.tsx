// src/pages/ExplorePage.tsx - Fixed without feature dependencies
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  SearchIcon, 
  FilterIcon, 
  GridIcon,
  ListIcon,
  TrendingUpIcon,
  ClockIcon,
  StarIcon,
  UserIcon,
  TagIcon,
  PlusIcon,
  CompassIcon
} from 'lucide-react';

import { useAppAuth } from '@/providers/AppContext';
import { useFarcasterUser } from '@/lib/farcaster';
import { themeClasses, cn } from '@/utils/theme';
import { useTheme } from '@/providers/ThemeProvider';
import { useIsMobile } from '@/utils/responsive';

// Import real Evermarks functionality
import { useEvermarksState, EvermarkFeed } from '@/features/evermarks';

type ViewMode = 'grid' | 'list';

// Enhanced stats component with real data
const ExploreStats: React.FC<{ 
  totalCount: number; 
  evermarks: any[];
  isLoading: boolean;
  isDark: boolean; 
}> = ({ totalCount, evermarks, isLoading, isDark }) => {
  const isMobile = useIsMobile();
  
  // Calculate stats from real data
  const thisWeekCount = evermarks.filter(em => {
    const createdAt = new Date(em.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdAt >= weekAgo;
  }).length;
  
  const uniqueCreators = new Set(evermarks.map(em => em.owner)).size;
  const verifiedCount = evermarks.filter(em => em.verificationStatus === 'verified').length;
  
  const statCards = [
    {
      label: 'Total',
      value: isLoading ? '...' : totalCount.toLocaleString(),
      icon: <CompassIcon className="h-5 w-5" />,
      gradient: 'from-cyan-400 to-cyan-600',
      glow: 'shadow-cyan-500/20'
    },
    {
      label: 'This Week',
      value: isLoading ? '...' : thisWeekCount.toLocaleString(),
      icon: <ClockIcon className="h-5 w-5" />,
      gradient: 'from-green-400 to-green-600',
      glow: 'shadow-green-500/20'
    },
    {
      label: 'Creators',
      value: isLoading ? '...' : uniqueCreators.toLocaleString(),
      icon: <UserIcon className="h-5 w-5" />,
      gradient: 'from-purple-400 to-purple-600',
      glow: 'shadow-purple-500/20'
    },
    {
      label: 'Verified',
      value: isLoading ? '...' : verifiedCount.toLocaleString(),
      icon: <StarIcon className="h-5 w-5" />,
      gradient: 'from-amber-400 to-amber-600',
      glow: 'shadow-amber-500/20'
    }
  ];

  return (
    <div className={cn(
      "grid gap-4 mb-8",
      isMobile ? "grid-cols-2" : "grid-cols-4"
    )}>
      {statCards.map((stat, index) => (
        <div
          key={index}
          className={cn(
            "rounded-lg p-4 text-center transition-all duration-300",
            isDark 
              ? "bg-gray-800/50 border border-gray-700 hover:border-gray-600" 
              : "bg-app-bg-card border border-app-border hover:border-app-border-hover",
            stat.glow
          )}
        >
          <div className={cn(
            "w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center bg-gradient-to-r text-black",
            stat.gradient
          )}>
            {stat.icon}
          </div>
          <div className={cn(
            "text-xl font-bold mb-1",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {stat.value}
          </div>
          <div className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
};

// Real Evermark Feed or Empty State
const ExploreContent: React.FC<{ 
  viewMode: ViewMode; 
  evermarks: any[];
  totalCount: number;
  isLoading: boolean;
  isEmpty: boolean;
  isDark: boolean;
}> = ({ viewMode, evermarks, totalCount, isLoading, isEmpty, isDark }) => {
  
  if (isLoading) {
    return (
      <div className={cn(
        "rounded-lg p-8 text-center border",
        isDark 
          ? "bg-gray-800/30 border-gray-700" 
          : "bg-app-bg-card border-app-border"
      )}>
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center animate-pulse">
          <CompassIcon className="h-8 w-8 text-black" />
        </div>
        <h3 className={cn(
          "text-xl font-semibold mb-2",
          isDark ? "text-white" : "text-gray-900"
        )}>Loading Evermarks...</h3>
        <p className={cn(
          "mb-6",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          Fetching preserved content from the blockchain
        </p>
      </div>
    );
  }
  
  if (isEmpty) {
    return (
      <div className={cn(
        "rounded-lg p-8 text-center border",
        isDark 
          ? "bg-gray-800/30 border-gray-700" 
          : "bg-app-bg-card border-app-border"
      )}>
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
          {viewMode === 'grid' ? <GridIcon className="h-8 w-8 text-black" /> : <ListIcon className="h-8 w-8 text-black" />}
        </div>
        <h3 className={cn(
          "text-xl font-semibold mb-2",
          isDark ? "text-white" : "text-gray-900"
        )}>No Evermarks Yet</h3>
        <p className={cn(
          "mb-6",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          {totalCount === 0 
            ? "Be the first to preserve content on the blockchain! Create an Evermark to get started."
            : "No evermarks found with current filters. Try adjusting your search criteria."
          }
        </p>
        {totalCount === 0 && (
          <button
            onClick={() => window.location.href = '/create'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors font-medium"
          >
            <PlusIcon className="h-4 w-4" />
            Create First Evermark
          </button>
        )}
      </div>
    );
  }
  
  // Show the actual EvermarkFeed component
  return (
    <EvermarkFeed 
      variant={viewMode}
      showFilters={false} // We have filters above
      className="space-y-4"
    />
  );
};

// Main ExplorePage component
export default function ExplorePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterUser();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  
  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get real evermarks data
  const {
    evermarks,
    totalCount,
    isLoading,
    isEmpty,
    setFilters,
    setPagination
  } = useEvermarksState();
  
  // Handle search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setFilters({ search: value });
  };

  return (
    <div className={themeClasses.page}>
      {/* Header */}
      <div className={cn(
        "border-b border-cyan-400/30",
        isDark 
          ? "bg-gradient-to-r from-gray-900 via-black to-gray-900" 
          : themeClasses.section
      )}>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/50">
                <CompassIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className={themeClasses.headingHero}>
                EXPLORE EVERMARK BETA
              </h1>
            </div>
            
            <p className={cn(
              "max-w-3xl mx-auto text-lg",
              isDark ? "text-gray-300" : "text-gray-700"
            )}>
              Discover and vote on community-curated content preserved forever on the blockchain.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <ExploreStats 
          totalCount={totalCount}
          evermarks={evermarks}
          isLoading={isLoading}
          isDark={isDark}
        />

        {/* Search and Controls */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search evermarks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn(
                "w-full pl-12 pr-4 py-4 border rounded-lg transition-colors focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-cyan-400"
                  : "bg-app-bg-input border-app-border text-app-text-on-card placeholder-gray-500 focus:border-app-border-focus"
              )}
            />
          </div>

          {/* Controls */}
          <div className={cn(
            "flex justify-between items-center gap-4",
            isMobile && "flex-col space-y-4"
          )}>
            <div className="flex items-center gap-3">
              {/* Filter Button */}
              <button className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                  : "bg-app-bg-card border-app-border text-app-text-on-card hover:bg-app-bg-card-hover"
              )}>
                <FilterIcon className="h-4 w-4" />
                Filters
              </button>

              {/* Sort Dropdown */}
              <select className={cn(
                "px-4 py-2 border rounded-lg transition-colors focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white hover:bg-gray-700 focus:border-cyan-400"
                  : "bg-app-bg-card border-app-border text-app-text-on-card hover:bg-app-bg-card-hover focus:border-purple-400"
              )}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title A-Z</option>
                <option value="author">Author A-Z</option>
                <option value="votes">Most Voted</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              {/* Create Button */}
              {isAuthenticated && (
                <button
                  onClick={() => navigate('/create')}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-colors font-medium"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create
                </button>
              )}

              {/* View Toggle */}
              <div className="flex items-center bg-gray-800 rounded-lg border border-gray-600 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded transition-colors",
                    viewMode === 'grid' 
                      ? 'bg-cyan-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  )}
                  title="Grid view"
                >
                  <GridIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded transition-colors",
                    viewMode === 'list' 
                      ? 'bg-cyan-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  )}
                  title="List view"
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className={cn(
          "gap-8",
          isMobile ? "space-y-8" : "grid grid-cols-1 lg:grid-cols-4"
        )}>
          {/* Main Feed */}
          <div className={cn("space-y-6", !isMobile && "lg:col-span-3")}>
            <ExploreContent 
              viewMode={viewMode}
              evermarks={evermarks}
              totalCount={totalCount}
              isLoading={isLoading}
              isEmpty={isEmpty}
              isDark={isDark}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Connect prompt or voting panel */}
            {!isAuthenticated ? (
              <div className={cn(
                "rounded-lg p-6 text-center border",
                isDark 
                  ? "bg-gray-800/50 border-gray-700" 
                  : "bg-app-bg-card border-app-border"
              )}>
                <TagIcon className={cn(
                  "mx-auto h-12 w-12 mb-4",
                  isDark ? "text-gray-500" : "text-gray-400"
                )} />
                <h3 className={cn(
                  "text-lg font-medium mb-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  Join the Community
                </h3>
                <p className={cn(
                  "mb-4",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Connect your wallet to vote on content and earn rewards
                </p>
                <div className={cn(
                  "border rounded-lg p-4",
                  isDark 
                    ? "bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-blue-500/30" 
                    : "bg-gradient-to-r from-purple-100/50 to-blue-100/50 border-purple-300/30"
                )}>
                  <p className={cn(
                    "text-sm",
                    isDark ? "text-blue-300" : "text-purple-700"
                  )}>
                    {isInFarcaster 
                      ? "🚀 Farcaster wallet integration available"
                      : "🖥️ Connect any Ethereum wallet"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className={cn(
                "rounded-lg p-6 text-center border",
                isDark 
                  ? "bg-gray-800/50 border-gray-700" 
                  : "bg-app-bg-card border-app-border"
              )}>
                <TagIcon className={cn(
                  "mx-auto h-12 w-12 mb-4",
                  isDark ? "text-gray-500" : "text-gray-400"
                )} />
                <h3 className={cn(
                  "text-lg font-medium mb-2",
                  isDark ? "text-white" : "text-gray-900"
                )}>
                  Select Content to Vote
                </h3>
                <p className={cn(
                  "mb-4",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}>
                  Click any Evermark to delegate your voting power
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gray-800/50 border-gray-700" 
                : "bg-app-bg-card border-app-border"
            )}>
              <h3 className={cn(
                "font-semibold mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}>Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/leaderboard')}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors group",
                    isDark 
                      ? "bg-gray-700/50 hover:bg-gray-700" 
                      : "bg-app-bg-secondary hover:bg-app-bg-tertiary"
                  )}
                >
                  <div className="flex items-center">
                    <TrendingUpIcon className="h-4 w-4 text-amber-400 mr-3" />
                    <span className={cn(
                      isDark ? "text-white" : "text-gray-900"
                    )}>View Leaderboard</span>
                  </div>
                  <span className={cn(
                    "transition-colors",
                    isDark 
                      ? "text-gray-400 group-hover:text-white" 
                      : "text-gray-600 group-hover:text-gray-900"
                  )}>→</span>
                </button>
                
                <button
                  onClick={() => navigate('/staking')}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors group",
                    isDark 
                      ? "bg-gray-700/50 hover:bg-gray-700" 
                      : "bg-app-bg-secondary hover:bg-app-bg-tertiary"
                  )}
                >
                  <div className="flex items-center">
                    <StarIcon className="h-4 w-4 text-purple-400 mr-3" />
                    <span className={cn(
                      isDark ? "text-white" : "text-gray-900"
                    )}>Start Staking</span>
                  </div>
                  <span className={cn(
                    "transition-colors",
                    isDark 
                      ? "text-gray-400 group-hover:text-white" 
                      : "text-gray-600 group-hover:text-gray-900"
                  )}>→</span>
                </button>
              </div>
            </div>

            {/* Protocol Info */}
            <div className={cn(
              "rounded-lg p-6 border",
              isDark 
                ? "bg-gradient-to-r from-gray-800/50 to-gray-900/50 border-gray-700" 
                : "bg-app-bg-card border-app-border"
            )}>
              <h3 className={cn(
                "font-semibold mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}>Protocol Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className={cn(
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>Network:</span>
                  <span className="text-green-400 font-medium">Base Mainnet</span>
                </div>
                <div className="flex justify-between">
                  <span className={cn(
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>Storage:</span>
                  <span className="text-cyan-400 font-medium">IPFS + Blockchain</span>
                </div>
                <div className="flex justify-between">
                  <span className={cn(
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}>Status:</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-green-400 font-medium">Live</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}