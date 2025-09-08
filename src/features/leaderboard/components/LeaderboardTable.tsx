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
import { SimpleEvermarkImage } from '../../../components/images/SimpleEvermarkImage';

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
  const displayEntries = useMemo(() => entries || [], [entries]);

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
    <div className={cn("space-y-4 md:space-y-6", className)}>
      {/* Header - Mobile First */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-2">
          <h2 className={`${themeClasses.headingMedium}`}>
            Leaderboard
            {totalCount > 0 && (
              <span className="ml-2 text-sm md:text-base font-normal text-app-text-muted">
                ({totalCount.toLocaleString()})
              </span>
            )}
          </h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-xs sm:text-sm text-app-text-secondary">
            <div className="flex items-center space-x-3">
              <span>Period: {currentPeriod.label}</span>
              {lastUpdated && (
                <span className="hidden sm:inline">Updated {Formatters.formatRelativeTime(lastUpdated)}</span>
              )}
            </div>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className={`${themeClasses.btnSecondary} disabled:opacity-50 self-start sm:self-auto`}
              title="Refresh leaderboard"
            >
              <RefreshCw className={cn(
                "h-4 w-4 text-app-text-primary",
                isRefreshing && "animate-spin"
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters - Mobile First */}
      {showFilters && (
        <div className="space-y-3">
          {/* Search */}
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-app-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search evermarks..."
                className={cn(themeClasses.input, "pl-10")}
              />
            </div>
          </form>

          {/* Period selector - Horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availablePeriods?.map(period => (
              <button
                key={period.id}
                onClick={() => handlePeriodChange(period.id)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                  period.id === currentPeriod.id
                    ? themeClasses.btnPrimary
                    : themeClasses.btnSecondary
                )}
              >
                {period.label}
              </button>
            ))}
          </div>

          {/* Active filters */}
          {isFiltered && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-2 text-xs sm:text-sm text-app-text-secondary">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Filters active</span>
              </div>
              <button
                onClick={clearFilters}
                className="text-xs sm:text-sm transition-colors text-app-text-accent hover:text-app-brand-primary"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats Summary - Mobile-first responsive grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className={cn(themeClasses.card, "p-3 sm:p-4")}>
            <div className="text-xs sm:text-sm text-app-text-secondary mb-1">Total Evermarks</div>
            <div className="text-lg sm:text-xl font-bold text-app-text-primary">
              {stats.totalEvermarks.toLocaleString()}
            </div>
          </div>
          <div className={cn(themeClasses.card, "p-3 sm:p-4")}>
            <div className="text-xs sm:text-sm text-app-text-secondary mb-1">Total Votes</div>
            <div className="text-lg sm:text-xl font-bold text-app-text-accent">
              {LeaderboardService.formatVoteAmount(stats.totalVotes)}
            </div>
          </div>
        </div>
      )}

      {/* Loading state - Mobile-first responsive */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-app-bg-card border border-app-border rounded-lg p-3 sm:p-4 animate-pulse">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center justify-between sm:contents">
                  <div className="w-8 h-8 bg-app-bg-secondary rounded-lg"></div>
                  <div className="w-6 h-6 bg-app-bg-secondary rounded-lg sm:order-2"></div>
                </div>
                <div className="flex-1 space-y-2 sm:order-1">
                  <div className="h-4 bg-app-bg-secondary rounded w-3/4"></div>
                  <div className="h-3 bg-app-bg-secondary rounded w-1/2"></div>
                  <div className="h-3 bg-app-bg-secondary rounded w-2/3 sm:hidden"></div>
                </div>
                <div className="flex justify-between sm:block sm:text-right">
                  <div className="h-6 bg-app-bg-secondary rounded w-16"></div>
                  <div className="h-3 bg-app-bg-secondary rounded w-12 mt-1"></div>
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

      {/* Leaderboard table - Mobile-first responsive */}
      {!isEmpty && !isLoading && (
        <div className="space-y-3">
          {displayEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => handleEntryClick(entry)}
              className={cn(
                themeClasses.cardInteractive,
                "cursor-pointer group backdrop-blur-sm",
                compactMode ? "p-3" : "p-3 sm:p-4"
              )}
            >
              {/* Enhanced visual layout with images */}
              <div className="flex gap-3 sm:gap-4">
                {/* Evermark Image - prominent on left */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <SimpleEvermarkImage
                      tokenId={parseInt(entry.evermarkId)}
                      ipfsHash={entry.image?.replace('ipfs://', '')}
                      originalUrl={entry.sourceUrl}
                      alt={entry.title}
                      variant="list"
                      contentType={entry.contentType}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-app-border group-hover:border-app-text-accent transition-colors"
                    />
                    
                    {/* Rank overlay on image */}
                    <div className="absolute -top-2 -left-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-app-bg-primary border-2 border-app-border flex items-center justify-center">
                      <span className={cn(
                        "text-xs sm:text-sm font-bold",
                        entry.rank === 1 && "text-app-brand-warning",
                        entry.rank === 2 && "text-app-text-secondary", 
                        entry.rank === 3 && "text-app-brand-warning",
                        entry.rank > 3 && "text-app-text-primary"
                      )}>
                        {entry.rank}
                      </span>
                    </div>
                    
                    {/* Verification badge */}
                    {entry.verified && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-app-brand-success rounded-full flex items-center justify-center">
                        <Star className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Content area - flexible middle section */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* Title with ranking change indicator */}
                      <div className="flex items-start gap-2 mb-1">
                        <h3 className="text-base sm:text-lg font-semibold text-app-text-on-card group-hover:text-app-text-accent transition-colors line-clamp-2 flex-1">
                          {entry.title}
                        </h3>
                        <div className="flex-shrink-0 mt-1">
                          {getRankingChangeIcon(entry.change)}
                        </div>
                      </div>
                      
                      {/* Description - now visible on mobile too */}
                      {entry.description && (
                        <p className="text-sm text-app-text-secondary mb-2 line-clamp-2 sm:line-clamp-1">
                          {entry.description}
                        </p>
                      )}
                      
                      {/* Metadata row - creator and date */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-app-text-muted mb-2">
                        <div className="flex items-center min-w-0">
                          <User className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{entry.creator}</span>
                        </div>
                        
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{Formatters.formatRelativeTime(entry.createdAt)}</span>
                        </div>
                        
                        {/* Content type indicator */}
                        <div className="flex items-center">
                          {getContentTypeIcon(entry.contentType)}
                          <span className="ml-1 capitalize text-xs">{entry.contentType}</span>
                        </div>
                      </div>

                      {/* Tags - improved mobile display */}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="text-xs bg-app-bg-secondary text-app-text-secondary px-2 py-1 rounded-full border border-app-border"
                            >
                              {tag}
                            </span>
                          ))}
                          {entry.tags.length > 3 && (
                            <span className="text-xs text-app-text-muted px-2 py-1">
                              +{entry.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Vote stats - right side */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-lg sm:text-xl font-bold text-app-text-accent mb-1">
                        {LeaderboardService.formatVoteAmount(entry.totalVotes)}
                      </div>
                      {entry.percentageOfTotal > 0 && (
                        <div className="text-xs text-app-text-muted mb-1">
                          {entry.percentageOfTotal.toFixed(1)}% of total
                        </div>
                      )}
                      
                      {/* External link indicator */}
                      {entry.sourceUrl && (
                        <div className="flex justify-end">
                          <ExternalLink className="h-4 w-4 text-app-text-secondary group-hover:text-app-text-accent transition-colors" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination - Mobile-first responsive */}
      {showPagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="text-xs sm:text-sm text-app-text-secondary text-center sm:text-left order-2 sm:order-1">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, totalCount)} of{' '}
            {totalCount.toLocaleString()} evermarks
          </div>

          <div className="flex items-center justify-center space-x-2 order-1 sm:order-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!hasPreviousPage}
              className={cn(
                themeClasses.btnSecondary,
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "px-3 py-2 text-sm" // Consistent mobile sizing
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </button>

            <div className="flex items-center px-3 py-2 text-xs sm:text-sm text-app-text-primary bg-app-bg-secondary rounded-lg border border-app-border">
              <span className="whitespace-nowrap">
                Page {pagination.page} of {totalPages}
              </span>
            </div>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!hasNextPage}
              className={cn(
                themeClasses.btnSecondary,
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "px-3 py-2 text-sm" // Consistent mobile sizing
              )}
              aria-label="Next page"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}