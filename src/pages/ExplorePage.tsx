// src/pages/ExplorePage.tsx - Explore all evermarks with filtering and pagination
import React, { useState, useCallback } from 'react';
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
  RefreshCwIcon,
  PlusIcon,
  CompassIcon,
  SortAscIcon,
  SortDescIcon
} from 'lucide-react';

// Feature imports
import { EvermarkFeed, useEvermarksState, type Evermark } from '@/features/evermarks';
import { VotingPanel } from '@/features/voting';
import { useAppAuth } from '@/providers/AppContext';
import { useFarcasterUser } from '@/lib/farcaster';
import { cn, useIsMobile } from '@/utils/responsive';

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'title' | 'author' | 'votes';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First', icon: ClockIcon },
  { value: 'oldest', label: 'Oldest First', icon: ClockIcon },
  { value: 'title', label: 'Title A-Z', icon: SortAscIcon },
  { value: 'author', label: 'Author A-Z', icon: UserIcon },
  { value: 'votes', label: 'Most Voted', icon: TrendingUpIcon }
] as const;

const CONTENT_TYPE_FILTERS = [
  { value: '', label: 'All Types', icon: '📄' },
  { value: 'Cast', label: 'Farcaster Cast', icon: '💬' },
  { value: 'DOI', label: 'Academic Paper', icon: '📚' },
  { value: 'ISBN', label: 'Book', icon: '📖' },
  { value: 'URL', label: 'Web Content', icon: '🌐' },
  { value: 'Custom', label: 'Custom Content', icon: '✨' }
] as const;

