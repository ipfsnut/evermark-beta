import type { FarcasterCastData } from '../types';
import { FarcasterService } from './FarcasterService';

const SIMPLE_BACKUP_CONFIG = {
  API_BASE: import.meta.env.VITE_API_URL || '/.netlify/functions',
};

export interface SimpleCastBackupOptions {
  includeMedia?: boolean;
  includeThread?: boolean;
  estimateCostOnly?: boolean;
  userWallet?: string;
}

export interface BackupCostEstimate {
  mediaCostUSD: number;
  storageCostUSD: number;
  totalCostUSD: number;
  ardriveCreditsNeeded: number;
  canAfford: boolean;
  walletBalance?: number;
}

export interface SimpleCastBackup extends FarcasterCastData {
  backupId: string;
  backupDate: string;
  includedMedia: boolean;
  includedThread: boolean;
  costPaid: number;
  mediaUrls: string[];
  preservedMediaCount: number;
}

export class SimpleCastBackupService {
  /**
   * Get cost estimate for backing up a cast
   */
  static async getCostEstimate(
    castInput: string,
    options: SimpleCastBackupOptions = {}
  ): Promise<BackupCostEstimate> {
    try {
      const response = await fetch(`${SIMPLE_BACKUP_CONFIG.API_BASE}/estimate-backup-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          castInput,
          includeMedia: options.includeMedia ?? true,
          includeThread: options.includeThread ?? false,
          userWallet: options.userWallet,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get cost estimate');
      }

      return await response.json();
    } catch (error) {
      console.error('Cost estimation failed:', error);
      return {
        mediaCostUSD: 0,
        storageCostUSD: 0,
        totalCostUSD: 0,
        ardriveCreditsNeeded: 0,
        canAfford: false,
      };
    }
  }

  /**
   * Simple single cast backup
   */
  static async backupSingleCast(
    castInput: string,
    options: SimpleCastBackupOptions = {}
  ): Promise<SimpleCastBackup | null> {
    try {
      console.log('🚀 Starting simple cast backup for:', castInput);

      // Step 1: Get cost estimate first
      if (!options.estimateCostOnly) {
        const costEstimate = await this.getCostEstimate(castInput, options);
        if (!costEstimate.canAfford) {
          throw new Error(`Insufficient funds. Need $${costEstimate.totalCostUSD.toFixed(2)} USD`);
        }
      }

      // Step 2: Fetch basic cast data
      const castData = await FarcasterService.fetchCastMetadata(castInput);
      if (!castData) {
        throw new Error('Failed to fetch cast metadata');
      }

      // Step 3: Create backup
      const response = await fetch(`${SIMPLE_BACKUP_CONFIG.API_BASE}/backup-single-cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          castInput,
          castData,
          includeMedia: options.includeMedia ?? true,
          includeThread: options.includeThread ?? false,
          userWallet: options.userWallet,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Backup failed');
      }

      const backup = await response.json();
      
      const simpleCastBackup: SimpleCastBackup = {
        ...castData,
        backupId: backup.backupId,
        backupDate: new Date().toISOString(),
        includedMedia: backup.includedMedia,
        includedThread: backup.includedThread,
        costPaid: backup.costPaid,
        mediaUrls: backup.mediaUrls || [],
        preservedMediaCount: backup.preservedMediaCount || 0,
      };

      console.log('✅ Simple cast backup completed:', simpleCastBackup.backupId);
      return simpleCastBackup;

    } catch (error) {
      console.error('❌ Simple cast backup failed:', error);
      throw error;
    }
  }

  /**
   * Check ArDrive wallet balance
   */
  static async checkWalletBalance(): Promise<{
    balanceUSD: number;
    balanceAR: number;
    sufficientForBasicBackup: boolean;
  }> {
    try {
      const response = await fetch(`${SIMPLE_BACKUP_CONFIG.API_BASE}/check-ardrive-balance`);
      if (!response.ok) {
        throw new Error('Failed to check wallet balance');
      }
      return await response.json();
    } catch (error) {
      console.error('Balance check failed:', error);
      return {
        balanceUSD: 0,
        balanceAR: 0,
        sufficientForBasicBackup: false,
      };
    }
  }

  /**
   * Get backup by ID
   */
  static async getBackup(backupId: string): Promise<SimpleCastBackup | null> {
    try {
      const response = await fetch(
        `${SIMPLE_BACKUP_CONFIG.API_BASE}/get-backup?id=${backupId}`
      );
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get backup:', error);
      return null;
    }
  }

  /**
   * List user's backups
   */
  static async listUserBackups(userWallet: string): Promise<SimpleCastBackup[]> {
    try {
      const response = await fetch(
        `${SIMPLE_BACKUP_CONFIG.API_BASE}/list-backups?wallet=${userWallet}`
      );
      if (!response.ok) {
        return [];
      }
      const result = await response.json();
      return result.backups || [];
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Validate cast input before backup
   */
  static validateCastInput(input: string): {
    valid: boolean;
    type: 'url' | 'hash' | null;
    error?: string;
  } {
    const result = FarcasterService.validateFarcasterInput(input);
    return {
      valid: result.isValid,
      type: result.type,
      error: result.error,
    };
  }

  /**
   * Extract media count from cast for cost estimation
   */
  static async getMediaCount(castInput: string): Promise<number> {
    try {
      const castData = await FarcasterService.fetchCastMetadata(castInput);
      if (!castData?.embeds) return 0;
      
      // Count media items
      let mediaCount = 0;
      for (const embed of castData.embeds) {
        if (embed.url) {
          const urlLower = embed.url.toLowerCase();
          if (urlLower.includes('.jpg') || 
              urlLower.includes('.png') || 
              urlLower.includes('.gif') ||
              urlLower.includes('.mp4') ||
              urlLower.includes('.webm')) {
            mediaCount++;
          }
        }
      }
      
      return mediaCount;
    } catch (error) {
      console.error('Failed to count media:', error);
      return 0;
    }
  }
}