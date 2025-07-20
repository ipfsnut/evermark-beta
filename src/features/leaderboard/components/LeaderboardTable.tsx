// src/features/leaderboard/components/LeaderboardTable.tsx
// Main leaderboard display component

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  StarIcon,
  ExternalLinkIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  SearchIcon,
  FilterIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MessageCircleIcon,
  FileTextIcon,
  BookOpenIcon,
  GlobeIcon,
  HashIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useLeaderboardState } from '../hooks/useLeaderboardState';
import { LeaderboardService } from '../services/LeaderboardService';
import { cn } from '@/utils/responsive';
import type { LeaderboardEntry, RankingChange } from '../types';

interface LeaderboardTableProps {
  className?: string;
  onEvermarkClick?: (entry: LeaderboardEntry) => void;
  showFilters?: boolean;
  showPagination?: boolean;
  compactMode?: boolean;
}

export function LeaderboardTable({ 
  className = '',
  onEvermarkClick,
  showFilters = true,
  showPagination = true,
  compactMode = false
}: LeaderboardTableProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const {
    entries,
    stats,
    currentPeriod,
    availablePeriods,
    pagination,
    filters,
    totalCount,
    totalPages,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    hasNextPage,
    hasPreviousPage,
    isEmpty,
    isFiltered,
    setPeriod,
    setFilters,
    setPagination,
    clearFilters,
    refresh
  } = useLeaderboardState();

  // Handle entry click
  const handleEntryClick = (entry: LeaderboardEntry) => {
    if (onEvermarkClick) {
      onEvermarkClick(entry);
    } else {
      navigate(`/evermark/${entry.evermarkId}`);
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ searchQuery: searchQuery.trim() });
  };

  // Handle period change
  const handlePeriodChange = (periodId: string) => {
    setPeriod(periodId);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination({ page: newPage });
  };

  // Get content type icon
  const getContentTypeIcon = (contentType: LeaderboardEntry['contentType']) => {
    switch (contentType) {
      case 'Cast':
        return <MessageCircleIcon className="h-4 w-4" />;
      case 'DOI':
        return <FileTextIcon className="h-4 w-4" />;
      case 'ISBN':
        return <BookOpenIcon className="h-4 w-4" />;
      case 'URL':
        return <GlobeIcon className="h-4 w-4" />;
      default:
        return <HashIcon className="h-4 w-4" />;
    }
  };

  // Get ranking change indicator
  const getRankingChangeIcon = (change: RankingChange) => {
    switch (change.direction) {
      case 'up':
        return <TrendingUpIcon className="h-3 w-3 text-green-400" />;
      case 'down':
        return <TrendingDownIcon className="h-3 w-3 text-red-400" />;
      case 'new':
        return <StarIcon className="h-3 w-3 text-blue-400" />;
      default:
        return <MinusIcon className="h-3 w-3 text-gray-500" />;
    }
  };

  // Format rank display with change
  const formatRankWithChange = (entry: LeaderboardEntry) => {
    return (
      <div className="flex items-center space-x-2">
        <span className={cn(
          "text-lg font-bold",
          entry.rank === 1 && "text-yellow-400",
          entry.rank === 2 && "text-gray-300",
          entry.rank === 3 && "text-amber-600",
          entry.rank > 3 && "text-white"
        )}>
          #{entry.rank}
        </span>
        <div className="flex items-center space-x-1">
          {getRankingChangeIcon(entry.change)}
          {entry.change.direction !== 'same' && entry.change.direction !== 'new' && (
            <span className="text-xs text-gray-400">
              {entry.change.positions}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Memoized filtered entries for performance
  const displayEntries = useMemo(() => entries, [entries]);

  if (error) {
    return (
      <div className={cn("bg-red-900/30 border border-red-500/50 rounded-lg p-6", className)}>
        <div className="text-center">
          <h3 className="text-red-300 font-medium mb-2">Error Loading Leaderboard</h3>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Leaderboard
            {totalCount > 0 && (
              <span className="ml-2 text-base text-gray-400 font-normal">
                ({totalCount.toLocaleString()})
              </span>
            )}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>Period: {currentPeriod.label}</span>
            {lastUpdated && (
              <span>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors disabled:opacity-50"
            title="Refresh leaderboard"
          >
            <RefreshCwIcon className={cn("h-4 w-4 text-gray-300", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="space-y-4">
          {/* Search and period selection */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search evermarks..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
                />
              </div>
            </form>

            {/* Period selector */}
            <div className="flex space-x-2">
              {availablePeriods.map(period => (
                <button
                  key={period.id}
                  onClick={() => handlePeriodChange(period.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    period.id === currentPeriod.id
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filters */}
          {isFiltered && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <FilterIcon className="h-4 w-4" />
                <span>Filters active</span>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Evermarks</div>
            <div className="text-xl font-bold text-white">
              {stats.totalEvermarks.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Votes</div>
            <div className="text-xl font-bold text-cyan-400">
              {LeaderboardService.formatVoteAmount(stats.totalVotes)}
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Active Voters</div>
            <div className="text-xl font-bold text-green-400">
              {stats.activeVoters.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Participation</div>
            <div className="text-xl font-bold text-purple-400">
              {(stats.participationRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isLoading && (
        <div className="text-center py-12">
          <TrendingUpIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {isFiltered ? 'No results found' : 'No evermarks yet'}
          </h3>
          <p className="text-gray-500 mb-4">
            {isFiltered 
              ? 'Try adjusting your filters or search terms'
              : 'Be the first to create and vote on evermarks!'
            }
          </p>
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Leaderboard table */}
      {!isEmpty && !isLoading && (
        <div className="space-y-2">
          {displayEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleEntryClick(entry)}
              className={cn(
                "bg-gray-800/50 border border-gray-700 rounded-lg p-4 transition-all duration-200 cursor-pointer group",
                "hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 backdrop-blur-sm",
                compactMode ? "p-3" : "p-4"
              )}
            >
              <div className="flex items-center space-x-4">
                {/* Rank */}
                <div className="flex-shrink-0 w-16 text-center">
                  {formatRankWithChange(entry)}
                </div>

                {/* Content type icon */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-gray-400">
                    {getContentTypeIcon(entry.contentType)}
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {entry.title}
                      </h3>
                      
                      <div className="flex items-center space-x-3 text-sm text-gray-400 mt-1">
                        <div className="flex items-center">
                          <UserIcon className="h-3 w-3 mr-1" />
                          <span className="truncate">{entry.creator}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
                        </div>
                        
                        {entry.verified && (
                          <div className="flex items-center text-green-400">
                            <StarIcon className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Description (if not compact) */}
                      {!compactMode && entry.description && (
                        <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                          {entry.description}
                        </p>
                      )}

                      {/* Tags */}
                      {entry.tags.length > 0 && (
                        <div className="flex items-center space-x-2 mt-2">
                          <TagIcon className="h-3 w-3 text-gray-500" />
                          <div className="flex flex-wrap gap-1">
                            {entry.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded border border-gray-600"
                              >
                                {tag}
                              </span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{entry.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vote information */}
                    <div className="flex-shrink-0 text-right ml-4">
                      <div className="text-xl font-bold text-cyan-400 mb-1">
                        {LeaderboardService.formatVoteAmount(entry.totalVotes)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {entry.voteCount} voter{entry.voteCount !== 1 ? 's' : ''}
                      </div>
                      {entry.percentageOfTotal > 0 && (
                        <div className="text-xs text-gray-500">
                          {entry.percentageOfTotal.toFixed(1)}% of total
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* External link indicator */}
                {entry.sourceUrl && (
                  <div className="flex-shrink-0">
                    <ExternalLinkIcon className="h-4 w-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, totalCount)} of{' '}
            {totalCount.toLocaleString()} evermarks
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!hasPreviousPage}
              className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            <span className="px-3 py-2 text-sm text-gray-300">
              Page {pagination.page} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!hasNextPage}
              className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}