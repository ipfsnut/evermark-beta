import { useState } from 'react';
import { FilterIcon,  CalendarIcon, CheckIcon } from 'lucide-react';
import type { EvermarkFilters } from '../types';

interface EvermarkFiltersProps {
  filters: EvermarkFilters;
  onFiltersChange: (filters: Partial<EvermarkFilters>) => void;
  onClearFilters: () => void;
  className?: string;
}

const CONTENT_TYPES = [
  { value: 'Cast', label: 'Farcaster Cast', icon: '💬' },
  { value: 'DOI', label: 'Academic Paper', icon: '📄' },
  { value: 'ISBN', label: 'Book', icon: '📚' },
  { value: 'URL', label: 'Web Content', icon: '🌐' },
  { value: 'Custom', label: 'Custom Content', icon: '✨' }
];

const POPULAR_TAGS = [
  'web3', 'blockchain', 'defi', 'nft', 'crypto', 'ethereum', 'bitcoin',
  'farcaster', 'research', 'art', 'technology', 'science', 'literature'
];

export function EvermarkFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  className = ''
}: EvermarkFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleContentTypeToggle = (contentType: string) => {
    onFiltersChange({
      contentType: filters.contentType === contentType ? undefined : contentType as any
    });
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    onFiltersChange({ tags: newTags });
  };

  const hasActiveFilters = !!(
    filters.contentType ||
    filters.verified !== undefined ||
    filters.author ||
    (filters.tags && filters.tags.length > 0) ||
    filters.dateRange
  );

  const activeFilterCount = [
    filters.contentType,
    filters.verified !== undefined,
    filters.author,
    filters.tags && filters.tags.length > 0,
    filters.dateRange
  ].filter(Boolean).length;

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg ${className}`}>
      {/* Filter Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
        >
          <FilterIcon className="h-5 w-5" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-cyan-600 text-white text-xs px-2 py-1 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Content Types */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Content Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleContentTypeToggle(type.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-sm ${
                    filters.contentType === type.value
                      ? 'border-cyan-400 bg-cyan-900/30 text-cyan-300'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                  {filters.contentType === type.value && (
                    <CheckIcon className="h-4 w-4 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Verification Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Verification Status</h3>
            <div className="flex gap-2">
              {[
                { value: undefined, label: 'All' },
                { value: true, label: 'Verified' },
                { value: false, label: 'Unverified' }
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => onFiltersChange({ verified: option.value })}
                  className={`px-4 py-2 rounded-lg border transition-all text-sm ${
                    filters.verified === option.value
                      ? 'border-green-400 bg-green-900/30 text-green-300'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {option.label}
                  {filters.verified === option.value && option.value !== undefined && (
                    <CheckIcon className="h-4 w-4 ml-2 inline" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Author Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Author</h3>
            <input
              type="text"
              placeholder="Filter by author name..."
              value={filters.author || ''}
              onChange={(e) => onFiltersChange({ author: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
            />
          </div>

          {/* Popular Tags */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TAGS.map((tag) => {
                const isSelected = filters.tags?.includes(tag) || false;
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1 rounded-full border text-sm transition-all ${
                      isSelected
                        ? 'border-purple-400 bg-purple-900/30 text-purple-300'
                        : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    #{tag}
                    {isSelected && (
                      <CheckIcon className="h-3 w-3 ml-1 inline" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Tags */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Custom Tags</h3>
            <input
              type="text"
              placeholder="Add custom tags (comma-separated)..."
              value={filters.tags?.filter(tag => !POPULAR_TAGS.includes(tag)).join(', ') || ''}
              onChange={(e) => {
                const customTags = e.target.value
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(tag => tag.length > 0);
                
                const popularTags = filters.tags?.filter(tag => POPULAR_TAGS.includes(tag)) || [];
                const allTags = [...popularTags, ...customTags];
                
                onFiltersChange({ tags: allTags });
              }}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
            />
          </div>

          {/* Date Range (placeholder for future implementation) */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Date Range</h3>
            <div className="flex items-center gap-2 p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
              <CalendarIcon className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400 text-sm">Date range filtering coming soon...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
