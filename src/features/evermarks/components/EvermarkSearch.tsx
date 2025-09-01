import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchIcon, XIcon, FilterIcon,  } from 'lucide-react';
import type { EvermarkFilters } from '../types';

interface EvermarkSearchProps {
  onSearch: (query: string) => void;
  onFiltersChange: (filters: Partial<EvermarkFilters>) => void;
  currentFilters: EvermarkFilters;
  placeholder?: string;
  showFilters?: boolean;
  className?: string;
}

const CONTENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'Cast', label: 'Farcaster Cast' },
  { value: 'DOI', label: 'Academic Paper' },
  { value: 'ISBN', label: 'Book' },
  { value: 'URL', label: 'Web Content' },
  { value: 'Custom', label: 'Custom Content' }
];

export function EvermarkSearch({
  onSearch,
  onFiltersChange,
  currentFilters,
  placeholder = "Search evermarks...",
  showFilters = true,
  className = ''
}: EvermarkSearchProps) {
  const [searchQuery, setSearchQuery] = useState(currentFilters.search || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState(currentFilters);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);  
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  }, [onSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    onSearch('');
    searchInputRef.current?.focus();
  }, [onSearch]);

  const handleFilterChange = useCallback((key: keyof EvermarkFilters, value: unknown) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  }, [localFilters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    const clearedFilters: EvermarkFilters = {
      search: '',
      author: '',
      contentType: undefined,
      verified: undefined,
      tags: [],
      dateRange: undefined
    };
    setLocalFilters(clearedFilters);
    setSearchQuery('');
    onFiltersChange(clearedFilters);
    onSearch('');
  }, [onFiltersChange, onSearch]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const hasActiveFilters = localFilters.author || 
                          localFilters.contentType || 
                          localFilters.verified !== undefined ||
                          (localFilters.tags && localFilters.tags.length > 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-12 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showAdvancedFilters || hasActiveFilters
                  ? 'border-cyan-400 bg-cyan-900/30 text-cyan-300'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
              }`}
            >
              <FilterIcon className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-cyan-400 rounded-full" />
              )}
            </button>

            {/* Quick Content Type Filter */}
            <select
              value={localFilters.contentType || ''}
              onChange={(e) => handleFilterChange('contentType', e.target.value || undefined)}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
            >
              {CONTENT_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Author Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Author
              </label>
              <input
                type="text"
                placeholder="Filter by author..."
                value={localFilters.author || ''}
                onChange={(e) => handleFilterChange('author', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
              />
            </div>

            {/* Verification Status */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Verification Status
              </label>
              <select
                value={localFilters.verified === undefined ? '' : localFilters.verified.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  handleFilterChange('verified', value === '' ? undefined : value === 'true');
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
              >
                <option value="">All</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>
            </div>
          </div>

          {/* Tags Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="web3, blockchain, defi..."
              value={localFilters.tags?.join(', ') || ''}
              onChange={(e) => {
                const tags = e.target.value
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(tag => tag.length > 0);
                handleFilterChange('tags', tags);
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-20"
            />
          </div>
        </div>
      )}
    </div>
  );
}