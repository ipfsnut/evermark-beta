import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EvermarkService } from '../services/EvermarkService';
import type { Evermark } from '../types';

interface UseEvermarkDetailResult {
  evermark: Evermark | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  updateError: string | null;
  loadEvermark: (id: string) => Promise<void>;
  refreshEvermark: () => Promise<void>;
  updateEvermark: (updates: Partial<Evermark>) => Promise<void>;
  clearError: () => void;
}

export function useEvermarkDetail(id?: string): UseEvermarkDetailResult {
  const [updateError, setUpdateError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Main evermark query
  const {
    data: evermark,
    isLoading,
    error: queryError,
    refetch
  } = useQuery({
    queryKey: ['evermark', id],
    queryFn: () => id ? EvermarkService.fetchEvermark(id) : null,
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  // Update mutation (for future metadata updates)
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Evermark>) => {
      if (!evermark) throw new Error('No evermark to update');
      // This would be implemented when update functionality is added
      return { ...evermark, ...updates };
    },
    onSuccess: (updatedEvermark) => {
      queryClient.setQueryData(['evermark', id], updatedEvermark);
      setUpdateError(null);
    },
    onError: (error) => {
      setUpdateError(error instanceof Error ? error.message : 'Update failed');
    }
  });

  const loadEvermark = useCallback(async (evermarkId: string) => {
    await queryClient.refetchQueries({ queryKey: ['evermark', evermarkId] });
  }, [queryClient]);

  const refreshEvermark = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const updateEvermark = useCallback(async (updates: Partial<Evermark>) => {
    await updateMutation.mutateAsync(updates);
  }, [updateMutation]);

  const clearError = useCallback(() => {
    setUpdateError(null);
  }, []);

  const error = queryError instanceof Error ? queryError.message : queryError as unknown as string;

  return {
    evermark: evermark || null,
    isLoading,
    error,
    isUpdating: updateMutation.isPending,
    updateError,
    loadEvermark,
    refreshEvermark,
    updateEvermark,
    clearError
  };
}