// Enhanced stats component
const ExploreStats: React.FC = () => {
  const { evermarks, totalCount, isLoading, filters } = useEvermarksState();
  const isMobile = useIsMobile();
  
  const stats = React.useMemo(() => {
    const recentEvermarks = evermarks.slice(0, 100);
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const thisWeekCount = recentEvermarks.filter(e => 
      new Date(e.createdAt).getTime() > weekAgo
    ).length;
    
    const uniqueCreators = new Set(recentEvermarks.map(e => e.creator)).size;
    const withImages = recentEvermarks.filter(e => e.image).length;
    const verifiedCount = recentEvermarks.filter(e => e.verified).length;

    return {
      total: totalCount || recentEvermarks.length,
      thisWeek: thisWeekCount,
      creators: uniqueCreators,
      withImages,
      verified: verifiedCount,
      isFiltered: filters.search || filters.contentType || filters.author || filters.verified !== undefined
    };
  }, [evermarks, totalCount, filters]);

  const statCards = [
    {
      label: stats.isFiltered ? 'Found' : 'Total',
      value: isLoading ? '...' : stats.total.toLocaleString(),
      icon: <CompassIcon className="h-5 w-5" />,
      gradient: 'from-cyan-400 to-cyan-600',
      glow: 'shadow-cyan-500/20'
    },
    {
      label: 'This Week',
      value: isLoading ? '...' : stats.thisWeek.toLocaleString(),
      icon: <ClockIcon className="h-5 w-5" />,
      gradient: 'from-green-400 to-green-600',
      glow: 'shadow-green-500/20'
    },
    {
      label: 'Creators',
      value: isLoading ? '...' : stats.creators.toLocaleString(),
      icon: <UserIcon className="h-5 w-5" />,
      gradient: 'from-purple-400 to-purple-600',
      glow: 'shadow-purple-500/20'
    },
    {
      label: 'Verified',
      value: isLoading ? '...' : stats.verified.toLocaleString(),
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

// Filter panel component
const FilterPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: any) => void;
  currentFilters: any;
}> = ({ isOpen, onClose, onApplyFilters, currentFilters }) => {
  const [tempFilters, setTempFilters] = useState(currentFilters);

  const handleApply = () => {
    onApplyFilters(tempFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      search: '',
      contentType: undefined,
      verified: undefined,
      author: ''
    };
    setTempFilters(resetFilters);
    onApplyFilters(resetFilters);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">Filter Evermarks</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Content Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TYPE_FILTERS.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTempFilters({ ...tempFilters, contentType: type.value || undefined })}
                  className={cn(
                    "flex items-center justify-center px-3 py-2 rounded-lg border transition-all duration-200 text-sm",
                    tempFilters.contentType === type.value || (!tempFilters.contentType && !type.value)
                      ? 'border-cyan-400 bg-cyan-900/30 text-cyan-300'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  )}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Verification Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: undefined, label: 'All' },
                { value: true, label: 'Verified' },
                { value: false, label: 'Unverified' }
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => setTempFilters({ ...tempFilters, verified: option.value })}
                  className={cn(
                    "px-3 py-2 rounded-lg border transition-all duration-200 text-sm",
                    tempFilters.verified === option.value
                      ? 'border-green-400 bg-green-900/30 text-green-300'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Author Filter */}
          <div>
            <label htmlFor="author-filter" className="block text-sm font-medium text-gray-300 mb-2">
              Author
            </label>
            <input
              id="author-filter"
              type="text"
              value={tempFilters.author || ''}
              onChange={(e) => setTempFilters({ ...tempFilters, author: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
              placeholder="Filter by author name"
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-700">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-colors font-medium"
          >
            Apply Filters
          </button>
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
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvermarkId, setSelectedEvermarkId] = useState<string | null>(null);
  
  // Feature state
  const evermarksState = useEvermarksState();
  const { setFilters, setPagination, filters, pagination, clearFilters } = evermarksState;

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setFilters({ search: query });
  }, [setFilters]);

  // Handle sort change
  const handleSortChange = useCallback((sort: SortOption) => {
    setSortOption(sort);
    
    const sortMapping: Record<SortOption, { sortBy: any; sortOrder: 'asc' | 'desc' }> = {
      newest: { sortBy: 'created_at', sortOrder: 'desc' },
      oldest: { sortBy: 'created_at', sortOrder: 'asc' },
      title: { sortBy: 'title', sortOrder: 'asc' },
      author: { sortBy: 'author', sortOrder: 'asc' },
      votes: { sortBy: 'votes', sortOrder: 'desc' }
    };

    const { sortBy, sortOrder } = sortMapping[sort];
    setPagination({ sortBy, sortOrder, page: 1 });
  }, [setPagination]);

  // Handle filter application
  const handleApplyFilters = useCallback((newFilters: any) => {
    setFilters(newFilters);
  }, [setFilters]);

  // Handle evermark click
  const handleEvermarkClick = useCallback((evermark: Evermark) => {
    navigate(`/evermark/${evermark.id}`);
  }, [navigate]);

  // Handle voting panel
  const handleVoteClick = useCallback((evermarkId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (isAuthenticated) {
      setSelectedEvermarkId(evermarkId);
    }
  }, [isAuthenticated]);

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
              onChange={(e) => handleSearch(e.target.value)}
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
              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FilterIcon className="h-4 w-4" />
                Filters
                {(filters.contentType || filters.verified !== undefined || filters.author) && (
                  <span className="ml-2 w-2 h-2 bg-cyan-400 rounded-full" />
                )}
              </button>

              {/* Sort Dropdown */}
              <select
                value={sortOption}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="px-4 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Clear Filters */}
              {(filters.search || filters.contentType || filters.author || filters.verified !== undefined) && (
                <button
                  onClick={clearFilters}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Clear all
                </button>
              )}
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
            <EvermarkFeed
              variant={viewMode}
              showCreateButton={false}
              showFilters={false}
              onEvermarkClick={handleEvermarkClick}
              emptyMessage="No evermarks match your search criteria"
              className="bg-gray-800/30 border border-gray-700 rounded-lg"
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Voting Panel */}
            {selectedEvermarkId && isAuthenticated ? (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">Vote on Content</h3>
                    <button
                      onClick={() => setSelectedEvermarkId(null)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <VotingPanel evermarkId={selectedEvermarkId} />
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center">
                <TagIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {isAuthenticated ? 'Select Content to Vote' : 'Join the Community'}
                </h3>
                <p className="text-gray-400 mb-4">
                  {isAuthenticated 
                    ? 'Click any Evermark to delegate your voting power'
                    : 'Connect your wallet to vote on content and earn rewards'
                  }
                </p>
                {!isAuthenticated && (
                  <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-sm text-blue-300">
                      {isInFarcaster 
                        ? "🚀 Farcaster wallet integration available"
                        : "🖥️ Connect any Ethereum wallet"
                      }
                    </p>
                  </div>
                )}
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

      {/* Filter Panel Modal */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  );
}