
import { useMemo } from 'react';
import { 
  Search, 
   
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Grid,
  List,
  X,
  Plus
} from 'lucide-react';

import { type Evermark, type EvermarkFilters } from '../types';
import { EvermarkCard } from './EvermarkCard';
import { useEvermarksState } from '../hooks/useEvermarkState';
import { useTheme } from '../../../providers/ThemeProvider';
import { cn } from '../../../utils/responsive';

interface EvermarkFeedProps {
  className?: string;
  showCreateButton?: boolean;
  showFilters?: boolean;
  onCreateClick?: () => void;
  onEvermarkClick?: (evermark: Evermark) => void;
  variant?: 'grid' | 'list';
  emptyMessage?: string;
}

export function EvermarkFeed({
  className = '',
  showCreateButton = true,
  showFilters = true,
  onCreateClick,
  onEvermarkClick,
  variant = 'grid',
  emptyMessage = 'No evermarks found'
}: EvermarkFeedProps) {
  const { isDark } = useTheme();
  const {
    evermarks,
    pagination,
    filters,
    totalCount,
    totalPages,
    isLoading,
    error,
    hasNextPage,
    hasPreviousPage,
    isEmpty,
    isFiltered,
    setFilters,
    setPagination,
    clearFilters,
    refresh,
    loadMore
  } = useEvermarksState();

  // Filter options for the UI
  const contentTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'Cast', label: 'Farcaster Cast' },
    { value: 'DOI', label: 'Academic Paper' },
    { value: 'ISBN', label: 'Book' },
    { value: 'URL', label: 'Web Content' },
    { value: 'Custom', label: 'Custom Content' }
  ];

  const sortOptions = [
    { value: 'created_at-desc', label: 'Newest First' },
    { value: 'created_at-asc', label: 'Oldest First' },
    { value: 'title-asc', label: 'Title A-Z' },
    { value: 'title-desc', label: 'Title Z-A' },
    { value: 'author-asc', label: 'Author A-Z' },
    { value: 'votes-desc', label: 'Most Voted' }
  ];

  // Handle search
  const handleSearch = (searchTerm: string) => {
    setFilters({ search: searchTerm });
  };

  // Handle filter changes
  const handleFilterChange = (filterUpdates: Partial<EvermarkFilters>) => {
    setFilters(filterUpdates);
  };

  // Handle sorting
  const handleSortChange = (sortValue: string) => {
    const [sortBy, sortOrder] = sortValue.split('-') as [any, 'asc' | 'desc'];
    setPagination({ sortBy, sortOrder, page: 1 });
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setPagination({ page: newPage });
  };

  // Get current sort value for the select
  const currentSortValue = `${pagination.sortBy}-${pagination.sortOrder}`;

  // Memoized grid classes based on variant
  const gridClasses = useMemo(() => {
    if (variant === 'list') {
      return 'space-y-4';
    }
    return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr';
  }, [variant]);

  return (
    <div className={`evermark-feed ${className}`}>
      {/* Header with search and controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className={cn(
            "text-2xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Evermarks
            {totalCount > 0 && (
              <span className={cn(
                "ml-2 text-sm font-normal",
                isDark ? "text-gray-400" : "text-gray-600"
              )}>
                ({totalCount.toLocaleString()})
              </span>
            )}
          </h2>
          
          {/* Refresh button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className={cn(
              "p-2 rounded-lg border transition-colors disabled:opacity-50",
              isDark 
                ? "bg-gray-800 hover:bg-gray-700 border-gray-600" 
                : "bg-white hover:bg-gray-50 border-gray-300"
            )}
            title="Refresh"
          >
            <RefreshCw className={cn(
              "h-4 w-4",
              isDark ? "text-gray-300" : "text-gray-700",
              isLoading ? 'animate-spin' : ''
            )} />
          </button>
        </div>

        {/* Create button */}
        {showCreateButton && onCreateClick && (
          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            Create Evermark
          </button>
        )}
      </div>

      {/* Filters and search */}
      {showFilters && (
        <div className="mb-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
              isDark ? "text-gray-400" : "text-gray-500"
            )} />
            <input
              type="text"
              placeholder="Search evermarks..."
              value={filters.search || ''}
              onChange={(e) => handleSearch(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-opacity-20 transition-colors",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-purple-500" 
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-purple-400 focus:ring-purple-400"
              )}
            />
          </div>

          {/* Filter controls */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Content type filter */}
            <select
              value={filters.contentType || ''}
              onChange={(e) => handleFilterChange({ contentType: e.target.value as any || undefined })}
              className={cn(
                "px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-opacity-20 transition-colors",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500" 
                  : "bg-white border-gray-300 text-gray-900 focus:border-purple-400 focus:ring-purple-400"
              )}
            >
              {contentTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Verified filter */}
            <select
              value={filters.verified === undefined ? '' : filters.verified.toString()}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({ 
                  verified: value === '' ? undefined : value === 'true' 
                });
              }}
              className={cn(
                "px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-opacity-20 transition-colors",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500" 
                  : "bg-white border-gray-300 text-gray-900 focus:border-purple-400 focus:ring-purple-400"
              )}
            >
              <option value="">All Status</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>

            {/* Sort dropdown */}
            <select
              value={currentSortValue}
              onChange={(e) => handleSortChange(e.target.value)}
              className={cn(
                "px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-opacity-20 transition-colors",
                isDark 
                  ? "bg-gray-800 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500" 
                  : "bg-white border-gray-300 text-gray-900 focus:border-purple-400 focus:ring-purple-400"
              )}
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* View toggle */}
            <div className={cn(
              "flex items-center rounded-lg border p-1",
              isDark ? "bg-gray-800 border-gray-600" : "bg-white border-gray-300"
            )}>
              <button
                onClick={() => {/* Handle variant change */}}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  variant === 'grid' 
                    ? "bg-purple-600 text-white" 
                    : (isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900")
                )}
                title="Grid view"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => {/* Handle variant change */}}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  variant === 'list' 
                    ? "bg-purple-600 text-white" 
                    : (isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900")
                )}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Clear filters */}
            {isFiltered && (
              <button
                onClick={clearFilters}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-sm transition-colors",
                  isDark ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                )}
              >
                <X className="h-3 w-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-300">Loading evermarks...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-red-300 font-medium">Error loading evermarks</h3>
              <p className="text-red-400 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={refresh}
              className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !isLoading && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
            <Search className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {isFiltered ? 'No results found' : emptyMessage}
          </h3>
          <p className="text-gray-500 mb-4">
            {isFiltered 
              ? 'Try adjusting your filters or search terms'
              : 'Be the first to create an evermark!'
            }
          </p>
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Evermarks grid/list */}
      {!isEmpty && !isLoading && (
        <>
          <div className={gridClasses}>
            {evermarks.map((evermark) => (
              <EvermarkCard
                key={evermark.id}
                evermark={evermark}
                variant={variant === 'list' ? 'list' : 'standard'}
                onClick={onEvermarkClick}
                showVotes
                showViews
              />
            ))}
          </div>

          {/* Load more button for grid view */}
          {hasNextPage && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Load More
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, totalCount)} of{' '}
                {totalCount.toLocaleString()} evermarks
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!hasPreviousPage}
                  className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <span className="px-3 py-2 text-sm text-gray-300">
                  Page {pagination.page} of {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!hasNextPage}
                  className="p-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}