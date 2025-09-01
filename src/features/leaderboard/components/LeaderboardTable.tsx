// src/features/leaderboard/components/LeaderboardTable.tsx
// Main leaderboard display component

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  ExternalLink,
  User,
  Calendar,
  Tag,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  FileText,
  BookOpen,
  Globe,
  Hash
} from 'lucide-react';
import { Formatters } from '../../../utils/formatters';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '../../../utils/responsive';
import { themeClasses } from '../../../utils/theme';

import useLeaderboardState from '../hooks/useLeaderboardState';
import { LeaderboardService } from '../services/LeaderboardService';
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
  const { isDark } = useTheme();
  
  const leaderboardState = useLeaderboardState();
  
  const {
    entries,
    stats,
    currentPeriod,
    availablePeriods,
    pagination,
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
  } = leaderboardState;

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
        return <MessageCircle className="h-4 w-4" />;
      case 'DOI':
        return <FileText className="h-4 w-4" />;
      case 'ISBN':
        return <BookOpen className="h-4 w-4" />;
      case 'URL':
        return <Globe className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  // Get ranking change indicator
  const getRankingChangeIcon = (change: RankingChange) => {
    switch (change.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-app-brand-success" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-app-brand-error" />;
      case 'new':
        return <Star className="h-3 w-3 text-app-brand-primary" />;
      default:
        return <Minus className="h-3 w-3 text-app-text-muted" />;
    }
  };

  // Format rank display with change
  const formatRankWithChange = (entry: LeaderboardEntry) => {
    return (
      <div className="flex items-center space-x-2">
        <span className={cn(
          "text-lg font-bold",
          entry.rank === 1 && "text-app-brand-warning",
          entry.rank === 2 && "text-app-text-secondary",
          entry.rank === 3 && "text-app-brand-warning",
          entry.rank > 3 && "text-app-text-primary"
        )}>
          #{entry.rank}
        </span>
        <div className="flex items-center space-x-1">
          {getRankingChangeIcon(entry.change)}
          {entry.change.direction !== 'same' && entry.change.direction !== 'new' && (
            <span className="text-xs text-app-text-muted">
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
      <div className={cn(
        "border rounded-lg p-6",
        isDark 
          ? "bg-red-900/30 border-red-500/50" 
          : "bg-red-100/80 border-red-300",
        className
      )}>
        <div className="text-center">
          <h3 className="font-medium mb-2 text-app-brand-error">
            Error Loading Leaderboard
          </h3>
          <p className="text-sm mb-4 text-app-brand-error">
            {error}
          </p>
          <button
            onClick={refresh}
            className={themeClasses.btnSecondary}
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
          <h2 className={`${themeClasses.headingMedium} mb-2`}>
            Leaderboard
            {totalCount > 0 && (
              <span className="ml-2 text-base font-normal text-app-text-muted">
                ({totalCount.toLocaleString()})
              </span>
            )}
          </h2>
          <div className="flex items-center space-x-4 text-sm text-app-text-secondary">
            <span>Period: {currentPeriod.label}</span>
            {lastUpdated && (
              <span>Updated {Formatters.formatRelativeTime(lastUpdated)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className={`${themeClasses.btnSecondary} disabled:opacity-50`}
            title="Refresh leaderboard"
          >
            <RefreshCw className={cn(
              "h-4 w-4 text-app-text-primary",
              isRefreshing && "animate-spin"
            )} />
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-app-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search evermarks..."
                  className={themeClasses.input}
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
                      ? themeClasses.btnPrimary
                      : themeClasses.btnSecondary
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
              <div className="flex items-center space-x-2 text-sm text-app-text-secondary">
                <Filter className="h-4 w-4" />
                <span>Filters active</span>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm transition-colors text-app-text-accent hover:text-app-brand-primary"
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
          <div className={themeClasses.card}>
            <div className="text-sm text-app-text-secondary mb-1">Total Evermarks</div>
            <div className="text-xl font-bold text-app-text-primary">
              {stats.totalEvermarks.toLocaleString()}
            </div>
          </div>
          <div className={themeClasses.card}>
            <div className="text-sm text-app-text-secondary mb-1">Total Votes</div>
            <div className="text-xl font-bold text-app-text-accent">
              {LeaderboardService.formatVoteAmount(stats.totalVotes)}
            </div>
          </div>
          <div className={themeClasses.card}>
            <div className="text-sm text-app-text-secondary mb-1">Active Voters</div>
            <div className="text-xl font-bold text-app-brand-success">
              {stats.activeVoters.toLocaleString()}
            </div>
          </div>
          <div className={themeClasses.card}>
            <div className="text-sm text-app-text-secondary mb-1">Participation</div>
            <div className="text-xl font-bold text-app-brand-secondary">
              {(stats.participationRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-app-bg-card border border-app-border rounded-lg p-4 animate-pulse">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-app-bg-secondary rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-app-bg-secondary rounded w-3/4"></div>
                  <div className="h-3 bg-app-bg-secondary rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isLoading && (
        <div className="text-center py-12">
          <TrendingUp className="mx-auto h-12 w-12 text-app-text-muted mb-4" />
          <h3 className="text-lg font-medium text-app-text-primary mb-2">
            {isFiltered ? 'No results found' : 'No evermarks yet'}
          </h3>
          <p className="text-app-text-secondary mb-4">
            {isFiltered 
              ? 'Try adjusting your filters or search terms'
              : 'Be the first to create and vote on evermarks!'
            }
          </p>
          {isFiltered && (
            <button
              onClick={clearFilters}
              className={themeClasses.btnPrimary}
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
                themeClasses.cardInteractive,
                "cursor-pointer group backdrop-blur-sm",
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
                  <div className="w-8 h-8 bg-app-bg-secondary rounded-lg flex items-center justify-center text-app-text-secondary">
                    {getContentTypeIcon(entry.contentType)}
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-app-text-on-card group-hover:text-app-text-accent transition-colors truncate">
                        {entry.title}
                      </h3>
                      
                      <div className="flex items-center space-x-3 text-sm text-app-text-secondary mt-1">
                        <div className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          <span className="truncate">{entry.creator}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>{Formatters.formatRelativeTime(entry.createdAt)}</span>
                        </div>
                        
                        {entry.verified && (
                          <div className="flex items-center text-app-brand-success">
                            <Star className="h-3 w-3" />
                          </div>
                        )}
                      </div>

                      {/* Description (if not compact) */}
                      {!compactMode && entry.description && (
                        <p className="text-sm text-app-text-on-card mt-2 line-clamp-2">
                          {entry.description}
                        </p>
                      )}

                      {/* Tags */}
                      {entry.tags.length > 0 && (
                        <div className="flex items-center space-x-2 mt-2">
                          <Tag className="h-3 w-3 text-app-text-muted" />
                          <div className="flex flex-wrap gap-1">
                            {entry.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="text-xs bg-app-bg-secondary text-app-text-secondary px-2 py-1 rounded border border-app-border"
                              >
                                {tag}
                              </span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span className="text-xs text-app-text-muted">
                                +{entry.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Vote information */}
                    <div className="flex-shrink-0 text-right ml-4">
                      <div className="text-xl font-bold text-app-text-accent mb-1">
                        {LeaderboardService.formatVoteAmount(entry.totalVotes)}
                      </div>
                      <div className="text-xs text-app-text-secondary">
                        {entry.voteCount} voter{entry.voteCount !== 1 ? 's' : ''}
                      </div>
                      {entry.percentageOfTotal > 0 && (
                        <div className="text-xs text-app-text-muted">
                          {entry.percentageOfTotal.toFixed(1)}% of total
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* External link indicator */}
                {entry.sourceUrl && (
                  <div className="flex-shrink-0">
                    <ExternalLink className="h-4 w-4 text-app-text-secondary group-hover:text-app-text-accent transition-colors" />
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
          <div className="text-sm text-app-text-secondary">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, totalCount)} of{' '}
            {totalCount.toLocaleString()} evermarks
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!hasPreviousPage}
              className={`${themeClasses.btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3 py-2 text-sm text-app-text-primary">
              Page {pagination.page} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!hasNextPage}
              className={`${themeClasses.btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}