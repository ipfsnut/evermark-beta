import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export interface SeasonStatusCheck {
  seasonNumber: number;
  endTime: Date;
  isEnded: boolean;
  totalVotes: bigint;
  totalVoters: number;
  syncStatus: 'complete' | 'pending' | 'error';
  discrepancies: string[];
  canProceed: boolean;
  blockchainFinalized: boolean;
  databaseStored: boolean;
}

export interface WizardStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  data?: any;
  errors?: string[];
}

export interface WizardStatus {
  steps: WizardStep[];
  currentStep: number;
  canStart: boolean;
  wizardId?: string;
}

export class AdminService {
  static async validateSeason(seasonNumber?: number): Promise<SeasonStatusCheck> {
    try {
      const response = await fetch(`/.netlify/functions/admin-season-finalize?action=validate-season${seasonNumber ? `&season=${seasonNumber}` : ''}`);
      
      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Season validation failed:', error);
      throw error;
    }
  }

  static async getWizardStatus(seasonNumber?: number): Promise<WizardStatus> {
    try {
      const response = await fetch(`/.netlify/functions/admin-season-finalize?action=get-wizard-status${seasonNumber ? `&season=${seasonNumber}` : ''}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get wizard status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get wizard status:', error);
      throw error;
    }
  }

  static async startWizard(seasonNumber: number): Promise<{ success: boolean; wizardId: string; steps: WizardStep[] }> {
    try {
      const response = await fetch(`/.netlify/functions/admin-season-finalize?action=start-wizard&season=${seasonNumber}`);
      
      if (!response.ok) {
        throw new Error(`Failed to start wizard: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to start wizard:', error);
      throw error;
    }
  }

  static async resetWizard(seasonNumber: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/.netlify/functions/admin-season-finalize?action=reset-wizard&season=${seasonNumber}`);
      
      if (!response.ok) {
        throw new Error(`Failed to reset wizard: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to reset wizard:', error);
      throw error;
    }
  }

  static async getFinalizableSeasons(): Promise<number[]> {
    try {
      // Get recent finalized seasons from blockchain that aren't in database yet
      const response = await fetch('/.netlify/functions/season-finalization?action=detect-finalizations');
      
      if (!response.ok) {
        throw new Error('Failed to detect finalizable seasons');
      }
      
      const result = await response.json();
      return result.newFinalizations || [];
    } catch (error) {
      console.error('Failed to get finalizable seasons:', error);
      return [];
    }
  }

  static async checkSeasonFinalizationStatus(seasonNumber: number): Promise<{
    blockchainFinalized: boolean;
    databaseStored: boolean;
    canFinalize: boolean;
  }> {
    try {
      const response = await fetch(`/.netlify/functions/season-finalization?action=check-finalized&season_number=${seasonNumber}`);
      
      if (!response.ok) {
        throw new Error('Failed to check finalization status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to check finalization status:', error);
      return {
        blockchainFinalized: false,
        databaseStored: false,
        canFinalize: false
      };
    }
  }

  static async updateWizardProgress(seasonNumber: number, step: number, stepData: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('wizard_progress')
        .upsert({
          season_number: seasonNumber,
          current_step: step,
          step_data: stepData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'season_number'
        });

      if (error) {
        throw new Error(`Failed to update wizard progress: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to update wizard progress:', error);
      throw error;
    }
  }

  static async getSystemHealth(): Promise<{
    contractsOnline: boolean;
    databaseConnected: boolean;
    syncStatus: string;
    lastSyncTime: Date | null;
    pendingOperations: number;
  }> {
    try {
      // Check various system components
      const [contractCheck, dbCheck, syncCheck] = await Promise.all([
        this.checkContractHealth(),
        this.checkDatabaseHealth(),
        this.checkSyncHealth()
      ]);

      return {
        contractsOnline: contractCheck,
        databaseConnected: dbCheck,
        syncStatus: syncCheck.status,
        lastSyncTime: syncCheck.lastSyncTime,
        pendingOperations: 0 // Would count pending operations
      };
    } catch (error) {
      console.error('System health check failed:', error);
      return {
        contractsOnline: false,
        databaseConnected: false,
        syncStatus: 'error',
        lastSyncTime: null,
        pendingOperations: 0
      };
    }
  }

  private static async checkContractHealth(): Promise<boolean> {
    try {
      // Test contract connectivity by reading current season
      const response = await fetch('/.netlify/functions/voting-sync?action=get-current-cycle');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private static async checkDatabaseHealth(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('beta_evermarks')
        .select('id', { count: 'exact', head: true })
        .limit(1);
      
      return !error;
    } catch (error) {
      return false;
    }
  }

  private static async checkSyncHealth(): Promise<{ status: string; lastSyncTime: Date | null }> {
    try {
      const response = await fetch('/.netlify/functions/voting-sync?action=stats');
      if (!response.ok) {
        return { status: 'error', lastSyncTime: null };
      }
      
      const stats = await response.json();
      return {
        status: stats.cacheHealth || 'unknown',
        lastSyncTime: stats.lastUpdated ? new Date(stats.lastUpdated) : null
      };
    } catch (error) {
      return { status: 'error', lastSyncTime: null };
    }
  }
}