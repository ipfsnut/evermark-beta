import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminService, type SeasonStatusCheck, type WizardStatus, type WizardStep } from '../services/AdminService';

export function useSeasonFinalization(seasonNumber?: number) {
  const queryClient = useQueryClient();
  
  // Season validation query
  const {
    data: seasonStatus,
    isLoading: isValidating,
    error: validationError,
    refetch: validateSeason
  } = useQuery({
    queryKey: ['admin', 'season-validation', seasonNumber],
    queryFn: () => AdminService.validateSeason(seasonNumber),
    enabled: !!seasonNumber,
    staleTime: 30000, // 30 seconds
  });

  // Wizard status query
  const {
    data: wizardStatus,
    isLoading: isLoadingWizard,
    refetch: refreshWizardStatus
  } = useQuery({
    queryKey: ['admin', 'wizard-status', seasonNumber],
    queryFn: () => AdminService.getWizardStatus(seasonNumber),
    enabled: !!seasonNumber,
    staleTime: 10000, // 10 seconds
  });

  // Finalizable seasons query
  const {
    data: finalizableSeasons = [],
    isLoading: isLoadingFinalizable
  } = useQuery({
    queryKey: ['admin', 'finalizable-seasons'],
    queryFn: () => AdminService.getFinalizableSeasons(),
    staleTime: 60000, // 1 minute
  });

  // Start wizard mutation
  const startWizardMutation = useMutation({
    mutationFn: (season: number) => AdminService.startWizard(season),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    }
  });

  // Reset wizard mutation
  const resetWizardMutation = useMutation({
    mutationFn: (season: number) => AdminService.resetWizard(season),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    }
  });

  // Helper functions
  const canFinalizeSeason = (season?: number): boolean => {
    if (!season || !seasonStatus) return false;
    return seasonStatus.canProceed;
  };

  const isWizardActive = (): boolean => {
    return wizardStatus?.steps.some(step => step.status === 'in_progress') || false;
  };

  const getCurrentWizardStep = (): number => {
    return wizardStatus?.currentStep || 1;
  };

  const getCompletedSteps = (): number => {
    return wizardStatus?.steps.filter(step => step.status === 'completed').length || 0;
  };

  return {
    // Data
    seasonStatus,
    wizardStatus,
    finalizableSeasons,
    
    // Loading states
    isValidating,
    isLoadingWizard,
    isLoadingFinalizable,
    isStartingWizard: startWizardMutation.isPending,
    isResettingWizard: resetWizardMutation.isPending,
    
    // Error states
    validationError,
    startError: startWizardMutation.error,
    resetError: resetWizardMutation.error,
    
    // Actions
    validateSeason,
    startWizard: startWizardMutation.mutate,
    resetWizard: resetWizardMutation.mutate,
    refreshWizardStatus,
    
    // Helper functions
    canFinalizeSeason,
    isWizardActive,
    getCurrentWizardStep,
    getCompletedSteps
  };
}

export function useWizardStep(seasonNumber: number, stepNumber: number) {
  const [stepData, setStepData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateStepData = async (data: any) => {
    try {
      setIsProcessing(true);
      await AdminService.updateWizardProgress(seasonNumber, stepNumber, data);
      setStepData(data);
      setErrors([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors([errorMessage]);
      console.error(`Step ${stepNumber} update failed:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearErrors = () => {
    setErrors([]);
  };

  return {
    stepData,
    isProcessing,
    errors,
    updateStepData,
    clearErrors,
    hasErrors: errors.length > 0
  };
}