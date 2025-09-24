import { useState, useCallback } from 'react';
import { CompleteCastBackupService, type CompleteCastBackup } from '../services/CompleteCastBackupService';
import { useNotifications } from '@/hooks/useNotifications';

interface BackupProgress {
  stage: 'fetching' | 'media' | 'thread' | 'frames' | 'storing' | 'complete' | 'error';
  progress: number;
  message: string;
}

interface UseCompleteCastBackupResult {
  createBackup: (
    castInput: string,
    options?: Parameters<typeof CompleteCastBackupService.createCompleteBackup>[1]
  ) => Promise<CompleteCastBackup | null>;
  createBulkBackup: (
    castInputs: string[],
    options?: Parameters<typeof CompleteCastBackupService.createCompleteBackup>[1]
  ) => Promise<CompleteCastBackup[]>;
  restoreBackup: (preservationId: string) => Promise<CompleteCastBackup | null>;
  verifyBackup: (backup: CompleteCastBackup) => Promise<{ valid: boolean; issues: string[] }>;
  isLoading: boolean;
  progress: BackupProgress | null;
  error: string | null;
}

export function useCompleteCastBackup(): UseCompleteCastBackupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { success, error: showError, warning } = useNotifications();

  const updateProgress = useCallback((stage: BackupProgress['stage'], progress: number, message: string) => {
    setProgress({ stage, progress, message });
  }, []);

  const createBackup = useCallback(async (
    castInput: string,
    options?: Parameters<typeof CompleteCastBackupService.createCompleteBackup>[1]
  ): Promise<CompleteCastBackup | null> => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      updateProgress('fetching', 10, 'Fetching cast metadata...');
      
      // Create progress tracking wrapper
      const originalCreateBackup = CompleteCastBackupService.createCompleteBackup;
      
      // Mock progress updates (in production, these would come from the service)
      setTimeout(() => updateProgress('media', 30, 'Preserving media content...'), 1000);
      setTimeout(() => updateProgress('thread', 60, 'Preserving thread context...'), 2000);
      setTimeout(() => updateProgress('frames', 80, 'Preserving frames...'), 3000);
      setTimeout(() => updateProgress('storing', 90, 'Storing backup...'), 4000);

      const backup = await originalCreateBackup(castInput, options);
      
      updateProgress('complete', 100, 'Backup complete!');
      
      success(
        'Cast Backup Created',
        `Complete backup created with ${getCompleteness(backup)}% completeness`
      );

      setIsLoading(false);
      return backup;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Backup failed';
      setError(errorMessage);
      updateProgress('error', 0, errorMessage);
      
      showError(
        'Backup Failed',
        errorMessage
      );

      setIsLoading(false);
      return null;
    }
  }, [updateProgress, success, showError, warning]);

  const createBulkBackup = useCallback(async (
    castInputs: string[],
    options?: Parameters<typeof CompleteCastBackupService.createCompleteBackup>[1]
  ): Promise<CompleteCastBackup[]> => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      updateProgress('fetching', 0, `Backing up ${castInputs.length} casts...`);

      const backups: CompleteCastBackup[] = [];
      
      for (let i = 0; i < castInputs.length; i++) {
        const progress = Math.round(((i + 1) / castInputs.length) * 100);
        updateProgress('fetching', progress, `Processing cast ${i + 1} of ${castInputs.length}...`);
        
        const backup = await CompleteCastBackupService.createCompleteBackup(castInputs[i], options);
        if (backup) {
          backups.push(backup);
        }
      }

      updateProgress('complete', 100, `Bulk backup complete! ${backups.length}/${castInputs.length} successful`);
      
      success(
        'Bulk Backup Complete',
        `Successfully backed up ${backups.length} of ${castInputs.length} casts`
      );

      setIsLoading(false);
      return backups;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk backup failed';
      setError(errorMessage);
      updateProgress('error', 0, errorMessage);
      
      showError(
        'Bulk Backup Failed',
        errorMessage
      );

      setIsLoading(false);
      return [];
    }
  }, [updateProgress, success, showError, warning]);

  const restoreBackup = useCallback(async (
    preservationId: string
  ): Promise<CompleteCastBackup | null> => {
    setIsLoading(true);
    setError(null);

    try {
      updateProgress('fetching', 50, 'Restoring backup...');
      
      const backup = await CompleteCastBackupService.restoreFromBackup(preservationId);
      
      if (backup) {
        updateProgress('complete', 100, 'Backup restored successfully');
        success(
          'Backup Restored',
          'Cast backup has been restored successfully'
        );
      } else {
        throw new Error('Backup not found or corrupted');
      }

      setIsLoading(false);
      return backup;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore backup';
      setError(errorMessage);
      updateProgress('error', 0, errorMessage);
      
      showError(
        'Restore Failed',
        errorMessage
      );

      setIsLoading(false);
      return null;
    }
  }, [updateProgress, success, showError, warning]);

  const verifyBackup = useCallback(async (
    backup: CompleteCastBackup
  ): Promise<{ valid: boolean; issues: string[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      updateProgress('fetching', 50, 'Verifying backup integrity...');
      
      const result = await CompleteCastBackupService.verifyBackupIntegrity(backup);
      
      updateProgress('complete', 100, 'Verification complete');
      
      if (result.valid) {
        success(
          'Backup Verified',
          'Backup integrity confirmed'
        );
      } else {
        warning(
          'Backup Issues Found',
          `Found ${result.issues.length} integrity issues`
        );
      }

      setIsLoading(false);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      setError(errorMessage);
      updateProgress('error', 0, errorMessage);
      
      showError(
        'Verification Failed',
        errorMessage
      );

      setIsLoading(false);
      return { valid: false, issues: [errorMessage] };
    }
  }, [updateProgress, success, showError, warning]);

  return {
    createBackup,
    createBulkBackup,
    restoreBackup,
    verifyBackup,
    isLoading,
    progress,
    error,
  };
}

function getCompleteness(backup: CompleteCastBackup): number {
  const checks = [
    backup.backup_metadata?.completeness?.text,
    backup.backup_metadata?.completeness?.media,
    backup.backup_metadata?.completeness?.thread,
    backup.backup_metadata?.completeness?.frames,
    backup.backup_metadata?.completeness?.profiles
  ];
  
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}