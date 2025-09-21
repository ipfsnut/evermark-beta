// src/types/storage.ts
// Type definitions for unified storage system

// Base upload result interface
export interface BaseUploadResult {
  success: boolean;
  error?: string;
}

// IPFS-specific upload result
export interface IPFSUploadResult extends BaseUploadResult {
  hash?: string;
  url?: string;
  size?: number;
  backend: 'ipfs';
}

// ArDrive-specific upload result
export interface ArDriveUploadResult extends BaseUploadResult {
  txId?: string;
  url?: string;
  size?: number;
  cost?: number; // Cost in USD
  arAmount?: string; // Cost in AR tokens
  backend: 'ardrive';
  season?: SeasonInfo;
}

// Unified upload result that can represent either backend
export interface UnifiedUploadResult extends BaseUploadResult {
  // Common fields
  url?: string;
  size?: number;
  backend: 'ipfs' | 'ardrive' | 'dual';
  
  // IPFS fields
  hash?: string;
  
  // ArDrive fields
  txId?: string;
  cost?: number;
  arAmount?: string;
  season?: SeasonInfo;
  
  // Dual storage fields
  ipfs?: IPFSUploadResult;
  ardrive?: ArDriveUploadResult;
}

// Upload options for different backends
export interface ArDriveUploadOptions {
  folderId?: string;
  seasonNumber?: number;
  contentType?: string;
  tags?: string[];
}

export interface IPFSUploadOptions {
  pinataMetadata?: {
    name?: string;
    keyvalues?: Record<string, string>;
  };
  pinataOptions?: {
    cidVersion?: 0 | 1;
  };
}

export interface UnifiedUploadOptions {
  backend?: 'ipfs' | 'ardrive' | 'dual';
  ipfsOptions?: IPFSUploadOptions;
  ardriveOptions?: ArDriveUploadOptions;
  preferredBackend?: 'ipfs' | 'ardrive';
}

// Cost estimation interfaces
export interface StorageCostEstimate {
  usd: number;
  ar?: string;
  backend: string;
  sizeInBytes: number;
  permanent: boolean;
  estimated: boolean;
}

export interface ArDriveCostEstimate extends StorageCostEstimate {
  ar: string;
  backend: 'ardrive';
  permanent: true;
  winc?: string; // Winston credits
  pricePerByte?: number;
}

export interface IPFSCostEstimate extends StorageCostEstimate {
  backend: 'ipfs';
  permanent: false;
  monthlyFee?: number;
  yearlyFee?: number;
}

// Season management types
export interface SeasonInfo {
  number: number;
  year: number;
  week: string; // e.g., "W01", "W52"
  startDate: Date;
  endDate: Date;
  phase: 'active' | 'preparing' | 'finalizing' | 'completed';
  status: string;
}

export interface SeasonBoundaries {
  start: Date;
  end: Date;
  previous?: Date;
  next?: Date;
}

export interface SeasonState {
  current: SeasonInfo;
  previous: SeasonInfo;
  next: SeasonInfo;
  transition?: {
    shouldTransition: boolean;
    isTransitionWindow: boolean;
    nextTransition: string; // ISO date string
    remainingTime?: number; // milliseconds
  };
}

export interface SeasonUploadResult extends ArDriveUploadResult {
  season: SeasonInfo;
  folderPath: string;
  manifestTxId?: string;
}

// Storage metrics and monitoring
export interface StorageMetrics {
  ipfs: {
    status: 'healthy' | 'warning' | 'error';
    totalUploads: number;
    successRate: number;
    avgUploadTime: number;
    lastUpload: string | null;
    totalSize: number;
  };
  ardrive: {
    status: 'healthy' | 'warning' | 'error' | 'disabled';
    totalUploads: number;
    successRate: number;
    avgUploadTime: number;
    lastUpload: string | null;
    totalCostUSD: number;
    avgCostPerMB: number;
    totalSize: number;
  };
  backend: {
    current: 'ipfs' | 'ardrive' | 'dual';
    featureFlags: {
      ardriveEnabled: boolean;
      dualStorage: boolean;
    };
  };
  season: {
    currentFolder: string | null;
    folderStatus: 'ready' | 'preparing' | 'error';
    manifestExists: boolean;
    currentSeason?: SeasonInfo;
  };
}

// File processing types
export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  extension: string;
  isImage: boolean;
  isVideo: boolean;
}

export interface ProcessedFile {
  original: File;
  metadata: FileMetadata;
  preview?: string; // Data URL for previews
  thumbnail?: Blob; // Generated thumbnail
  compressed?: Blob; // Compressed version
}

// Storage configuration types
export interface StorageBackendConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  retries: number;
  fallback?: 'ipfs' | 'ardrive';
}

export interface StorageServiceConfig {
  backends: {
    ipfs: StorageBackendConfig;
    ardrive: StorageBackendConfig;
  };
  defaultBackend: 'ipfs' | 'ardrive' | 'dual';
  enableFallback: boolean;
  enableCostEstimation: boolean;
  enableSeasonManagement: boolean;
}

// Error types
export interface StorageError extends Error {
  backend: string;
  code: string;
  retryable: boolean;
  details?: any;
}

export interface UploadError extends StorageError {
  fileSize?: number;
  fileName?: string;
  uploadProgress?: number;
}

// Storage provider interfaces
export interface StorageProvider {
  name: string;
  isConfigured(): boolean;
  uploadImage(file: File, options?: any): Promise<BaseUploadResult>;
  uploadMetadata(metadata: object, options?: any): Promise<BaseUploadResult>;
  estimateCost(sizeInBytes: number): Promise<StorageCostEstimate>;
  getUrl(identifier: string): string;
}

// Service status types
export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'disabled';
  lastCheck: string;
  responseTime?: number;
  errorMessage?: string;
  details?: Record<string, any>;
}

export interface StorageServiceStatus {
  overall: 'healthy' | 'warning' | 'error';
  backends: {
    ipfs: ServiceStatus;
    ardrive: ServiceStatus;
  };
  features: {
    seasonManagement: ServiceStatus;
    costEstimation: ServiceStatus;
  };
  lastUpdate: string;
}

// Migration types
export interface MigrationProgress {
  phase: 'planning' | 'migrating' | 'validating' | 'completed' | 'failed';
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  startTime: string;
  estimatedCompletion?: string;
  currentFile?: string;
  errors: string[];
}

export interface MigrationResult {
  success: boolean;
  oldBackend: string;
  newBackend: string;
  filesProcessed: number;
  totalCost?: number;
  errors: string[];
  duration: number;
}

// React hook return types
export interface UseStorageCostReturn {
  estimate: StorageCostEstimate | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseStorageStatusReturn {
  status: StorageServiceStatus;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseSeasonStateReturn {
  state: SeasonState | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Event types for storage operations
export interface StorageEvent {
  type: 'upload_start' | 'upload_progress' | 'upload_complete' | 'upload_error' | 'cost_estimate';
  backend: string;
  data: any;
  timestamp: string;
}

export interface UploadProgressEvent extends StorageEvent {
  type: 'upload_progress';
  data: {
    fileName: string;
    progress: number; // 0-100
    bytesUploaded: number;
    totalBytes: number;
  };
}

export interface CostEstimateEvent extends StorageEvent {
  type: 'cost_estimate';
  data: StorageCostEstimate;
}