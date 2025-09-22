// src/config/features.ts
// Feature flags and configuration for ArDrive migration and unified storage

export interface FeatureConfig {
  // ArDrive feature flags
  isArDriveEnabled(): boolean;
  shouldUseDualStorage(): boolean;
  getStorageBackend(): 'ipfs' | 'ardrive' | 'dual';
  
  // Season management
  isSeasonManagementEnabled(): boolean;
  
  // Cost estimation
  isCostEstimationEnabled(): boolean;
  
  // Development features
  isDevModeEnabled(): boolean;
}

class FeaturesService implements FeatureConfig {
  /**
   * Check if ArDrive storage is enabled
   */
  isArDriveEnabled(): boolean {
    // Check environment variable first (use import.meta.env for Vite)
    const envFlag = import.meta.env.VITE_ARDRIVE_ENABLED;
    if (envFlag !== undefined) {
      return envFlag === 'true' || envFlag === '1';
    }
    
    // Check if ArDrive private key is configured (server-side or client-side)
    const hasPrivateKey = Boolean(import.meta.env.ARDRIVE_PRIVATE_KEY || import.meta.env.VITE_ARDRIVE_PRIVATE_KEY);
    
    // Default to false in production, true in development if private key exists
    return import.meta.env.MODE === 'development' ? hasPrivateKey : false;
  }

  /**
   * Check if dual storage (IPFS + ArDrive) should be used
   */
  shouldUseDualStorage(): boolean {
    // Must have ArDrive enabled first
    if (!this.isArDriveEnabled()) {
      return false;
    }
    
    // Check environment variable
    const envFlag = import.meta.env.VITE_DUAL_STORAGE;
    if (envFlag !== undefined) {
      return envFlag === 'true' || envFlag === '1';
    }
    
    // Default to true if ArDrive is enabled (gradual migration)
    return true;
  }

  /**
   * Get the current storage backend configuration
   */
  getStorageBackend(): 'ipfs' | 'ardrive' | 'dual' {
    // Check explicit backend setting
    const backendSetting = import.meta.env.VITE_STORAGE_BACKEND;
    if (backendSetting === 'ipfs' || backendSetting === 'ardrive' || backendSetting === 'dual') {
      return backendSetting;
    }
    
    // Determine backend based on feature flags
    if (this.shouldUseDualStorage()) {
      return 'dual';
    } else if (this.isArDriveEnabled()) {
      return 'ardrive';
    } else {
      return 'ipfs';
    }
  }

  /**
   * Check if season management is enabled
   */
  isSeasonManagementEnabled(): boolean {
    const envFlag = import.meta.env.VITE_SEASON_MANAGEMENT;
    if (envFlag !== undefined) {
      return envFlag === 'true' || envFlag === '1';
    }
    
    // Default to true if ArDrive is enabled (season organization)
    return this.isArDriveEnabled();
  }

  /**
   * Check if storage cost estimation is enabled
   */
  isCostEstimationEnabled(): boolean {
    const envFlag = import.meta.env.VITE_COST_ESTIMATION;
    if (envFlag !== undefined) {
      return envFlag === 'true' || envFlag === '1';
    }
    
    // Default to true if ArDrive is enabled (cost transparency)
    return this.isArDriveEnabled();
  }

  /**
   * Check if development mode features are enabled
   */
  isDevModeEnabled(): boolean {
    return import.meta.env.MODE === 'development' || import.meta.env.VITE_DEV_MODE === 'true';
  }

  /**
   * Get feature flag summary for debugging
   */
  getFeatureSummary() {
    return {
      ardriveEnabled: this.isArDriveEnabled(),
      dualStorage: this.shouldUseDualStorage(),
      storageBackend: this.getStorageBackend(),
      seasonManagement: this.isSeasonManagementEnabled(),
      costEstimation: this.isCostEstimationEnabled(),
      devMode: this.isDevModeEnabled(),
      environment: import.meta.env.MODE,
      hasArDriveKey: Boolean(import.meta.env.ARDRIVE_PRIVATE_KEY || import.meta.env.VITE_ARDRIVE_PRIVATE_KEY),
      hasPinataKey: Boolean(import.meta.env.VITE_PINATA_JWT)
    };
  }

  /**
   * Validate feature configuration and return warnings
   */
  validateConfiguration(): string[] {
    const warnings: string[] = [];
    
    // Check for missing ArDrive configuration
    if (this.isArDriveEnabled() && !import.meta.env.ARDRIVE_PRIVATE_KEY && !import.meta.env.VITE_ARDRIVE_PRIVATE_KEY) {
      warnings.push('ArDrive is enabled but ARDRIVE_PRIVATE_KEY is not configured');
    }
    
    // Check for missing IPFS configuration
    if (!import.meta.env.VITE_PINATA_JWT) {
      warnings.push('IPFS storage requires VITE_PINATA_JWT to be configured');
    }
    
    // Check for dual storage without ArDrive
    if (this.shouldUseDualStorage() && !this.isArDriveEnabled()) {
      warnings.push('Dual storage is enabled but ArDrive is not available');
    }
    
    // Check for season management without ArDrive
    if (this.isSeasonManagementEnabled() && !this.isArDriveEnabled()) {
      warnings.push('Season management is enabled but works best with ArDrive storage');
    }
    
    return warnings;
  }
}

// Export singleton instance
export const FEATURES = new FeaturesService();

// Export configuration for easy access
export const STORAGE_CONFIG = {
  // IPFS Configuration
  IPFS: {
    gateway: 'https://gateway.pinata.cloud/ipfs/',
    apiUrl: 'https://api.pinata.cloud',
    timeout: 30000, // 30 seconds
  },
  
  // ArDrive Configuration
  ARDRIVE: {
    gateway: 'https://arweave.net/',
    turboUrl: 'https://turbo.ardrive.io',
    timeout: 60000, // 60 seconds for permanent storage
    costPerMB: 0.0001, // Approximate cost per MB in USD (will be fetched dynamically)
  },
  
  // Season Configuration
  SEASON: {
    startDate: new Date('2024-01-01'), // Season 1 start date
    weekDuration: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
    transitionGracePeriod: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  },
  
  // File Upload Limits
  UPLOAD: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxMetadataSize: 1024 * 1024, // 1MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/webm'],
  }
} as const;

// Development helper
if (FEATURES.isDevModeEnabled()) {
  console.log('🔧 Feature Configuration:', FEATURES.getFeatureSummary());
  
  const warnings = FEATURES.validateConfiguration();
  if (warnings.length > 0) {
    console.warn('⚠️ Configuration Warnings:', warnings);
  }
}