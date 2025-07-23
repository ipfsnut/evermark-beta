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
import { cn, useIsMobile } from '@/utils/responsive';

type ViewMode = 'grid' | 'list';

// Mock data for demonstration
const mockStats = {
  total: 1234,
  thisWeek: 42,
  creators: 89,
  verified: 234
};

// Enhanced stats component
const ExploreStats: React.FC = () => {
  const isMobile = useIsMobile();
  
  const statCards = [
    {
      label: 'Total',
      value: mockStats.total.toLocaleString(),
      icon: <CompassIcon className="h-5 w-5" />,
      gradient: 'from-cyan-400 to-cyan-600',
      glow: 'shadow-cyan-500/20'
    },
    {
      label: 'This Week',
      value: mockStats.thisWeek.toLocaleString(),
      icon: <ClockIcon className="h-5 w-5" />,
      gradient: 'from-green-400 to-green-600',
      glow: 'shadow-green-500/20'
    },
    {
      label: 'Creators',
      value: mockStats.creators.toLocaleString(),
      icon: <UserIcon className="h-5 w-5" />,
      gradient: 'from-purple-400 to-purple-600',
      glow: 'shadow-purple-500/20'
    },
    {
      label: 'Verified',
      value: mockStats.verified.toLocaleString(),
      icon: <StarIcon className="h-5 w-5" />,
      gradient: 'from-yellow-400 to-yellow-600',
      glow: 'shadow-yellow-500/20'
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

// Placeholder content feed
const PlaceholderFeed: React.FC<{ viewMode: ViewMode }> = ({ viewMode }) => {
  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center">
        {viewMode === 'grid' ? <GridIcon className="h-8 w-8 text-black" /> : <ListIcon className="h-8 w-8 text-black" />}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Evermarks Coming Soon</h3>
      <p className="text-gray-400 mb-6">
        The explore feed will show all preserved content once the evermarks feature is ready.
      </p>
      <div className="grid gap-4 max-w-md mx-auto">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="w-full h-4 bg-gray-600 rounded mb-2"></div>
          <div className="w-3/4 h-3 bg-gray-600 rounded"></div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="w-full h-4 bg-gray-600 rounded mb-2"></div>
          <div className="w-2/3 h-3 bg-gray-600 rounded"></div>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <div className="w-full h-4 bg-gray-600 rounded mb-2"></div>
          <div className="w-4/5 h-3 bg-gray-600 rounded"></div>
        </div>
      </div>
    </div>
  );
};

// Main ExplorePage component
export default function ExplorePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAppAuth();
  const { isInFarcaster } = useFarcasterUser();
  const isMobile = useIsMobile();
  
  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-cyan-400/30">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/50">
                <CompassIcon className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                EXPLORE EVERMARKS
              </h1>
            </div>
            
            <p className="text-gray-300 max-w-3xl mx-auto text-lg">
              Discover and vote on community-curated content preserved forever on the blockchain.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <ExploreStats />

        {/* Search and Controls */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search evermarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20 transition-colors"
            />
          </div>

          {/* Controls */}
          <div className={cn(
            "flex justify-between items-center gap-4",
            isMobile && "flex-col space-y-4"
          )}>
            <div className="flex items-center gap-3">
              {/* Filter Button */}
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                <FilterIcon className="h-4 w-4" />
                Filters
              </button>

              {/* Sort Dropdown */}
              <select className="px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20">
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
            <PlaceholderFeed viewMode={viewMode} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Connect prompt or voting panel */}
            {!isAuthenticated ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <TagIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Join the Community
                </h3>
                <p className="text-gray-400 mb-4">
                  Connect your wallet to vote on content and earn rewards
                </p>
                <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-sm text-blue-300">
                    {isInFarcaster 
                      ? "🚀 Farcaster wallet integration available"
                      : "🖥️ Connect any Ethereum wallet"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <TagIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Select Content to Vote
                </h3>
                <p className="text-gray-400 mb-4">
                  Click any Evermark to delegate your voting power
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/leaderboard')}
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
                >
                  <div className="flex items-center">
                    <TrendingUpIcon className="h-4 w-4 text-yellow-400 mr-3" />
                    <span className="text-white">View Leaderboard</span>
                  </div>
                  <span className="text-gray-400 group-hover:text-white transition-colors">→</span>
                </button>
                
                <button
                  onClick={() => navigate('/staking')}
                  className="w-full flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
                >
                  <div className="flex items-center">
                    <StarIcon className="h-4 w-4 text-purple-400 mr-3" />
                    <span className="text-white">Start Staking</span>
                  </div>
                  <span className="text-gray-400 group-hover:text-white transition-colors">→</span>
                </button>
              </div>
            </div>

            {/* Protocol Info */}
            <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Protocol Info</h3>
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