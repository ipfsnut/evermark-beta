import { useCallback } from 'react';
import type { CreateEvermarkInput, UseEvermarksResult } from '../types';

// Import the specialized hooks
import { useEvermarkQueries } from './useEvermarkQueries';
import { useEvermarkCreation } from './useEvermarkCreation';


/**
 * Main state management hook for Evermarks feature
 * Now uses specialized hooks for better performance and maintainability
 */
export function useEvermarksState(): UseEvermarksResult {
  // Use specialized hooks
  const queries = useEvermarkQueries();
  const creation = useEvermarkCreation();

  // Delegate createEvermark to the specialized creation hook
  const createEvermark = useCallback(async (input: CreateEvermarkInput) => {
    return creation.createEvermark(input);
  }, [creation.createEvermark]);

  return {
    // State from queries hook
    evermarks: queries.evermarks,
    selectedEvermark: queries.selectedEvermark,
    pagination: queries.pagination,
    filters: queries.filters,
    totalCount: queries.totalCount,
    totalPages: queries.totalPages,
    
    // Loading states
    isLoading: queries.isLoading,
    isCreating: creation.isCreating,
    isLoadingMore: queries.isLoadingMore,
    
    // Error states
    error: queries.error,
    createError: creation.createError,
    
    // Creation progress from creation hook
    createProgress: creation.createProgress,
    createStep: creation.createStep,
    
    // Actions from queries hook
    loadEvermarks: queries.loadEvermarks,
    loadMore: queries.loadMore,
    refresh: queries.refresh,
    loadEvermark: queries.loadEvermark,
    selectEvermark: queries.selectEvermark,
    setFilters: queries.setFilters,
    setPagination: queries.setPagination,
    clearFilters: queries.clearFilters,
    clearErrors: queries.clearErrors,
    
    // Actions from creation hook
    createEvermark,
    clearCreateError: creation.clearCreateError,
    
    // Computed properties from queries hook
    hasNextPage: queries.hasNextPage,
    hasPreviousPage: queries.hasPreviousPage,
    isEmpty: queries.isEmpty,
    isFiltered: queries.isFiltered
  };
}